#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# tools/push-e2e/emulator_push_e2e.sh <state.json> <run>
# ANDROID FCM LIVE E2E (emulator, release APK):
#   install → launch (E2E token-log gate adb-extra se) → logcat se ASLI
#   FCM token → DB seed (android_seed.mjs) → notification INSERT →
#   hook → pg_net → push-send → FCM HTTP v1 → emulator par notification
#   → proof: logcat FCM_DELIVERED marker + dumpsys notification grep.
# ────────────────────────────────────────────────────────────────────
# v2 (fcm1 run ki seekh — run 41153616311):
#   • 2M default logcat buffer emulator par ~3 min me rotate ho jata
#     tha → FCM_TOKEN_ERROR jaisi app-lines diagnostics se GAYAB.
#     Ab: -G 16M + CONTINUOUS background capture (logcat-full.txt,
#     artifact me upload) — working emulator-e2e.sh ka proven pattern.
#   • am start -W -S (force-stop + wait) — launch status visible.
#   • periodic appdiag: pidof + mResumedActivity + Firebase-tag lines.
#   • attempt-2 cold relaunch @150s; token window 450s; delivery 240s.
# ════════════════════════════════════════════════════════════════════
set -uo pipefail
STATE="$1"; RUN="$2"
PKG=com.miniesports.app
ACT=$PKG/.MainActivity
LOG=logcat-full.txt

fail() { echo -e "\033[1;31mPUSH-ANDROID-FAIL: $*\033[0m"; exit 1; }

adb wait-for-device
boot=""
for _ in $(seq 1 60); do
  boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  [ "$boot" = "1" ] && break
  sleep 5
done
[ "$boot" = "1" ] || fail "emulator 5 min me boot nahi hua"
echo "• emulator boot completed"

adb logcat -G 16M >/dev/null 2>&1 || true
adb shell settings put global window_animation_scale 0 2>/dev/null || true
adb shell settings put global transition_animation_scale 0 2>/dev/null || true
adb shell settings put global animator_duration_scale 0 2>/dev/null || true

adb install -r -d MiniEsports.apk || fail "APK install fail"
adb shell dumpsys package $PKG 2>/dev/null | grep -E "versionName|versionCode" | head -2 | sed 's/^/  installed: /' || true
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null || true

adb shell am force-stop $PKG 2>/dev/null || true
adb logcat -c >/dev/null 2>&1 || true
rm -f "$LOG"
adb logcat -v time > "$LOG" 2>/dev/null &
LPID=$!
sleep 2

adb shell am start -W -S -n "$ACT" --es e2e_push_token_log miniesports-e2e 2>&1 | sed 's/^/  am: /'
echo "• release APK launch — E2E token-log gate ON (adb intent extra)"

appdiag() {
  echo "  [diag] pid=$(adb shell pidof $PKG 2>/dev/null | tr -d '\r')"
  adb shell dumpsys activity activities 2>/dev/null | grep -E "mResumedActivity|topResumedActivity" | head -3 | sed 's/^/  [diag] /' || true
  grep -E "MINIESPORTS-E2E|FirebaseMessaging|FirebaseInstallations|FirebaseApp|FIS_|SERVICE_NOT_AVAILABLE|AndroidRuntime|FATAL EXCEPTION|AppGuard" "$LOG" 2>/dev/null | tail -25 | sed 's/^/  [log] /' || true
}

TOK=""
for i in $(seq 1 90); do          # 90 × 5s = 450s
  TOK=$(grep -oE 'FCM_TOKEN=[A-Za-z0-9_:.\-]+' "$LOG" 2>/dev/null | head -1 | cut -d= -f2 || true)
  [ -n "$TOK" ] && break
  if [ $((i % 12)) -eq 0 ]; then echo "  …token wait $((i*5))s"; appdiag; fi
  if [ "$i" = "30" ]; then
    echo "  attempt 2: cold relaunch (-W -S)"
    adb shell am start -W -S -n "$ACT" --es e2e_push_token_log miniesports-e2e 2>&1 | sed 's/^/  am: /' || true
  fi
  sleep 5
done
if [ -z "$TOK" ]; then
  echo "::error::FCM token 450s me nahi mila — diagnostics neeche"
  appdiag
  kill "$LPID" 2>/dev/null || true; sleep 1
  tail -120 "$LOG" || true
  exit 1
fi
echo "• ASLI device FCM token mila: …${TOK: -6} (len ${#TOK})"

node tools/push-e2e/android_seed.mjs --state "$STATE" --token "$TOK" --run "$RUN" || fail "android_seed fail"

adb shell input keyevent KEYCODE_HOME
echo "• app background me — ab FCM delivery ka intezar (data-only high-priority)"

OK=""
for _ in $(seq 1 48); do          # 48 × 5s = 240s
  if grep -q "FCM_DELIVERED=PUSHE2EA-$RUN" "$LOG" 2>/dev/null; then OK="logcat-marker"; break; fi
  if adb shell dumpsys notification --noredact 2>/dev/null | grep -q "PUSHE2EA-$RUN"; then OK="dumpsys-notification"; break; fi
  sleep 5
done

adb shell dumpsys notification --noredact > notif-dump.txt 2>/dev/null || true
adb exec-out screencap -p > pe-android.png 2>/dev/null || true
sleep 1
kill "$LPID" 2>/dev/null || true

if [ -z "$OK" ]; then
  echo "::error::Android notification 240s me deliver nahi hui"
  tail -80 notif-dump.txt || true
  grep -E "MINIESPORTS-E2E|FirebaseMessaging|Push|FCM" "$LOG" 2>/dev/null | tail -40 || true
  exit 1
fi

echo "🎉 PUSH-ANDROID E2E PASS — delivery proof: $OK (title PUSHE2EA-$RUN)"
echo "{\"run\":\"$RUN\",\"token_tail\":\"${TOK: -6}\",\"delivery_proof\":\"$OK\"}" > /tmp/pe-android-out.txt
