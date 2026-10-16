# Website design concept

The project website for Releases, hosted on GitHub Pages. It has three jobs, in this order:
make clear in seconds what the app is, show that it is polished, and get people to the right
download or the self-hosting guide. It also carries the code signing policy and privacy
policy that SignPath Foundation requires on the home and download pages.

## Idea: "Every release, one calm inbox"

GitHub release notifications are noise. Releases turns them into an inbox. The site tells
that story visually: a stream of release cards (versions, *Breaking* badges, pre-releases)
flows from the left and settles into a calm, ordered inbox on the right. The product itself
is the hero image: real screenshots in a window frame, not illustrations.

Mood: quiet, precise, developer-native. Think release notes typeset well: lots of air, mono
for anything versioned, one confident accent color.

## Visual language

- **Color.** Dark first (near-black `oklch(0.145 0 0)`), with a full light theme that follows
  the system and can be toggled. One accent: the app's indigo `oklch(0.511 0.262 277)`
  (`#4f39f6`), used for primary actions, the glow behind the product shot and small
  highlights. Semantic colors only where the app uses them: red for *Breaking*, amber for
  *Snoozed*.
- **Light.** A soft indigo "aurora" glow behind the hero and the download section, a faint
  dot grid that fades out toward the edges, and a 1px top highlight on cards. No heavy
  gradients on text except the hero headline's last line.
- **Type.** Geist Sans for everything, Geist Mono for versions, tags, keys and code. Hero
  headline 56–72 px, tight tracking; section titles 36–44 px; body 16–18 px with a
  65-character measure.
- **Shape.** The app's radius scale (`--radius` 0.625 rem); cards are `rounded-2xl` with a
  hairline border, never drop shadows on dark, soft shadows on light.
- **Motion.** Subtle and purposeful: sections fade and rise in once when they scroll into
  view; the release stream drifts slowly; hover lifts bento cards by 2 px and brightens their
  border. Everything stops with `prefers-reduced-motion`.

## Layout

One long page with anchored sections, plus two small legal pages. Max width 1200 px,
12-column grid, generous vertical rhythm (128 px between sections on desktop, 80 px on
phones).

1. **Header** (sticky, blurred): logo + "Releases", links (Features, Desktop app, Download,
   Self-host), GitHub button with star count, theme toggle. On phones: a sheet menu.
2. **Hero**: a pill linking to the newest release ("v0.6.0 · Desktop app is here"), the
   headline "Every release you watch. *One calm inbox.*", a one-sentence promise, two
   actions: "Download for {your OS}" (detected) and "Self-host it". Below: the inbox
   screenshot in a window frame, tilted slightly toward the viewer, with the indigo glow;
   the dark or light screenshot follows the theme.
3. **How it works**: three steps in a row: *Watch* on GitHub → *Collect* in one inbox per
   repository → *Triage* in seconds (read, snooze, hide, unsubscribe).
4. **Features bento**: a 6-column bento grid mixing large cards with screenshots and small
   cards with live UI fragments:
   - What's new (screenshot), Breaking changes stand out (badges), Hide components
     (screenshot), Snooze (menu fragment), Notifications everywhere (channel chips: browser,
     ntfy, Telegram, desktop), Keyboard driven (animated keys `j` `k` `e` `s`), AI summaries,
     Swipe to triage (phone screenshot), Live updates, Read state synced with GitHub.
5. **Desktop app**: left text, right a native-looking notification with *Mark as read*,
   *Snooze* and *Mute* buttons above a tray menu, both built in HTML so they are crisp in
   both themes. Bullets: tray, start at login, notification buttons, no bundled browser.
6. **Download**: three platform cards (Windows, macOS, Linux) with the files of the newest
   release linked directly (name, size), the detected platform highlighted, version and
   date above, "All releases" and the signing note below. Links are generated at build time
   from the GitHub API, so every release rebuild shows the newest files.
7. **Self-host**: two tabs, "Server (Ubuntu)" and "Try it locally", with short copyable
   steps and a link to the full guide in the README.
8. **FAQ**: an accordion with the questions people ask before installing.
9. **Footer**: open source note, links (GitHub, Releases, Code signing policy, Privacy), the
   license once the project has one.

Legal pages share the header and footer: **Code signing policy** (SignPath wording, team
roles, approval process) and **Privacy policy** (the site collects nothing; the app talks
only to your own server and the services you configure).

## Technical decisions

- Next.js 16 (App Router) with `output: "export"`, served from GitHub Pages under
  `/release-inbox/` (`basePath`), trailing slashes for Pages' static hosting.
- shadcn/ui (Tailwind CSS 4) for buttons, badges, cards, tabs, accordion, sheet, tooltip.
- `next-themes` for the theme, `geist` for self-hosted fonts (no Google requests).
- Screenshots converted to WebP and imported statically, so `next/image` knows their sizes
  and the base path.
- Release data is read once at build time; without network it falls back to linking the
  releases page. A workflow rebuilds and deploys on pushes to `website/`, on every published
  release and on demand.
