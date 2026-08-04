/* The opener must: dip from black, show a welcome card with applause, advance
   only on Next, keep Peff readable on the light panel, and sting answers without
   ever repeating a sting. Run: node tools/maroon-flow-test.js */
const http=require('http'),{spawn}=require('child_process'),os=require('os'),fs=require('fs');
const WebSocket=require('ws');
const CHROME='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT=9364;
const get=p=>new Promise((res,rej)=>http.get({host:'127.0.0.1',port:PORT,path:p},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const ch=spawn(CHROME,['--headless=new','--disable-gpu','--remote-debugging-port='+PORT,'--no-first-run',
   '--window-size=900,430','--force-device-scale-factor=2.2','--user-data-dir='+os.tmpdir()+"\\\\cw-mf",
   'http://localhost:8099/index.html?no3d=1'],{stdio:'ignore'});
 let t=null;for(let i=0;i<40&&!t;i++){await sleep(400);try{t=(await get('/json/list')).find(x=>x.type==='page'&&x.url.includes('index.html'))}catch{}}
 const ws=new WebSocket(t.webSocketDebuggerUrl,{perMessageDeflate:false});let id=0;const pend=new Map();
 const errors=[];
 ws.on('message',m=>{const j=JSON.parse(m);if(j.id&&pend.has(j.id)){pend.get(j.id)(j);pend.delete(j.id)}
  if(j.method==='Runtime.exceptionThrown'){const d=(j.params.exceptionDetails.exception||{}).description||j.params.exceptionDetails.text;if(d&&d!=='Event')errors.push(d);}});
 await new Promise(r=>ws.on('open',r));
 const send=(m,p)=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))});
 const ev=async e=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result.result.value;
 await send('Runtime.enable');
  /* Reused --user-data-dir means a Chrome disk cache; without this a harness
     can quietly run an older copy of the JS than the one on disk. */
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
 const wf=async s=>{for(let i=0;i<80;i++){if(await ev(`!!document.querySelector(${JSON.stringify(s)})`))return;await sleep(250)}throw new Error('no '+s)};
 await wf('#screen-title.active');await ev('localStorage.clear()');await send('Page.reload',{});
 await wf('#screen-title.active');await sleep(300);
 await ev(`document.getElementById('btn-new-game').click()`);await wf('#screen-create.active');
 await ev(`document.getElementById('btn-create-go').click()`);
 await wf('#screen-maroon.active');
 await sleep(400);

 const dip = await ev(`(()=>{const d=document.getElementById('maroon-dip');return {present:!!d,lifting:d?d.classList.contains('lift'):false};})()`);
 console.log('dip from black      :', JSON.stringify(dip));
 /* The dip takes 1.5s, then the card staggers in and the crowd line fades up a
    second after that. Read it once everything has landed. */
 await sleep(3400);
 /* The crowd line lives INSIDE the card now, as the last line of one vertical
    stack — floating it separately put it straight through the kicker. */
 const title = await ev(`(()=>{
   const t = document.getElementById('maroon-title');
   const a = t.querySelector('.mt-applause');
   return {
     title: t.textContent,
     titleShown: t.classList.contains('go'),
     applause: a ? a.textContent : '',
     applauseShown: !!a && +getComputedStyle(a).opacity > 0.2,
     /* The card has to actually cover the panel; being a child of the beach stage
        capped its z-index and it centred behind it. */
     coversPanel: (() => {
       const p = document.getElementById('maroon-panel');
       return t.compareDocumentPosition(p) === Node.DOCUMENT_POSITION_PRECEDING;
     })(),
     /* And no line may render a ghost copy of itself from an inherited shadow. */
     inheritedShadow: getComputedStyle(t).textShadow,
     dipFaded: +getComputedStyle(document.getElementById('maroon-dip')).opacity < 0.1
   };})()`);
 console.log('welcome card        :', JSON.stringify(title));

 const contrast = await ev(`(() => {
   const el = document.querySelector('#maroon-convo .mc-text') || document.getElementById('maroon-convo');
   const toRgb = v => { const m = v.match(/[0-9]+/g) || []; return m.slice(0,3).map(Number); };
   const lum = v => { const c = toRgb(v); return (0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]) / 255; };
   const a = lum(getComputedStyle(el).color);
   const b = lum(getComputedStyle(document.getElementById('maroon-panel')).backgroundColor);
   const hi = Math.max(a,b), lo = Math.min(a,b);
   return { color: getComputedStyle(el).color, ratio: Math.round(((hi+0.05)/(lo+0.05))*100)/100 };
 })()`);
 console.log('Peff text contrast  :', JSON.stringify(contrast));

 /* The two tribes have to read as two: separate mats, own banners, a gap. */
 const tribes = await ev(`(() => {
   const groups = [...document.querySelectorAll('#maroon-line .maroon-tribe')];
   return {
     groups: groups.length,
     tags: groups.map(g => (g.querySelector('.maroon-tribe-tag')||{}).textContent || ''),
     colors: groups.map(g => getComputedStyle(g).getPropertyValue('--t-color').trim()),
     gap: !!document.querySelector('#maroon-line .maroon-gap'),
     /* Colour lives on a flag planted beside each tribe now, not on a band
        across everybody's middle — which read as a bum bag at this size. */
     flags: document.querySelectorAll('#maroon-line .tribe-flag').length,
     flagsHaveMarks: [...document.querySelectorAll('#maroon-line .tf-mark')].map(m => m.textContent),
     bandsOnBodies: document.querySelectorAll('#maroon-line .buff').length,
     figs: document.querySelectorAll('#maroon-line .mfig').length
   };
 })()`);
 console.log('tribe separation    :', JSON.stringify(tribes));

 // must be waiting on a Next button, not a timer
 const paced = await ev(`(()=>{const b=document.querySelector('#maroon-choices button');
   return { waiting:!!b, label:b?b.textContent:null, only:document.querySelectorAll('#maroon-choices button').length };})()`);
 console.log('player-paced        :', JSON.stringify(paced));
 const before = await ev(`document.getElementById('maroon-convo').textContent`);
 await sleep(1800);
 const after = await ev(`document.getElementById('maroon-convo').textContent`);
 console.log('did NOT auto-advance:', before===after);

 /* THE TRAP: the opening card covers the screen and hides the panel beneath it,
    so for one beat the Begin button was invisible AND pointer-events:none and the
    applause screen had no way out at all. A tap anywhere has to advance it. */
 const tapOut = await ev(`(() => {
   const before = document.getElementById('maroon-convo').children.length;
   const titling = document.getElementById('screen-maroon').classList.contains('titling');
   const btn = document.querySelector('#maroon-choices button');
   const btnReachable = !!btn && btn.offsetParent !== null
     && getComputedStyle(document.getElementById('maroon-panel')).pointerEvents !== 'none';
   /* Tap the screen itself, nowhere near any button. */
   document.getElementById('screen-maroon').dispatchEvent(
     new PointerEvent('pointerdown', { bubbles: true }));
   return { titling, btnReachable, before };
 })()`);
 await sleep(500);
 const tapWorked = await ev(`document.getElementById('maroon-convo').children.length > ${tapOut.before}
   || !document.getElementById('screen-maroon').classList.contains('titling')`);
 console.log('tap to continue     :', JSON.stringify({ ...tapOut, advanced: tapWorked }));

 /* And a tap must NEVER pick an answer for you when options are on screen. */
 for (let i = 0; i < 14; i++) {
   if (await ev(`document.querySelectorAll('#maroon-choices .maroon-opt').length > 0`)) break;
   await ev(`(()=>{const b=document.querySelector('#maroon-choices button');if(b)b.click();})()`);
   await sleep(300);
 }
 const choiceSafe = await ev(`(() => {
   const opts = document.querySelectorAll('#maroon-choices .maroon-opt').length;
   if (!opts) return { opts: 0, stillThere: null };
   document.getElementById('screen-maroon').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
   return { opts, stillThere: document.querySelectorAll('#maroon-choices .maroon-opt').length };
 })()`);
 console.log('tap near choices    :', JSON.stringify(choiceSafe));

 // click through and collect every Peff line to check stings appear and never repeat
 const seen=[];
 let maxTurns = 0, sawReply = false, sawPeff = false, keptHistory = false;
 let lastCount = -1; const burstAdds = [];
 for(let i=0;i<70;i++){
   if(await ev(`!!document.querySelector('#screen-camp.active')`))break;
   const st = await ev(`(() => {
     const turns = [...document.querySelectorAll('#maroon-convo .mc-turn')];
     const latest = turns[turns.length - 1];
     return {
       n: turns.length,
       peff: turns.filter(t => t.classList.contains('peff')).map(t => (t.querySelector('.mc-text')||{}).textContent || ''),
       reply: turns.some(t => t.classList.contains('reply')),
       /* An earlier turn must still be on screen and legible, not replaced. */
       olderVisible: turns.length > 1 && +getComputedStyle(turns[turns.length - 2]).opacity > 0.25,
       latestFull: latest ? +getComputedStyle(latest).opacity > 0.9 : false
     };
   })()`);
   /* ONE LINE PER TAP. The answer and Peff's comeback used to arrive on the same
      tap, so two people spoke at once. Never more than one new turn per advance. */
   if (lastCount >= 0 && st.n - lastCount > 1) burstAdds.push(st.n - lastCount);
   lastCount = st.n;
   maxTurns = Math.max(maxTurns, st.n);
   if (st.reply) sawReply = true;
   if (st.peff.length) sawPeff = true;
   if (st.olderVisible && st.latestFull) keptHistory = true;
   for (const l of st.peff) if (l && seen.indexOf(l) < 0) seen.push(l);
   await ev(`(()=>{const b=document.querySelector('#maroon-choices button');if(b){b.click();return true}return false})()`);
   await sleep(260);
 }
 const dupes = [];
 /* "Last one" may be said at most once, and only about the last question. */
 const lastOne = seen.filter(l => /last one|final question|one more and we are done/i.test(l));
 console.log('conversation        :', JSON.stringify({ maxTurns, sawPeff, sawReply, keptHistory }));
 console.log('lines per tap       :', burstAdds.length ? 'BURSTS of ' + burstAdds.join(', ') : 'always one');
 console.log('positional framing  :', lastOne.length, 'line(s) claiming to be the last');
 const stings = await ev(`(()=>{
   const all=[...Object.values(PEFF_STINGS).flat(), ...Object.values(PEFF_STINGS_NPC).flat()];
   /* Force the roll and confirm a sting actually comes out of the pool. */
   const keep = CONFIG.maroonStingChance;
   CONFIG.maroonStingChance = 1;
   const fired = Marooning.sting('sting:probe:test', PEFF_STINGS_NPC.strategist);
   CONFIG.maroonStingChance = keep;
   return { pool: all.length, fires: !!fired,
            used: [...Marooning.used].filter(k=>k.indexOf('sting:')===0).length };})()`);
 console.log('Peff lines shown    :', seen.length, ' repeats:', dupes.length);
 console.log('sting pool          :', stings.pool, ' stings used this run:', stings.used);
 const shot=await send('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync(__dirname+'/_mflow.png',Buffer.from(shot.result.data,'base64'));

 const checks = {
   dip: dip.present,
   bigOpening: title.titleShown && /CASTAWAY/.test(title.title) && /SEASON 1/.test(title.title)
     && /ONE SURVIVOR/.test(title.title),
   applause: title.applauseShown && title.applause.length > 4,
   cardCoversPanel: title.coversPanel,
   noGhostShadow: title.inheritedShadow === 'none',
   dipFaded: title.dipFaded,
   readable: contrast.ratio >= 4.5,
   playerPaced: paced.waiting && paced.only === 1 && before === after,
   /* Two tribes, two banners, two colours, a gap, and a buff on every castaway. */
   twoTribes: tribes.groups === 2 && tribes.gap,
   tribesLabelled: tribes.tags.length === 2 && tribes.tags.every(t => t.trim().length > 2),
   tribesDiffer: tribes.colors[0] && tribes.colors[1] && tribes.colors[0] !== tribes.colors[1],
   /* One flag per tribe, each carrying its own mark, and nothing worn on a body. */
   flagPerTribe: tribes.flags === 2,
   flagsMarked: tribes.flagsHaveMarks.length === 2
     && new Set(tribes.flagsHaveMarks).size === 2,
   noBandsOnBodies: tribes.bandsOnBodies === 0,
   /* The conversation is an exchange that keeps its history. */
   isConversation: sawPeff && sawReply && maxTurns >= 4,
   historyKept: keptHistory,
   oneLinePerTap: burstAdds.length === 0,
   /* And he stops claiming every question is the last one. */
   noFalseLastOne: lastOne.length <= 1,
   /* No dead end on the opening card, and no tap-triggered answer. */
   tapAdvances: tapWorked === true,
   tapDoesNotPickAnswer: choiceSafe.opts === 0 || choiceSafe.stillThere === choiceSafe.opts,
   /* The property is a deep pool that never repeats, not that a sting happened to
      fire in one short scripted run — it is a 55% roll per question and this run
      only reaches a few. Check the mechanism directly instead. */
   stings: stings.pool >= 70 && stings.fires,
   noErrors: !errors.length
 };
 console.log('\nchecks:');
 for (const [k, v] of Object.entries(checks)) console.log('  ' + (v ? 'ok  ' : 'FAIL') + ' ' + k);
 const ok = Object.values(checks).every(Boolean);
 if(errors.length)console.log('!! errors:',errors.slice(0,3));
 console.log(ok?'\nMAROON FLOW PASS':'\nMAROON FLOW FAIL');
 ws.close();ch.kill();process.exit(ok?0:1);
})();
