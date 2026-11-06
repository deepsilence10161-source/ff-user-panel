#!/usr/bin/env node
/**
 * tools/push-e2e/android_seed.mjs — emulator leg ka DB seed:
 *   1. logcat se mila ASLI device FCM token user_push_tokens me
 *      (platform='android') — wahi raasta jo production me push-token
 *      edge fn use karta hai, sirf yahan Management-API SQL se
 *      (runner par service-level access pehle se proven hai).
 *   2. ek notification row → trg_notifications_push → pg_net →
 *      push-send → FCM → emulator par asli notification.
 *
 * Usage:
 *   node android_seed.mjs --state /tmp/pe-state.json --token <FCM_TOKEN> --run <runid>
 *   node android_seed.mjs --cleanup-android --state /tmp/pe-state.json --run <runid>
 * Env: SUPABASE_ACCESS_TOKEN
 */
import fs from 'node:fs';

const MGMT = 'https://api.supabase.com/v1/projects/hddhkculuyrfoevxmlwy/database/query';
const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
}
const RUN = args.run;
if (!RUN) { console.error('❌ --run zaroori hai'); process.exit(1); }
let uid = null;
try { uid = JSON.parse(fs.readFileSync(args.state, 'utf8')).uid; } catch { }
if (!uid) { console.error('❌ state file se uid nahi mila'); process.exit(1); }

async function sql(q) {
  const tok = process.env.SUPABASE_ACCESS_TOKEN;
  const r = await fetch(MGMT, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ query: q }) });
  if (!r.ok) throw new Error('sql ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}

if (args['cleanup-android']) {
  await sql(`delete from public.user_push_tokens where user_id = '${uid}' and platform = 'android'`);
  await sql(`delete from public.notifications where ref_id = 'pushe2eA-${RUN}'`);
  console.log('🧹 android-seed cleanup OK');
} else {
  const token = args.token;
  if (!token || token === true || String(token).length < 20) { console.error('❌ --token <FCM token> zaroori hai'); process.exit(1); }
  const t = String(token).replace(/'/g, '');
  await sql(`insert into public.user_push_tokens (user_id, platform, token) values ('${uid}', 'android', '${t}') on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now()`);
  console.log('✅ android token row OK (...' + t.slice(-6) + ')');
  await sql(`insert into public.notifications (user_id, type, title, body, ref_id) values ('${uid}', 'e2e_push', 'PUSHE2EA-${RUN}', 'Android FCM live E2E — emulator leg', 'pushe2eA-${RUN}')`);
  console.log('✅ notification PUSHE2EA-' + RUN + ' insert OK — hook → push-send → FCM chalega');
}
