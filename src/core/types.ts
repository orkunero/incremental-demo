// Shared types for the game core. The core has no DOM, timers or Math.random:
// time and randomness are passed in, so the browser, tests and the simulation run the same rules.

export type Rng = () => number;
export type LogKind = 'info' | 'good' | 'bad' | 'ship' | 'reveal' | 'goal';
export type Rarity = 'common' | 'rare' | 'legendary';
export type UpgradeCategory = 'roles' | 'tools' | 'process' | 'people' | 'growth' | 'clients' | 'automation';

export interface Cost {
  money?: number;
  loc?: number;
}

/** Every rule an upgrade, feature, perk, talent or challenge can change. Rebuilt whenever `rev` changes. */
export interface Mods {
  out: Record<string, number>;
  bug: Record<string, number>;
  cost: Record<string, number>;
  /** [from role, to role, bonus per person] */
  syn: [string, string, number][];
  allOut: number;
  allBug: number;
  allCost: number;
  brooks: number;
  click: number;
  clickPct: number;
  flowCap: number;
  flowGain: number;
  flowDecay: number;
  flowTeam: number;
  mrr: number;
  perLoc: number;
  rep: number;
  cap: number;
  debtHurt: number;
  pay: number;
  contractRep: number;
  slots: number;
  contractTime: number;
  integrations: boolean;
  refactor: number;
  deploy: number;
  incident: number;
  incDur: number;
  hotfix: number;
  postmortem: boolean;
  viralEvery: number;
  viralBoost: number;
  seats: number;
  autoShip: boolean;
  featureCost: number;
  expandCost: number;
  fpGain: number;
  prestige: number;
  bugReward: number;
  decisionPay: number;
  autoDeliver: boolean;
  autoRefactor: boolean;
  autoUpgrade: boolean;
  autoBug: boolean;
  autoHire: boolean;
}

export type ModFx = (m: Mods) => void;

export interface EngineerDef {
  id: string;
  name: string;
  cost: number;
  out: number;
  bug: number;
  rep: number;
  needs?: string;
  note: string;
}
export interface SupportDef {
  id: string;
  name: string;
  cost: number;
  rep: number;
  note: string;
  fx: (m: Mods, n: number) => void;
  out?: undefined;
  bug?: undefined;
  needs?: undefined;
}
export type RoleDef = EngineerDef | SupportDef;

export interface Place {
  name: string;
  cost: number;
  rep: number;
}
export interface Office extends Place {
  seats: number;
}
export interface Market extends Place {
  cap: number;
}

export interface Upgrade {
  id: string;
  cat: UpgradeCategory;
  name: string;
  desc: string;
  cost: Cost;
  show: (s: GameState) => boolean;
  fx: ModFx;
}

export interface Feature {
  id: string;
  tier: number;
  fork?: string;
  name: string;
  desc: string;
  cost: number;
  req?: string[];
  fx: ModFx;
}
export type FeatureState = 'done' | 'open' | 'locked' | 'blocked';

export interface Perk {
  id: string;
  cost: number;
  name: string;
  desc: string;
  fx?: ModFx;
}
export type BoardSeat = Perk;

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  check: (s: GameState) => boolean;
}

export interface Reward {
  money?: number;
  loc?: number;
  rep?: number;
}
export interface Goal {
  i: number;
  text: string;
  prog: (s: GameState) => [number, number];
  reward: (s: GameState) => Reward;
}

export type DecisionOption = [label: string, effect: string, apply: (s: GameState) => void];
export interface Decision {
  id: string;
  title: string;
  text: string;
  when?: (s: GameState) => boolean;
  a: DecisionOption;
  b: DecisionOption;
}

export interface Challenge {
  id: string;
  name: string;
  rule: string;
  goal: number;
  reward: string;
  fx: ModFx;
  win: ModFx;
}

export interface TalentDef {
  id: string;
  rarity: Rarity;
  title: string;
  desc: string;
  fx: ModFx;
}
export interface TalentHire {
  id: number;
  kind: string;
  name: string;
}

export interface Contract {
  id: number;
  client: string;
  job: string;
  size: number;
  maxDebt: number | null;
  pay: number;
  rep: number;
  expires: number;
  life: number;
}

export interface Rates {
  team: number;
  feature: number;
  bug: number;
  refactor: number;
  byRole: Record<string, number>;
}

export interface FeedItem {
  t: number;
  text: string;
  kind: LogKind;
}

export interface Stats {
  clicks: number;
  ships: number;
  contracts: number;
  incidents: number;
  virals: number;
  runMoney: number;
  bugs: number;
  bugsEscaped: number;
  decisions: number;
}
export interface Life {
  clicks: number;
  ships: number;
  contracts: number;
  hotfixes: number;
  money: number;
  bugs: number;
  decisions: number;
}
export interface Flags {
  cleanShip: boolean;
  yolo: boolean;
  speedrun: boolean;
  duck: boolean;
  crunch?: boolean;
}

export interface GameState {
  v: number;
  t: number;
  /** Bumped whenever something that feeds `mods` changes. */
  rev: number;
  loc: number;
  money: number;
  rep: number;
  debt: number;
  written: number;
  mrrRaw: number;
  flow: number;
  lastClick: number;
  staff: Record<string, number>;
  office: number;
  market: number;
  done: Record<string, boolean>;
  seen: Record<string, boolean>;
  features: Record<string, boolean>;
  refactor: number;
  autoShip: boolean;
  autoShipDebt: number;
  autoHire: boolean;
  deployLeft: number;
  contracts: Contract[];
  nextContract: number;
  contractSeq: number;
  incident: { t: number; left: number; why: string } | null;
  viral: { until: number } | null;
  boostUntil: number;
  boostMult: number;
  nextViral: number;
  revealed: Record<string, boolean>;
  feed: FeedItem[];
  stats: Stats;
  flags: Flags;
  life: Life;
  version: [number, number];
  fp: number;
  fpTotal: number;
  exits: number;
  soldTotal: number;
  perks: Record<string, boolean>;
  ach: Record<string, boolean>;
  goal: number;
  goalsDone: Record<number, boolean>;
  bugs: { id: number; born: number; x: number; y: number }[];
  bugSeq: number;
  nextBug: number;
  decision: { id: string; until: number } | null;
  nextDecision: number;
  temp: { k: string; v: number; until: number }[];
  dilution: number;
  autoDeliver: boolean;
  autoRefactor: boolean;
  refactorTarget: number;
  autoUpgrade: boolean;
  autoBug: boolean;
  autoTimer?: number;
  achTimer?: number;
  fullHint?: number;
  challenge: string | null;
  chDone: Record<string, boolean>;
  talents: TalentHire[];
  talentPool: TalentHire[];
  nextTalents: number;
  talentSeq: number;
  shares: number;
  sharesTotal: number;
  ipos: number;
  ipoTotal: number;
  board: Record<string, boolean>;
  /** Transient: messages for the UI to show, cleared by the caller each frame. */
  events: { text: string; kind: LogKind }[];
}

/** What survives a reset (sale, challenge start, IPO), plus per-reset extras. */
export interface Meta {
  fp?: number;
  fpTotal?: number;
  exits?: number;
  soldTotal?: number;
  perks?: Record<string, boolean>;
  ach?: Record<string, boolean>;
  life?: Partial<Life>;
  flags?: Partial<Flags>;
  revealed?: Record<string, boolean>;
  feed?: FeedItem[];
  chDone?: Record<string, boolean>;
  talents?: TalentHire[];
  talentSeq?: number;
  shares?: number;
  sharesTotal?: number;
  ipos?: number;
  ipoTotal?: number;
  board?: Record<string, boolean>;
  keep?: string[];
  challenge?: string | null;
}
