# Git Rich

An incremental game about growing a software company, played inside an IDE.
Write code, ship releases, fight tech debt, hire a team, sell the company, go public.

Design: [docs/GDD.md](docs/GDD.md).

## Run it

Needs Node 22.18 or newer.

```
npm install
npm run dev        # play at http://localhost:5173
npm run build      # static site in dist/
```

## Checks

```
npm run typecheck  # TypeScript, strict
npm test           # rule tests (Vitest)
npm run balance    # a scripted player plays the game; fails if pacing drifts
npm run sim -- 9   # pacing report for 9 companies
npm run check      # all of the above plus the build
```

CI runs `typecheck`, `test`, `balance` and `build` on every push.
Pushes to `main` deploy to GitHub Pages (enable it once under Settings → Pages → Source: GitHub Actions).

## Layout

```
src/core/      game rules, no DOM: types, content (data), engine (rules), save/offline
src/platform/  browser storage adapter
src/ui/        IDE-style interface (main.ts, styles.css)
tests/         rule tests
tools/         scripted player (bot.ts), pacing report (sim.ts), balance check (balance.ts)
```

The core never touches the DOM, timers or `Math.random`: time and randomness are passed in,
so the browser, the tests and the scripted player all run exactly the same rules.
