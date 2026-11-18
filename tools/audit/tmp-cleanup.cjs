'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const cred = JSON.parse(fs.readFileSync('tools/tri-e2e/.state/d102a.json', 'utf8'));
  const tok = fs.readFileSync('/home/user/.secrets/supabase_token', 'utf8').trim();
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(4000);
  const r = await p.evaluate(async ([tok, ids]) => {
    const H = { apikey: tok, Authorization: 'Bearer ' + tok };
    const out = {};
    for (const [t, q] of [['admins', 'id=in.(' + ids + ')'], ['user_cosmetics', 'user_id=in.(' + ids + ')'], ['user_push_tokens', 'user_id=in.(' + ids + ')'], ['users', 'id=in.(' + ids + ')']]) {
      try {
        const res = await fetch('https://qewvawdqdnwmxjykgfbw.supabase.co/rest/v1/' + t + '?' + q, { method: 'DELETE', headers: H });
        out[t] = res.status;
      } catch (e) { out[t] = 'E:' + e.message; }
    }
    const chk = await fetch('https://qewvawdqdnwmxjykgfbw.supabase.co/rest/v1/users?id=in.(' + ids + ')&select=id', { headers: H });
    out.leftover = await chk.json();
    return out;
  }, [tok, [cred.player.uid, cred.admin.uid].join(',')]);
  console.log(JSON.stringify(r));
  await b.close();
})();
