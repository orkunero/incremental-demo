// Browser UI: an IDE window around the game core.
import * as G from '../core/index.ts';
import type { Cost, Feature, GameState, LogKind, RoleDef } from '../core/index.ts';
import { readJSON, remove, writeJSON } from '../platform/storage.ts';

interface UIState {
  file: string | null;
  opened: Record<string, boolean>;
  ptab: string;
  buyAmt: number | 'max';
  upCat: string;
  notation?: 'short' | 'sci';
  theme?: string;
  debtTip?: boolean;
}


const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<HTMLElement>(sel) as T;
let notation: 'short' | 'sci' = 'short';
const fmt = (n: number) => (notation === 'sci' && Math.abs(n) >= 1e6 ? n.toExponential(2).replace('e+', 'e') : G.fmt(n));
const money = (n: number) => '$' + fmt(n);
const pct = (x: number) => Math.round(x * 100) + '%';
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (t: string) => String(t).replace(/[&<>"]/g, (c) => ESC[c]);
const SAVE_KEY = 'gitrich-proto-v4';
const UI_KEY = 'gitrich-ui-v3';

let welcome = '';
let S: GameState = load();
let UI: UIState = loadUI();
let speed = 1;
notation = UI.notation || 'short';
function applyTheme() {
  if (UI.theme === 'light' || UI.theme === 'dark') document.documentElement.dataset.theme = UI.theme;
  else delete document.documentElement.dataset.theme;
}
applyTheme();
const armed: { exit: number; reset: number; ch: number; chId: string | null; ipo: number } = { exit: 0, reset: 0, ch: 0, chId: null, ipo: 0 };
let duckClicks = 0;

function load(): GameState {
  const data = readJSON(SAVE_KEY);
  if (!data) return G.createState();
  try {
    const s = G.fromSave(data);
    const earned = G.catchUp(s, (Date.now() - (data as G.SaveFile).savedAt) / 1000);
    if (earned > 0 && Date.now() - (data as G.SaveFile).savedAt > 30000) welcome = `While you were away your team kept working: +${money(earned)}.`;
    return s;
  } catch {
    return G.createState();
  }
}
function save() {
  writeJSON(SAVE_KEY, G.toSave(S, Date.now()));
  writeJSON(UI_KEY, UI);
}
function loadUI(): UIState {
  const d: UIState = { file: null, opened: {}, ptab: 'terminal', buyAmt: 1, upCat: 'all' };
  return Object.assign(d, readJSON(UI_KEY) || {});
}

/* ---------- app.ts ---------- */
const SNIPPETS = [
  '<span class="kw">import</span> { idea } <span class="kw">from</span> <span class="st">"./shower-thoughts"</span>;',
  '<span class="kw">const</span> app = <span class="fn">createApp</span>(idea);',
  'app.<span class="fn">use</span>(<span class="fn">coffee</span>({ cups: <span class="st">3</span> }));',
  '<span class="kw">if</span> (user.isHappy) <span class="fn">ship</span>(feature);',
  '<span class="kw">await</span> <span class="fn">deploy</span>(<span class="st">"friday 17:59"</span>);',
  '<span class="kw">function</span> <span class="fn">handlePayment</span>(order) {',
  '  <span class="kw">return</span> stripe.<span class="fn">charge</span>(order.total);',
  '}',
  '<span class="kw">try</span> { db.<span class="fn">migrate</span>() } <span class="kw">catch</span> { <span class="fn">pray</span>() }',
  '<span class="cm">// TODO: write tests (someday)</span>',
  'router.<span class="fn">get</span>(<span class="st">"/pricing"</span>, showPlans);',
  '<span class="kw">export default</span> app;',
  '<span class="cm">// fix: fix the fix</span>',
  'cache.<span class="fn">set</span>(key, value, { ttl: <span class="st">60</span> });',
  '<span class="kw">const</span> users = <span class="kw">await</span> db.users.<span class="fn">findAll</span>();',
  'logger.<span class="fn">info</span>(<span class="st">"works on my machine"</span>);',
  '<span class="kw">const</span> { data } = <span class="kw">await</span> api.<span class="fn">get</span>(<span class="st">"/v2/me"</span>);',
  '<span class="cm">// HACK: remove before launch</span>',
  'queue.<span class="fn">retry</span>(job, { attempts: <span class="st">5</span> });',
  '<span class="kw">if</span> (!flags.<span class="fn">enabled</span>(<span class="st">"dark-mode"</span>)) <span class="kw">return</span>;',
];
let lineNo = 1, snip = 0;
const lines: string[] = [];
function pushLine() {
  lines.push(`<span class="ln">${lineNo++}</span>${SNIPPETS[snip++ % SNIPPETS.length]}`);
  if (lines.length > 14) lines.shift();
  $('#code').innerHTML = lines.map((l, i) => `<div class="line${i === lines.length - 1 ? ' new' : ''}">${l}</div>`).join('');
}
pushLine();

/* ---------- notifications ---------- */
function toast(text: string, kind?: LogKind | '') {
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.textContent = text;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), kind === 'reveal' ? 5000 : 3200);
  while ($('#toasts').children.length > 4) $('#toasts').firstElementChild?.remove();
}

/* ---------- files ---------- */
const canHireAny = () => G.ROLES.some((d) => G.roleUnlocked(S, d) && G.headcount(S) < G.seats(S) && S.money >= G.staffCost(S, d.id));
const FILES = [
  { id: 'team', folder: 'company', name: 'team.ts', show: () => S.revealed.team, badge: () => (canHireAny() ? ['•', ''] : null) },
  { id: 'upgrades', folder: 'company', name: 'upgrades.ts', show: () => S.revealed.upgrades, badge: () => { const n = G.UPGRADES.filter((u) => G.upgradeVisible(S, u) && G.canAfford(S, u.cost)).length; return n ? [n, ''] : null; } },
  { id: 'features', folder: 'product', name: 'features.ts', show: () => S.revealed.product, badge: () => { const n = G.FEATURES.filter((f) => G.featureState(S, f) === 'open' && S.loc >= G.featureCost(S, f)).length; return n ? [n, ''] : null; } },
  { id: 'market', folder: 'product', name: 'market.ts', show: () => S.revealed.markets, badge: () => { const k = G.MARKETS[S.market + 1]; return k && S.money >= G.marketCost(S) && S.rep >= k.rep ? ['!', 'warn'] : G.marketFull(S) ? ['full', 'dim'] : null; } },
  { id: 'clients', folder: 'business', name: 'clients.ts', show: () => S.revealed.contracts, badge: () => { const n = S.contracts.filter((c) => G.contractOk(S, c)).length; return n ? [n, 'warn'] : S.contracts.length ? [S.contracts.length, 'dim'] : null; } },
  { id: 'exit', folder: 'business', name: 'exit.ts', show: () => S.revealed.exit, badge: () => (G.valuation(S) >= G.exitNeed(S) ? ['$', 'warn'] : null) },
  { id: 'perks', folder: 'founder', name: 'perks.ts', show: () => S.revealed.founder, badge: () => { const n = G.PERKS.filter((p) => !S.perks[p.id] && S.fp >= p.cost).length; return n ? [n, ''] : null; } },
  { id: 'ipo', folder: 'founder', name: 'ipo.ts', show: () => S.revealed.ipo || S.ipos > 0, badge: () => (G.canIpo(S) ? ['$', 'warn'] : G.BOARD.some((b) => !S.board[b.id] && S.shares >= b.cost) ? ['•', ''] : null) },
  { id: 'challenges', folder: 'founder', name: 'challenges.ts', show: () => S.exits >= 1 || !!S.challenge, badge: () => (S.challenge ? ['⚑', 'warn'] : null) },
  { id: 'workflows', folder: '.github', name: 'workflows.yml', ico: 'YML', show: () => S.revealed.workflows, badge: () => { const n = activeBots().length; return n ? [n, 'dim'] : null; } },
  { id: 'todo', folder: '', name: 'TODO.md', ico: 'MD', md: true, show: () => true, badge: () => [`${S.goal}/${G.GOALS.length}`, 'dim'] },
  { id: 'achievements', folder: '', name: 'ACHIEVEMENTS.md', ico: 'MD', md: true, show: () => Object.keys(S.ach).length >= 3, badge: () => [`${Object.keys(S.ach).length}/${G.ACHIEVEMENTS.length}`, 'dim'] },
  { id: 'stats', folder: '', name: 'stats.md', ico: 'MD', md: true, show: () => S.revealed.stats, badge: () => null },
  { id: 'settings', folder: '', name: 'settings.json', ico: '{}', md: true, show: () => true, badge: () => null },
];
type BotKey = 'autoShip' | 'autoDeliver' | 'autoRefactor' | 'autoUpgrade' | 'autoBug' | 'autoHire';
const BOTS: { id: BotKey; name: string; title: string; note: string; has: () => boolean; from: string }[] = [
  { id: 'autoShip', name: 'ci-cd', title: 'CI/CD Pipeline', note: 'Ships releases on its own while debt is under the limit.', has: () => G.mods(S).autoShip, from: 'the CI/CD Pipeline upgrade' },
  { id: 'autoDeliver', name: 'zapier', title: 'Zapier Flows', note: 'Delivers client work as soon as you have the code.', has: () => G.mods(S).autoDeliver, from: 'the Zapier Flows upgrade' },
  { id: 'autoRefactor', name: 'refactor-bot', title: 'Refactor Bot', note: 'Moves the refactoring slider to hold debt near the target.', has: () => G.mods(S).autoRefactor, from: 'the Refactor Bot upgrade' },
  { id: 'autoUpgrade', name: 'dependabot', title: 'Dependabot', note: 'Installs any upgrade that costs under 10% of what you have.', has: () => G.mods(S).autoUpgrade, from: 'the Dependabot upgrade' },
  { id: 'autoBug', name: 'bug-triage', title: 'Bug Triage Bot', note: 'Squashes bugs before they escape.', has: () => G.mods(S).autoBug, from: 'the Bug Triage Bot upgrade' },
  { id: 'autoHire', name: 'recruiting', title: 'Recruiting Pipeline', note: 'Hires the best engineer whenever a seat is free.', has: () => G.mods(S).autoHire, from: 'the Recruiting Pipeline upgrade or the Auto-Recruiter perk' },
];
const activeBots = () => BOTS.filter((b) => b.has() && S[b.id]);
const visibleFiles = () => FILES.filter((f) => f.show());

/* ---------- actions ---------- */
function floaty(text: string, x: number, y: number, cls?: string) {
  const f = document.createElement('div');
  f.className = 'floaty ' + (cls || ''); f.textContent = text;
  f.style.left = x + 'px'; f.style.top = y + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 800);
}
function act(el: HTMLElement, e: PointerEvent | null) {
  const a = el.dataset.act, arg = el.dataset.arg ?? '';
  switch (a) {
    case 'click': {
      const v = G.click(S);
      pushLine();
      const f = document.createElement('div');
      f.className = 'floaty'; f.textContent = '+' + fmt(v);
      const r = el.getBoundingClientRect();
      f.style.left = ((e && e.clientX) || r.left + r.width / 2) + 'px';
      f.style.top = (((e && e.clientY) || r.top + r.height / 2) - 20) + 'px';
      document.body.appendChild(f); setTimeout(() => f.remove(), 800);
      break;
    }
    case 'ship': {
      const sales = G.launchPay(S);
      if (G.ship(S, Math.random)) {
        el.classList.remove('shipped'); void el.offsetWidth; el.classList.add('shipped');
        const r = el.getBoundingClientRect();
        floaty('+' + money(sales), r.left + r.width / 2, r.bottom + 14, 'money');
      }
      break;
    }
    case 'squash': {
      const pay = G.squash(S, Number(arg));
      if (pay) floaty('+' + money(pay), (e && e.clientX) || 0, ((e && e.clientY) || 0) - 10, 'money');
      break;
    }
    case 'decide': G.decide(S, arg === 'b' ? 'b' : 'a'); break;
    case 'talent': G.hireTalent(S, Number(arg)); break;
    case 'untalent': G.releaseTalent(S, Number(arg)); break;
    case 'board': G.buyBoard(S, arg); break;
    case 'ipo':
      if (Date.now() - armed.ipo < 4000) { const n = G.ipo(S); if (n) { S = n; armed.ipo = 0; UI.file = 'ipo'; save(); } }
      else armed.ipo = Date.now();
      break;
    case 'toggle': S[arg as BotKey] = !S[arg as BotKey]; break;
    case 'challenge':
      if (armed.chId === arg && Date.now() - armed.ch < 4000) { const n = G.startChallenge(S, arg); if (n) { S = n; armed.chId = null; save(); } }
      else { armed.chId = arg; armed.ch = Date.now(); }
      break;
    case 'notation': UI.notation = notation = arg === 'sci' ? 'sci' : 'short'; break;
    case 'theme': UI.theme = arg; applyTheme(); break;
    case 'export': {
      const box = $<HTMLTextAreaElement>('#export-box');
      box.value = G.encodeSave(G.toSave(S, Date.now()));
      box.select();
      try { navigator.clipboard.writeText(box.value).then(() => toast('Save copied to the clipboard.'), () => toast('Save text is selected. Copy it with Ctrl+C.')); } catch (_) { toast('Save text is selected. Copy it with Ctrl+C.'); }
      break;
    }
    case 'import': {
      try {
        S = G.fromSave(G.decodeSave($<HTMLTextAreaElement>('#import-box').value));
        toast('Save loaded.', 'reveal');
      } catch { toast('That does not look like a Git Rich save. Paste the full text from Export.', 'bad'); }
      break;
    }
    case 'hotfix': G.hotfix(S); break;
    case 'viral': G.claimViral(S); break;
    case 'open': UI.file = arg; UI.opened[arg] = true; break;
    case 'goto-app': {
      // app.ts is always open; on narrow screens it can be scrolled out of view, so bring it back
      const ed = $('#editor');
      ed.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ed.focus({ preventScroll: true });
      ed.classList.remove('flash'); void ed.offsetWidth; ed.classList.add('flash');
      break;
    }
    case 'ptab': UI.ptab = arg; break;
    case 'deliver': G.deliver(S, Number(arg)); break;
    case 'hire': G.hire(S, arg, UI.buyAmt); break;
    case 'promote': G.promote(S, arg); break;
    case 'letgo': G.letGo(S, arg); break;
    case 'amt': UI.buyAmt = arg === 'max' ? 'max' : Number(arg); break;
    case 'office': G.moveOffice(S); break;
    case 'market': G.buyMarket(S); break;
    case 'upgrade': G.buyUpgrade(S, arg); break;
    case 'upcat': UI.upCat = arg; break;
    case 'feature': G.buyFeature(S, arg); break;
    case 'perk': G.buyPerk(S, arg); break;
    case 'autoship': S.autoShip = !S.autoShip; break;
    case 'autohire': S.autoHire = !S.autoHire; break;
    case 'duck': if (++duckClicks >= 10 && !S.flags.duck) { S.flags.duck = true; toast('🦆 Quack. You explained the bug and found it yourself.', 'reveal'); } break;
    case 'exit':
      if (Date.now() - armed.exit < 4000) { const n = G.exit(S); if (n) { S = n; armed.exit = 0; UI.file = 'perks'; UI.opened.perks = true; save(); } }
      else armed.exit = Date.now();
      break;
    case 'reset':
      if (Date.now() - armed.reset < 4000) {
        remove(SAVE_KEY, UI_KEY);
        S = G.createState(); UI = loadUI(); UI.file = null; UI.opened = {}; armed.reset = 0; lines.length = 0; lineNo = 1; pushLine();
      } else armed.reset = Date.now();
      break;
    case 'speed': speed = Number(arg); break;
  }
  render();
}
// pointerdown so rapid clicks never get lost when a panel re-renders; click (detail 0) for keyboard
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  if (el.dataset.act === 'click' || el.dataset.act === 'squash') e.preventDefault();
  act(el, e);
});
document.addEventListener('click', (e) => {
  if (e.detail !== 0) return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (el && !(el as HTMLButtonElement).disabled) act(el, null);
});
document.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === 'refactor') G.setRefactor(S, Number(t.value) / 100);
  if (t.id === 'autodebt') S.autoShipDebt = Number(t.value) / 100;
  if (t.id === 'reftarget') S.refactorTarget = Number(t.value) / 100;
});

/* ---------- keyed rendering ---------- */
const keys: Record<string, string> = {};
function region(id: string, key: string, html: () => string) {
  if (keys[id] === key) return false;
  keys[id] = key;
  document.getElementById(id)!.innerHTML = html();
  return true;
}
const sev = (d: number) => (d < 0.1 ? 'good' : d < 0.25 ? 'warn' : 'bad');
const fillPct = (have: number, need: number) => Math.min(100, (have / need) * 100) + '%';
const costLabel = (c: Cost) => (c.money ? money(c.money) : fmt(c.loc ?? 0) + ' LoC');
const costHave = (c: Cost) => (c.money ? S.money / c.money : S.loc / (c.loc ?? 1));

function renderTitle() {
  const b = $<HTMLButtonElement>('#ship-btn');
  b.hidden = !S.revealed.ship;
  if (!S.revealed.ship) return;
  b.disabled = !G.canShip(S);
  const nv = S.version[1] === 9 ? `v${S.version[0] + 1}.0` : `v${S.version[0]}.${S.version[1] + 1}`;
  if (S.deployLeft > 0) { $('#ship-lbl').textContent = 'Deploying…'; $('#ship-meta').textContent = Math.ceil(S.deployLeft) + 's'; $('#ship-fill').style.width = (1 - S.deployLeft / G.deployTime(S)) * 100 + '%'; }
  else if (S.loc < G.MIN_SHIP) { $('#ship-lbl').textContent = `▶ Ship ${nv}`; $('#ship-meta').textContent = `need ${G.MIN_SHIP} LoC`; $('#ship-fill').style.width = fillPct(S.loc, G.MIN_SHIP); }
  else { $('#ship-lbl').textContent = `▶ Ship ${nv}`; $('#ship-meta').textContent = `+${money(G.launchPay(S))} now · +${money(G.shipGain(S))}/s · +${fmt(G.shipRep(S))} Rep · ${pct(G.incidentChance(S))} risk`; }
  const auto = G.mods(S).autoShip;
  region('auto-wrap', `a|${auto}|${S.autoShip}`, () => auto ? `<button class="chipbtn" data-act="autoship" aria-pressed="${S.autoShip}" title="Auto-ship while debt is under your limit">auto-ship ${S.autoShip ? 'on' : 'off'}</button>` : '');
}

const shownFiles = new Set();
let explorerInit = false;
function renderExplorer() {
  const files = visibleFiles();
  const key = files.map((f) => { const b = f.badge(); return f.id + (UI.file === f.id ? '*' : '') + (UI.opened[f.id] ? '' : 'U') + (b ? b.join('') : ''); }).join(',');
  region('explorer', key, () => {
    let html = '<div class="ex-head">Explorer</div><div class="folder">▾ startup</div><button class="file" style="padding-left:28px" data-act="goto-app" title="Go to the code editor"><span class="ico">TS</span><span class="name">app.ts</span></button>';
    let folder = null;
    for (const f of files) {
      if (f.folder !== folder) { folder = f.folder; if (folder) html += `<div class="folder" style="padding-left:28px">▾ ${folder}</div>`; }
      const b = f.badge();
      const fresh = explorerInit && !shownFiles.has(f.id);
      html += `<button class="file ${f.folder ? '' : 'root'} ${fresh ? 'fresh' : ''}" style="${f.folder ? 'padding-left:42px' : 'padding-left:28px'}" data-act="open" data-arg="${f.id}" aria-current="${UI.file === f.id}">
        <span class="ico ${f.md ? 'md' : ''}">${f.ico || 'TS'}</span><span class="name">${f.name}</span>
        ${!UI.opened[f.id] ? '<span class="u" title="New">U</span>' : b ? `<span class="badge ${b[1]}">${b[0]}</span>` : ''}</button>`;
    }
    for (const f of files) shownFiles.add(f.id);
    explorerInit = true;
    return html;
  });
}

function renderWrite() {
  $('#click-val').textContent = '+' + fmt(G.clickValue(S)) + ' LoC';
  $('#flow-bar').style.width = S.flow + '%';
  $('#flow-txt').textContent = `flow ×${G.flowMult(S).toFixed(2)}`;
  $('#flow-hint').textContent = S.flow < 20 ? 'click or type steadily to build flow' : S.flow > 95 ? 'in the zone' : '';
  const open = G.openGoals(S), g = open[0];
  region('goal', 'g' + S.goal + (g ? g.i : ''), () => g
    ? `<div class="goal"><span class="tag">TODO</span><span class="gt">${g.text}</span><span class="gr" id="goal-rw"></span></div><div class="bar rep thin"><div id="goal-bar"></div></div>`
    : '<div class="goal"><span class="tag">TODO</span><span class="gt">Everything on the list is done. Sell the company when you are ready.</span></div>');
  if (g) { const [c, t] = g.prog(S); $('#goal-bar').style.width = fillPct(c, t); $('#goal-rw').textContent = G.goalReward(S, g); }
  region('bugs', 'b' + S.bugs.map((b) => b.id + (S.t - b.born > 10 ? 'o' : '')).join(','), () => S.bugs.map((b) =>
    `<span class="bug ${S.t - b.born > 10 ? 'old' : ''}" data-act="squash" data-arg="${b.id}" style="left:${6 + b.x * 80}%;top:${8 + b.y * 70}%" title="Squash this bug before it escapes">🐛</span>`).join(''));
  const inc = S.incident, vir = S.viral, dec = S.decision && G.DECISIONS.find((x) => x.id === S.decision!.id);
  region('banners', `${!!inc}|${!!vir}|${dec ? dec.id : ''}`, () => `
    ${dec ? `<div class="banner decide"><div class="txt"><b>${dec.title}</b> ${dec.text}<div class="bar rep"><div id="dec-bar"></div></div></div>
      <div class="opts"><div class="opt"><button class="btn rep" data-act="decide" data-arg="a"><span>${dec.a[0]}</span></button><small>${dec.a[1]}</small></div>
      <div class="opt"><button class="btn ghost" data-act="decide" data-arg="b"><span>${dec.b[0]}</span></button><small>${dec.b[1]}</small></div></div></div>` : ''}
    ${inc ? `<div class="banner bad"><div class="txt"><b>Incident in production: income ×0.5</b><span id="inc-why"></span><div class="bar bad"><div id="inc-bar"></div></div></div><button class="btn danger" data-act="hotfix"><span>Hotfix</span><span class="num" id="inc-left"></span></button></div>` : ''}
    ${vir ? `<div class="banner good"><div class="txt"><b>Your app is trending!</b>Income ×${G.mods(S).viralBoost} for 30 s and a Reputation boost.<div class="bar money"><div id="vir-bar"></div></div></div><button class="btn money" data-act="viral"><span>Ride the wave</span><span class="num" id="vir-left"></span></button></div>` : ''}`);
  if (inc) { $('#inc-why').textContent = inc.why; $('#inc-left').textContent = inc.left + '×'; $('#inc-bar').style.width = (100 - inc.t / G.mods(S).incDur * 100) + '%'; }
  if (dec) $('#dec-bar').style.width = Math.max(0, (S.decision!.until - S.t) / 30 * 100) + '%';
  if (vir) { const l = Math.max(0, vir.until - S.t); $('#vir-left').textContent = Math.ceil(l) + 's'; $('#vir-bar').style.width = l / 12 * 100 + '%'; }
}

/* ---------- file views ---------- */
interface View {
  key: () => string;
  html: () => string;
  live?: () => void;
}
const VIEWS: Record<string, View> = {
  welcome: {
    key: () => 'w',
    html: () => `<div class="welcome"><div class="cm-line">// README.md</div><h2>git <span>rich</span></h2>
      <p>You have an idea, a laptop and a garage. Turn it into a software company.</p>
      <ol><li>Click <b>app.ts</b> on the left, or just type on your keyboard, to write code.</li><li>New files appear in the explorer as your company grows. A green <b>U</b> means you have not opened it yet.</li>
      <li>The <b>▶ Ship</b> button at the top turns code into income. Watch <b>Problems</b> below for tech debt.</li></ol></div>`,
  },
  team: {
    key: () => ['t', S.talents.map((t) => t.id).join('.'), S.talentPool.map((c) => `${c.id}${S.money >= G.talentCost(S, c)}`).join('.'), S.office, G.headcount(S), UI.buyAmt, S.autoHire, G.ROLES.map((d) => d.id + S.staff[d.id] + G.roleUnlocked(S, d) + (S.money >= G.promoteCost(S, d.id)) + (G.bulk(S, d.id, UI.buyAmt).n > 0 && G.bulk(S, d.id, UI.buyAmt).total <= S.money)).join(''), S.money >= G.officeCost(S) && S.rep >= (G.OFFICES[S.office + 1] || { rep: 0 }).rep].join('|'),
    html: () => {
      const nx = G.OFFICES[S.office + 1];
      const full = G.headcount(S) >= G.seats(S);
      const row = (d: RoleDef) => {
        if (!G.roleUnlocked(S, d)) return `<div class="role locked"><div><h3>${d.name}</h3><div class="note">${d.needs ? 'Needs the Machine Learning upgrade' : `Unlocks at ${fmt(d.rep)} Reputation`}</div></div><span></span><span class="pill rep">${d.needs ? 'locked' : fmt(S.rep) + ' / ' + fmt(d.rep)}</span></div>`;
        const b = G.bulk(S, d.id, UI.buyAmt);
        const n = b.n || 1, total = b.n ? b.total : G.staffCost(S, d.id);
        const ok = b.n > 0 && b.total <= S.money;
        const meta = G.isSupport(d) ? '' : `<div class="meta"><span class="pill good">${fmt((d.out ?? 0) * G.mods(S).out[d.id])} LoC/s</span><span class="pill ${G.staffBug(S, d) >= 0.3 ? 'bad' : G.staffBug(S, d) >= 0.1 ? 'money' : 'good'}">${pct(G.staffBug(S, d))} bugs</span></div>`;
        const nx = G.nextLevel(S, d.id);
        const sub = S.staff[d.id] ? `<div class="sub">${nx ? `<button class="btn ghost" data-act="promote" data-arg="${d.id}" ${S.money >= G.promoteCost(S, d.id) ? '' : 'disabled'} title="Turn one ${d.name} into a ${nx.name} (same price as hiring one)">Promote ${money(G.promoteCost(S, d.id))}</button>` : ''}<button class="btn ghost" data-act="letgo" data-arg="${d.id}" title="Let one ${d.name} go to free a seat">Let go</button></div>` : '';
        return `<div class="role"><div><h3>${d.name}</h3><div class="note">${d.note}</div>${meta}</div><span class="count num">${S.staff[d.id]}</span>
          <div class="acts"><button class="btn" data-act="hire" data-arg="${d.id}" ${ok ? '' : 'disabled'}><span class="fill" data-fill="hire:${d.id}"></span><span>Hire${n > 1 ? ' ' + n : ''}</span><span class="num">${full ? 'no seats' : money(total)}</span></button>${sub}</div></div>`;
      };
      const shownEng = []; for (const d of G.ENGINEERS) { shownEng.push(d); if (!G.roleUnlocked(S, d) && !d.needs) break; }
      const shownSup = []; for (const d of G.SUPPORT) { shownSup.push(d); if (!G.roleUnlocked(S, d)) break; }
      return `<div class="vhead"><div><div class="cm-line">// company/team.ts</div><h2>Team</h2><p>Engineers write code. Support roles write none, but each one bends a rule. Everyone needs a seat.</p></div>
        <div class="chips">${[1, 10, 'max'].map((a) => `<button class="chip" data-act="amt" data-arg="${a}" aria-pressed="${UI.buyAmt === a}">${a === 'max' ? 'Max' : '×' + a}</button>`).join('')}
        ${S.perks.autohire ? `<button class="chip" data-act="autohire" aria-pressed="${S.autoHire}">Auto-hire ${S.autoHire ? 'on' : 'off'}</button>` : ''}</div></div>
        <div class="office"><div><b>${G.OFFICES[S.office].name}</b> <span class="num" style="color:var(--muted)">${G.headcount(S)} / ${G.seats(S)} seats</span></div>
          ${nx ? `<button class="btn ${full ? 'money' : 'ghost'}" data-act="office" ${S.money >= G.officeCost(S) && S.rep >= nx.rep ? '' : 'disabled'}><span class="fill" data-fill="office"></span><span>Move to ${nx.name} · ${Math.floor(nx.seats * G.mods(S).seats)} seats</span><span class="num">${S.rep < nx.rep ? 'needs ' + fmt(nx.rep) + ' Rep' : money(G.officeCost(S))}</span></button>` : '<span class="pill good">Biggest office</span>'}
          <div class="bar ${full ? 'money' : ''}"><div style="width:${G.headcount(S) / G.seats(S) * 100}%"></div></div></div>
        ${S.revealed.talents ? `<div class="section-t"><span>Talents</span><span class="num">${S.talents.length} / ${G.MAX_TALENTS} · they stay when you sell</span></div>
          ${S.talents.length ? `<div class="cards">${S.talents.map((t) => { const d = G.talentDef(t.kind); return `<div class="card talent ${d.rarity}"><div class="top"><span class="t">${esc(t.name)}</span><span class="pill ${d.rarity === 'legendary' ? 'money' : d.rarity === 'rare' ? 'rep' : ''}">${d.rarity}</span></div><span class="d"><b>${d.title}.</b> ${d.desc}</span><button class="btn ghost" data-act="untalent" data-arg="${t.id}"><span>Let go</span></button></div>`; }).join('')}</div>` : ''}
          <div class="section-t"><span>Talent market</span><span class="num" id="talent-next"></span></div>
          ${S.talentPool.length ? `<div class="cards">${S.talentPool.map((c) => { const d = G.talentDef(c.kind), cost = G.talentCost(S, c), ok = S.money >= cost && S.talents.length < G.MAX_TALENTS && !full; return `<div class="card talent ${d.rarity}"><div class="top"><span class="t">${esc(c.name)}</span><span class="pill ${d.rarity === 'legendary' ? 'money' : d.rarity === 'rare' ? 'rep' : ''}">${d.rarity}</span></div><span class="d"><b>${d.title}.</b> ${d.desc}</span><button class="btn ${d.rarity === 'legendary' ? 'money' : 'rep'}" data-act="talent" data-arg="${c.id}" ${ok ? '' : 'disabled'}><span>Hire</span><span class="num">${S.talents.length >= G.MAX_TALENTS ? 'team full' : full ? 'no seats' : money(cost)}</span></button></div>`; }).join('')}</div>` : '<p class="cm-line">// no candidates right now</p>'}` : ''}
        <div class="section-t"><span>Engineering</span><span class="num">${G.ENGINEERS.reduce((a, d) => a + S.staff[d.id], 0)} people</span></div>
        <div class="roles">${shownEng.map(row).join('')}</div>
        ${S.rep >= 20 || G.SUPPORT.some((d) => S.staff[d.id]) ? `<div class="section-t"><span>Support</span><span class="num">${G.SUPPORT.reduce((a, d) => a + S.staff[d.id], 0)} people</span></div><div class="roles">${shownSup.map(row).join('')}</div>` : ''}`;
    },
    live: () => {
      for (const d of G.ROLES) { const f = document.querySelector<HTMLElement>(`[data-fill="hire:${d.id}"]`); if (f) f.style.width = fillPct(S.money, G.staffCost(S, d.id)); }
      const f = document.querySelector<HTMLElement>('[data-fill="office"]'); if (f) f.style.width = fillPct(S.money, G.officeCost(S));
      const tn = $('#talent-next'); if (tn) tn.textContent = 'new candidates in ' + Math.max(0, Math.ceil((S.nextTalents - S.t) / 60)) + ' min';
    },
  },
  upgrades: {
    key: () => { const v = G.UPGRADES.filter((u) => G.upgradeVisible(S, u)); return ['u', UI.upCat, Object.keys(S.done).length, v.map((u) => u.id + G.canAfford(S, u.cost)).join(',')].join('|'); },
    html: () => {
      const cats = [['all', 'All'], ['roles', 'Roles'], ['tools', 'Tools'], ['process', 'Process'], ['people', 'People'], ['growth', 'Growth'], ['clients', 'Clients'], ['automation', 'Automation']];
      const vis = G.UPGRADES.filter((u) => G.upgradeVisible(S, u) && (UI.upCat === 'all' || u.cat === UI.upCat)).sort((a, b) => costHave(b.cost) - costHave(a.cost));
      const owned = G.UPGRADES.filter((u) => S.done[u.id]);
      const count = (c: string) => G.UPGRADES.filter((u) => G.upgradeVisible(S, u) && (c === 'all' || u.cat === c)).length;
      return `<div class="vhead"><div><div class="cm-line">// company/upgrades.ts</div><h2>Upgrades</h2><p>One-time purchases that change a rule. New ones appear as you hit milestones. Process upgrades are paid in code.</p></div>
        <span class="pill good">${owned.length} / ${G.UPGRADES.length} installed</span></div>
        <div class="chips">${cats.filter(([c]) => c === 'all' || count(c)).map(([c, l]) => `<button class="chip" data-act="upcat" data-arg="${c}" aria-pressed="${UI.upCat === c}">${l} ${count(c) ? `<span class="num">${count(c)}</span>` : ''}</button>`).join('')}</div>
        ${vis.length ? `<div class="cards">${vis.map((u) => `<div class="card"><div class="top"><span class="t">${u.name}</span><span class="pill">${u.cat}</span></div><span class="d">${u.desc}</span>
          <button class="btn ${u.cost.money ? 'money' : ''}" data-act="upgrade" data-arg="${u.id}" ${G.canAfford(S, u.cost) ? '' : 'disabled'}><span class="fill" data-fill="up:${u.id}"></span><span>Install</span><span class="num">${costLabel(u.cost)}</span></button></div>`).join('')}</div>`
          : '<p class="cm-line">// nothing new here yet. Keep growing.</p>'}
        ${owned.length ? `<details class="installed"><summary>Installed (${owned.length})</summary><ul>${owned.map((u) => `<li><b>${u.name}</b>: ${u.desc}</li>`).join('')}</ul></details>` : ''}`;
    },
    live: () => { for (const u of G.UPGRADES) { const f = document.querySelector<HTMLElement>(`[data-fill="up:${u.id}"]`); if (f) f.style.width = Math.min(100, costHave(u.cost) * 100) + '%'; } },
  },
  features: {
    key: () => ['f', G.FEATURES.map((f) => f.id + G.featureState(S, f) + (S.loc >= G.featureCost(S, f))).join(',')].join('|'),
    html: () => {
      const tiers = [...new Set(G.FEATURES.map((f) => f.tier))];
      const node = (f: Feature) => {
        const st = G.featureState(S, f);
        const c = G.featureCost(S, f);
        return `<div class="node ${st}"><span class="t">${f.name}${st === 'done' ? '<span class="pill good">built</span>' : ''}</span><span class="d">${f.desc}</span>
          ${st === 'open' ? `<button class="btn" data-act="feature" data-arg="${f.id}" ${S.loc >= c ? '' : 'disabled'}><span class="fill" data-fill="feat:${f.id}"></span><span>Build</span><span class="num">${fmt(c)} LoC</span></button>`
          : st === 'locked' ? `<span class="cm-line">needs ${(f.req ?? []).map((r) => G.FEATURES.find((x) => x.id === r)!.name).join(' + ')}</span>` : st === 'blocked' ? '<span class="cm-line">not chosen this company</span>' : ''}</div>`;
      };
      return `<div class="vhead"><div><div class="cm-line">// product/features.ts</div><h2>Product features</h2><p>Spend unshipped code to grow your product. Dashed purple boxes are strategy choices: pick one per company.</p></div>
        <span class="pill good">${Object.keys(S.features).length} / ${G.FEATURES.length} built</span></div>
        <div class="tree">${tiers.map((t) => {
          const fs = G.FEATURES.filter((f) => f.tier === t);
          const forks = [...new Set(fs.filter((f) => f.fork).map((f) => f.fork))];
          return `<div class="tier"><span class="lbl">tier ${t}</span><div class="nodes">${fs.filter((f) => !f.fork).map(node).join('')}
            ${forks.map((k) => { const pair = fs.filter((f) => f.fork === k); return `<div class="fork"><span class="fork-h">Choose your ${k}</span>${node(pair[0])}<span class="or">or</span>${node(pair[1])}</div>`; }).join('')}</div></div>`;
        }).join('')}</div>`;
    },
    live: () => { for (const f of G.FEATURES) { const el = document.querySelector<HTMLElement>(`[data-fill="feat:${f.id}"]`); if (el) el.style.width = fillPct(S.loc, G.featureCost(S, f)); } },
  },
  market: {
    key: () => { const k = G.MARKETS[S.market + 1]; return ['m', S.market, G.marketFull(S), k && S.money >= G.marketCost(S) && S.rep >= k.rep].join('|'); },
    html: () => {
      const k = G.MARKETS[S.market + 1];
      return `<div class="vhead"><div><div class="cm-line">// product/market.ts</div><h2>${G.MARKETS[S.market].name} market</h2><p>Each market can only pay so much. When it is nearly full, releases add little: expand, grow the market with upgrades, or take client work.</p></div></div>
        <div class="card"><div class="kv"><span>Market filled</span><b id="mk-sat"></b></div><div class="bar money"><div id="mk-bar"></div></div>
          <div class="kv"><span>Market size</span><b id="mk-cap"></b></div><div class="kv"><span>Your product income</span><b id="mk-mrr"></b></div></div>
        ${G.marketFull(S) ? `<p class="cm-line">// this market is full: releases add almost nothing now. Save up for the next one, or take client work.</p>` : ''}
        ${k ? `<div class="card"><span class="t">Next: ${k.name}</span><span class="d">Market size ${money(k.cap * G.mods(S).cap)}/s. Your current income carries over.</span>
          <button class="btn money" data-act="market" ${S.money >= G.marketCost(S) && S.rep >= k.rep ? '' : 'disabled'}><span class="fill" data-fill="mk"></span><span>Launch ${k.name}</span><span class="num">${S.rep < k.rep ? 'needs ' + fmt(k.rep) + ' Rep' : money(G.marketCost(S))}</span></button></div>` : ''}
        <div class="section-t"><span>Markets</span></div>
        <div class="roles">${G.MARKETS.map((x, i) => `<div class="role ${i > S.market ? 'locked' : ''}"><div><h3>${x.name}</h3><div class="note">size ${money(x.cap)}/s base</div></div><span></span><span class="pill ${i < S.market ? '' : i === S.market ? 'good' : ''}">${i < S.market ? 'done' : i === S.market ? 'current' : fmt(x.rep) + ' Rep'}</span></div>`).join('')}</div>`;
    },
    live: () => {
      $('#mk-sat').textContent = pct(G.saturation(S)); $('#mk-bar').style.width = G.saturation(S) * 100 + '%';
      $('#mk-cap').textContent = money(G.cap(S)) + '/s'; $('#mk-mrr').textContent = money(G.mrr(S)) + '/s';
      const f = document.querySelector<HTMLElement>('[data-fill="mk"]'); if (f) f.style.width = fillPct(S.money, G.marketCost(S));
    },
  },
  clients: {
    key: () => 'c|' + S.contracts.map((c) => c.id + ':' + G.contractOk(S, c)).join(','),
    html: () => `<div class="vhead"><div><div class="cm-line">// business/clients.ts</div><h2>Client work</h2><p>Clients pay once, right away. Your own product pays a little every second, forever. Both use the same unshipped code.</p></div>
      <span class="pill money">${S.contracts.length} / ${G.mods(S).slots} offers</span></div>
      ${S.contracts.length ? `<div class="cards">${S.contracts.map((c) => `<div class="card"><div class="top"><span class="t">${esc(c.job[0].toUpperCase() + c.job.slice(1))}</span></div><span class="d">${esc(c.client)}</span>
        <div class="chips"><span class="pill">${fmt(c.size)} LoC</span><span class="pill money">${money(c.pay)}</span><span class="pill rep">+${c.rep} Rep</span>${c.maxDebt != null ? `<span class="pill ${G.debtPct(S) <= c.maxDebt ? 'good' : 'bad'}">debt ≤ ${pct(c.maxDebt)}</span>` : ''}</div>
        <div class="bar"><div data-exp="${c.id}"></div></div>
        <button class="btn money" data-act="deliver" data-arg="${c.id}" ${G.contractOk(S, c) ? '' : 'disabled'}><span class="fill" data-fill="c:${c.id}"></span><span>Deliver</span><span class="num">${G.contractOk(S, c) ? '+' + money(c.pay) : c.maxDebt != null && G.debtPct(S) > c.maxDebt ? 'too much debt' : 'need ' + fmt(c.size) + ' LoC'}</span></button></div>`).join('')}</div>`
        : '<p class="cm-line">// no offers right now. New clients call every ~20 s.</p>'}`,
    live: () => { for (const c of S.contracts) { const e = document.querySelector<HTMLElement>(`[data-exp="${c.id}"]`); if (e) e.style.width = Math.max(0, (c.expires - S.t) / c.life * 100) + '%'; const f = document.querySelector<HTMLElement>(`[data-fill="c:${c.id}"]`); if (f) f.style.width = fillPct(S.loc, c.size); } },
  },
  exit: {
    key: () => `x|${G.valuation(S) >= G.exitNeed(S)}|${Date.now() - armed.exit < 4000}`,
    html: () => {
      const ok = G.valuation(S) >= G.exitNeed(S), isArmed = Date.now() - armed.exit < 4000;
      return `<div class="vhead"><div><div class="cm-line">// business/exit.ts</div><h2>Sell the company</h2><p>Valuation is your product income × 500. Selling starts a new company from zero and gives Founder Points: spend them on permanent perks, or keep them for +10% everything each. Every sale raises the bar: the next buyer wants a 4× bigger company.</p></div></div>
        <div class="card"><div class="kv"><span>Valuation</span><b id="ex-val"></b></div><div class="bar rep"><div id="ex-bar"></div></div>
          <div class="kv"><span>Needed to sell</span><b>${money(G.exitNeed(S))}</b></div><div class="kv"><span>Founder Points if you sell now</span><b id="ex-fp"></b></div>
          <div class="kv"><span>Companies sold</span><b>${S.exits}</b></div>
          <button class="btn ${isArmed ? 'danger' : 'rep'} block" data-act="exit" ${ok ? '' : 'disabled'}><span>${isArmed ? 'Click again to sell' : 'Sell company'}</span><span class="num">${ok ? '' : 'not yet'}</span></button></div>
        <p class="cm-line">// keeps: Founder Points, perks, achievements. resets: everything else.</p>`;
    },
    live: () => { $('#ex-val').textContent = money(G.valuation(S)); $('#ex-bar').style.width = fillPct(G.valuation(S), G.exitNeed(S)); $('#ex-fp').textContent = '+' + G.fpGain(S); },
  },
  perks: {
    key: () => 'p|' + S.fp + '|' + Object.keys(S.perks).join(','),
    html: () => `<div class="vhead"><div><div class="cm-line">// founder/perks.ts</div><h2>Founder perks</h2><p>Permanent. Each unspent Founder Point gives +10% code and income, so spending is a trade-off.</p></div>
      <span class="pill rep">${S.fp} points · ×${(1 + 0.1 * S.fp).toFixed(1)}</span></div>
      <div class="cards">${G.PERKS.map((p) => `<div class="card ${S.perks[p.id] ? 'done' : ''}"><div class="top"><span class="t">${p.name}</span><span class="pill rep">${p.cost} pt</span></div><span class="d">${p.desc}</span>
        ${S.perks[p.id] ? '<span class="pill good">owned</span>' : `<button class="btn rep" data-act="perk" data-arg="${p.id}" ${S.fp >= p.cost ? '' : 'disabled'}><span>Unlock</span><span class="num">${p.cost} pt</span></button>`}</div>`).join('')}</div>`,
  },
  todo: {
    key: () => 'todo|' + S.goal,
    html: () => {
      const open = G.openGoals(S).map((g) => g.i);
      const last = open.length ? open[open.length - 1] : G.GOALS.length;
      return `<div class="vhead"><div><div class="cm-line"># TODO.md</div><h2>TODO</h2><p>Three goals are open at a time; finish them in any order. Each one pays a reward right away. The list starts over with every new company.</p></div><span class="pill rep">${S.goal} / ${G.GOALS.length}</span></div>
      <div class="todo">${G.GOALS.map((g) => { const done = S.goalsDone[g.i], now = open.includes(g.i);
        return `<div class="${done ? 'done' : now ? 'now' : 'later'}"><span>${done ? '[x]' : '[ ]'}</span><span>${done || now || g.i <= last + 2 ? g.text : '…'}</span>${now ? `<span class="rw">${G.goalReward(S, g)}</span>` : ''}</div>`; }).join('')}</div>`;
    },
  },
  workflows: {
    key: () => 'wf|' + BOTS.map((b) => +b.has() + '' + +!!S[b.id]).join(''),
    html: () => `<div class="vhead"><div><div class="cm-line"># .github/workflows.yml</div><h2>Workflows</h2><p>Bots that do routine work for you. Each one comes from an upgrade or a perk. Switch them off any time.</p></div><span class="pill good">${activeBots().length} running</span></div>
      <div class="roles">${BOTS.map((b) => b.has() ? `<div class="wfrow"><div><h3>${b.name}:</h3><div class="note">${b.note}</div></div>
        <button class="switch" data-act="toggle" data-arg="${b.id}" aria-pressed="${!!S[b.id]}">${S[b.id] ? 'on' : 'off'}</button>
        ${b.id === 'autoShip' ? `<label class="full kv" for="autodebt"><span>only while debt is under</span><b id="ad-lbl2"></b></label><input class="full" type="range" id="autodebt" min="5" max="40" step="1" value="${Math.round(S.autoShipDebt * 100)}">` : ''}
        ${b.id === 'autoRefactor' ? `<label class="full kv" for="reftarget"><span>hold debt near</span><b id="rt-lbl"></b></label><input class="full" type="range" id="reftarget" min="2" max="30" step="1" value="${Math.round(S.refactorTarget * 100)}">` : ''}</div>`
        : `<div class="wfrow off"><div><h3># ${b.name}</h3><div class="note">Not installed. Comes from ${b.from}.</div></div><span class="pill">off</span></div>`).join('')}</div>`,
    live: () => { if ($('#ad-lbl2')) $('#ad-lbl2').textContent = pct(S.autoShipDebt); if ($('#rt-lbl')) $('#rt-lbl').textContent = pct(S.refactorTarget); },
  },
  ipo: {
    key: () => ['ipo', G.canIpo(S), S.shares, Object.keys(S.board).join(','), Date.now() - armed.ipo < 4000].join('|'),
    html: () => {
      const ok = G.canIpo(S), isArmed = Date.now() - armed.ipo < 4000;
      return `<div class="vhead"><div><div class="cm-line">// founder/ipo.ts</div><h2>IPO</h2><p>Take a company public. It resets everything a sale resets, plus your Founder Points, perks and sale count. In return you get Shares: spend them on permanent Board Room seats, or keep them for +${S.board.dualclass ? 50 : 25}% code and income each.</p></div>
        <span class="pill rep">${S.shares} Shares · ${S.ipos} IPO${S.ipos === 1 ? '' : 's'}</span></div>
        <div class="card"><div class="kv"><span>Companies sold (need 3)</span><b>${Math.min(S.exits, 3)} / 3</b></div>
          <div class="kv"><span>Valuation (need ${money(G.IPO_VALUATION)})</span><b id="ipo-val"></b></div><div class="bar rep"><div id="ipo-bar"></div></div>
          <div class="kv"><span>Shares if you go public now</span><b id="ipo-sh"></b></div>
          <button class="btn ${isArmed ? 'danger' : 'rep'} block" data-act="ipo" ${ok ? '' : 'disabled'}><span>${isArmed ? 'Click again to ring the bell' : 'Go public'}</span><span class="num">${ok ? '' : S.challenge ? 'not during a challenge' : 'not yet'}</span></button></div>
        <div class="section-t"><span>Board Room</span><span class="num">${Object.keys(S.board).length} / ${G.BOARD.length} seats</span></div>
        <div class="cards">${G.BOARD.map((b) => `<div class="card ${S.board[b.id] ? 'done' : ''}"><div class="top"><span class="t">${b.name}</span><span class="pill rep">${b.cost} sh</span></div><span class="d">${b.desc}</span>
          ${S.board[b.id] ? '<span class="pill good">owned</span>' : `<button class="btn rep" data-act="board" data-arg="${b.id}" ${S.shares >= b.cost ? '' : 'disabled'}><span>Take the seat</span><span class="num">${b.cost} sh</span></button>`}</div>`).join('')}</div>`;
    },
    live: () => { $('#ipo-val').textContent = money(G.valuation(S)); $('#ipo-bar').style.width = fillPct(G.valuation(S), G.IPO_VALUATION); $('#ipo-sh').textContent = '+' + G.sharesGain(S); },
  },
  challenges: {
    key: () => ['ch', S.challenge, Object.keys(S.chDone).join(','), armed.chId && Date.now() - armed.ch < 4000 ? armed.chId : ''].join('|'),
    html: () => `<div class="vhead"><div><div class="cm-line">// founder/challenges.ts</div><h2>Challenges</h2><p>Start a company under a hard rule. Reach the goal to earn a permanent reward. Starting one ends your current company without Founder Points.</p></div>
      <span class="pill rep">${Object.keys(S.chDone).length} / ${G.CHALLENGES.length} done</span></div>
      <div class="cards">${G.CHALLENGES.map((c) => {
        const active = S.challenge === c.id, done = S.chDone[c.id], isArmed = armed.chId === c.id && Date.now() - armed.ch < 4000;
        return `<div class="card ${done ? 'done' : ''}"><div class="top"><span class="t">${c.name}</span>${done ? '<span class="pill good">done</span>' : active ? '<span class="pill money">active</span>' : ''}</div>
          <span class="d"><b>Rule:</b> ${c.rule}<br><b>Goal:</b> ${money(c.goal)} valuation<br><b>Reward:</b> ${c.reward}</span>
          ${active ? `<div class="bar money"><div data-ch="${c.id}"></div></div>` : done ? '' : `<button class="btn ${isArmed ? 'danger' : 'rep'}" data-act="challenge" data-arg="${c.id}" ${S.challenge ? 'disabled' : ''}><span>${isArmed ? 'Click again to start' : 'Start challenge'}</span></button>`}</div>`;
      }).join('')}</div>`,
    live: () => { if (S.challenge) { const c = G.challengeDef(S.challenge); const el = document.querySelector<HTMLElement>(`[data-ch="${c.id}"]`); if (el) el.style.width = fillPct(G.valuation(S), c.goal); } },
  },
  stats: {
    key: () => 'st|' + Math.floor(S.t / 2),
    html: () => {
      const R = G.rates(S), m = G.mods(S);
      const kv = (k: string, v: string | number) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
      const roles = G.ENGINEERS.filter((d) => R.byRole[d.id]).map((d) => kv(d.name, fmt(R.byRole[d.id]) + ' LoC/s (' + pct(R.byRole[d.id] / Math.max(1, R.team)) + ')')).join('') || kv('No engineers yet', '—');
      return `<div class="vhead"><div><div class="cm-line"># stats.md</div><h2>Statistics</h2><p>Where your code and money come from.</p></div></div>
      <div class="statgrid">
        <div class="card"><span class="t">Code per second</span>${roles}${kv('Your clicks', '+' + fmt(G.clickValue(S)) + ' per click')}${kv('Spent on refactoring', pct(S.refactor))}</div>
        <div class="card"><span class="t">Income multipliers</span>${kv('Market filled', pct(G.saturation(S)))}${kv('Tech debt', '×' + G.quality(S).toFixed(2))}${kv('Product upgrades', '×' + m.mrr.toFixed(2))}${kv('Founder Points + achievements', '×' + m.prestige.toFixed(2))}${S.dilution < 1 ? kv('Investor dilution', '×' + S.dilution.toFixed(2)) : ''}${kv('Right now', money(G.mrr(S)) + '/s')}</div>
        <div class="card"><span class="t">This company</span>${kv('Time', Math.floor(S.t / 60) + ' min')}${kv('Releases', S.stats.ships)}${kv('Client jobs', S.stats.contracts)}${kv('Incidents', S.stats.incidents)}${kv('Bugs squashed / escaped', S.stats.bugs + ' / ' + S.stats.bugsEscaped)}${kv('Decisions', S.stats.decisions)}${kv('Money earned', money(S.stats.runMoney))}</div>
        <div class="card"><span class="t">All time</span>${kv('Companies sold', S.exits)}${kv('Total sold for', money(S.soldTotal))}${kv('Clicks', fmt(S.life.clicks))}${kv('Releases', fmt(S.life.ships))}${kv('Client jobs', fmt(S.life.contracts))}${kv('Bugs squashed', fmt(S.life.bugs))}${kv('Money earned', money(S.life.money))}</div>
      </div>`;
    },
  },
  settings: {
    key: () => 'set|' + notation + '|' + (UI.theme || 'system'),
    html: () => `<div class="vhead"><div><div class="cm-line">// settings.json</div><h2>Settings</h2><p>Your game saves in this browser every few seconds. Export a copy to move it or keep it safe.</p></div></div>
      <div class="card"><span class="t">"numberFormat"</span><div class="chips">${[['short', '1.23M'], ['sci', '1.23e6']].map(([k, l]) => `<button class="chip" data-act="notation" data-arg="${k}" aria-pressed="${notation === k}">${l}</button>`).join('')}</div></div>
      <div class="card"><span class="t">"theme"</span><div class="chips">${['system', 'light', 'dark'].map((k) => `<button class="chip" data-act="theme" data-arg="${k}" aria-pressed="${(UI.theme || 'system') === k}">${k}</button>`).join('')}</div></div>
      <div class="card"><span class="t">"export"</span><textarea class="box" id="export-box" readonly aria-label="Exported save"></textarea><button class="btn ghost" data-act="export"><span>Export and copy</span></button></div>
      <div class="card"><span class="t">"import"</span><textarea class="box" id="import-box" placeholder="Paste a save here" aria-label="Save to import"></textarea><button class="btn ghost" data-act="import"><span>Load this save</span></button></div>`,
  },
  achievements: {
    key: () => 'a|' + Object.keys(S.ach).length,
    html: () => `<div class="vhead"><div><div class="cm-line"># ACHIEVEMENTS.md</div><h2>Achievements</h2><p>Each one gives +1% code and income, forever.</p></div><span class="pill good">${Object.keys(S.ach).length} / ${G.ACHIEVEMENTS.length}</span></div>
      <div class="cards">${G.ACHIEVEMENTS.map((a) => `<div class="card ${S.ach[a.id] ? '' : 'done'}"><span class="t mono">${S.ach[a.id] ? '[x]' : '[ ]'} ${a.name}</span><span class="d">${S.ach[a.id] || a.id !== 'duck' ? a.desc : '???'}</span></div>`).join('')}</div>`,
  },
};

function renderView() {
  if (UI.file && !visibleFiles().some((f) => f.id === UI.file)) UI.file = null;
  const id = UI.file || 'welcome';
  const v = VIEWS[id];
  const f = FILES.find((x) => x.id === id);
  region('view-tabs', 'tab' + id, () => `<div class="tab active">${f ? `<span class="crumb">${f.folder ? f.folder + ' /' : ''}</span> ${f.name}` : 'Welcome'}</div>`);
  if (region('view', id + '#' + v.key(), v.html) || true) v.live && v.live();
}

function renderPanel() {
  const d = G.debtPct(S);
  region('ptabs', `${UI.ptab}|${S.revealed.debt}|${sev(d)}|${Math.round(d * 100)}`, () => `
    <button class="ptab" role="tab" data-act="ptab" data-arg="terminal" aria-selected="${UI.ptab === 'terminal'}">Terminal</button>
    ${S.revealed.debt ? `<button class="ptab" role="tab" data-act="ptab" data-arg="problems" aria-selected="${UI.ptab === 'problems'}">Problems <span class="badge ${sev(d) === 'good' ? '' : sev(d)}">${pct(d)} debt</span></button>` : ''}`);
  if (UI.ptab === 'problems' && S.revealed.debt) {
    region('pbody', 'problems|' + (G.mods(S).autoRefactor && S.autoRefactor) + S.refactorTarget, () => `<div class="problems">
      <div class="col"><p class="hint">Fast, sloppy code piles up tech debt. Debt lowers your income and makes incidents more likely. Put part of the team on refactoring to pay it down.</p>
        <div class="bar"><div id="debt-bar"></div></div>
        <div class="kv"><span>Tech debt</span><b id="debt-pct"></b></div><div class="kv"><span>Income multiplier</span><b id="debt-q"></b></div></div>
      <div class="col"><label for="refactor" class="kv"><span>Team time on refactoring</span><b id="ref-lbl"></b></label>
        <input type="range" id="refactor" min="0" max="90" step="5" value="${Math.round(S.refactor * 100)}">
        <div class="ends"><span>All features</span><span>Mostly cleanup</span></div>
        ${G.mods(S).autoRefactor && S.autoRefactor ? `<p class="hint">Refactor Bot is holding debt near ${pct(S.refactorTarget)} (change it in workflows.yml).</p>` : ''}
        <div class="kv"><span>Debt per second</span><b id="debt-rate"></b></div><div class="kv"><span>Big-team bugs (Brooks's law)</span><b id="debt-team"></b></div>
        ${G.mods(S).autoShip ? `<label for="autodebt" class="kv"><span>Auto-ship only under</span><b id="ad-lbl"></b></label><input type="range" id="autodebt" min="5" max="40" step="1" value="${Math.round(S.autoShipDebt * 100)}">` : ''}</div></div>`);
    const R = G.rates(S);
    $('#debt-bar').style.width = Math.min(100, d * 200) + '%';
    $('#debt-bar').parentElement!.className = 'bar ' + (sev(d) === 'bad' ? 'bad' : sev(d) === 'warn' ? 'money' : '');
    $('#debt-pct').textContent = pct(d);
    $('#debt-q').textContent = '×' + G.quality(S).toFixed(2);
    $('#ref-lbl').textContent = pct(S.refactor);
    const net = R.bug - R.refactor;
    $('#debt-rate').textContent = (net >= 0 ? '+' : '') + fmt(net) + '/s';
    $('#debt-team').textContent = '×' + G.teamBug(S).toFixed(2);
    const sl = $<HTMLInputElement>('#refactor'); if (document.activeElement !== sl) sl.value = String(Math.round(S.refactor * 100));
    if ($('#ad-lbl')) $('#ad-lbl').textContent = pct(S.autoShipDebt);
  } else {
    const top = S.feed[0];
    region('pbody', 'log|' + S.feed.length + '|' + (top ? top.t + top.text : ''), () => `<div class="log">
      <div><span class="prompt">$</span><b>git log --oneline</b></div>
      ${S.feed.length ? S.feed.map((f) => `<div class="${f.kind}"><span>${String(Math.floor(f.t / 60)).padStart(2, '0')}:${String(Math.floor(f.t % 60)).padStart(2, '0')}</span><b>${esc(f.text)}</b></div>`).join('') : '<div><span>00:00</span><b>Initial commit. Click app.ts to start writing code.</b></div>'}</div>`);
  }
}

function renderStatus() {
  const R = G.rates(S);
  const d = G.debtPct(S);
  const isArmedReset = Date.now() - armed.reset < 4000;
  const items = [
    `<span class="it" data-act="duck" title="Rubber duck">🦆 main · ${G.versionStr(S)}</span>`,
    `<span class="it"><span class="k">LoC</span><span id="st-loc"></span></span>`,
  ];
  if (S.revealed.money) items.push(`<span class="it"><span class="k">$</span><span id="st-money"></span></span>`);
  if (S.revealed.rep) items.push(`<span class="it"><span class="k">★ Rep</span><span id="st-rep"></span></span>`);
  if (S.revealed.debt) items.push(`<span class="it ${sev(d) !== 'good' ? 'warn' : ''}" id="st-debt-wrap" data-act="ptab" data-arg="problems" style="cursor:pointer" title="Open Problems"><span class="k">⚠ debt</span><span id="st-debt"></span></span>`);
  if (S.fp || S.exits) items.push(`<span class="it"><span class="k">FP</span>${S.fp}</span>`);
  if (S.shares || S.ipos) items.push(`<span class="it"><span class="k">Shares</span>${S.shares}</span>`);
  if (S.challenge) items.push(`<span class="it warn" data-act="open" data-arg="challenges" style="cursor:pointer">⚑ ${G.challengeDef(S.challenge).name}</span>`);
  items.push('<span class="sp"></span>');
  items.push(`<span class="it"><span class="k">company #${S.exits + 1} · ${Math.floor(S.t / 60)} min</span></span>`);
  items.push(`<span class="it"><span class="k">speed</span></span>${[1, 5, 20].map((x) => `<button data-act="speed" data-arg="${x}" aria-pressed="${speed === x}">×${x}</button>`).join('')}`);
  items.push(`<button data-act="reset">${isArmedReset ? 'click again to reset' : 'reset'}</button>`);
  region('status', [S.shares, S.ipos, S.challenge, S.revealed.money, S.revealed.rep, S.revealed.debt, sev(d), S.fp, S.exits, Math.floor(S.t / 60), speed, isArmedReset, S.version.join('.')].join('|'), () => items.join(''));
  $('#st-loc').textContent = fmt(S.loc) + (R.feature ? ` (+${fmt(R.feature)}/s)` : '');
  if ($('#st-money')) $('#st-money').textContent = fmt(S.money) + (S.revealed.ship ? ` (+${fmt(G.mrr(S))}/s)` : '');
  if ($('#st-rep')) $('#st-rep').textContent = fmt(S.rep);
  if ($('#st-debt')) $('#st-debt').textContent = pct(d);
}

function render() {
  renderTitle(); renderExplorer(); renderWrite(); renderView(); renderPanel(); renderStatus();
}

/* ---------- loop ---------- */
let last = performance.now(), saveAt = 0;
function frame(now: number) {
  let dt = Math.min(1, (now - last) / 1000) * speed;
  last = now;
  while (dt > 0) { const step = Math.min(0.1, dt); G.tick(S, step, Math.random); dt -= step; }
  for (const ev of S.events) if (ev.kind === 'reveal' || ev.kind === 'bad' || ev.kind === 'goal') toast(ev.text, ev.kind === 'goal' ? 'reveal' : ev.kind);
  S.events.length = 0;
  // the first incident teaches where tech debt lives
  if (S.stats.incidents > 0 && !UI.debtTip) { UI.debtTip = true; UI.ptab = 'problems'; toast('Tip: incidents come from tech debt. Use the refactoring slider in PROBLEMS to pay it down.', 'reveal'); }
  // open the first file automatically so a new player is never staring at an empty pane
  if (!UI.file) { const first = visibleFiles().find((f) => !f.md); if (first && Object.keys(UI.opened).length === 0) { UI.file = first.id; UI.opened[first.id] = true; } }
  render();
  if (now > saveAt) { save(); saveAt = now + 5000; }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
// Type to code: any letter, number or space key writes code (held keys do not repeat).
document.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
  if (e.key.length !== 1) return;
  if (e.key === ' ') e.preventDefault();
  if (S.incident) G.hotfix(S); else { G.click(S); pushLine(); }
});
if (welcome) setTimeout(() => toast(welcome, 'reveal'), 300);
render();
requestAnimationFrame(frame);
