#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# tools/push-e2e/emulator_push_e2e.sh <state.json> <run>
# ANDROID FCM LIVE E2E (emulator, release APK):
#   install → launch (E2E token-log gate adb-extra se) → logcat se ASLI
#   FCM token → DB seed (android_seed.mjs) → notification INSERT →
#   hook → pg_net → push-send → FCM HTTP v1 → emulator par notification
#   → proof: logcat FCM_DELIVERED marker + dumpsys notification grep.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail
STATE="$1"; RUN="$2"
PKG=com.miniesports.app

adb wait-for-device
adb shell 'while [ -z "$(getprop sys.boot_completed 2>/dev/null)" ]; do sleep 3; done'
echo "• emulator boot completed"

adb install -r MiniEsports.apk
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb logcat -c
adb shell am start -n "$PKG/.MainActivity" --es e2e_push_token_log miniesports-e2e
echo "• release APK launch — E2E token-log gate ON (adb intent extra)"

TOK=""
for _ in $(seq 1 40); do
  TOK=$(adb logcat -d -s MINIESPORTS-E2E | grep -oE 'FCM_TOKEN=[A-Za-z0-9_:.\-]+' | head -1 | cut -d= -f2 || true)
  [ -n "$TOK" ] && break
  sleep 5
done
if [ -z "$TOK" ]; then
  echo "::error::FCM token 200s me nahi mila (GMS checkin fail?)"
  adb logcat -d | tail -150 || true
  exit 1
fi
echo "• ASLI device FCM token mila: …${TOK: -6} (len ${#TOK})"

node tools/push-e2e/android_seed.mjs --state "$STATE" --token "$TOK" --run "$RUN"

adb shell input keyevent KEYCODE_HOME
echo "• app background me — ab FCM delivery ka intezar (data-only high-priority)"

OK=""
for _ in $(seq 1 40); do
  if adb logcat -d -s MINIESPORTS-E2E | grep -q "FCM_DELIVERED=PUSHE2EA-$RUN"; then OK="logcat-marker"; break; fi
  if adb shell dumpsys notification --noredact 2>/dev/null | grep -q "PUSHE2EA-$RUN"; then OK="dumpsys-notification"; break; fi
  sleep 5
done

adb shell dumpsys notification --noredact > notif-dump.txt 2>/dev/null || true
adb exec-out screencap -p > pe-android.png 2>/dev/null || true

if [ -z "$OK" ]; then
  echo "::error::Android notification 200s me deliver nahi hui"
  tail -80 notif-dump.txt || true
  adb logcat -d | tail -150 || true
  exit 1
fi

echo "🎉 PUSH-ANDROID E2E PASS — delivery proof: $OK (title PUSHE2EA-$RUN)"
echo "{\"run\":\"$RUN\",\"token_tail\":\"${TOK: -6}\",\"delivery_proof\":\"$OK\"}" > /tmp/pe-android-out.txt
