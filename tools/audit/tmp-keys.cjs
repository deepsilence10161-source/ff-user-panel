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
  await p.waitForTimeout(7000);
  const r = await p.evaluate((uid) => {
    var u = (window.usersCache || {})[uid];
    if (!u) return { found: false, cacheSize: Object.keys(window.usersCache || {}).length };
    var ks = Object.keys(u);
    return { found: true, keys: ks.slice(0, 60), fcm: u.fcm_token || u.fcmToken || null, ls: u.last_seen || u.lastSeen || null };
  }, cred.player.uid);
  console.log(JSON.stringify(r).slice(0, 900));
  await b.close();
})();
