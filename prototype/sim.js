// Pacing simulation: a scripted player plays the real rules from core.js.
// Usage: node prototype/sim.js [cps=5] [idleAfterMinutes]
const G = require('./core.js');

const CPS = Number(process.argv[2] || 5);
const IDLE_AFTER = process.argv[3] ? Number(process.argv[3]) * 60 : Infinity;
const DT = 1 / Math.max(CPS, 1);

let seed = 12345;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const fm = (t) => `${Math.floor(t / 60)}m${String(Math.floor(t % 60)).padStart(2, '0')}s`;

function bot(s, active, decide, m) {
  if (active) {
    if (s.incident) G.hotfix(s);
    else { const v = G.click(s); m.clickLoc += v; }
    if (s.viral) G.claimViral(s);
  } else if (s.viral && Math.random() < 0.05) G.claimViral(s);
  if (!decide) return;

  const buy = (name) => { m.buys.push(s.t); m.last[name] = m.last[name] || s.t; };
  if (s.revealed.debt) {
    const d = G.debtPct(s);
    G.setRefactor(s, d > 0.22 ? 0.6 : d > 0.15 ? 0.3 : 0);
  }
  for (const c of [...s.contracts].sort((a, b) => b.pay - a.pay)) if (G.deliver(s, c.id)) buy('contract');
  for (const p of G.PROJECTS) if (G.projectVisible(s, p) && G.canAffordProject(s, p) && G.buyProject(s, p.id)) buy('project:' + p.id);
  if (G.buyMarket(s)) buy('market' + s.market);
  if (G.headcount(s) >= G.seats(s) && G.moveOffice(s)) buy('office' + s.office);
  for (;;) {
    const opts = G.STAFF.filter((d) => G.staffUnlocked(s, d))
      .map((d) => ({ d, score: (d.out * (1 - G.staffBug(s, d))) / G.staffCost(s, d.id) }))
      .sort((a, b) => b.score - a.score);
    if (!opts.length || !G.buyStaff(s, opts[0].d.id)) break;
    buy('staff:' + opts[0].d.id);
  }
  if (s.done.cicd) s.autoShip = true;
  const fits = (c) => c.maxDebt == null || G.debtPct(s) <= c.maxDebt;
  // A player compares the shown ship value with open contracts: when the market is saturated, contracts pay more.
  const saving = s.contracts.some((c) => fits(c) && c.size > s.loc && (c.size < s.loc * 3 || G.saturation(s) > 0.8));
  const r = G.rates(s);
  if (!saving && G.canShip(s) && s.loc >= Math.max(10, (r.feature + 3) * 15) && G.debtPct(s) < 0.25) G.ship(s, rng);
}

function play(meta, maxT) {
  let s = G.createState(meta);
  const m = { clickLoc: 0, buys: [], last: {}, samples: [] };
  let teamLocAcc = 0;
  let nextDecide = 0, nextSample = 0;
  while (s.t < maxT) {
    const active = s.t < IDLE_AFTER && CPS > 0;
    const before = s.written;
    bot(s, active, s.t >= nextDecide, m);
    if (s.t >= nextDecide) nextDecide += 1;
    G.tick(s, DT, rng);
    teamLocAcc += G.rates(s).feature * DT;
    s.events.length = 0;
    if (s.t >= nextSample) {
      m.samples.push({ t: s.t, team: G.rates(s).team, mrr: G.mrr(s), debt: G.debtPct(s), rep: s.rep, val: G.valuation(s), xp: G.xpGain(s), click: m.clickLoc, teamLoc: teamLocAcc, staff: G.headcount(s) });
      nextSample += 60;
    }
    const xp = G.xpGain(s);
    if (G.valuation(s) >= G.EXIT_VALUATION && (xp >= 4 || (s.t > 30 * 60 && xp >= 2))) {
      m.exitAt = s.t; m.exitXp = xp;
      return { s, m, next: G.exit(s) };
    }
  }
  return { s, m, next: null };
}

let meta = null;
for (let run = 1; run <= 3; run++) {
  const { s, m, next } = play(meta, 90 * 60);
  console.log(`\n=== RUN ${run} (xp at start: ${meta ? meta.xp : 0}) ===`);
  const firsts = Object.entries(m.last).sort((a, b) => a[1] - b[1]).map(([k, t]) => `${k}@${fm(t)}`);
  console.log('firsts:', firsts.join(', '));
  for (const sm of m.samples.filter((x, i) => [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60].includes(i) || i === m.samples.length - 1)) {
    const clickShare = sm.click / Math.max(1, sm.click + sm.teamLoc);
    console.log(`  ${fm(sm.t).padStart(7)} team=${G.fmt(sm.team).padStart(6)}/s mrr=$${G.fmt(sm.mrr).padStart(6)}/s debt=${(sm.debt * 100).toFixed(0).padStart(2)}% rep=${G.fmt(sm.rep).padStart(6)} staff=${String(sm.staff).padStart(3)} val=$${G.fmt(sm.val).padStart(6)} click%cum=${(clickShare * 100).toFixed(0)}`);
  }
  for (const [a, z] of [[0, 300], [300, 900], [900, 1800], [1800, 2700], [2700, 5400]]) {
    const b = m.buys.filter((t) => t >= a && t < z);
    if (b.length < 2) { console.log(`  window ${a / 60}-${z / 60}m: ${b.length} purchases`); continue; }
    const g = b.slice(1).map((t, i) => t - b[i]).sort((x, y) => x - y);
    console.log(`  window ${a / 60}-${z / 60}m: purchases=${b.length} median_gap=${g[g.length >> 1].toFixed(0)}s p90_gap=${g[Math.floor(g.length * 0.9)].toFixed(0)}s`);
  }
  console.log(`  ships=${s.stats.ships} contracts=${s.stats.contracts} incidents=${s.stats.incidents} exit=${m.exitAt ? fm(m.exitAt) + ' +' + m.exitXp + 'xp' : 'none'}`);
  if (!next) break;
  meta = next;
}
