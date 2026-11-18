const { chromium } = require('playwright'); const fs=require('fs');
const cred=JSON.parse(fs.readFileSync(process.env.CRED||'tools/tri-e2e/.state/d98a.json','utf8'));
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto('http://127.0.0.1:8090',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.auth&&window.firebase,null,{timeout:20000});
await p.evaluate(([e,w])=>window.auth.signInWithEmailAndPassword(e,w),[cred.player.email,cred.player.password]);
await p.waitForFunction(()=>window.UD&&window.UD.ign,null,{timeout:25000});
await p.waitForTimeout(4000);
console.log(JSON.stringify(await p.evaluate(()=>({
 bodyClass: document.body.className,
 chip: !!document.getElementById('vnChip'),
 pad: getComputedStyle(document.querySelector('.ticker-wrap')).paddingRight,
 ticker: (document.getElementById('tickerTxt')||{}).textContent,
 hasFn: typeof window.compliantTicker
})),null,1));
await b.close();})();
