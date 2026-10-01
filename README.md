# Pirate Battle

A browser-based 2D naval shooter built with React, TypeScript, and PixiJS.

## Status

The project includes the React application, strict TypeScript configuration, code quality tooling, a playable menu shell, and persisted game options. Combat, ranking, match history, network mocks, and PixiJS rendering will be added in the following milestones.

## Requirements

- Node.js 20.19 or later
- npm 10 or later

## Setup

```bash
npm ci
npm run dev
```

In PowerShell environments that block `npm.ps1`, use `npm.cmd` in place of `npm`.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Type-check and create a production build. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run the TypeScript compiler without emitting files. |
| `npm run test:e2e` | Run Playwright tests in Chromium desktop and mobile projects. |
| `npm run test:e2e:ui` | Open the Playwright test runner UI. |

## Estimated effort

The foundation is estimated at 2–4 hours. The complete challenge, including gameplay, integrations, tests, documentation, and deployment, is estimated at 60–90 hours.

## Current menu

The menu provides the available navigation for this milestone:

- **Options** opens the game settings screen.
- **Play**, **Ranking**, and **Match History** are visible but unavailable until their features are implemented.
- The menu displays the planned keyboard controls: `W`/up arrow to move forward, `A`/`D` or left/right arrow to turn, `Space` for the front cannon, `Q`/`E` for broadsides, and `Esc` to pause. 

## Game options

Options are stored locally under `pirate-battle.options.v1` and are restored after a refresh. Invalid or unreadable stored data falls back to the defaults.

| Option | Default | Allowed values | Increment |
| --- | ---: | ---: | ---: |
| Game session time | 120 seconds | 30, 60, 120, or 180 seconds | Preset selection |
| Enemy spawn time | 3 seconds | 2–10 seconds | 1-second selection |

The controls only navigate these available values; direct number entry is not supported. **Save** validates the selection and returns to the menu with a confirmation. The home icon in the upper-left corner returns to the menu; when options have changed, it asks for confirmation before discarding them. If browser storage is unavailable, the screen keeps the edited values and shows a retryable error.

## Styling

All shared colors, typography, spacing, shadows, dimensions, and asset references live in `src/styles/variables.css`. The application stylesheet consumes those tokens with CSS custom properties.

## Controls and configuration

Gameplay controls, network scenarios, and their reset instructions will be expanded as those features are implemented.

## Challenge brief

The original challenge specification is preserved in [CHALLENGE.md](CHALLENGE.md).
