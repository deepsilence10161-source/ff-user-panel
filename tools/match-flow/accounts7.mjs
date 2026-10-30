#!/usr/bin/env node
/**
 * tools/match-flow/accounts7.mjs — MATCH-FLOW-E2E ke REAL test accounts.
 * Owner ke Free Fire screenshots wale EXACT 7 usernames (Unicode/mixed-case
 * byte-for-byte) + creator + admin + bench partners. Firebase (identitytoolkit)
 * + Supabase users/admins rows. Sab kuch run-tag se cleanup hota hai.
 *
 * Usage:
 *   node accounts7.mjs --create --run <runid> --out .state/mf-<run>.json
 *   node accounts7.mjs --cleanup --run <runid>
 * Env: SUPABASE_ACCESS_TOKEN, MF_SALT
 */
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SALT = process.env.MF_SALT || 'mini-esports-mf7-salt-2026';
const FB_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec';
const ID_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + FB_KEY;
const SB_URL = 'https://hddhkculuyrfoevxmlwy.supabase.co';
const MGMT = 'https://api.supabase.com/v1/projects/hddhkculuyrfoevxmlwy/database/query';

// ── owner ke screenshots se EXACT usernames (byte-for-byte, same order) ──
const IGNS = [
  'KESHAV\u00B7SAINi',   // KESHAV·SAINi (middle dot U+00B7)
  'Wail160g0_9',
  'Linox\uBAA8444..',    // Linox모444.. (Hangul U+BAA8 + trailing dots)
  '\u0AAE\u0AC7\u0AB9\u0AC1\u0AB2\u0AB5\u0AB8\u0ABE\u0AB5\u0ABE1', // મેહુલવસાવા1 (Gujarati)
  'hjVikram',
  'AKGINMG',
  'N0dc21b349c3',
];

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
    const v = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
    args[k] = v;
  }
}
const RUN = args['--run'] || Date.now().toString(36);
const OUT = args['--out'] || `/tmp/mf-state-${RUN}.json`;

const ROSTER = [];
for (let i = 0; i < 7; i++) ROSTER.push({ tag: `p${i + 1}`, email: `qa-mf7-${RUN}-p${i + 1}@fft.com`, ign: IGNS[i], is_creator: false, is_admin: false });
ROSTER.push({ tag: 'creator', email: `qa-mf7-${RUN}-creator@fft.com`, ign: `MF-Creator-${RUN}`, is_creator: true, is_admin: false });
ROSTER.push({ tag: 'admin', email: `qa-mf7-${RUN}-admin@fft.com`, ign: `MF-Admin-${RUN}`, is_creator: false, is_admin: true });
for (let b = 1; b <= 5; b++) ROSTER.push({ tag: `b${b}`, email: `qa-mf7-${RUN}-b${b}@fft.com`, ign: `MF-Bench${b}-${RUN}`, is_creator: false, is_admin: false });

if (args['--cleanup'] !== undefined || process.argv.includes('--cleanup')) {
  console.log(`[cleanup] run=${RUN}`);
  const { data: us } = await (async () => ({ data: await sql(`select id from users where email like 'qa-mf7-${RUN}-%' or ff_uid like 'MF7R${RUN}%'`) }))();
  const ids = (us || []).map(u => `'${u.id}'`).join(',');
  const mcols = (await sql(`select column_name from information_schema.columns where table_name='matches'`)).map(c => c.column_name);
  const crCol = ['creator_uid', 'created_by', 'host_uid', 'creator_id', 'owner_uid'].find(c => mcols.includes(c)) || mcols.find(c => /creator|host|owner/.test(c)) || null;
  console.log('[cleanup] matches creator-col = ' + crCol);
  if (ids) {
    await sql(`delete from join_requests where user_id in (${ids})${crCol ? ` or match_id in (select id from matches where ${crCol} in (${ids}))` : ''}`);
    await sqlSafe(`delete from team_invitations where inviter_uid in (${ids})`);
    await sqlSafe(`delete from match_chat where match_id in (select id from matches where creator_uid in (${ids}))`);
    await sqlSafe(`delete from match_messages where match_id in (select id from matches where creator_uid in (${ids}))`);
    await sqlSafe(`delete from match_reminders where user_id in (${ids})`);
    await sqlSafe(`delete from match_interests where user_id in (${ids})`);
    await sqlSafe(`delete from creator_match_ratings where match_id in (select id from matches where creator_uid in (${ids})) or user_id in (${ids})`);
    if (crCol) await sql(`delete from matches where ${crCol} in (${ids})`);
    await sql(`delete from wallet_transactions where user_id in (${ids})`);
    await sqlSafe(`delete from premium_monthly_bonus_claims where user_id in (${ids})`);
    await sql(`delete from admins where uid in (${ids})`);
    await sql(`delete from users where id in (${ids})`);
  }
  // firebase accounts delete — ROSTER deterministic hai (state file optional)
  let fbDel = 0;
  for (const r of ROSTER) { try { const s = await fbSignIn(r.email, pwFor(r.email)); if (await fbDelete(s.idToken)) fbDel++; } catch { /* already deleted */ } }
  console.log(`[firebase] ${fbDel}/${ROSTER.length} accounts deleted`);
  const residue = await sql(`select
    (select count(*) from users where email like 'qa-mf7-${RUN}-%' or ff_uid like 'MF7R${RUN}%') u,
    (select count(*) from admins a join users uu on uu.id=a.uid where (uu.email like 'qa-mf7-${RUN}-%' or uu.ff_uid like 'MF7R${RUN}%')) adm,
    (select count(*) from matches m join users uu on uu.id=m.${crCol || 'creator_uid'} where (uu.email like 'qa-mf7-${RUN}-%' or uu.ff_uid like 'MF7R${RUN}%')) m,
    (select count(*) from join_requests j join users uu on uu.id=j.user_id where (uu.email like 'qa-mf7-${RUN}-%' or uu.ff_uid like 'MF7R${RUN}%')) jr,
    (select count(*) from wallet_transactions w join users uu on uu.id=w.user_id where (uu.email like 'qa-mf7-${RUN}-%' or uu.ff_uid like 'MF7R${RUN}%')) w`);
  const R = residue?.[0] || residue;
  const zero = R && Number(R.u) === 0 && Number(R.adm) === 0 && Number(R.m) === 0 && Number(R.jr) === 0 && Number(R.w) === 0;
  console.log(`[residue] ${JSON.stringify(R)} → ${zero ? 'CLEAN ✅' : 'RESIDUE ❌'}`);
  console.log(zero ? 'MF-CLEANUP-OK' : 'MF-CLEANUP-FAIL');
  process.exit(zero ? 0 : 1);
}

// ── create ──
console.log(`[create] run=${RUN} accounts=${ROSTER.length}`);
const state = { run: RUN, salted: true, accounts: {}, igns: IGNS };
let n = 0;
for (const r of ROSTER) {
  n++;
  const password = pwFor(r.email);
  let fb;
  try { fb = await fbSignUp(r.email, password); }
  catch (e) {
    if (String(e.message || e).includes('EMAIL_EXISTS')) { fb = await fbSignIn(r.email, password); console.log(`    (reuse: ${r.email} pehle se tha)`); }
    else throw e;
  }
  const uid = fb.localId;
  const ffuid = `MF7R${RUN}${r.tag.toUpperCase()}`;
  await sql(`alter table users add column if not exists is_creator boolean default false`);
  await sql(`alter table users add column if not exists green_diamonds numeric default 0`);
  await sql(`insert into users (id, email, ign, is_admin, is_creator, coins, green_diamonds, sky_diamonds, ff_uid, state, date_of_birth, age_verified, age_verified_at, accepted_policy, accepted_policy_at, profile_status)
             values ('${uid}', '${r.email}', $ign$${r.ign}$ign$, ${r.is_admin}, ${r.is_creator}, 5000, 500, 500, '${ffuid}', 'Haryana', '2000-01-01', true, now(), true, now(), 'approved')
             on conflict (id) do update set email = excluded.email, ign = excluded.ign, is_creator = excluded.is_creator, is_admin = excluded.is_admin, coins = 5000, green_diamonds = 500, sky_diamonds = 500, ff_uid = excluded.ff_uid, profile_status = 'approved';`);
  if (r.is_admin) await sql(`insert into admins (uid, email, display_name, role, added_by, is_active) values ('${uid}', '${r.email}', 'QA MF7 ${RUN}', 'admin', 'match-flow-e2e', true) on conflict (uid) do update set is_active = true, role = 'admin'`);
  state.accounts[r.tag] = { email: r.email, password, uid, ign: r.ign, ff_uid: ffuid, is_creator: r.is_creator, is_admin: r.is_admin };
  console.log(`  ✓ ${r.tag} ${r.email} uid=${uid} ign=${r.ign}`);
}
// creator ko ACTIVE PREMIUM — server RPC creator_create_match ka gate
// (run 40982737163 me 'premium_required' se saare creates fail hue the).
// ASLI source of truth = users.premium_expires (features/free-trial.js).
const crUid = state.accounts.creator.uid;
const premCols = await sql(`select table_name || '.' || column_name as c from information_schema.columns where column_name ilike '%premium%' and table_schema='public' order by 1`);
console.log('[premium-cols] ' + JSON.stringify((premCols || []).map(x => x.c)));
await sqlSafe(`update users set premium_expires = now() + interval '30 days' where id = '${crUid}'`);
await sqlSafe(`update users set premium_level = 1 where id = '${crUid}'`);
await sqlSafe(`update users set is_premium = true where id = '${crUid}'`);
await sqlSafe(`update users set premium_active = true where id = '${crUid}'`);
const crRow = await sql(`select * from users where id = '${crUid}'`);
const crPrem = Object.fromEntries(Object.entries((crRow || [{}])[0] || {}).filter(([k]) => /premium|creator/i.test(k)));
console.log('[creator-premium-state] ' + JSON.stringify(crPrem));

// ign sanity: DB me EXACT wahi 7 ign dikhe (byte-for-byte)
const dbIgns = await sql(`select ign from users where email like 'qa-mf7-${RUN}-p%' order by created_at`);
const got = (dbIgns || []).map(x => x.ign);
const ignOk = JSON.stringify(got) === JSON.stringify(IGNS);
console.log(`[ign-check] db=${JSON.stringify(got)}`);
console.log(ignOk ? 'MF-SEED-IGN-OK' : 'MF-SEED-IGN-FAIL');
if (!ignOk) process.exit(1);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(state, null, 1), 'utf8');
console.log(`[done] state → ${OUT}`);
console.log('MF-SEED-OK');
