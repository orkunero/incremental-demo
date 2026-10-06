import { describe, expect, it } from 'vitest';
import * as G from '../src/core/index.ts';
import type { GameState } from '../src/core/index.ts';
import { seeded } from '../tools/bot.ts';

const finite = (s: GameState) => (['loc', 'money', 'rep', 'debt', 'written', 'mrrRaw'] as const).every((k) => Number.isFinite(s[k]) && s[k] >= 0);

/** A simple greedy player: buys everything it can, keeps debt in check, ships often. */
function grow(s: GameState, secs: number, opts: { squash?: boolean; decide?: boolean; seed?: number } = {}) {
  const rng = seeded(opts.seed ?? 1);
  const end = s.t + secs;
  while (s.t < end) {
    G.click(s);
    if (opts.squash && s.bugs.length) G.squash(s, s.bugs[0].id);
    if (opts.decide && s.decision) G.decide(s, 'a');
    if (s.incident) G.hotfix(s);
    for (const c of [...s.contracts]) G.deliver(s, c.id);
    for (const f of G.FEATURES) if (G.featureState(s, f) === 'open') G.buyFeature(s, f.id);
    G.buyMarket(s);
    const full = G.marketFull(s);
    for (const u of G.UPGRADES) if (G.upgradeVisible(s, u) && G.canAfford(s, u.cost) && !(full && u.cost.money)) G.buyUpgrade(s, u.id);
    if (!full) {
      if (G.headcount(s) >= G.seats(s) - 1) G.moveOffice(s);
      for (;;) { const b = G.bestEngineer(s); if (!b || !G.hire(s, b.id, 1)) break; }
    }
    const d = G.debtPct(s);
    G.setRefactor(s, d > 0.2 ? 0.5 : d > 0.13 ? 0.25 : 0);
    if (G.canShip(s) && s.loc > (G.rates(s).feature + 3) * 15) G.ship(s, rng);
    G.tick(s, 0.2, rng);
    s.events.length = 0;
  }
  return s;
}

describe('offline catch-up', () => {
  const s = grow(G.createState(), 600, { squash: true, decide: true });
  const debt0 = G.debtPct(s), feed0 = s.feed.length, money0 = s.money;
  for (let i = 0; i < 7200; i++) G.tick(s, 1, () => 0.999, { offline: true });
  it('keeps debt sane (no bugs escape while away)', () => expect(G.debtPct(s) - debt0).toBeLessThan(0.05));
  it('does not spam the log', () => expect(s.feed.length - feed0).toBeLessThan(10));
  it('earns money', () => expect(s.money).toBeGreaterThan(money0));
});

describe('edge cases', () => {
  it('poaching with no Senior Devs never goes negative', () => {
    const s = G.createState();
    s.decision = { id: 'poach', until: 100 };
    G.decide(s, 'b');
    expect(s.staff.senior).toBe(0);
  });
  it('cannot let go or promote someone you do not have', () => {
    const s = G.createState();
    expect(G.letGo(s, 'intern')).toBe(false);
    expect(G.promote(s, 'intern')).toBe(false);
  });
  it('ships even a tiny release', () => {
    const s = G.createState();
    s.revealed.ship = true;
    s.loc = 10;
    expect(G.ship(s, seeded(1))).toBe(true);
    expect(finite(s)).toBe(true);
  });
  it('every decision option runs on a fresh and a grown company', () => {
    for (const s of [G.createState(), grow(G.createState(), 900)]) {
      for (const d of G.DECISIONS) for (const o of ['a', 'b'] as const) {
        s.decision = { id: d.id, until: s.t + 30 };
        expect(() => G.decide(s, o)).not.toThrow();
      }
      expect(finite(s)).toBe(true);
    }
  });
});

describe('a full first company', () => {
  const s = grow(G.createState(), 2400, { squash: true });
  it('can be sold within 40 minutes', () => expect(G.valuation(s)).toBeGreaterThanOrEqual(G.exitNeed(s)));
  const sold = G.exit(s)!;
  it('selling gives Founder Points and raises the next target', () => {
    expect(sold.fp).toBeGreaterThan(0);
    expect(G.exitNeed(sold)).toBe(G.EXIT_VALUATION * 10);
  });

  describe('challenges', () => {
    it('Solo Founder blocks hiring', () => {
      const c = G.startChallenge(sold, 'solo')!;
      expect(c.challenge).toBe('solo');
      expect(G.hire(c, 'intern', 1)).toBe(0);
    });
    it('Legacy Codebase starts at 40% debt', () => expect(G.debtPct(G.startChallenge(sold, 'legacy')!)).toBeCloseTo(0.4, 2));
    it('Bootstrapped has no client work', () => {
      const c = grow(G.startChallenge(sold, 'bootstrap')!, 120);
      expect(c.contracts.length + c.stats.contracts).toBe(0);
    });
    it('Cowboy Coding hides Process upgrades until it is done', () => {
      const c = grow(G.startChallenge(sold, 'cowboy')!, 900);
      expect(c.chDone.cowboy || !G.UPGRADES.some((u) => u.cat === 'process' && (c.done[u.id] || c.seen[u.id]))).toBe(true);
    });
    it('cannot start a challenge twice', () => expect(G.startChallenge(G.createState({ chDone: { solo: true } }), 'solo')).toBeNull());
  });
});

describe('long run', () => {
  const s = grow(G.createState(), 7200, { squash: true, decide: true });
  it('stays finite', () => expect(finite(s)).toBe(true));
  it('a skipped goal never blocks the list', () => expect(s.goal).toBeGreaterThanOrEqual(G.GOALS.length - 1));
});

describe('saves', () => {
  it('a JSON round trip gives the same company', () => {
    const s = grow(G.createState(), 900, { squash: true, decide: true });
    const copy: GameState = Object.assign(G.createState({ perks: s.perks }), JSON.parse(JSON.stringify({ ...s, events: [] })));
    copy.events = [];
    copy.rev++;
    expect(G.valuation(copy)).toBeCloseTo(G.valuation(s), 6);
    grow(copy, 60);
    expect(finite(copy)).toBe(true);
  });
});

describe('perks and Board Room seats', () => {
  it('start bonuses apply to a new company', () => {
    const s = G.createState({ perks: { botarmy: true, autodeploy: true, serial: true, angel: true, network: true } });
    expect(s.done.zapier && s.done.refactorbot && s.done.cicd).toBe(true);
    expect(s.money).toBe(25500);
    expect(s.office).toBe(1);
  });
  it('apply right away when bought', () => {
    const s = G.createState({ fp: 10, shares: 10 });
    G.buyPerk(s, 'angel');
    expect(s.money).toBeGreaterThanOrEqual(25000);
    G.buyBoard(s, 'alumni');
    expect([s.staff.junior, s.staff.senior]).toEqual([6, 2]);
    expect(G.buyBoard(s, 'alumni')).toBe(false);
  });
});

describe('IPO', () => {
  const ready = () => {
    const s = G.createState({ exits: 3, fp: 7, perks: { serial: true, angel: true }, board: { memory: true }, ach: { hello: true } });
    s.revealed.ship = true;
    s.market = 4;
    s.mrrRaw = 1e12;
    return s;
  };
  it('needs the valuation', () => expect(G.ipo(G.createState({ exits: 3 }))).toBeNull());
  it('resets Founder Points and sales, keeps Shares, seats and achievements', () => {
    const pub = G.ipo(ready())!;
    expect(pub).not.toBeNull();
    expect([pub.fp, pub.exits]).toEqual([0, 0]);
    expect(pub.perks.serial && !pub.perks.angel).toBe(true);
    expect(pub.shares).toBeGreaterThan(0);
    expect(pub.ach.hello).toBe(true);
    expect(G.exitNeed(pub)).toBe(G.EXIT_VALUATION);
  });
  it('is not possible during a challenge', () => {
    const s = ready();
    s.challenge = 'solo';
    expect(G.canIpo(s)).toBe(false);
  });
});

describe('talents', () => {
  const s = grow(G.createState(), 900);
  it('the market opens with a team of 10', () => {
    expect(s.revealed.talents).toBe(true);
    expect(s.talentPool.length).toBeGreaterThan(0);
  });
  it('hiring takes a seat and survives a sale', () => {
    s.money = 1e9;
    if (G.headcount(s) >= G.seats(s)) G.letGo(s, 'intern');
    const cand = s.talentPool[0];
    const before = G.headcount(s);
    expect(G.hireTalent(s, cand.id)).toBe(true);
    expect(G.headcount(s)).toBe(before + 1);
    s.mrrRaw = 1e9;
    s.market = 3;
    s.revealed.ship = true;
    expect(G.exit(s)!.talents).toHaveLength(1);
    expect(G.releaseTalent(s, cand.id)).toBe(true);
  });
  it('never offers a talent you already have', () => {
    const t = G.createState({ talents: [{ id: 1, kind: 'tenx', name: 'X' }] });
    const rng = seeded(5);
    for (let i = 0; i < 200; i++) {
      t.nextTalents = 0;
      G.tick(t, 0.1, rng);
      expect(t.talentPool.some((c) => c.kind === 'tenx')).toBe(false);
    }
  });
});
