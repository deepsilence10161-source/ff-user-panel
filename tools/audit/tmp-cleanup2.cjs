'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const SR = fs.readFileSync('/home/user/.secrets/supabase_service_role', 'utf8').trim();
const H = 'https://hddhkculuyrfoevmlwy.supabase.co/rest/v1';
const QA = ['FAxbKuYvIxYdvk4ggkSzH2jIiRg1', 'TvxaA0hO0XSSgItspebJny8OiWF2'];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1500);
  const out = await p.evaluate(async ([H, SR, QA]) => {
    const del = async (path) => { const r = await fetch(H + path, { method: 'DELETE', headers: { apikey: SR, Authorization: 'Bearer ' + SR, Prefer: 'return=representation' } }); return path.split('?')[0] + ':' + r.status; };
    const res = [];
    res.push(await del('/admins?id=eq.' + QA[1]));
    res.push(await del('/user_cosmetics?user_id=in.(' + QA.join(',') + ')'));
    res.push(await del('/user_push_tokens?user_id=in.(' + QA.join(',') + ')'));
    res.push(await del('/users?id=in.(' + QA.join(',') + ')'));
    const g = await fetch(H + '/users?id=in.(' + QA.join(',') + ')&select=id', { headers: { apikey: SR, Authorization: 'Bearer ' + SR } });
    const left = await g.json();
    const gr = await fetch(H + '/users?id=eq.TyHtzFOnggMxWbEdTnTdEl2j7oF3&select=id,fcm_token,last_seen', { headers: { apikey: SR, Authorization: 'Bearer ' + SR } });
    const real = await gr.json();
    return { res, left, real: real && real[0] ? { id: real[0].id.slice(0, 6), fcm: (real[0].fcm_token || '').slice(0, 8), ls: real[0].last_seen } : null };
  }, [H, SR, QA]);
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
