# Prodify — Documentation Summary

This repository is public for viewing and learning purposes only.

You may not copy, reuse, modify, redistribute, or commercialize this code without explicit permission.

This README consolidates the current features, architecture notes, and links to the detailed guides stored in this `docs/` folder. Use this as the single entry point for contributors and reviewers.

## Project Overview

Prodify is a client-side web application (also packaged via Capacitor for Android) focused on study productivity. The app is implemented as a single-page web app under `www/` and uses IndexedDB for offline storage, a service worker for caching, and modular JavaScript for features.

Core user-facing features:
- Tasks and subtasks with progress tracking
- Focus Mode with blockers and session summaries
- AI Coach: study recommendations, behavior analysis, and motivational messaging
- Calendar & scheduling (Smart Scheduler)
- Notifications and local push handling
- Cross-device sync and background sync support
- Notes, Habits, and Gamification features

## Architecture (high level)

- Frontend: Vanilla HTML/CSS/JavaScript in `www/` (no framework)
- Storage: IndexedDB (adapter layer in `www/js/core/indexedDB-adapter.js`)
- Offline: Service worker in `www/service-worker.js` with caching strategies
- Native: Capacitor wrapper for Android integrations (build files under `android/`)
- Modular JS: features grouped under `www/js/` (core, ai-coach, calendar, tasks, focus, sync, etc.)

## Where To Find Detailed Docs

- AI Coach: [AI_COACH_SUMMARY.md](docs/AI_COACH_SUMMARY.md) and [AI_COACH_DOCUMENTATION.md](docs/AI_COACH_DOCUMENTATION.md)
- Focus Blocker and Focus Mode: [FOCUS_BLOCKER_GUIDE.md](docs/FOCUS_BLOCKER_GUIDE.md)
- Cross-device sync: [CROSS_DEVICE_SYNC_DOCUMENTATION.md](docs/CROSS_DEVICE_SYNC_DOCUMENTATION.md) and [CROSS_DEVICE_SYNC_QUICK_START.md](docs/CROSS_DEVICE_SYNC_QUICK_START.md)
- Background sync & startup: [BACKGROUND_SYNC_GUIDE.md](docs/BACKGROUND_SYNC_GUIDE.md) and [STARTUP_OPTIMIZATION_COMPLETE.md](docs/STARTUP_OPTIMIZATION_COMPLETE.md)
- IndexedDB integration & migration guides: [INDEXEDDB_INTEGRATION_GUIDE.md](docs/INDEXEDDB_INTEGRATION_GUIDE.md), [INDEXEDDB_QUICK_REFERENCE.md](docs/INDEXEDDB_QUICK_REFERENCE.md), [INDEXEDDB_ROADMAP.md](docs/INDEXEDDB_ROADMAP.md), [DATA_JS_MIGRATION_EXAMPLES.md](docs/DATA_JS_MIGRATION_EXAMPLES.md)
- Notifications: [NOTIFICATION_SYSTEM_GUIDE.md](docs/NOTIFICATION_SYSTEM_GUIDE.md) and [NOTIFICATION_SYSTEM_COMPLETE.md](docs/NOTIFICATION_SYSTEM_COMPLETE.md)
- Smart Scheduler: [SMART_SCHEDULER_README.md](docs/SMART_SCHEDULER_README.md)
- Integration checklist and completion notes: [INTEGRATION_COMPLETE.md](docs/INTEGRATION_COMPLETE.md), [PREMIUM_MOBILE_EXPERIENCE_COMPLETE.md](docs/PREMIUM_MOBILE_EXPERIENCE_COMPLETE.md)

## Quick Developer Setup

1. Install Node.js and optional tooling (if building web assets).
2. From the repo root run: `npm install` (if this project has a package.json). See root `package.json` for scripts.
3. Serve `www/` locally (any static server) or open `www/index.html` in the browser.
4. For Android builds, follow Capacitor docs and run the Gradle wrapper in `android/`.

## Current Known Notes / Caveats

- Service worker caching can cause stale CSS/JS to persist for users. A cache-bust is used on `index.html` and a one-time auto-clear helper script was added for development.
- The app supports both mobile and desktop layouts; some layout rules differ between the two and are controlled via `deviceManager`/`deviceOptimizationEngine` logic.
- Sensitive Android files (e.g. `android/app/google-services.json`) should not be committed — `.gitignore` has been updated accordingly.

## Suggested Cleanup (review before applying)

These files look like completion notes or duplicates and can be removed or archived if you want a smaller docs surface. Confirm which of the following you want deleted and I will remove them:

- `docs/INTEGRATION_COMPLETE.md` (integration checklist already covered in other docs)
- `docs/NOTIFICATION_SYSTEM_COMPLETE.md` (duplicate of `docs/NOTIFICATION_SYSTEM_GUIDE.md`)
- `docs/PREMIUM_MOBILE_EXPERIENCE_COMPLETE.md` (summary/notes related to mobile premium experience)
- `docs/STARTUP_OPTIMIZATION_COMPLETE.md` (final notes; may be archived)

If you prefer I can move these into an `docs/archive/` folder instead of deleting them.

---

If you want, I can now remove any files you mark as unwanted or move them to `docs/archive/`. Tell me which option you prefer. If you want me to auto-detect duplicates and remove them, I can propose a conservative set and apply the deletions.
