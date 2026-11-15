#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   tools/audit/d103-stale-cleanup.mjs  (D103, 15-Nov-2026)
   ---------------------------------------------------------------------------
   Firebase Auth + Supabase se PURANE TEST accounts hatane ke liye.
   Owner ka rule: destructive kaam sirf unki "ha" ke baad.
   Isliye ye script DEFAULT = DRY-RUN (sirf list dikhata hai, kuch delete
   nahi karta). Asli delete ke liye DONO chahiye:
       OWNER_APPROVED=yes node tools/audit/d103-stale-cleanup.mjs --confirm

   KABHI NA CHHEDNE WALE (hard-protected, code me hi likha hai):
     • qa-miniesports.dev  → active QA accounts (qa1..qa7 + adm1)
     • gmail.com           → real users
     • (no-email)          → Google/anonymous sign-in = real users
     • admin@fft.com       → ASLI ADMIN (uid BwZglJY2XffByLls8KHaFyi519t2)

   Hatane wale domains (stale test): fft.com (admin ke alawa), miniesports.test,
   d103.miniesports.local, example.com, fftapp.com, fft-test.local

   Order (FK safe): Supabase claims → users → phir Firebase auth account.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const SA_PATH = process.env.FIREBASE_SERVICE_ACCOUNT || '/home/user/.secrets/firebase_service_account.json';
const SA = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const PROJECT = SA.project_id;
const WEB_KEY = process.env.FIREBASE_WEB_KEY || 'AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec';
const SUPA_URL = process.env.SUPA_URL || 'https://hddhkculuyrfoevxmlwy.supabase.co';
const SUPA_KEY = fs.readFileSync(process.env.SUPABASE_SERVICE_ROLE || '/home/user/.secrets/supabase_service_role', 'utf8').trim();

const STALE_DOMAINS = ['fft.com', 'miniesports.test', 'd103.miniesports.local', 'example.com', 'fftapp.com', 'fft-test.local'];
const PROTECTED_DOMAINS = ['qa-miniesports.dev', 'gmail.com'];
const PROTECTED_EMAILS = ['admin@fft.com'];

const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64u(JSON.stringify({ iss: SA.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: SA.token_uri, iat: now, exp: now + 3600 }));
  const s = crypto.createSign('RSA-SHA256'); s.update(`${h}.${c}`);
  const sig = s.sign(SA.private_key, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = await fetch(SA.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${h}.${c}.${sig}` });
  const j = await r.json();
  if (!j.access_token) throw new Error('token mint fail: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

/* v3 downloadAccount: ?key=<webkey> + Bearer token (dono zaroori — 15-Nov probe) */
async function allAccounts(tok) {
  let out = [], pageToken, pages = 0;
  do {
    const body = { maxResults: 1000 }; if (pageToken) body.nextPageToken = pageToken;
    const r = await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/downloadAccount?key=${WEB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) });
    const j = await r.json();
    if (r.status !== 200) throw new Error('downloadAccount ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
    out = out.concat(j.users || []); pageToken = j.nextPageToken; pages++;
  } while (pageToken && pages < 200);
  return out;
}

const domain = (u) => ((u.email || '').split('@')[1] || '').toLowerCase();
const isStale = (u) => {
  const e = (u.email || '').toLowerCase(), d = domain(u);
  if (!e) return false;                                   // no-email = real user (Google/anonymous)
  if (PROTECTED_EMAILS.includes(e)) return false;
  if (PROTECTED_DOMAINS.includes(d)) return false;
  return STALE_DOMAINS.includes(d);
};

const supa = async (method, pathQ) => {
  const r = await fetch(SUPA_URL + '/rest/v1/' + pathQ, { method, headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' } });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
};

const tok = await accessToken();
const all = await allAccounts(tok);
const stale = all.filter(isStale);
const real = all.length - stale.length;

console.log(`PROJECT ${PROJECT} | total accounts = ${all.length}`);
console.log(`  real/protected = ${real}  |  STALE test = ${stale.length}`);
console.log('  protected rules: no-email, gmail.com, qa-miniesports.dev, admin@fft.com');
const byD = {};
for (const u of stale) { const d = domain(u); byD[d] = (byD[d] || 0) + 1; }
Object.entries(byD).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => console.log(`    ${String(n).padStart(3)}  ${d}`));

const APPROVED = process.env.OWNER_APPROVED === 'yes';
const CONFIRM = process.argv.includes('--confirm');
if (!(APPROVED && CONFIRM)) {
  console.log('\nDRY-RUN — kuch delete nahi hua. List:');
  stale.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
    .forEach(u => console.log(`  • ${u.email} | uid=${u.localId} | lastLogin=${u.lastLoginAt ? new Date(Number(u.lastLoginAt)).toISOString().slice(0, 10) : 'never'}`));
  console.log('\nAsli delete ke liye: OWNER_APPROVED=yes node tools/audit/d103-stale-cleanup.mjs --confirm');
  fs.writeFileSync(process.env.OUT_JSON || 'reports/d103-stale-cleanup-plan.json', JSON.stringify({ generated: new Date().toISOString(), total: all.length, stale: stale.length, real, by_domain: byD, list: stale.map(u => ({ email: u.email, uid: u.localId })) }, null, 1));
  console.log('plan → ' + (process.env.OUT_JSON || 'reports/d103-stale-cleanup-plan.json'));
  process.exit(0);
}

console.log('\n⚠ OWNER_APPROVED=yes + --confirm mila ⇒ DELETE shuru (FK order: claims → users → firebase auth)');
const log = [];
for (const u of stale) {
  const uid = u.localId; const rec = { email: u.email, uid };
  try { rec.claims = (await supa('DELETE', `claims?uid=eq.${uid}`)).status; } catch (e) { rec.claims = 'ERR ' + e.message.slice(0, 60); }
  try { rec.users = (await supa('DELETE', `users?uid=eq.${uid}`)).status; } catch (e) { rec.users = 'ERR ' + e.message.slice(0, 60); }
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:delete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ localId: uid }) });
    rec.auth = r.status;
  } catch (e) { rec.auth = 'ERR ' + e.message.slice(0, 60); }
  log.push(rec);
  console.log(`  ${rec.auth === 200 ? '✔' : '✘'} ${u.email} claims=${rec.claims} users=${rec.users} auth=${rec.auth}`);
}
const okc = log.filter(r => r.auth === 200).length;
console.log(`\nDONE: deleted=${okc} / ${log.length}`);
fs.writeFileSync(process.env.OUT_JSON || 'reports/d103-stale-cleanup-result.json', JSON.stringify({ ts: new Date().toISOString(), deleted: okc, total: log.length, log }, null, 1));
console.log('result → ' + (process.env.OUT_JSON || 'reports/d103-stale-cleanup-result.json'));
