'use strict';
const { chromium } = require('playwright');
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGhrY3VsdXlyZm9ldnhtbHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTQ1MTgsImV4cCI6MjA5NDAzMDUxOH0.2hhDGez1fVFjS5ljSU3tSOEJuusLmQpERjcrh45T7po';
(async () => {
  const b = await chromium.launch();
  for (const sw of ['allow', 'block']) {
    const ctx = await b.newContext({ serviceWorkers: sw === 'block' ? 'block' : 'allow' });
    const p = await ctx.newPage();
    await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(3500);
    const r = await p.evaluate(async (anon) => {
      const out = {};
      try { const x = await fetch('https://hddhkculuyrfoevmlwy.supabase.co/rest/v1/app_settings?select=key&limit=1&apikey=' + anon); out.get_param = x.status + ' ' + (await x.text()).slice(0, 40); } catch (e) { out.get_param = 'ERR ' + e.message; }
      try { const x = await fetch('https://hddhkculuyrfoevmlwy.supabase.co/rest/v1/app_settings?select=key&limit=1', { headers: { apikey: anon } }); out.get_hdr = x.status + ' ' + (await x.text()).slice(0, 40); } catch (e) { out.get_hdr = 'ERR ' + e.message; }
      try { const x = await new Promise((res, rej) => { const xr = new XMLHttpRequest(); xr.open('GET', 'https://hddhkculuyrfoevmlwy.supabase.co/rest/v1/app_settings?select=key&limit=1'); xr.setRequestHeader('apikey', anon); xr.onload = () => res(xr.status + ' ' + xr.responseText.slice(0, 40)); xr.onerror = () => rej(new Error('xhr err')); xr.send(); }); out.xhr = x; } catch (e) { out.xhr = 'ERR ' + e.message; }
      return out;
    }, ANON);
    console.log('SW=' + sw, JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
})();
