#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   tools/audit/d99-gift-verify.mjs — D99 SQL fixes ka LIVE proof (QA accounts)
   ───────────────────────────────────────────────────────────────────────────
   Third-party audit ke money-bugs (gift entry currency, joinability, D87 GD
   team-fee, ad-origin spoof, ad-session stacking) LIVE Supabase par QA users
   se verify karta hai, phir poora QA residue delete karta hai.

   Usage: node tools/audit/d99-gift-verify.mjs
   Env  : SUPABASE_SERVICE_ROLE (ya /home/user/.secrets/supabase_service_role)
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
import fs from 'node:fs';

const SB = 'https://hddhkculuyrfoevxmlwy.supabase.co';
const FB_KEY = 'AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGhrY3VsdXlyZm9ldnhtbHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTQ1MTgsImV4cCI6MjA5NDAzMDUxOH0.2hhDGez1fVFjS5ljSU3tSOEJuusLmQpERjcrh45T7po';
const SR = (process.env.SUPABASE_SERVICE_ROLE || fs.readFileSync('/home/user/.secrets/supabase_service_role', 'utf8')).trim();
const RUN = 'd99v';
const PW = 'Qa!' + Math.random().toString(36).slice(2) + 'x9';

let PASS = 0, FAIL = 0;
const ok = (c, l, extra) => { if (c) { PASS++; console.log('  ✓ ' + l); } else { FAIL++; console.log('  ✗ ' + l + (extra ? '  → ' + JSON.stringify(extra).slice(0, 300) : '')); } };

/* Supabase Management API se SELECT (postgres role) — kuch tables (jaise
   ad_watch_sessions) par service_role ka SELECT grant nahi hai, isliye
   session-count jaisi checks yahan se padhi jaati hain. */
const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ||
  (fs.existsSync('/home/user/.secrets/supabase_token') ? fs.readFileSync('/home/user/.secrets/supabase_token', 'utf8').trim() : '');
const mgmtSql = async (q) => {
  const r = await fetch('https://api.supabase.com/v1/projects/hddhkculuyrfoevxmlwy/database/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + MGMT_TOKEN },
    body: JSON.stringify({ query: q }),
  });
  const t = await r.text();
  try { return { status: r.status, json: JSON.parse(t) }; } catch { return { status: r.status, text: t.slice(0, 200) }; }
};

const sr = (path, opts = {}) => fetch(SB + '/rest/v1/' + path, {
  ...opts,
  headers: { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
});
const asUser = (path, token, body, origin) => fetch(SB + '/rest/v1/' + path, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
  body: JSON.stringify(body),
});
const fbSignUp = async (email) => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error('signUp fail ' + JSON.stringify(j).slice(0, 200));
  return { uid: j.localId, token: j.idToken, email };
};
/* accounts:delete ka SAHI pattern (qa-accounts.mjs jaisa): fresh sign-in ka
   idToken BODY me — Authorization header + localId se 401 aata hai. */
const fbDelete = async (u) => {
  const si = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: PW, returnSecureToken: true }),
  }).then(r => r.json());
  const tok = si.idToken || u.token;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FB_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: tok }),
  });
  return r.status;
};

const QA = [];
const created = { matches: [], users: [] };

async function mkUser(tag, coins, sky, gd) {
  const u = await fbSignUp(`qa-${RUN}-${tag}@triqa.local`);
  QA.push(u);
  const row = {
    id: u.uid, ign: 'QA' + tag.toUpperCase() + RUN, ff_uid: '9' + Math.floor(1e8 + Math.random() * 8e8),
    coins, sky_diamonds: sky, green_diamonds: gd, sponsored_winnings: 0, is_admin: false, premium_level: 0,
  };
  const r = await sr('users', { method: 'POST', body: JSON.stringify([row]) });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error('users insert fail: ' + JSON.stringify(j).slice(0, 300));
  created.users.push(u.uid);
  return u;
}
async function mkMatch(entryType, fee, opts = {}) {
  const body = {
    title: 'QA D99 ' + entryType + ' test', mode: 'solo',   /* matches.name GENERATED column hai — insert nahi karna */
    entry_type: entryType, entry_fee: fee, max_slots: opts.max_slots ?? 2, filled_slots: opts.filled_slots ?? 0,
    status: opts.status ?? 'upcoming', prize_type: 'green_diamond', creator_uid: opts.creator_uid ?? null,
    scheduled_at: new Date(Date.now() + 3600e3).toISOString(),
  };
  const r = await sr('matches', { method: 'POST', body: JSON.stringify([body]) });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error('match insert fail: ' + JSON.stringify(j).slice(0, 300));
  created.matches.push(j[0].id);
  return j[0];
}
const bal = async (uid) => {
  const r = await sr(`users?select=coins,sky_diamonds,green_diamonds&id=eq.${uid}`);
  return (await r.json())[0];
};

try {
  console.log('== D99 LIVE VERIFY (QA run ' + RUN + ') ==');
  const giver = await mkUser('g', 500, 77, 5);
  const recv = await mkUser('r', 10, 3, 1);
  const recv2 = await mkUser('r2', 10, 3, 9);

  /* ── (1) gift entry COINS match: coins se katna chahiye, sky se NAHI ── */
  const m1 = await mkMatch('coins', 10, { creator_uid: giver.uid });
  let r = await asUser('rpc/gift_match_entry', giver.token, { p_match_id: m1.id, p_to_uid: recv.uid }, 'https://deepsilence10161-source.github.io');
  let j = await r.json();
  ok(j && j.ok === true && j.currency === 'coins', '1a: coins-match gift → currency=coins (pehle SKY kat-ta tha)', j);
  let bg = await bal(giver.uid);
  ok(bg.coins === 490 && bg.sky_diamonds === 77 && bg.green_diamonds === 5, '1b: giver wallet — coins 500→490, sky/GD untouched', bg);
  const gt = await (await sr(`gift_tickets?select=status,fee,entry_type&match_id=eq.${m1.id}`)).json();
  ok(gt.length === 1 && gt[0].status === 'delivered' && Number(gt[0].fee) === 10, '1c: gift_ticket status=delivered (flow complete)', gt);
  const jr = await (await sr(`join_requests?select=user_id,status,entry_fee_paid&match_id=eq.${m1.id}`)).json();
  ok(jr.length === 1 && jr[0].user_id === recv.uid && jr[0].status === 'pending', '1d: receiver ki entry TURANT register (paisa kata + entry bani)', jr);
  const wt = await (await sr(`wallet_transactions?select=currency,txn_type,amount,reason&user_id=eq.${giver.uid}&reason=eq.gift_entry`)).json();
  ok(wt.length === 1 && wt[0].currency === 'coins' && wt[0].txn_type === 'debit' && Number(wt[0].amount) === 10, '1e: ledger debit coins (canonical)', wt);

  /* ── (2) joinability pre-flight: duplicate / not-upcoming / full ── */
  r = await asUser('rpc/gift_match_entry', giver.token, { p_match_id: m1.id, p_to_uid: recv.uid }, 'https://deepsilence10161-source.github.io');
  j = await r.json();
  ok(j && j.ok === false && /pehle se registered/i.test(j.error || ''), '2a: same dost dobara gift → reject (paisa nahi kata)', j);
  bg = await bal(giver.uid);
  ok(bg.coins === 490, '2b: reject par balance unchanged (490)', bg);

  const m2 = await mkMatch('coins', 10, { creator_uid: giver.uid, status: 'live' });
  r = await asUser('rpc/gift_match_entry', giver.token, { p_match_id: m2.id, p_to_uid: recv2.uid }, 'https://deepsilence10161-source.github.io');
  j = await r.json();
  ok(j && j.ok === false && /joinable nahi/i.test(j.error || ''), '2c: live match ka gift → reject (pehle paisa kat jata tha)', j);

  const m3 = await mkMatch('coins', 10, { creator_uid: giver.uid, max_slots: 1, filled_slots: 1 });
  r = await asUser('rpc/gift_match_entry', giver.token, { p_match_id: m3.id, p_to_uid: recv2.uid }, 'https://deepsilence10161-source.github.io');
  j = await r.json();
  ok(j && j.ok === false && /full/i.test(j.error || ''), '2d: full match ka gift → reject', j);
  bg = await bal(giver.uid);
  ok(bg.coins === 490 && bg.sky_diamonds === 77, '2e: teeno reject ke baad bhi wallet untouched', bg);

  /* ── (3) GD-entry match: gift reject (D87) + TEAM join par GD fee ZERO ── */
  const m4 = await mkMatch('green_diamond', 40, { creator_uid: giver.uid });
  r = await asUser('rpc/gift_match_entry', giver.token, { p_match_id: m4.id, p_to_uid: recv2.uid }, 'https://deepsilence10161-source.github.io');
  j = await r.json();
  ok(j && j.ok === false, '3a: GD-entry match par gift reject (D87: GD se fee kabhi nahi)', j);
  r = await asUser('rpc/join_match_team', recv2.token, { p_match_id: m4.id, p_mode: 'solo', p_fee_type: 'solo', p_team: null }, 'https://deepsilence10161-source.github.io');
  j = await r.json();
  const b2 = await bal(recv2.uid);
  ok(b2.green_diamonds === 9 && b2.sky_diamonds === 3, '3b: GD match solo team-join → GD/sky wallet untouched (D87 team-path fix)', { rpc: j, bal: b2 });

  /* ── (4) ad reward: EXACT origin allowlist (spoof reject) ── */
  r = await asUser('rpc/claim_ad_reward', giver.token, {}, 'https://evil.example/deepsilence10161-source.github.io');
  j = await r.json();
  ok(j && /origin not allowed/i.test(j.error || ''), '4a: spoofed Origin (substring) → REJECT', j);
  r = await asUser('rpc/claim_ad_reward', giver.token, {}, 'https://deepsilence10161-source.github.io');
  j = await r.json();
  ok(j && !/origin not allowed/i.test(j.error || ''), '4b: official Origin → origin gate pass (aage session check chalta hai)', j);

  /* ── (5) ad session stacking band ── */
  await asUser('rpc/ad_watch_start', giver.token, {}, 'https://deepsilence10161-source.github.io');
  await asUser('rpc/ad_watch_start', giver.token, {}, 'https://deepsilence10161-source.github.io');
  await asUser('rpc/ad_watch_start', giver.token, {}, 'https://deepsilence10161-source.github.io');
  const sq = await mgmtSql(`select count(*)::int as open_sessions from public.ad_watch_sessions where uid='${giver.uid}' and not consumed`);
  const openCount = (sq.status === 200 || sq.status === 201) && Array.isArray(sq.json) ? sq.json[0].open_sessions : -1;
  ok(openCount === 1, '5a: 3× ad_watch_start ke baad bhi EK hi open session (stacking band)', openCount >= 0 ? { open_sessions: openCount } : sq);

  /* ── (6) watch-earn par origin guard ── */
  r = await asUser('rpc/claim_watch_earn_reward', giver.token, { p_match_id: m2.id }, 'https://evil.example/x');
  j = await r.json();
  ok(j && /origin not allowed/i.test(j.error || ''), '6a: watch-earn claim spoofed Origin → REJECT', j);
} catch (e) {
  FAIL++; console.log('  ✗ EXCEPTION: ' + (e && e.message));
}

/* ── CLEANUP: QA ka ek bhi row/account nahi bachna chahiye ── */
console.log('== cleanup ==');
try {
  const uids = created.users;
  for (const t of ['wallet_transactions', 'notifications', 'gift_tickets', 'join_requests', 'ad_watch_sessions', 'watch_earn_sessions', 'ad_reward_log', 'watch_earn_log']) {
    try { await sr(`${t}?user_id=in.(${uids.join(',')})`, { method: 'DELETE' }); } catch {}
    try { await sr(`${t}?uid=in.(${uids.join(',')})`, { method: 'DELETE' }); } catch {}
    try { await sr(`${t}?from_uid=in.(${uids.join(',')})`, { method: 'DELETE' }); } catch {}
    try { await sr(`${t}?to_uid=in.(${uids.join(',')})`, { method: 'DELETE' }); } catch {}
  }
  if (created.matches.length) await sr(`matches?id=in.(${created.matches.map(m => `"${m}"`).join(',')})`, { method: 'DELETE' });
  if (uids.length) await sr(`users?id=in.(${uids.map(u => `"${u}"`).join(',')})`, { method: 'DELETE' });
  const codes = [];
  for (const u of QA) codes.push(await fbDelete(u));
  console.log('  firebase accounts:delete →', codes.join(','));
  const resid = {};
  resid.users = (await (await sr(`users?id=in.(${created.users.map(u => `"${u}"`).join(',')})`)).json()).length;
  resid.matches = (await (await sr(`matches?id=in.(${created.matches.map(m => `"${m}"`).join(',')})`)).json()).length;
  resid.gift = (await (await sr(`gift_tickets?from_uid=in.(${created.users.map(u => `"${u}"`).join(',')})`)).json()).length;
  resid.jr = (await (await sr(`join_requests?user_id=in.(${created.users.map(u => `"${u}"`).join(',')})`)).json()).length;
  resid.tx = (await (await sr(`wallet_transactions?user_id=in.(${created.users.map(u => `"${u}"`).join(',')})`)).json()).length;
  ok(Object.values(resid).every(v => v === 0), '7a: QA residue ZERO (real-user data safe)', resid);
} catch (e) { console.log('  cleanup error: ' + e.message); }

console.log('PASS: ' + PASS + ' | FAIL: ' + FAIL);
process.exit(FAIL ? 1 : 0);
