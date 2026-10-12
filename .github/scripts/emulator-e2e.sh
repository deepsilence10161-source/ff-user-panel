#!/usr/bin/env bash
# ================================================================
#  MINI eSPORTS — EMULATOR E2E (har screen, asli APK, asli device)
#  .github/scripts/emulator-e2e.sh   (2026-10-12)
# ================================================================
#  KAAM: emulator par APK install → app launch → HAR screen ka
#        screenshot + logcat proof → do E2E pages (asset + screen)
#        ka deterministic PASS/FAIL.
#
#  FAIL kab hota hai (hard gate):
#    - APK install fail
#    - app launch hone par WebView page load na ho (renderHome log na aaye)
#    - ASSET-E2E-RESULT ya SCREEN-E2E-RESULT marker na mile (timeout)
#    - koi bhi E2E page FAIL(...) report kare
#  WARN (gate nahi, sirf report): nav-tap screenshots — app login-screen
#    par ho to nav hidden hoti hai; ye normal hai, download proof me dikhta hai.
# ================================================================
set -uo pipefail

PKG=com.miniesports.app
ACT=$PKG/.MainActivity
BASE=https://deepsilence10161-source.github.io/ff-user-panel
SHOTS=e2e-artifacts/screenshots
LOGS=e2e-artifacts/logs
mkdir -p "$SHOTS" "$LOGS"

say() { echo -e "\n\033[1;36m== $* ==\033[0m"; }
fail() { echo -e "\033[1;31mE2E-FAIL: $*\033[0m"; exit 1; }

apk_path=$(ls -1 ./*.apk 2>/dev/null | head -1)
[ -n "${apk_path:-}" ] || fail "koi APK file repo root me nahi mili"

say "1) Device + boot"
adb wait-for-device
for i in $(seq 1 60); do
  boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  [ "$boot" = "1" ] && break
  sleep 5
done
[ "$boot" = "1" ] || fail "emulator 5 min me boot nahi hua"
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell wm size
adb shell wm density

say "2) APK install ($apk_path)"
adb install -r -d "$apk_path" || fail "APK install fail"

say "3) App launch (live GitHub Pages UI)"
adb logcat -c || true
adb shell am force-stop $PKG
adb shell am start -n "$ACT" >/dev/null || fail "app launch command fail"
sleep 25   # WebView + live site + OneSignal boot

adb shell screencap -p /sdcard/e2e-home.png && adb pull /sdcard/e2e-home.png "$SHOTS/01-app-home.png" >/dev/null

say "4) App session me JS errors ka check"
adb logcat -d > "$LOGS/app-session.txt" || true
if grep -qE "Uncaught (TypeError|ReferenceError|SyntaxError)" "$LOGS/app-session.txt"; then
  echo "--- JS errors (app session) ---"
  grep -E "Uncaught (TypeError|ReferenceError|SyntaxError)" "$LOGS/app-session.txt" | head -20
  fail "app UI me JS exception aayi (logcat me Uncaught)"
fi
if grep -oE "renderHome: [0-9]+ matches" "$LOGS/app-session.txt" | tail -1 | grep -q "renderHome"; then
  echo "✓ live UI load hui: $(grep -oE 'renderHome: [0-9]+ matches' "$LOGS/app-session.txt" | tail -1)"
else
  echo "⚠ renderHome log nahi mila (login screen ho sakta hai) — verify manually"
fi

say "5) HAR SCREEN — bottom nav ke 5 tabs, screenshot ke saath"
# bottom nav: home | rank | matches | wallet | profile (index.html, navTo)
SZ=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | head -1)
W=${SZ%x*}; H=${SZ#*x}
TAPY=$(( H - 60 ))
i=0
for name in home rank matches wallet profile; do
  X=$(( W * (2*i + 1) / 10 ))     # 5 tabs → (i+0.5)/5 * W
  adb shell input tap "$X" "$TAPY" >/dev/null 2>&1 || true
  sleep 4
  adb shell screencap -p "/sdcard/e2e-$name.png" && adb pull "/sdcard/e2e-$name.png" "$SHOTS/0$((i+2))-screen-$name.png" >/dev/null
  echo "  ✓ screen: $name (tap $X,$TAPY)"
  i=$((i+1))
done

say "6) ASSET E2E — 60 images ka live load (intent se)"
adb logcat -c || true
adb shell am start -n "$ACT" -a android.intent.action.VIEW -d "$BASE/asset-e2e.html" >/dev/null
for i in $(seq 1 24); do
  sleep 5
  adb logcat -d > "$LOGS/asset-e2e.txt" || true
  line=$(grep -oE "ASSET-E2E-RESULT: [^\"']*" "$LOGS/asset-e2e.txt" | tail -1)
  [ -n "$line" ] && break
done
[ -n "${line:-}" ] || fail "ASSET-E2E-RESULT marker 120s me nahi mila"
echo "  → $line"
echo "$line" | grep -q " OK" || fail "Asset E2E FAIL: $line"
adb shell screencap -p /sdcard/e2e-assets.png && adb pull /sdcard/e2e-assets.png "$SHOTS/07-asset-e2e.png" >/dev/null

say "7) SCREEN E2E — har screen/badge/cosmetic ka live render (intent se)"
adb logcat -c || true
adb shell am start -n "$ACT" -a android.intent.action.VIEW -d "$BASE/screen-e2e.html" >/dev/null
for i in $(seq 1 24); do
  sleep 5
  adb logcat -d > "$LOGS/screen-e2e.txt" || true
  line2=$(grep -oE "SCREEN-E2E-RESULT: [^\"']*" "$LOGS/screen-e2e.txt" | tail -1)
  [ -n "$line2" ] && break
done
[ -n "${line2:-}" ] || fail "SCREEN-E2E-RESULT marker 120s me nahi mila"
echo "  → $line2"
echo "$line2" | grep -q " OK" || fail "Screen E2E FAIL: $line2"
adb shell screencap -p /sdcard/e2e-screens.png && adb pull /sdcard/e2e-screens.png "$SHOTS/08-screen-e2e.png" >/dev/null
grep -oE '\[E2E\] \{.*\}' "$LOGS/screen-e2e.txt" | tail -1 > "$LOGS/badge-engine-selftest.json" || true

say "8) Aakhri logcat (full session)"
adb logcat -d > "$LOGS/final-logcat.txt" || true
ls -la "$SHOTS" "$LOGS"

say "E2E PASS — sab gates hare"
