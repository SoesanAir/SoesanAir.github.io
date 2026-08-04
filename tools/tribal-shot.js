/* Screenshot the tribal screen with a real vote in progress. */
const http=require('http'),{spawn}=require('child_process'),os=require('os'),fs=require('fs');
const WebSocket=require('ws');
const PORT=9344;
const get=p=>new Promise((res,rej)=>http.get({host:'127.0.0.1',port:PORT,path:p},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const ch=spawn(process.env.CHROME_BIN,['--headless=new','--disable-gpu','--remote-debugging-port='+PORT,'--no-first-run','--window-size=900,430','--force-device-scale-factor=2.2','--user-data-dir='+os.tmpdir()+'/cw-tshot','http://localhost:8099/index.html?no3d=1'],{stdio:'ignore'});
 let t=null;for(let i=0;i<40&&!t;i++){await sleep(400);try{t=(await get('/json/list')).find(x=>x.type==='page'&&x.url.includes('index.html'))}catch{}}
 const ws=new WebSocket(t.webSocketDebuggerUrl,{perMessageDeflate:false});let id=0;const pend=new Map();
 ws.on('message',m=>{const j=JSON.parse(m);if(j.id&&pend.has(j.id)){pend.get(j.id)(j);pend.delete(j.id)}});
 await new Promise(r=>ws.on('open',r));
 const send=(m,p)=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))});
 const ev=async e=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result.result.value;
 await send('Runtime.enable');
  /* Reused --user-data-dir means a Chrome disk cache; without this a harness
     can quietly run an older copy of the JS than the one on disk. */
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
 const errs=[];
 ws.on('message',m=>{const j=JSON.parse(m);if(j.method==='Runtime.exceptionThrown')errs.push((j.params.exceptionDetails.exception||{}).description||j.params.exceptionDetails.text);});
 const waitFor=async s=>{for(let i=0;i<60;i++){if(await ev(`!!document.querySelector(${JSON.stringify(s)})`))return;await sleep(250)}throw new Error('no '+s)};
 // a leftover save from a previous run changes the title flow; start clean
 await waitFor('#screen-title.active');
 await ev(`localStorage.clear()`);
 await send('Page.reload',{});
 await waitFor('#screen-title.active');await sleep(300);
 await ev(`document.getElementById('btn-new-game').click()`);
 await waitFor('#screen-create.active');
 await ev(`GAME.fastMaroon = true; document.getElementById('btn-create-go').click()`);
  // skip the marooning opener
  for (let i = 0; i < 80; i++) {
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    else await sleep(150);
  }
 await waitFor('#screen-camp.active');await waitFor('#figures .bfig');
 await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
 await sleep(700);
 // open the tribal vote screen directly with the player's tribe
 await ev(`(() => {
   const merged = ${process.env.ROSTER === 'merged'};
   if (merged) { GAME.merged = true; }
   const pool = merged ? alive() : aliveTribe(GAME.player.tribeName);
   addIntel(pool.find(c=>!c.isPlayer).name,'claim',pool.filter(c=>!c.isPlayer)[1].name,'sounded honest');
   tribalVoteScreen(pool); return true; })()`);
 await sleep(1200);
 const info = await ev(`(() => {
   const g=document.getElementById('tribal-grid');
   const cards=[...g.querySelectorAll('.cast-card')];
   const gb=g.getBoundingClientRect();
   // group by row (same top), then measure the widest row's symmetry
   const rows={};
   cards.forEach(c=>{const r=c.getBoundingClientRect();const k=Math.round(r.top);
     (rows[k]=rows[k]||[]).push(r);});
   const keys=Object.keys(rows);
   const widest=keys.map(k=>rows[k]).sort((a,b)=>b.length-a.length)[0];
   const left=Math.min(...widest.map(r=>r.left))-gb.left;
   const right=gb.right-Math.max(...widest.map(r=>r.right));
   // clipping: any card outside the grid's visible box
   const clipped=cards.filter(c=>{const r=c.getBoundingClientRect();
     return r.top < gb.top-1 || r.bottom > gb.bottom+1;}).length;
   return { cards: cards.length, bars: cards[0].querySelectorAll('.cc-bars .meter').length,
            rows: keys.length, left: Math.round(left), right: Math.round(right),
            clipped, scrollable: g.scrollHeight > g.clientHeight+2,
            firstRowClippedTop: Math.min(...cards.map(c=>c.getBoundingClientRect().top)) < gb.top-1,
            dense: g.classList.contains('dense'),
            cardH: Math.round(cards[0].getBoundingClientRect().height) };
 })()`);
 console.log('cards:',info.cards,' bars/card:',info.bars,' rows:',info.rows,' cardH:',info.cardH+'px');
 console.log('widest row gaps  left:',info.left,' right:',info.right,
             ' centered:', Math.abs(info.left-info.right)<12);
 console.log('clipped cards:',info.clipped,' grid scrolls:',info.scrollable,
             ' dense:',info.dense,' TOP ROW CUT OFF:',info.firstRowClippedTop);

 const h = await ev(`(() => {
   const q=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().height):null;};
   const g=document.getElementById('tribal-grid');
   return { screen:q('#screen-tribal'), wrapper:q('#screen-tribal > div:not(.gl-host)')   /* skip the 3D backdrop host, which is now the first child */,
            fire:q('#tribal-fire'), peff:q('#tribal-peff'),
            gridClient:g.clientHeight, gridScroll:g.scrollHeight,
            btnRow:q('#screen-tribal .row.center') };
 })()`);
 console.log('heights:', JSON.stringify(h));
 const r=await send('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync(__dirname+'/_tribal'+(process.env.ROSTER==='merged'?'-merged':'')+'.png',Buffer.from(r.result.data,'base64'));
 if(errs.length)console.log('!! page errors:',errs.slice(0,3));
 console.log('saved tools/_tribal.png');
 ws.close();ch.kill();process.exit(0);
})();
