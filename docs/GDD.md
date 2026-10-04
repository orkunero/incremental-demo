# Game Design Document — *Git Rich*

An incremental game about growing a software company. The central tension is
the one every developer knows: **ship fast, or keep the code clean?**

- **Platform:** Web first (Vite + TypeScript). Game rules live in a platform-independent
  core, so the game can later move to desktop, mobile or a terminal UI.
- **Language:** English only. **Look:** the whole game is an IDE window, light and dark theme.
- **Playable demo:** https://claude.ai/artifact/DTgxc51UKKGSnmM1pwu5TS
  (source: `prototype/`; all numbers live in `prototype/core.js`).
- **Status:** Draft v0.6. v0.6 adds the systems most good incrementals have and v0.5 lacked:
  a goal list, an active "golden cookie" mechanic (bugs), decision events, automation as a
  reward, challenge runs, statistics and settings with save export.
  History: [Playtest 01](playtest-01.md).

---

## 1. Design pillars

1. **One central tension.** Speed vs. quality (tech debt). Every system pushes on it.
2. **Every few minutes, a real decision.** Never "always buy the cheapest".
3. **The game unfolds.** Files appear in the explorer as the company grows.
4. **Walls on purpose.** Growth slows before the first Exit, so selling feels like relief.
5. **The theme is the mechanic.** Shipping, incidents, refactoring, Brooks's law, CI/CD.
6. **Runs differ.** Strategy forks, founder perks and challenges make each company play differently.
7. **Always a next goal.** `TODO.md` shows one concrete goal with a reward at all times.
8. **Active play pays, idle play works.** Bugs, decisions and trending reward attention;
   automation bots take over chores as a reward, never as a requirement.

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
| `app.ts` (left editor) | Click or type to write code. Bugs crawl over it. Flow bar and the current TODO goal below. Incident, trending and decision cards appear on top. |
| Open file (right editor) | `team.ts`, `upgrades.ts`, `features.ts`, `market.ts`, `clients.ts`, `exit.ts`, `perks.ts`, `challenges.ts`, `.github/workflows.yml`, `TODO.md`, `ACHIEVEMENTS.md`, `stats.md`, `settings.json` |
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
Click (or any key on the keyboard) = `(1 + 1% of team LoC/s) × flow × upgrades`. Flow builds with steady clicking and
drains when you stop; its cap starts at ×2 and Tools upgrades raise it to ×3. Clicking is
~80% of output in minute 1 and settles around 30–45% for a very active player.

### 5.2 Shipping
Ship turns all unshipped code into MRR (`0.002 $/s per line`), Rep (`0.4·√lines·quality`) and
instant **launch sales** worth 90 s of the MRR it adds (so they shrink as the market fills).
Deploy cooldown 12 s; upgrades cut it and *CI/CD* automates shipping.

### 5.3 Tech debt
Each engineer type has a bug rate; bug rates × `1 + headcount/40` (Brooks's law).
Pay it down with the refactor slider, QA Engineers, and Process upgrades. The first incident
opens the Problems tab and explains the slider.

### 5.4 Team: 11 roles
**Engineers** write code, each with an output and bug rate:
Intern (40% bugs), Junior, Senior, Tech Lead, AI Copilot (needs *Machine Learning*), Principal.
**Support roles** write no code; each one bends a rule, and all of them take seats:

| Role | Effect per person |
|---|---|
| QA Engineer | All code −3% bugs |
| Marketer | +4% Reputation, trending events sooner |
| Product Manager | +5% product income |
| Designer | Every market 3% bigger |
| Site Reliability Eng. | Incidents 6% less likely and shorter |

Seven offices (3 → 1,200 seats). Buy ×1 / ×10 / Max. When seats are full you can **promote**
an engineer to the next level (same price as hiring one) or **let someone go**, so an office full
of Interns is never a dead end.

### 5.5 Upgrades: 80
- **Role tracks (30):** every engineer type has 5 upgrades at 1/10/25/50/100 hired. They do
  different things: output, fewer bugs, cheaper hires, synergies (*Mentorship*: each Senior
  makes Interns and Juniors 2% faster), trade-offs (*Intern Army*: ×4 code, +20% bugs).
- **Tools (8):** flow cap, flow speed, click power.
- **Process (15):** bug reduction, refactoring, deploy speed, incidents, CI/CD auto-ship,
  Kubernetes. Paid in code, so they compete with shipping.
- **People (8):** team output, hire cost, seats, Brooks's law, *Four-day Week* trade-off.
- **Growth (9):** product income, Reputation, market size, trending events.
- **Clients (5):** pay, Reputation, offer slots, offer duration.
- **Automation (5):** the workflow bots in §5.15.

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
After all bonuses, pay is capped at 60 s of your market size, so client work cannot outgrow the market.
2 slots, more from upgrades and the API.

### 5.8 Markets
Six markets (Hometown → Multiverse). MRR saturates at `cap × (1 − e^(−raw/cap))`;
expanding keeps your income and raises the cap. This is the main soft wall.

### 5.9 Events
- **Incident** — after a release (chance `1.6·(debt − 8%)`, never in the first 5 releases) or at
  random when debt is high. Income ×0.5 until hotfixed (8 clicks) or it fades (60 s).
- **Trending** — every 2.5–5 min. Claim within 12 s: income ×2 (×3 with *Influencer Deals*) for 30 s, +10% Rep.
- **Bugs** — 🐛 crawl across `app.ts`, more often the higher your debt (every ~15 s at 20% debt,
  ~45 s at 3%). Click one within 15 s: +3 s of income and a little less debt. If it escapes, debt
  goes up. This is the game's golden cookie, and it makes debt visible.
- **Decisions** — after the 8th release, every 3–5 min a card with two options and 30 s to pick:
  rush job, crunch time, open-sourcing, a poaching attempt, a security audit, a keynote invite,
  an angel investor. Most trade money, code, debt or Reputation now against something later.

### 5.10 Exit and Founder perks
- Valuation = MRR × 500. The first sale needs $50M; **each sale needs 4× more**, so every
  company has to go further (new markets, offices and features).
- Founder Points total = `floor(2 · ∛(everything ever sold / 2.5M))`; each sale adds the difference.
- Unspent FP: +10% code and income each. 17 perks cost 1–6 FP: starting bonuses, keep
  Tools/Process upgrades, auto-hiring, starting bots, bigger bug and decision payouts,
  cheaper hires/features/markets, more FP per sale.

### 5.11 Achievements: 39
+1% code and income each, kept forever. Mix of milestones, play styles
(*Clean Code*, *YOLO Deploy*, *Decisive*, *Crunch Mode*, *Zero Downtime*), challenges, and one
hidden easter egg.

### 5.12 Unlock order (files)
`clients.ts` (10 lines) → Ship button (2 deliveries or 200 lines) → `team.ts` ($15) →
`features.ts` (2 releases) → `upgrades.ts` (first upgrade within reach) → Problems tab (6% debt) →
`market.ts` (market 40% full) → `exit.ts` (30% of the sale target) → `perks.ts` (after the first sale).
`TODO.md` and `settings.json` are there from the start; `stats.md` after 5 minutes;
`.github/workflows.yml` with the first bot; `challenges.ts` after the first sale.
`ACHIEVEMENTS.md` appears after 3 achievements. Upgrades only appear once they are within a few
minutes of income, so the list never fills with far-off items.

### 5.13 Goals (`TODO.md`)
24 goals in order, one shown at a time under the editor with a progress bar and its reward
(money, code or Reputation, scaled to your income). They walk a new player through every
system: first client, first hire, first release, a pricing choice, the first support role,
new markets, up to the sale target. The list restarts with each company.

### 5.14 Challenges (`challenges.ts`)
After the first sale. Starting one ends the current company with no Founder Points.

| Challenge | Rule | Goal | Permanent reward |
|---|---|---|---|
| Solo Founder | No hiring; your clicks ×5 | $250K | Clicks ×2, flow builds 50% faster |
| Legacy Codebase | Start at 40% debt; refactoring ×0.5 | $25M | Refactoring ×1.5 |
| Bootstrapped | No client work | $25M | Product income ×1.25 |
| Move Fast and Break Things | Instant deploys; incidents ×3 likely and ×3 longer | $25M | Incidents −25% |
| Ramen Budget | Hires, offices, markets cost ×3 | $10M | Hires −10% |
| Cowboy Coding | No Process upgrades | $10M | All bugs −15% |

Measured: each is completable in 22–44 min with a few early perks.

### 5.15 Automation (`.github/workflows.yml`)
Bots come from upgrades (and two perks) and can be switched off: CI/CD (auto-ship under a
debt limit), Zapier Flows (auto-deliver client work), Refactor Bot (holds debt near a target),
Dependabot (installs upgrades under 10% of what you have), Bug Triage Bot, Recruiting Pipeline.

### 5.16 Statistics and settings
`stats.md`: code per second by role, every income multiplier, this company and all-time totals.
`settings.json`: number format (1.23M or 1.23e6), theme (system/light/dark), export and import
of the save as text. Hiring cost growth is ×1.2 per hire.

## 6. Measured pacing (`prototype/sim.js`, scripted player)

| Company | Sold at (active) | Sold at (casual) | Upgrades | Features | Achievements |
|---|---|---|---|---|---|
| 1 | 31–39 min | 39–43 min | 55 / 80 | 13 / 18 | 20 / 39 |
| 2 | 20 min | 26–28 min | 55 | 13 | 25 |
| 3 | 24 min | 31 min | 58 | 14 | 27 |
| 4 | 13 min | | 55 | 14 | 28 |
| 5 | 13 min | | 60 | 15 | 30 |

- Active = 5 clicks/s, squashes bugs, answers decisions; casual = clicks for 10 minutes, then idles.
  Ranges come from the scripted player's random choices.
- Gap between purchases (p90) stays under 25 s for 30 minutes; the longest wait is about 1 min.
- An active player finishes all 24 goals in the first company.
- Known issue: companies 4–5 get short (~13 min) once many perks stack. Next tuning target.

## 7. Later (not in the demo)

- **IPO** prestige layer with a Board Room shop.
- **Talents:** rare named hires with unique effects that survive an Exit.

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
| **M3** | Talents |
| **M4** | IPO + Board Room |
| **M5** | Polish, mobile pass, GitHub Pages deploy → v1.0 |

## 10. Open questions

1. Is the IDE layout easier to read than v0.3's single screen?
2. Do the strategy forks feel like real choices?
3. First sale at ~40 min, later ones 20–35 min: does that feel right?
4. Which new system adds the most: goals, bugs, decisions, bots or challenges?
