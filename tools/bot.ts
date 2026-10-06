// A scripted player that plays the real rules. Used by the pacing report (sim.ts),
// the balance check in CI (balance.ts) and the tests.
import * as G from '../src/core/index.ts';
import type { GameState, Meta, Rng } from '../src/core/index.ts';

export const seeded = (seed: number): Rng => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const PERK_ORDER = ['serial', 'friends', 'muscle', 'network', 'autodeploy', 'magnet', 'angel', 'autohire', 'product', 'playbook', 'veteran', 'instinct', 'night', 'unicorn'];

export interface BotOptions {
  /** clicks per second while active */
  cps?: number;
  /** seconds after which the player stops clicking (casual player) */
  idleAfter?: number;
  /** longest company in seconds before giving up */
  maxT?: number;
  seed?: number;
}

export interface Purchase {
  t: number;
  name: string;
}

export interface CompanyResult {
  state: GameState;
  /** next company's starting state, or null if the bot could not sell */
  next: GameState | null;
  soldAt: number | null;
  kind: 'sale' | 'ipo' | null;
  gain: number;
  purchases: Purchase[];
  clickLoc: number;
  teamLoc: number;
}

function decide(s: GameState, m: CompanyResult, run: number, rng: Rng) {
  const buy = (name: string) => m.purchases.push({ t: s.t, name });
  if (s.revealed.debt) {
    const d = G.debtPct(s);
    G.setRefactor(s, d > 0.22 ? 0.6 : d > 0.15 ? 0.3 : 0);
  }
  for (const c of [...s.contracts].sort((a, b) => b.pay - a.pay)) if (G.deliver(s, c.id)) buy('contract');
  // product features: alternate the strategy pairs between runs
  for (const f of G.FEATURES) {
    if (G.featureState(s, f) !== 'open') continue;
    if (f.fork && G.FEATURES.filter((x) => x.fork === f.fork)[run % 2] !== f) continue;
    if (G.buyFeature(s, f.id)) buy('feature:' + f.id);
  }
  if (G.buyMarket(s)) buy('market' + s.market);
  // a player saves up when the market is full and the next one is unlocked
  const reserve = G.marketFull(s) ? G.marketCost(s) : 0;
  for (const u of G.UPGRADES) {
    if (G.upgradeVisible(s, u) && G.canAfford(s, u.cost) && (!u.cost.money || s.money - u.cost.money >= reserve) && G.buyUpgrade(s, u.id)) buy('upgrade:' + u.id);
  }
  if (reserve) return;
  if (G.headcount(s) >= G.seats(s) - 1 && G.moveOffice(s)) buy('office' + s.office);
  const eng = G.ENGINEERS.reduce((a, d) => a + s.staff[d.id], 0);
  const want: Record<string, number> = {
    qa: G.debtPct(s) > 0.1 ? Math.floor(eng * 0.12) : 0,
    marketer: Math.floor(eng * 0.06),
    pm: Math.floor(eng * 0.08),
    designer: G.saturation(s) > 0.6 ? Math.floor(eng * 0.05) : 0,
    sre: s.stats.incidents > 3 ? Math.floor(eng * 0.03) : 0,
  };
  for (const d of G.SUPPORT) {
    while (G.roleUnlocked(s, d) && s.staff[d.id] < want[d.id] && G.staffCost(s, d.id) < s.money * 0.5 && G.hire(s, d.id, 1)) buy('staff:' + d.id);
  }
  if (G.headcount(s) >= G.seats(s)) {
    for (const d of G.ENGINEERS) while (s.staff[d.id] > 0 && G.nextLevel(s, d.id) && G.promoteCost(s, d.id) < s.money * 0.3 && G.promote(s, d.id)) buy('promote');
  }
  for (const c of [...s.talentPool]) if (G.talentCost(s, c) < s.money * 0.3 && G.hireTalent(s, c.id)) buy('talent');
  for (;;) {
    const b = G.bestEngineer(s);
    if (!b || !G.hire(s, b.id, 1)) break;
    buy('staff:' + b.id);
  }
  if (G.mods(s).autoShip) s.autoShip = true;
  const fits = (c: G.Contract) => c.maxDebt == null || G.debtPct(s) <= c.maxDebt;
  const saving = s.contracts.some((c) => fits(c) && c.size > s.loc && (c.size < s.loc * 3 || G.saturation(s) > 0.8))
    || G.FEATURES.some((f) => G.featureState(s, f) === 'open' && G.featureCost(s, f) > s.loc && G.featureCost(s, f) < s.loc * 2);
  const r = G.rates(s);
  if (!saving && G.canShip(s) && s.loc >= Math.max(10, (r.feature + 3) * 15) && G.debtPct(s) < 0.25) G.ship(s, rng);
}

/** Play one company from `meta` until the bot sells it (or goes public), or until maxT. */
export function playCompany(meta: Meta | null, run: number, opts: BotOptions = {}): CompanyResult {
  const cps = opts.cps ?? 5;
  const dt = 1 / Math.max(cps, 1);
  const idleAfter = opts.idleAfter ?? Infinity;
  const maxT = opts.maxT ?? 120 * 60;
  const rng = seeded(opts.seed ?? 12345 + run);
  const s = G.createState(meta ?? {});
  for (const b of G.BOARD) G.buyBoard(s, b.id);
  for (const id of PERK_ORDER) G.buyPerk(s, id);
  if (G.mods(s).autoHire) s.autoHire = true;
  const res: CompanyResult = { state: s, next: null, soldAt: null, kind: null, gain: 0, purchases: [], clickLoc: 0, teamLoc: 0 };
  let nextDecide = 0;
  while (s.t < maxT) {
    if (s.t < idleAfter && cps > 0) {
      if (s.incident) G.hotfix(s);
      else res.clickLoc += G.click(s);
      if (s.viral) G.claimViral(s);
      if (s.bugs.length && rng() < 0.5) G.squash(s, s.bugs[0].id);
      if (s.decision) G.decide(s, rng() < 0.5 ? 'a' : 'b');
    } else if (s.viral && rng() < 0.05) G.claimViral(s);
    if (s.t >= nextDecide) { decide(s, res, run, rng); nextDecide += 1; }
    G.tick(s, dt, rng);
    res.teamLoc += G.rates(s).feature * dt;
    s.events.length = 0;
    // sell on a plateau: the market is full and the next one is more than 3 minutes of income away
    const stuck = G.marketFull(s) && G.marketCost(s) > s.money + G.mrr(s) * 180;
    if ((G.canIpo(s) || G.valuation(s) >= G.exitNeed(s)) && (stuck || s.t > 60 * 60)) {
      res.soldAt = s.t;
      if (G.canIpo(s)) { res.kind = 'ipo'; res.gain = G.sharesGain(s); res.next = G.ipo(s); }
      else { res.kind = 'sale'; res.gain = G.fpGain(s); res.next = G.exit(s); }
      return res;
    }
  }
  return res;
}

/** Play several companies in a row, carrying perks, Founder Points and Shares forward. */
export function campaign(runs: number, opts: BotOptions = {}): CompanyResult[] {
  const out: CompanyResult[] = [];
  let meta: Meta | null = null;
  for (let run = 1; run <= runs; run++) {
    const r = playCompany(meta, run, opts);
    out.push(r);
    if (!r.next) break;
    meta = r.next;
  }
  return out;
}

/** Largest gap between purchases (contracts excluded) in a time window, in seconds. */
export function maxGap(purchases: Purchase[], from: number, to: number): number {
  const ts = purchases.filter((p) => p.name !== 'contract' && p.t >= from && p.t < to).map((p) => p.t);
  let gap = 0;
  for (let i = 1; i < ts.length; i++) gap = Math.max(gap, ts[i] - ts[i - 1]);
  return gap;
}
