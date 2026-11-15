#!/bin/bash
# D103 Round-7 (re-run) — LIVE Pages QA + evidence zip (wipe-safe)
set -u
cd /home/user/ff-user-panel
UB=https://deepsilence10161-source.github.io/ff-user-panel/index.html
AB=https://deepsilence10161-source.github.io/ff-admin-panel/
R=/home/user/ff-user-panel/reports
SR=$(cat /home/user/.secrets/supabase_service_role 2>/dev/null)
SB=https://hddhkculuyrfoevxmlwy.supabase.co
QA4=Doy04RskzATt9eduNUmUUzTT4HT2

seed () {  # $1 = count
  python3 - "$1" <<'PY'
import json,sys,urllib.request
n=int(sys.argv[1]); S=open('/home/user/.secrets/supabase_service_role').read().strip()
H='https://hddhkculuyrfoevxmlwy.supabase.co'; QA4='Doy04RskzATt9eduNUmUUzTT4HT2'
rows=[{"user_id":QA4,"type":("match" if i%2 else "support"),"title":f"R7 Unread {i}","body":f"Badge test #{i} (QA-only).","is_read":False} for i in range(1,n+1)]
r=urllib.request.Request(H+'/rest/v1/notifications',data=json.dumps(rows).encode(),headers={'apikey':S,'Authorization':'Bearer '+S,'Content-Type':'application/json','Prefer':'return=minimal'},method='POST')
print('  seed',n,'unread ->',urllib.request.urlopen(r,timeout=40).status)
PY
}

echo "===== [1/5] SWEEP 8 accounts x hi/en (LIVE Pages) ====="
LIVE=1 BASE=$UB OUT=$R/d103-sweep-pages-r7 node tools/audit/d103-sweep.cjs
echo "SWEEP_EXIT=$?"

echo "===== [2/5] CLICKS qa2 x hi/en ====="
ONLY=qa2 LANGS=hi,en LIVE=1 BASE=$UB OUT=$R/d103-clicks-pages-r7 node tools/audit/d103-clicks.cjs
echo "CLICKS_EXIT=$?"

echo "===== [3/5] NOTIF hi (5 unread => count pill) ====="
seed 5
LIVE=1 BASE=$UB LANGS=hi OUT=$R/d103-notif-pages-r7 node tools/audit/d103-notif.cjs
echo "NOTIF_HI_EXIT=$?"
echo "===== [4/5] NOTIF en (2 unread => dot) ====="
seed 2
LIVE=1 BASE=$UB LANGS=en OUT=$R/d103-notif-pages-r7-en node tools/audit/d103-notif.cjs
echo "NOTIF_EN_EXIT=$?"
curl -s -o /dev/null -w "  cleanup R7 test notifs -> %{http_code}\n" -X DELETE "$SB/rest/v1/notifications?title=like.R7*" -H "apikey: $SR" -H "Authorization: Bearer $SR"

echo "===== [5/5] ADMIN DEEP (LIVE Pages) ====="
OUT=$R/d103-admin-deep-r7 ADMIN_BASE=$AB node tools/audit/d103-admin-deep.cjs
echo "ADMIN_DEEP_EXIT=$?"

echo "===== EVIDENCE ZIP ====="
cd $R && rm -f /home/user/d103-r7-evidence.zip && zip -qr9 /home/user/d103-r7-evidence.zip \
  d103-sweep-pages-r7 d103-clicks-pages-r7 d103-notif-pages-r7 d103-notif-pages-r7-en d103-admin-deep-r7 \
  D103-round7.md D103-qa-report.md d103-supabase-incident.md D103-platform-risk-plan.md D103-backend-freedom-plan.md 2>/dev/null
ls -la /home/user/d103-r7-evidence.zip
echo "R7_FULL_LOOP_DONE"
