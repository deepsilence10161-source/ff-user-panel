#!/bin/bash
# D103: per-account LIVE sweep chunks (low-RAM safe) + per-chunk findings merge
# usage: r6-sweep-loop.sh [accounts...]   (env: BASE, OUT, LIVE)
cd /home/user/ff-user-panel || exit 1
OUT=${OUT:-/home/user/ff-user-panel/reports/d103-sweep-live-fixverify}
BASE=${BASE:-http://127.0.0.1:8092/_d103.html}
ACCTS="${*:-qa6 qa4 qa1 qa3 qa5 qa2 qa7 adm1}"
: > /tmp/r6chunks.log
rm -f /tmp/findings-*.json
for k in $ACCTS; do
  echo "=== CHUNK $k $(date +%T)" | tee -a /tmp/r6chunks.log
  LIVE=1 BASE="$BASE" OUT=$OUT ONLY=$k node tools/audit/d103-sweep.cjs 2>&1 | tail -3 | tee -a /tmp/r6chunks.log
  cp $OUT/findings.json /tmp/findings-$k.json 2>/dev/null
  pkill -f 'headless_shel[l]' >/dev/null 2>&1
  sleep 8
done
ACCTS="$ACCTS" node -e "
const fs=require('fs');
const all=[];
for (const k of (process.env.ACCTS||'').split(/\s+/).filter(Boolean)) {
  try { all.push(...JSON.parse(fs.readFileSync('/tmp/findings-'+k.json,'utf8'))); } catch(e) {}
}
fs.writeFileSync('$OUT/findings.json', JSON.stringify(all,null,1));
console.log('MERGED FINDINGS:', all.length);
" | tee -a /tmp/r6chunks.log
echo ALL-CHUNKS-DONE | tee -a /tmp/r6chunks.log
