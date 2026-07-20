# Ledger — Daily Spend Tracker

A local-first, installable web app for tracking daily purchases (milk, RO water,
groceries, or anything you buy regularly), their cost, and your spend over time.
Works fully offline; syncs to the cloud automatically when you're online, so
multiple people (e.g. you and your friends) can each use it with their own account.

## What's inside

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS** — beige / off-white /
  ash-black palette, light & dark mode, responsive (sidebar on desktop, bottom
  tabs on mobile).
- **Offline-first storage**: every action writes instantly to IndexedDB (via
  Dexie) on your device. The app never waits on the network.
- **Cloud sync**: a background sync engine pushes your changes to a **Neon
  Postgres** database and pulls changes from other devices, whenever you have
  a connection. If you're offline, everything still works — sync just resumes
  automatically when you reconnect.
- **Multi-user accounts**: email + password login (NextAuth / Auth.js), so
  each person's data is private to them.
- **PWA**: installable to your home screen, with a service worker that caches
  the app shell so it loads even with zero connectivity.

## Features

- Fully generic categories — Milk and RO Water come pre-added as starter
  examples, but they're ordinary categories like any other: rename, restyle,
  archive, or delete them freely. Add LPG, rent, subscriptions, fuel,
  medicine, electricity, groceries, or anything else you pay for regularly,
  each with its own unit (free text — "L", "cylinder", "month", "kWh",
  whatever fits) and its own +/− step size (e.g. 0.5 for half-liters, 10 for
  a block of units). Nothing in the code special-cases any particular item.
- Mark a day "taken" with a quantity, or "skipped" — one tap
- Editable price per unit, with full price history (past entries always cost
  what the price was *on that day*, even if you've since changed it)
- Calendar view — see which days you took/skipped each item at a glance
- Stats: Day / Week / Month / Year toggle, combined spend + per-item
  breakdown, trend chart, month-end forecast, budgets with progress bars,
  per-item streaks
- JSON export/import for manual backups
- Light & dark mode

## 1. Set up your Neon database

1. Go to neon.tech and create a free account + a new project.
2. In the Neon dashboard, open **Connection Details** and copy the
   **pooled connection string** (starts with `postgresql://...`).
3. In this project, copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
4. Paste your connection string into `DATABASE_URL` in `.env.local`.
5. Generate a random auth secret and paste it into `AUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

## 2. Create the database tables

This project uses Drizzle ORM. Push the schema to Neon with:

```bash
npm install
npx drizzle-kit push
```

This reads `src/lib/db/schema.ts` and creates the `users`, `categories`,
`prices`, `entries`, and `budgets` tables in your Neon database.

## 3. Run it locally

```bash
npm run dev
```

Open http://localhost:3000, register an account, and start logging. Try
going offline (airplane mode / dev tools "Offline") — everything keeps
working; reconnect and watch the sync indicator in the top bar confirm
you're back in sync.

## 4. Deploy (recommended: Vercel)

1. Push this project to a GitHub repo.
2. Import it into Vercel.
3. Add the same three environment variables (`DATABASE_URL`, `AUTH_SECRET`,
   `NEXTAUTH_URL` — set this to your deployed URL, e.g.
   `https://your-app.vercel.app`) in the Vercel project settings.
4. Deploy. Every friend you invite can register their own account at your
   deployed URL — their data stays private to them, synced through the same
   Neon database.

Any host that runs Next.js works (Netlify, Railway, your own server) — just
set the same three env vars.

## How the offline + sync design works

- **IndexedDB (via Dexie) is the source of truth on-device.** Every read in
  the UI comes from here, so the app is instant and works with zero network.
- Every write sets a `dirty` flag on that row.
- A background sync engine (`src/lib/sync.ts`) runs on load, whenever the
  browser regains connectivity, and every 30 seconds while online. It:
  1. Pushes all `dirty` rows to `/api/sync`, which upserts them into Neon.
  2. Pulls anything changed in Neon since your last sync (e.g. from another
     device) and merges it into IndexedDB.
- Conflicts are resolved last-write-wins by timestamp — fine for a personal
  tracker used by one person at a time per item.
- If you only ever use one device and don't care about cloud backup or
  multi-device/multi-friend sync, the app works exactly the same without ever
  successfully reaching `/api/sync` — nothing blocks on it.

## Project structure

```
src/
  app/
    (auth)/login, register          - sign in / sign up pages
    (app)/                          - authenticated app shell
      page.tsx                      - Today (the ledger view)
      calendar/                     - monthly calendar
      categories/                   - manage tracked items + prices
      stats/                        - spend analytics
      settings/                     - budgets, backup/restore
    api/
      auth/[...nextauth]            - NextAuth handler
      register                      - account creation
      sync                          - push/pull sync endpoint
  lib/
    local-db.ts                     - Dexie (IndexedDB) schema
    data.ts                         - local CRUD + cost calculations
    sync.ts                         - client sync engine
    auth.ts                         - NextAuth config
    db/schema.ts                    - Drizzle (Neon) schema
    db/index.ts                     - Neon connection
  context/                          - Theme + App (session/sync) providers
  components/                       - Nav, theme toggle, sync indicator, etc.
public/
  manifest.json, sw.js, icons/      - PWA assets
```

## Notes

- Currency is formatted as INR (Rs.) by default — change this in
  `src/lib/format.ts` (`formatMoney`) if you'd prefer a different currency.
- To add more default items beyond Milk and RO Water, edit
  `DEFAULT_CATEGORIES` in `src/lib/local-db.ts`.
