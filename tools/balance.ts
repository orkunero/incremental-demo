// Balance check for CI: fails when pacing drifts out of the ranges the design targets.
// Run: npm run balance
import { campaign, maxGap } from './bot.ts';

const fails: string[] = [];
const report: string[] = [];
const min = (t: number | null) => (t == null ? 'never' : `${(t / 60).toFixed(1)} min`);
function expect(name: string, ok: boolean, detail: string) {
  report.push(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fails.push(name);
}

const active = campaign(6);
const first = active[0];
expect('active player sells the first company in 20–50 min', first.soldAt != null && first.soldAt >= 20 * 60 && first.soldAt <= 50 * 60, min(first.soldAt));
expect('first sale gives 2–8 Founder Points', first.kind === 'sale' && first.gain >= 2 && first.gain <= 8, `${first.gain}`);
expect('no purchase gap over 2 min in the first 15 min', maxGap(first.purchases, 0, 900) <= 120, `${maxGap(first.purchases, 0, 900).toFixed(0)} s`);
const ipoAt = active.findIndex((r) => r.kind === 'ipo');
const hoursToIpo = active.slice(0, ipoAt + 1).reduce((a, r) => a + (r.soldAt ?? 0), 0) / 3600;
expect('first IPO within 6 companies and 1.5–4 hours', ipoAt >= 0 && hoursToIpo >= 1.5 && hoursToIpo <= 4, ipoAt >= 0 ? `company ${ipoAt + 1}, ${hoursToIpo.toFixed(1)} h` : 'no IPO');
const later = active.slice(1).filter((r) => r.soldAt != null);
expect('later companies take at least 10 min', later.every((r) => (r.soldAt ?? 0) >= 600), later.map((r) => min(r.soldAt)).join(', '));

const casual = campaign(1, { idleAfter: 600 });
expect('casual player (clicks 10 min, then idles) sells in 25–60 min', casual[0].soldAt != null && casual[0].soldAt >= 25 * 60 && casual[0].soldAt <= 60 * 60, min(casual[0].soldAt));

console.log(report.join('\n'));
if (fails.length) {
  console.error(`\n${fails.length} balance check(s) failed`);
  process.exit(1);
}
