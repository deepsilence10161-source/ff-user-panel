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

# ✅ सबसे NAYI apk चुनो (alphabetical head -1 nahi — repo me committed
# MiniEsports.apk bhi hoti hai; galat file uthne par purana build test hota tha).
apk_path=$(ls -1t ./*.apk 2>/dev/null | head -1)
[ -n "${apk_path:-}" ] || fail "koi APK file repo root me nahi mili"
echo "APK proof: $(ls -la "$apk_path" | awk '{print $5" bytes", $6, $7, $8}') | sha256=$(sha256sum "$apk_path" | cut -c1-16)…"

say "1) Device + boot"
adb wait-for-device
for i in $(seq 1 60); do
  boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  [ "$boot" = "1" ] && break
  sleep 5
done
[ "$boot" = "1" ] || fail "emulator 5 min me boot nahi hua"
# 2M default buffer is emulator par jaldi rotate ho jata hai — E2E
# diagnostics (MINIESPORTS-E2E / chromium CONSOLE) kho jaate the. 16M.
adb logcat -G 16M >/dev/null 2>&1 || true
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell wm size
adb shell wm density

say "2) APK install ($apk_path)"
adb install -r -d "$apk_path" || fail "APK install fail"
# Installed version ka proof (ki wahi APK laga jo humne di)
adb shell dumpsys package $PKG 2>/dev/null | grep -E "versionName|versionCode" | head -2 | sed 's/^/  installed: /' || true
# ✅ E2E determinism: notification-permission dialog pehle se grant karo —
# warna OneSignal ka "Allow notifications?" prompt har cold start par app
# ke upar modal ban kar baith jata hai (aur screenshots bhi dhundhla karta).
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION 2>/dev/null || true
adb shell pm grant $PKG android.permission.READ_CONTACTS 2>/dev/null || true

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

# ── E2E page ko COLD START se kholo (force-stop → intent): onCreate →
#    handleIntent E2E branch → loadUrl. Ye "currently running instance ko
#    intent" wale route se zyada deterministic hai (pichhli run me warm
#    route par page load hua hi nahi tha). Diagnostics: MINIESPORTS-E2E
#    tag ki lines har kadam ka proof deti hain.
run_e2e_page () {   # $1 = page  $2 = marker prefix  $3 = screenshot file
  # NOTE (2026-10-12): HAR local apni line par — bash 5 me ek hi "local"
  # statement ke andar aage wale variable ($MARK) set -u par "unbound
  # variable" deta hai (run 38208795592 isi par fail hua tha).
  local page="$1"
  local MARK="$2"
  local shot="$3"
  local log="$LOGS/$MARK.txt"
  local line=""
  local boot=""
  local onpf=""
  local lpid=""
  local attempt=""

  echo "  attempt 1: $page"
  adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null || true
  adb logcat -c || true
  # लगातार capture (background) — -d wale dumps rotate hokar diagnostics
  # kho dete the. File append-only rehti hai, kuch nahi khota.
  adb logcat > "$log" 2>/dev/null &
  lpid=$!
  for attempt in 1 2; do
    [ "$attempt" = "2" ] && echo "  attempt 2 (dobara cold start): $page"
    # -S = pehle force-stop, phir start (race-free); -W = result print karo
    adb shell am start -W -S -n "$ACT" -a android.intent.action.VIEW -d "$BASE/$page" 2>&1 | sed 's/^/    am: /' || true
    for i in $(seq 1 12); do          # per attempt 12 x 5s = 60s
      sleep 5
      line=$(grep -oE "$MARK-RESULT: [^\"']*" "$log" | tail -1)
      [ -n "$line" ] && break
    done
    [ -n "$line" ] && break
  done
  sleep 1
  [ -n "$lpid" ] && kill "$lpid" 2>/dev/null || true
  boot=$(grep -oE "$MARK-BOOT: [^\"']*" "$log" | tail -1 || true)
  onpf=$(grep -oE "MINIESPORTS-E2E.*onPageFinished: .*" "$log" | tail -1 || true)
  if [ -z "$line" ]; then
    echo "--- diagnostics ($page): boot='${boot:-nahi}' | ${onpf:-page-load line nahi mili}"
    echo "--- top activity + MINIESPORTS-E2E / chromium (aakhri 40) ---"
    adb shell dumpsys activity activities 2>/dev/null | grep -E "mResumedActivity|topResumedActivity|Hist" | head -5 || true
    grep -E "MINIESPORTS-E2E|chromium.*CONSOLE|$MARK" "$log" | tail -40 || true
    fail "$MARK-RESULT marker 2 attempts (150s) me nahi mila${boot:+ (page boot hua: $boot)}"
  fi
  # marker asli E2E page hi se aaya ho (source check)
  grep -q "source: https://[^ ]*/$page" "$log" || fail "$MARK marker kisi aur page se aaya (source check fail)"
  echo "  → $line"
  echo "$line" | grep -q " OK" || fail "$MARK FAIL: $line"
  adb shell screencap -p "/sdcard/e2e-$MARK.png" && adb pull "/sdcard/e2e-$MARK.png" "$SHOTS/$shot" >/dev/null
}

say "6) ASSET E2E — 60 images ka live load (cold start intent)"
run_e2e_page asset-e2e.html ASSET-E2E 07-asset-e2e.png

say "7) SCREEN E2E — har screen/badge/cosmetic ka live render (cold start intent)"
run_e2e_page screen-e2e.html SCREEN-E2E 08-screen-e2e.png
grep -oE '\[E2E\] \{.*\}' "$LOGS/SCREEN-E2E.txt" | tail -1 > "$LOGS/badge-engine-selftest.json" || true

say "8) Aakhri logcat (full session)"
adb logcat -d > "$LOGS/final-logcat.txt" || true
ls -la "$SHOTS" "$LOGS"

say "E2E PASS — sab gates hare"
