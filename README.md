# Empire Game

A small browser-based incremental strategy game. Gather gold, construct farms, mines,
and houses, and watch your empire's population grow turn by turn.

Built with [Vite](https://vite.dev/), [React](https://react.dev/), and TypeScript.

## Requirements

- Node.js 20+ (developed against Node 22)
- npm 10+

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
```

## Scripts

| Command            | Description                                  |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Start the Vite dev server with hot reload    |
| `npm run build`    | Type-check and build the production bundle   |
| `npm run preview`  | Preview the production build locally         |
| `npm run lint`     | Run ESLint over the project                  |
| `npm test`         | Run the Vitest unit test suite once          |
| `npm run test:watch` | Run Vitest in watch mode                   |

## Project structure

```
src/
  game/
    engine.ts        # pure game logic (resources, buildings, ticks)
    engine.test.ts   # unit tests for the engine
  App.tsx            # game UI
  main.tsx           # React entry point
```

## How to play

- Click **Gather Gold** to earn gold manually.
- Spend gold to **Build** farms (food), mines (gold), and houses (population cap).
- Each turn (once per second) farms and mines produce resources, and surplus food
  grows your population toward its cap. Progress is saved to `localStorage`.
