// Game content: every role, upgrade, feature, perk, goal, decision, challenge and talent.
// Pure data plus small rule functions; the engine applies them.
import type {
  Achievement, BoardSeat, Challenge, Cost, Decision, EngineerDef, Feature, GameState, Goal, Market, ModFx, Mods,
  Office, Perk, Rarity, Reward, RoleDef, SupportDef, TalentDef, Upgrade, UpgradeCategory,
} from './types.ts';
import { addTemp, exitNeed, headcount, debtPct, mods, mrr, rates, saturation, talentDef, touch, valuation } from './engine.ts';

export const GROWTH = 1.2;
export const SUPPORT_GROWTH = 1.22;
export const MIN_SHIP = 10;
export const MRR_PER_LOC = 0.002;
export const LAUNCH_SECONDS = 90;
export const CONTRACT_PAY = 0.8;
export const EXIT_VALUATION = 5e7;
export const VALUATION_MULT = 500;

// ---------- roles ----------
export const ENGINEERS: EngineerDef[] = [
  { id: 'intern', name: 'Intern', cost: 15, out: 1, bug: 0.4, rep: 0, note: 'Fast and eager. Writes a lot of bugs.' },
  { id: 'junior', name: 'Junior Dev', cost: 120, out: 6, bug: 0.3, rep: 0, note: 'Solid output, still learning.' },
  { id: 'senior', name: 'Senior Dev', cost: 1400, out: 35, bug: 0.1, rep: 60, note: 'Clean code. Expensive.' },
  { id: 'lead', name: 'Tech Lead', cost: 18000, out: 200, bug: 0.05, rep: 500, note: 'Very clean code at scale.' },
  { id: 'copilot', name: 'AI Copilot', cost: 400000, out: 2500, bug: 0.45, rep: 0, needs: 'ml', note: 'Huge output. Hallucinates bugs.' },
  { id: 'principal', name: 'Principal Engineer', cost: 5e6, out: 15000, bug: 0.03, rep: 20000, note: 'Writes almost no bugs.' },
];
// Support roles write no code. Each one bends a different rule, and they all take seats.
export const SUPPORT: SupportDef[] = [
  { id: 'qa', name: 'QA Engineer', cost: 800, rep: 40, note: 'Each one: all code has 3% fewer bugs.', fx: (m: Mods, n: number) => { m.allBug *= Math.pow(0.97, n); } },
  { id: 'marketer', name: 'Marketer', cost: 1500, rep: 80, note: 'Each one: +4% Reputation, trending events come sooner.', fx: (m: Mods, n: number) => { m.rep *= 1 + 0.04 * n; m.viralEvery *= Math.pow(0.97, n); } },
  { id: 'pm', name: 'Product Manager', cost: 2500, rep: 150, note: 'Each one: releases earn 5% more.', fx: (m: Mods, n: number) => { m.mrr *= 1 + 0.05 * n; } },
  { id: 'designer', name: 'Designer', cost: 6000, rep: 400, note: 'Each one: every market is 3% bigger.', fx: (m: Mods, n: number) => { m.cap *= 1 + 0.03 * n; } },
  { id: 'sre', name: 'Site Reliability Eng.', cost: 25000, rep: 1500, note: 'Each one: incidents 6% less likely and shorter.', fx: (m: Mods, n: number) => { m.incident *= Math.pow(0.94, n); m.incDur *= Math.pow(0.95, n); } },
];
export const ROLES: RoleDef[] = [...ENGINEERS, ...SUPPORT];

export const OFFICES: Office[] = [
  { name: 'Garage', seats: 3, cost: 0, rep: 0 },
  { name: 'Co-working desk', seats: 10, cost: 150, rep: 0 },
  { name: 'Small office', seats: 25, cost: 2000, rep: 60 },
  { name: 'Startup loft', seats: 60, cost: 50000, rep: 1200 },
  { name: 'Office floor', seats: 150, cost: 600000, rep: 4000 },
  { name: 'Glass tower', seats: 400, cost: 15e6, rep: 30000 },
  { name: 'Campus', seats: 1200, cost: 2e9, rep: 300000 },
];

// Market size caps MRR: income saturates as you approach the cap.
export const MARKETS: Market[] = [
  { name: 'Hometown', cap: 15, cost: 0, rep: 0 },
  { name: 'Nationwide', cap: 300, cost: 900, rep: 30 },
  { name: 'Continental', cap: 15000, cost: 60000, rep: 800 },
  { name: 'Global', cap: 750000, cost: 4e7, rep: 60000 },
  { name: 'Interplanetary', cap: 4e7, cost: 2e9, rep: 4e5 },
  { name: 'Multiverse', cap: 2e9, cost: 2e11, rep: 2e7 },
];

// ---------- upgrades ----------
// Every upgrade changes a rule through fx(m). show(s) decides when it first appears.
export const UPGRADES: Upgrade[] = [];
const U = (id: string, cat: UpgradeCategory, name: string, desc: string, cost: Cost, show: (s: GameState) => boolean, fx: ModFx) => UPGRADES.push({ id, cat, name, desc, cost, show, fx });

// Role tracks: each engineer type gets five upgrades at 1/10/25/50/100 hired.
export const TRACK_AT: number[] = [1, 10, 25, 50, 100];
export const TRACK_COST: number[] = [10, 60, 400, 6000, 1e6];
const TRACKS: Record<string, [string, string, ModFx][]> = {
  intern: [
    ['Coffee Runs', 'Interns write ×2 code.', (m: Mods) => { m.out.intern *= 2; }],
    ['Onboarding Docs', 'Interns write 30% fewer bugs.', (m: Mods) => { m.bug.intern *= 0.7; }],
    ['Internship Program', 'Every Intern makes Juniors 1% faster.', (m: Mods) => { m.syn.push(['intern', 'junior', 0.01]); }],
    ['Return Offers', 'Interns write ×3 code.', (m: Mods) => { m.out.intern *= 3; }],
    ['Intern Army', 'Interns write ×4 code, but 20% more bugs.', (m: Mods) => { m.out.intern *= 4; m.bug.intern *= 1.2; }],
  ],
  junior: [
    ['Rubber Duck', 'Juniors write ×2 code.', (m: Mods) => { m.out.junior *= 2; }],
    ['Code Katas', 'Juniors write 30% fewer bugs.', (m: Mods) => { m.bug.junior *= 0.7; }],
    ['Bootcamp Pipeline', 'Juniors cost 25% less to hire.', (m: Mods) => { m.cost.junior *= 0.75; }],
    ['Growth Plans', 'Juniors write ×3 code.', (m: Mods) => { m.out.junior *= 3; }],
    ['Promotion Track', 'Every Junior makes Seniors 0.5% faster.', (m: Mods) => { m.syn.push(['junior', 'senior', 0.005]); }],
  ],
  senior: [
    ['Noise-cancelling Headphones', 'Seniors write ×2 code.', (m: Mods) => { m.out.senior *= 2; }],
    ['Mentorship', 'Every Senior makes Interns and Juniors 2% faster.', (m: Mods) => { m.syn.push(['senior', 'intern', 0.02], ['senior', 'junior', 0.02]); }],
    ['Design Docs', 'All code has 10% fewer bugs.', (m: Mods) => { m.allBug *= 0.9; }],
    ['Architecture Reviews', 'Big-team bugs (Brooks\'s law) −25%.', (m: Mods) => { m.brooks *= 0.75; }],
    ['10x Engineers', 'Seniors write ×3 code.', (m: Mods) => { m.out.senior *= 3; }],
  ],
  lead: [
    ['Daily Standups', 'Tech Leads write ×2 code.', (m: Mods) => { m.out.lead *= 2; }],
    ['Sprint Planning', 'Deploys take half as long.', (m: Mods) => { m.deploy *= 0.5; }],
    ['Tech Radar', 'Refactoring is 50% more effective.', (m: Mods) => { m.refactor *= 1.5; }],
    ['Engineering Ladder', 'All engineers write 10% more code.', (m: Mods) => { m.allOut *= 1.1; }],
    ['Org Design', 'Every office has 25% more seats.', (m: Mods) => { m.seats *= 1.25; }],
  ],
  copilot: [
    ['Prompt Engineering', 'AI Copilots write 30% fewer bugs.', (m: Mods) => { m.bug.copilot *= 0.7; }],
    ['Fine-tuning', 'AI Copilots write ×2 code.', (m: Mods) => { m.out.copilot *= 2; }],
    ['Guardrails', 'AI Copilots write 40% fewer bugs.', (m: Mods) => { m.bug.copilot *= 0.6; }],
    ['Agentic Workflows', 'AI Copilots write ×3 code.', (m: Mods) => { m.out.copilot *= 3; }],
    ['Self-review', 'AI Copilots write 50% fewer bugs.', (m: Mods) => { m.bug.copilot *= 0.5; }],
  ],
  principal: [
    ['Tech Strategy', 'All engineers write 10% more code.', (m: Mods) => { m.allOut *= 1.1; }],
    ['RFC Culture', 'All code has 15% fewer bugs.', (m: Mods) => { m.allBug *= 0.85; }],
    ['Platform Team', 'Big-team bugs (Brooks\'s law) −50%.', (m: Mods) => { m.brooks *= 0.5; }],
    ['Open Source Fame', 'Reputation gains ×1.5.', (m: Mods) => { m.rep *= 1.5; }],
    ['Living Legend', 'Principal Engineers write ×3 code.', (m: Mods) => { m.out.principal *= 3; }],
  ],
};
for (const d of ENGINEERS) {
  TRACKS[d.id].forEach(([name, desc, fx], i) => {
    U(`${d.id}${i}`, 'roles', name, desc, { money: d.cost * TRACK_COST[i] }, (s: GameState) => s.staff[d.id] >= TRACK_AT[i], fx);
  });
}

// Tools: your own typing.
U('keyboard', 'tools', 'Mechanical Keyboard', 'Flow can build up to ×2.5.', { money: 60 }, (s: GameState) => s.stats.clicks >= 60, (m: Mods) => { m.flowCap += 0.5; });
U('lofi', 'tools', 'Lo-fi Beats', 'Flow builds 50% faster.', { money: 200 }, (s: GameState) => s.stats.clicks >= 250, (m: Mods) => { m.flowGain *= 1.5; });
U('monitors', 'tools', 'Dual Monitors', 'Clicks write ×1.5 code.', { money: 900 }, (s: GameState) => s.stats.clicks >= 500, (m: Mods) => { m.click *= 1.5; });
U('darkmode', 'tools', 'Dark Theme', 'Flow drains 50% slower.', { money: 3000 }, (s: GameState) => s.stats.clicks >= 1000, (m: Mods) => { m.flowDecay *= 0.5; });
U('vim', 'tools', 'Vim Motions', 'Each click also adds 0.5% more of your team\'s output.', { loc: 5000 }, (s: GameState) => s.stats.clicks >= 1500, (m: Mods) => { m.clickPct += 0.005; });
U('snippets', 'tools', 'Snippet Library', 'Clicks write ×1.5 code.', { money: 40000 }, (s: GameState) => s.stats.clicks >= 2500, (m: Mods) => { m.click *= 1.5; });
U('espresso', 'tools', 'Espresso Machine', 'Flow can build up to ×3.', { money: 250000 }, (s: GameState) => s.stats.clicks >= 4000, (m: Mods) => { m.flowCap += 0.5; });
U('autocomplete', 'tools', 'AI Autocomplete', 'Clicks write ×2 code.', { loc: 2e6 }, (s: GameState) => !!s.done.ml, (m: Mods) => { m.click *= 2; });

// Process: how code gets made. Paid in code, so it competes with shipping.
U('tests', 'process', 'Unit Tests', 'All new code has 30% fewer bugs.', { loc: 300 }, (s: GameState) => debtPct(s) > 0.08, (m: Mods) => { m.allBug *= 0.7; });
U('linter', 'process', 'Linter', 'All new code has 15% fewer bugs.', { loc: 1200 }, (s: GameState) => !!s.done.tests, (m: Mods) => { m.allBug *= 0.85; });
U('typing', 'process', 'Static Typing', 'All new code has 25% fewer bugs.', { loc: 2500 }, (s: GameState) => !!s.done.tests && s.stats.ships >= 3, (m: Mods) => { m.allBug *= 0.75; });
U('pair', 'process', 'Pair Programming', 'Interns and Juniors write 50% fewer bugs.', { money: 3000 }, (s: GameState) => s.staff.junior >= 5, (m: Mods) => { m.bug.intern *= 0.5; m.bug.junior *= 0.5; });
U('review', 'process', 'Code Review', 'Refactoring removes debt twice as fast.', { loc: 6000 }, (s: GameState) => s.staff.senior >= 1, (m: Mods) => { m.refactor *= 2; });
U('cicd', 'process', 'CI/CD Pipeline', 'Auto-ship: releases go out on their own while debt is under your limit.', { loc: 20000 }, (s: GameState) => s.stats.ships >= 15, (m: Mods) => { m.autoShip = true; });
U('trunk', 'process', 'Trunk-based Development', 'Deploys take half as long.', { loc: 15000 }, (s: GameState) => s.stats.ships >= 25, (m: Mods) => { m.deploy *= 0.5; });
U('flags', 'process', 'Feature Flags', 'Incidents after a release are half as likely.', { loc: 40000 }, (s: GameState) => s.stats.incidents >= 2, (m: Mods) => { m.incident *= 0.5; });
U('monitor', 'process', 'Monitoring & Alerts', 'Incidents fade 3× faster.', { money: 60000 }, (s: GameState) => s.stats.incidents >= 3, (m: Mods) => { m.incDur /= 3; });
U('postmortem', 'process', 'Blameless Postmortems', 'Every fixed incident gives Reputation instead of costing it.', { money: 20000 }, (s: GameState) => s.stats.incidents >= 4, (m: Mods) => { m.postmortem = true; });
U('chaos', 'process', 'Chaos Engineering', 'Hotfixes need half the clicks.', { loc: 120000 }, (s: GameState) => s.stats.incidents >= 8, (m: Mods) => { m.hotfix *= 0.5; });
U('debtsprint', 'process', 'Debt Sprints', 'Refactoring is 50% more effective.', { loc: 250000 }, (s: GameState) => s.refactor >= 0.3, (m: Mods) => { m.refactor *= 1.5; });
U('ml', 'process', 'Machine Learning', 'Unlocks the AI Copilot hire.', { loc: 300000 }, (s: GameState) => s.rep >= 1500, () => {});
U('micro', 'process', 'Microservices', 'Big-team bugs halved, and debt hurts income half as much.', { loc: 300000 }, (s: GameState) => headcount(s) >= 50, (m: Mods) => { m.brooks *= 0.5; m.debtHurt *= 0.5; });
U('k8s', 'process', 'Kubernetes', 'Deploys are instant. Incidents 25% less likely.', { loc: 2e6 }, (s: GameState) => !!s.done.micro, (m: Mods) => { m.deploy *= 0.1; m.incident *= 0.75; });

// People: the whole team.
U('so', 'people', 'Stack Overflow Account', 'Your team writes 25% more code.', { money: 250 }, (s: GameState) => headcount(s) >= 3, (m: Mods) => { m.allOut *= 1.25; });
U('lunch', 'people', 'Free Lunch', 'Your team writes 15% more code.', { money: 5000 }, (s: GameState) => headcount(s) >= 15, (m: Mods) => { m.allOut *= 1.15; });
U('hackathon', 'people', 'Hackathon Culture', 'Your flow also speeds up the team, up to +50%.', { money: 8000 }, (s: GameState) => s.staff.senior >= 3, (m: Mods) => { m.flowTeam += 0.5; });
U('recruiter', 'people', 'In-house Recruiter', 'All hires cost 15% less.', { money: 12000 }, (s: GameState) => headcount(s) >= 25, (m: Mods) => { m.allCost *= 0.85; });
U('offsite', 'people', 'Team Offsite', 'Big-team bugs (Brooks\'s law) −20%.', { money: 30000 }, (s: GameState) => headcount(s) >= 30, (m: Mods) => { m.brooks *= 0.8; });
U('fourday', 'people', 'Four-day Week', 'Team writes 10% less code, but 30% fewer bugs.', { money: 100000 }, (s: GameState) => headcount(s) >= 60, (m: Mods) => { m.allOut *= 0.9; m.allBug *= 0.7; });
U('remote', 'people', 'Remote Work', 'Every office has 50% more seats.', { money: 2e6 }, (s: GameState) => s.office >= 4, (m: Mods) => { m.seats *= 1.5; });
U('brand', 'people', 'Employer Branding', 'All hires cost 25% less.', { money: 5e6 }, (s: GameState) => headcount(s) >= 120, (m: Mods) => { m.allCost *= 0.75; });

// Growth: product income, Reputation, markets.
U('abtest', 'growth', 'A/B Testing', 'Release income +15%.', { money: 1500 }, (s: GameState) => s.stats.ships >= 5, (m: Mods) => { m.mrr *= 1.15; });
U('newsletter', 'growth', 'Newsletter', 'Reputation gains +25%.', { money: 2000 }, (s: GameState) => s.rep >= 100, (m: Mods) => { m.rep *= 1.25; });
U('seo', 'growth', 'SEO', 'Every market is 20% bigger.', { money: 6000 }, (s: GameState) => saturation(s) >= 0.5, (m: Mods) => { m.cap *= 1.2; });
U('referral', 'growth', 'Referral Program', 'Release income +20%.', { money: 25000 }, (s: GameState) => s.stats.ships >= 30, (m: Mods) => { m.mrr *= 1.2; });
U('talks', 'growth', 'Conference Talks', 'Trending events come 30% sooner.', { money: 15000 }, (s: GameState) => s.stats.virals >= 2, (m: Mods) => { m.viralEvery *= 0.7; });
U('influencer', 'growth', 'Influencer Deals', 'Trending events boost income ×3 instead of ×2.', { money: 80000 }, (s: GameState) => s.stats.virals >= 4, (m: Mods) => { m.viralBoost = Math.max(m.viralBoost, 3); });
U('press', 'growth', 'Press Kit', 'Reputation gains ×1.5.', { money: 150000 }, (s: GameState) => s.rep >= 2000, (m: Mods) => { m.rep *= 1.5; });
U('annual', 'growth', 'Annual Plans', 'Release income ×1.3.', { money: 400000 }, (s: GameState) => s.market >= 2, (m: Mods) => { m.mrr *= 1.3; });
U('community', 'growth', 'Community Forum', 'Every market is 30% bigger.', { money: 1.5e6 }, (s: GameState) => s.market >= 3, (m: Mods) => { m.cap *= 1.3; });

// Clients.
U('deck', 'clients', 'Sales Deck', 'Client work pays 25% more.', { money: 300 }, (s: GameState) => s.stats.contracts >= 3, (m: Mods) => { m.pay *= 1.25; });
U('casestudy', 'clients', 'Case Studies', 'Client work gives ×2 Reputation.', { money: 2000 }, (s: GameState) => s.stats.contracts >= 6, (m: Mods) => { m.contractRep *= 2; });
U('accountmgr', 'clients', 'Account Manager', '+1 client offer slot.', { money: 10000 }, (s: GameState) => s.stats.contracts >= 10, (m: Mods) => { m.slots += 1; });
U('agency', 'clients', 'Agency Rates', 'Client work pays 50% more.', { money: 60000 }, (s: GameState) => s.stats.contracts >= 15, (m: Mods) => { m.pay *= 1.5; });
U('retainer', 'clients', 'Retainer Deals', 'Client offers last twice as long, +1 slot.', { money: 300000 }, (s: GameState) => s.stats.contracts >= 25, (m: Mods) => { m.slots += 1; m.contractTime *= 2; });

// ---------- product features ----------
// Built with unshipped code. Some come in pairs: pick one per company.
export const FEATURES: Feature[] = [
  { id: 'login', tier: 1, name: 'Accounts & Login', desc: 'Release income +25%.', cost: 50, fx: (m: Mods) => { m.mrr *= 1.25; } },
  { id: 'dashboard', tier: 1, name: 'Dashboard', desc: 'Releases give 25% more Reputation.', cost: 400, req: ['login'], fx: (m: Mods) => { m.rep *= 1.25; } },
  { id: 'freemium', tier: 2, fork: 'pricing', name: 'Freemium', desc: 'Markets 50% bigger, Reputation +50%, but each line earns 20% less.', cost: 1500, req: ['login'], fx: (m: Mods) => { m.cap *= 1.5; m.rep *= 1.5; m.perLoc *= 0.8; } },
  { id: 'enterprise', tier: 2, fork: 'pricing', name: 'Enterprise Sales', desc: 'Each line earns ×1.5, client work pays 50% more, but markets are 20% smaller.', cost: 1500, req: ['login'], fx: (m: Mods) => { m.perLoc *= 1.5; m.pay *= 1.5; m.cap *= 0.8; } },
  { id: 'payments', tier: 2, name: 'Payments', desc: 'Release income ×1.3.', cost: 3000, req: ['login'], fx: (m: Mods) => { m.mrr *= 1.3; } },
  { id: 'notifications', tier: 3, name: 'Notifications', desc: 'Trending events come 30% sooner.', cost: 6000, req: ['dashboard'], fx: (m: Mods) => { m.viralEvery *= 0.7; } },
  { id: 'api', tier: 3, name: 'Public API', desc: '+1 client slot. Unlocks Integration jobs that pay ×2.', cost: 15000, req: ['payments'], fx: (m: Mods) => { m.slots += 1; m.integrations = true; } },
  { id: 'mobile', tier: 3, fork: 'platform', name: 'Mobile App', desc: 'Markets 30% bigger, Reputation ×1.3.', cost: 30000, req: ['payments'], fx: (m: Mods) => { m.cap *= 1.3; m.rep *= 1.3; } },
  { id: 'desktop', tier: 3, fork: 'platform', name: 'Desktop App', desc: 'Release income ×1.3, incidents 30% less likely.', cost: 30000, req: ['payments'], fx: (m: Mods) => { m.mrr *= 1.3; m.incident *= 0.7; } },
  { id: 'search', tier: 4, name: 'Search', desc: 'Release income ×1.25.', cost: 60000, req: ['dashboard'], fx: (m: Mods) => { m.mrr *= 1.25; } },
  { id: 'analytics', tier: 4, name: 'Analytics', desc: 'Releases give 30% more Reputation, markets 10% bigger.', cost: 120000, req: ['search'], fx: (m: Mods) => { m.rep *= 1.3; m.cap *= 1.1; } },
  { id: 'i18n', tier: 4, name: 'Localization', desc: 'Every market is 30% bigger.', cost: 500000, req: ['analytics'], fx: (m: Mods) => { m.cap *= 1.3; } },
  { id: 'integrations', tier: 5, name: 'Integrations Marketplace', desc: 'Release income ×1.3, markets 15% bigger.', cost: 300000, req: ['api'], fx: (m: Mods) => { m.mrr *= 1.3; m.cap *= 1.15; } },
  { id: 'ai', tier: 5, fork: 'moat', name: 'AI Assistant', desc: 'Release income ×2, but all code has 20% more bugs.', cost: 1e6, req: ['search'], fx: (m: Mods) => { m.mrr *= 2; m.allBug *= 1.2; } },
  { id: 'selfhost', tier: 5, fork: 'moat', name: 'Self-hosting', desc: 'Debt hurts income half as much, client work pays ×2.', cost: 1e6, req: ['search'], fx: (m: Mods) => { m.debtHurt *= 0.5; m.pay *= 2; } },
  { id: 'sso', tier: 6, name: 'SSO & Audit Logs', desc: 'Client work pays ×2.', cost: 2e6, req: ['integrations'], fx: (m: Mods) => { m.pay *= 2; } },
  { id: 'realtime', tier: 6, name: 'Real-time Collaboration', desc: 'Release income ×2.', cost: 5e6, req: ['i18n'], fx: (m: Mods) => { m.mrr *= 2; } },
  { id: 'ecosystem', tier: 7, name: 'Platform Ecosystem', desc: 'Release income ×2, Reputation ×2.', cost: 2e7, req: ['realtime', 'sso'], fx: (m: Mods) => { m.mrr *= 2; m.rep *= 2; } },
];

// ---------- founder perks (bought with Founder Points after selling) ----------
export const PERKS: Perk[] = [
  { id: 'serial', cost: 1, name: 'Serial Founder', desc: 'Start every company with $500 and a co-working desk.' },
  { id: 'friends', cost: 1, name: 'Old Friends', desc: 'Your first 3 client jobs each run pay ×5.' },
  { id: 'muscle', cost: 1, name: 'Muscle Memory', desc: 'Flow drains 50% slower and builds 50% faster.', fx: (m: Mods) => { m.flowDecay *= 0.5; m.flowGain *= 1.5; } },
  { id: 'night', cost: 1, name: 'Night Owl', desc: 'Offline progress lasts up to 8 hours instead of 2.' },
  { id: 'network', cost: 2, name: 'Network', desc: 'Start every company with 100 Reputation.' },
  { id: 'autodeploy', cost: 2, name: 'DevOps Background', desc: 'Start with CI/CD Pipeline already set up.' },
  { id: 'angel', cost: 3, name: 'Angel Investor', desc: 'Start every company with $25K.' },
  { id: 'playbook', cost: 3, name: 'Playbook', desc: 'Keep all Tools upgrades when you sell.' },
  { id: 'autohire', cost: 3, name: 'Auto-Recruiter', desc: 'Unlocks auto-hiring of engineers.' },
  { id: 'magnet', cost: 3, name: 'Talent Magnet', desc: 'All hires cost 20% less.', fx: (m: Mods) => { m.allCost *= 0.8; } },
  { id: 'product', cost: 3, name: 'Product Sense', desc: 'Product features cost 30% less.', fx: (m: Mods) => { m.featureCost *= 0.7; } },
  { id: 'veteran', cost: 4, name: 'Process Veteran', desc: 'Keep all Process upgrades when you sell.' },
  { id: 'instinct', cost: 4, name: 'Market Instinct', desc: 'Markets and offices cost 40% less.', fx: (m: Mods) => { m.expandCost *= 0.6; } },
  { id: 'unicorn', cost: 6, name: 'Unicorn Hunter', desc: 'Selling gives 50% more Founder Points.', fx: (m: Mods) => { m.fpGain *= 1.5; } },
  { id: 'bounty', cost: 1, name: 'Bug Bounty', desc: 'Squashing a bug pays 3×.', fx: (m: Mods) => { m.bugReward *= 3; } },
  { id: 'negotiator', cost: 2, name: 'Negotiator', desc: 'Decisions that pay you cash pay 50% more.', fx: (m: Mods) => { m.decisionPay *= 1.5; } },
  { id: 'botarmy', cost: 4, name: 'Bot Army', desc: 'Start every company with Zapier Flows and Refactor Bot.' },
];

// ---------- achievements (+1% code and income each, kept forever) ----------
export const ACHIEVEMENTS: Achievement[] = ([
  ['hello', 'Hello, World!', 'Write your first line.', (s: GameState) => s.stats.clicks >= 1],
  ['typist', 'Touch Typist', 'Click 1,000 times in one company.', (s: GameState) => s.stats.clicks >= 1000],
  ['keyboard', 'Keyboard Warrior', 'Click 10,000 times in total.', (s: GameState) => s.life.clicks >= 10000],
  ['zone', 'In the Zone', 'Reach full flow.', (s: GameState) => s.flow >= 100],
  ['shipit', 'Ship It', 'Ship your first release.', (s: GameState) => s.stats.ships >= 1],
  ['v1', 'v1.0', 'Ship 10 releases in one company.', (s: GameState) => s.stats.ships >= 10],
  ['cadence', 'Release Cadence', 'Ship 100 releases in one company.', (s: GameState) => s.stats.ships >= 100],
  ['client', 'First Client', 'Deliver client work.', (s: GameState) => s.stats.contracts >= 1],
  ['agency', 'Agency Life', 'Deliver 25 client jobs in total.', (s: GameState) => s.life.contracts >= 25],
  ['hire', 'Not Alone Anymore', 'Hire your first employee.', (s: GameState) => headcount(s) >= 1],
  ['team30', 'Pizza Team', 'Have 30 people.', (s: GameState) => headcount(s) >= 30],
  ['team100', 'Scale-up', 'Have 100 people.', (s: GameState) => headcount(s) >= 100],
  ['support', 'Full Stack Company', 'Have at least one of every support role.', (s: GameState) => SUPPORT.every((d) => s.staff[d.id] > 0)],
  ['clean', 'Clean Code', 'Ship 1,000+ lines with debt under 2%.', (s: GameState) => s.flags.cleanShip],
  ['yolo', 'YOLO Deploy', 'Ship with 40%+ debt.', (s: GameState) => s.flags.yolo],
  ['fire', 'Firefighter', 'Fix 10 incidents by hand in total.', (s: GameState) => s.life.hotfixes >= 10],
  ['viral', 'Trending', 'Ride a trending event.', (s: GameState) => s.stats.virals >= 1],
  ['national', 'Going National', 'Launch Nationwide.', (s: GameState) => s.market >= 1],
  ['global', 'Going Global', 'Launch Global.', (s: GameState) => s.market >= 3],
  ['features5', 'Feature Factory', 'Build 5 product features.', (s: GameState) => Object.keys(s.features).length >= 5],
  ['forks', 'Decisive', 'Choose all three product strategies in one company.', (s: GameState) => ['pricing', 'platform', 'moat'].every((f) => FEATURES.some((x) => x.fork === f && s.features[x.id]))],
  ['upgrades20', 'Optimizer', 'Own 20 upgrades in one company.', (s: GameState) => Object.keys(s.done).length >= 20],
  ['k1', 'Ramen Profitable', 'Earn $1K in one company.', (s: GameState) => s.stats.runMoney >= 1e3],
  ['m1', 'Millionaire', 'Earn $1M in one company.', (s: GameState) => s.stats.runMoney >= 1e6],
  ['b1', 'Billionaire', 'Earn $1B in one company.', (s: GameState) => s.stats.runMoney >= 1e9],
  ['exit1', 'Exit', 'Sell a company.', (s: GameState) => s.exits >= 1],
  ['exit5', 'Serial Founder', 'Sell 5 companies.', (s: GameState) => s.exits >= 5],
  ['speedrun', 'Speedrun', 'Sell a company within 20 minutes.', (s: GameState) => s.flags.speedrun],
  ['duck', 'Rubber Duck Debugging', 'Talk to the duck.', (s: GameState) => s.flags.duck],
  ['squash', 'Exterminator', 'Squash 25 bugs in total.', (s: GameState) => s.life.bugs >= 25],
  ['bounty', 'Bug Bounty Hunter', 'Squash 250 bugs in total.', (s: GameState) => s.life.bugs >= 250],
  ['todo', 'Inbox Zero', 'Finish every goal in TODO.md in one company.', (s: GameState) => s.goal >= GOALS.length],
  ['decider', 'Decision Maker', 'Make 10 decisions in total.', (s: GameState) => s.life.decisions >= 10],
  ['crunch', 'Crunch Mode', 'Say yes to crunch time.', (s: GameState) => s.flags.crunch],
  ['bots', 'Fully Automated', 'Own every workflow bot in one company.', (s: GameState) => UPGRADES.filter((u) => u.cat === 'automation').every((u) => s.done[u.id])],
  ['uptime', 'Zero Downtime', 'Ship 50 releases in one company without an incident.', (s: GameState) => s.stats.ships >= 50 && s.stats.incidents === 0],
  ['challenger', 'Challenger', 'Complete a challenge.', (s: GameState) => Object.keys(s.chDone).length >= 1],
  ['allchallenges', 'Hard Mode', 'Complete every challenge.', (s: GameState) => CHALLENGES.every((c) => s.chDone[c.id])],
  ['ipo', 'Ring the Bell', 'Take a company public.', (s: GameState) => s.ipos >= 1],
  ['chairman', 'Chairman of the Board', 'Own 5 Board Room seats.', (s: GameState) => Object.keys(s.board).length >= 5],
  ['legend', 'Living Legend', 'Hire a legendary talent.', (s: GameState) => s.talents.some((t) => talentDef(t.kind).rarity === 'legendary')],
  ['dreamteam', 'Dream Team', 'Have 5 talents at once.', (s: GameState) => s.talents.length >= MAX_TALENTS]
] as [string, string, string, (s: GameState) => boolean][]).map(([id, name, desc, check]) => ({ id, name, desc, check }));

// ---------- automation (workflows.yml) ----------
U('zapier', 'automation', 'Zapier Flows', 'Workflow: delivers client work by itself when you have the code.', { money: 15000 }, (s: GameState) => s.stats.contracts >= 8, (m: Mods) => { m.autoDeliver = true; });
U('refactorbot', 'automation', 'Refactor Bot', 'Workflow: moves the refactoring slider to hold debt near your target.', { loc: 25000 }, (s: GameState) => s.stats.incidents >= 3 || s.refactor > 0, (m: Mods) => { m.autoRefactor = true; });
U('dependabot', 'automation', 'Dependabot', 'Workflow: installs any upgrade that costs under 10% of what you have.', { money: 60000 }, (s: GameState) => Object.keys(s.done).length >= 20, (m: Mods) => { m.autoUpgrade = true; });
U('bugbot', 'automation', 'Bug Triage Bot', 'Workflow: squashes bugs before they escape.', { loc: 80000 }, (s: GameState) => s.stats.bugs >= 20, (m: Mods) => { m.autoBug = true; });
U('pipeline', 'automation', 'Recruiting Pipeline', 'Workflow: hires the best engineer whenever a seat is free.', { money: 500000 }, (s: GameState) => headcount(s) >= 60, (m: Mods) => { m.autoHire = true; });

// ---------- goals (TODO.md): one at a time, each pays a reward ----------
const payMoney = (sec: number, min: number) => (s: GameState) => ({ money: Math.max(min, mrr(s) * sec) });
const payLoc = (sec: number, min: number) => (s: GameState) => ({ loc: Math.max(min, rates(s).feature * sec) });
const payRep = (pct: number, min: number) => (s: GameState) => ({ rep: Math.max(min, s.rep * pct) });
const supportCount = (s: GameState) => SUPPORT.reduce((a, d) => a + s.staff[d.id], 0);
export const GOALS: Goal[] = ([
  ['Write 10 lines of code', (s: GameState) => [s.written, 10], payLoc(0, 10)],
  ['Deliver a client job', (s: GameState) => [s.stats.contracts, 1], payMoney(0, 25)],
  ['Hire your first person', (s: GameState) => [headcount(s), 1], payMoney(0, 20)],
  ['Ship your first release', (s: GameState) => [s.stats.ships, 1], payLoc(0, 30)],
  ['Build a product feature', (s: GameState) => [Object.keys(s.features).length, 1], payRep(0, 10)],
  ['Grow the team to 5 people', (s: GameState) => [headcount(s), 5], payMoney(15, 100)],
  ['Install 3 upgrades', (s: GameState) => [Object.keys(s.done).length, 3], payMoney(15, 150)],
  ['Reach 60 Reputation', (s: GameState) => [s.rep, 60], payMoney(20, 300)],
  ['Hire a Senior Dev', (s: GameState) => [s.staff.senior, 1], payLoc(15, 500)],
  ['Squash 5 bugs', (s: GameState) => [s.stats.bugs, 5], payMoney(25, 500)],
  ['Launch Nationwide', (s: GameState) => [s.market, 1], payMoney(25, 800)],
  ['Hire a support role', (s: GameState) => [supportCount(s), 1], payRep(0.1, 20)],
  ['Pick a pricing strategy', (s: GameState) => [s.features.freemium || s.features.enterprise ? 1 : 0, 1], payMoney(25, 1000)],
  ['Reach $50/s income', (s: GameState) => [mrr(s), 50], payLoc(25, 2000)],
  ['Grow the team to 25 people', (s: GameState) => [headcount(s), 25], payMoney(30, 3000)],
  ['Reach 1,000 Reputation', (s: GameState) => [s.rep, 1000], payMoney(30, 5000)],
  ['Install 20 upgrades', (s: GameState) => [Object.keys(s.done).length, 20], payMoney(30, 2000)],
  ['Hire a Tech Lead', (s: GameState) => [s.staff.lead, 1], payLoc(25, 4000)],
  ['Launch Continental', (s: GameState) => [s.market, 2], payMoney(40, 10000)],
  ['Reach $1K/s income', (s: GameState) => [mrr(s), 1000], payMoney(40, 20000)],
  ['Build 10 product features', (s: GameState) => [Object.keys(s.features).length, 10], payRep(0.2, 500)],
  ['Grow the team to 60 people', (s: GameState) => [headcount(s), 60], payMoney(40, 40000)],
  ['Reach a $10M valuation', (s: GameState) => [valuation(s), 1e7], payMoney(60, 100000)],
  ['Reach the sale target', (s: GameState) => [valuation(s), exitNeed(s)], payRep(0.25, 1000)],
] as [string, (s: GameState) => [number, number], (s: GameState) => Reward][]).map(([text, prog, reward], i) => ({ i, text, prog, reward }));

// ---------- decisions: two options, 30 s to choose ----------
export const inc = (s: GameState, sec: number, min: number) => Math.max(min, mrr(s) * sec) * mods(s).decisionPay;
export const DECISIONS: Decision[] = [
  { id: 'rush', title: 'Rush job', text: 'A client offers to pay big for a job due tonight.',
    a: ['Take it', '+90 s of income, +5 points of debt', (s: GameState) => { s.money += inc(s, 90, 200); s.debt += s.written * 0.05; }],
    b: ['Pass', 'keep a sane schedule', () => {}] },
  { id: 'crunch', title: 'Crunch time?', text: 'Investors want the launch moved up a week.',
    a: ['Crunch', 'team ×2 for 60 s, but ×3 bugs', (s: GameState) => { addTemp(s, 'out', 2, 60); addTemp(s, 'bug', 3, 60); s.flags.crunch = true; }],
    b: ['Push back', '+10% Reputation for being honest', (s: GameState) => { s.rep *= 1.1; }] },
  { id: 'oss', title: 'Open source it?', text: 'Your internal tooling could be a popular open-source project.',
    a: ['Open source', '+25% Reputation, lose 30% of unshipped code', (s: GameState) => { s.rep *= 1.25; s.loc *= 0.7; }],
    b: ['Keep it', '+45 s of income from licensing', (s: GameState) => { s.money += inc(s, 45, 100); }] },
  { id: 'poach', title: 'Poaching attempt', text: 'BigCorp is trying to hire away one of your Senior Devs.', when: (s: GameState) => s.staff.senior >= 2,
    a: ['Counter-offer', 'pay 1 min of income', (s: GameState) => { s.money = Math.max(0, s.money - Math.max(500, mrr(s) * 60)); }],
    b: ['Let them go', 'lose a Senior Dev', (s: GameState) => { if (s.staff.senior > 0) { s.staff.senior--; touch(s); } }] },
  { id: 'audit', title: 'Security audit', text: 'A big customer asks for a security audit before signing.',
    a: ['Do the audit', 'costs 30 s of code, incidents −50% for 5 min', (s: GameState) => { s.loc = Math.max(0, s.loc - rates(s).feature * 30); addTemp(s, 'incident', 0.5, 300); }],
    b: ['Skip it', '−5% Reputation', (s: GameState) => { s.rep *= 0.95; }] },
  { id: 'keynote', title: 'Keynote invite', text: 'A big conference wants you on stage.',
    a: ['Give the talk', 'pay 90 s of income, +30% Reputation, trending soon', (s: GameState) => { s.money = Math.max(0, s.money - Math.max(300, mrr(s) * 90)); s.rep *= 1.3; s.nextViral = s.t + 15; }],
    b: ['Stay and code', 'team +50% for 60 s', (s: GameState) => { addTemp(s, 'out', 1.5, 60); }] },
  { id: 'angel', title: 'Angel investor', text: 'An angel offers cash now for a slice of your future income.',
    a: ['Take the money', '+2.5 min of income now, −5% income for this company', (s: GameState) => { s.money += inc(s, 150, 1000); s.dilution *= 0.95; }],
    b: ['No thanks', 'keep your equity', () => {}] },
];

// ---------- challenges: a company with a hard rule, a permanent reward ----------
export const CHALLENGES: Challenge[] = [
  { id: 'solo', name: 'Solo Founder', rule: 'You cannot hire anyone, but your own clicks are ×5.', goal: 2.5e5, reward: 'Clicks ×2 and flow builds 50% faster, forever.',
    fx: (m: Mods) => { m.click *= 5; }, win: (m: Mods) => { m.click *= 2; m.flowGain *= 1.5; } },
  { id: 'legacy', name: 'Legacy Codebase', rule: 'Start with 40% tech debt; refactoring is half as effective.', goal: 1e8, reward: 'Refactoring is 50% more effective, forever.',
    fx: (m: Mods) => { m.refactor *= 0.5; }, win: (m: Mods) => { m.refactor *= 1.5; } },
  { id: 'bootstrap', name: 'Bootstrapped', rule: 'No client work.', goal: 1e8, reward: 'Release income ×1.25, forever.',
    fx: () => {}, win: (m: Mods) => { m.mrr *= 1.25; } },
  { id: 'movefast', name: 'Move Fast and Break Things', rule: 'Deploys are instant, but incidents are 3× as likely and last 3× longer.', goal: 1e8, reward: 'Incidents 25% less likely, forever.',
    fx: (m: Mods) => { m.deploy *= 0.05; m.incident *= 3; m.incDur *= 3; }, win: (m: Mods) => { m.incident *= 0.75; } },
  { id: 'ramen', name: 'Ramen Budget', rule: 'Hires, offices and markets cost 3×.', goal: 3e7, reward: 'Hires cost 10% less, forever.',
    fx: (m: Mods) => { m.allCost *= 3; m.expandCost *= 3; }, win: (m: Mods) => { m.allCost *= 0.9; } },
  { id: 'cowboy', name: 'Cowboy Coding', rule: 'No Process upgrades.', goal: 5e7, reward: 'All code has 15% fewer bugs, forever.',
    fx: () => {}, win: (m: Mods) => { m.allBug *= 0.85; } },
];

// ---------- IPO and the Board Room (second prestige layer) ----------
export const IPO_VALUATION = 2e10;
export const BOARD: BoardSeat[] = [
  { id: 'parachute', cost: 1, name: 'Golden Parachute', desc: 'Selling a company gives ×2 Founder Points.', fx: (m: Mods) => { m.fpGain *= 2; } },
  { id: 'alumni', cost: 1, name: 'Alumni Network', desc: 'Start every company with 6 Junior Devs, 2 Senior Devs and a small office.' },
  { id: 'household', cost: 2, name: 'Household Name', desc: 'Start every company with 2,000 Reputation and the Nationwide market.' },
  { id: 'venture', cost: 2, name: 'Venture Arm', desc: 'Start every company with $1M.' },
  { id: 'memory', cost: 3, name: 'Founder Memory', desc: 'Keep every perk that costs 1–2 Founder Points through an IPO.' },
  { id: 'suite', cost: 3, name: 'Automation Suite', desc: 'Start every company with all workflow bots and CI/CD.' },
  { id: 'campus2', cost: 4, name: 'Second Campus', desc: 'Every office has twice the seats.', fx: (m: Mods) => { m.seats *= 2; } },
  { id: 'marketmaker', cost: 5, name: 'Market Maker', desc: 'Every market is twice as big.', fx: (m: Mods) => { m.cap *= 2; } },
  { id: 'rnd', cost: 6, name: 'R&D Lab', desc: 'Product features cost 50% less.', fx: (m: Mods) => { m.featureCost *= 0.5; } },
  { id: 'dualclass', cost: 8, name: 'Dual-class Shares', desc: 'Each unspent Share gives +50% code and income instead of +25%.' },
];

// ---------- talents: rare, named hires with one unique effect each ----------
// They take a seat, stay through a sale, and leave at an IPO.
export const MAX_TALENTS = 5;
export const RARITY: Record<Rarity, { weight: number; pay: number; min: number }> = { common: { weight: 70, pay: 60, min: 400 }, rare: { weight: 25, pay: 180, min: 4000 }, legendary: { weight: 5, pay: 600, min: 40000 } };
export const TALENTS: TalentDef[] = [
  { id: 'refactorer', rarity: 'common', title: 'Refactoring Fanatic', desc: 'Refactoring is 30% more effective.', fx: (m: Mods) => { m.refactor *= 1.3; } },
  { id: 'pixel', rarity: 'common', title: 'Pixel Perfectionist', desc: 'Every market is 10% bigger.', fx: (m: Mods) => { m.cap *= 1.1; } },
  { id: 'whisperer', rarity: 'common', title: 'Bug Whisperer', desc: 'Squashing bugs pays ×2.', fx: (m: Mods) => { m.bugReward *= 2; } },
  { id: 'closer', rarity: 'common', title: 'Sales Closer', desc: 'Client work pays 30% more.', fx: (m: Mods) => { m.pay *= 1.3; } },
  { id: 'oncall', rarity: 'common', title: 'On-call Hero', desc: 'Incidents are 30% less likely.', fx: (m: Mods) => { m.incident *= 0.7; } },
  { id: 'mentor', rarity: 'common', title: 'Patient Mentor', desc: 'Interns and Juniors write 30% more code.', fx: (m: Mods) => { m.out.intern *= 1.3; m.out.junior *= 1.3; } },
  { id: 'typist', rarity: 'common', title: '200 WPM Typist', desc: 'Your clicks write 50% more code.', fx: (m: Mods) => { m.click *= 1.5; } },
  { id: 'tenx', rarity: 'rare', title: '10x Engineer', desc: 'All engineers write 25% more code.', fx: (m: Mods) => { m.allOut *= 1.25; } },
  { id: 'growth', rarity: 'rare', title: 'Growth Hacker', desc: 'Reputation gains +40%.', fx: (m: Mods) => { m.rep *= 1.4; } },
  { id: 'architect', rarity: 'rare', title: 'Systems Architect', desc: 'Big-team bugs (Brooks\'s law) −40%.', fx: (m: Mods) => { m.brooks *= 0.6; } },
  { id: 'visionary', rarity: 'rare', title: 'Product Visionary', desc: 'Releases earn 40% more.', fx: (m: Mods) => { m.mrr *= 1.4; } },
  { id: 'speaker', rarity: 'rare', title: 'Conference Darling', desc: 'Trending events come 40% sooner and boost income 50% more.', fx: (m: Mods) => { m.viralEvery *= 0.6; m.viralBoost *= 1.5; } },
  { id: 'wizard', rarity: 'legendary', title: 'Backend Wizard', desc: 'Senior Devs and Tech Leads write ×3 code.', fx: (m: Mods) => { m.out.senior *= 3; m.out.lead *= 3; } },
  { id: 'unicorn', rarity: 'legendary', title: 'Serial Unicorn Founder', desc: 'Selling a company gives 50% more Founder Points.', fx: (m: Mods) => { m.fpGain *= 1.5; } },
  { id: 'zen', rarity: 'legendary', title: 'Zen Code Monk', desc: 'All code has 40% fewer bugs.', fx: (m: Mods) => { m.allBug *= 0.6; } },
];
export const TALENT_NAMES: string[] = ['Ada', 'Bora', 'Cem', 'Deniz', 'Elif', 'Femi', 'Grace', 'Hana', 'Ines', 'Jun', 'Kai', 'Lena', 'Mira', 'Noor', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sven', 'Tariq', 'Uma', 'Vik', 'Wen', 'Yara', 'Zeki'];

export const CLIENTS: string[] = [
  'Crumb & Co. bakery', 'Dr. Ayla\'s dental clinic', 'Kadıköy Bikes', 'Moss Yoga Studio', 'Harbor Logistics',
  'Pine Street Library', 'Velvet Records', 'Northbank Credit Union', 'City Parking Office', 'Lumen Solar',
  'Brightside School', 'Atlas Insurance', 'Orbit Airlines', 'Ministry of Forms',
];
export const JOBS: string[] = ['landing page', 'booking system', 'inventory tool', 'mobile app', 'admin panel', 'payment flow', 'data migration', 'customer portal'];
