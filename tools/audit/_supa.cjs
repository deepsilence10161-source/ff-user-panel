/* Supabase REST via browser-context fetch (sandbox bash egress supabase par flaky hai).
   Usage: node _supa.cjs GET "/users?select=id&limit=2" [jsonBody] [--sr]   */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const H = 'https://hddhkculuyrfoevmlwy.supabase.co/rest/v1';
(async () => {
  const [method, path, ...rest] = process.argv.slice(2);
  const sr = rest.includes('--sr');
  const bodyArg = rest.find(a => !a.startsWith('--'));
  const tok = fs.readFileSync('/home/user/.secrets/' + (sr ? 'supabase_service_role' : 'supabase_token'), 'utf8').trim();
  const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGhrY3VsdXlyZm9ldnhtbHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTQ1MTgsImV4cCI6MjA5NDAzMDUxOH0.2hhDGez1fVFjS5ljSU3tSOEJuusLmQpERjcrh45T7po';
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1500);
  const out = await p.evaluate(async ([m, u, body, tok, anon]) => {
    const h = { apikey: anon, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
    if (m !== 'GET') h.Prefer = 'return=representation';
    const r = await fetch(u, { method: m, headers: h, body: body || undefined });
    const t = await r.text();
    return { status: r.status, body: t.slice(0, 20000) };
  }, [method, H + path, bodyArg, tok, anon]);
  console.log(out.status);
  console.log(out.body);
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
