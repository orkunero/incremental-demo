// Pacing simulation: a scripted player plays the real rules from core.js.
// Usage: node prototype/sim.js [cps=5] [idleAfterMinutes] [runs=4]
const G = require('./core.js');

const CPS = Number(process.argv[2] || 5);
const IDLE_AFTER = process.argv[3] && process.argv[3] !== '-' ? Number(process.argv[3]) * 60 : Infinity;
const RUNS = Number(process.argv[4] || 4);
const DT = 1 / Math.max(CPS, 1);

let seed = 12345;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const fm = (t) => `${Math.floor(t / 60)}m${String(Math.floor(t % 60)).padStart(2, '0')}s`;
const PERK_ORDER = ['serial', 'friends', 'muscle', 'network', 'autodeploy', 'magnet', 'angel', 'autohire', 'product', 'playbook', 'veteran', 'instinct', 'night', 'unicorn'];

function bot(s, active, decide, m, run) {
  if (active) {
    if (s.incident) G.hotfix(s);
    else { const v = G.click(s); m.clickLoc += v; }
    if (s.viral) G.claimViral(s);
  } else if (s.viral && Math.random() < 0.05) G.claimViral(s);
  if (!decide) return;

  const buy = (name) => { m.buys.push({ t: s.t, name }); if (m.first[name] == null) m.first[name] = s.t; };
  if (s.revealed.debt) {
    const d = G.debtPct(s);
    G.setRefactor(s, d > 0.22 ? 0.6 : d > 0.15 ? 0.3 : 0);
  }
  for (const c of [...s.contracts].sort((a, b) => b.pay - a.pay)) if (G.deliver(s, c.id)) buy('contract');
  // product features: alternate the strategy pairs between runs
  for (const f of G.FEATURES) {
    if (G.featureState(s, f) !== 'open') continue;
    if (f.fork) {
      const pair = G.FEATURES.filter((x) => x.fork === f.fork);
      if (pair[run % 2] !== f) continue;
    }
    if (G.buyFeature(s, f.id)) buy('feature:' + f.id);
  }
  for (const u of G.UPGRADES) if (G.upgradeVisible(s, u) && G.canAfford(s, u.cost) && G.buyUpgrade(s, u.id)) buy('upgrade:' + u.id);
  if (G.buyMarket(s)) buy('market' + s.market);
  if (G.headcount(s) >= G.seats(s) - 1 && G.moveOffice(s)) buy('office' + s.office);
  // support roles: keep rough ratios to the engineering team
  const eng = G.ENGINEERS.reduce((a, d) => a + s.staff[d.id], 0);
  const want = {
    qa: G.debtPct(s) > 0.1 ? Math.floor(eng * 0.12) : 0,
    marketer: Math.floor(eng * 0.06),
    pm: Math.floor(eng * 0.08),
    designer: G.saturation(s) > 0.6 ? Math.floor(eng * 0.05) : 0,
    sre: s.stats.incidents > 3 ? Math.floor(eng * 0.03) : 0,
  };
  for (const d of G.SUPPORT) {
    while (G.roleUnlocked(s, d) && s.staff[d.id] < want[d.id] && G.staffCost(s, d.id) < s.money * 0.5 && G.hire(s, d.id, 1)) buy('staff:' + d.id);
  }
  if (G.headcount(s) >= G.seats(s)) for (const d of G.ENGINEERS) while (s.staff[d.id] > 0 && G.nextLevel(s, d.id) && G.promoteCost(s, d.id) < s.money * 0.3 && G.promote(s, d.id)) buy('promote');
  for (;;) {
    const b = G.bestEngineer(s);
    if (!b || !G.hire(s, b.id, 1)) break;
    buy('staff:' + b.id);
  }
  if (G.mods(s).autoShip) s.autoShip = true;
  const fits = (c) => c.maxDebt == null || G.debtPct(s) <= c.maxDebt;
  const saving = s.contracts.some((c) => fits(c) && c.size > s.loc && (c.size < s.loc * 3 || G.saturation(s) > 0.8))
    || G.FEATURES.some((f) => G.featureState(s, f) === 'open' && G.featureCost(s, f) > s.loc && G.featureCost(s, f) < s.loc * 2);
  const r = G.rates(s);
  if (!saving && G.canShip(s) && s.loc >= Math.max(10, (r.feature + 3) * 15) && G.debtPct(s) < 0.25) G.ship(s, rng);
}

function play(meta, maxT, run) {
  let s = G.createState(meta);
  for (const id of PERK_ORDER) G.buyPerk(s, id);
  if (s.perks.autohire) s.autoHire = true;
  const m = { clickLoc: 0, buys: [], first: {}, samples: [] };
  let teamLocAcc = 0, nextDecide = 0, nextSample = 0;
  while (s.t < maxT) {
    const active = s.t < IDLE_AFTER && CPS > 0;
    bot(s, active, s.t >= nextDecide, m, run);
    if (s.t >= nextDecide) nextDecide += 1;
    G.tick(s, DT, rng);
    teamLocAcc += G.rates(s).feature * DT;
    s.events.length = 0;
    if (s.t >= nextSample) {
      m.samples.push({ t: s.t, team: G.rates(s).team, mrr: G.mrr(s), debt: G.debtPct(s), rep: s.rep, val: G.valuation(s), click: m.clickLoc, teamLoc: teamLocAcc, staff: G.headcount(s), up: Object.keys(s.done).length, feat: Object.keys(s.features).length });
      nextSample += 60;
    }
    const fp = G.fpGain(s);
    if (G.valuation(s) >= G.exitNeed(s) * 1.5 || (G.valuation(s) >= G.exitNeed(s) && s.t > 45 * 60)) {
      m.exitAt = s.t; m.exitFp = fp;
      return { s, m, next: G.exit(s) };
    }
  }
  return { s, m, next: null };
}

let meta = null;
const TRACE = process.env.TRACE ? Number(process.env.TRACE) : 0;
for (let run = 1; run <= RUNS; run++) {
  const { s, m, next } = play(meta, 120 * 60, run);
  console.log(`\n=== RUN ${run} (perks: ${Object.keys(s.perks).join(',') || '-'}) ===`);
  for (const sm of m.samples.filter((x, i) => [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 90].includes(i) || i === m.samples.length - 1)) {
    const clickShare = sm.click / Math.max(1, sm.click + sm.teamLoc);
    console.log(`  ${fm(sm.t).padStart(7)} team=${G.fmt(sm.team).padStart(6)}/s mrr=$${G.fmt(sm.mrr).padStart(6)}/s debt=${(sm.debt * 100).toFixed(0).padStart(2)}% rep=${G.fmt(sm.rep).padStart(6)} staff=${String(sm.staff).padStart(3)} upg=${String(sm.up).padStart(2)} feat=${String(sm.feat).padStart(2)} val=$${G.fmt(sm.val).padStart(6)} click%=${(clickShare * 100).toFixed(0)}`);
  }
  for (const [a, z] of [[0, 300], [300, 900], [900, 1800], [1800, 2700], [2700, 7200]]) {
    const b = m.buys.filter((x) => x.name !== 'contract' && x.t >= a && x.t < z);
    const kinds = new Set(b.map((x) => x.name.split(':')[0].replace(/\d+$/, '')));
    if (b.length < 2) { console.log(`  window ${a / 60}-${z / 60}m: ${b.length} purchases`); continue; }
    const g = b.slice(1).map((x, i) => x.t - b[i].t).sort((x, y) => x - y);
    console.log(`  window ${a / 60}-${z / 60}m: purchases=${b.length} distinct_items=${new Set(b.map((x) => x.name)).size} kinds=${[...kinds].join('/')} p90_gap=${g[Math.floor(g.length * 0.9)].toFixed(0)}s max_gap=${g[g.length - 1].toFixed(0)}s`);
  }
  console.log(`  upgrades=${Object.keys(s.done).length}/${G.UPGRADES.length} features=${Object.keys(s.features).length}/${G.FEATURES.length} ach=${Object.keys(s.ach).length}/${G.ACHIEVEMENTS.length} ships=${s.stats.ships} contracts=${s.stats.contracts} incidents=${s.stats.incidents} support=${G.SUPPORT.map((d) => s.staff[d.id]).join('/')} exit=${m.exitAt ? fm(m.exitAt) + ' +' + m.exitFp + 'fp' : 'none'}`);
  if (!next) break;
  meta = next;
}
