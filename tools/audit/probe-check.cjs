const { chromium } = require('playwright'); const fs=require('fs');
const cred=JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d97a.json','utf8'));
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
const bad=[];p.on('console',m=>{if(m.type()==='error')bad.push(m.text().slice(0,80));});p.on('response',r=>{if(r.status()>=400)bad.push('HTTP '+r.status()+' '+r.url().slice(0,80));});
await p.goto('http://127.0.0.1:8090',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.auth&&window.firebase,null,{timeout:20000});
await p.evaluate(([e,w])=>window.auth.signInWithEmailAndPassword(e,w),[cred.player.email,cred.player.password]);
await p.waitForFunction(()=>window.UD&&window.UD.ign,null,{timeout:25000});
await p.waitForTimeout(24000); // 20s probe cycle cover
console.log('probe-window bad events:', bad.length, bad.slice(0,4));
await b.close();})();
