const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 300, height: 120 } });
  await p.setContent('<body style="background:#111;color:#fff;font-family:Rubik,Segoe UI,system-ui,sans-serif"><div style="font-size:20px">नमस्ते हिंदी परीक्षण</div><div style="font-size:20px;font-family:inherit">🥇  emoji</div></body>');
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/fonttest.png' });
  const ff = await p.evaluate(() => { const d = document.querySelector('div'); return getComputedStyle(d).fontFamily; });
  console.log(ff);
  await b.close();
})();
