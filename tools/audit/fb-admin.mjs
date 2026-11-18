#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   tools/audit/fb-admin.mjs — Firebase Identity Toolkit ADMIN ops (service account)
   QA accounts ko tab bhi delete karne ke liye jab unka password/token na bacha
   ho (user-panel idToken wala accounts:delete 401 de deta hai agar token purana
   ho ya body galat ho). Secret sirf local file se padha jata hai — repo me nahi.

   Usage:
     node tools/audit/fb-admin.mjs lookup qa-d99v-g@triqa.local qa-d99v-r@triqa.local
     node tools/audit/fb-admin.mjs delete qa-d99v-g@triqa.local ...
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const SA_PATH = process.env.FIREBASE_SERVICE_ACCOUNT || '/home/user/.secrets/firebase_service_account.json';
const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const PROJECT = sa.project_id;

const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64u(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: sa.token_uri, iat: now, exp: now + 3600,
  }));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${claims}`);
  const sig = sign.sign(sa.private_key, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${header}.${claims}.${sig}`;
  const r = await fetch(sa.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token mint fail: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

const call = async (tok, method, body) => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.text() };
};

const [action, ...emails] = process.argv.slice(2);
if (!action || !emails.length) { console.error('usage: fb-admin.mjs <lookup|delete> <email...>'); process.exit(2); }
const tok = await accessToken();
const lk = await call(tok, 'lookup', { email: emails });
let users = [];
try { users = (JSON.parse(lk.body).users) || []; } catch { /* none */ }
console.log(`lookup http ${lk.status} → ${users.length} account mile`);
if (lk.status !== 200) console.log('  body: ' + lk.body.slice(0, 300));
for (const u of users) console.log('  •', u.email, u.localId, 'created', new Date(Number(u.createdAt || 0)).toISOString());
if (action === 'delete') {
  for (const u of users) {
    const d = await call(tok, 'delete', { localId: u.localId });
    console.log('  delete', u.email, '→ http', d.status, d.body.slice(0, 80));
  }
  if (!users.length) console.log('  (koi account nahi mila — pehle se clean)');
}
