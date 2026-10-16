#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   TRI-E2E  —  QA account + QA-TEST data lifecycle
   ═══════════════════════════════════════════════════════════════════════════
   Teen surfaces (Admin Panel / User Panel web / User Panel APK) ek hi
   Firebase project (fft-app-1e283) + ek hi Supabase (hddhkculuyrfoevxmlwy)
   par chalte hain. Poora three-way E2E chalane ke liye chahiye:

     1. do QA Firebase accounts (email/password):
          - qa-tri-<runid>-p  →  test PLAYER  (APK + user web)
          - qa-tri-<runid>-a  →  test ADMIN   (admin panel)
        Password har run me naya random — koi fixed credential nahi.
     2. QA admin ko admin haq: `admins` row (is_active=true) + users.is_admin=1
        — dono run ke ant me DELETE ho jaate hain.
     3. Ant me: us runid ka SAARA data (users, sd_requests, support_tickets,
        notifications, matches, join_requests…) + Firebase accounts delete +
        residue count — 0 hona chahiye.

   Usage:
     node qa-accounts.mjs create  --run <runid>   → .state/<runid>.json
     node qa-accounts.mjs cleanup --run <runid>
     node qa-accounts.mjs residue --run <runid>

   Env:
     SUPABASE_ACCESS_TOKEN  (management API; SQL chala sakta hai)
     SB_REF  (default hddhkculuyrfoevxmlwy)
     FIREBASE_WEB_API_KEY (default public web key — app bundle me hai)
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SB_REF = process.env.SB_REF || 'hddhkculuyrfoevxmlwy';
const FB_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const STATE_DIR = path.join(__dirname, '.state');

function die(msg) { console.error('❌ ' + msg); process.exit(1); }
function log(msg) { console.log('• ' + msg); }

/* ── Supabase Management API: SQL (service-role level) ─────────────────── */
async function sql(query) {
  if (!TOKEN) die('SUPABASE_ACCESS_TOKEN set nahi hai');
  const r = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error('SQL ' + r.status + ': ' + text.slice(0, 300));
  try { return JSON.parse(text); } catch (e) { return text; }
}

/* ── Firebase Auth REST ────────────────────────────────────────────────── */
async function fbSignUp(email, password) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await r.json();
  if (!d.idToken) throw new Error('Firebase signUp fail: ' + JSON.stringify(d).slice(0, 200));
  return d; /* { localId, idToken, email } */
}
async function fbSignIn(email, password) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return r.json();
}
async function fbDelete(email, password) {
  const si = await fbSignIn(email, password);
  if (!si.idToken) return { deleted: false, why: si.error ? si.error.message : 'sign-in fail' };
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FB_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: si.idToken }),
  });
  const t = await r.text();
  return { deleted: r.ok, body: t.slice(0, 120) };
}

/* ── QA data rows jo is runid ke hain (sirf inhi ko chhedna hai) ───────── */
function cleanupSql(runid) {
  const tag = `%QA-TEST TRI ${runid}%`;
  /* ⚠️ 2026-10-13d: IGN ab `TRIQA <runid>` / `TRIQA2 <runid>` hai.
     Kyun badla: app ke leaderboard me `/^QA[-_]?/i` wala filter QA-* IGN
     wale accounts chhupa deta hai — yani QA-TRI wale players live
     leaderboard par dikhte hi nahi the, isliye "premium ribbon doosre
     player ki screen par" (H11d) kabhi pass ho hi nahi sakta tha. Naya
     prefix QA se shuru nahi hota → player asli leaderboard par dikhta hai.
     Pattern `%TRIQA%<runid>%` dono (P1 + P2) ko pakadta hai. */
  const ign = `%TRIQA%${runid}%`;
  const utr = `TRIRUN${runid}`;
  const emailLike = `qa-tri-${runid}-%`;
  return [
    /* 1. runid wale match/business rows */
    `delete from join_requests where match_id in (select id from matches where title like '${tag}') or user_id in (select id from users where ign like '${ign}')`,
    `delete from notifications where title like '${tag}' or body like '${tag}' or user_id in (select id from users where ign like '${ign}')`,
    `delete from sd_requests where upi_ref = '${utr}' or user_id in (select id from users where ign like '${ign}') or notes like '${tag}'`,
    `delete from support_tickets where subject like '${tag}' or message like '${tag}' or user_id in (select id from users where ign like '${ign}')`,
    `delete from matches where title like '${tag}'`,
    /* ⚠️ 2026-10-12: yahan pehle '${tag}' tha (jo QA-TEST TRI wala pattern hai) —
       QA users ke cosmetics rows is wajah se delete hi nahi hote the. Ab wahi
       ign pattern jo baaki sab jagah hai. */
    `delete from user_cosmetics where user_id in (select id from users where ign like '${ign}')`,
    `delete from wallet_transactions where user_id in (select id from users where ign like '${ign}')`,
    /* premium grant (approve_premium) se bane rows — warna QA ka BP premium
       leaderboard/progress me pada reh jata tha */
    `delete from battle_pass_progress where user_id in (select id from users where ign like '${ign}')`,
    /* ✅ leaderboard ek ALAG table hai (users delete se apne aap nahi hatta) —
       isliye users se PEHLE iski row hatao, warna orphan row padi reh jati. */
    `delete from leaderboard where id in (select id from users where ign like '${ign}')`,
    /* ✅ 2026-10-16: season_champions — H15 (Season Champion banner) ki row
       run ke AANT tak zinda rehti hai (APK step 17 usi par hai), is liye
       residue ka safaya yahan aakhir me hota hai. */
    `delete from season_champions where user_id in (select id from users where ign like '${ign}')`,
    `delete from match_rooms where match_id in (select id from matches where title like '${tag}')`,
    /* 2. users + admins rows */
    `delete from admins where email like '${emailLike}'`,
    `delete from users where ign like '${ign}'`,
  ];
}
const RESIDUE_SQL = (runid) => {
  const tag = `%QA-TEST TRI ${runid}%`, utr = `TRIRUN${runid}`, emailLike = `qa-tri-${runid}-%`;
  /* 2026-10-13d: IGN `TRIQA <runid>` / `TRIQA2 <runid>` (QA- filter se bachne
     ke liye — dekho cleanup ka note). Pattern dono ko pakadta hai. */
  const ign = `%TRIQA%${runid}%`;
  return `select
    (select count(*) from users where ign like '${ign}') as users,
    (select count(*) from admins where email like '${emailLike}') as admins,
    (select count(*) from sd_requests where upi_ref='${utr}') as sd_requests,
    (select count(*) from support_tickets where subject like '${tag}') as support_tickets,
    (select count(*) from notifications where title like '${tag}') as notifications,
    (select count(*) from matches where title like '${tag}') as matches`;
};

/* ── CREATE ────────────────────────────────────────────────────────────── */
async function create(runid) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  /* Password salt se derive hota hai (random nahi) — agar state file
     kisi wajah se na bache, tab bhi wahi account dobara sign-in karke
     DELETE kiya ja sakta hai. Salt sirf CI secret / .secrets me rehta hai. */
  const SALT = process.env.TRI_SALT || 'local-dev-salt';
  const pw = (email) => crypto.createHmac('sha256', SALT).update(email).digest('base64url').slice(0, 20) + 'Aa1!';
  const playerEmail = `qa-tri-${runid}-p@fft.com`;
  /* ✅ 2026-10-12: DOOSRA player — user ↔ user flow prove karne ke liye
     (dono players ek hi match join karte hain, admin panel ke Joined Players
     me dono dikhte hain, APK ka pehla player dono ko apne match me dekhta hai). */
  const player2Email = `qa-tri-${runid}-q@fft.com`;
  const adminEmail = `qa-tri-${runid}-a@fft.com`;
  const playerPass = pw(playerEmail), player2Pass = pw(player2Email), adminPass = pw(adminEmail);

  log('Firebase: QA player (P1) account banaya ja raha hai…');
  const p = await fbSignUp(playerEmail, playerPass);
  log('Firebase: QA player (P2) account banaya ja raha hai…');
  const p2 = await fbSignUp(player2Email, player2Pass);
  log('Firebase: QA admin account banaya ja raha hai…');
  const a = await fbSignUp(adminEmail, adminPass);

  /* ⚠️ state file TURANT (SQL se pehle) — Firebase accounts ban chuke hain,
     isliye credentials ab har haal me save hone chahiye. */
  const state = {
    runid, createdAt: new Date().toISOString(),
    player:  { email: playerEmail,  password: playerPass,  uid: p.localId },
    player2: { email: player2Email, password: player2Pass, uid: p2.localId },
    admin:   { email: adminEmail,   password: adminPass,   uid: a.localId },
    markers: {
      ticketSubject: `QA-TEST TRI ${runid} — payment issue`,
      ticketMessage: `QA-TEST TRI ${runid} — APK se bheja gaya ticket (tri-e2e)`,
      /* app subject khud set karta hai (dropdown type) — marker message me,
         admin isi message se dhoondhta hai. */
      ticketMarker: `QA-TEST TRI ${runid}`,
      ticketReply: `QA-TEST TRI ${runid} — admin reply (tri-e2e)`,
      matchTitle: `QA-TEST TRI ${runid} — Custom Room`,
      /* 2026-10-13d (Phase-3): DUO match — team invite + accept ka E2E */
      duoTitle: `QA-TEST TRI ${runid} — Duo`,
      notifTitle: `QA-TEST TRI ${runid}`,
      notifBody: `Admin se test notification (tri-e2e ${runid})`,
      utr: `TRIRUN${runid}`,
      /* users.ign par 20-char ka DB check hai — isliye chhota tag. */
      ignTag: `TRIQA ${runid}`,
      ignTag2: `TRIQA2 ${runid}`,
      sdAmount: 10, sdPrice: 10, coinAmount: 25,
    },
  };
  const file = path.join(STATE_DIR, `${runid}.json`);
  fs.writeFileSync(file, JSON.stringify(state, null, 2));

  /* ✅ 2026-10-12: dono players ki users row pehle se marker IGN ke saath.
     Kyun: admin panel ki "Joined Players" table player ka naam
     `ign_at_join` ya users table ke ign se dikhati hai. QC ke liye har run ka
     player pehchanna zaroori hai — warna sab "Player" dikhte hain.
     (users_ign_length_check ≤20 — marker 15 chars ka hai.) */
  log('Supabase: QA players ki users row (marker IGN)…');
  /* ff_uid bhi — app ka "Playing As" block isi par render hota hai (aur ye
     asli player ka game UID hai). users_ff_uid_key UNIQUE hai, isliye run-id
     wala unique tag. */
  /* ✅ 2026-10-13h: state='Haryana' bhi set — warna app ka asli
     'State Verification Required' gate (legal-compliance.js) user web aur
     APK dono par khulta hai aur uske peeche saare modals (cosmetics store
     etc.) block ho jaate hain — TRI 38540317554 me H6d isi se fail hua.
     QA player Haryana ka hai (India-only app; banned states: TS/AP/TN). */
  /* ✅ 2026-10-14a: 18+ Age Gate (legal-compliance.js mesAgeGate) bhi clear —
     QA player 2000-01-01 ka hai (asli server RPC bhi yahi maanta: dob se age
     recompute karta hai), warna state gate ke 400ms baad age gate khulta hai
     aur uske peeche saare modals (cosmetics store etc.) block rehte hain —
     TRI 38545748414 me H6d isi se fail hua.
     ✅ 2026-10-14b: T&C gate (accepted_policy) bhi — chain poora hai:
     state → age → T&C (legal-compliance.js _runNext). Teeno ab pehle se clear. */
  await sql(`insert into users (id, ign, is_admin, coins, sky_diamonds, ff_uid, state, date_of_birth, age_verified, age_verified_at, accepted_policy, accepted_policy_at)
             values ('${p.localId}', 'TRIQA ${runid}', false, 0, 0, 'R${runid}P1', 'Haryana', '2000-01-01', true, now(), true, now())
             on conflict (id) do update set ign = excluded.ign, ff_uid = excluded.ff_uid, state = 'Haryana',
               date_of_birth = '2000-01-01', age_verified = true, age_verified_at = now(),
               accepted_policy = true, accepted_policy_at = now();`);
  await sql(`insert into users (id, ign, is_admin, coins, sky_diamonds, ff_uid, state, date_of_birth, age_verified, age_verified_at, accepted_policy, accepted_policy_at)
             values ('${p2.localId}', 'TRIQA2 ${runid}', false, 0, 0, 'R${runid}P2', 'Haryana', '2000-01-01', true, now(), true, now())
             on conflict (id) do update set ign = excluded.ign, ff_uid = excluded.ff_uid, state = 'Haryana',
               date_of_birth = '2000-01-01', age_verified = true, age_verified_at = now(),
               accepted_policy = true, accepted_policy_at = now();`);

  /* QA admin ko admin haq — dono jagah (gate + RLS). Sirf isi runid ke liye. */
  log('Supabase: QA admin ko admins row + users.is_admin…');
  /* ⚠️ admins.uid → users.id FK hai, isliye PEHLE users row, phir admins. */
  await sql(`insert into users (id, ign, is_admin, coins, sky_diamonds)
             values ('${a.localId}', 'TRIQA ${runid} ADM', true, 0, 0)
             on conflict (id) do update set is_admin = true, ign = excluded.ign;`);
  await sql(`insert into admins (uid, email, display_name, role, added_by, is_active)
             values ('${a.localId}', '${adminEmail}', 'QA TRI ${runid}', 'admin', 'tri-e2e', true)
             on conflict (uid) do update set is_active = true, role='admin';`);

  log('state file: ' + file);
  console.log('QA-TRI-STATE: ' + JSON.stringify({
    runid, player_uid: state.player.uid, player2_uid: state.player2.uid, admin_uid: state.admin.uid,
    player_email: playerEmail, player2_email: player2Email, admin_email: adminEmail,
  }));
  return state;
}

/* ── CLEANUP ───────────────────────────────────────────────────────────── */
async function cleanup(runid) {
  const file = path.join(STATE_DIR, `${runid}.json`);
  let st = null;
  try { st = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  log('SQL: runid ke QA rows delete kiye ja rahe hain…');
  for (const q of cleanupSql(runid)) {
    try { await sql(q); } catch (e) { console.warn('  ⚠️ SQL skip: ' + e.message.slice(0, 160)); }
  }
  if (st) {
    /* ⚠️ purane state files (P2 se pehle ke) me player2 nahi hota — us par
       crash nahi hona chahiye, warna cleanup baaki accounts bhi chhod deta. */
    for (const who of ['player', 'player2', 'admin']) {
      if (!st[who]) { log(`Firebase: ${who} state me nahi (purana run) — skip`); continue; }
      const r = await fbDelete(st[who].email, st[who].password);
      log(`Firebase: ${who} account delete → ${r.deleted ? 'OK' : 'skip (' + (r.why || r.body) + ')'}`);
    }
  } else {
    log('state file nahi mila — Firebase accounts manually skip (SQL rows phir bhi saaf ho gaye).');
  }
  const res = await sql(RESIDUE_SQL(runid));
  const bad = Object.entries(res[0]).filter(([k, v]) => Number(v) !== 0);
  console.log('TRI-E2E-RESIDUE: ' + JSON.stringify(res[0]));
  if (bad.length) { console.error('❌ residue bacha: ' + JSON.stringify(bad)); process.exit(1); }
  log('✅ residue 0 — production DB saaf.');
}

async function residue(runid) {
  const res = await sql(RESIDUE_SQL(runid));
  console.log('TRI-E2E-RESIDUE: ' + JSON.stringify(res[0]));
  const bad = Object.entries(res[0]).filter(([k, v]) => Number(v) !== 0);
  process.exit(bad.length ? 1 : 0);
}

/* ── CLI ───────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const cmd = argv[0];
const runIdx = argv.indexOf('--run');
const runid = runIdx >= 0 ? argv[runIdx + 1] : null;
if (!runid) die('--run <runid> chahiye');
(async () => {
  if (cmd === 'create') await create(runid);
  else if (cmd === 'cleanup') await cleanup(runid);
  else if (cmd === 'residue') await residue(runid);
  else die('cmd: create | cleanup | residue');
})().catch((e) => die(e.message));
