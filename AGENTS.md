# AGENTS.md

## Project overview

Empire Game is a single-service browser game built with Vite + React + TypeScript.
There is no backend or database; game progress is persisted in the browser's
`localStorage`. Core game logic lives in `src/game/engine.ts` as pure functions and is
unit-tested in `src/game/engine.test.ts`. The UI lives in `src/App.tsx`.

## Commands

Standard scripts are defined in `package.json` (see also `README.md`):

- `npm run dev` — start the Vite dev server on http://localhost:5173
- `npm run build` — type-check (`tsc -b`) and produce a production bundle
- `npm run lint` — run ESLint (flat config in `eslint.config.js`)
- `npm test` — run the Vitest suite once

## Cursor Cloud specific instructions

- Dependencies are installed automatically by the startup update script (`npm install`);
  you do not need to reinstall them manually at the start of a session.
- This is a single frontend service. `npm run dev` serves on port `5173` and does not
  bind `--host` by default, which is fine for in-VM browser testing via `localhost`.
- Vitest is configured through `vite.config.ts` (the `test` block) using the `jsdom`
  environment and globals; there is no separate `vitest.config.ts`.
