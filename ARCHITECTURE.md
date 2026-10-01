# Architecture

## Feature boundaries and state

`src/features/options` owns the `GameOptions` contract, validation, local storage, and form state. `src/features/battle` owns typed balance, simulation entities and snapshots, PixiJS rendering, input, assets, and the HUD's React snapshot. `src/features/matches` owns the `MatchRecord` and `LocalMatches` contracts, local persistence, and the result screen. `src/features/menu` owns the main menu. Contracts live beside their feature instead of in a global types directory.

`App.tsx` coordinates screen navigation and the data crossing those boundaries: saved options, the options snapshot for the active match, the latest result, and local match state. The continuous combat state stays in `GameSimulation`; `BattleScreen` samples it for the HUD. Ranking and Match History can later consume the match contracts and own their query state, without coupling them to local storage. No remote APIs or extra state library are part of this refactor.

## React and PixiJS

React owns the menu, Options, HUD, dialogs, loading and error states, and result screen. `App.tsx` owns navigation and starts a match with a snapshot of Options. `BattleScreen.tsx` creates one PixiJS `Application`, a `GameSimulation`, an `InputController`, and a `BattleRenderer` for each match. PixiJS owns the ocean, islands, ships, cannonballs, effects, and health bars above ships. Simulation state stays outside React; the HUD receives snapshots at most every 100 ms, plus immediate snapshots on pause and result transitions.

Assets are loaded before the canvas and input controller start. A visible progress indicator counts the required textures, and a failed load exposes **Try Again**. The Pixi application, ticker, canvas, sprites, keyboard and visibility listeners, and test bridge are removed on exit or restart. The asynchronous initializer checks for unmounts so React Strict Mode can mount and clean up safely.

## Simulation and collision

`gameBalance.ts` is the typed balance source. It creates a 960 × 540 logical arena with two small, staggered islands composed of overlapping circular lobes; the browser scales its canvas to the available space without changing game coordinates. The western island shields the player's starting lane from direct fire on the east side, while the southeast island provides another cover position. Their closest horizontal edges leave a 137-unit channel through the center. The default player has five health, moves at 150 logical units per second, and turns at π radians per second. A front shot has a 0.42-second cooldown; each broadside fires three parallel shots and has its own 1.2-second cooldown. Projectiles travel at 330 units per second, deal one damage, and expire after 1.6 seconds. Chasers have two health and move at 86 units per second; Shooters have one health, move at 68 units per second, and attack within 310 units.

The ticker feeds a fixed 1/60-second simulation step, with accumulated frame time capped after stalls. Movement, cooldowns, spawns, and the match timer use simulated time. The player is clamped to arena bounds; ships are pushed outside the lobes that form each island. Rendering uses those same lobes, so visible land and collision geometry agree. Enemies navigate around each island as a whole to avoid getting trapped between lobes. They retain their chosen side while passing an island, prefer routes that remain inside the arena, and steer inward or briefly escape if they stop moving at an edge. Shooters advance around cover when the island blocks their line of fire, even inside their preferred range; shots still use the exact lobes for cover checks. A segment–circle test catches projectile hits between frames. Each projectile is removed after its first hit, island contact, expiry, or arena exit. Hits use the supplied small explosion sprite and a short render-only ship shake; collision positions remain unchanged. Destroyed enemies are removed before they can act again. Spawn candidates are on the perimeter and must be clear of both islands and at least 250 units from the player; Chaser and Shooter spawns alternate.

Input is represented as a set of held actions shared by keyboard and pointer controls, allowing movement and attacks together. Pausing clears held input and the ticker accumulator. Focus loss, tab hiding, and portrait orientation pause automatically; resuming always needs a player action. Combat termination stops all subsequent simulation steps. A manual exit discards the unfinished match.

## Persistence and testability

`gameOptionsStorage.ts` stores validated Options. `matchStorage.ts` stores a versioned envelope containing the player ID, last completed match, and a queue of pending matches. A completed match gets its ID once, and queue insertion checks that ID before appending, so repeated saves do not duplicate it. One storage write persists both the last result and queue. When a write fails, the result remains in memory and the player can retry. Remote delivery, query cache, and MSW handlers belong to the next milestone.

In development, `?e2e=1` stops the automatic ticker and exposes a deterministic seeded test bridge. Playwright advances the same simulation rules in fixed ticks, uses the real keyboard and pointer handlers, and checks state through snapshots. It can also move elapsed time near the end threshold to verify the timer and result flow without running a full two-minute match. Visual baselines cover the menu, an initial arena frame, a projectile impact, and the result on desktop and mobile Chromium.

## Current limits

Ranking and Match History remain disabled. Axios, TanStack Query, and MSW are installed but have no active integration yet. The pending queue stays local until those APIs are implemented. Audio, performance profiling, and public deployment are not part of this milestone.
