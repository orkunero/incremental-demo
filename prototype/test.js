// Rule checks for core.js. Run: node prototype/test.js (exits with 1 if anything fails)
const G = require('./core.js');
let seed = 1; const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const out = [];
const check = (name, ok, info) => out.push(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
function grow(s, secs, opts = {}) {
  const end = s.t + secs;
  while (s.t < end) {
    G.click(s);
    if (opts.squash && s.bugs.length) G.squash(s, s.bugs[0].id);
    if (opts.decide && s.decision) G.decide(s, 'a');
    if (s.incident) G.hotfix(s);
    for (const c of [...s.contracts]) G.deliver(s, c.id);
    for (const f of G.FEATURES) if (G.featureState(s, f) === 'open') G.buyFeature(s, f.id);
    for (const u of G.UPGRADES) if (G.upgradeVisible(s, u) && G.canAfford(s, u.cost) && !(G.marketFull(s) && u.cost.money)) G.buyUpgrade(s, u.id);
    G.buyMarket(s); if (!G.marketFull(s)) { if (G.headcount(s) >= G.seats(s) - 1) G.moveOffice(s);
    for (;;) { const b = G.bestEngineer(s); if (!b || !G.hire(s, b.id, 1)) break; } }
    const d = G.debtPct(s); G.setRefactor(s, d > 0.2 ? 0.5 : d > 0.13 ? 0.25 : 0);
    if (G.canShip(s) && s.loc > (G.rates(s).feature + 3) * 15) G.ship(s, rng);
    G.tick(s, 0.2, rng); s.events.length = 0;
  }
  return s;
}
const finite = (s) => ['loc', 'money', 'rep', 'debt', 'written', 'mrrRaw'].every((k) => Number.isFinite(s[k]) && s[k] >= 0);

// 1. offline progress (the UI calls tick(s, 1, () => 0.999) in a loop)
let s = grow(G.createState(), 600, { squash: true, decide: true });
const d0 = G.debtPct(s), feed0 = s.feed.length, m0 = s.money;
for (let i = 0; i < 7200; i++) G.tick(s, 1, () => 0.999, { offline: true });
check('offline 2h: debt stays sane', G.debtPct(s) - d0 < 0.05, `debt ${(d0 * 100).toFixed(1)}% -> ${(G.debtPct(s) * 100).toFixed(1)}%, escaped ${s.stats.bugsEscaped}`);
check('offline 2h: no log spam', s.feed.length - feed0 < 10, `${s.feed.length - feed0} new log lines`);
check('offline 2h: earns money', s.money > m0);

// 2. poach decision with no seniors must not go negative
s = G.createState(); s.decision = { id: 'poach', until: 100 }; G.decide(s, 'b');
check('poach with 0 seniors', s.staff.senior >= 0, `senior=${s.staff.senior}`);

// 3. letGo / promote edge cases
s = G.createState(); check('letGo on 0', G.letGo(s, 'intern') === false);
check('promote with none', G.promote(s, 'intern') === false);

// 4. challenge start/finish, exit during challenge
s = grow(G.createState(), 2400, { squash: true });
const ex = G.exit(s); check('first exit possible in 40 min', !!ex, `valuation ${G.fmt(G.valuation(s))} need ${G.fmt(G.exitNeed(s))}`);
if (ex) {
  let c = G.startChallenge(ex, 'solo');
  check('startChallenge returns state', !!c && c.challenge === 'solo');
  check('solo blocks hiring', G.hire(c, 'intern', 1) === 0);
  check('cannot start a done challenge', (() => { const t = G.createState({ chDone: { solo: true } }); return G.startChallenge(t, 'solo') === null; })());
  c = G.startChallenge(ex, 'legacy');
  check('legacy starts at 40% debt', Math.abs(G.debtPct(c) - 0.4) < 0.01, (G.debtPct(c) * 100).toFixed(1) + '%');
  c = G.startChallenge(ex, 'bootstrap'); grow(c, 120);
  check('bootstrap has no contracts', c.contracts.length === 0 && c.stats.contracts === 0);
  c = G.startChallenge(ex, 'cowboy'); grow(c, 900);
  check('cowboy hides process upgrades until done', c.chDone.cowboy || !G.UPGRADES.some((u) => u.cat === 'process' && (c.done[u.id] || c.seen[u.id])));
}

// 5. perks: botarmy, autodeploy, serial etc.
s = G.createState({ perks: { botarmy: true, autodeploy: true, serial: true, angel: true, network: true } });
check('botarmy gives bots', s.done.zapier && s.done.refactorbot);
check('serial+angel money', s.money === 25500 && s.office === 1);

// 6. save round trip (JSON) keeps working
s = grow(G.createState(), 900, { squash: true, decide: true });
const copy = Object.assign(G.createState({ perks: s.perks }), JSON.parse(JSON.stringify(Object.assign({}, s, { events: [] }))));
copy.events = []; copy.rev++;
check('save round trip: same valuation', Math.abs(G.valuation(copy) - G.valuation(s)) < 1e-6 * G.valuation(s) + 1e-9);
grow(copy, 60); check('loaded save keeps ticking', finite(copy));

// 7. numbers stay finite over long play
s = G.createState(); grow(s, 7200, { squash: true, decide: true });
check('2h run stays finite', finite(s), `money ${G.fmt(s.money)}`);

// 8. goals never get stuck on unreachable steps: list which goal the 2h run ended on
// this player never hires support roles, so one goal stays open; the others must not be blocked by it
check('2h run: goals not blocked by a skipped one', s.goal >= G.GOALS.length - 1, `goal ${s.goal}/${G.GOALS.length}`);

// 9. decisions: every option runs on a fresh and a grown state without throwing
for (const st of [G.createState(), s]) for (const d of G.DECISIONS) for (const o of ['a', 'b']) {
  try { st.decision = { id: d.id, until: st.t + 30 }; G.decide(st, o); } catch (e) { check(`decision ${d.id}/${o}`, false, e.message); }
}
check('decisions all run', finite(s));

// 10. ship with tiny loc / market cap edge
s = G.createState(); s.revealed.ship = true; s.loc = 10; check('ship 10 LoC', G.ship(s, rng) === true && finite(s));
// 11. perks and Board Room seats apply right away when bought
s = G.createState({ fp: 10, shares: 10 });
G.buyPerk(s, 'angel'); check('angel perk pays now', s.money >= 25000);
G.buyBoard(s, 'alumni'); check('alumni seat hires now', s.staff.junior === 6 && s.staff.senior === 2);
check('cannot buy a seat twice', G.buyBoard(s, 'alumni') === false);

// 12. IPO: needs 3 sales; resets Founder Points and perks; keeps shares, board, achievements
s = G.createState({ exits: 3, fp: 7, perks: { serial: true, angel: true }, board: { memory: true }, ach: { hello: true } });
check('no IPO below the valuation', G.ipo(s) === null);
s.revealed.ship = true; s.market = 4; s.mrrRaw = 1e12;
const before = G.valuation(s);
const pub = G.ipo(s);
check('IPO works at the valuation', !!pub, `valuation ${G.fmt(before)}`);
if (pub) {
  check('IPO resets FP and sales', pub.fp === 0 && pub.exits === 0);
  check('IPO keeps cheap perks with Founder Memory', pub.perks.serial && !pub.perks.angel);
  check('IPO gives shares and keeps achievements', pub.shares > 0 && pub.ach.hello);
  check('IPO resets the sale target', G.exitNeed(pub) === G.EXIT_VALUATION);
}
check('no IPO during a challenge', (() => { const c = G.createState({ exits: 3, challenge: 'solo' }); c.revealed.ship = true; c.market = 4; c.mrrRaw = 1e12; return !G.canIpo(c); })());

console.log(out.join('\n'));
const failed = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`\n${out.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
