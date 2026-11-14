/* D103 QA harness — local PostgREST-subset mock of Supabase (sandbox egress supabase.co par blocked hai).
   Browser page me window._SUPA_URL = http://127.0.0.1:8091 inject hota hai (core/db.js override support karta hai).
   Data: 7 QA profiles (tools/tri-e2e/.state/d103.json uids). Writes in-memory only. */
'use strict';
const http = require('http');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
const U = i => ACCT['qa' + i].uid;
const NOW = new Date().toISOString();
const iso = d => new Date(d).toISOString();

function stats(m, w, k, s) { return { matches: m, wins: w, kills: k, streak: s }; }
const users = [
  { i: 1, ign: 'D103 Naya', lvl: 1, exp: 20, coins: 500, sd: 0, gd: 2, rp: 40, prem: 0, city: 'Ambala', state: 'Haryana', st: stats(3, 1, 9, 0), lang: 'hi' },
  { i: 2, ign: 'D103 Premium', lvl: 22, exp: 4200, coins: 12500, sd: 40, gd: 18, rp: 780, prem: 3, city: 'Delhi', state: 'Delhi', st: stats(120, 64, 910, 4), lang: 'hi' },
  { i: 3, ign: 'D103 Creator', lvl: 18, exp: 2600, coins: 8200, sd: 12, gd: 9, rp: 520, prem: 0, creator: true, city: 'Karnal', state: 'Haryana', st: stats(88, 40, 610, 2), lang: 'en' },
  { i: 4, ign: 'D103 WebOnline', lvl: 9, exp: 700, coins: 2400, sd: 3, gd: 4, rp: 210, prem: 0, fcm: 'web', lastSeen: NOW, city: 'Panipat', state: 'Haryana', st: stats(30, 12, 190, 1), lang: 'hi' },
  { i: 5, ign: 'D103 Android', lvl: 14, exp: 1500, coins: 5100, sd: 8, gd: 6, rp: 640, prem: 1, fcm: 'android', fcmAt: NOW, city: 'Kurukshetra', state: 'Haryana', st: stats(55, 25, 400, 3), lang: 'en' },
  { i: 6, ign: 'D103 Pending', lvl: 2, exp: 60, coins: 300, sd: 0, gd: 0, rp: 15, prem: 0, pending: true, city: 'Sonipat', state: 'Haryana', st: stats(5, 1, 12, 0), lang: 'hi' },
  { i: 7, ign: 'D103 ProGold', lvl: 31, exp: 8900, coins: 30200, sd: 90, gd: 44, rp: 1250, prem: 2, city: 'Ambala', state: 'Haryana', st: stats(210, 130, 1840, 9), lang: 'hi', sp: true }
];
const DB = { users: [], user_public_profiles: [], user_cosmetics: [], notifications: [], app_settings: [], matches: [], match_players: [], match_results: [], clans: [], clan_members: [], clan_messages: [], leaderboard: [], battle_pass_progress: [], wallet_transactions: [], referrals: [], join_requests: [], support_tickets: [], premium_requests: [], creator_applications: [], season_pass_progress: [] };

users.forEach(u => {
  const id = U(u.i);
  DB.users.push({
    id, ign: u.ign, ff_uid: '9' + (10000000 + u.i * 137), email: ACCT['qa' + u.i].email, phone: u.i % 2 ? '91035' + (21000 + u.i) : null,
    coins: u.coins, sky_diamonds: u.sd, green_diamonds: u.gd, level: u.lvl, exp: u.exp, is_banned: false, blocked: false,
    profile_verified: !u.pending, profile_status: u.pending ? 'pending' : 'approved', status: 'active', approved: !u.pending,
    pending_ign: u.pending ? u.ign : null, access_mode: 'FULL', total_kills: u.st.kills, total_winnings: u.st.wins * 40, win_streak: u.st.streak,
    premium_level: u.prem, premium_expires: u.prem ? iso(Date.now() + 25 * 864e5) : null, is_creator: !!u.creator, creator_code: u.creator ? 'D103C' : null,
    is_admin: false, referral_count: u.i === 3 ? 4 : 0, real_money: u.st.wins * 10, stats: u.st, rank_points: u.rp,
    city: u.city, state: u.state, lang: u.lang, fcm_token: u.fcm || null, fcm_updated_at: u.fcmAt || null, last_seen: u.lastSeen || iso(Date.now() - 3600e3),
    created_at: iso(Date.now() - u.i * 5 * 864e5), updated_at: NOW, device_fp: null, is_deleted: false, wallet: u.coins,
    season_pass: !!u.sp, battle_pass_tier: u.sp ? 12 : 0,
    total_matches: u.st.matches, total_wins: u.st.wins, rank_tier: u.rp >= 1001 ? 'diamond' : u.rp >= 601 ? 'gold' : u.rp >= 301 ? 'silver' : 'bronze',
    streak_days: u.st.streak, streak_milestones_claimed: {}, last_checkin_date: '', is_vip: u.prem >= 2,
    email_verified: true, age_verified: true, accepted_policy: true, bio: u.creator ? 'Content creator | D103' : '',
    banner_url: '', avatar_url: '', referral_code: ('D103Q' + u.i), sponsored_winnings: 0, duo_team: null, squad_team: null, location_set_at: NOW,
    level: u.lvl, exp: u.exp
  });
  DB.user_public_profiles.push({ id: id, user_id: id, ign: u.ign, city: u.city, state: u.state, rank_points: u.rp, level: u.lvl, exp: u.exp,
    premium_level: u.prem, premium_expires: u.prem ? iso(Date.now() + 25 * 864e5) : null, is_vip: u.prem >= 2,
    total_matches: u.st.matches, total_wins: u.st.wins, total_kills: u.st.kills, rank_tier: u.rp >= 1001 ? 'diamond' : u.rp >= 601 ? 'gold' : u.rp >= 301 ? 'silver' : 'bronze',
    streak_days: u.st.streak, streak_milestones_claimed: {}, last_checkin_date: '', bio: u.creator ? 'Content creator | D103' : '',
    email_verified: true, age_verified: true, accepted_policy: true, profile_status: u.pending ? 'pending' : 'approved', ff_uid: '9' + (10000000 + u.i * 137),
    coins: u.coins, sky_diamonds: u.sd, green_diamonds: u.gd, is_creator: !!u.creator, creator_code: u.creator ? 'D103C' : null,
    titles: u.i === 2 ? ['tag_beast'] : u.i === 7 ? ['tag_pro', 'tag_beast'] : [], updated_at: NOW });
  DB.leaderboard.push({ id: id, user_id: id, ign: u.ign, rank_points: u.rp, total_kills: u.st.kills, wins: u.st.wins, city: u.city, premium_level: u.prem, level: u.lvl });
  if (u.i === 2) ['tag_beast', 'frame_gold', 'rank_gold'].forEach((it, x) => DB.user_cosmetics.push({ id: 'cos-q2-' + x, user_id: id, cosmetic_key: it, is_equipped: x === 0, purchased_at: NOW }));
  if (u.i === 7) ['tag_pro', 'frame_diamond', 'rank_diamond', 'badge_kingslayer'].forEach((it, x) => DB.user_cosmetics.push({ id: 'cos-q7-' + x, user_id: id, cosmetic_key: it, is_equipped: x === 1, purchased_at: NOW }));
  if (u.i === 5) ['rank_gold'].forEach((it, x) => DB.user_cosmetics.push({ id: 'cos-q5-' + x, user_id: id, cosmetic_key: it, is_equipped: true, purchased_at: NOW }));
  DB.notifications.push({ id: 'ntf-q' + u.i + '-1', user_id: id, type: 'match', title: u.lang === 'hi' ? 'Match result ready' : 'Match result ready', body: 'Custom room #4412 result uploaded', read: false, created_at: iso(Date.now() - 3600e3) });
  DB.notifications.push({ id: 'ntf-q' + u.i + '-2', user_id: id, type: 'system', title: 'Welcome', body: 'mini eSports me swagat hai', read: true, created_at: iso(Date.now() - 86400e3) });
  DB.wallet_transactions.push({ id: 'wt-q' + u.i, user_id: id, type: 'win', amount: 40, note: 'Match win #4412', created_at: iso(Date.now() - 7200e3) });
});
DB.clans.push({ id: 'clan-d103', name: 'D103 Squad', tag: 'D13', owner_id: U(3), level: 4, points: 5200, city: 'Karnal', created_at: iso(Date.now() - 40 * 864e5) });
[3, 1, 5].forEach((n, x) => DB.clan_members.push({ clan_id: 'clan-d103', user_id: U(n), role: x === 0 ? 'owner' : 'member', joined_at: iso(Date.now() - 30 * 864e5) }));
DB.clan_messages.push({ id: 'cm1', clan_id: 'clan-d103', user_id: U(3), ign: 'D103 Creator', text: 'Aaj raat 9 baje clan war', created_at: iso(Date.now() - 1800e3) });
DB.matches.push({ id: 'mt-live', title: 'Ambala Custom Room', status: 'live', entry_fee: 0, entry_type: 'free', map: 'Bermuda', slots: 48, joined: 31, start_at: NOW, room_id: '4412', room_pass: 'd103' });
DB.matches.push({ id: 'mt-up', title: 'Haryana Cup Qualifier', status: 'upcoming', entry_fee: 10, entry_type: 'coins', map: 'Purgatory', slots: 48, joined: 12, start_at: iso(Date.now() + 7200e3) });
DB.matches.push({ id: 'mt-done', title: 'Weekend Scratch', status: 'completed', entry_fee: 0, entry_type: 'ads', map: 'Kalahari', slots: 48, joined: 44, start_at: iso(Date.now() - 86400e3) });
[1, 2, 4, 5, 7].forEach(n => DB.match_players.push({ match_id: 'mt-live', user_id: U(n), ign: users[n - 1].ign, joined_at: NOW }));
DB.match_results.push({ match_id: 'mt-done', winner_id: U(7), results: JSON.stringify([{ uid: U(7), kills: 9, place: 1 }, { uid: U(2), kills: 6, place: 2 }]) });
DB.app_settings.push({ key: 'app_maintenance', value: 'false' }, { key: 'min_withdraw', value: '50' }, { key: 'season', value: 'S7' });
DB.battle_pass_progress.push({ user_id: U(7), tier: 12, xp: 3400, premium: true });
DB.referrals.push({ referrer_id: U(3), referred_id: U(1), created_at: NOW });

/* ---------- tiny PostgREST subset ---------- */
function val(v) { if (v === 'null') return null; if (v === 'true') return true; if (v === 'false') return false; if (/^-?\d+(\.\d+)?$/.test(v)) return +v; return v; }
function get(row, k) { return row[k]; }
function matchOp(cell, opv) {
  const [op, ...rest] = opv.split('.'); let v = val(rest.join('.'));
  switch (op) {
    case 'eq': return cell == v;
    case 'neq': return cell != v;
    case 'gt': return cell > v; case 'gte': return cell >= v;
    case 'lt': return cell < v; case 'lte': return cell <= v;
    case 'in': { const list = decodeURIComponent(String(v)).replace(/^\(/, '').replace(/\)$/, '').split(','); return list.includes(String(cell)); }
    case 'is': return v === 'null' ? cell == null : cell === v;
    case 'like': case 'ilike': { const rx = new RegExp('^' + String(v).replace(/%/g, '.*') + '$', op === 'ilike' ? 'i' : ''); return rx.test(String(cell ?? '')); }
    default: return true;
  }
}
function filters(url) {
  const out = [];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
    if (k === 'or') { out.push({ or: v }); continue; }
    if (k.startsWith('not.')) { const inner = v; out.push({ k, neg: true, v: inner }); continue; }
    out.push({ k, v });
  }
  return out;
}
function applyRows(rows, f) {
  return rows.filter(r => f.every(fc => {
    if (fc.or) {
      const parts = String(fc.or).replace(/^\(/, '').replace(/\)$/, '').split(/,(?=[a-z_]+\.(eq|in|is|neq))/);
      return parts.some(p => { const [k, ...ov] = p.split('='); const [op, ...rest] = ov.join('=').split('.'); return matchOp(get(r, k), op + '.' + rest.join('.')); });
    }
    if (fc.neg) return !matchOp(get(r, fc.k), fc.v);
    return matchOp(get(r, fc.k), fc.v);
  }));
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const m = /^\/rest\/v1\/([a-z_]+)/.exec(u.pathname);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (!m) { res.writeHead(404); res.end('{"message":"mock: no route"}'); return; }
  const table = DB[m[1]] || (DB[m[1]] = []);
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const f = filters(u);
    const rep = /representation/.test(req.headers.prefer || '');
    const lim = +u.searchParams.get('limit') || 0;
    const ord = u.searchParams.get('order');
    const sort = rows => { if (!ord) return rows; const [k, dir] = ord.split('.'); rows = rows.slice().sort((a, b) => (get(a, k) > get(b, k) ? 1 : -1)); return dir === 'desc' ? rows.reverse() : rows; };
    let out, code = 200;
    if (req.method === 'GET') { out = sort(applyRows(table, f)); if (lim) out = out.slice(0, lim); }
    else if (req.method === 'POST') {
      const j = JSON.parse(body || '[]'); const arr = Array.isArray(j) ? j : [j];
      const upsert = /merge-duplicates/.test(req.headers.prefer || '');
      out = arr.map(row => {
        if (upsert) { const key = row.id ? 'id' : row.user_id ? 'user_id' : null; if (key) { const ex = table.find(t => t[key] === row[key]); if (ex) { Object.assign(ex, row); return ex; } } }
        table.push(row); return row;
      });
      code = 201;
    }
    else if (req.method === 'PATCH') { const j = JSON.parse(body || '{}'); out = applyRows(table, f).map(r => Object.assign(r, j)); }
    else if (req.method === 'DELETE') { const hit = applyRows(table, f); hit.forEach(h => { const ix = table.indexOf(h); if (ix > -1) table.splice(ix, 1); }); out = hit; }
    if (!rep && req.method !== 'GET') { res.writeHead(204); res.end(); return; }
    const wantOne = /vnd\.pgrst\.object/.test(req.headers.accept || '');
    if (wantOne) {
      if (req.method === 'GET' && (!Array.isArray(out) || out.length === 0)) { res.writeHead(406, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' })); return; }
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(Array.isArray(out) ? out[0] : out));
      return;
    }
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
  });
});
server.listen(8091, '127.0.0.1', () => console.log('mock-supa on 8091; users=' + DB.users.length));
