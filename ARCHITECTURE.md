# Architecture

## Application navigation

React owns the current application screen. The menu and Options screen are rendered from local state in `App.tsx`; this keeps the initial flow small while avoiding a routing dependency. Returning from Options restores focus to the Options button, and opening the screen focuses its heading. The Options home icon checks for unsaved changes and opens a focus-managed confirmation dialog before discarding them.

## Game options

`src/config/gameOptions.ts` defines the `GameOptions` type, defaults, allowed value lists, and validation rules. The Options screen keeps a temporary selection and only navigates through those lists. It validates and persists only after **Save**; returning with unsaved changes requires explicit confirmation.

`src/lib/gameOptionsStorage.ts` is the only module that reads or writes `localStorage`. It uses `pirate-battle.options.v1`, falls back to defaults for malformed or inaccessible values, and reports write failure without blocking the user from retrying or returning to the menu.

## Styles

`src/styles/variables.css` is the single source of truth for shared visual decisions: colors, fonts, spacing, dimensions, shadows, animation timing, and asset paths. `src/styles.css` contains layout and component rules and consumes those values through CSS custom properties. The supplied menu assets are used as CSS backgrounds and a sliced panel border.

## Next milestones

The PixiJS arena will own continuous simulation and rendering. React will continue to own menus, options, HUD updates at controlled intervals, dialogs, and data views. Ranking and match history will add typed HTTP contracts, Axios, TanStack Query, MSW handlers, and persistence for pending results.
