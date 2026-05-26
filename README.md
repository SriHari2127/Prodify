# Prodify

Prodify is a client-side study productivity web application (packaged optionally with Capacitor for Android). It combines task management, focus tools, scheduling, and an AI-driven coach to help students plan, focus, and track progress — even offline.

This README gives a concise overview, lists current features, explains how to run and build the project, and links to detailed docs in the `docs/` folder.

**Repository status:** public for viewing and learning only. Do not copy, reuse, redistribute, or commercialize the code without explicit permission.

**Table of contents**

- Project overview
- Key features
- Quick start (dev)
- Building for production / Android
- Architecture & folders
- Docs and where to look
- Contributing
- License & notes

**Project overview**

Prodify is implemented as a single-page web app under `www/` built with vanilla HTML/CSS/JavaScript. It is designed to work offline using IndexedDB and a service worker, and includes optional native wrappers (Capacitor) for mobile distribution.

**Key features (current)**

- Task management: tasks, subtasks, deadlines, and progress tracking.
- Focus Mode: distraction blockers, timed sessions, session summaries, and analytics.
- AI Coach: study recommendations, behavior analysis, motivation messages, and personalized suggestions (see `docs/ai-coach-documentation.md`).
- Smart Scheduler & Calendar: smart task scheduling and calendar integration for planning study sessions.
- Local Notifications: in-app and system/local notifications with rules and queues for reminders.
- Cross-device sync: background sync and cross-device data reconciliation (see `docs/cross-device-sync.md`).
- Notes & Habits: lightweight notes and habit tracking integrated with tasks.
- Gamification: XP, levels, badges, and progress incentives.
- Offline-first storage: IndexedDB adapter with migration helpers and sync adapters.
- Service worker caching for fast startup and offline operation.

Quick links to the code that implements major features:

- Core app shell: `www/index.html` and `www/js/core/ui.js`
- IndexedDB adapter: `www/js/core/indexedDB-adapter.js`
- Service worker: `www/service-worker.js`
- AI Coach: `www/js/ai-coach/` (engines and UI)
- Focus features: `www/js/focus/` (focusBlocker.js, focusLockMode.js)

Quick start (development)

1. Install Node.js (recommended) and optional tooling.
2. From the repo root, install dependencies if present:

```bash
npm install
```

3. Serve the `www/` folder with a static server for local testing. Example using `http-server`:

```bash
npx http-server www -c-1 -o
```

4. Open `http://localhost:8080` (or the port printed by your server) and test the app. For faster iteration, open DevTools and disable the service worker, or use a development service-worker configuration.

Firebase configuration

- The app now reads Firebase settings from a local override script: `www/js/core/firebase-config.local.js`.
- Copy `www/js/core/firebase-config.local.example.js` to `www/js/core/firebase-config.local.js` and fill in your own project values before running auth or sync features.
- The local override file is ignored by Git so the committed repo stays free of project-specific Firebase values.

Building for production / Android (Capacitor)

- Web production: build or minify your `www/` assets using your chosen bundler/tooling, then deploy the `www/` output to your hosting.
- Android via Capacitor:

```bash
# generate native project (if not present)
npx cap init
npx cap add android
npx cap copy android
npx cap open android
```

Follow Capacitor docs to build with Android Studio. Do not commit secrets such as `google-services.json`.

Architecture & folder map

- `www/` — single-page web app, UI and JS modules
- `www/js/core/` — core utilities, indexedDB adapter, startup manager
- `www/js/ai-coach/` — AI coach engine and UI renderer
- `www/js/focus/` — focus blocker & lock mode code
- `docs/` — detailed guides (sync, AI coach, indexedDB, notifications, etc.)

Where to find detailed docs

- AI Coach: [docs/ai-coach-summary.md](docs/ai-coach-summary.md) and [docs/ai-coach-documentation.md](docs/ai-coach-documentation.md)
- Focus Blocker: [docs/focus-blocker.md](docs/focus-blocker.md)
- Cross-device sync: [docs/cross-device-sync.md](docs/cross-device-sync.md)
- IndexedDB: [docs/indexeddb-guide.md](docs/indexeddb-guide.md)
- Notifications: [docs/notifications.md](docs/notifications.md)

Contributing

- Read the docs in `docs/` before changing sync, storage, or notification code.
- Open an issue describing the change or improvement you plan to make.
- Follow existing code style (vanilla ES modules), keep changes focused, and include tests or manual verification steps when possible.

Notes & Caveats

- Service worker caching can cause stale assets to persist; use cache-busting and versioning when publishing updates.
- Some device-specific behavior is implemented in Capacitor/native wrappers — test on device emulators when adjusting integrations.
- Sensitive configuration files must not be committed (check `.gitignore`).

License

See the `LICENSE` file in the repository root for terms and restrictions.

If you'd like I can:

- Move older completion docs to `docs/archive/`.
- Produce a short changelog based on `docs/` contents.
- Generate a trimmed README suitable for publishing to npm or a public project page.

Tell me which of these (if any) you want next.
