// Game rules: modifiers, derived values, actions and the simulation step.
import type { Contract, Cost, Feature, FeatureState, GameState, Goal, LogKind, Meta, Mods, Rates, Reward, Rng, RoleDef, TalentHire, Upgrade } from './types.ts';
import {
  ACHIEVEMENTS, BOARD, CHALLENGES, CLIENTS, CONTRACT_PAY, DECISIONS, ENGINEERS, EXIT_VALUATION, FEATURES, GOALS, IPO_VALUATION,
  JOBS, LAUNCH_SECONDS, MARKETS, MAX_TALENTS, MIN_SHIP, MRR_PER_LOC, OFFICES, PERKS, RARITY, ROLES, SUPPORT, SUPPORT_GROWTH, GROWTH,
  TALENTS, TALENT_NAMES, UPGRADES, VALUATION_MULT,
} from './content.ts';
import { fmt } from './format.ts';

// ---------- modifiers ----------
export function baseMods(): Mods {
  const out: Record<string, number> = {}, bug: Record<string, number> = {}, cost: Record<string, number> = {};
  for (const d of ROLES) { out[d.id] = 1; bug[d.id] = 1; cost[d.id] = 1; }
  return {
    out, bug, cost, syn: [] as Mods['syn'],
    allOut: 1, allBug: 1, allCost: 1, brooks: 1,
    click: 1, clickPct: 0.01, flowCap: 2, flowGain: 7, flowDecay: 30, flowTeam: 0,
    mrr: 1, perLoc: 1, rep: 1, cap: 1, debtHurt: 1,
    pay: 1, contractRep: 1, slots: 2, contractTime: 1, integrations: false,
    refactor: 0.5, deploy: 12, incident: 1, incDur: 60, hotfix: 8, postmortem: false,
    viralEvery: 1, viralBoost: 2, seats: 1, autoShip: false,
    featureCost: 1, expandCost: 1, fpGain: 1, prestige: 1,
    bugReward: 1, decisionPay: 1,
    autoDeliver: false, autoRefactor: false, autoUpgrade: false, autoBug: false, autoHire: false,
  };
}
const modsCache = new WeakMap<GameState, { key: number; m: Mods }>();
export function mods(s: GameState): Mods {
  const key = s.rev;
  const hit = modsCache.get(s);
  if (hit && hit.key === key) return hit.m;
  const m = baseMods();
  for (const u of UPGRADES) if (s.done[u.id]) u.fx(m);
  for (const f of FEATURES) if (s.features[f.id]) f.fx(m);
  for (const p of PERKS) if (s.perks[p.id] && p.fx) p.fx(m);
  for (const d of SUPPORT) if (s.staff[d.id]) d.fx(m, s.staff[d.id]);
  for (const c of CHALLENGES) if (s.chDone[c.id]) c.win(m);
  for (const b of BOARD) if (s.board[b.id] && b.fx) b.fx(m);
  for (const t of s.talents) talentDef(t.kind).fx(m);
  if (s.challenge) challengeDef(s.challenge).fx(m);
  if (s.perks.autohire) m.autoHire = true;
  const ach = Object.keys(s.ach).length;
  // unspent Founder Points: +10% each; achievements: +1% each
  m.prestige = (1 + 0.1 * s.fp) * (1 + 0.01 * ach) * (1 + (s.board.dualclass ? 0.5 : 0.25) * s.shares);
  modsCache.set(s, { key, m });
  return m;
}
export const touch = (s: GameState) => { s.rev++; };

// ---------- derived values ----------
export const headcount = (s: GameState) => ROLES.reduce((a, d) => a + s.staff[d.id], 0) + s.talents.length;
export const seats = (s: GameState) => Math.floor(OFFICES[s.office].seats * mods(s).seats);
export const role = (id: string): RoleDef => ROLES.find((d) => d.id === id)!;
export const challengeDef = (id: string) => CHALLENGES.find((c) => c.id === id)!;
export const decisionDef = (id: string) => DECISIONS.find((d) => d.id === id)!;
export const isSupport = (d: RoleDef) => !d.out;
export const unitCost = (s: GameState, d: RoleDef, owned: number) => d.cost * mods(s).cost[d.id] * mods(s).allCost * Math.pow(isSupport(d) ? SUPPORT_GROWTH : GROWTH, owned);
export const staffCost = (s: GameState, id: string) => unitCost(s, role(id), s.staff[id]);
// How many of a role you can hire now (limited by money and seats), and what they cost.
export function bulk(s: GameState, id: string, want: number | 'max') {
  const d = role(id);
  const free = Math.max(0, seats(s) - headcount(s));
  const limit = want === 'max' ? free : Math.min(want, free);
  let n = 0, total = 0;
  while (n < limit) {
    const c = unitCost(s, d, s.staff[id] + n);
    if (total + c > s.money && want === 'max') break;
    total += c; n++;
  }
  return { n, total };
}
export const debtPct = (s: GameState) => s.debt / Math.max(s.written, 100);
export const quality = (s: GameState) => Math.min(1, Math.max(0.1, 1 - debtPct(s) * 1.5 * mods(s).debtHurt));
export const flowMult = (s: GameState) => 1 + (s.flow / 100) * (mods(s).flowCap - 1);
// Brooks's law: a bigger team makes more coordination bugs.
export const teamBug = (s: GameState) => 1 + (headcount(s) / 40) * mods(s).brooks;
export const staffBug = (s: GameState, d: RoleDef) => (d.bug ?? 0) * mods(s).bug[d.id] * mods(s).allBug * teamBug(s);
export const cap = (s: GameState) => MARKETS[s.market].cap * mods(s).cap;

// Short-lived effects from decisions (crunch, audits...).
export function tempMult(s: GameState, k: string) {
  let v = 1;
  for (const e of s.temp) if (e.k === k && e.until > s.t) v *= e.v;
  return v;
}
export function addTemp(s: GameState, k: string, v: number, sec: number) { s.temp.push({ k, v, until: s.t + sec }); }

export function rates(s: GameState): Rates {
  const m = mods(s);
  let team = 0, bug = 0;
  const byRole: Record<string, number> = {};
  const flowBoost = 1 + m.flowTeam * s.flow / 100;
  for (const d of ENGINEERS) {
    const n = s.staff[d.id];
    if (!n) continue;
    let mult = m.out[d.id] * m.allOut * m.prestige * flowBoost;
    for (const [from, to, per] of m.syn) if (to === d.id) mult *= 1 + per * s.staff[from];
    const out = n * d.out * mult;
    byRole[d.id] = out;
    team += out;
    bug += out * staffBug(s, d);
  }
  const tOut = tempMult(s, 'out');
  team *= tOut;
  bug *= tOut * tempMult(s, 'bug');
  const write = 1 - s.refactor;
  for (const k in byRole) byRole[k] *= tOut;
  return { team, feature: team * write, bug: bug * write, refactor: team * s.refactor * m.refactor, byRole };
}
export const saturation = (s: GameState) => 1 - Math.exp(-s.mrrRaw / cap(s));
// MRR before temporary event effects. Saturates at the market cap.
// Market size is a hard ceiling: release-income upgrades fill the market faster, they never lift it.
export const baseMrr = (s: GameState) => cap(s) * saturation(s) * quality(s) * mods(s).prestige * s.dilution;
export const mrr = (s: GameState) => baseMrr(s) * (s.incident ? 0.5 : 1) * (s.t < s.boostUntil ? s.boostMult : 1);
// MRR the current build would add if shipped now (after market saturation and debt).
export function shipGain(s: GameState) {
  const add = s.loc * MRR_PER_LOC * mods(s).perLoc * mods(s).mrr;
  const c = cap(s);
  return c * (Math.exp(-s.mrrRaw / c) - Math.exp(-(s.mrrRaw + add) / c)) * quality(s) * mods(s).prestige * s.dilution;
}
// Release-day sales: 90 seconds of the income this release adds, so they shrink as the market fills up.
export const launchPay = (s: GameState) => shipGain(s) * LAUNCH_SECONDS;
export const shipRep = (s: GameState) => 0.4 * Math.sqrt(s.loc) * quality(s) * mods(s).rep;
export const clickValue = (s: GameState) => (1 + mods(s).clickPct * rates(s).team) * flowMult(s) * mods(s).click * mods(s).prestige;
export const valuation = (s: GameState) => baseMrr(s) * VALUATION_MULT;
// Buyers expect more from a serial founder: each sale needs a 10× bigger valuation.
export const exitNeed = (s: GameState) => EXIT_VALUATION * Math.pow(10, s.exits);
// Founder Points grow with the cube root of everything you have ever sold, so each sale adds a bit less.
export const fpTotalFor = (sold: number) => Math.floor(2 * Math.cbrt(sold / 1e8));
export const fpGain = (s: GameState) => Math.floor(Math.max(0, fpTotalFor(s.soldTotal + valuation(s)) - fpTotalFor(s.soldTotal)) * mods(s).fpGain);
// No risk below 8% debt, and the first 5 releases are always safe.
export const incidentChance = (s: GameState) => (s.stats.ships < 5 ? 0 : Math.min(0.8, Math.max(0, debtPct(s) - 0.08) * 1.6) * mods(s).incident * tempMult(s, 'incident'));
export const versionStr = (s: GameState) => `v${s.version[0]}.${s.version[1]}`;
export const deployTime = (s: GameState) => mods(s).deploy;
export const officeCost = (s: GameState) => { const o = OFFICES[s.office + 1]; return o ? o.cost * mods(s).expandCost : Infinity; };
export const marketCost = (s: GameState) => { const k = MARKETS[s.market + 1]; return k ? k.cost * mods(s).expandCost : Infinity; };
export const featureCost = (s: GameState, f: Feature) => f.cost * mods(s).featureCost;
// The current market is nearly full and the next one is unlocked: time to save up for it.
export const marketFull = (s: GameState) => saturation(s) > 0.85 && !!MARKETS[s.market + 1] && s.rep >= MARKETS[s.market + 1].rep;

// ---------- state ----------
export function createState(meta: Meta = {}): GameState {
  const staff: Record<string, number> = {};
  for (const d of ROLES) staff[d.id] = 0;
  const perks = Object.assign({}, meta.perks);
  const s: GameState = {
    v: 2, t: 0, rev: 0,
    loc: 0, money: 0, rep: 0, debt: 0, written: 0, mrrRaw: 0,
    flow: 0, lastClick: -99,
    staff, office: 0, market: 0, done: {}, seen: {}, features: {},
    refactor: 0, autoShip: false, autoShipDebt: 0.2, autoHire: false,
    deployLeft: 0, contracts: [], nextContract: 0, contractSeq: 0,
    incident: null, viral: null, boostUntil: 0, boostMult: 2, nextViral: 0,
    revealed: Object.assign({}, meta.revealed),
    feed: meta.feed || [],
    stats: { clicks: 0, ships: 0, contracts: 0, incidents: 0, virals: 0, runMoney: 0, bugs: 0, bugsEscaped: 0, decisions: 0 },
    flags: { cleanShip: false, yolo: false, speedrun: !!(meta.flags && meta.flags.speedrun), duck: !!(meta.flags && meta.flags.duck) },
    life: Object.assign({ clicks: 0, ships: 0, contracts: 0, hotfixes: 0, money: 0, bugs: 0, decisions: 0 }, meta.life),
    version: [0, 0],
    fp: meta.fp || 0, fpTotal: meta.fpTotal || 0, exits: meta.exits || 0, soldTotal: meta.soldTotal || 0,
    perks, ach: Object.assign({}, meta.ach),
    goal: 0, goalsDone: {}, bugs: [], bugSeq: 0, nextBug: 0, decision: null, nextDecision: 0, temp: [], dilution: 1,
    autoDeliver: true, autoRefactor: true, refactorTarget: 0.1, autoUpgrade: true, autoBug: true,
    challenge: meta.challenge || null, chDone: Object.assign({}, meta.chDone),
    talents: (meta.talents || []).slice(), talentPool: [], nextTalents: 0, talentSeq: meta.talentSeq || 0,
    shares: meta.shares || 0, sharesTotal: meta.sharesTotal || 0, ipos: meta.ipos || 0, ipoTotal: meta.ipoTotal || 0, board: Object.assign({}, meta.board),
    events: [], // transient: UI reads and clears
  };
  for (const id of meta.keep || []) s.done[id] = true;
  for (const id in perks) startBonus(s, id);
  for (const id in s.board) startBonus(s, id);
  if (s.challenge === 'legacy') { s.written = 1000; s.debt = 400; }
  return s;
}

// Head starts from perks and Board Room seats: applied to every new company, and right away when bought.
export function startBonus(s: GameState, id: string) {
  if (id === 'serial') { s.money += 500; s.office = Math.max(s.office, 1); }
  if (id === 'network') s.rep += 100;
  if (id === 'angel') s.money += 25000;
  if (id === 'autodeploy') s.done.cicd = true;
  if (id === 'botarmy') { s.done.zapier = true; s.done.refactorbot = true; }
  if (id === 'alumni') { s.staff.junior += 6; s.staff.senior += 2; s.office = Math.max(s.office, 2); }
  if (id === 'household') { s.rep += 2000; s.market = Math.max(s.market, 1); }
  if (id === 'venture') s.money += 1e6;
  if (id === 'suite') { for (const u of UPGRADES) if (u.cat === 'automation') s.done[u.id] = true; s.done.cicd = true; }
  s.rev++;
}

export function log(s: GameState, text: string, kind: LogKind = 'info') {
  s.feed.unshift({ t: s.t, text, kind: kind || 'info' });
  if (s.feed.length > 60) s.feed.pop();
  s.events.push({ text, kind: kind || 'info' });
}
export function reveal(s: GameState, key: string, msg: string | null) {
  if (s.revealed[key]) return;
  s.revealed[key] = true;
  if (msg) log(s, msg, 'reveal');
}

// ---------- actions ----------
export function click(s: GameState) {
  const m = mods(s);
  const v = clickValue(s);
  s.flow = Math.min(100, s.flow + m.flowGain);
  s.lastClick = s.t;
  s.loc += v;
  s.written += v;
  s.debt += v * 0.05 * m.allBug;
  s.stats.clicks++;
  s.life.clicks++;
  return v;
}

export const canShip = (s: GameState) => !!s.revealed.ship && s.loc >= MIN_SHIP && s.deployLeft <= 0;
export function ship(s: GameState, rng: Rng) {
  if (!canShip(s)) return false;
  const lines = s.loc;
  const repGain = shipRep(s);
  const sales = launchPay(s);
  const d = debtPct(s);
  if (lines >= 1000 && d < 0.02) s.flags.cleanShip = true;
  if (d >= 0.4) s.flags.yolo = true;
  s.mrrRaw += lines * MRR_PER_LOC * mods(s).perLoc * mods(s).mrr;
  s.rep += repGain;
  s.money += sales;
  s.stats.runMoney += sales;
  s.life.money += sales;
  s.loc = 0;
  s.deployLeft = deployTime(s);
  s.version[1]++;
  if (s.version[1] >= 10) { s.version[0]++; s.version[1] = 0; }
  s.stats.ships++;
  s.life.ships++;
  reveal(s, 'rep', null);
  log(s, `${versionStr(s)} shipped: ${fmt(lines)} lines, +$${fmt(sales)} launch sales, +${fmt(repGain)} Rep`, 'ship');
  if (s.stats.ships === 1) s.nextViral = s.t + 90;
  if (!s.incident && rng() < incidentChance(s)) startIncident(s, 'The new release broke checkout.');
  reveal(s, 'money', null);
  return true;
}

export function startIncident(s: GameState, why: string) {
  s.incident = { t: 0, left: Math.max(3, Math.round(mods(s).hotfix)), why };
  s.stats.incidents++;
  if (!mods(s).postmortem) s.rep = Math.max(0, s.rep * 0.97);
  reveal(s, 'debt', null);
  log(s, `Incident: ${why} Income halved until fixed.`, 'bad');
}
export function endIncident(s: GameState, byHand: boolean) {
  s.incident = null;
  if (mods(s).postmortem) { const g = Math.max(5, s.rep * 0.02); s.rep += g; log(s, `Postmortem written: +${fmt(g)} Rep.`, 'good'); }
  if (byHand) { s.life.hotfixes++; log(s, 'Hotfix deployed. Income is back to normal.', 'good'); }
  else log(s, 'The incident faded out.', 'info');
}
export function hotfix(s: GameState) {
  if (!s.incident) return false;
  s.incident.left--;
  s.stats.clicks++;
  s.life.clicks++;
  if (s.incident.left <= 0) endIncident(s, true);
  return true;
}

export function claimViral(s: GameState) {
  if (!s.viral) return false;
  s.viral = null;
  s.boostMult = mods(s).viralBoost;
  s.boostUntil = s.t + 30;
  s.stats.virals++;
  const gain = Math.max(10, s.rep * 0.1);
  s.rep += gain;
  log(s, `You are trending! Income ×${s.boostMult} for 30 s, +${fmt(gain)} Rep.`, 'good');
  return true;
}

export const roleUnlocked = (s: GameState, d: RoleDef) => s.rep >= d.rep && (!d.needs || !!s.done[d.needs]);
export function hire(s: GameState, id: string, want: number | 'max' = 1) {
  const d = role(id);
  if (!d || !roleUnlocked(s, d) || s.challenge === 'solo') return 0;
  const { n, total } = bulk(s, id, want || 1);
  if (!n || total > s.money) return 0;
  s.money -= total;
  const first = s.staff[id] === 0;
  s.staff[id] += n;
  touch(s);
  if (first) log(s, `Hired your first ${d.name}.`, 'good');
  return n;
}

// Promote an engineer to the next unlocked level for that level's full hiring cost: the same price as a new hire, without needing a seat.
export function nextLevel(s: GameState, id: string) {
  const i = ENGINEERS.findIndex((d) => d.id === id);
  const nx = i >= 0 ? ENGINEERS[i + 1] : null;
  return nx && !nx.needs && roleUnlocked(s, nx) ? nx : null;
}
export const promoteCost = (s: GameState, id: string) => { const nx = nextLevel(s, id); return nx ? staffCost(s, nx.id) : Infinity; };
export function promote(s: GameState, id: string) {
  const nx = nextLevel(s, id);
  if (!nx || s.staff[id] < 1 || s.money < promoteCost(s, id)) return false;
  s.money -= promoteCost(s, id);
  s.staff[id]--;
  s.staff[nx.id]++;
  touch(s);
  return true;
}
export function letGo(s: GameState, id: string) {
  if (!s.staff[id]) return false;
  s.staff[id]--;
  touch(s);
  return true;
}

export function moveOffice(s: GameState) {
  const o = OFFICES[s.office + 1];
  if (!o || s.money < officeCost(s) || s.rep < o.rep) return false;
  s.money -= officeCost(s);
  s.office++;
  touch(s);
  log(s, `Moved to a ${o.name}: ${seats(s)} seats.`, 'good');
  return true;
}

export function buyMarket(s: GameState) {
  const k = MARKETS[s.market + 1];
  if (!k || s.money < marketCost(s) || s.rep < k.rep) return false;
  // keep current income: rescale raw so the saturation curve continues smoothly
  const now = cap(s) * saturation(s);
  s.money -= marketCost(s);
  s.market++;
  touch(s);
  s.mrrRaw = -cap(s) * Math.log(1 - Math.min(0.999999, now / cap(s)));
  log(s, `Launched ${k.name}. Market size: $${fmt(cap(s))}/s.`, 'good');
  return true;
}

export function upgradeVisible(s: GameState, u: Upgrade) {
  if (s.done[u.id]) return false;
  if (s.challenge === 'cowboy' && u.cat === 'process') return false;
  if (s.seen[u.id]) return true;
  if (u.show(s) && withinReach(s, u.cost)) { s.seen[u.id] = true; reveal(s, 'upgrades', 'New upgrades available.'); return true; }
  return false;
}
// Show an upgrade only once it is within a few minutes of income, so the list never fills with far-off items.
export function withinReach(s: GameState, cost: Cost) {
  if (cost.money) return s.money * 3 + mrr(s) * 180 >= cost.money;
  return s.loc * 3 + rates(s).feature * 180 + 60 >= (cost.loc ?? 0);
}
export const canAfford = (s: GameState, cost: Cost) => (!cost.money || s.money >= cost.money) && (!cost.loc || s.loc >= cost.loc);
export function buyUpgrade(s: GameState, id: string) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || !upgradeVisible(s, u) || !canAfford(s, u.cost)) return false;
  if (u.cost.money) s.money -= u.cost.money;
  if (u.cost.loc) s.loc -= u.cost.loc;
  s.done[id] = true;
  touch(s);
  log(s, `Upgrade: ${u.name}.`, 'good');
  return true;
}

// 'done' | 'open' | 'locked' (needs other features) | 'blocked' (the other option of a pair was chosen)
export function featureState(s: GameState, f: Feature): FeatureState {
  if (s.features[f.id]) return 'done';
  if (f.fork && FEATURES.some((x) => x.fork === f.fork && x.id !== f.id && s.features[x.id])) return 'blocked';
  if ((f.req || []).some((r: string) => !s.features[r])) return 'locked';
  return 'open';
}
export function buyFeature(s: GameState, id: string) {
  const f = FEATURES.find((x) => x.id === id);
  if (!f || featureState(s, f) !== 'open' || s.loc < featureCost(s, f)) return false;
  s.loc -= featureCost(s, f);
  s.features[id] = true;
  touch(s);
  log(s, `Feature built: ${f.name}.`, 'ship');
  return true;
}

export function buyPerk(s: GameState, id: string) {
  const p = PERKS.find((x) => x.id === id);
  if (!p || s.perks[id] || s.fp < p.cost) return false;
  s.fp -= p.cost;
  s.perks[id] = true;
  startBonus(s, id);
  touch(s);
  log(s, `Founder perk: ${p.name}.`, 'reveal');
  return true;
}

// Talents
export const talentDef = (kind: string) => TALENTS.find((x) => x.id === kind)!;
export const talentCost = (s: GameState, c: TalentHire) => { const r = RARITY[talentDef(c.kind).rarity]; return Math.max(r.min, mrr(s) * r.pay); };
export function rollTalents(s: GameState, rng: Rng) {
  s.talentPool = [];
  for (let i = 0; i < 3; i++) {
    let roll = rng() * 100, rarity = 'common';
    for (const k of ['legendary', 'rare', 'common'] as const) { if (roll < RARITY[k].weight) { rarity = k; break; } roll -= RARITY[k].weight; }
    const pool = TALENTS.filter((t) => t.rarity === rarity && !s.talents.some((h) => h.kind === t.id) && !s.talentPool.some((p) => p.kind === t.id));
    if (!pool.length) continue;
    const kind = pool[Math.floor(rng() * pool.length)].id;
    s.talentSeq++;
    s.talentPool.push({ id: s.talentSeq, kind, name: `${TALENT_NAMES[Math.floor(rng() * TALENT_NAMES.length)]} ${String.fromCharCode(65 + Math.floor(rng() * 26))}.` });
  }
}
export function hireTalent(s: GameState, id: number) {
  const c = s.talentPool.find((x) => x.id === id);
  if (!c || s.talents.length >= MAX_TALENTS || headcount(s) >= seats(s) || s.challenge === 'solo') return false;
  const cost = talentCost(s, c);
  if (s.money < cost) return false;
  s.money -= cost;
  s.talents.push(c);
  s.talentPool = s.talentPool.filter((x) => x.id !== id);
  touch(s);
  log(s, `Hired ${c.name}, ${talentDef(c.kind).title}.`, 'reveal');
  return true;
}
export function releaseTalent(s: GameState, id: number) {
  const before = s.talents.length;
  s.talents = s.talents.filter((t) => t.id !== id);
  if (s.talents.length !== before) touch(s);
  return s.talents.length !== before;
}

export function squash(s: GameState, id: number) {
  const i = s.bugs.findIndex((b) => b.id === id);
  if (i < 0) return 0;
  s.bugs.splice(i, 1);
  const pay = Math.max(3, mrr(s) * 3) * mods(s).bugReward;
  s.money += pay;
  s.stats.runMoney += pay;
  // a small cleanup; the real win is that it no longer escapes into the codebase
  s.debt = Math.max(0, s.debt - Math.max(1, s.written * 0.0015));
  s.stats.bugs++;
  s.life.bugs++;
  return pay;
}

export function decide(s: GameState, choice: 'a' | 'b') {
  if (!s.decision) return false;
  const d = decisionDef(s.decision.id);
  const opt = choice === 'a' ? d.a : d.b;
  opt[2](s);
  s.decision = null;
  s.stats.decisions++;
  s.life.decisions++;
  log(s, `${d.title} ${opt[0]}.`, 'info');
  return true;
}

// Abandon this company (no Founder Points) and start a new one under a challenge rule.
export function startChallenge(s: GameState, id: string) {
  if (!CHALLENGES.some((c) => c.id === id) || s.chDone[id]) return null;
  const n = createState(carry(s, { challenge: id }));
  log(n, `Challenge started: ${challengeDef(id).name}.`, 'reveal');
  return n;
}

export const contractOk = (s: GameState, c: Contract) => s.loc >= c.size && (c.maxDebt == null || debtPct(s) <= c.maxDebt);
export function deliver(s: GameState, cid: number) {
  const i = s.contracts.findIndex((c) => c.id === cid);
  if (i < 0 || !contractOk(s, s.contracts[i])) return false;
  const c = s.contracts[i];
  const friends = s.perks.friends && s.stats.contracts < 3 ? 5 : 1;
  const pay = c.pay * friends;
  s.loc -= c.size;
  s.money += pay;
  s.rep += c.rep;
  s.stats.runMoney += pay;
  s.life.money += pay;
  s.stats.contracts++;
  s.life.contracts++;
  s.contracts.splice(i, 1);
  reveal(s, 'money', null);
  log(s, `Delivered ${c.job} for ${c.client}: +$${fmt(pay)}.`, 'good');
  return true;
}
export function newContract(s: GameState, rng: Rng) {
  const m = mods(s);
  const speed = rates(s).feature + 3;
  const integ = m.integrations && rng() < 0.35;
  const size = Math.max(20, Math.round(speed * (35 + rng() * 50) * (integ ? 2.5 : 1)));
  const roll = rng();
  const maxDebt = s.revealed.debt ? (roll < 0.35 ? null : roll < 0.7 ? 0.25 : 0.12) : null;
  const bonus = (maxDebt == null ? 1 : maxDebt > 0.2 ? 1.4 : 2) * (integ ? 2 : 1);
  s.contractSeq++;
  s.contracts.push({
    id: s.contractSeq,
    client: CLIENTS[Math.floor(rng() * CLIENTS.length)],
    job: integ ? 'API integration' : JOBS[Math.floor(rng() * JOBS.length)],
    size, maxDebt,
    // never more than 60 s of your whole market's size, after all bonuses: client work cannot outgrow the market
    pay: Math.min(size * CONTRACT_PAY * bonus * m.pay, cap(s) * 60) * m.prestige,
    rep: Math.round(Math.sqrt(size) * 0.3 * bonus * m.contractRep),
    expires: s.t + 180 * m.contractTime,
    life: 180 * m.contractTime,
  });
}

export function setRefactor(s: GameState, v: number) { s.refactor = Math.min(0.9, Math.max(0, v)); }

// Everything that survives a reset. Each reset overrides only what it changes.
export function carry(s: GameState, over: Meta): Meta {
  return Object.assign({
    fp: s.fp, fpTotal: s.fpTotal, exits: s.exits, soldTotal: s.soldTotal, perks: s.perks, talents: s.talents, talentSeq: s.talentSeq,
    ach: s.ach, life: s.life, flags: s.flags, revealed: s.revealed, feed: s.feed, chDone: s.chDone,
    shares: s.shares, sharesTotal: s.sharesTotal, ipos: s.ipos, ipoTotal: s.ipoTotal, board: s.board,
  }, over);
}

export const sharesFor = (v: number) => Math.floor(Math.sqrt(v / 2e9));
export const canIpo = (s: GameState) => s.exits >= 3 && valuation(s) >= IPO_VALUATION && !s.challenge;
export const sharesGain = (s: GameState) => Math.max(0, sharesFor(s.ipoTotal + valuation(s)) - sharesFor(s.ipoTotal));
// Go public: resets companies, Founder Points and perks; Shares buy permanent Board Room seats.
export function ipo(s: GameState) {
  if (!canIpo(s)) return null;
  const gain = sharesGain(s);
  const keepPerks: Record<string, boolean> = {};
  if (s.board.memory) for (const p of PERKS) if (s.perks[p.id] && p.cost <= 2) keepPerks[p.id] = true;
  const n = createState(carry(s, {
    fp: 0, fpTotal: 0, exits: 0, soldTotal: 0, perks: keepPerks, talents: [],
    shares: s.shares + gain, sharesTotal: s.sharesTotal + gain, ipos: s.ipos + 1, ipoTotal: s.ipoTotal + valuation(s),
  }));
  log(n, `IPO! Your company went public at $${fmt(valuation(s))}. +${gain} Shares.`, 'reveal');
  n.revealed.board = true;
  checkAchievements(n);
  return n;
}
export function buyBoard(s: GameState, id: string) {
  const b = BOARD.find((x) => x.id === id);
  if (!b || s.board[id] || s.shares < b.cost) return false;
  s.shares -= b.cost;
  s.board[id] = true;
  startBonus(s, id);
  touch(s);
  log(s, `Board Room: ${b.name}.`, 'reveal');
  return true;
}

export function exit(s: GameState) {
  if (valuation(s) < exitNeed(s)) return null;
  const gain = fpGain(s);
  const keep = UPGRADES.filter((u) => s.done[u.id] && ((s.perks.playbook && u.cat === 'tools') || (s.perks.veteran && u.cat === 'process'))).map((u) => u.id);
  const flags = { speedrun: s.flags.speedrun || s.t <= 1200, duck: s.flags.duck };
  const n = createState(carry(s, { fp: s.fp + gain, fpTotal: s.fpTotal + gain, exits: s.exits + 1, soldTotal: s.soldTotal + valuation(s), flags, keep }));
  log(n, `Sold the company for $${fmt(valuation(s))}. +${gain} Founder Points.`, 'reveal');
  n.revealed.founder = true;
  checkAchievements(n);
  return n;
}

export function checkAchievements(s: GameState) {
  for (const a of ACHIEVEMENTS) {
    if (!s.ach[a.id] && a.check(s)) { s.ach[a.id] = true; touch(s); reveal(s, 'achievements', null); log(s, `Achievement: ${a.name}${/[.!?]$/.test(a.name) ? '' : '.'}`, 'reveal'); }
  }
}

// Best engineer to hire by clean output per dollar (used by Auto-Recruiter and the sim bot).
export function bestEngineer(s: GameState) {
  let best = null, score = 0;
  for (const d of ENGINEERS) {
    if (!roleUnlocked(s, d)) continue;
    const sc = (d.out * mods(s).out[d.id] * (1 - Math.min(0.9, staffBug(s, d)))) / staffCost(s, d.id);
    if (sc > score) { score = sc; best = d; }
  }
  return best;
}

// ---------- simulation step ----------
// opts.offline: catch-up while the player was away; skips bugs, decisions, trending and random incidents.
export function tick(s: GameState, dt: number, rng: Rng, opts?: { offline?: boolean }) {
  const away = !!(opts && opts.offline);
  const m = mods(s);
  s.t += dt;
  if (s.t - s.lastClick > 0.5) s.flow = Math.max(0, s.flow - m.flowDecay * dt);

  const r = rates(s);
  s.loc += r.feature * dt;
  s.written += r.feature * dt;
  s.debt = Math.max(0, s.debt + (r.bug - r.refactor) * dt);
  const inc = mrr(s) * dt;
  s.money += inc;
  s.stats.runMoney += inc;
  s.life.money += inc;
  if (s.deployLeft > 0) s.deployLeft -= dt;

  // contracts
  s.contracts = s.contracts.filter((c) => c.expires > s.t);
  if (s.revealed.contracts && s.challenge !== 'bootstrap' && s.contracts.length < m.slots && s.t >= s.nextContract) {
    newContract(s, rng);
    s.nextContract = s.t + (s.contracts.length < m.slots ? 20 : 45);
  }

  // incidents
  if (s.incident) {
    s.incident.t += dt;
    if (s.incident.t >= m.incDur) endIncident(s, false);
  } else if (!away && s.stats.ships > 5 && rng() < Math.max(0, debtPct(s) - 0.08) * 0.004 * dt * m.incident) {
    startIncident(s, 'Old bugs took the site down.');
  }

  // trending
  if (s.viral && s.t > s.viral.until) s.viral = null;
  if (!away && !s.viral && s.stats.ships >= 3 && s.nextViral && s.t >= s.nextViral) {
    s.viral = { until: s.t + 12 };
    s.nextViral = s.t + (150 + rng() * 150) * m.viralEvery;
  }

  // bugs crawl in more often when debt is high; escaped bugs add debt
  for (let i = s.bugs.length - 1; i >= 0; i--) {
    if (s.t - s.bugs[i].born > 15) { s.bugs.splice(i, 1); s.debt += Math.max(3, s.written * 0.002); s.stats.bugsEscaped++; }
  }
  if (away) s.bugs.length = 0;
  if (!away && s.revealed.debt && s.bugs.length < 3 && s.t >= s.nextBug) {
    if (s.nextBug) { s.bugSeq++; s.bugs.push({ id: s.bugSeq, born: s.t, x: rng(), y: rng() }); }
    s.nextBug = s.t + (20 + rng() * 20) / (0.4 + debtPct(s) * 8);
  }

  // decisions
  if (s.decision && s.t > s.decision.until) { log(s, `You ignored: ${decisionDef(s.decision.id).title}`, 'info'); s.decision = null; }
  if (away) s.decision = null;
  if (!away && !s.decision && s.stats.ships >= 8) {
    if (!s.nextDecision) s.nextDecision = s.t + 60;
    else if (s.t >= s.nextDecision) {
      const pool = DECISIONS.filter((d) => !d.when || d.when(s));
      s.decision = { id: pool[Math.floor(rng() * pool.length)].id, until: s.t + 30 };
      s.nextDecision = s.t + 180 + rng() * 120;
    }
  }
  s.temp = s.temp.filter((e) => e.until > s.t);

  // goals: up to 3 are open at once and can be finished in any order
  for (const g of openGoals(s)) {
    const [cur, target] = g.prog(s);
    if (cur >= target) {
      const r = g.reward(s);
      if (r.money) { s.money += r.money; s.stats.runMoney += r.money; }
      if (r.loc) s.loc += r.loc;
      if (r.rep) s.rep += r.rep;
      s.goalsDone[g.i] = true;
      s.goal++;
      log(s, `Done: ${g.text}. Reward: ${goalRewardText(r)}.`, 'goal');
    }
  }

  // challenge complete
  if (s.challenge && valuation(s) >= challengeDef(s.challenge).goal) {
    const c = challengeDef(s.challenge);
    s.chDone[c.id] = true;
    s.challenge = null;
    touch(s);
    log(s, `Challenge complete: ${c.name}! ${c.reward}`, 'reveal');
  }

  // automation
  if (m.autoShip && s.autoShip && canShip(s) && debtPct(s) <= s.autoShipDebt && s.loc >= Math.max(MIN_SHIP, r.feature * 10)) ship(s, rng);
  if (m.autoHire && s.autoHire) { const b = bestEngineer(s); if (b) hire(s, b.id, 1); }
  s.autoTimer = (s.autoTimer || 0) + dt;
  if (s.autoTimer >= 1) {
    s.autoTimer = 0;
    if (m.autoDeliver && s.autoDeliver) for (const c of [...s.contracts]) deliver(s, c.id);
    if (m.autoUpgrade && s.autoUpgrade) {
      for (const u of UPGRADES) if (upgradeVisible(s, u) && (u.cost.money ? u.cost.money <= s.money * 0.1 : (u.cost.loc ?? 0) <= s.loc * 0.1)) buyUpgrade(s, u.id);
    }
    if (m.autoRefactor && s.autoRefactor) {
      const d = debtPct(s);
      if (d > s.refactorTarget + 0.01) setRefactor(s, s.refactor + 0.05);
      else if (d < s.refactorTarget - 0.01) setRefactor(s, s.refactor - 0.05);
    }
  }
  if (m.autoBug && s.autoBug) for (const b of [...s.bugs]) if (s.t - b.born > 8) squash(s, b.id);

  // progressive reveal
  if (s.written >= 10) reveal(s, 'contracts', 'A client wants a small job done. Open clients.ts.');
  if (s.stats.contracts >= 2 || s.written >= 200) reveal(s, 'ship', 'Idea: build your own product. Press ▶ Ship to release your code.');
  if (s.stats.ships >= 1) reveal(s, 'money', null);
  if (s.revealed.money && s.money >= 15) reveal(s, 'team', 'You can hire people now. Open team.ts.');
  if (s.stats.ships >= 2) reveal(s, 'product', 'Your product can grow new features. Open features.ts.');
  if (s.written >= 60 && debtPct(s) >= 0.06) reveal(s, 'debt', 'Your code has bugs now. That is tech debt. See PROBLEMS.');
  if (s.revealed.ship && saturation(s) >= 0.4) reveal(s, 'markets', 'Your market is getting crowded. Open market.ts.');
  if (marketFull(s) && s.fullHint !== s.market) { s.fullHint = s.market; log(s, `${MARKETS[s.market].name} is full. Save up for ${MARKETS[s.market + 1].name} in market.ts.`, 'reveal'); }
  if (valuation(s) >= exitNeed(s) * 0.3) reveal(s, 'exit', 'Buyers are interested in your company. Open exit.ts.');
  if (UPGRADES.some((u) => u.cat === 'automation' && s.done[u.id]) || m.autoShip || m.autoHire) reveal(s, 'workflows', 'Automation is online. Open .github/workflows.yml.');
  if (s.t >= 300) reveal(s, 'stats', null);
  if (s.exits >= 3) reveal(s, 'ipo', 'Bankers are calling: an IPO is possible. Open ipo.ts.');
  if (!away && (headcount(s) >= 10 || s.talents.length) && s.t >= s.nextTalents) {
    if (!s.revealed.talents) reveal(s, 'talents', 'A recruiter sent you rare candidates. See the talent market in team.ts.');
    rollTalents(s, rng);
    s.nextTalents = s.t + 240;
  }
  for (const u of UPGRADES) upgradeVisible(s, u);
  s.achTimer = (s.achTimer || 0) + dt;
  if (s.achTimer >= 1) { s.achTimer = 0; checkAchievements(s); }
}

export function goalRewardText(r: Reward) {
  return [r.money ? `+$${fmt(r.money)}` : '', r.loc ? `+${fmt(r.loc)} LoC` : '', r.rep ? `+${fmt(r.rep)} Rep` : ''].filter(Boolean).join(', ');
}
export const openGoals = (s: GameState) => GOALS.filter((g) => !s.goalsDone[g.i]).slice(0, 3);
export const goalReward = (s: GameState, g: Goal | undefined) => (g ? goalRewardText(g.reward(s)) : '');


