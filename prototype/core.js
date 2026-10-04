// Git Rich prototype: game rules only. No DOM, no timers, no Math.random.
// Used by index.html (browser) and sim.js (node pacing simulation).
(function (root) {
  'use strict';

  const GROWTH = 1.17;
  const SUPPORT_GROWTH = 1.22;
  const MIN_SHIP = 10;
  const MRR_PER_LOC = 0.002;
  const CONTRACT_PAY = 0.8;
  const EXIT_VALUATION = 3e6;
  const VALUATION_MULT = 500;

  // ---------- roles ----------
  const ENGINEERS = [
    { id: 'intern', name: 'Intern', cost: 15, out: 1, bug: 0.5, rep: 0, note: 'Fast and eager. Writes a lot of bugs.' },
    { id: 'junior', name: 'Junior Dev', cost: 120, out: 6, bug: 0.3, rep: 0, note: 'Solid output, still learning.' },
    { id: 'senior', name: 'Senior Dev', cost: 1400, out: 35, bug: 0.1, rep: 60, note: 'Clean code. Expensive.' },
    { id: 'lead', name: 'Tech Lead', cost: 18000, out: 200, bug: 0.05, rep: 500, note: 'Very clean code at scale.' },
    { id: 'copilot', name: 'AI Copilot', cost: 400000, out: 2500, bug: 0.45, rep: 0, needs: 'ml', note: 'Huge output. Hallucinates bugs.' },
    { id: 'principal', name: 'Principal Engineer', cost: 5e6, out: 15000, bug: 0.03, rep: 20000, note: 'Writes almost no bugs.' },
  ];
  // Support roles write no code. Each one bends a different rule, and they all take seats.
  const SUPPORT = [
    { id: 'qa', name: 'QA Engineer', cost: 800, rep: 40, note: 'Each one: all code has 3% fewer bugs.', fx: (m, n) => { m.allBug *= Math.pow(0.97, n); } },
    { id: 'marketer', name: 'Marketer', cost: 1500, rep: 80, note: 'Each one: +4% Reputation, trending events come sooner.', fx: (m, n) => { m.rep *= 1 + 0.04 * n; m.viralEvery *= Math.pow(0.97, n); } },
    { id: 'pm', name: 'Product Manager', cost: 2500, rep: 150, note: 'Each one: +5% income from your product.', fx: (m, n) => { m.mrr *= 1 + 0.05 * n; } },
    { id: 'designer', name: 'Designer', cost: 6000, rep: 400, note: 'Each one: every market is 3% bigger.', fx: (m, n) => { m.cap *= 1 + 0.03 * n; } },
    { id: 'sre', name: 'Site Reliability Eng.', cost: 25000, rep: 1500, note: 'Each one: incidents 6% less likely and shorter.', fx: (m, n) => { m.incident *= Math.pow(0.94, n); m.incDur *= Math.pow(0.95, n); } },
  ];
  const ROLES = ENGINEERS.concat(SUPPORT);

  const OFFICES = [
    { name: 'Garage', seats: 3, cost: 0, rep: 0 },
    { name: 'Co-working desk', seats: 10, cost: 150, rep: 0 },
    { name: 'Small office', seats: 25, cost: 2000, rep: 60 },
    { name: 'Startup loft', seats: 60, cost: 50000, rep: 1200 },
    { name: 'Office floor', seats: 150, cost: 600000, rep: 4000 },
    { name: 'Glass tower', seats: 400, cost: 15e6, rep: 30000 },
    { name: 'Campus', seats: 1200, cost: 2e9, rep: 300000 },
  ];

  // Market size caps MRR: income saturates as you approach the cap.
  const MARKETS = [
    { name: 'Hometown', cap: 15, cost: 0, rep: 0 },
    { name: 'Nationwide', cap: 150, cost: 900, rep: 30 },
    { name: 'Continental', cap: 4000, cost: 60000, rep: 800 },
    { name: 'Global', cap: 100000, cost: 8e6, rep: 25000 },
    { name: 'Interplanetary', cap: 3e6, cost: 1.5e8, rep: 150000 },
    { name: 'Multiverse', cap: 1e8, cost: 2e10, rep: 5e6 },
  ];

  // ---------- upgrades ----------
  // Every upgrade changes a rule through fx(m). show(s) decides when it first appears.
  const UPGRADES = [];
  const U = (id, cat, name, desc, cost, show, fx) => UPGRADES.push({ id, cat, name, desc, cost, show, fx });

  // Role tracks: each engineer type gets five upgrades at 1/10/25/50/100 hired.
  const TRACK_AT = [1, 10, 25, 50, 100];
  const TRACK_COST = [10, 60, 400, 6000, 1e6];
  const TRACKS = {
    intern: [
      ['Coffee Runs', 'Interns write ×2 code.', (m) => { m.out.intern *= 2; }],
      ['Onboarding Docs', 'Interns write 30% fewer bugs.', (m) => { m.bug.intern *= 0.7; }],
      ['Internship Program', 'Every Intern makes Juniors 1% faster.', (m) => { m.syn.push(['intern', 'junior', 0.01]); }],
      ['Return Offers', 'Interns write ×3 code.', (m) => { m.out.intern *= 3; }],
      ['Intern Army', 'Interns write ×4 code, but 20% more bugs.', (m) => { m.out.intern *= 4; m.bug.intern *= 1.2; }],
    ],
    junior: [
      ['Rubber Duck', 'Juniors write ×2 code.', (m) => { m.out.junior *= 2; }],
      ['Code Katas', 'Juniors write 30% fewer bugs.', (m) => { m.bug.junior *= 0.7; }],
      ['Bootcamp Pipeline', 'Juniors cost 25% less to hire.', (m) => { m.cost.junior *= 0.75; }],
      ['Growth Plans', 'Juniors write ×3 code.', (m) => { m.out.junior *= 3; }],
      ['Promotion Track', 'Every Junior makes Seniors 0.5% faster.', (m) => { m.syn.push(['junior', 'senior', 0.005]); }],
    ],
    senior: [
      ['Noise-cancelling Headphones', 'Seniors write ×2 code.', (m) => { m.out.senior *= 2; }],
      ['Mentorship', 'Every Senior makes Interns and Juniors 2% faster.', (m) => { m.syn.push(['senior', 'intern', 0.02], ['senior', 'junior', 0.02]); }],
      ['Design Docs', 'All code has 10% fewer bugs.', (m) => { m.allBug *= 0.9; }],
      ['Architecture Reviews', 'Big-team bugs (Brooks\'s law) −25%.', (m) => { m.brooks *= 0.75; }],
      ['10x Engineers', 'Seniors write ×3 code.', (m) => { m.out.senior *= 3; }],
    ],
    lead: [
      ['Daily Standups', 'Tech Leads write ×2 code.', (m) => { m.out.lead *= 2; }],
      ['Sprint Planning', 'Deploys take half as long.', (m) => { m.deploy *= 0.5; }],
      ['Tech Radar', 'Refactoring is 50% more effective.', (m) => { m.refactor *= 1.5; }],
      ['Engineering Ladder', 'All engineers write 10% more code.', (m) => { m.allOut *= 1.1; }],
      ['Org Design', 'Every office has 25% more seats.', (m) => { m.seats *= 1.25; }],
    ],
    copilot: [
      ['Prompt Engineering', 'AI Copilots write 30% fewer bugs.', (m) => { m.bug.copilot *= 0.7; }],
      ['Fine-tuning', 'AI Copilots write ×2 code.', (m) => { m.out.copilot *= 2; }],
      ['Guardrails', 'AI Copilots write 40% fewer bugs.', (m) => { m.bug.copilot *= 0.6; }],
      ['Agentic Workflows', 'AI Copilots write ×3 code.', (m) => { m.out.copilot *= 3; }],
      ['Self-review', 'AI Copilots write 50% fewer bugs.', (m) => { m.bug.copilot *= 0.5; }],
    ],
    principal: [
      ['Tech Strategy', 'All engineers write 10% more code.', (m) => { m.allOut *= 1.1; }],
      ['RFC Culture', 'All code has 15% fewer bugs.', (m) => { m.allBug *= 0.85; }],
      ['Platform Team', 'Big-team bugs (Brooks\'s law) −50%.', (m) => { m.brooks *= 0.5; }],
      ['Open Source Fame', 'Reputation gains ×1.5.', (m) => { m.rep *= 1.5; }],
      ['Living Legend', 'Principal Engineers write ×3 code.', (m) => { m.out.principal *= 3; }],
    ],
  };
  for (const d of ENGINEERS) {
    TRACKS[d.id].forEach(([name, desc, fx], i) => {
      U(`${d.id}${i}`, 'roles', name, desc, { money: d.cost * TRACK_COST[i] }, (s) => s.staff[d.id] >= TRACK_AT[i], fx);
    });
  }

  // Tools: your own typing.
  U('keyboard', 'tools', 'Mechanical Keyboard', 'Flow can build up to ×2.5.', { money: 60 }, (s) => s.stats.clicks >= 60, (m) => { m.flowCap += 0.5; });
  U('lofi', 'tools', 'Lo-fi Beats', 'Flow builds 50% faster.', { money: 200 }, (s) => s.stats.clicks >= 250, (m) => { m.flowGain *= 1.5; });
  U('monitors', 'tools', 'Dual Monitors', 'Clicks write ×1.5 code.', { money: 900 }, (s) => s.stats.clicks >= 500, (m) => { m.click *= 1.5; });
  U('darkmode', 'tools', 'Dark Theme', 'Flow drains 50% slower.', { money: 3000 }, (s) => s.stats.clicks >= 1000, (m) => { m.flowDecay *= 0.5; });
  U('vim', 'tools', 'Vim Motions', 'Each click also adds 0.5% more of your team\'s output.', { loc: 5000 }, (s) => s.stats.clicks >= 1500, (m) => { m.clickPct += 0.005; });
  U('snippets', 'tools', 'Snippet Library', 'Clicks write ×1.5 code.', { money: 40000 }, (s) => s.stats.clicks >= 2500, (m) => { m.click *= 1.5; });
  U('espresso', 'tools', 'Espresso Machine', 'Flow can build up to ×3.', { money: 250000 }, (s) => s.stats.clicks >= 4000, (m) => { m.flowCap += 0.5; });
  U('autocomplete', 'tools', 'AI Autocomplete', 'Clicks write ×2 code.', { loc: 2e6 }, (s) => !!s.done.ml, (m) => { m.click *= 2; });

  // Process: how code gets made. Paid in code, so it competes with shipping.
  U('tests', 'process', 'Unit Tests', 'All new code has 30% fewer bugs.', { loc: 300 }, (s) => debtPct(s) > 0.08, (m) => { m.allBug *= 0.7; });
  U('linter', 'process', 'Linter', 'All new code has 15% fewer bugs.', { loc: 1200 }, (s) => !!s.done.tests, (m) => { m.allBug *= 0.85; });
  U('typing', 'process', 'Static Typing', 'All new code has 25% fewer bugs.', { loc: 2500 }, (s) => !!s.done.tests && s.stats.ships >= 3, (m) => { m.allBug *= 0.75; });
  U('pair', 'process', 'Pair Programming', 'Interns and Juniors write 50% fewer bugs.', { money: 3000 }, (s) => s.staff.junior >= 5, (m) => { m.bug.intern *= 0.5; m.bug.junior *= 0.5; });
  U('review', 'process', 'Code Review', 'Refactoring removes debt twice as fast.', { loc: 6000 }, (s) => s.staff.senior >= 1, (m) => { m.refactor *= 2; });
  U('cicd', 'process', 'CI/CD Pipeline', 'Auto-ship: releases go out on their own while debt is under your limit.', { loc: 20000 }, (s) => s.stats.ships >= 15, (m) => { m.autoShip = true; });
  U('trunk', 'process', 'Trunk-based Development', 'Deploys take half as long.', { loc: 15000 }, (s) => s.stats.ships >= 25, (m) => { m.deploy *= 0.5; });
  U('flags', 'process', 'Feature Flags', 'Incidents after a release are half as likely.', { loc: 40000 }, (s) => s.stats.incidents >= 2, (m) => { m.incident *= 0.5; });
  U('monitor', 'process', 'Monitoring & Alerts', 'Incidents fade 3× faster.', { money: 60000 }, (s) => s.stats.incidents >= 3, (m) => { m.incDur /= 3; });
  U('postmortem', 'process', 'Blameless Postmortems', 'Every fixed incident gives Reputation instead of costing it.', { money: 20000 }, (s) => s.stats.incidents >= 4, (m) => { m.postmortem = true; });
  U('chaos', 'process', 'Chaos Engineering', 'Hotfixes need half the clicks.', { loc: 120000 }, (s) => s.stats.incidents >= 8, (m) => { m.hotfix *= 0.5; });
  U('debtsprint', 'process', 'Debt Sprints', 'Refactoring is 50% more effective.', { loc: 250000 }, (s) => s.refactor >= 0.3, (m) => { m.refactor *= 1.5; });
  U('ml', 'process', 'Machine Learning', 'Unlocks the AI Copilot hire.', { loc: 300000 }, (s) => s.rep >= 1500, () => {});
  U('micro', 'process', 'Microservices', 'Big-team bugs halved, and debt hurts income half as much.', { loc: 300000 }, (s) => headcount(s) >= 50, (m) => { m.brooks *= 0.5; m.debtHurt *= 0.5; });
  U('k8s', 'process', 'Kubernetes', 'Deploys are instant. Incidents 25% less likely.', { loc: 2e6 }, (s) => !!s.done.micro, (m) => { m.deploy *= 0.1; m.incident *= 0.75; });

  // People: the whole team.
  U('so', 'people', 'Stack Overflow Account', 'Your team writes 25% more code.', { money: 250 }, (s) => headcount(s) >= 3, (m) => { m.allOut *= 1.25; });
  U('lunch', 'people', 'Free Lunch', 'Your team writes 15% more code.', { money: 5000 }, (s) => headcount(s) >= 15, (m) => { m.allOut *= 1.15; });
  U('hackathon', 'people', 'Hackathon Culture', 'Your flow also speeds up the team, up to +50%.', { money: 8000 }, (s) => s.staff.senior >= 3, (m) => { m.flowTeam += 0.5; });
  U('recruiter', 'people', 'In-house Recruiter', 'All hires cost 15% less.', { money: 12000 }, (s) => headcount(s) >= 25, (m) => { m.allCost *= 0.85; });
  U('offsite', 'people', 'Team Offsite', 'Big-team bugs (Brooks\'s law) −20%.', { money: 30000 }, (s) => headcount(s) >= 30, (m) => { m.brooks *= 0.8; });
  U('fourday', 'people', 'Four-day Week', 'Team writes 10% less code, but 30% fewer bugs.', { money: 100000 }, (s) => headcount(s) >= 60, (m) => { m.allOut *= 0.9; m.allBug *= 0.7; });
  U('remote', 'people', 'Remote Work', 'Every office has 50% more seats.', { money: 2e6 }, (s) => s.office >= 4, (m) => { m.seats *= 1.5; });
  U('brand', 'people', 'Employer Branding', 'All hires cost 25% less.', { money: 5e6 }, (s) => headcount(s) >= 120, (m) => { m.allCost *= 0.75; });

  // Growth: product income, Reputation, markets.
  U('abtest', 'growth', 'A/B Testing', 'Product income +15%.', { money: 1500 }, (s) => s.stats.ships >= 5, (m) => { m.mrr *= 1.15; });
  U('newsletter', 'growth', 'Newsletter', 'Reputation gains +25%.', { money: 2000 }, (s) => s.rep >= 100, (m) => { m.rep *= 1.25; });
  U('seo', 'growth', 'SEO', 'Every market is 20% bigger.', { money: 6000 }, (s) => saturation(s) >= 0.5, (m) => { m.cap *= 1.2; });
  U('referral', 'growth', 'Referral Program', 'Product income +20%.', { money: 25000 }, (s) => s.stats.ships >= 30, (m) => { m.mrr *= 1.2; });
  U('talks', 'growth', 'Conference Talks', 'Trending events come 30% sooner.', { money: 15000 }, (s) => s.stats.virals >= 2, (m) => { m.viralEvery *= 0.7; });
  U('influencer', 'growth', 'Influencer Deals', 'Trending events boost income ×3 instead of ×2.', { money: 80000 }, (s) => s.stats.virals >= 4, (m) => { m.viralBoost = Math.max(m.viralBoost, 3); });
  U('press', 'growth', 'Press Kit', 'Reputation gains ×1.5.', { money: 150000 }, (s) => s.rep >= 2000, (m) => { m.rep *= 1.5; });
  U('annual', 'growth', 'Annual Plans', 'Product income ×1.3.', { money: 400000 }, (s) => s.market >= 2, (m) => { m.mrr *= 1.3; });
  U('community', 'growth', 'Community Forum', 'Every market is 30% bigger.', { money: 1.5e6 }, (s) => s.market >= 3, (m) => { m.cap *= 1.3; });

  // Clients.
  U('deck', 'clients', 'Sales Deck', 'Client work pays 25% more.', { money: 300 }, (s) => s.stats.contracts >= 3, (m) => { m.pay *= 1.25; });
  U('casestudy', 'clients', 'Case Studies', 'Client work gives ×2 Reputation.', { money: 2000 }, (s) => s.stats.contracts >= 6, (m) => { m.contractRep *= 2; });
  U('accountmgr', 'clients', 'Account Manager', '+1 client offer slot.', { money: 10000 }, (s) => s.stats.contracts >= 10, (m) => { m.slots += 1; });
  U('agency', 'clients', 'Agency Rates', 'Client work pays 50% more.', { money: 60000 }, (s) => s.stats.contracts >= 15, (m) => { m.pay *= 1.5; });
  U('retainer', 'clients', 'Retainer Deals', 'Client offers last twice as long, +1 slot.', { money: 300000 }, (s) => s.stats.contracts >= 25, (m) => { m.slots += 1; m.contractTime *= 2; });

  // ---------- product features ----------
  // Built with unshipped code. Some come in pairs: pick one per company.
  const FEATURES = [
    { id: 'login', tier: 1, name: 'Accounts & Login', desc: 'Product income +25%.', cost: 50, fx: (m) => { m.mrr *= 1.25; } },
    { id: 'dashboard', tier: 1, name: 'Dashboard', desc: 'Releases give 25% more Reputation.', cost: 400, req: ['login'], fx: (m) => { m.rep *= 1.25; } },
    { id: 'freemium', tier: 2, fork: 'pricing', name: 'Freemium', desc: 'Markets 50% bigger, Reputation +50%, but each line earns 20% less.', cost: 1500, req: ['login'], fx: (m) => { m.cap *= 1.5; m.rep *= 1.5; m.perLoc *= 0.8; } },
    { id: 'enterprise', tier: 2, fork: 'pricing', name: 'Enterprise Sales', desc: 'Each line earns ×1.5, client work pays 50% more, but markets are 20% smaller.', cost: 1500, req: ['login'], fx: (m) => { m.perLoc *= 1.5; m.pay *= 1.5; m.cap *= 0.8; } },
    { id: 'payments', tier: 2, name: 'Payments', desc: 'Product income ×1.3.', cost: 3000, req: ['login'], fx: (m) => { m.mrr *= 1.3; } },
    { id: 'notifications', tier: 3, name: 'Notifications', desc: 'Trending events come 30% sooner.', cost: 6000, req: ['dashboard'], fx: (m) => { m.viralEvery *= 0.7; } },
    { id: 'api', tier: 3, name: 'Public API', desc: '+1 client slot. Unlocks Integration jobs that pay ×2.', cost: 15000, req: ['payments'], fx: (m) => { m.slots += 1; m.integrations = true; } },
    { id: 'mobile', tier: 3, fork: 'platform', name: 'Mobile App', desc: 'Markets 30% bigger, Reputation ×1.3.', cost: 30000, req: ['payments'], fx: (m) => { m.cap *= 1.3; m.rep *= 1.3; } },
    { id: 'desktop', tier: 3, fork: 'platform', name: 'Desktop App', desc: 'Product income ×1.3, incidents 30% less likely.', cost: 30000, req: ['payments'], fx: (m) => { m.mrr *= 1.3; m.incident *= 0.7; } },
    { id: 'search', tier: 4, name: 'Search', desc: 'Product income ×1.25.', cost: 60000, req: ['dashboard'], fx: (m) => { m.mrr *= 1.25; } },
    { id: 'analytics', tier: 4, name: 'Analytics', desc: 'Releases give 30% more Reputation, markets 10% bigger.', cost: 120000, req: ['search'], fx: (m) => { m.rep *= 1.3; m.cap *= 1.1; } },
    { id: 'i18n', tier: 4, name: 'Localization', desc: 'Every market is 30% bigger.', cost: 500000, req: ['analytics'], fx: (m) => { m.cap *= 1.3; } },
    { id: 'integrations', tier: 5, name: 'Integrations Marketplace', desc: 'Product income ×1.3, markets 15% bigger.', cost: 300000, req: ['api'], fx: (m) => { m.mrr *= 1.3; m.cap *= 1.15; } },
    { id: 'ai', tier: 5, fork: 'moat', name: 'AI Assistant', desc: 'Product income ×2, but all code has 20% more bugs.', cost: 1e6, req: ['search'], fx: (m) => { m.mrr *= 2; m.allBug *= 1.2; } },
    { id: 'selfhost', tier: 5, fork: 'moat', name: 'Self-hosting', desc: 'Debt hurts income half as much, client work pays ×2.', cost: 1e6, req: ['search'], fx: (m) => { m.debtHurt *= 0.5; m.pay *= 2; } },
    { id: 'sso', tier: 6, name: 'SSO & Audit Logs', desc: 'Client work pays ×2.', cost: 2e6, req: ['integrations'], fx: (m) => { m.pay *= 2; } },
    { id: 'realtime', tier: 6, name: 'Real-time Collaboration', desc: 'Product income ×2.', cost: 5e6, req: ['i18n'], fx: (m) => { m.mrr *= 2; } },
    { id: 'ecosystem', tier: 7, name: 'Platform Ecosystem', desc: 'Product income ×2, Reputation ×2.', cost: 2e7, req: ['realtime', 'sso'], fx: (m) => { m.mrr *= 2; m.rep *= 2; } },
  ];

  // ---------- founder perks (bought with Founder Points after selling) ----------
  const PERKS = [
    { id: 'serial', cost: 1, name: 'Serial Founder', desc: 'Start every company with $500 and a co-working desk.' },
    { id: 'friends', cost: 1, name: 'Old Friends', desc: 'Your first 3 client jobs each run pay ×5.' },
    { id: 'muscle', cost: 1, name: 'Muscle Memory', desc: 'Flow drains 50% slower and builds 50% faster.', fx: (m) => { m.flowDecay *= 0.5; m.flowGain *= 1.5; } },
    { id: 'night', cost: 1, name: 'Night Owl', desc: 'Offline progress lasts up to 8 hours instead of 2.' },
    { id: 'network', cost: 2, name: 'Network', desc: 'Start every company with 100 Reputation.' },
    { id: 'autodeploy', cost: 2, name: 'DevOps Background', desc: 'Start with CI/CD Pipeline already set up.' },
    { id: 'angel', cost: 3, name: 'Angel Investor', desc: 'Start every company with $25K.' },
    { id: 'playbook', cost: 3, name: 'Playbook', desc: 'Keep all Tools upgrades when you sell.' },
    { id: 'autohire', cost: 3, name: 'Auto-Recruiter', desc: 'Unlocks auto-hiring of engineers.' },
    { id: 'magnet', cost: 3, name: 'Talent Magnet', desc: 'All hires cost 20% less.', fx: (m) => { m.allCost *= 0.8; } },
    { id: 'product', cost: 3, name: 'Product Sense', desc: 'Product features cost 30% less.', fx: (m) => { m.featureCost *= 0.7; } },
    { id: 'veteran', cost: 4, name: 'Process Veteran', desc: 'Keep all Process upgrades when you sell.' },
    { id: 'instinct', cost: 4, name: 'Market Instinct', desc: 'Markets and offices cost 40% less.', fx: (m) => { m.expandCost *= 0.6; } },
    { id: 'unicorn', cost: 6, name: 'Unicorn Hunter', desc: 'Selling gives 50% more Founder Points.', fx: (m) => { m.fpGain *= 1.5; } },
  ];

  // ---------- achievements (+1% code and income each, kept forever) ----------
  const ACHIEVEMENTS = [
    ['hello', 'Hello, World!', 'Write your first line.', (s) => s.stats.clicks >= 1],
    ['typist', 'Touch Typist', 'Click 1,000 times in one company.', (s) => s.stats.clicks >= 1000],
    ['keyboard', 'Keyboard Warrior', 'Click 10,000 times in total.', (s) => s.life.clicks >= 10000],
    ['zone', 'In the Zone', 'Reach full flow.', (s) => s.flow >= 100],
    ['shipit', 'Ship It', 'Ship your first release.', (s) => s.stats.ships >= 1],
    ['v1', 'v1.0', 'Ship 10 releases in one company.', (s) => s.stats.ships >= 10],
    ['cadence', 'Release Cadence', 'Ship 100 releases in one company.', (s) => s.stats.ships >= 100],
    ['client', 'First Client', 'Deliver client work.', (s) => s.stats.contracts >= 1],
    ['agency', 'Agency Life', 'Deliver 25 client jobs in total.', (s) => s.life.contracts >= 25],
    ['hire', 'Not Alone Anymore', 'Hire your first employee.', (s) => headcount(s) >= 1],
    ['team30', 'Pizza Team', 'Have 30 people.', (s) => headcount(s) >= 30],
    ['team100', 'Scale-up', 'Have 100 people.', (s) => headcount(s) >= 100],
    ['support', 'Full Stack Company', 'Have at least one of every support role.', (s) => SUPPORT.every((d) => s.staff[d.id] > 0)],
    ['clean', 'Clean Code', 'Ship 1,000+ lines with debt under 2%.', (s) => s.flags.cleanShip],
    ['yolo', 'YOLO Deploy', 'Ship with 40%+ debt.', (s) => s.flags.yolo],
    ['fire', 'Firefighter', 'Fix 10 incidents by hand in total.', (s) => s.life.hotfixes >= 10],
    ['viral', 'Trending', 'Ride a trending event.', (s) => s.stats.virals >= 1],
    ['national', 'Going National', 'Launch Nationwide.', (s) => s.market >= 1],
    ['global', 'Going Global', 'Launch Global.', (s) => s.market >= 3],
    ['features5', 'Feature Factory', 'Build 5 product features.', (s) => Object.keys(s.features).length >= 5],
    ['forks', 'Decisive', 'Choose all three product strategies in one company.', (s) => ['pricing', 'platform', 'moat'].every((f) => FEATURES.some((x) => x.fork === f && s.features[x.id]))],
    ['upgrades20', 'Optimizer', 'Own 20 upgrades in one company.', (s) => Object.keys(s.done).length >= 20],
    ['k1', 'Ramen Profitable', 'Earn $1K in one company.', (s) => s.stats.runMoney >= 1e3],
    ['m1', 'Millionaire', 'Earn $1M in one company.', (s) => s.stats.runMoney >= 1e6],
    ['b1', 'Billionaire', 'Earn $1B in one company.', (s) => s.stats.runMoney >= 1e9],
    ['exit1', 'Exit', 'Sell a company.', (s) => s.exits >= 1],
    ['exit5', 'Serial Founder', 'Sell 5 companies.', (s) => s.exits >= 5],
    ['speedrun', 'Speedrun', 'Sell a company within 20 minutes.', (s) => s.flags.speedrun],
    ['duck', 'Rubber Duck Debugging', 'Talk to the duck.', (s) => s.flags.duck],
  ].map(([id, name, desc, check]) => ({ id, name, desc, check }));

  const CLIENTS = [
    'Crumb & Co. bakery', 'Dr. Ayla\'s dental clinic', 'Kadıköy Bikes', 'Moss Yoga Studio', 'Harbor Logistics',
    'Pine Street Library', 'Velvet Records', 'Northbank Credit Union', 'City Parking Office', 'Lumen Solar',
    'Brightside School', 'Atlas Insurance', 'Orbit Airlines', 'Ministry of Forms',
  ];
  const JOBS = ['landing page', 'booking system', 'inventory tool', 'mobile app', 'admin panel', 'payment flow', 'data migration', 'customer portal'];

  // ---------- modifiers ----------
  function baseMods() {
    const out = {}, bug = {}, cost = {};
    for (const d of ROLES) { out[d.id] = 1; bug[d.id] = 1; cost[d.id] = 1; }
    return {
      out, bug, cost, syn: [],
      allOut: 1, allBug: 1, allCost: 1, brooks: 1,
      click: 1, clickPct: 0.01, flowCap: 2, flowGain: 7, flowDecay: 30, flowTeam: 0,
      mrr: 1, perLoc: 1, rep: 1, cap: 1, debtHurt: 1,
      pay: 1, contractRep: 1, slots: 2, contractTime: 1, integrations: false,
      refactor: 0.5, deploy: 8, incident: 1, incDur: 60, hotfix: 12, postmortem: false,
      viralEvery: 1, viralBoost: 2, seats: 1, autoShip: false,
      featureCost: 1, expandCost: 1, fpGain: 1, prestige: 1,
    };
  }
  const modsCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function mods(s) {
    const key = s.rev;
    const hit = modsCache && modsCache.get(s);
    if (hit && hit.key === key) return hit.m;
    const m = baseMods();
    for (const u of UPGRADES) if (s.done[u.id]) u.fx(m);
    for (const f of FEATURES) if (s.features[f.id]) f.fx(m);
    for (const p of PERKS) if (s.perks[p.id] && p.fx) p.fx(m);
    for (const d of SUPPORT) if (s.staff[d.id]) d.fx(m, s.staff[d.id]);
    const ach = Object.keys(s.ach).length;
    // unspent Founder Points: +10% each; achievements: +1% each
    m.prestige = (1 + 0.1 * s.fp) * (1 + 0.01 * ach);
    if (modsCache) modsCache.set(s, { key, m });
    return m;
  }
  const touch = (s) => { s.rev++; };

  // ---------- derived values ----------
  const headcount = (s) => ROLES.reduce((a, d) => a + s.staff[d.id], 0);
  const seats = (s) => Math.floor(OFFICES[s.office].seats * mods(s).seats);
  const role = (id) => ROLES.find((d) => d.id === id);
  const isSupport = (d) => !d.out;
  const unitCost = (s, d, owned) => d.cost * mods(s).cost[d.id] * mods(s).allCost * Math.pow(isSupport(d) ? SUPPORT_GROWTH : GROWTH, owned);
  const staffCost = (s, id) => unitCost(s, role(id), s.staff[id]);
  // How many of a role you can hire now (limited by money and seats), and what they cost.
  function bulk(s, id, want) {
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
  const debtPct = (s) => s.debt / Math.max(s.written, 100);
  const quality = (s) => Math.min(1, Math.max(0.1, 1 - debtPct(s) * 1.5 * mods(s).debtHurt));
  const flowMult = (s) => 1 + (s.flow / 100) * (mods(s).flowCap - 1);
  // Brooks's law: a bigger team makes more coordination bugs.
  const teamBug = (s) => 1 + (headcount(s) / 40) * mods(s).brooks;
  const staffBug = (s, d) => d.bug * mods(s).bug[d.id] * mods(s).allBug * teamBug(s);
  const cap = (s) => MARKETS[s.market].cap * mods(s).cap;

  function rates(s) {
    const m = mods(s);
    let team = 0, bug = 0;
    const flowBoost = 1 + m.flowTeam * s.flow / 100;
    for (const d of ENGINEERS) {
      const n = s.staff[d.id];
      if (!n) continue;
      let mult = m.out[d.id] * m.allOut * m.prestige * flowBoost;
      for (const [from, to, per] of m.syn) if (to === d.id) mult *= 1 + per * s.staff[from];
      const out = n * d.out * mult;
      team += out;
      bug += out * staffBug(s, d);
    }
    const write = 1 - s.refactor;
    return { team, feature: team * write, bug: bug * write, refactor: team * s.refactor * m.refactor };
  }
  const saturation = (s) => 1 - Math.exp(-s.mrrRaw / cap(s));
  // MRR before temporary event effects. Saturates at the market cap.
  const baseMrr = (s) => cap(s) * saturation(s) * quality(s) * mods(s).mrr * mods(s).prestige;
  const mrr = (s) => baseMrr(s) * (s.incident ? 0.5 : 1) * (s.t < s.boostUntil ? s.boostMult : 1);
  // MRR the current build would add if shipped now (after market saturation and debt).
  function shipGain(s) {
    const add = s.loc * MRR_PER_LOC * mods(s).perLoc;
    const c = cap(s);
    return c * (Math.exp(-s.mrrRaw / c) - Math.exp(-(s.mrrRaw + add) / c)) * quality(s) * mods(s).mrr * mods(s).prestige;
  }
  const shipRep = (s) => 0.4 * Math.sqrt(s.loc) * quality(s) * mods(s).rep;
  const clickValue = (s) => (1 + mods(s).clickPct * rates(s).team) * flowMult(s) * mods(s).click * mods(s).prestige;
  const valuation = (s) => baseMrr(s) * VALUATION_MULT;
  const fpGain = (s) => Math.floor(Math.sqrt(valuation(s) / 7.5e5) * mods(s).fpGain);
  const incidentChance = (s) => (s.stats.ships < 3 ? 0 : Math.min(0.8, debtPct(s) * 1.5) * mods(s).incident);
  const versionStr = (s) => `v${s.version[0]}.${s.version[1]}`;
  const deployTime = (s) => mods(s).deploy;
  const officeCost = (s) => { const o = OFFICES[s.office + 1]; return o ? o.cost * mods(s).expandCost : Infinity; };
  const marketCost = (s) => { const k = MARKETS[s.market + 1]; return k ? k.cost * mods(s).expandCost : Infinity; };
  const featureCost = (s, f) => f.cost * mods(s).featureCost;

  // ---------- state ----------
  function createState(meta) {
    meta = meta || {};
    const staff = {};
    for (const d of ROLES) staff[d.id] = 0;
    const perks = Object.assign({}, meta.perks);
    const s = {
      v: 2, t: 0, rev: 0,
      loc: 0, money: 0, rep: 0, debt: 0, written: 0, mrrRaw: 0,
      flow: 0, lastClick: -99,
      staff, office: 0, market: 0, done: {}, seen: {}, features: {},
      refactor: 0, autoShip: false, autoShipDebt: 0.2, autoHire: false,
      deployLeft: 0, contracts: [], nextContract: 0, contractSeq: 0,
      incident: null, viral: null, boostUntil: 0, boostMult: 2, nextViral: 0,
      revealed: Object.assign({}, meta.revealed),
      feed: meta.feed || [],
      stats: { clicks: 0, ships: 0, contracts: 0, incidents: 0, virals: 0, runMoney: 0 },
      flags: { cleanShip: false, yolo: false, speedrun: !!(meta.flags && meta.flags.speedrun), duck: !!(meta.flags && meta.flags.duck) },
      life: Object.assign({ clicks: 0, ships: 0, contracts: 0, hotfixes: 0, money: 0 }, meta.life),
      version: [0, 0],
      fp: meta.fp || 0, fpTotal: meta.fpTotal || 0, exits: meta.exits || 0,
      perks, ach: Object.assign({}, meta.ach),
      events: [], // transient: UI reads and clears
    };
    if (perks.serial) { s.money += 500; s.office = 1; }
    if (perks.network) s.rep += 100;
    if (perks.angel) s.money += 25000;
    if (perks.autodeploy) s.done.cicd = true;
    for (const id of meta.keep || []) s.done[id] = true;
    return s;
  }

  function log(s, text, kind) {
    s.feed.unshift({ t: s.t, text, kind: kind || 'info' });
    if (s.feed.length > 60) s.feed.pop();
    s.events.push({ text, kind: kind || 'info' });
  }
  function reveal(s, key, msg) {
    if (s.revealed[key]) return;
    s.revealed[key] = true;
    if (msg) log(s, msg, 'reveal');
  }

  // ---------- actions ----------
  function click(s) {
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

  const canShip = (s) => !!s.revealed.ship && s.loc >= MIN_SHIP && s.deployLeft <= 0;
  function ship(s, rng) {
    if (!canShip(s)) return false;
    const lines = s.loc;
    const repGain = shipRep(s);
    const d = debtPct(s);
    if (lines >= 1000 && d < 0.02) s.flags.cleanShip = true;
    if (d >= 0.4) s.flags.yolo = true;
    s.mrrRaw += lines * MRR_PER_LOC * mods(s).perLoc;
    s.rep += repGain;
    s.loc = 0;
    s.deployLeft = deployTime(s);
    s.version[1]++;
    if (s.version[1] >= 10) { s.version[0]++; s.version[1] = 0; }
    s.stats.ships++;
    s.life.ships++;
    reveal(s, 'rep', null);
    log(s, `${versionStr(s)} shipped: ${fmt(lines)} lines, +${fmt(repGain)} Rep`, 'ship');
    if (s.stats.ships === 1) s.nextViral = s.t + 90;
    if (!s.incident && rng() < incidentChance(s)) startIncident(s, 'The new release broke checkout.');
    return true;
  }

  function startIncident(s, why) {
    s.incident = { t: 0, left: Math.max(3, Math.round(mods(s).hotfix)), why };
    s.stats.incidents++;
    if (!mods(s).postmortem) s.rep = Math.max(0, s.rep * 0.97);
    reveal(s, 'debt', null);
    log(s, `Incident: ${why} Income halved until fixed.`, 'bad');
  }
  function endIncident(s, byHand) {
    s.incident = null;
    if (mods(s).postmortem) { const g = Math.max(5, s.rep * 0.02); s.rep += g; log(s, `Postmortem written: +${fmt(g)} Rep.`, 'good'); }
    if (byHand) { s.life.hotfixes++; log(s, 'Hotfix deployed. Income is back to normal.', 'good'); }
    else log(s, 'The incident faded out.', 'info');
  }
  function hotfix(s) {
    if (!s.incident) return false;
    s.incident.left--;
    s.stats.clicks++;
    s.life.clicks++;
    if (s.incident.left <= 0) endIncident(s, true);
    return true;
  }

  function claimViral(s) {
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

  const roleUnlocked = (s, d) => s.rep >= d.rep && (!d.needs || s.done[d.needs]);
  function hire(s, id, want) {
    const d = role(id);
    if (!d || !roleUnlocked(s, d)) return 0;
    const { n, total } = bulk(s, id, want || 1);
    if (!n || total > s.money) return 0;
    s.money -= total;
    const first = s.staff[id] === 0;
    s.staff[id] += n;
    touch(s);
    if (first) log(s, `Hired your first ${d.name}.`, 'good');
    return n;
  }

  function moveOffice(s) {
    const o = OFFICES[s.office + 1];
    if (!o || s.money < officeCost(s) || s.rep < o.rep) return false;
    s.money -= officeCost(s);
    s.office++;
    touch(s);
    log(s, `Moved to a ${o.name}: ${seats(s)} seats.`, 'good');
    return true;
  }

  function buyMarket(s) {
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

  function upgradeVisible(s, u) {
    if (s.done[u.id]) return false;
    if (s.seen[u.id]) return true;
    if (u.show(s)) { s.seen[u.id] = true; reveal(s, 'upgrades', 'New upgrades available.'); return true; }
    return false;
  }
  const canAfford = (s, cost) => (!cost.money || s.money >= cost.money) && (!cost.loc || s.loc >= cost.loc);
  function buyUpgrade(s, id) {
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
  function featureState(s, f) {
    if (s.features[f.id]) return 'done';
    if (f.fork && FEATURES.some((x) => x.fork === f.fork && x.id !== f.id && s.features[x.id])) return 'blocked';
    if ((f.req || []).some((r) => !s.features[r])) return 'locked';
    return 'open';
  }
  function buyFeature(s, id) {
    const f = FEATURES.find((x) => x.id === id);
    if (!f || featureState(s, f) !== 'open' || s.loc < featureCost(s, f)) return false;
    s.loc -= featureCost(s, f);
    s.features[id] = true;
    touch(s);
    log(s, `Feature built: ${f.name}.`, 'ship');
    return true;
  }

  function buyPerk(s, id) {
    const p = PERKS.find((x) => x.id === id);
    if (!p || s.perks[id] || s.fp < p.cost) return false;
    s.fp -= p.cost;
    s.perks[id] = true;
    touch(s);
    if (id === 'autodeploy') s.done.cicd = true;
    log(s, `Founder perk: ${p.name}.`, 'reveal');
    return true;
  }

  const contractOk = (s, c) => s.loc >= c.size && (c.maxDebt == null || debtPct(s) <= c.maxDebt);
  function deliver(s, cid) {
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
  function newContract(s, rng) {
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
      pay: size * CONTRACT_PAY * bonus * m.pay * m.prestige,
      rep: Math.round(Math.sqrt(size) * 0.3 * bonus * m.contractRep),
      expires: s.t + 180 * m.contractTime,
      life: 180 * m.contractTime,
    });
  }

  function setRefactor(s, v) { s.refactor = Math.min(0.9, Math.max(0, v)); }

  function exit(s) {
    if (valuation(s) < EXIT_VALUATION) return null;
    const gain = fpGain(s);
    const keep = UPGRADES.filter((u) => s.done[u.id] && ((s.perks.playbook && u.cat === 'tools') || (s.perks.veteran && u.cat === 'process'))).map((u) => u.id);
    const flags = { speedrun: s.flags.speedrun || s.t <= 1200, duck: s.flags.duck };
    const n = createState({
      fp: s.fp + gain, fpTotal: s.fpTotal + gain, exits: s.exits + 1, perks: s.perks,
      ach: s.ach, life: s.life, flags, revealed: s.revealed, feed: s.feed, keep,
    });
    log(n, `Sold the company for $${fmt(valuation(s))}. +${gain} Founder Points.`, 'reveal');
    n.revealed.founder = true;
    checkAchievements(n);
    return n;
  }

  function checkAchievements(s) {
    for (const a of ACHIEVEMENTS) {
      if (!s.ach[a.id] && a.check(s)) { s.ach[a.id] = true; touch(s); reveal(s, 'achievements', null); log(s, `Achievement: ${a.name}.`, 'reveal'); }
    }
  }

  // Best engineer to hire by clean output per dollar (used by Auto-Recruiter and the sim bot).
  function bestEngineer(s) {
    let best = null, score = 0;
    for (const d of ENGINEERS) {
      if (!roleUnlocked(s, d)) continue;
      const sc = (d.out * mods(s).out[d.id] * (1 - Math.min(0.9, staffBug(s, d)))) / staffCost(s, d.id);
      if (sc > score) { score = sc; best = d; }
    }
    return best;
  }

  // ---------- simulation step ----------
  let achTimer = 0;
  function tick(s, dt, rng) {
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
    if (s.revealed.contracts && s.contracts.length < m.slots && s.t >= s.nextContract) {
      newContract(s, rng);
      s.nextContract = s.t + (s.contracts.length < m.slots ? 20 : 45);
    }

    // incidents
    if (s.incident) {
      s.incident.t += dt;
      if (s.incident.t >= m.incDur) endIncident(s, false);
    } else if (s.stats.ships > 3 && rng() < debtPct(s) * 0.004 * dt * m.incident) {
      startIncident(s, 'Old bugs took the site down.');
    }

    // trending
    if (s.viral && s.t > s.viral.until) s.viral = null;
    if (!s.viral && s.stats.ships >= 3 && s.nextViral && s.t >= s.nextViral) {
      s.viral = { until: s.t + 12 };
      s.nextViral = s.t + (150 + rng() * 150) * m.viralEvery;
    }

    // automation
    if (m.autoShip && s.autoShip && canShip(s) && debtPct(s) <= s.autoShipDebt && s.loc >= Math.max(MIN_SHIP, r.feature * 10)) ship(s, rng);
    if (s.perks.autohire && s.autoHire) { const b = bestEngineer(s); if (b) hire(s, b.id, 1); }

    // progressive reveal
    if (s.written >= 10) reveal(s, 'contracts', 'A client wants a small job done. Open clients.ts.');
    if (s.stats.contracts >= 2 || s.written >= 200) reveal(s, 'ship', 'Idea: build your own product and ship it.');
    if (s.stats.ships >= 1) reveal(s, 'money', null);
    if (s.revealed.money && s.money >= 15) reveal(s, 'team', 'You can hire people now. Open team.ts.');
    if (s.stats.ships >= 2) reveal(s, 'product', 'Your product can grow new features. Open product.ts.');
    if (s.written >= 60 && debtPct(s) >= 0.06) reveal(s, 'debt', 'Your code has bugs now. That is tech debt. See PROBLEMS.');
    if (s.revealed.ship && saturation(s) >= 0.4) reveal(s, 'markets', 'Your market is getting crowded. Open market.ts.');
    if (valuation(s) >= EXIT_VALUATION * 0.3) reveal(s, 'exit', 'Buyers are interested in your company. Open exit.ts.');
    for (const u of UPGRADES) upgradeVisible(s, u);
    achTimer += dt;
    if (achTimer >= 1) { achTimer = 0; checkAchievements(s); }
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
    ENGINEERS, SUPPORT, ROLES, OFFICES, MARKETS, UPGRADES, FEATURES, PERKS, ACHIEVEMENTS, MIN_SHIP, EXIT_VALUATION,
    createState, tick, click, ship, canShip, hotfix, claimViral, hire, bulk, moveOffice, buyMarket,
    upgradeVisible, canAfford, buyUpgrade, featureState, featureCost, buyFeature, buyPerk,
    deliver, contractOk, setRefactor, exit, checkAchievements, bestEngineer, touch,
    mods, rates, mrr, baseMrr, saturation, shipGain, shipRep, debtPct, quality, clickValue, flowMult, seats, headcount,
    staffCost, roleUnlocked, staffBug, teamBug, valuation, fpGain, incidentChance, versionStr, cap, deployTime,
    officeCost, marketCost, isSupport, fmt,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GitRich = api;
})(this);
