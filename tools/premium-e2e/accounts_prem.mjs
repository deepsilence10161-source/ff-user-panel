#!/usr/bin/env node
/**
 * tools/premium-e2e/accounts_prem.mjs — PREMIUM-E2E ke REAL test accounts.
 * 2 accounts: ek normal user (poora premium journey: trial → buy request →
 * admin approve → Gold perks → cancel) + ek admin (approve/cancel gateway
 * RPCs). Firebase (identitytoolkit) + Supabase users/admins rows.
 * Sab kuch run-tag se cleanup hota hai (0 residue).
 *
 * Usage:
 *   node accounts_prem.mjs --create  --run <runid> --out /tmp/prem-state.json
 *   node accounts_prem.mjs --cleanup --run <runid> --out /tmp/prem-state.json
 * Env: SUPABASE_ACCESS_TOKEN, MF_SALT
 */
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SALT = process.env.MF_SALT || 'mini-esports-mf7-salt-2026';
const FB_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec';
const ID_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + FB_KEY;
const MGMT = 'https://api.supabase.com/v1/projects/hddhkculuyrfoevxmlwy/database/query';

async function sql(q) {
  const tok = process.env.SUPABASE_ACCESS_TOKEN;
  const r = await fetch(MGMT, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ query: q }) });
  if (!r.ok) throw new Error('sql ' + r.status + ': ' + (await r.text()).slice(0, 400) + ' | q=' + q.slice(0, 120));
  return r.json();
}
async function sqlSafe(q) { try { return await sql(q); } catch (e) { return { skipped: String(e.message || e).slice(0, 120) }; } }
async function fbSignUp(email, pass) {
  const r = await fetch(ID_TOOLKIT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass, returnSecureToken: true }) });
  if (!r.ok) throw new Error('firebase ' + r.status + ': ' + JSON.stringify(await r.json()).slice(0, 300));
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
function pwFor(email) {
  const h = createHmac('sha256', SALT).update(email).digest('base64url').slice(0, 20);
  return h + 'Aa1!';
}

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i];
    const v = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? String(argv[++i]) : true;
    args[k] = v;
  }
}
const RUN = args['--run'] || Date.now().toString(36);
const OUT = args['--out'] || `/tmp/prem-state-${RUN}.json`;

const ROSTER = [
  { tag: 'user',  email: `qa-prem-${RUN}-user@fft.com`,  ign: `PREM-QA-U-${RUN}`,  is_admin: false },
  { tag: 'admin', email: `qa-prem-${RUN}-admin@fft.com`, ign: `PREM-QA-A-${RUN}`,  is_admin: true  },
];

const EMAIL_LIKE = `qa-prem-${RUN}-%`;
const FFUID_LIKE = `PQR${RUN}%`;

if (args['--cleanup'] !== undefined) {
  console.log(`[cleanup] run=${RUN}`);
  const { data: us } = await (async () => ({ data: await sql(`select id from users where email like '${EMAIL_LIKE}' or ff_uid like '${FFUID_LIKE}'`) }))();
  const ids = (us || []).map(u => `'${u.id}'`).join(',');
  if (ids) {
    await sqlSafe(`delete from premium_requests where user_id in (${ids})`);
    await sqlSafe(`delete from premium_monthly_bonus_claims where user_id in (${ids})`);
    await sqlSafe(`delete from notifications where user_id in (${ids})`);
    await sqlSafe(`delete from wallet_transactions where user_id in (${ids})`);
    await sqlSafe(`delete from leaderboard where id in (${ids})`);
    await sqlSafe(`delete from sd_requests where user_id in (${ids})`);
    await sql(`delete from admins where uid in (${ids})`);
    await sql(`delete from users where id in (${ids})`);
  }
  let fbDel = 0;
  for (const r of ROSTER) { try { const s = await fbSignIn(r.email, pwFor(r.email)); if (await fbDelete(s.idToken)) fbDel++; } catch { /* already deleted */ } }
  console.log(`[firebase] ${fbDel}/${ROSTER.length} accounts deleted`);
  const residue = await sql(`select
    (select count(*) from users where email like '${EMAIL_LIKE}' or ff_uid like '${FFUID_LIKE}') u,
    (select count(*) from admins a join users uu on uu.id=a.uid where uu.email like '${EMAIL_LIKE}') adm`);
  const R = residue?.[0] || residue;
  let premRes = { pr: '?', pmbc: '?' };
  try {
    const pr = await sql(`select
      (select count(*) from premium_requests where user_id in (select id from users where email like '${EMAIL_LIKE}')) pr,
      (select count(*) from premium_monthly_bonus_claims where user_id in (select id from users where email like '${EMAIL_LIKE}')) pmbc`);
    premRes = pr?.[0] || pr;
  } catch { /* tables absent — fine */ }
  const zero = R && Number(R.u) === 0 && Number(R.adm) === 0 && String(premRes.pr) !== '?' ? (Number(premRes.pr) === 0 && Number(premRes.pmbc) === 0) : (R && Number(R.u) === 0 && Number(R.adm) === 0);
  console.log(`[residue] ${JSON.stringify(R)} prem=${JSON.stringify(premRes)} → ${zero ? 'CLEAN ✅' : 'RESIDUE ❌'}`);
  console.log(zero ? 'PREM-CLEANUP-OK' : 'PREM-CLEANUP-FAIL');
  process.exit(zero ? 0 : 1);
}

// ── create ──
console.log(`[create] run=${RUN} accounts=${ROSTER.length}`);
const state = { run: RUN, salted: true, accounts: {} };
for (const r of ROSTER) {
  const password = pwFor(r.email);
  let fb;
  try { fb = await fbSignUp(r.email, password); }
  catch (e) {
    if (String(e.message || e).includes('EMAIL_EXISTS')) { fb = await fbSignIn(r.email, password); console.log(`    (reuse: ${r.email} pehle se tha)`); }
    else throw e;
  }
  const uid = fb.localId;
  const ffuid = `PQR${RUN}${r.tag.toUpperCase()}`;
  // coins=100 baseline — monthly bonus (+50) ka delta saaf dikhega.
  // trial_used=false EXPLICIT — start_free_trial() NULL par 'User not found'
  // return karta hai, isliye fresh row me false zaroori (default bhi false hai).
  await sql(`insert into users (id, email, ign, is_admin, is_creator, coins, green_diamonds, sky_diamonds, ff_uid, state, date_of_birth, age_verified, age_verified_at, accepted_policy, accepted_policy_at, profile_status, trial_used)
             values ('${uid}', '${r.email}', $ign$${r.ign}$ign$, ${r.is_admin}, false, 100, 0, 0, '${ffuid}', 'Haryana', '2000-01-01', true, now(), true, now(), 'approved', false)
             on conflict (id) do update set email = excluded.email, ign = excluded.ign, is_admin = excluded.is_admin, coins = 100, green_diamonds = 0, sky_diamonds = 0, ff_uid = excluded.ff_uid, profile_status = 'approved', premium_level = 0, premium_expires = null, trial_used = false;`);
  if (r.is_admin) await sql(`insert into admins (uid, email, display_name, role, added_by, is_active) values ('${uid}', '${r.email}', 'QA PREM ${RUN}', 'admin', 'premium-e2e', true) on conflict (uid) do update set is_active = true, role = 'admin'`);
  state.accounts[r.tag] = { email: r.email, password, uid, ign: r.ign, ff_uid: ffuid, is_admin: r.is_admin };
  console.log(`  ✓ ${r.tag} ${r.email} uid=${uid} ign=${r.ign}`);
}
// sanity: trial_used false + premium 0 (journey bilkul shuru se chalegi)
const chk = await sql(`select premium_level, premium_expires, trial_used from users where id='${state.accounts.user.uid}'`);
const C = (chk || [{}])[0] || chk;
const ok = Number(C.premium_level || 0) === 0 && !C.premium_expires && C.trial_used === false;
console.log(`[seed-check] ${JSON.stringify(C)} → ${ok ? 'PREM-SEED-OK' : 'PREM-SEED-FAIL'}`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(state, null, 1), 'utf8');
console.log(`[done] state → ${OUT}`);
if (!ok) process.exit(1);
console.log('PREM-SEED-OK');
