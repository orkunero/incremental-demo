# Game Design Document — *Ship It!* (working title)

An incremental game about growing a software company from a single developer
in a bedroom to a global tech giant.

- **Platform:** Web first (Vite + TypeScript). The game logic is a platform-independent
  core, so it can later be moved to desktop (Electron/Tauri), mobile (Capacitor),
  a terminal UI, or another UI framework without a rewrite.
- **Language:** English only.
- **Visual style:** Modern card-based UI.
- **Scope:** Full: 3 resources, upgrades, achievements, offline progress, random
  events, and two prestige layers.

> Status: **Draft v0.1, for review.** All numbers are first-pass values and will
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

## 5. Achievements

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

## 6. Offline progress

- On load: `elapsed = now − lastSave`, capped at **8 h** (can be raised with
  Board Room upgrades).
- Earned = current rates × elapsed × **50% efficiency** (can be raised).
- Rates do not change while offline (no auto-buying), so this is a single
  calculation, not a simulation.
- Random events do not happen while offline.
- A "Welcome back! While you were away…" popup shows what you earned.

---

## 7. Random events

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

## 8. Prestige layer 1 — Exit (sell the company)

- **Requirement:** earn $1M total in the current run.
- **Reward:** `XP gained = floor(√(runMoney / 1M)) − XP already earned in this run`
  (so the button shows "+N XP if you exit now").
- **Effect of XP:** each XP gives **+2% to all production**, forever (until IPO).
- **Resets:** LoC, $, Rep, staff, products, upgrades.
- **Keeps:** XP, achievements, Shares, Board Room upgrades, statistics.
- **Serial Founder perks** (free, unlocked by number of Exits):
  - 1 Exit: start each run with $100
  - 3 Exits: offline cap +4 h
  - 5 Exits: milestone upgrades cost 50% less
  - 10 Exits: unlock "Buy Max" automation for Interns

## 9. Prestige layer 2 — IPO (go public)

- **Requirement:** 100 lifetime XP **and** $1B earned in the current run.
- **Reward:** `Shares = floor(√(lifetimeXP / 25))`, minus Shares already gained from this level.
- **Resets:** everything that Exit resets, **plus XP and Exit count**.
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

---

## 10. Production formula

```
LoC/s   = Σ(staff.count × staff.base × staff.upgradeMult)
          × globalMult

Money/s = Σ(product.count × product.base × product.upgradeMult)
          × globalMult × (1 + √Rep / 100) × eventMult

Rep/s   = Σ(product.count × product.rep) × globalMult

globalMult = (1 + 0.02 × XP) × (1 + 0.01 × achievements) × otherGlobalUpgrades
```

---

## 11. UI layout (web, modern cards)

```
┌──────────────────────────────────────────────────────────────────┐
│  Ship It!     📄 1.23M LoC (+4.5K/s)   💵 $890K (+12K/s)   ⭐ 3.4K Rep │
├───────────────┬──────────────────────────────────────────────────┤
│               │ [Team] [Products] [Upgrades] [Achievements]       │
│   ⌨️  WRITE    │ [Exit / IPO] [Stats] [Settings]                  │
│     CODE      │ ┌────────────┐ ┌────────────┐ ┌────────────┐     │
│   +12 LoC     │ │ 👩‍💻 Intern   │ │ 🧑‍💻 Junior  │ │ 🔒 ???      │     │
│               │ │ owned: 34  │ │ owned: 12  │ │ needs 25 Rep│     │
│ (event cards  │ │ $1.2K  [Buy]│ │ $890 [Buy] │ │            │     │
│  appear here) │ └────────────┘ └────────────┘ └────────────┘     │
└───────────────┴──────────────────────────────────────────────────┘
```

- On mobile: the click button is on top and tabs become a bottom bar.
- Buy buttons are grey when you can't afford them, and show a progress bar
  toward the cost.
- Short toast notifications for achievements and events.
- Settings: number format, save export/import (base64 text), hard reset.

---

## 12. Technical architecture

The main rule: **`core/` never imports from the DOM, a framework, or the
browser.** All platform-specific things go through small interfaces.

```
src/
  core/                    # pure TypeScript, 100% unit-testable
    content/               # data only: staff.ts, products.ts, upgrades.ts,
                           # achievements.ts, events.ts, boardroom.ts
    state.ts               # GameState type + createInitialState()
    systems/               # pure functions: (state, ...) => state changes
      production.ts        # rates and multipliers
      purchase.ts          # costs, buy x1/x10/max
      upgrades.ts
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

## 13. Roadmap

| Milestone | Content | Result |
|---|---|---|
| **M0** | Vite + TS + Vitest + lint setup, folder structure | Empty project builds |
| **M1** | Core state, click, LoC/$/Rep, staff, products, tick, save/load, basic card UI | First playable version |
| **M2** | Upgrades (milestone + hand-made), buy x10/max | Real progression |
| **M3** | Achievements + offline progress + stats tab | Long-term motivation |
| **M4** | Random events | Moments of surprise |
| **M5** | Exit (prestige 1) + Serial Founder perks | First reset loop |
| **M6** | IPO (prestige 2) + Board Room + automation | Late game |
| **M7** | Balancing pass, polish, mobile layout, GitHub Pages deploy | Release v1.0 |

---

## 14. Open questions (please review)

1. **Name:** is "Ship It!" OK? Other ideas: *Startup Tycoon*, *Commit & Conquer*,
   *Git Rich*.
2. **Rep multiplier:** `1 + √Rep / 100` gives ×2 at 10K Rep. Too strong or too weak?
3. **First Exit timing:** target is about 30–45 minutes of active play. OK?
4. **Negative events:** keep them, or make them optional in Settings?
5. **Automation:** should auto-buy come earlier (Exit perk) or only after IPO?
6. **Icons:** emoji (fast, zero assets) or an icon set like Lucide?
