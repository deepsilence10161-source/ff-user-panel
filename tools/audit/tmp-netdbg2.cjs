'use strict';
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  let mockHits = 0;
  await ctx.route(u => String(u).includes('supabase.co'), async route => {
    mockHits++;
    const req = route.request();
    const url = req.url().replace('https://hddhkculuyrfoevmlwy.supabase.co', 'http://127.0.0.1:8091');
    const h0 = req.headers(); const h = {};
    ['apikey', 'authorization', 'content-type', 'prefer', 'accept'].forEach(k => { if (h0[k]) h[k] = h0[k]; });
    try {
      const r = await fetch(url, { method: req.method(), headers: h, body: req.postData() || undefined });
      await route.fulfill({ status: r.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: await r.text() });
    } catch (e) { await route.fulfill({ status: 599, body: '{"mockfail":1}', headers: { 'Access-Control-Allow-Origin': '*' } }); }
  });
  const p = await ctx.newPage();
  p.on('console', m => console.log('PAGE:', m.text().slice(0, 90)));
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(4000);
  const r1 = await p.evaluate(async () => {
    try {
      const r = await fetch('https://hddhkculuyrfoevmlwy.supabase.co/rest/v1/app_settings?select=key&limit=1', { headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGhrY3VsdXlyZm9ldnhtbHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTQ1MTgsImV4cCI6MjA5NDAzMDUxOH0.2hhDGez1fVFjS5ljSU3tSOEJuusLmQpERjcrh45T7po' } });
      return 'GET ' + r.status + ' ' + (await r.text()).slice(0, 60);
    } catch (e) { return 'GET ERR ' + e.message; }
  });
  console.log('DIRECT:', r1, '| mockHits:', mockHits);
  await b.close();
})();
