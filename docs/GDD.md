# Game Design Document — *Git Rich*

An incremental game about growing a software company. The central tension is
the one every developer knows: **ship fast, or keep the code clean?**

- **Platform:** Web first (Vite + TypeScript). Game rules live in a platform-independent
  core, so the game can later move to desktop, mobile or a terminal UI.
- **Language:** English only. **Look:** the whole game is an IDE window, light and dark theme.
- **Playable demo:** https://claude.ai/artifact/DTgxc51UKKGSnmM1pwu5TS
  (source: `prototype/`; all numbers live in `prototype/core.js`).
- **Status:** Draft v0.4. v0.3 felt thin (few purchases, weak upgrades, cluttered single
  screen); v0.4 adds depth and moves to an IDE layout. History: [Playtest 01](playtest-01.md).

---

## 1. Design pillars

1. **One central tension.** Speed vs. quality (tech debt). Every system pushes on it.
2. **Every few minutes, a real decision.** Never "always buy the cheapest".
3. **The game unfolds.** Files appear in the explorer as the company grows.
4. **Walls on purpose.** Growth slows before the first Exit, so selling feels like relief.
5. **The theme is the mechanic.** Shipping, incidents, refactoring, Brooks's law, CI/CD.
6. **Runs differ.** Strategy forks and founder perks make each company play differently.

## 2. Core loop

```
 write code (click, flow) ─┐
 team writes code ─────────┼─► UNSHIPPED CODE ─┬─► Ship ──► MRR ($/s) + Reputation
                           │                   ├─► Client work ──► one-time $ + Rep
   every line adds DEBT ◄──┘                   ├─► Product features (rule changes, strategy forks)
          │                                    └─► Process upgrades (paid in code)
          └─ lowers income, causes incidents
             refactor slider, QA, process pay it down

 $ ──► hires (engineers + support roles), offices, markets, upgrades ──► Exit ──► Founder perks
```

## 3. Interface: the IDE

| Area | What it is |
|---|---|
| Title bar | **▶ Ship** button (like *Run*): next version, MRR gain, Rep gain, incident risk. Auto-ship toggle. |
| Explorer | Files appear as they unlock. Green **U** = not opened yet. Badges = something to do. |
| `app.ts` (left editor) | Click to write code. Flow bar. Incident and trending banners appear on top. |
| Open file (right editor) | `team.ts`, `upgrades.ts`, `features.ts`, `market.ts`, `clients.ts`, `exit.ts`, `perks.ts`, `ACHIEVEMENTS.md` |
| Bottom panel | **Terminal** = git log. **Problems** = tech debt, refactor slider, auto-ship limit. |
| Status bar | Branch + version, LoC, $, Rep, debt, Founder Points, run time, demo speed, reset. |

One screen shows one thing at a time; the only always-visible controls are writing,
shipping and the status bar. On phones the layout stacks and the explorer becomes a tab strip.

## 4. Resources

| Name | What it is | Notes |
|---|---|---|
| Unshipped code (LoC) | Code written but not released | Spent on shipping, client work, features, process upgrades |
| Money ($) | From MRR and client work | Hires, offices, markets, most upgrades |
| MRR ($/s) | Permanent income from shipped code | Capped by market size, cut by debt |
| Reputation (Rep) | From releases, clients, trending events | Unlocks roles, offices, markets. Never spent |
| Tech debt (%) | Average bugginess of all code written | Income × `1 − 1.5·debt`, incident chance `1.5·debt` |
| Founder Points (FP) | From selling a company | Spend on perks, or keep: +10% everything each |

## 5. Systems

### 5.1 Writing and flow
Click = `(1 + 1% of team LoC/s) × flow × upgrades`. Flow builds with steady clicking and
drains when you stop; its cap starts at ×2 and Tools upgrades raise it to ×3. Clicking is
~80% of output in minute 1 and settles around 30–45% for a very active player.

### 5.2 Shipping
Ship turns all unshipped code into MRR (`0.002 $/s per line`) and Rep (`0.4·√lines·quality`).
Deploy cooldown 8 s (upgrades cut it). First 3 releases never cause incidents.

### 5.3 Tech debt
Each engineer type has a bug rate; bug rates × `1 + headcount/40` (Brooks's law).
Pay it down with the refactor slider, QA Engineers, and Process upgrades.

### 5.4 Team: 11 roles
**Engineers** write code, each with an output and bug rate:
Intern, Junior, Senior, Tech Lead, AI Copilot (needs *Machine Learning*), Principal.
**Support roles** write no code; each one bends a rule, and all of them take seats:

| Role | Effect per person |
|---|---|
| QA Engineer | All code −3% bugs |
| Marketer | +4% Reputation, trending events sooner |
| Product Manager | +5% product income |
| Designer | Every market 3% bigger |
| Site Reliability Eng. | Incidents 6% less likely and shorter |

Seven offices (3 → 1,200 seats). Buy ×1 / ×10 / Max.

### 5.5 Upgrades: 75
- **Role tracks (30):** every engineer type has 5 upgrades at 1/10/25/50/100 hired. They do
  different things: output, fewer bugs, cheaper hires, synergies (*Mentorship*: each Senior
  makes Interns and Juniors 2% faster), trade-offs (*Intern Army*: ×4 code, +20% bugs).
- **Tools (8):** flow cap, flow speed, click power.
- **Process (15):** bug reduction, refactoring, deploy speed, incidents, CI/CD auto-ship,
  Kubernetes. Paid in code, so they compete with shipping.
- **People (8):** team output, hire cost, seats, Brooks's law, *Four-day Week* trade-off.
- **Growth (9):** product income, Reputation, market size, trending events.
- **Clients (5):** pay, Reputation, offer slots, offer duration.

Each upgrade appears only when it is relevant (a milestone, a problem you just hit).

### 5.6 Product features: 18, with 3 strategy forks
Built with unshipped code, in 7 tiers. Three pairs are "pick one per company":

| Fork | Option A | Option B |
|---|---|---|
| Pricing | **Freemium**: markets +50%, Rep +50%, −20% per line | **Enterprise**: ×1.5 per line, clients +50%, markets −20% |
| Platform | **Mobile App**: markets +30%, Rep ×1.3 | **Desktop App**: income ×1.3, incidents −30% |
| Moat | **AI Assistant**: income ×2, bugs +20% | **Self-hosting**: debt hurts half, clients ×2 |

Public API unlocks *Integration* client jobs (bigger, pay ×2).

### 5.7 Client work
Offers scale with your output, expire after 3 min, may require "debt ≤ X%" for a bonus.
2 slots, more from upgrades and the API.

### 5.8 Markets
Six markets (Hometown → Multiverse). MRR saturates at `cap × (1 − e^(−raw/cap))`;
expanding keeps your income and raises the cap. This is the main soft wall.

### 5.9 Events
- **Incident** — after a release (chance `1.5·debt`) or at random when debt is high.
  Income ×0.5 until hotfixed (12 clicks) or it fades (60 s).
- **Trending** — every 2.5–5 min. Claim within 12 s: income ×2 (×3 with *Influencer Deals*) for 30 s, +10% Rep.

### 5.10 Exit and Founder perks
- Valuation = MRR × 500. Selling needs $3M. Founder Points = `floor(√(valuation / 750K))`.
- Unspent FP: +10% code and income each. 14 perks cost 1–6 FP: starting bonuses, keep
  Tools/Process upgrades, auto-hiring, cheaper hires/features/markets, more FP per sale.

### 5.11 Achievements: 29
+1% code and income each, kept forever. Mix of milestones, play styles
(*Clean Code*, *YOLO Deploy*, *Decisive*), and one hidden easter egg.

### 5.12 Unlock order (files)
`clients.ts` (10 lines) → Ship button (2 deliveries or 200 lines) → `team.ts` ($15) →
`features.ts` (2 releases) → `upgrades.ts` (first relevant upgrade) → Problems tab (6% debt) →
`market.ts` (market 40% full) → `exit.ts` ($900K valuation) → `perks.ts` (after the first sale).

## 6. Measured pacing (`prototype/sim.js`, scripted player)

| Run | Perks owned | Exit (active) | Purchases | Upgrades | Features |
|---|---|---|---|---|---|
| 1 | — | 27 min | ~150 | 42 / 75 | 9 / 18 |
| 2 | 4 | 21 min | ~140 | 42 | 9 |
| 3 | 6 (Enterprise path) | 32 min | ~150 | 39 | 9 |
| 4 | 7 | 23 min | ~145 | 39 | 9 |

- A casual player (clicks 10 min, then idles) sells the first company at ~35 min.
- Every 5-minute window has 4–5 kinds of purchase (staff, upgrade, feature, office, market).
- Gap between purchases (p90): 25–50 s; longest gap ~2 min.
- About half of the upgrades and features stay locked in run 1: later runs and the other
  fork options are needed to see everything.

## 7. Later (not in the demo)

- **IPO** prestige layer with a Board Room shop.
- **Talents:** rare named hires with unique effects that survive an Exit.
- Statistics tab, settings (number format, save export/import).

## 8. Technical plan

`prototype/core.js` holds all rules with no DOM, timers or `Math.random`. Upgrades,
features, perks and support roles all write into one modifier object (`mods`), so new
content is data, not new code paths. The browser UI and the pacing simulation both run it.
The production version ports this to TypeScript:

```
src/core/      rules, content data, modifiers, save/migrations  (pure, Vitest)
src/platform/  storage, clock, RNG adapters per platform
src/ui/web/    IDE-style DOM rendering
tools/sim.ts   pacing simulation, run in CI to catch balance regressions
```

## 9. Roadmap

| Milestone | Content |
|---|---|
| **M0** | Vite + TS + Vitest setup; port `core.js` to typed modules with tests |
| **M1** | Port the IDE UI; save/load with versioned migrations |
| **M2** | Balance pass with real playtesters; sim in CI |
| **M3** | Talents, statistics, settings |
| **M4** | IPO + Board Room |
| **M5** | Polish, mobile pass, GitHub Pages deploy → v1.0 |

## 10. Open questions

1. Is the IDE layout easier to read than v0.3's single screen?
2. Do the strategy forks feel like real choices?
3. First Exit at ~27–35 min: still too short?
4. Which upgrade categories feel weakest?
