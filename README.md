# Pirate Battle

A browser-based single-player naval shooter built with React, TypeScript, and PixiJS. Ranking and Match History use a browser-hosted MSW API, Axios, and TanStack Query.

## Setup

Requirements: Node.js 20.19+, npm 10+, WebGL, and local storage. No environment variables or private services are required.

```bash
npm ci
npx playwright install chromium
npm run dev
```

On PowerShell installations that block `npm.ps1`, use `npm.cmd` in place of `npm`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and build the production bundle. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Check TypeScript without emitting source files. |
| `npm run test:e2e` | Run desktop and mobile Chromium Playwright tests. |
| `npm run test:e2e:ui` | Open the interactive Playwright runner. |
| `npm run profile` | Build and profile an interactive Chromium production preview. |
| `npm run profile -- --headless` | Produce a diagnostic headless profile only. |

From a clean checkout, run `npm ci`, `npx playwright install chromium`, `npm run build`, `npm run preview`, and `npm run test:e2e`. The MSW worker in `public/mockServiceWorker.js` is included in development and production. The E2E report is written to `reports/playwright/`; failed tests retain traces, and versioned visual baselines are under `e2e/visual.spec.ts-snapshots/`.

## Controls and gameplay

| Action | Keyboard | Touch in landscape |
| --- | --- | --- |
| Move forward | `W` or Up Arrow | Up button |
| Turn left / right | `A` / `D` or Left / Right Arrow | Left / right buttons |
| Fire front cannon | `Space` | Center fire button |
| Fire left / right broadside | `Q` / `E` | Left / right fire buttons |
| Pause or resume | `Esc` | Pause / Resume button |

Inputs can be held together. On phones, combat requires landscape orientation; portrait, lost focus, and a hidden tab pause the game. A match ends when time expires or player health reaches zero. Main Menu and page reload abandon an unfinished match.

Chasers pursue and explode on the player; Shooters move into range and fire when an island does not block their shot. Islands block ships and projectiles. A destroyed enemy grants one point only when the player dealt the damage.

## Options, results, and gameplay configuration

Each `+` or `−` click in Options saves the new value immediately under `pirate-battle.options.v1` and updates the next-match configuration. **MAIN MENU** and `Esc` return to the menu. If local storage rejects a write, the displayed value stays unchanged and an accessible error appears; clicking again retries. Invalid stored options fall back to defaults. Every new match snapshots the saved options.

| Option | Default | Allowed values |
| --- | ---: | --- |
| Game session time | 60 seconds | 60 or 180 seconds |
| Enemy spawn time | 3 seconds | Whole seconds from 2 through 10 |

The rest of the typed balance is centralized in `src/features/battle/gameBalance.ts`: arena, islands, ship health and movement, weapons, projectiles, enemy behavior, and spawn locations. The player starts with **100 HP**. A Shooter projectile deals **12**, a Chaser collision deals **25**, and a player projectile deals **1** to an enemy. At most **six living enemies** appear at once. The spawn countdown freezes at that limit and resumes with its remaining time when an enemy leaves. Completed matches retain a stable player ID, match ID, completion time, active duration, reason, option snapshot, and balance snapshot. They enter a local pending queue before registration; failed or timed-out submissions can be retried after refresh without blocking another match.

## Ranking, history, and network scenarios

The API routes are `GET /api/ranking?config=<encoded configuration>&page=<n>&pageSize=<2|5>`, `GET /api/matches?playerId=<id>&page=<n>&pageSize=<2|5>`, and `POST /api/matches`. Ranking and history show two records per page in compact mobile viewports and five on desktop; resizing resets to page one. Omitted `pageSize` defaults to five for older callers. `matchId` is the idempotency key: a repeated POST returns the previous record and cannot create duplicate ranking or history entries. TanStack Query handles query cache, retries, cancellation, and invalidation; Axios carries the requests; MSW provides the browser-hosted API.

Use the **Network scenario** selector in the main menu for empty and paginated lists, latency, out-of-order responses, timeouts, connection and HTTP failures, isolated record-screen failures, post-commit timeout, and unavailable registration. **Reset mock data** selects Success and clears only confirmed mock records. It preserves options, the last local result, and pending submissions.

For deterministic latency, `networkSeed=<0..5000>` and `networkDelayMs=<0..5000>` URL parameters control variation and delay. Defaults are seed 41, slow delay 700 ms, out-of-order delay 850 ms, and timeout delay 1800 ms. Timeout delay is at least 1300 ms, exceeding the Axios 1200 ms timeout.

### Reproducing network failures

Select a scenario in the main menu, open the affected record screen or finish a short match, then use **Success** and **Retry** or **Retry Sync** to recover.

| Scenario | Reproduction | Expected recovery |
| --- | --- | --- |
| `ranking-error` / `history-error` | Open the corresponding screen. | An accessible error appears; Retry reloads after Success. |
| `timeout`, `connection-error`, `http-500` | Open Ranking or Match History. | Transient queries retry, then retain the error until Retry after Success. |
| `post-commit-timeout` | Finish a match, wait for Pending, select Success, then Retry Sync. | The same `matchId` appears once in history and ranking. |
| `unavailable-on-post` | Finish a match. | The match remains locally pending and can be retried after Success. |
| `out-of-order` | Open a records screen, change pages, then change scenario or page again. | Cancellation and query keys keep the latest request authoritative. |

## Tests, profiling, and deploy preparation

Development builds opened with `?e2e=1` expose `window.__pirateBattleTest` only after assets load. Playwright advances the seeded fixed-step simulation, uses actual keyboard and pointer handlers, and observes snapshots. Each context uses isolated browser storage. Layout tests assert no document scrolling and reachable buttons at 320×568, 667×375, and 851×393.

Run `npm run profile` on the documented reference desktop. It opens Chromium visibly, runs an optimized preview for 180 active seconds, and writes [profiling report](reports/profiling.json). The profiling harness makes only the player invulnerable so a full-duration stress capture is possible; spawning, navigation, shots, effects, collision, and rendering remain active. The report contains FPS, mean and p95 frame interval, maximum entities, mean simulation and Pixi synchronization time, active duration, end reason, CPU, GPU when Chromium exposes it, browser, viewport, DPR, heap after forced garbage collection, and resource state after five start/leave cycles.

A valid reference profile ends by time after 180 active seconds. The target is at least 58 FPS and p95 frame interval no greater than 20 ms. A failed target is recorded as an observed limitation, never reported as a 60 FPS result. Headless captures are diagnostic only.

Vercel is configured through [vercel.json](vercel.json) to build with `npm run build` and serve `dist`. After linking an authorized account, deploy and validate refresh, canvas/assets, the MSW service worker, Ranking, Match History, and completed-match registration. A public URL is intentionally outside this local implementation step.

The supplied visual and audio assets are under `assets/`. No license or attribution metadata was supplied. The challenge brief is in [CHALLENGE.md](CHALLENGE.md), architectural decisions are in [ARCHITECTURE.md](ARCHITECTURE.md), and verification evidence is in [reports/README.md](reports/README.md).
