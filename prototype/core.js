// Git Rich prototype: game rules only. No DOM, no timers, no Math.random.
// Used by index.html (browser) and sim.js (node pacing simulation).
(function (root) {
  'use strict';

  const GROWTH = 1.17;
  const DEPLOY_TIME = 8;
  const MIN_SHIP = 10;
  const MRR_PER_LOC = 0.002;
  const CONTRACT_PAY = 0.8;
  const EXIT_VALUATION = 1e6;
  const VALUATION_MULT = 500;

  const STAFF = [
    { id: 'intern', name: 'Intern', cost: 15, out: 1, bug: 0.5, rep: 0, note: 'Fast and eager. Writes a lot of bugs.' },
    { id: 'junior', name: 'Junior Dev', cost: 120, out: 6, bug: 0.3, rep: 0, note: 'Solid output, still learning.' },
    { id: 'senior', name: 'Senior Dev', cost: 1400, out: 35, bug: 0.1, rep: 60, note: 'Clean code. Expensive.' },
    { id: 'lead', name: 'Tech Lead', cost: 18000, out: 200, bug: 0.05, rep: 500, note: 'Very clean code at scale.' },
    { id: 'copilot', name: 'AI Copilot', cost: 400000, out: 2500, bug: 0.45, rep: 0, needs: 'ml', note: 'Huge output. Hallucinates bugs.' },
    { id: 'principal', name: 'Principal Engineer', cost: 5e6, out: 15000, bug: 0.03, rep: 20000, note: 'Writes almost no bugs.' },
  ];

  const OFFICES = [
    { name: 'Garage', seats: 3, cost: 0, rep: 0 },
    { name: 'Co-working desk', seats: 10, cost: 400, rep: 0 },
    { name: 'Small office', seats: 30, cost: 2500, rep: 80 },
    { name: 'Office floor', seats: 100, cost: 80000, rep: 1500 },
    { name: 'Glass tower', seats: 300, cost: 8e6, rep: 15000 },
  ];

  // Market size caps MRR: income saturates as you approach the cap.
  const MARKETS = [
    { name: 'Hometown', cap: 8, cost: 0, rep: 0 },
    { name: 'Nationwide', cap: 150, cost: 900, rep: 30 },
    { name: 'Continental', cap: 4000, cost: 40000, rep: 600 },
    { name: 'Global', cap: 100000, cost: 2e6, rep: 8000 },
    { name: 'Interplanetary', cap: 3e6, cost: 1.5e8, rep: 150000 },
  ];

  // One-time projects. Each one changes a rule instead of adding a flat +X%.
  const PROJECTS = [
    { id: 'keyboard', name: 'Mechanical Keyboard', desc: 'Flow can build up to ×3 instead of ×2.', cost: { money: 60 }, show: (s) => s.stats.contracts >= 1 },
    { id: 'so', name: 'Stack Overflow Account', desc: 'Your team writes 25% more code.', cost: { money: 250 }, show: (s) => headcount(s) >= 3 },
    { id: 'tests', name: 'Unit Tests', desc: 'All new code has 30% fewer bugs.', cost: { loc: 300 }, show: (s) => debtPct(s) > 0.08 },
    { id: 'typing', name: 'Static Typing', desc: 'All new code has 25% fewer bugs.', cost: { loc: 2500 }, show: (s) => !!s.done.tests && s.stats.ships >= 3 },
    { id: 'pair', name: 'Pair Programming', desc: 'Interns and Juniors write 50% fewer bugs.', cost: { money: 3000 }, show: (s) => s.staff.junior >= 5 },
    { id: 'review', name: 'Code Review', desc: 'Refactoring removes debt twice as fast.', cost: { loc: 6000 }, show: (s) => s.staff.senior >= 1 },
    { id: 'freemium', name: 'Freemium Plan', desc: 'Every shipped line earns 50% more MRR.', cost: { money: 6000 }, show: (s) => s.stats.ships >= 8 },
    { id: 'hackathon', name: 'Hackathon Culture', desc: 'Your flow also speeds up the team, up to +50%.', cost: { money: 8000 }, show: (s) => s.staff.senior >= 3 },
    { id: 'cicd', name: 'CI/CD Pipeline', desc: 'Auto-ship: releases go out on their own while debt is under your limit.', cost: { loc: 20000 }, show: (s) => s.stats.ships >= 15 },
    { id: 'brand', name: 'Brand Designer', desc: 'Releases give 50% more Reputation.', cost: { money: 40000 }, show: (s) => s.rep >= 300 },
    { id: 'flags', name: 'Feature Flags', desc: 'Incidents after a release are half as likely.', cost: { loc: 40000 }, show: (s) => s.stats.incidents >= 2 },
    { id: 'monitor', name: 'Monitoring & Alerts', desc: 'Incidents fix themselves after 20 s.', cost: { money: 60000 }, show: (s) => s.stats.incidents >= 3 },
    { id: 'ml', name: 'Machine Learning', desc: 'Unlocks the AI Copilot hire.', cost: { loc: 300000 }, show: (s) => s.rep >= 1500 },
    { id: 'micro', name: 'Microservices', desc: 'Big-team bugs are halved and debt hurts income half as much.', cost: { loc: 300000 }, show: (s) => headcount(s) >= 50 },
    { id: 'remote', name: 'Remote Work', desc: '+50% seats in every office.', cost: { money: 2e6 }, show: (s) => s.office >= 3 },
  ];

  const CLIENTS = [
    'Crumb & Co. bakery', 'Dr. Ayla\'s dental clinic', 'Kadıköy Bikes', 'Moss Yoga Studio', 'Harbor Logistics',
    'Pine Street Library', 'Velvet Records', 'Northbank Credit Union', 'City Parking Office', 'Lumen Solar',
    'Brightside School', 'Atlas Insurance', 'Orbit Airlines', 'Ministry of Forms',
  ];
  const JOBS = ['landing page', 'booking system', 'inventory tool', 'mobile app', 'admin panel', 'payment flow', 'data migration', 'customer portal'];

  // ---------- derived values ----------
  const headcount = (s) => STAFF.reduce((a, d) => a + s.staff[d.id], 0);
  const seats = (s) => Math.floor(OFFICES[s.office].seats * (s.done.remote ? 1.5 : 1));
  const xpMult = (s) => 1 + 0.25 * s.xp;
  const staffCost = (s, id) => STAFF.find((d) => d.id === id).cost * Math.pow(GROWTH, s.staff[id]);
  const debtPct = (s) => s.debt / Math.max(s.written, 100);
  const quality = (s) => Math.min(1, Math.max(0.1, 1 - debtPct(s) * 1.5 * (s.done.micro ? 0.5 : 1)));
  const flowCap = (s) => (s.done.keyboard ? 3 : 2);
  const flowMult = (s) => 1 + (s.flow / 100) * (flowCap(s) - 1);
  const globalBug = (s) => (s.done.tests ? 0.7 : 1) * (s.done.typing ? 0.75 : 1);
  // Brooks's law: a bigger team makes more coordination bugs.
  const teamBug = (s) => 1 + headcount(s) / 40 * (s.done.micro ? 0.5 : 1);
  const staffBug = (s, d) => d.bug * globalBug(s) * teamBug(s) * (s.done.pair && (d.id === 'intern' || d.id === 'junior') ? 0.5 : 1);
  const cap = (s) => MARKETS[s.market].cap;

  function rates(s) {
    let team = 0, bug = 0;
    const boost = (s.done.so ? 1.25 : 1) * (s.done.hackathon ? 1 + 0.5 * s.flow / 100 : 1) * xpMult(s);
    for (const d of STAFF) {
      const out = s.staff[d.id] * d.out * boost;
      team += out;
      bug += out * staffBug(s, d);
    }
    const write = 1 - s.refactor;
    return {
      team,
      feature: team * write,
      bug: bug * write,
      refactor: team * s.refactor * 0.5 * (s.done.review ? 2 : 1),
    };
  }
  // MRR before temporary event effects. Saturates at the market cap.
  const baseMrr = (s) => cap(s) * (1 - Math.exp(-s.mrrRaw / cap(s))) * quality(s) * xpMult(s);
  const saturation = (s) => 1 - Math.exp(-s.mrrRaw / cap(s));
  const mrr = (s) => baseMrr(s) * (s.incident ? 0.5 : 1) * (s.t < s.boostUntil ? 2 : 1);
  const clickValue = (s) => (1 + 0.02 * rates(s).team) * flowMult(s);
  // MRR the current build would add if shipped now (after market saturation and debt).
  function shipGain(s) {
    const add = s.loc * MRR_PER_LOC * (s.done.freemium ? 1.5 : 1);
    return cap(s) * (Math.exp(-s.mrrRaw / cap(s)) - Math.exp(-(s.mrrRaw + add) / cap(s))) * quality(s) * xpMult(s);
  }
  const valuation = (s) => baseMrr(s) * VALUATION_MULT;
  const xpGain = (s) => Math.floor(Math.sqrt(valuation(s) / 2.5e5));
  // First three releases are safe so new players can learn what debt is first.
  const incidentChance = (s) => (s.stats.ships < 3 ? 0 : Math.min(0.8, debtPct(s) * 1.5) * (s.done.flags ? 0.5 : 1));
  const versionStr = (s) => `v${s.version[0]}.${s.version[1]}`;

  // ---------- state ----------
  function createState(meta) {
    const staff = {};
    for (const d of STAFF) staff[d.id] = 0;
    return {
      v: 1, t: 0,
      loc: 0, money: 0, rep: 0, debt: 0, written: 0, mrrRaw: 0,
      flow: 0, lastClick: -99,
      staff, office: 0, market: 0, done: {}, seen: {},
      refactor: 0, autoShip: false, autoShipDebt: 0.2,
      deployLeft: 0, contracts: [], nextContract: 0, contractSeq: 0,
      incident: null, viral: null, boostUntil: 0, nextViral: 0,
      revealed: Object.assign({}, meta && meta.revealed),
      feed: (meta && meta.feed) || [],
      stats: { clicks: 0, ships: 0, contracts: 0, incidents: 0, runMoney: 0 },
      version: [0, 0],
      xp: (meta && meta.xp) || 0,
      exits: (meta && meta.exits) || 0,
      events: [], // transient: UI reads and clears
    };
  }

  function log(s, text, kind) {
    s.feed.unshift({ t: s.t, text, kind: kind || 'info' });
    if (s.feed.length > 40) s.feed.pop();
    s.events.push({ text, kind: kind || 'info' });
  }

  function reveal(s, key, msg) {
    if (s.revealed[key]) return;
    s.revealed[key] = true;
    if (msg) log(s, msg, 'reveal');
  }

  // ---------- actions ----------
  function click(s) {
    const v = clickValue(s);
    s.flow = Math.min(100, s.flow + 7);
    s.lastClick = s.t;
    s.loc += v;
    s.written += v;
    s.debt += v * 0.05 * globalBug(s);
    s.stats.clicks++;
    return v;
  }

  function canShip(s) { return s.revealed.ship && s.loc >= MIN_SHIP && s.deployLeft <= 0; }

  function ship(s, rng) {
    if (!canShip(s)) return false;
    const lines = s.loc;
    const repGain = 0.6 * Math.sqrt(lines) * quality(s) * (s.done.brand ? 1.5 : 1);
    s.mrrRaw += lines * MRR_PER_LOC * (s.done.freemium ? 1.5 : 1);
    s.rep += repGain;
    s.loc = 0;
    s.deployLeft = DEPLOY_TIME;
    s.version[1]++;
    if (s.version[1] >= 10) { s.version[0]++; s.version[1] = 0; }
    s.stats.ships++;
    reveal(s, 'rep', null);
    log(s, `${versionStr(s)} shipped: ${fmt(lines)} lines, +${fmt(repGain)} Rep`, 'ship');
    if (s.stats.ships === 1) s.nextViral = s.t + 90;
    if (!s.incident && rng() < incidentChance(s)) startIncident(s, 'The new release broke checkout.');
    return true;
  }

  function startIncident(s, why) {
    s.incident = { t: 0, left: 12, why };
    s.stats.incidents++;
    s.rep = Math.max(0, s.rep * 0.97);
    reveal(s, 'debt', null);
    log(s, `Incident: ${why} Income halved until fixed.`, 'bad');
  }

  function hotfix(s) {
    if (!s.incident) return false;
    s.incident.left--;
    s.stats.clicks++;
    if (s.incident.left <= 0) { s.incident = null; log(s, 'Hotfix deployed. Income is back to normal.', 'good'); }
    return true;
  }

  function claimViral(s) {
    if (!s.viral) return false;
    s.viral = null;
    s.boostUntil = s.t + 30;
    const gain = Math.max(10, s.rep * 0.1);
    s.rep += gain;
    log(s, `You went viral! Income ×2 for 30 s, +${fmt(gain)} Rep.`, 'good');
    return true;
  }

  function buyStaff(s, id) {
    const d = STAFF.find((x) => x.id === id);
    if (!staffUnlocked(s, d) || headcount(s) >= seats(s)) return false;
    const c = staffCost(s, id);
    if (s.money < c) return false;
    s.money -= c;
    s.staff[id]++;
    if (s.staff[id] === 1) log(s, `Hired your first ${d.name}.`, 'good');
    return true;
  }
  const staffUnlocked = (s, d) => s.rep >= d.rep && (!d.needs || s.done[d.needs]);

  function moveOffice(s) {
    const o = OFFICES[s.office + 1];
    if (!o || s.money < o.cost || s.rep < o.rep) return false;
    s.money -= o.cost;
    s.office++;
    log(s, `Moved to a ${o.name}: ${seats(s)} seats.`, 'good');
    return true;
  }

  function buyMarket(s) {
    const m = MARKETS[s.market + 1];
    if (!m || s.money < m.cost || s.rep < m.rep) return false;
    // keep current income level: rescale raw so the saturation curve continues smoothly
    const now = cap(s) * (1 - Math.exp(-s.mrrRaw / cap(s)));
    s.money -= m.cost;
    s.market++;
    s.mrrRaw = -cap(s) * Math.log(1 - Math.min(0.999999, now / cap(s)));
    log(s, `Launched ${m.name}. Market size: ${fmt(m.cap)} $/s.`, 'good');
    return true;
  }

  function projectVisible(s, p) {
    if (s.done[p.id]) return false;
    if (s.seen[p.id]) return true;
    if (p.show(s)) { s.seen[p.id] = true; reveal(s, 'projects', 'New project available.'); return true; }
    return false;
  }
  function canAffordProject(s, p) {
    return (!p.cost.money || s.money >= p.cost.money) && (!p.cost.loc || s.loc >= p.cost.loc);
  }
  function buyProject(s, id) {
    const p = PROJECTS.find((x) => x.id === id);
    if (!p || !projectVisible(s, p) || !canAffordProject(s, p)) return false;
    if (p.cost.money) s.money -= p.cost.money;
    if (p.cost.loc) s.loc -= p.cost.loc;
    s.done[id] = true;
    log(s, `Project done: ${p.name}.`, 'good');
    return true;
  }

  function contractOk(s, c) { return s.loc >= c.size && (c.maxDebt == null || debtPct(s) <= c.maxDebt); }
  function deliver(s, cid) {
    const i = s.contracts.findIndex((c) => c.id === cid);
    if (i < 0 || !contractOk(s, s.contracts[i])) return false;
    const c = s.contracts[i];
    s.loc -= c.size;
    s.money += c.pay;
    s.rep += c.rep;
    s.stats.runMoney += c.pay;
    s.stats.contracts++;
    s.contracts.splice(i, 1);
    reveal(s, 'money', null);
    reveal(s, 'team', 'You can hire people now.');
    log(s, `Delivered ${c.job} for ${c.client}: +$${fmt(c.pay)}.`, 'good');
    return true;
  }

  function newContract(s, rng) {
    const r = rates(s);
    const speed = r.feature + 3;
    const size = Math.max(20, Math.round(speed * (35 + rng() * 50)));
    const strictRoll = rng();
    const maxDebt = s.revealed.debt ? (strictRoll < 0.35 ? null : strictRoll < 0.7 ? 0.25 : 0.12) : null;
    const bonus = maxDebt == null ? 1 : maxDebt > 0.2 ? 1.4 : 2;
    const pay = size * CONTRACT_PAY * bonus * xpMult(s);
    s.contractSeq++;
    s.contracts.push({
      id: s.contractSeq,
      client: CLIENTS[Math.floor(rng() * CLIENTS.length)],
      job: JOBS[Math.floor(rng() * JOBS.length)],
      size, pay, maxDebt,
      rep: Math.round(Math.sqrt(size) * 0.3 * bonus),
      expires: s.t + 180,
    });
  }

  function setRefactor(s, v) { s.refactor = Math.min(0.9, Math.max(0, v)); }

  function exit(s) {
    if (valuation(s) < EXIT_VALUATION) return null;
    const gain = xpGain(s);
    const n = createState({ xp: s.xp + gain, exits: s.exits + 1, revealed: s.revealed, feed: s.feed });
    log(n, `Sold the company for $${fmt(valuation(s))}. +${gain} XP. Starting a new company.`, 'reveal');
    n.revealed.exitDone = true;
    return n;
  }

  // ---------- simulation step ----------
  function tick(s, dt, rng) {
    s.t += dt;
    if (s.t - s.lastClick > 0.5) s.flow = Math.max(0, s.flow - 30 * dt);

    const r = rates(s);
    s.loc += r.feature * dt;
    s.written += r.feature * dt;
    s.debt = Math.max(0, s.debt + (r.bug - r.refactor) * dt);
    const inc = mrr(s) * dt;
    s.money += inc;
    s.stats.runMoney += inc;
    if (s.deployLeft > 0) s.deployLeft -= dt;

    // contracts
    s.contracts = s.contracts.filter((c) => c.expires > s.t);
    if (s.revealed.contracts && s.contracts.length < 2 && s.t >= s.nextContract) {
      newContract(s, rng);
      s.nextContract = s.t + (s.contracts.length < 2 ? 20 : 45);
    }

    // incidents
    if (s.incident) {
      s.incident.t += dt;
      if (s.incident.t >= (s.done.monitor ? 20 : 60)) { s.incident = null; log(s, 'The incident faded out on its own.', 'info'); }
    } else if (s.stats.ships > 0 && rng() < debtPct(s) * 0.004 * dt * (s.done.flags ? 0.5 : 1)) {
      startIncident(s, 'Old bugs took the site down.');
    }

    // viral
    if (s.viral && s.t > s.viral.until) s.viral = null;
    if (!s.viral && s.stats.ships >= 3 && s.nextViral && s.t >= s.nextViral) {
      s.viral = { until: s.t + 12 };
      s.nextViral = s.t + 150 + rng() * 150;
    }

    // auto ship
    if (s.done.cicd && s.autoShip && canShip(s) && debtPct(s) <= s.autoShipDebt && s.loc >= Math.max(MIN_SHIP, r.feature * 10)) ship(s, rng);

    // progressive reveal
    if (s.written >= 10) reveal(s, 'contracts', 'A client wants a small job done.');
    if (s.stats.contracts >= 2 || s.written >= 200) reveal(s, 'ship', 'Idea: build your own product and ship it.');
    if (s.stats.ships >= 1) reveal(s, 'money', null);
    if (s.revealed.money && s.money >= 15) reveal(s, 'team', 'You can hire people now.');
    if (s.written >= 60 && debtPct(s) >= 0.06) reveal(s, 'debt', 'Your code has bugs now. That is tech debt.');
    if (s.revealed.ship && saturation(s) >= 0.4) reveal(s, 'markets', 'Your market is getting crowded. Look for a bigger one.');
    if (valuation(s) >= EXIT_VALUATION * 0.3) reveal(s, 'exit', 'Buyers are interested in your company.');
    for (const p of PROJECTS) projectVisible(s, p);
  }

  function fmt(n) {
    if (!isFinite(n)) return '∞';
    const neg = n < 0; n = Math.abs(n);
    let out;
    if (n < 10) out = (Math.round(n * 10) / 10).toString();
    else if (n < 1000) out = Math.floor(n).toString();
    else {
      const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
      let i = -1;
      while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
      out = n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + u[i];
    }
    return (neg ? '-' : '') + out;
  }

  const api = {
    STAFF, OFFICES, MARKETS, PROJECTS, DEPLOY_TIME, MIN_SHIP, EXIT_VALUATION,
    createState, tick, click, ship, canShip, hotfix, claimViral, buyStaff, moveOffice, buyMarket,
    buyProject, projectVisible, canAffordProject, deliver, contractOk, setRefactor, exit,
    rates, mrr, baseMrr, saturation, shipGain, debtPct, quality, clickValue, flowMult, flowCap, seats, headcount,
    staffCost, staffUnlocked, staffBug, teamBug, valuation, xpGain, incidentChance, versionStr, cap, fmt,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GitRich = api;
})(this);
