/* How much should playing the minigame well be worth?

   chal-fair.js found the actual problem behind "there is an immediate winner
   ruling the challenge completely". It is not that one NPC wins everything — the
   winner's identity varies correctly, 5.8 different winners across 8 challenges.
   It is that the PLAYER has no lever. An average-statted player who plays the
   minigame flawlessly wins 11% of an 11-person field. Random is 9%.

   So from the player's chair every challenge is decided by somebody else, and the
   minigame is a cutscene you tap through.

   THE LEVER: CONFIG.challengeSkillSpan. Flawless play adds
   (perf - 0.5) * 2 * span to the score. At the current 0.31 that is +0.31, against
   a field whose 1st-to-last spread is 1.03. Half a spread is what it takes to climb
   from median to first, so the ceiling on skill is worth about two thirds of what
   it needs to be.

   WHAT WE WANT — a gradient, not a guarantee:

     flawless play (perf 1.0)   wins 35-55%   skill is the main lever, not the only one
     good play     (perf 0.75)  wins 20-30%   clearly better than coasting
     mediocre      (perf 0.50)  wins ~9%      the field decides; you were a passenger
     bad           (perf 0.25)  wins < 5%     stats cannot save you

   A flawless run should USUALLY not win — a strong castaway having a good day
   should still beat you sometimes, or the NPCs stop mattering. But it should be
   the single biggest thing on the board. That is the shape real Survivor has:
   Ozzy loses challenges, he just loses fewer.

   Run: node tools/chal-span-sweep.js */
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
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-span-' + RUN_ID),
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
    const SPANS = [0.31, 0.40, 0.50, 0.60, 0.70, 0.80, 0.95];
    const PERFS = [1.0, 0.75, 0.5, 0.25];
    const SEASONS = 250, ROUNDS = 8, FIELD = 11;
    const orig = CONFIG.challengeSkillSpan;
    const pool = CHALLENGES.filter(c => !c.finalFourOnly && !c.rewardOnly && !c.fire);

    /* Build the fields ONCE and reuse them for every span, so the comparison across
       the sweep is not eating fresh generator noise at each step. Same discipline as
       the condition sweep: vary one thing. */
    const fields = [];
    for (let s = 0; s < SEASONS; s++) {
      const f = [];
      for (let i = 0; i < FIELD; i++) {
        const c = Generator.generateCastaway();
        c.hunger = 0.5; c.fatigue = 0.5; c.morale = 0.65;
        if (typeof Fire !== 'undefined') Fire.seed([c]);
        f.push(c);
      }
      const me = Generator.generateCastaway();
      for (const k of STAT_KEYS) me.stats[k] = 0.5;
      me.isPlayer = true; me.hunger = 0.5; me.fatigue = 0.5; me.morale = 0.65;
      if (typeof Fire !== 'undefined') Fire.seed([me]);
      fields.push({ f, me });
    }

    const out = [];
    for (const span of SPANS) {
      CONFIG.challengeSkillSpan = span;
      const win = {};
      for (const p of PERFS) win[p] = 0;
      let n = 0;
      for (let s = 0; s < SEASONS; s++) {
        const { f, me } = fields[s];
        for (let k = 0; k < ROUNDS; k++) {
          const chal = pool[(s * 5 + k * 11) % pool.length];
          let bs = -Infinity;
          for (const c of f) { const sc = Challenges.score(c, chal); if (sc > bs) bs = sc; }
          n++;
          for (const p of PERFS) {
            const was = GAME.playerPerf;
            GAME.playerPerf = p;
            const mine = Challenges.score(me, chal);
            GAME.playerPerf = was;
            if (mine > bs) win[p]++;
          }
        }
      }
      out.push({
        span,
        flawless: +(win[1.0] / n).toFixed(3),
        good: +(win[0.75] / n).toFixed(3),
        mid: +(win[0.5] / n).toFixed(3),
        bad: +(win[0.25] / n).toFixed(3)
      });
    }
    CONFIG.challengeSkillSpan = orig;
    return out;
  })()`);

  console.log(NL + 'LEVER: CONFIG.challengeSkillSpan   (250 seasons x 8 challenges, 11-strong field)');
  console.log('Player win rate by how well they played the minigame.' + NL);
  console.log('  span   flawless    good    mediocre     bad     verdict');
  console.log('  ----   --------   -----   ---------   -----    -------');
  for (const r of rows) {
    const pc = v => (v * 100).toFixed(0).padStart(3) + '%';
    /* The shape we are hunting: flawless in band, and a real staircase down to bad. */
    const inBand = r.flawless >= 0.35 && r.flawless <= 0.55;
    const staircase = r.good >= 0.18 && r.good <= 0.32 && r.bad <= 0.05;
    const verdict = inBand && staircase ? '<-- both' : inBand ? 'flawless ok' : staircase ? 'gradient ok' : '';
    console.log('  ' + r.span.toFixed(2) + '     ' + pc(r.flawless) + '      ' + pc(r.good)
      + '      ' + pc(r.mid) + '      ' + pc(r.bad) + '     ' + verdict);
  }
  console.log(NL + 'Reading it: "flawless" is a perfect minigame run by an exactly-average');
  console.log('castaway. It should land 35-55% — the biggest lever on the board, but not a');
  console.log('guarantee, or the 10 NPCs stop existing. "bad" must stay under 5% so that');
  console.log('tapping randomly is never rewarded.');
  ws.close(); ch.kill(); process.exit(0);
})();
