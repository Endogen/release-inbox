# Releases: a GitHub release inbox

A self-hosted inbox for the GitHub releases you watch. It shows the newest release of every
repository, with release notes, the README, AI summaries and one-click triage, and notifies you
when something new ships.

## Features

- **One entry per repository.** Only the newest release is listed (`+N older` shows the rest;
  switch versions in the detail view). **What's new** combines the notes of every unread
  release of a repository, so nothing between your last visit and the newest release is missed.
- **Inbox, Snoozed, Read and Hidden views.** Every release is in exactly one of them. Actions
  on an entry cover what it stands for: marking it as read moves the release and its `+N older`
  releases in that view to *Read*. Read state is mirrored to github.com.
- **Snooze.** Put a release aside until later today, tomorrow, the weekend or next week. It
  comes back to the inbox with a reminder notification.
- **Breaking changes stand out.** Releases whose notes mention breaking changes, or that are a
  new major version of a component, get a *Breaking* badge.
- **Hide components.** Hide releases of a single component of a repository, such as `web@*` in
  a monorepo, without unsubscribing. Hidden releases stay available in the *Hidden* view.
- **Pre-releases on your terms.** Treat them like other releases, keep them in the inbox
  without notifications, or keep them in the *Hidden* view.
- **Unsubscribe in one click.** Stops watching the repository on GitHub.
- **Swipe to triage.** In the inbox and snoozed views, swipe an entry left to mark it as read
  or right to unsubscribe. Both actions, whether you swipe, click or use a shortcut, show a toast with
  **Undo** for six seconds. The change is only sent to GitHub after that, so undoing leaves
  GitHub untouched. When you leave the page or switch apps, pending actions are sent right away.
- **AI summaries.** Summarize a release, or everything that's new in a repository, with Claude.
  Summaries are cached and created only when you ask.
- **Release notes and README** rendered as GitHub-flavoured markdown, with working anchors,
  footnotes, light/dark logos, and relative images in READMEs of private repositories.
- **Search** across repositories, release names, tags and notes.
- **Notifications where you want them.** Browser push, [ntfy](https://ntfy.sh) and Telegram.
  Every repository you watch notifies you, including ones you start watching later; mute a
  repository with the bell on one of its releases (or `m`).
- **Live updates.** GitHub is polled every minute (at the interval GitHub asks for), and
  *Sync now* polls right away. Open tabs update instantly via server-sent events. Recent
  releases are re-checked every 30 minutes, so edited notes show up, and a pre-release that is
  promoted to a stable release notifies you again.
- **Keyboard driven.** `j`/`k` navigate, `e` marks as read, `s` snoozes, `h` hides, `o` opens on
  GitHub, `/` searches, and `?` lists all shortcuts.
- Light and dark theme, responsive layout, installable as an app.

## Architecture

```
frontend/   React 19 + TypeScript + Vite, shadcn/ui (Radix, Tailwind CSS v4), TanStack Query
backend/    FastAPI, SQLAlchemy 2 (async) on SQLite, Alembic, httpx, pywebpush, Anthropic SDK
deploy/     systemd units (service and daily backup), nginx site and environment template
```

In production nginx serves the built frontend and proxies `/api` to a single uvicorn process.
That process also runs the poller, so run exactly one instance.

| Backend module                 | Responsibility                                                |
| ------------------------------ | ------------------------------------------------------------- |
| `ghr.domain`                   | The views and pre-release modes shared by all layers          |
| `ghr.github`                   | Typed client for the GitHub REST API                          |
| `ghr.services.sync`            | Imports release notifications and refreshes recent releases   |
| `ghr.services.filters`         | SQL conditions for the views, hiding and search               |
| `ghr.services.releases`        | Read-side queries: views, counts, search, history, what's new |
| `ghr.services.inbox`           | Read state, snoozing and unsubscribing                        |
| `ghr.services.breaking`        | Breaking-change detection                                     |
| `ghr.services.hide_rules`      | Hide rules and their previews                                 |
| `ghr.services.notifications`   | Web Push, ntfy and Telegram, and what gets announced          |
| `ghr.services.snooze`          | Ends snoozes and sends reminders                              |
| `ghr.services.preferences`     | User preferences (pre-release mode)                           |
| `ghr.services.summaries`       | Claude summaries and their cache                              |
| `ghr.services.readme`          | README cache with conditional requests                        |
| `ghr.scheduler`                | Background loops: sync, refresh, snoozes, rate-limit backoff  |
| `ghr.api`                      | HTTP routes; everything except sign-in requires a session     |

| Frontend directory             | Responsibility                                                 |
| ------------------------------ | -------------------------------------------------------------- |
| `src/app`                      | Providers, routing, header and app-wide error handling         |
| `src/features/<feature>`       | One area each: its API hooks (`api.ts`), components and logic  |
| `src/features/releases`        | The inbox: list, detail, actions with undo, keyboard shortcuts |
| `src/components`               | Shared components; `ui/` holds the shadcn/ui components        |
| `src/hooks`, `src/lib`         | Generic hooks, the API client, time and markdown URL helpers   |

### Behaviour worth knowing

- **Data source.** The app reads your [GitHub notifications](https://github.com/notifications)
  and keeps the ones about releases, so it shows exactly the releases you subscribed to.
  Polling uses `If-Modified-Since`, so a poll that finds nothing new returns `304` and doesn't
  count against your rate limit. When GitHub asks to slow down, the app waits as long as asked.
- **Robust sync.** A single release that is deleted or no longer accessible (for example
  because of SSO enforcement) is skipped instead of blocking the sync. A release is only removed
  when GitHub reports it gone while its repository is still reachable. Renamed repositories are
  followed. Progress of a long first import is kept if it is interrupted.
- **Read state.** The app is the source of truth. Releases that were already read on GitHub
  are imported as read. Marking as read also marks the GitHub thread as read. GitHub has no API
  to mark a thread unread, so *Mark as unread* only affects this app.
- **Unsubscribe.** GitHub's API can't switch a repository to "releases only", so unsubscribing
  stops watching the repository entirely. If you watch it with *Custom → Releases*, that's
  exactly the same thing. If you start watching it again on GitHub, its next release brings it
  back.
- **Hide rules.** Glob patterns (`*`, `?`, `[...]`) are matched case-insensitively against the
  release name and tag of one repository. New releases that match are hidden as well.
- **Browser push** needs HTTPS. On iOS, add the site to the home screen first (Safari → Share →
  Add to Home Screen), then turn it on in the app's settings. ntfy and Telegram work anywhere.
- **Summaries** send the release notes to the Anthropic API and are billed to your API key.

## Local development

Prerequisites: Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node.js 22+.

1. Create `backend/.env`:

   ```dotenv
   GHR_GITHUB_TOKEN=<token, for example from `gh auth token`>
   GHR_USERNAME=admin
   GHR_PASSWORD_HASH='<output of: uv run ghr hash-password>'
   GHR_SESSION_SECRET=<output of: uv run ghr generate-secret>
   GHR_SECURE_COOKIES=false
   GHR_ENABLE_API_DOCS=true
   # Optional: see deploy/ghr.env.example for push, ntfy, Telegram and summaries.
   ```

2. Start the backend, which listens on port 8000 (API docs at http://localhost:8000/api/docs):

   ```bash
   cd backend && uv sync && uv run ghr migrate && uv run ghr serve --reload
   ```

3. Start the frontend at http://localhost:5173. It proxies `/api` to the backend:

   ```bash
   cd frontend && npm install && npm run dev
   ```

Checks (also run by GitHub Actions on every push):

```bash
cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd frontend && npm test && npm run typecheck && npm run lint && npm run format:check && npm run build
```

## Deployment on Ubuntu

The steps assume Ubuntu 24.04, the domain `releases.example.com` and the code in `/opt/ghr`.
uv uses the system's Python 3.12. Ubuntu's Node.js is too old to build the frontend, so install
Node.js 22 from NodeSource:

```bash
sudo apt install nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install nodejs
```

1. **GitHub token.** Create a *classic* personal access token at
   <https://github.com/settings/tokens> with the `notifications` and `repo` scopes.
   Fine-grained tokens can't access notifications.

2. **User and code**

   ```bash
   sudo useradd --system --home /opt/ghr --shell /usr/sbin/nologin ghr
   sudo git clone https://github.com/Endogen/release-inbox /opt/ghr
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

   Keeping the tokens in this root-owned file, rather than in a shell profile, keeps them out of
   shell history and away from other users. ntfy, Telegram and summaries are optional; leave
   their variables empty to turn them off.

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

   Sign-in attempts are rate-limited by nginx and by the app. Cookies are `Secure`, `HttpOnly`
   and `SameSite=Lax`, cross-site requests that change data are rejected, and changing the
   password signs out every session.

6. **Daily backups**: keeps the last 14 copies in `/var/backups/ghr`.

   ```bash
   sudo install -d -m 0750 -o ghr -g ghr /var/backups/ghr
   sudo cp /opt/ghr/deploy/ghr-backup.service /opt/ghr/deploy/ghr-backup.timer /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now ghr-backup.timer
   ```

   To restore, stop the service, replace the database (removing the write-ahead log of the
   old one) and start it again:

   ```bash
   sudo systemctl stop ghr
   sudo rm -f /var/lib/ghr/ghr.db-wal /var/lib/ghr/ghr.db-shm
   sudo install -m 0640 -o ghr -g ghr /var/backups/ghr/<backup>.db /var/lib/ghr/ghr.db
   sudo systemctl start ghr
   ```

**Updating**

```bash
cd /opt/ghr && sudo git pull
cd backend && sudo uv sync --frozen --no-dev
cd ../frontend && sudo npm ci && sudo npm run build
sudo systemctl restart ghr
```

## Configuration reference

All settings are environment variables with the `GHR_` prefix.

| Variable                            | Default                  | Description                                          |
| ----------------------------------- | ------------------------ | ---------------------------------------------------- |
| `GHR_GITHUB_TOKEN`                  | required                 | Classic token with `notifications` and `repo`        |
| `GHR_USERNAME`                      | required                 | Sign-in name                                         |
| `GHR_PASSWORD_HASH`                 | required                 | Argon2 hash from `ghr hash-password`                 |
| `GHR_SESSION_SECRET`                | required                 | At least 32 characters, from `ghr generate-secret`   |
| `GHR_SESSION_MAX_AGE_DAYS`          | `30`                     | Sign-ins end after this many days without a visit    |
| `GHR_SECURE_COOKIES`                | `true`                   | Set to `false` only for local HTTP development       |
| `GHR_LOGIN_MAX_FAILURES`            | `10`                     | Failed sign-ins per address before it is blocked     |
| `GHR_LOGIN_WINDOW_SECONDS`          | `900`                    | Time window for the sign-in limit                    |
| `GHR_DATABASE_PATH`                 | `data/ghr.db`            | SQLite database file                                 |
| `GHR_PUBLIC_URL`                    | unset                    | Address of the app, for links in ntfy and Telegram   |
| `GHR_ENABLE_API_DOCS`               | `false`                  | Serve the interactive API docs at `/api/docs`        |
| `GHR_POLL_INTERVAL_SECONDS`         | `60`                     | Minimum poll interval (GitHub may ask for more)      |
| `GHR_RELEASE_REFRESH_INTERVAL_SECONDS` | `1800`                | How often recent releases are re-checked             |
| `GHR_RELEASE_REFRESH_DAYS`          | `14`                     | Releases published within this many days are checked |
| `GHR_README_CACHE_SECONDS`          | `3600`                   | How long READMEs are served from the cache           |
| `GHR_VAPID_PUBLIC_KEY`              | unset                    | Browser push, together with the private key          |
| `GHR_VAPID_PRIVATE_KEY`             | unset                    | From `ghr generate-vapid-keys`                       |
| `GHR_VAPID_SUBJECT`                 | `mailto:admin@localhost` | Contact address sent to push services                |
| `GHR_NTFY_URL`                      | unset                    | ntfy topic URL, e.g. `https://ntfy.sh/your-topic`    |
| `GHR_NTFY_TOKEN`                    | unset                    | Access token for protected ntfy topics               |
| `GHR_TELEGRAM_BOT_TOKEN`            | unset                    | Bot token from @BotFather                            |
| `GHR_TELEGRAM_CHAT_ID`              | unset                    | Chat that receives the messages                      |
| `GHR_ANTHROPIC_API_KEY`             | unset                    | Enables AI summaries                                 |
| `GHR_ANTHROPIC_MODEL`               | `claude-opus-5-5`        | Model used for summaries                             |
