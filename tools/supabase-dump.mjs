#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   tools/supabase-dump.mjs — repo-committed READ-ONLY SQL file ko Supabase
   Management API se chalata hai aur POORA result (bina 400-char cap ke)
   job log me print karta hai. Diagnostic dumps ke liye (function defs,
   policies, constraints). supabase-sql.mjs (apply wala) untouched rehta hai.
   Usage: node tools/supabase-dump.mjs supabase/diag/<file>.sql
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SB_REF = process.env.SB_REF || 'hddhkculuyrfoevxmlwy';
const arg = process.argv[2] || '';

if (!TOKEN) { console.error('❌ SUPABASE_ACCESS_TOKEN set nahi hai'); process.exit(1); }
if (!arg || arg.includes('..') || !arg.startsWith('supabase/') || !arg.endsWith('.sql')) {
  console.error('❌ sirf repo ke supabase/**.sql paths allowed hain');
  process.exit(1);
}
const file = path.join(process.cwd(), arg);
if (!fs.existsSync(file)) { console.error('❌ file nahi mila: ' + arg); process.exit(1); }
const query = fs.readFileSync(file, 'utf8');

console.log('• dump kar rahe hain: ' + arg + ' (' + query.length + ' bytes)');
const r = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const text = await r.text();
if (!r.ok) { console.error('❌ SQL ' + r.status + ': ' + text.slice(0, 600)); process.exit(1); }
console.log('=====DUMP-BEGIN=====');
console.log(text);
console.log('=====DUMP-END=====');
