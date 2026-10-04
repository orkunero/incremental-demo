# Game Design Document — *Git Rich*

An incremental game about growing a software company. The central tension is
the one every developer knows: **ship fast, or keep the code clean?**

- **Platform:** Web first (Vite + TypeScript). Game rules live in a platform-independent
  core, so the game can later move to desktop, mobile or a terminal UI.
- **Language:** English only. **Visual style:** modern cards, light and dark theme.
- **Playable demo:** https://claude.ai/artifact/DTgxc51UKKGSnmM1pwu5TS
  (source: `prototype/`; numbers in this document match `prototype/core.js`).
- **Status:** Draft v0.3. Rewritten after [Playtest 01](playtest-01.md); the v0.2 design was
  a generic generator template with disconnected systems and no pacing walls.

---

## 1. Design pillars

1. **One central tension.** Speed vs. quality (tech debt). Every system pushes on it.
2. **Every few minutes, a real decision.** Never "always buy the cheapest".
3. **The game unfolds.** Start with only an editor; panels appear as you discover them.
4. **Walls on purpose.** Growth slows before the first Exit, so selling feels like relief.
5. **The theme is the mechanic.** Shipping, incidents, refactoring, Brooks's law, CI/CD.

## 2. Core loop

```
 write code (click, flow) ─┐
 team writes code ─────────┼─► UNSHIPPED CODE ──► Ship ──► MRR ($/s) + Reputation
                           │         │                       │
   every line adds DEBT ◄──┘         └─► Client work ──► one-time $ + Rep
          │                                                  │
          └─ lowers income, causes incidents                 ▼
             refactor slider pays it down          hire, move office, projects,
                                                   new markets ──► Exit (sell)
```

## 3. Resources and meters

| Name | What it is | Notes |
|---|---|---|
| Unshipped code (LoC) | Code written but not released | Spent on shipping, client work, LoC projects |
| Money ($) | From MRR and client work | Spent on hires, offices, markets, $ projects |
| MRR ($/s) | Permanent income from shipped code | Capped by market size, cut by debt |
| Reputation (Rep) | From releases, contracts, viral events | Unlocks roles, offices, markets. Never spent |
| Tech debt (%) | Average bugginess of all code written | Income × `1 − 1.5·debt`, incident chance `1.5·debt` |
| Experience (XP) | From selling the company | +25% code and income per XP |

## 4. Systems

### 4.1 Writing code and flow
- A click writes `(1 + 2% of team LoC/s) × flow` lines. That keeps clicking at about a
  quarter of total output for an active player all game, without being required.
- **Flow** builds with steady clicking (+7 per click) and drains 30/s after 0.5 s idle.
  Flow multiplier ×1 → ×2 (×3 with *Mechanical Keyboard*). *Hackathon Culture* lets flow
  speed up the whole team too.
- Your own code has 5% bugs.

### 4.2 Shipping (Release)
- **Ship** turns all unshipped code into MRR (`0.002 $/s per line`) and Rep (`0.6·√lines·quality`).
- 8 s deploy cooldown. The panel shows exactly what shipping now would add, and the incident risk.
- Decision: ship small and often (money sooner) vs. save code for client work or code-paid
  projects; refactor first when debt is high.
- *CI/CD Pipeline* unlocks auto-ship with a debt limit you set.

### 4.3 Tech debt
- Each role has a bug rate (Intern 50%, Junior 30%, Senior 10%, Lead 5%, AI Copilot 45%, Principal 3%).
- **Brooks's law:** bug rates × `1 + headcount/40`. Big teams need process.
- **Refactor slider** (0–90% of team time): that share of the team writes no features but
  removes debt (`0.5 per line`, ×2 with *Code Review*).
- Projects cut bugs at the source: *Unit Tests* −30%, *Static Typing* −25%,
  *Pair Programming* −50% for Interns/Juniors, *Microservices* halves Brooks's law and debt's income hit.

### 4.4 Client work (contracts)
- Up to 2 offers. Size scales with your current output (35–85 s of work); they expire after 3 min.
- Pay: `0.8 $/line` at once (×1.4 with a "debt ≤ 25%" clause, ×2 with "debt ≤ 12%").
- Early game: the fastest money. Late game: the answer when your market is saturated.

### 4.5 Team and office

| Role | Cost | LoC/s | Bugs | Unlock |
|---|---|---|---|---|
| Intern | $15 | 1 | 50% | start |
| Junior Dev | $120 | 6 | 30% | start |
| Senior Dev | $1.4K | 35 | 10% | 60 Rep |
| Tech Lead | $18K | 200 | 5% | 500 Rep |
| AI Copilot | $400K | 2.5K | 45% | *Machine Learning* project |
| Principal Engineer | $5M | 15K | 3% | 20K Rep |

Cost grows ×1.17 per hire. Seats are a hard cap:

| Office | Seats | Cost | Rep |
|---|---|---|---|
| Garage | 3 | — | — |
| Co-working desk | 10 | $400 | — |
| Small office | 30 | $2.5K | 80 |
| Office floor | 100 | $80K | 1.5K |
| Glass tower | 300 | $8M | 15K |

### 4.6 Markets (the soft wall)
MRR saturates: `cap × (1 − e^(−raw/cap))`. Expanding keeps your current income and raises the cap.

| Market | Cap ($/s) | Cost | Rep |
|---|---|---|---|
| Hometown | 8 | — | — |
| Nationwide | 150 | $900 | 30 |
| Continental | 4K | $40K | 600 |
| Global | 100K | $2M | 8K |
| Interplanetary | 3M | $150M | 150K |

### 4.7 Projects (rule changers)
15 one-time projects, each shown only when it becomes relevant (e.g. *Unit Tests* appears when
debt passes 8%, *Feature Flags* after your second incident). Paid in $ or in unshipped code,
so code-paid projects compete with shipping. Full list in `prototype/core.js`.

### 4.8 Events
- **Incident** — after a release (chance = `1.5·debt`, none in the first 3 releases) or at random
  when debt is high. Income ×0.5 until fixed: click *Hotfix* 12 times, or wait 60 s
  (20 s with *Monitoring*). −3% Rep.
- **Trending** — every 2.5–5 min after the third release. Claim within 12 s: income ×2 for 30 s, +10% Rep.

### 4.9 Progressive reveal

| Trigger | Appears |
|---|---|
| Start | Editor, unshipped code, git log |
| 10 lines written | Client work |
| First delivery or first release | Money; Team once you have $15 |
| 2 deliveries or 200 lines | Release ("build your own product") |
| Debt ≥ 6% | Tech debt panel |
| First relevant project | Projects |
| Market 40% full | Market |
| Valuation ≥ $300K | Sell the company |

### 4.10 Prestige: Exit
- Valuation = MRR × 500. Selling needs $1M.
- XP gained = `floor(√(valuation / 250K))`; each XP: +25% code, income and contract pay.
- Resets everything except XP, revealed panels and the git log.
- **IPO** (second layer) is not in the demo; see §6.

## 5. Measured pacing (`prototype/sim.js`, scripted player)

| | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Exit, active player (5 clicks/s) | 30 min, +2 XP | 30 min, +3 XP | 19 min, +4 XP |
| Exit, casual (clicks 10 min, then idle) | 38 min | 30 min | 30 min |

- Gap between purchases (p90): ~20–30 s for most of a run, then a 3–5 min wall right before Exit.
- Clicking: 80% of output in minute 1, settles at ~23% for an active player.
- Debt stays a live concern: 5–15% with active refactoring, about 20 incidents per run.

## 6. Later (not in the demo)

- **IPO** prestige layer with a Board Room shop (automation, offline time, research slots).
- **Talents:** rare named hires with unique effects that survive an Exit.
- **Achievements**, statistics tab, settings (number format, save export/import).
- Offline progress is in the demo (up to 2 h at full rate); the final game will tune it.

## 7. Technical plan

The demo already follows the target split: `prototype/core.js` holds all rules with no DOM,
timers or `Math.random` (time and RNG are passed in), and both the browser UI and the
pacing simulation run on it. The production version ports this to TypeScript:

```
src/core/      rules, content data, save/migrations  (pure, unit-tested with Vitest)
src/platform/  storage, clock, RNG adapters per platform
src/ui/web/    DOM rendering
tools/sim.ts   pacing simulation, run in CI to catch balance regressions
```

## 8. Roadmap

| Milestone | Content |
|---|---|
| **M0** | Vite + TS + Vitest setup; port `core.js` to typed modules with tests |
| **M1** | Port the demo UI; save/load with versioned migrations |
| **M2** | Balance pass on runs 2–3 with real playtesters; sim in CI |
| **M3** | Achievements, stats, settings |
| **M4** | Talents |
| **M5** | IPO + Board Room + automation |
| **M6** | Polish, mobile layout pass, GitHub Pages deploy → v1.0 |

## 9. Open questions

1. Does the debt ↔ ship decision feel real in the demo, or is refactoring a chore?
2. Is the first Exit at ~30 min too early or too late?
3. Should incidents be harsher (they are mild right now) or optional?
4. Client work vs. shipping: is it clear when to choose which?
