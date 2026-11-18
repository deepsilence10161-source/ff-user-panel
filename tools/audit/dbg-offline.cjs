const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(4000);
  const swReady = await p.evaluate(async () => { try { await navigator.serviceWorker.ready; return true; } catch (e) { return false; } });
  await ctx.setOffline(true);
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('nav-err', String(e).slice(0,80)));
  await p.waitForTimeout(3500);
  const shell = await p.evaluate(() => ({ hasNav: !!document.querySelector('nav, .bottom-nav, [class*=nav]'), txt: (document.body.innerText || '').slice(0, 60) }));
  console.log(JSON.stringify({ swReady, offlineShell: shell }));
  await b.close();
})();
