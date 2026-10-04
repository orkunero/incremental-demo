# Game Design Document — *Git Rich*

An incremental game about growing a software company from a single developer
in a bedroom to a global tech giant.

- **Platform:** Web first (Vite + TypeScript). The game logic is a platform-independent
  core, so it can later be moved to desktop (Electron/Tauri), mobile (Capacitor),
  a terminal UI, or another UI framework without a rewrite.
- **Language:** English only.
- **Visual style:** Modern card-based UI.
- **Scope:** Full: 3 resources, staff and products, contracts, a research tree,
  office and talent management, upgrades, achievements, offline progress, random
  events, and two prestige layers.
- **UI prototype:** https://claude.ai/artifact/DTgxc51UKKGSnmM1pwu5TS (sample numbers, layout reference only).

> Status: **Draft v0.2, for review.** All numbers are first-pass values and will
> be tuned during the balancing milestone.

---

## 1. Core loop

```
 click "Write Code" ──► Lines of Code (LoC)
                              │  spend LoC
                              ▼
                     Build PRODUCTS ──► Money ($) + Reputation (Rep)
                                           │ spend $        │ unlocks + bonus
                                           ▼                ▼
                                    Hire STAFF ──► more LoC/s, new tiers
```

1. You write code by clicking. That gives you **Lines of Code**.
2. You spend LoC to **build products**. Products earn **Money** and **Reputation** every second.
3. You spend Money to **hire staff**. Staff write LoC automatically.
4. Reputation unlocks better staff and products, and multiplies Money income.
5. When growth slows down, you **Exit** (sell the company) for permanent bonuses,
   and later you **IPO** for a deeper reset with a permanent upgrade shop.

The two chains (LoC → products → $, $ → staff → LoC) feed each other, so the
player keeps switching between the two tabs and always has something to buy.

---

## 2. Resources

| Resource | Symbol | Source | Spent on | Notes |
|---|---|---|---|---|
| Lines of Code | LoC | Clicks, Staff | Products, some Upgrades | Main "production" resource |
| Money | $ | Products | Staff, most Upgrades | Main "currency" |
| Reputation | Rep | Products, Events | Not spent | Unlocks tiers; Money multiplier `1 + √Rep / 100` |
| Experience | XP | Exit (prestige 1) | Not spent | +2% to all production per XP |
| Shares | — | IPO (prestige 2) | Board Room shop | Permanent upgrades |

**Click value:** `1 LoC` base, plus click upgrades, plus (later) a % of LoC/s.

**Number display:** `1.23K, 45.6M, 7.89B, 1.00T, …`, then scientific notation
(`1.23e18`). Plain JS `number` is enough (max ≈ 1e308). All math goes through a
small `num` helper module, so it can be swapped for `break_infinity.js` if needed.

---

## 3. Generators

Cost of the *n*-th purchase: `baseCost × 1.15^owned`. Buy x1 / x10 / Max buttons.

### 3.1 Staff (cost: $, produce: LoC/s)

| # | Staff | Base cost | LoC/s each | Unlock |
|---|---|---|---|---|
| 1 | Intern | $15 | 0.5 | start |
| 2 | Junior Dev | $100 | 4 | start |
| 3 | Senior Dev | $1.1K | 30 | 25 Rep |
| 4 | Tech Lead | $12K | 220 | 200 Rep |
| 5 | DevOps Squad | $130K | 1.6K | 1.5K Rep |
| 6 | AI Copilot Farm | $1.4M | 12K | 10K Rep |
| 7 | Quantum Compiler | $20M | 95K | 75K Rep |

### 3.2 Products (cost: LoC, produce: $/s and Rep/s)

| # | Product | Base cost | $/s each | Rep/s each | Unlock |
|---|---|---|---|---|---|
| 1 | Landing Page | 10 LoC | 0.3 | 0.01 | start |
| 2 | Mobile App | 120 LoC | 2.5 | 0.05 | start |
| 3 | SaaS Tool | 1.3K LoC | 18 | 0.2 | 25 Rep |
| 4 | Marketplace | 14K LoC | 130 | 1 | 200 Rep |
| 5 | Cloud Platform | 150K LoC | 950 | 5 | 1.5K Rep |
| 6 | AI Model | 1.6M LoC | 7K | 25 | 10K Rep |
| 7 | Metaverse OS | 22M LoC | 55K | 120 | 75K Rep |

Locked items appear as a "???" card that shows the Rep needed.

---

## 4. Upgrades (one-time purchases)

Upgrades show up when their condition is met and disappear after you buy them.

**Milestone upgrades (auto-generated):** every staff/product gets a ×2 upgrade
at 10, 25, 50, 100 and 200 owned. Cost ≈ `baseCost × 10 × milestone`.

**Hand-made upgrades (examples):**

| Upgrade | Cost | Effect | Appears when |
|---|---|---|---|
| Mechanical Keyboard | $50 | Click ×2 | 50 clicks |
| Dual Monitors | $500 | Click ×2 | 300 clicks |
| Vim Mastery | $5K | Click +1% of LoC/s | 1K clicks |
| Free Coffee | $1K | All staff +25% | 10 staff |
| Stack Overflow Account | $200 | Interns & Juniors ×2 | 5 Juniors |
| CI/CD Pipeline | 5K LoC | All products ×1.5 | 5 SaaS Tools |
| SEO Expert | $2K | Landing Pages ×3 | 25 Landing Pages |
| App Store Feature | $25K | Mobile Apps ×2, +50 Rep | 1K Rep |
| Remote Work | $500K | All production +10% | 50 staff |

---

## 5. Contracts

Clients offer fixed jobs. They give a big one-time reward and are the main
source of Reputation in the mid game.

- A contract has: **client**, **LoC required**, **deadline**, **reward ($ + Rep)**,
  and sometimes a **required technology** (from Research).
- The player sets **how much of the team works on contracts** (slider, 0–100%).
  That share of LoC/s goes into the contract instead of the LoC pool.
- **Slots:** 1 at start, more from Research and Office upgrades (max 5).
- **On time:** full reward. **Late:** contract fails, −Rep. **Early (< 50% of time):** +25% bonus.
- New offers arrive every few minutes. Offers scale with current LoC/s, so they
  stay relevant all game.
- Client types: Small business → Startup → Healthcare → Government → Enterprise.
  Bigger clients pay more but need technologies and more Rep.

| Example contract | LoC | Time | Reward | Needs |
|---|---|---|---|---|
| Bakery ordering app | 4K | 6 min | $2.5K, +15 Rep | — |
| Hospital booking portal | 18K | 15 min | $14K, +60 Rep | REST APIs |
| Bank fraud detector | 250K | 45 min | $300K, +600 Rep | Machine Learning |

---

## 6. Research (tech tree)

Four branches. A node costs **LoC + time**, and only **one node** can be
researched at a time (more parallel slots later from Board Room).

| Branch | Theme | Example nodes (in order) |
|---|---|---|
| Frontend | Products & clicks | HTML & CSS → React → Design System → Mobile Native |
| Backend | Product income & contracts | REST APIs → Databases → Microservices → Distributed Systems |
| AI | Reputation & late game | Statistics → Machine Learning → Deep Learning → AGI? |
| DevOps | Efficiency & quality | Git → CI/CD → Docker → Kubernetes |

Node rewards are one of three kinds:
- **Unlock:** a product, a contract type, or a mechanic (e.g. Kubernetes unlocks automation earlier).
- **Multiplier:** e.g. "SaaS Tools ×2", "Staff +20%".
- **Quality of life:** e.g. more contract slots, fewer bug events, more offline time.

Product unlocks now need **both** Rep and a technology (e.g. Cloud Platform needs
1.5K Rep + Distributed Systems). ~24 nodes for v1 (6 per branch).
Research resets on **Exit**; a Board Room upgrade can keep the first row.

---

## 7. Office & people

### 7.1 Office (capacity)

Every staff member needs a **seat**. When the office is full you cannot hire.

| Office | Seats | Cost | Extra |
|---|---|---|---|
| Garage | 5 | start | — |
| Co-working Space | 25 | $2K | — |
| Office Floor | 100 | $250K | +1 contract slot |
| Glass Tower | 500 | $40M | Talent market refreshes 2× faster |
| Campus | 2.5K | $5B | +1 research slot |

### 7.2 Morale

Team morale (0–100%) multiplies **LoC/s** from 0.5× to 1.2×.
- **Goes down:** overcrowding (> 90% of seats), long contract crunch (> 50% team on contracts for a long time), bug events.
- **Goes up:** perks (free coffee, ping-pong, standing desks, team offsite), finishing contracts, positive events.
- Under 30%: **burnout** — random staff quit (lose 1–3 of a cheap type).

### 7.3 Talents

Named, unique people with special bonuses. They appear in a **talent market**
(3 candidates, refreshes every 5 min). Hiring costs Money and one seat.

| Rarity | Chance | Example |
|---|---|---|
| Common | 70% | *Sam O., Night Owl:* offline earnings +10% |
| Rare | 25% | *Rafael M., Product Designer:* Mobile Apps +50% |
| Legendary | 5% | *Ada K., Backend Wizard:* every Senior Dev writes ×3 code |

Max 5 talents at once (more from office tiers). **Talents stay after Exit**
(but not after IPO), which makes each run a bit different.

---

## 8. Achievements

Each unlocked achievement gives **+1% to all production** (multiplicative with
everything else, additive with other achievements). Achievements survive both
prestige layers.

Categories (~40 for v1):
- **Clicks:** 100 / 1K / 10K / 100K
- **LoC written (lifetime):** 1K / 1M / 1B / 1T
- **Money earned (lifetime):** $1K / $1M / $1B / $1T
- **Reputation:** 100 / 10K / 1M
- **Own N of each generator:** 1 / 50 / 100
- **Events:** catch 10 positive events, fix 10 bugs
- **Prestige:** first Exit, 10 Exits, first IPO
- **Hidden/funny:** "Hello, World!" (first click), "It works on my machine"
  (fix a bug event in under 2 s), "Rubber Duck" (click the logo 10 times)

---

## 9. Offline progress

- On load: `elapsed = now − lastSave`, capped at **8 h** (can be raised with
  Board Room upgrades).
- Earned = current rates × elapsed × **50% efficiency** (can be raised).
- Rates do not change while offline (no auto-buying), so this is a single
  calculation, not a simulation.
- Random events do not happen while offline.
- A "Welcome back! While you were away…" popup shows what you earned.

---

## 10. Random events

A random event card appears every **2–5 minutes** (random). Positive events must
be clicked within **15 s** or they disappear (like the golden cookie).

| Event | Type | Effect |
|---|---|---|
| 🚀 Went Viral! | + | Money ×3 for 30 s |
| 💡 Hackathon | + | Click value ×10 for 15 s |
| 💼 Investor Visit | + | Instantly get 60 s worth of Money |
| 🎤 Tech Conference | + | Instantly get Rep = 2 min of Rep/s |
| 🐛 Production Bug! | − | LoC/s −50% until fixed. Fix = click the bug 10 times (max 30 s) |
| 🔥 Server Outage | − | Money/s −50% for 20 s (shortened by a Board Room upgrade) |

Negative events only start after the player owns 25 staff, so new players are
not punished. The ratio is about 75% positive / 25% negative.

---

## 11. Prestige layer 1 — Exit (sell the company)

- **Requirement:** earn $1M total in the current run.
- **Reward:** `XP gained = floor(√(runMoney / 1M)) − XP already earned in this run`
  (so the button shows "+N XP if you exit now").
- **Effect of XP:** each XP gives **+2% to all production**, forever (until IPO).
- **Resets:** LoC, $, Rep, staff, products, upgrades, research, office, contracts.
- **Keeps:** XP, achievements, talents, Shares, Board Room upgrades, statistics.
- **Serial Founder perks** (free, unlocked by number of Exits):
  - 1 Exit: start each run with $100
  - 3 Exits: offline cap +4 h
  - 5 Exits: milestone upgrades cost 50% less
  - 10 Exits: unlock "Buy Max" automation for Interns

## 12. Prestige layer 2 — IPO (go public)

- **Requirement:** 100 lifetime XP **and** $1B earned in the current run.
- **Reward:** `Shares = floor(√(lifetimeXP / 25))`, minus Shares already gained from this level.
- **Resets:** everything that Exit resets, **plus XP, Exit count and talents**.
- **Keeps:** Shares, Board Room upgrades, achievements, statistics.
- **Board Room shop** (spend Shares, permanent):

| Upgrade | Effect | Cost (Shares) |
|---|---|---|
| Golden Parachute | XP gain ×1.5 (stackable ×3) | 1 / 3 / 9 |
| Auto-Recruiter | Automatically buys the cheapest staff | 2 |
| Auto-Deploy | Automatically buys the cheapest product | 2 |
| Night Shift | Offline efficiency 50% → 75% → 100% | 2 / 6 |
| Long Weekend | Offline cap +8 h | 3 |
| Head Start | Start each run with 100 Rep | 3 |
| Legacy Codebase | Keep milestone upgrades on Exit | 5 |
| PR Team | Positive events ×1.5 more often | 4 |
| QA Department | Negative events −50% duration | 4 |
| R&D Lab | +1 parallel research slot | 4 |
| Tech Heritage | Keep the first row of research on Exit | 3 |
| Headhunter | Talent market: Legendary chance 5% → 10% | 5 |

---

## 13. Production formula

```
LoC/s   = Σ(staff.count × staff.base × staff.upgradeMult × talentMult)
          × globalMult × moraleMult          (moraleMult: 0.5 – 1.2)
          (a share of this, set by the player, goes to the active contracts)

Money/s = Σ(product.count × product.base × product.upgradeMult)
          × globalMult × (1 + √Rep / 100) × eventMult

Rep/s   = Σ(product.count × product.rep) × globalMult

globalMult = (1 + 0.02 × XP) × (1 + 0.01 × achievements) × researchMult × otherGlobalUpgrades
```

---

## 14. UI layout (web, modern cards)

**See the clickable prototype:** https://claude.ai/artifact/DTgxc51UKKGSnmM1pwu5TS

- **Top bar:** game name and the three resources with their per-second rates.
- **Left column:**
  - "Write Code": a small code editor. Each click types a new (funny) line of code.
  - Event card (when there is an event).
  - Active contract with progress.
  - Commit history graph: like the GitHub contribution graph, it fills up as you click.
- **Right column, tabs:** Team · Products · Contracts · Research · Office ·
  Upgrades · Achievements · Exit & IPO (+ Stats and Settings).
- Cards show owned count, output, and a Buy button with a progress fill
  toward the cost. Locked cards are dashed and show what is needed.
- On mobile: one column, editor on top, tabs scroll sideways.
- Light and dark theme.
- Settings: number format, save export/import (base64 text), hard reset.

---

## 15. Technical architecture

The main rule: **`core/` never imports from the DOM, a framework, or the
browser.** All platform-specific things go through small interfaces.

```
src/
  core/                    # pure TypeScript, 100% unit-testable
    content/               # data only: staff.ts, products.ts, upgrades.ts,
                           # contracts.ts, research.ts, offices.ts, talents.ts,
                           # achievements.ts, events.ts, boardroom.ts
    state.ts               # GameState type + createInitialState()
    systems/               # pure functions: (state, ...) => state changes
      production.ts        # rates and multipliers
      purchase.ts          # costs, buy x1/x10/max
      upgrades.ts
      contracts.ts         # offers, assignment, deadlines
      research.ts          # tree, queue
      office.ts            # seats, morale, perks, talent market
      achievements.ts
      events.ts
      offline.ts
      prestige.ts          # exit + ipo
    engine.ts              # Game class: tick(dt), dispatch(action), subscribe()
    save.ts                # serialize/deserialize + versioned migrations
    ports.ts               # interfaces: StorageAdapter, Clock, Random
    num.ts                 # number helpers + formatting
  platform/web/            # adapters: localStorage, Date.now, Math.random
  ui/web/                  # DOM rendering + CSS (cards)
  main.ts                  # wires core + platform + ui
tests/                     # Vitest, mostly for core/
```

- **Actions:** the UI only sends actions (`{ type: 'buyStaff', id, amount }`,
  `{ type: 'click' }`, `{ type: 'exit' }` …). This works the same from a DOM
  button, a keyboard key, or a terminal command.
- **Game loop:** logic ticks at a fixed 10 ticks/s. Rendering runs on
  `requestAnimationFrame` and only updates changed values.
- **Determinism:** `Clock` and `Random` are injected, so tests can control time
  and events.
- **Save:** JSON with a `version` field and migration functions. Autosave every
  30 s and when the tab is hidden.
- **Tooling:** Vite, TypeScript (strict), Vitest, ESLint + Prettier.
  Deployed to GitHub Pages via GitHub Actions.
- **Porting later:** a new platform only needs a new `platform/*` adapter set
  and a new `ui/*`; `core/` stays the same.

---

## 16. Roadmap

| Milestone | Content | Result |
|---|---|---|
| **M0** | Vite + TS + Vitest + lint setup, folder structure | Empty project builds |
| **M1** | Core state, click, LoC/$/Rep, staff, products, tick, save/load, basic card UI | First playable version |
| **M2** | Upgrades (milestone + hand-made), buy x10/max | Real progression |
| **M3** | Office: seats, office tiers, morale, perks | Team management |
| **M4** | Contracts | Goals with deadlines |
| **M5** | Research tree | Choices and unlocks |
| **M6** | Achievements, offline progress, stats tab | Long-term motivation |
| **M7** | Random events + talent market | Surprise and variety |
| **M8** | Exit (prestige 1) + Serial Founder perks | First reset loop |
| **M9** | IPO (prestige 2) + Board Room + automation | Late game |
| **M10** | Balancing pass, polish, mobile layout, GitHub Pages deploy | Release v1.0 |

---

## 17. Open questions (please review)

1. **Rep multiplier:** `1 + √Rep / 100` gives ×2 at 10K Rep. Too strong or too weak?
2. **First Exit timing:** target is about 30–45 minutes of active play. OK?
3. **Negative events and burnout:** keep them, or make them optional in Settings?
4. **Automation:** should auto-buy come earlier (Exit perk) or only after IPO?
5. **Icons:** letter tiles like the prototype, emoji, or an icon set like Lucide?
6. **Contracts:** is failing a late contract (−Rep) too harsh for an idle game?
