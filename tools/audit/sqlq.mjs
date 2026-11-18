#!/usr/bin/env node
/* D99 audit helper — Supabase Management API se SQL chalao (read ya write).
   Usage: node tools/audit/sqlq.mjs "SELECT ..."   ya   node tools/audit/sqlq.mjs --file path.sql
   Token: SUPABASE_ACCESS_TOKEN env, warna /home/user/.secrets/supabase_token */
import fs from 'node:fs';
const TOK = process.env.SUPABASE_ACCESS_TOKEN || fs.readFileSync('/home/user/.secrets/supabase_token', 'utf8').trim();
const REF = process.env.SB_REF || 'hddhkculuyrfoevxmlwy';
let q;
if (process.argv[2] === '--file') q = fs.readFileSync(process.argv[3], 'utf8');
else q = process.argv.slice(2).join(' ');
if (!q.trim()) { console.error('no sql'); process.exit(2); }
const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: q }),
});
const t = await r.text();
if (!r.ok) { console.error('SQL_HTTP_' + r.status + ': ' + t.slice(0, 1200)); process.exit(1); }
const MAX = Number(process.env.OUT_MAX || 60000);
console.log(t.slice(0, MAX));
