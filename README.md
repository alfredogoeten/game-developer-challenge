# Pirate Battle

A browser-based, single-player naval shooter built with React, TypeScript, and PixiJS. Ranking and Match History use a browser-hosted MSW API, Axios, and TanStack Query. Profiling and deployment remain future milestones.

## Requirements and setup

- Node.js 20.19 or later and npm 10 or later
- A browser with WebGL support and local storage enabled

```bash
npm ci
npm run dev
```

On PowerShell installations that block `npm.ps1`, use `npm.cmd` instead of `npm`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and build the production bundle. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Check TypeScript without emitting source files. |
| `npm run test:e2e` | Run desktop and mobile Chromium Playwright tests. |
| `npm run test:e2e:ui` | Open the interactive Playwright runner. |

The E2E suite writes an HTML report to `reports/playwright/` and retains traces for failed tests. Screenshot baselines for Windows Chromium are stored under `e2e/visual.spec.ts-snapshots/`. The MSW worker is stored in `public/mockServiceWorker.js` and is included in production builds. No environment variables or private services are required.

## Play

| Action | Keyboard | Touch in landscape |
| --- | --- | --- |
| Move forward | `W` or `↑` | Up button |
| Turn left / right | `A` / `D` or `←` / `→` | Left / right buttons |
| Fire front cannon | `Space` | Center fire button |
| Fire three parallel shots to the left / right | `Q` / `E` | Left / right fire buttons |
| Pause or resume | `Esc` | Pause / Resume button |

Controls can be held together. On phones, rotate to landscape before combat; rotating to portrait pauses the match until the player rotates back and selects **Resume**. Losing browser focus or hiding the tab also pauses the match. Time, cooldowns, movement, and spawns do not advance while paused. **Main Menu** or a page reload abandons the current match without recording it.

Chasers pursue and explode against the player; they take two cannonball hits to destroy. Shooters take one hit, move toward the player, and fire within range when an island does not block the shot. They navigate around cover to regain a firing line. Two small, irregular islands create cover lanes with a wide central passage and stop ships and cannonballs. A projectile hit produces a small explosion and a brief visual shake on the damaged ship. Each enemy destroyed by a player projectile gives one point. A Chaser that explodes against the player gives no points. The match ends when the timer expires or player health reaches zero.

## Options and local results

Options are stored under `pirate-battle.options.v1`. Invalid or unreadable data falls back to defaults. A match uses the options selected when **Play** was pressed.

| Option | Default | Allowed values |
| --- | ---: | --- |
| Game session time | 60 or 180 seconds |
| Enemy spawn time | 3 seconds | Whole seconds from 2 through 10 |

**Save** validates and persists Options. Leaving with unsaved changes requires confirmation. If local storage rejects a save, the screen reports the error and allows retry.

Completed matches are stored under `pirate-battle.matches.v1` with a stable player ID, a unique match ID, date, score, active duration, end reason, and the configuration snapshot. The last result is available from **Last Result** after a refresh. A completed match enters a local **Pending** queue before an HTTP registration attempt. Confirmed records are stored separately under `pirate-battle.confirmed.v1` and then removed from the pending queue. An unsuccessful or timed-out send remains pending and can be retried after refresh. Starting another match does not clear pending records. A failed local result save can be retried on the result screen.

## Ranking, Match History, and network scenarios

The main menu opens **Ranking** and **Match History** as separate screens, each with a back button and Escape shortcut. Ranking shows matches made with the currently saved Options and the current balance snapshot. It displays five matches per page, ordered by score descending, then completion date and match ID ascending. Every completed match has one ranking entry. Match History shows the current player's completed matches across all configurations, newest first, also five per page. Other players come from deterministic fixtures. Reopening either screen refreshes it; a successful registration invalidates both queries.

The browser API has three routes: `GET /api/ranking?config=<encoded configuration>&page=<n>`, `GET /api/matches?playerId=<id>&page=<n>`, and `POST /api/matches` with a `MatchRecord` JSON body. `matchId` is the idempotency key. A repeated POST returns the existing record and cannot create a second ranking or history entry. Axios sends the requests; TanStack Query handles consultation, registration, retries for transient query failures, cache, and invalidation. The MSW worker starts before the app renders in development and preview/production builds. If it cannot start, the local game still works and the remote screens show an error.

The reproducible MSW scenarios are configured by the test suite through `pirate-battle.network.v1`; they cover empty results, multiple pages, slow or variable latency, out-of-order responses, timeout, connection failure, HTTP 400/500, isolated ranking or history failures, a timeout after a POST was committed, and unavailable registration.

For reproducible latency tests, URL parameters `networkSeed=<0..5000>` and `networkDelayMs=<0..5000>` control the deterministic variation and delay in milliseconds. The defaults are seed 41, slow delay 700 ms, out-of-order delay 850 ms, and timeout delay 1800 ms. Timeout delays have a 1300 ms minimum so they exceed the Axios 1200 ms timeout. The test clock remains controlled separately by `?e2e=1` in development.

The gameplay balance lives in `src/features/battle/gameBalance.ts`; movement, health, weapon, projectile, enemy, spawn, and arena values are centralized there. Only session duration and spawn interval appear in Options. Options, battle, matches, and menu each own their code under `src/features/`; `App.tsx` coordinates navigation between them.

## Testing notes

Development builds opened with `?e2e=1` expose `window.__pirateBattleTest` after assets load. Playwright uses its seeded simulation clock to observe snapshots, step fixed ticks, place an enemy, and set elapsed time near the end of a match. The bridge is absent from production builds. Each Playwright context starts with isolated browser storage.

The supplied visual assets are under `assets/`. The challenge brief is preserved in [CHALLENGE.md](CHALLENGE.md), and implementation decisions are in [ARCHITECTURE.md](ARCHITECTURE.md).
