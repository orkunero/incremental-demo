// Pacing report: a scripted player plays several companies with the real rules.
// Usage: npm run sim -- [runs=6] [cps=5] [idleAfterMinutes]
import { fmt, valuation, ACHIEVEMENTS, FEATURES, GOALS, UPGRADES } from '../src/core/index.ts';
import { campaign, maxGap } from './bot.ts';

const [runsArg, cpsArg, idleArg] = process.argv.slice(2);
const runs = Number(runsArg ?? 6);
const cps = Number(cpsArg ?? 5);
const idleAfter = idleArg ? Number(idleArg) * 60 : undefined;
const mm = (t: number) => `${Math.floor(t / 60)}m${String(Math.floor(t % 60)).padStart(2, '0')}s`;

let total = 0;
for (const [i, r] of campaign(runs, { cps, idleAfter }).entries()) {
  const s = r.state;
  total += r.soldAt ?? s.t;
  const clickShare = r.clickLoc / Math.max(1, r.clickLoc + r.teamLoc);
  console.log(`company ${i + 1}: ${r.soldAt ? `${r.kind === 'ipo' ? 'IPO' : 'sold'} at ${mm(r.soldAt)} for $${fmt(valuation(s))}, +${r.gain} ${r.kind === 'ipo' ? 'Shares' : 'Founder Points'}` : 'not sold'}`
    + ` | upgrades ${Object.keys(s.done).length}/${UPGRADES.length} features ${Object.keys(s.features).length}/${FEATURES.length}`
    + ` goals ${s.goal}/${GOALS.length} achievements ${Object.keys(s.ach).length}/${ACHIEVEMENTS.length}`
    + ` | clicks ${(clickShare * 100).toFixed(0)}% of code, max gap ${maxGap(r.purchases, 0, 1800).toFixed(0)}s (first 30 min)`
    + ` | total ${(total / 3600).toFixed(1)} h`);
}
