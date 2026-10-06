# Game Design Document — *Git Rich*

An incremental game about growing a software company. The central tension is
the one every developer knows: **ship fast, or keep the code clean?**

- **Platform:** Web first (Vite + TypeScript). Game rules live in a platform-independent
  core, so the game can later move to desktop, mobile or a terminal UI.
- **Language:** English only. **Look:** the whole game is an IDE window, light and dark theme.
- **Playable demo:** https://claude.ai/artifact/DTgxc51UKKGSnmM1pwu5TS
  (source: `prototype/`; all numbers live in `prototype/core.js`).
- **Status:** Draft v0.7. v0.7 is a self-playtest pass: market size became a real ceiling
  (it was being bypassed, so growth exploded after the first sale target), parallel goals,
  safe offline progress, rule tests, and the second prestige layer (IPO + Board Room).
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
Six markets. MRR = `cap × (1 − e^(−raw/cap))` × debt quality × prestige bonuses, and
**market size is a hard ceiling**: "release income" upgrades make each shipped line fill the
market faster, they never lift the ceiling. Expanding keeps your income and raises the cap.
When a market is >85% full and the next one is unlocked, `market.ts` shows "full" and the log
tells you to save up. These plateaus are the natural moments to sell.

| Market | Size ($/s) | Cost | Rep |
|---|---|---|---|
| Hometown | 15 | — | — |
| Nationwide | 300 | $900 | 30 |
| Continental | 15K | $60K | 800 |
| Global | 750K | $40M | 60K |
| Interplanetary | 40M | $2B | 400K |
| Multiverse | 2B | $200B | 20M |

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
- Valuation = MRR × 500. The first sale needs $50M; **each sale needs 10× more**, so every
  company has to reach a new market tier.
- Founder Points total = `floor(2 · ∛(everything ever sold / 100M))`; each sale adds the difference
  (about +4 for the first sale on the Global plateau, +12 when a company reaches Interplanetary).
- Head starts from perks (and Board Room seats) apply right away when bought, and to every new company.
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
24 goals; the first three unfinished ones are open at a time and can be done in any order, so a
goal you skip (say, never hiring support roles) never blocks the list. The first open goal is shown
under the editor with a progress bar and its reward (money, code or Reputation, scaled to income). They walk a new player through every
system: first client, first hire, first release, a pricing choice, the first support role,
new markets, up to the sale target. The list restarts with each company.

### 5.14 Challenges (`challenges.ts`)
After the first sale. Starting one ends the current company with no Founder Points.

| Challenge | Rule | Goal | Permanent reward |
|---|---|---|---|
| Solo Founder | No hiring; your clicks ×5 | $250K | Clicks ×2, flow builds 50% faster |
| Legacy Codebase | Start at 40% debt; refactoring ×0.5 | $100M | Refactoring ×1.5 |
| Bootstrapped | No client work | $100M | Releases earn 25% more |
| Move Fast and Break Things | Instant deploys; incidents ×3 likely and ×3 longer | $100M | Incidents −25% |
| Ramen Budget | Hires, offices, markets cost ×3 | $30M | Hires −10% |
| Cowboy Coding | No Process upgrades | $50M | All bugs −15% |

Measured: each is completable in 26–56 min with a few early perks.

### 5.15 Automation (`.github/workflows.yml`)
Bots come from upgrades (and two perks) and can be switched off: CI/CD (auto-ship under a
debt limit), Zapier Flows (auto-deliver client work), Refactor Bot (holds debt near a target),
Dependabot (installs upgrades under 10% of what you have), Bug Triage Bot, Recruiting Pipeline.

### 5.16 Statistics and settings
`stats.md`: code per second by role, every income multiplier, this company and all-time totals.
`settings.json`: number format (1.23M or 1.23e6), theme (system/light/dark), export and import
of the save as text. Hiring cost growth is ×1.2 per hire.
Offline progress (up to 2 h, 8 h with *Night Owl*) runs the economy but skips bugs, decisions,
trending and random incidents, so you never come back to a pile of escaped bugs.

### 5.17 IPO and the Board Room (`ipo.ts`)
The second prestige layer. `ipo.ts` appears after the third sale. Going public needs a $20B
valuation (outside challenges) and resets everything a sale resets, plus Founder Points, perks
and the sale count (so the sale target drops back to $50M). It gives **Shares**:
`floor(√(everything ever taken public / 2B))` in total. Unspent Shares give +25% code and income
each; or spend them on 10 permanent Board Room seats (1–8 Shares): ×2 Founder Points per sale,
starting team, starting Reputation and market, $1M head start, keep cheap perks through an IPO,
all bots from the start, double seats, double market size, cheaper features, and Dual-class
Shares (+50% per unspent Share).

## 6. Measured pacing (`prototype/sim.js`, scripted player)

| Company | Sold at (active) | Result |
|---|---|---|
| 1 | 32–35 min | +4 Founder Points (Global plateau) |
| 2 | 22 min | +2 FP |
| 3 | 44–52 min | +12 FP (reaches Interplanetary) |
| 4 | 59 min | **IPO**, +9 Shares (~2.7 h total) |
| 5–7 | 15–35 min each | second cycle, faster with Board Room seats |
| 8 | 36 min | second IPO, +4 Shares (~1.8 h after the first) |

- Active = 5 clicks/s, squashes bugs, answers decisions, saves up when a market is full, sells on
  a plateau. Casual = clicks for 10 minutes, then idles: first sale at ~40 min.
- Gap between purchases (p90) stays under 25 s for 30 minutes; the longest wait is about 1 min.
- `prototype/test.js` checks the rules (31 checks: offline catch-up, challenges, perks, IPO, save
  round trip, long-run stability).

## 7. Later (not in the demo)

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
tools/test.ts  rule checks (today: prototype/test.js)
```

## 9. Roadmap

| Milestone | Content |
|---|---|
| **M0** | Vite + TS + Vitest setup; port `core.js` to typed modules with tests |
| **M1** | Port the IDE UI; save/load with versioned migrations |
| **M2** | Balance pass with real playtesters; sim in CI |
| **M3** | Talents |
| **M4** | IPO + Board Room (done in the prototype; port with M1) |
| **M5** | Polish, mobile pass, GitHub Pages deploy → v1.0 |

## 10. Open questions

1. Is the IDE layout easier to read than v0.3's single screen?
2. Do the strategy forks feel like real choices?
3. First sale at ~35–40 min, first IPO at ~2.7 h: does that feel right?
4. Which new system adds the most: goals, bugs, decisions, bots or challenges?
