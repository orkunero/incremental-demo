# Git Rich prototype

Playable demo of the v0.3 design (see `docs/GDD.md`).

- `core.js` — all game rules. No DOM, timers or `Math.random`; time and RNG are passed in.
- `index.html` — browser UI on top of `core.js`. Open it directly in a browser.
- `sim.js` — a scripted player plays `core.js` and prints pacing numbers.

```
node prototype/sim.js 5      # active player, 5 clicks/s
node prototype/sim.js 5 10   # clicks for 10 minutes, then idles
node prototype/sim.js 5 - 2  # active player, only 2 companies
```
- `test.js` — rule checks for `core.js` (offline catch-up, challenges, perks, IPO, saves).

```
node prototype/test.js       # exits with 1 if a check fails
```
