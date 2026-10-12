#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  TRI-E2E — EMULATOR side (GitHub Actions, reactivecircus/android-emulator-runner)
# ═══════════════════════════════════════════════════════════════════════════
#  Ye script HOST par chalta hai (emulator booted, adb ready) aur teeno
#  surfaces ko ek hi waqt me chalata hai:
#
#    • APK  : asli release APK install → tri-e2e.html E2E page WebView me
#    • HOST : host_driver.py background me (Admin Panel + User Panel web,
#             Playwright) — QA accounts wahi jo APK use kar raha hai
#    • DB   : dono ek hi Supabase par — isliye interleaving DB se hoti hai
#
#  Env (workflow se):
#    OUT_DIR   — artifacts folder
#    APK_PATH  — release APK
#    RUNID, TRI_EMAIL, TRI_PASS — QA player (qa-accounts.mjs se)
# ═══════════════════════════════════════════════════════════════════════════
set -u
PKG="com.miniesports.app"
BASE_URL="https://deepsilence10161-source.github.io/ff-user-panel/tri-e2e.html"
OUT_DIR="${OUT_DIR:-/tmp/tri-out}"
APK_PATH="${APK_PATH:-apk-out/app-release.apk}"
mkdir -p "$OUT_DIR"

echo "════════ TRI E2E (emulator side) — run $RUNID ════════"

# ── 0. URL banao (credentials URL ke #fragment me — percent-encoded) ──────
URL="$(python3 - "$RUNID" "$TRI_EMAIL" "$TRI_PASS" <<'PY'
import sys, urllib.parse
run, e, p = sys.argv[1], sys.argv[2], sys.argv[3]
frag = "run=%s&e=%s&p=%s" % (urllib.parse.quote(run), urllib.parse.quote(e), urllib.parse.quote(p))
print("https://deepsilence10161-source.github.io/ff-user-panel/tri-e2e.html#%s" % frag)
PY
)"
echo "APK page URL tayyar (creds fragment me, log me nahi chhapte)"

# ── 1. host driver (Admin Panel + User Panel web) background me ───────────
echo "── host driver start (Playwright: admin panel + user web) ──"
python3 tools/tri-e2e/host_driver.py \
  --run "$RUNID" \
  --state "tools/tri-e2e/.state/$RUNID.json" \
  --out "$OUT_DIR/host_out.json" \
  --shots "$OUT_DIR/web-shots" \
  --wait-apk "${WAIT_APK:-600}" > "$OUT_DIR/host-driver.log" 2>&1 &
HOST_PID=$!
echo "host driver pid=$HOST_PID"

# ── 2. APK install ───────────────────────────────────────────────────────
echo "── APK install: $APK_PATH ──"
adb install -r "$APK_PATH" || { echo "❌ APK install fail"; kill $HOST_PID; exit 1; }
adb shell pm list packages | grep -q "$PKG" && echo "installed: $PKG"

# ── 3. logcat clear + app launch (E2E page intent) ───────────────────────
adb logcat -c || true
adb shell am force-stop "$PKG" || true
sleep 2
echo "── tri-e2e page launch (asli APK, asli WebView) ──"
adb shell "am start -a android.intent.action.VIEW -d '$URL'" > "$OUT_DIR/am-start.txt" 2>&1 || true
sleep 8
adb shell dumpsys window 2>/dev/null | grep -m1 mCurrentFocus || true

# ── 4. logcat markers + intzaar (TRI-E2E-RESULT / STEP / VALUES) ─────────
LOG="$OUT_DIR/apk-logcat.txt"
( adb logcat -v time > "$LOG" 2>/dev/null ) &
LOGCAT_PID=$!
MARK="$OUT_DIR/apk-markers.txt"
RESULT=""
DEADLINE=$(( $(date +%s) + ${APK_WAIT:-1500} ))
LAST_SHOT=0
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  grep -a "TRI-E2E-" "$LOG" 2>/dev/null | sed 's/.*chromium: //' | sort -u > "$MARK" || true
  RESULT="$(grep -a -m1 "TRI-E2E-RESULT" "$LOG" 2>/dev/null | tail -1)"
  # live proof screenshots — har ~3 min me ek
  NOW=$(date +%s)
  if [ $(( NOW - LAST_SHOT )) -ge 180 ]; then
    adb exec-out screencap -p > "$OUT_DIR/apk-screen-$(date +%H%M%S).png" 2>/dev/null || true
    LAST_SHOT=$NOW
  fi
  if [ -n "$RESULT" ]; then break; fi
  sleep 10
done
adb exec-out screencap -p > "$OUT_DIR/apk-screen-final.png" 2>/dev/null || true

# ── 5. APK ke values (cross-surface compare ke liye) ─────────────────────
python3 - "$LOG" "$OUT_DIR/apk-values.json" <<'PY'
import json, re, sys
log, out = sys.argv[1], sys.argv[2]
txt = open(log, "rb").read().decode("utf-8", "ignore")
m = re.findall(r"TRI-E2E-VALUES:\s*(\{.*?\})\s*\"", txt) or re.findall(r"TRI-E2E-VALUES:\s*(\{[^\n]*\})", txt)
vals = {}
if m:
    try:
        vals = json.loads(m[-1].replace('\\"', '"'))
    except Exception as e:
        print("values parse fail:", e)
json.dump(vals, open(out, "w"), indent=1, ensure_ascii=False)
print("APK values:", json.dumps(vals, ensure_ascii=False)[:400])
PY

# ── 6. host driver ka intezaar ───────────────────────────────────────────
echo "── host driver ka intezaar (pid $HOST_PID) ──"
wait $HOST_PID; HOST_RC=$?
echo "host driver exit=$HOST_RC"
kill $LOGCAT_PID 2>/dev/null || true

# ── 7. summary ───────────────────────────────────────────────────────────
echo "════════ APK side summary ════════"
grep -a "TRI-E2E-STEP\|TRI-E2E-RESULT" "$MARK" 2>/dev/null | tail -12 || true
if [ -z "$RESULT" ]; then
  echo "❌ APK side ne TRI-E2E-RESULT nahi diya (timeout) — logcat:"
  grep -a "TRI-E2E\|chromium: \[INFO:CONSOLE" "$LOG" 2>/dev/null | tail -20 || true
fi
exit $HOST_RC
