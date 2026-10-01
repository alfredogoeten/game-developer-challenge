# Pirate Battle

A browser-based, single-player naval shooter built with React, TypeScript, and PixiJS. The current milestone includes a complete local match from **Play** through the result screen. Ranking, match history, HTTP mocks, profiling, and deployment remain future milestones.

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

The E2E suite writes an HTML report to `playwright-report/` and captures traces on the first retry. Screenshot baselines for Windows Chromium are versioned under `e2e/visual.spec.ts-snapshots/`.

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
| Game session time | 120 seconds | 60 or 180 seconds |
| Enemy spawn time | 3 seconds | Whole seconds from 2 through 10 |

**Save** validates and persists Options. Leaving with unsaved changes requires confirmation. If local storage rejects a save, the screen reports the error and allows retry.

Completed matches are stored under `pirate-battle.matches.v1` with a stable player ID, a unique match ID, date, score, active duration, end reason, and the configuration snapshot. The last result is available from **Last Result** after a refresh. Completed records remain in a local **Pending** queue for the later ranking and history integration. A failed local result save can be retried on the result screen. Starting another match does not clear pending records.

The gameplay balance lives in `src/features/battle/gameBalance.ts`; movement, health, weapon, projectile, enemy, spawn, and arena values are centralized there. Only session duration and spawn interval appear in Options. Options, battle, matches, and menu each own their code under `src/features/`; `App.tsx` coordinates navigation between them.

## Testing notes

Development builds opened with `?e2e=1` expose `window.__pirateBattleTest` after assets load. Playwright uses its seeded simulation clock to observe snapshots, step fixed ticks, place an enemy, and set elapsed time near the end of a match. The bridge is absent from production builds. Each Playwright context starts with isolated browser storage.

The supplied visual assets are under `assets/`. The challenge brief is preserved in [CHALLENGE.md](CHALLENGE.md), and implementation decisions are in [ARCHITECTURE.md](ARCHITECTURE.md).
