/* Screenshot the marooning with the player's options and a thinking bubble open. */
const http=require('http'),{spawn}=require('child_process'),os=require('os'),fs=require('fs');
const WebSocket=require('ws');const PORT=9361;
const get=p=>new Promise((res,rej)=>http.get({host:'127.0.0.1',port:PORT,path:p},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const ch=spawn(process.env.CHROME_BIN,['--headless=new','--disable-gpu','--remote-debugging-port='+PORT,'--no-first-run','--window-size=900,430','--force-device-scale-factor=2.2','--user-data-dir='+os.tmpdir()+'/cw-ms','http://localhost:8099/index.html?no3d=1'],{stdio:'ignore'});
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
  await send('Network.setCacheDisabled', { cacheDisabled: true });await sleep(1400);
 await ev('localStorage.clear()');await send('Page.reload',{});await sleep(1500);
 await ev(`document.getElementById('btn-new-game').click()`);await sleep(700);
 await ev(`document.getElementById('btn-create-go').click()`);
 // wait until the player's own options appear
 for(let i=0;i<120;i++){ if(await ev(`document.querySelectorAll('#maroon-choices button').length > 1`)) break; await sleep(300); }
 await ev(`(() => { const w=document.querySelector('.maroon-opt'); if(w) w.classList.add('show'); return true; })()`);
 await sleep(500);
 const info=await ev(`({ figs: document.querySelectorAll('#maroon-line .mfig').length,
   tribes: document.querySelectorAll('.maroon-tribe').length,
   opts: document.querySelectorAll('#maroon-choices .maroon-opt').length,
   speaking: document.querySelectorAll('#maroon-line .mfig.speaking').length,
   peff: document.getElementById('maroon-peff-text').textContent.slice(0,60) })`);
 console.log(JSON.stringify(info,null,1));
 const r=await send('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync(__dirname+'/_maroon.png',Buffer.from(r.result.data,'base64'));
 console.log('saved tools/_maroon.png');
 ws.close();ch.kill();process.exit(0);
})();
