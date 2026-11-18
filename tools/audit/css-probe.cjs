const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto('http://127.0.0.1:8090',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const out={sheets:[],ruleFound:false,wraps:document.querySelectorAll('.ticker-wrap').length};
  for(const ss of document.styleSheets){ let n=0; try{ for(const r of ss.cssRules){ n++; if(r.selectorText && r.selectorText.indexOf('vn-chip-on')>=0) out.ruleFound=r.cssText.slice(0,80); } }catch(e){ n=-1; } out.sheets.push((ss.href||'inline').split('/').pop()+':'+n); }
  document.body.classList.add('vn-chip-on');
  out.padAfterManualClass = getComputedStyle(document.querySelector('.ticker-wrap')).paddingRight;
  return out;
}),null,1));
await b.close();})();
