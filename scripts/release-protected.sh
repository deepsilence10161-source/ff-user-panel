#!/bin/bash
# ════════════════════════════════════════════════════════════════
# MINI eSPORTS — PROTECTED RELEASE PIPELINE (D88, 07-Nov-2026)
# Source = ye workspace (PRIVATE). Public GitHub repo = sirf
# obfuscated build. Ye script: build → public repo update → push.
# Usage: bash scripts/release-protected.sh "commit message"
# ════════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")/.."
MSG="${1:-protected release}"
TOK="$(bash /home/user/scripts/ghtok.sh)" || { echo "❌ TOKEN DEAD (v2+main dono fail) — release ruka"; exit 1; }
[ -n "$TOK" ] || { echo "❌ TOKEN EMPTY — release ruka"; exit 1; }

echo "== 1. smoke gates (HARD — fail par release rukegi)"
node tests/run-smoke-tests.js | tail -1
[ "${PIPESTATUS[0]}" = "0" ] || { echo "❌ SMOKE FAIL — release RUKA"; exit 1; }

echo "== 2. version stamp bump"
node scripts/version-sync.mjs --bump | tail -1
node tests/run-smoke-tests.js | tail -1
[ "${PIPESTATUS[0]}" = "0" ] || { echo "❌ SMOKE (post-bump) FAIL — release RUKA"; exit 1; }

echo "== 2b. asset + screen E2E (local hard gates — protected tree par CI inhe skip karta hai)"
node tests/asset-e2e.js >/tmp/asset-e2e.log 2>&1 && echo "asset-e2e: PASS" || { tail -3 /tmp/asset-e2e.log; echo "❌ ASSET-E2E FAIL — release RUKA"; exit 1; }
node tests/screen-e2e.js >/tmp/screen-e2e.log 2>&1 && echo "screen-e2e: PASS" || { tail -3 /tmp/screen-e2e.log; echo "❌ SCREEN-E2E FAIL — release RUKA"; exit 1; }

echo "== 3. obfuscated build"
NODE_PATH=/home/user/ui-lab/node_modules node scripts/protect-build.mjs | tail -1

echo "== 3b. D89 GATE: fresh-boot crash check (real-user first-run simulate)"
( cd build && nohup python3 -m http.server 8090 --bind 127.0.0.1 >/dev/null 2>&1 & echo $! > /tmp/gate-srv.pid )
sleep 1
NODE_PATH=/home/user/ui-lab/node_modules node /home/user/ui-lab/pt-local.cjs | tee /tmp/gate.out
kill "$(cat /tmp/gate-srv.pid)" 2>/dev/null || true
grep -q "crash: NONE" /tmp/gate.out || { echo "❌ FRESH-BOOT GATE FAIL — release RUKA (crash present)"; exit 1; }
echo "✅ fresh-boot gate pass"

echo "== 4. public repo update (build-only tree)"
rm -rf /tmp/pubrel
git clone -q --depth 1 "https://x-access-token:$TOK@github.com/DEEPSILENCE10161-source/ff-user-panel.git" /tmp/pubrel
cd /tmp/pubrel
find . -maxdepth 1 ! -name '.git' ! -name '.github' ! -name '.' -exec rm -rf {} +
cp -r /home/user/ff-user-panel/build/. .
rm -f MiniEsports.apk
# ✅ D93: CI workflows HAR release ke saath public repo me ship karo —
# Nov-6 restore me .github gayab ho gaya tha → APK build + E2E emulator
# (real-app screenshots) chalna band ho gaya tha. Ab source-of-truth
# private repo se workflows automatic public me refresh hote hain.
mkdir -p .github/workflows .github/scripts
cp /home/user/ff-user-panel/.github/workflows/build-apk.yml .github/workflows/ 2>/dev/null || true
cp /home/user/ff-user-panel/.github/workflows/e2e-emulator.yml .github/workflows/ 2>/dev/null || true
cp /home/user/ff-user-panel/.github/scripts/*.sh .github/scripts/ 2>/dev/null || true
git add -A
git -c user.email=agent@arena.ai -c user.name="Arena Agent" commit -q -m "$MSG" || echo "nothing to commit"
git push -q origin HEAD:main
cd -

echo "== 4b. VERSION_FALLBACK refresh (✅ D99: source ZIP me .git nahi hota —"
echo "        bina iske zip se APK build fail hota tha; ab committed count se banta hai)"
git rev-list --count HEAD > VERSION_FALLBACK
echo "        VERSION_FALLBACK = $(cat VERSION_FALLBACK)"

echo "== 5. source backup zip (Drive: 'mini eSports/user panel/projectN' me hi upload karein —"
echo "        owner rule 09-Nov-2026: zip idhar-udhar bahar NAHI)"
cd /home/user/ff-user-panel
rm -f /home/user/reports/mini-esports-source-backup.zip
zip -qr /home/user/reports/mini-esports-source-backup.zip . -x ".git/*" "build/*" "node_modules/*" "android/.gradle/*" "android/app/build/*"
echo "OK: /home/user/reports/mini-esports-source-backup.zip"
echo "== DONE — Pages deploy + APK CI auto-trigger"
echo ""
echo "⚠️  OWNER RULE (D93, 07-Nov-2026) — ANIVARYA AGLA KADAM:"
echo "   CI (Build APK + E2E Emulator) complete hone par chalayein:"
echo "       bash scripts/post-release-verify.sh"
echo "   → REAL-APP screenshots (asli APK, asli emulator) + release APK ka"
echo "     SHA-256/zip-integrity local verify + evidence summary."
echo "   Owner ko real-app screenshots dikhaye bina update 'DONE' report NAHI karna."
