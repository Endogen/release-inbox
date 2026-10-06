# Releases: a GitHub release inbox

A self-hosted inbox for the GitHub releases you watch. It shows the newest release of every
repository, with release notes, the README, and one-click triage, and notifies you
when something new ships.

## Features

- **One entry per repository.** Only the newest release is listed (`+N older` shows the rest;
  switch versions in the detail view).
- **Inbox, Read and Hidden views.** Marking a release as read moves it, and all older releases
  of the repository, to *Read*. Read state is mirrored to github.com.
- **Hide components.** Hide releases of a single component of a repository, such as `web@*` in
  a monorepo, without unsubscribing. Hidden releases stay available in the *Hidden* view.
- **Unsubscribe in one click.** Stops watching the repository on GitHub.
- **Swipe to triage.** In the inbox, swipe an entry left to mark it as read or right to
  unsubscribe. Both actions, whether you swipe, click or use a shortcut, show a toast with
  **Undo** for six seconds. The change is only sent to GitHub after that, so undoing leaves
  GitHub untouched. If you close the tab during that time, the action is sent immediately.
- **Release notes and README** rendered as GitHub-flavoured markdown.
- **Search** across repositories, release names, tags and notes.
- **Per-repository notifications.** Every repository you watch sends push notifications,
  including ones you start watching later. Mute a repository with the bell on one of its
  releases (or `m`). Its releases still arrive in the inbox, just without a push. Muted
  repositories are listed in Settings, where you can unmute them.
- **Live updates and push notifications.** GitHub is polled every minute (at the interval GitHub
  asks for). Open tabs update instantly via server-sent events, and Web Push notifies your
  devices even when the app is closed.
- **Keyboard driven.** `j`/`k` navigate, `e` marks as read, `h` hides, `o` opens on GitHub,
  `/` searches, and `?` lists all shortcuts.
- Light and dark theme, responsive layout, installable as an app.

## Architecture

```
frontend/   React 19 + TypeScript + Vite, shadcn/ui (Radix, Tailwind CSS v4), TanStack Query
backend/    FastAPI, SQLAlchemy 2 (async) on SQLite, Alembic, httpx, pywebpush
deploy/     systemd unit, nginx site and environment template
```

In production nginx serves the built frontend and proxies `/api` to a single uvicorn process.
That process also runs the notification poller, so run exactly one instance.

| Backend module          | Responsibility                                               |
| ----------------------- | ------------------------------------------------------------ |
| `ghr.github`            | Typed client for the GitHub REST API                         |
| `ghr.services.sync`     | Imports release notifications and announces new releases     |
| `ghr.services.releases` | Read-side queries: views, counts, search, history            |
| `ghr.services.inbox`    | Read state and unsubscribing                                 |
| `ghr.services.hide_rules` | Hide rules and their previews                              |
| `ghr.services.readme`   | README cache with conditional requests                       |
| `ghr.services.push`     | Web Push delivery                                            |
| `ghr.api`               | HTTP routes; everything except sign-in requires a session    |

### Behaviour worth knowing

- **Data source.** The app reads your [GitHub notifications](https://github.com/notifications)
  and keeps the ones about releases, so it shows exactly the releases you subscribed to.
  Polling uses `If-Modified-Since`, so a poll that finds nothing new returns `304` and doesn't
  count against your rate limit.
- **Read state.** The app is the source of truth. Releases that were already read on GitHub
  are imported as read. Marking as read also marks the GitHub thread as read. GitHub has no API
  to mark a thread unread, so *Mark as unread* only affects this app.
- **Unsubscribe.** GitHub's API can't switch a repository to "releases only", so unsubscribing
  stops watching the repository entirely. If you watch it with *Custom → Releases*, that's
  exactly the same thing. If you start watching it again on GitHub, its next release brings it
  back.
- **Hide rules.** Glob patterns (`*`, `?`, `[...]`) are matched case-insensitively against the
  release name and tag of one repository. New releases that match are hidden as well.
- **Push notifications** need HTTPS. On iOS, add the site to the home screen first (Safari →
  Share → Add to Home Screen), then turn notifications on in the app's settings.

## Local development

Prerequisites: Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node.js 22+.

1. Create `backend/.env`:

   ```dotenv
   GHR_GITHUB_TOKEN=<token, for example from `gh auth token`>
   GHR_USERNAME=admin
   GHR_PASSWORD_HASH='<output of: uv run ghr hash-password>'
   GHR_SESSION_SECRET=<output of: uv run ghr generate-secret>
   GHR_SECURE_COOKIES=false
   # Optional, for push notifications: paste the output of `uv run ghr generate-vapid-keys`
   ```

2. Start the backend, which listens on port 8000:

   ```bash
   cd backend && uv sync && uv run ghr migrate && uv run ghr serve --reload
   ```

3. Start the frontend at http://localhost:5173. It proxies `/api` to the backend:

   ```bash
   cd frontend && npm install && npm run dev
   ```

Checks:

```bash
cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd frontend && npm test && npm run typecheck && npm run lint
```

## Deployment on Ubuntu

The steps assume the domain `releases.example.com`, the code in `/opt/ghr`, and nginx and
certbot installed (`sudo apt install nginx certbot python3-certbot-nginx`).

1. **GitHub token.** Create a *classic* personal access token at
   <https://github.com/settings/tokens> with the `notifications` and `repo` scopes.
   Fine-grained tokens can't access notifications.

2. **User and code**

   ```bash
   sudo useradd --system --home /opt/ghr --shell /usr/sbin/nologin ghr
   sudo git clone <your repository> /opt/ghr
   curl -LsSf https://astral.sh/uv/install.sh | sudo env UV_INSTALL_DIR=/usr/local/bin sh
   cd /opt/ghr/backend && sudo uv sync --frozen --no-dev
   cd /opt/ghr/frontend && sudo npm ci && sudo npm run build
   ```

3. **Configuration**: copy the template and fill it in. The `ghr` commands print the
   values for you.

   ```bash
   sudo install -d -m 0750 -o root -g ghr /etc/ghr
   sudo install -m 0640 -o root -g ghr /opt/ghr/deploy/ghr.env.example /etc/ghr/ghr.env
   cd /opt/ghr/backend
   sudo .venv/bin/ghr hash-password        # GHR_PASSWORD_HASH (keep the single quotes)
   sudo .venv/bin/ghr generate-secret      # GHR_SESSION_SECRET
   sudo .venv/bin/ghr generate-vapid-keys  # GHR_VAPID_PUBLIC_KEY / GHR_VAPID_PRIVATE_KEY
   sudo nano /etc/ghr/ghr.env
   ```

   Keeping the token in this root-owned file, rather than in a shell profile, keeps it out of
   shell history and away from other users.

4. **Service**: database migrations run automatically before every start.

   ```bash
   sudo cp /opt/ghr/deploy/ghr.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now ghr
   journalctl -u ghr -f
   ```

5. **nginx and TLS**

   ```bash
   sudo cp /opt/ghr/deploy/nginx/snippets/*.conf /etc/nginx/snippets/
   sudo cp /opt/ghr/deploy/nginx/ghr.conf /etc/nginx/sites-available/ghr
   sudo sed -i 's/releases.example.com/<your domain>/g' /etc/nginx/sites-available/ghr
   sudo certbot certonly --nginx -d <your domain>
   sudo ln -s /etc/nginx/sites-available/ghr /etc/nginx/sites-enabled/ghr
   sudo nginx -t && sudo systemctl reload nginx
   ```

   nginx rate-limits sign-in attempts. Cookies are `Secure`, `HttpOnly` and `SameSite=Lax`.

**Updating**

```bash
cd /opt/ghr && sudo git pull
cd backend && sudo uv sync --frozen --no-dev
cd ../frontend && sudo npm ci && sudo npm run build
sudo systemctl restart ghr
```

**Backups**: the only state is `/var/lib/ghr/ghr.db`. Use
`sqlite3 /var/lib/ghr/ghr.db ".backup /path/to/backup.db"` while the service is running.

## Configuration reference

All settings are environment variables with the `GHR_` prefix.

| Variable                   | Default                  | Description                                      |
| -------------------------- | ------------------------ | ------------------------------------------------ |
| `GHR_GITHUB_TOKEN`         | required                 | Classic token with `notifications` and `repo`    |
| `GHR_USERNAME`             | required                 | Sign-in name                                     |
| `GHR_PASSWORD_HASH`        | required                 | Argon2 hash from `ghr hash-password`             |
| `GHR_SESSION_SECRET`       | required                 | At least 32 characters, from `ghr generate-secret` |
| `GHR_SESSION_MAX_AGE_DAYS` | `30`                     | How long a sign-in lasts                         |
| `GHR_SECURE_COOKIES`       | `true`                   | Set to `false` only for local HTTP development   |
| `GHR_DATABASE_PATH`        | `data/ghr.db`            | SQLite database file                             |
| `GHR_POLL_INTERVAL_SECONDS`| `60`                     | Minimum poll interval (GitHub may ask for more)  |
| `GHR_README_CACHE_SECONDS` | `3600`                   | How long READMEs are served from the cache       |
| `GHR_VAPID_PUBLIC_KEY`     | unset                    | Enables push notifications together with the private key |
| `GHR_VAPID_PRIVATE_KEY`    | unset                    | From `ghr generate-vapid-keys`                   |
| `GHR_VAPID_SUBJECT`        | `mailto:admin@localhost` | Contact address sent to push services            |
