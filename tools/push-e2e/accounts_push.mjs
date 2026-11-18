#!/usr/bin/env node
/**
 * tools/push-e2e/accounts_push.mjs — PUSH-E2E ka QA account (1 user).
 * Pattern: tools/match-flow/accounts7.mjs (Firebase identitytoolkit +
 * Supabase Management-API SQL). Sab kuch run-tag se cleanup hota hai.
 *
 * Usage:
 *   node accounts_push.mjs --create  --run <runid> --out /tmp/pe-state.json
 *   node accounts_push.mjs --cleanup --run <runid> [--state /tmp/pe-state.json]
 * Env: SUPABASE_ACCESS_TOKEN, MF_SALT
 */
import { createHmac } from 'node:crypto';
import fs from 'node:fs';

const SALT = process.env.MF_SALT || 'mini-esports-mf7-salt-2026';
const FB_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec';
const ID_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + FB_KEY;
const MGMT = 'https://api.supabase.com/v1/projects/hddhkculuyrfoevxmlwy/database/query';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
}
const RUN = args.run;
if (!RUN) { console.error('❌ --run zaroori hai'); process.exit(1); }
const EMAIL = `qa-push-${RUN}@fft.com`;

function pwFor(email) {
  const h = createHmac('sha256', SALT).update(email).digest('base64url').slice(0, 20);
  return h + 'Aa1!';
}
async function sql(q) {
  const tok = process.env.SUPABASE_ACCESS_TOKEN;
  const r = await fetch(MGMT, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ query: q }) });
  if (!r.ok) throw new Error('sql ' + r.status + ': ' + (await r.text()).slice(0, 300) + ' | q=' + q.slice(0, 120));
  return r.json();
}
async function sqlSafe(q) { try { return await sql(q); } catch (e) { return { skipped: String(e.message || e).slice(0, 120) }; } }
async function fbSignUp(email, pass) {
  const r = await fetch(ID_TOOLKIT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass, returnSecureToken: true }) });
  if (!r.ok) throw new Error('firebase ' + r.status + ': ' + JSON.stringify(await r.json()).slice(0, 250));
  return r.json();
}
async function fbSignIn(email, pass) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass, returnSecureToken: true }) });
  if (!r.ok) throw new Error('signin ' + r.status);
  return r.json();
}
async function fbDelete(idToken) {
  try { const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }); return r.ok; } catch { return false; }
}

if (args.create) {
  const pass = pwFor(EMAIL);
  let fb;
  try { fb = await fbSignUp(EMAIL, pass); }
  catch (e) {
    if (String(e.message || e).includes('EMAIL_EXISTS')) { fb = await fbSignIn(EMAIL, pass); console.log(`(reuse: ${EMAIL} pehle se tha)`); }
    else throw e;
  }
  const state = { run: RUN, uid: fb.localId, email: EMAIL, password: pass };
  if (args.out && args.out !== true) fs.writeFileSync(args.out, JSON.stringify(state, null, 2));
  console.log('✅ seed OK:', JSON.stringify({ run: RUN, uid: fb.localId, email: EMAIL }));
} else if (args.cleanup) {
  let uid = null;
  try {
    if (args.state && args.state !== true && fs.existsSync(args.state)) uid = JSON.parse(fs.readFileSync(args.state, 'utf8')).uid;
  } catch { /* state ke bina bhi pattern-cleanup chalega */ }
  const out = {};
  out.notif = await sqlSafe(`delete from public.notifications where ref_id in ('pushe2e-${RUN}','pushe2eA-${RUN}')`);
  if (uid) {
    out.tokens = await sqlSafe(`delete from public.user_push_tokens where user_id = '${uid}'`);
    out.users = await sqlSafe(`delete from public.users where id = '${uid}'`);
    try { const s = await fbSignIn(EMAIL, pwFor(EMAIL)); out.fb_delete = await fbDelete(s.idToken); } catch { out.fb_delete = 'already-gone'; }
  } else {
    out.tokens = await sqlSafe(`delete from public.user_push_tokens where user_id in (select id from public.users where email = '${EMAIL}')`);
    out.users = await sqlSafe(`delete from public.users where email = '${EMAIL}'`);
    try { const s = await fbSignIn(EMAIL, pwFor(EMAIL)); out.fb_delete = await fbDelete(s.idToken); } catch { out.fb_delete = 'already-gone'; }
  }
  /* Residue check — 0 hona chahiye */
  const residue = await sqlSafe(`select json_build_object('notif', (select count(*) from public.notifications where ref_id like 'pushe2e%${RUN}'), 'users', (select count(*) from public.users where email = '${EMAIL}')) as r`);
  out.residue = residue;
  console.log('🧹 cleanup:', JSON.stringify(out).slice(0, 500));
} else {
  console.error('❌ --create ya --cleanup chahiye'); process.exit(1);
}
