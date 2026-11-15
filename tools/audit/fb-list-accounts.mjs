#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   tools/audit/fb-list-accounts.mjs — Firebase Auth ka POORA account list
   (read-only). D103: "stale *@fft.com accounts" ki sachchai jaanne ke liye —
   kitne hain, kab bane, aakhri baar kab login hua, koi real user to nahi.

   Usage:
     node tools/audit/fb-list-accounts.mjs                 # domain-wise summary
     node tools/audit/fb-list-accounts.mjs fft.com         # ek domain ka detail
     node tools/audit/fb-list-accounts.mjs --json          # machine-readable

   DELETE jaan-boojh kar is script me NAHI hai: account hatana owner ki
   haan ke bina kabhi nahi (destructive + real user ka data ja sakta hai).
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
  const r = await fetch(sa.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${header}.${claims}.${sig}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token mint fail: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

/* ⚠ ENDPOINT SACH (15-Nov-2026, live probe se confirm):
   identitytoolkit v1/v2 `accounts:download` → 404 (HTML) — exist hi nahi karta.
   Kaam karne wala rasta = legacy v3 `relyingparty/downloadAccount` (web API key
   ke saath; OAuth token optional). Response: {users[], nextPageToken}.        */
const WEB_KEY = process.env.FIREBASE_WEB_KEY || 'AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec';
const tok = await accessToken();
let all = [];
let pageToken;
let pages = 0;
do {
  const body = { maxResults: 1000 };
  if (pageToken) body.nextPageToken = pageToken;
  const r = await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/downloadAccount?key=${WEB_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let j = {};
  try { j = JSON.parse(txt); } catch { console.error('download http', r.status, 'non-JSON body:', txt.slice(0, 200)); process.exit(1); }
  if (r.status !== 200) { console.error('download http', r.status, JSON.stringify(j).slice(0, 300)); process.exit(1); }
  all = all.concat(j.users || []);
  pageToken = j.nextPageToken;
  pages++;
} while (pageToken && pages < 200);

const domain = (u) => ((u.email || '(no-email)').split('@')[1] || '(no-email)').toLowerCase();
const iso = (ms) => (ms ? new Date(Number(ms)).toISOString().slice(0, 19).replace('T', ' ') : '—');

const groups = {};
for (const u of all) { const d = domain(u); groups[d] = (groups[d] || 0) + 1; }

const arg = process.argv[2];
if (arg === '--json') {
  console.log(JSON.stringify({ project: PROJECT, pages, total: all.length, by_domain: groups, users: all.map(u => ({ email: u.email, uid: u.localId, created: iso(u.createdAt), lastLogin: iso(u.lastLoginAt), disabled: !!u.disabled })) }, null, 2));
  process.exit(0);
}

console.log(`PROJECT ${PROJECT} | pages=${pages} | TOTAL ACCOUNTS = ${all.length}`);
console.log('--- domain-wise ---');
Object.entries(groups).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => console.log(`  ${String(n).padStart(4)}  ${d}`));

if (arg) {
  const want = arg.toLowerCase().replace(/^@/, '');
  const hit = all.filter(u => domain(u).includes(want));
  console.log(`\n--- detail: domain me "${want}" → ${hit.length} account ---`);
  for (const u of hit) {
    const providers = (u.providerUserInfo || []).map(p => p.providerId).join(',') || 'password-only';
    console.log(`  • ${u.email || '(no-email)'} | uid=${u.localId} | created=${iso(u.createdAt)} | lastLogin=${iso(u.lastLoginAt)} | disabled=${!!u.disabled} | providers=${providers} | name=${u.displayName || '—'}`);
  }
  const never = hit.filter(u => !u.lastLoginAt).length;
  const stale30 = hit.filter(u => u.lastLoginAt && (Date.now() - Number(u.lastLoginAt)) > 30 * 864e5).length;
  console.log(`  summary: total=${hit.length} neverLoggedIn=${never} lastLogin>30din=${stale30}`);
}
