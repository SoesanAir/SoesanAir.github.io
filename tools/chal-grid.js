/* Joint sweep: npcFormSwing x challengeSkillSpan, with aptitude now in play.

   These two do not separate, so sweeping them one at a time gives the wrong answer.
   npcFormSwing sets how far out the field's best score sits (the bar the player has
   to clear); challengeSkillSpan sets how high the player can jump. Move either and
   the other's correct value moves with it.

   Six numbers decide it, and a setting has to satisfy all six:

     FIELD FAIRNESS — is it still a contest between the NPCs?
       distinct   different immunity winners across 8 rounds   >= 4.5  (show: ~5)
       topShare   the best castaway's share of those wins      <= 40%
       gapFrac    1st-to-2nd as a share of the whole field     <= 22%   see below

     PLAYER GRADIENT — does playing well pay?
       flawless   perfect minigame, average stats              35-55%
       good       decent minigame (perf 0.75)                  18-32%
       bad        barely tried (perf 0.25)                     <= 6%

   gapFrac is the one that speaks to the actual complaint. The player watches the
   tribe rails during every challenge, and a field of 1.12 / 0.82 / 0.44 / 0.28
   reads as "one person is ruling this" even on a week they lose. Tightening the top
   of the field matters as much as who ends up on top of it.

   Run: node tools/chal-grid.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const NL = String.fromCharCode(10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-grid-' + RUN_ID),
    'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 40 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('index.html')); } catch { }
  }
  if (!t) { console.log('no page'); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map();
  ws.on('message', m => { const j = JSON.parse(m); if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); } });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split(NL)[0]);
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 100; i++) { if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return; await sleep(250); }
    throw new Error('no ' + s);
  };

  await waitFor('#screen-title.active');
  await ev('localStorage.clear()');
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev("document.getElementById('btn-new-game').click()");
  await waitFor('#screen-create.active');
  await ev("GAME.fastMaroon=true;GAME.fastChallenge=true;document.getElementById('btn-create-go').click()");
  for (let i = 0; i < 400; i++) {
    if (await ev("!!document.querySelector('#screen-camp.active')")) break;
    await ev("(()=>{const b=document.querySelector('#maroon-choices button')||document.querySelector('.maroon-next');if(b&&!b.disabled)b.click();})()");
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev('DBG.setEnabled(false); window.toast=()=>{}; Telemetry.cfg.auto=false; true;');

  const rows = await ev(`(() => {
    const SWINGS = [0.54, 0.42, 0.32, 0.24, 0.18];
    const SPANS  = [0.31, 0.40, 0.50, 0.60, 0.70];
    const SEASONS = 200, ROUNDS = 8, FIELD = 11;
    const o = { swing: CONFIG.npcFormSwing, span: CONFIG.challengeSkillSpan };
    const pool = CHALLENGES.filter(c => !c.finalFourOnly && !c.rewardOnly && !c.fire);

    /* One set of fields, reused for every cell, so differences across the grid are
       the levers and not fresh generator noise. */
    const fields = [];
    for (let s = 0; s < SEASONS; s++) {
      const f = [];
      for (let i = 0; i < FIELD; i++) {
        const c = Generator.generateCastaway();
        c.hunger = 0.5; c.fatigue = 0.5; c.morale = 0.65;
        Aptitude.roll(c);
        if (typeof Fire !== 'undefined') Fire.seed([c]);
        f.push(c);
      }
      const me = Generator.generateCastaway();
      for (const k of STAT_KEYS) me.stats[k] = 0.5;
      me.isPlayer = true; me.hunger = 0.5; me.fatigue = 0.5; me.morale = 0.65;
      Aptitude.roll(me);
      if (typeof Fire !== 'undefined') Fire.seed([me]);
      fields.push({ f, me });
    }

    const out = [];
    for (const swing of SWINGS) {
      for (const span of SPANS) {
        CONFIG.npcFormSwing = swing;
        CONFIG.challengeSkillSpan = span;
        let distinct = 0, topShare = 0, gapSum = 0, spreadSum = 0, n = 0;
        const win = { 1: 0, 0.75: 0, 0.25: 0 };
        for (let s = 0; s < SEASONS; s++) {
          const { f, me } = fields[s];
          const wins = {};
          for (let k = 0; k < ROUNDS; k++) {
            const chal = pool[(s * 5 + k * 11) % pool.length];
            const scored = f.map(c => ({ c, v: Challenges.score(c, chal) })).sort((a, b) => b.v - a.v);
            wins[scored[0].c.name] = (wins[scored[0].c.name] || 0) + 1;
            gapSum += scored[0].v - scored[1].v;
            spreadSum += scored[0].v - scored[scored.length - 1].v;
            n++;
            for (const p of [1, 0.75, 0.25]) {
              const was = GAME.playerPerf;
              GAME.playerPerf = p;
              const mine = Challenges.score(me, chal);
              GAME.playerPerf = was;
              if (mine > scored[0].v) win[p]++;
            }
          }
          const counts = Object.values(wins);
          distinct += counts.length;
          topShare += Math.max(...counts) / ROUNDS;
        }
        out.push({
          swing, span,
          distinct: +(distinct / SEASONS).toFixed(2),
          topShare: +(topShare / SEASONS).toFixed(3),
          gapFrac: +(gapSum / spreadSum).toFixed(3),
          flawless: +(win[1] / n).toFixed(3),
          good: +(win[0.75] / n).toFixed(3),
          bad: +(win[0.25] / n).toFixed(3)
        });
      }
    }
    CONFIG.npcFormSwing = o.swing; CONFIG.challengeSkillSpan = o.span;
    return out;
  })()`);

  const pc = v => (v * 100).toFixed(0).padStart(3) + '%';
  console.log(NL + 'GRID: npcFormSwing x challengeSkillSpan   (aptitude on, 200 seasons x 8)');
  console.log(NL + ' swing  span   distinct  topShr  gapFrac  flawless   good    bad   ok?');
  console.log(' -----  ----   --------  ------  -------  --------  -----   ----   ---');
  let last = null;
  const winners = [];
  for (const r of rows) {
    if (last !== null && r.swing !== last) console.log('');
    last = r.swing;
    const fieldOk = r.distinct >= 4.5 && r.topShare <= 0.40 && r.gapFrac <= 0.22;
    const playOk = r.flawless >= 0.35 && r.flawless <= 0.55 && r.good >= 0.18 && r.good <= 0.32 && r.bad <= 0.06;
    if (fieldOk && playOk) winners.push(r);
    console.log('  ' + r.swing.toFixed(2) + '  ' + r.span.toFixed(2) + '     '
      + r.distinct.toFixed(2) + '     ' + pc(r.topShare) + '    ' + pc(r.gapFrac)
      + '     ' + pc(r.flawless) + '    ' + pc(r.good) + '   ' + pc(r.bad)
      + '   ' + (fieldOk && playOk ? '<== BOTH' : fieldOk ? 'field' : playOk ? 'player' : ''));
  }

  console.log(NL + 'Cells satisfying every target: ' + (winners.length || 'none'));
  if (winners.length) {
    /* Among the passing cells, prefer the one whose player gradient is most centred
       — flawless nearest 45%, good nearest 25%. A cell that only just squeaks inside
       a band will drift back out the next time anything else changes. */
    const score = r => Math.abs(r.flawless - 0.45) + Math.abs(r.good - 0.25);
    winners.sort((a, b) => score(a) - score(b));
    const w = winners[0];
    console.log('Best centred: npcFormSwing ' + w.swing + ', challengeSkillSpan ' + w.span);
    console.log('  ' + w.distinct + ' distinct winners, top takes ' + pc(w.topShare)
      + ', 1st-to-2nd is ' + pc(w.gapFrac) + ' of the field');
    console.log('  flawless ' + pc(w.flawless) + ' / good ' + pc(w.good) + ' / bad ' + pc(w.bad));
  }
  ws.close(); ch.kill(); process.exit(0);
})();
