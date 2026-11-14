/* D103 round-end cleanup (owner-owed): QA seed rows hatao.
   users (qa1..qa7 + adm1), admins (adm1), unke user_cosmetics, notifications,
   user_push_tokens, premium_monthly_bonus_claims — service_role se.
   Usage: node tools/audit/d103-cleanup.cjs            (dry-run)
          APPLY=1 node tools/audit/d103-cleanup.cjs    (actual delete)
   Note: users delete FK-order me last; 409 aaye to referencing table pehle. */
const fs = require('fs');
const path = require('path');
const A = JSON.parse(fs.readFileSync(path.join(__dirname, '../tri-e2e/.state/d103.json'), 'utf8'));
const H = 'https://hddhkculuyrfoevxmlwy.supabase.co';
const SR = fs.readFileSync('/home/user/.secrets/supabase_service_role', 'utf8').trim();
const hd = { apikey: SR, authorization: 'Bearer ' + SR, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const APPLY = process.env.APPLY === '1';
const uids = Object.keys(A).map(k => A[k].uid);
const inList = '(' + uids.map(u => encodeURIComponent('"' + u + '"')).join(',') + ')';
(async () => {
  for (const [table, col] of [['user_cosmetics', 'user_id'], ['notifications', 'user_id'], ['user_push_tokens', 'user_id'], ['premium_monthly_bonus_claims', 'user_id'], ['admins', 'uid'], ['users', 'id']]) {
    const res = await fetch(`${H}/rest/v1/${table}?${col}=in.${inList}`, { method: APPLY ? 'DELETE' : 'GET', headers: hd });
    const body = await res.text();
    let n = 0; try { n = JSON.parse(body).length; } catch (e) {}
    console.log(`${APPLY ? 'DEL' : 'DRY'} ${table}: ${res.status} rows=${n}`);
  }
  console.log(APPLY ? 'CLEANUP APPLIED' : 'DRY-RUN only (APPLY=1 to delete)');
})();
