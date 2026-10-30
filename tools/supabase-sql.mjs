#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   tools/supabase-sql.mjs — repo-me-committed SQL file ko Supabase
   Management API se apply karta hai (service-level SQL).
   SAFETY: sirf repo ke andar ka file path accept hota hai (argument
   traversal nahi), aur workflow sirf workflow_dispatch se chalta hai
   — har apply kia gaya SQL git history me auditable rehta hai.
   Usage: node tools/supabase-sql.mjs supabase/migrations/<file>.sql
   ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SB_REF = process.env.SB_REF || 'hddhkculuyrfoevxmlwy';
const arg = process.argv[2] || '';

if (!TOKEN) { console.error('❌ SUPABASE_ACCESS_TOKEN set nahi hai'); process.exit(1); }
if (!arg || arg.includes('..') || !arg.startsWith('supabase/migrations/') || !arg.endsWith('.sql')) {
  console.error('❌ sirf supabase/migrations/*.sql file path allowed hai (repo-committed SQL)');
  process.exit(1);
}
const file = path.join(process.cwd(), arg);
if (!fs.existsSync(file)) { console.error('❌ file nahi mila: ' + arg); process.exit(1); }
const query = fs.readFileSync(file, 'utf8');

console.log('• apply kar rahe hain: ' + arg + ' (' + query.length + ' bytes)');
const r = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const text = await r.text();
if (!r.ok) { console.error('❌ SQL ' + r.status + ': ' + text.slice(0, 400)); process.exit(1); }
console.log('• SQL apply result: ' + text.slice(0, 8000));

/* post-check: app_settings par SELECT policies dikhao (proof) */
const r2 = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT policyname, cmd, roles, qual FROM pg_policies WHERE schemaname='public' AND tablename='app_settings'" }),
});
console.log('• app_settings policies ab: ' + (await r2.text()).slice(0, 600));

/* post-check 2: apk_cleanup row maujood hai ya nahi */
const r3 = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT key, updated_by, (value::jsonb->>'enabled') AS enabled FROM app_settings WHERE key='apk_cleanup'" }),
});
console.log('• apk_cleanup row: ' + (await r3.text()).slice(0, 300));
