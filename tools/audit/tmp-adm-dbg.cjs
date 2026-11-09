'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const cred = JSON.parse(fs.readFileSync('tools/tri-e2e/.state/d102a.json', 'utf8'));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([em, pw]) => window.auth.signInWithEmailAndPassword(em, pw), [cred.admin.email, cred.admin.password]);
  await p.waitForTimeout(6000);
  const r = await p.evaluate(async () => {
    var out = {};
    try { var q = await window._supa.from('user_push_tokens').select('user_id,platform').limit(3); out.tokens = JSON.stringify(q.error || q.data).slice(0, 200); } catch (e) { out.tokensErr = String(e).slice(0, 100); }
    try { var q2 = await window._supa.from('users').select('id').limit(1); out.users = JSON.stringify(q2.error || q2.data).slice(0, 120); } catch (e) { out.usersErr = String(e).slice(0, 100); }
    out.presenceTry = await new Promise(res => { try { rtdb.ref('presence').once('value', s => res({ n: s.numChildren() }), e => res({ err: String(e).slice(0, 80) })); } catch (e) { res({ throw: String(e).slice(0, 80) }); } });
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
