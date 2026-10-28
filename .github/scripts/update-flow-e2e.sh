#!/usr/bin/env bash
# ================================================================
#  MINI eSPORTS — UPDATE-FLOW E2E   (2026-10-29)
#  .github/scripts/update-flow-e2e.sh
# ================================================================
#  ASLI USER-FLOW, asli emulator par:
#    old release APK install → launch (policy verdict cache) →
#    ek-baari unknown-apps toggle (appops) → toggle-page proof →
#    miniesports://update deep-link → in-app download (app-private) →
#    system installer → Update tap → install → app relaunch →
#    PROOF: updates/ APK auto-delete (logcat + root ls),
#    /sdcard/Download clean, galat-host deep-link REFUSED.
#  Har proof ek hard gate hai — koi bhi miss = EXIT 1.
# ================================================================
set -uo pipefail

PKG=com.miniesports.app
ACT=$PKG/.MainActivity
REPO=${GITHUB_REPOSITORY:-deepsilence10161-source/ff-user-panel}
# ✅ NEW = LATEST GitHub Release (public URL — wahi jo users ko milti hai).
# Pages par committed MiniEsports.apk build-apk commit-back NAHI karta, isliye
# wo stale reh sakti hai; release asset har main-build par fresh publish hoti hai.
NEW_URL="${NEW_APK_URL:-https://github.com/$REPO/releases/latest/download/MiniEsports.apk}"
ART=e2e-artifacts
mkdir -p "$ART/logs" "$ART/dumps"

say()  { echo -e "\n\033[1;36m== $* ==\033[0m"; }
fail() { echo -e "\033[1;31mUPDATE-FLOW-FAIL: $*\033[0m"; adb logcat -d > "$ART/logs/logcat-fail.txt" 2>/dev/null || true; exit 1; }
pass() { echo -e "\033[1;32mPROOF-OK: $*\033[0m"; }

dismiss_anr() { # slow emulator par ANR/system dialog screen chhupa deta hai — pehle hatoo
  adb shell uiautomator dump /sdcard/ui0.xml >/dev/null 2>&1
  adb pull /sdcard/ui0.xml /tmp/ui0.xml >/dev/null 2>&1 || return 0
  if grep -qE "isn't responding|Close app|System UI" /tmp/ui0.xml 2>/dev/null; then
    # ANR dialog launcher process ka hota hai — "Wait" se bar-bar wapas aata
    # hai; launcher force-stop karo (Settings/app ko kuch nahi hota), phir
    # bacha-kucha dialog tap se hatao.
    echo "  (ANR/system dialog mila — launcher force-stop + dialog tap)"
    adb shell am force-stop com.google.android.apps.nexuslauncher >/dev/null 2>&1 || true
    tap_text "^Wait$" >/dev/null 2>&1 || tap_text "^Close app$" >/dev/null 2>&1 || true
    sleep 3
  fi
}

tap_text() { # tap_text <regex>  — uiautomator dump me text/description match ka center tap
  local pat="$1"
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml "$ART/dumps/ui-last.xml" >/dev/null 2>&1
  python3 - "$pat" "$ART/dumps/ui-last.xml" <<'PY'
import re, sys, subprocess
pat, path = sys.argv[1], sys.argv[2]
try:
    xml = open(path, encoding='utf-8', errors='ignore').read()
except Exception:
    sys.exit(3)
for m in re.finditer(r'<node[^>]*>', xml):
    n = m.group(0)
    t = re.search(r'text="([^"]*)"', n); d = re.search(r'content-desc="([^"]*)"', n)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
    if not b: continue
    s = ((t.group(1) if t else '') + ' ' + (d.group(1) if d else '')).strip()
    if re.search(pat, s, re.I):
        x = (int(b.group(1)) + int(b.group(3))) // 2
        y = (int(b.group(2)) + int(b.group(4))) // 2
        print(f"  tap({x},{y}) on: {s.strip()[:60]}")
        subprocess.run(['adb', 'shell', 'input', 'tap', str(x), str(y)], check=False)
        sys.exit(0)
sys.exit(3)
PY
}

say "0) Release inventory (old base vs new pages APK)"
adb wait-for-device
REL_JSON=$(gh release list -R "$REPO" --limit 3 --json tagName,createdAt,publishedAt 2>/dev/null) || REL_JSON=""
echo "$REL_JSON" | head -c 600; echo
OLD_TAG=$(echo "$REL_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[1]['tagName'] if len(d)>1 else '')" 2>/dev/null || true)
NEW_TAG=$(echo "$REL_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['tagName'] if len(d)>0 else '')" 2>/dev/null || true)
[ -n "$OLD_TAG" ] || fail "purani release tag nahi mili (old base APK ke liye)"
gh release download "$OLD_TAG" -R "$REPO" -p "MiniEsports.apk" -O old-base.apk || fail "old base APK download fail ($OLD_TAG)"
curl -fsL -o new-pages.apk "$NEW_URL" || fail "new pages APK download fail: $NEW_URL"
echo "old($OLD_TAG): $(sha256sum old-base.apk | cut -c1-16)  new(pages): $(sha256sum new-pages.apk | cut -c1-16)"
if [ "$(sha256sum old-base.apk | cut -d' ' -f1)" = "$(sha256sum new-pages.apk | cut -d' ' -f1)" ]; then
  fail "pages APK aur pichhli release SAME file hain — naya build pages par abhi nahi aaya (retry baad me)"
fi

say "1) Boot + old base APK install"
for i in $(seq 1 60); do
  boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  [ "$boot" = "1" ] && break
  sleep 5
done
[ "$boot" = "1" ] || fail "emulator 5 min me boot nahi hua"
adb logcat -G 16M >/dev/null 2>&1 || true
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
# slow emulator par Pixel Launcher ANR dialog poore flow ko dhak deta tha —
# proactive force-stop (app/Settings isse prabhavit nahi hote).
adb shell am force-stop com.google.android.apps.nexuslauncher >/dev/null 2>&1 || true
adb install -r -d old-base.apk || fail "old base APK install fail"
OLD_VC=$(adb shell dumpsys package $PKG | grep -m1 versionCode | tr -d '\r')
echo "  installed base: $OLD_VC ($OLD_TAG)"

say "2) App launch (logged-out baseline)"
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb shell am start -n $ACT >/dev/null
sleep 20   # live site load

say "2b) QA login (tri-e2e page fragment — same origin, shared session) → server verdict cache"
# SafeCleaner R1: cleanup verdict sirf logged-in identity par definitive hota
# hai. tri-e2e.html fragment-login wahi session banata hai jo app ka normal
# page use karta hai (same github.io origin → shared localStorage).
[ -n "${TRI_EMAIL:-}" ] || fail "TRI_EMAIL env nahi mila (workflow QA step)"
FRAG="run=${TRI_RUNID}&e=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$TRI_EMAIL")&p=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$TRI_PASS")"
adb shell "am start -n $ACT -a android.intent.action.VIEW -d 'https://deepsilence10161-source.github.io/ff-user-panel/tri-e2e.html#${FRAG}'" >/dev/null
WAITG=""
for i in $(seq 1 30); do
  if adb logcat -d | grep -q "Cleanup ALLOWED (server policy)"; then WAITG=yes; break; fi
  sleep 4
done
if [ -n "$WAITG" ]; then
  pass "G: QA login hua + server policy verdict ALLOWED cache hua (SafeCleaner R1)"
else
  adb logcat -d | grep -E "SafeCleaner|EXEMPT|identity" | tail -8 || true
  fail "G: tri-page login se verdict ALLOWED nahi mila (login/policy issue)"
fi

say "3) PROOF A — REQUEST_INSTALL_PACKAGES manifest me declared"
adb shell dumpsys package $PKG | grep -q "android.permission.REQUEST_INSTALL_PACKAGES" \
  && pass "A: permission declared (toggle exist kar sakta hai)" \
  || fail "A: REQUEST_INSTALL_PACKAGES manifest me nahi mila"

say "4) PROOF B — Settings toggle page par humara switch maujood"
adb shell am start -a android.settings.MANAGE_UNKNOWN_APP_SOURCES -d "package:$PKG" >/dev/null
sleep 4
B_OK=""
for i in $(seq 1 8); do
  dismiss_anr
  if tap_text "Allow from this source|Allow app installs|Unknown app source"; then B_OK=yes; break; fi
  sleep 3
done
if [ -n "$B_OK" ]; then
  pass "B: toggle page par switch mila aur tap hua (ek-baari permission)"
else
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml "$ART/dumps/toggle-page.xml" >/dev/null 2>&1
  grep -o 'text="[^"]\{3,60\}"' "$ART/dumps/toggle-page.xml" | head -12 || true
  fail "B: toggle page par allow-switch nahi mila"
fi
# toggle ON karke wapas app par (appops = wahi jo user Settings me karta hai)
adb shell appops set $PKG REQUEST_INSTALL_PACKAGES allow
adb shell input keyevent KEYCODE_BACK; sleep 1

say "5) Deep-link update trigger (web page ka 'App me update karein' button)"
ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$NEW_URL")
adb shell am start -a android.intent.action.VIEW -d "miniesports://update?url=${ENC}&v=latest" >/dev/null
sleep 5
adb logcat -d | grep -q "update deep-link accepted" && pass "deep-link allowlist se pass" || fail "deep-link accepted log nahi mila"

say "6) In-app download (app-private updates/) → system installer"
FOUND=""
for i in $(seq 1 40); do
  dismiss_anr
  if tap_text "^(Install|Update|Install anyway|Update anyway)$"; then FOUND=yes; break; fi
  sleep 3
done
[ -n "$FOUND" ] || fail "system installer ka Install/Update button 2 min me nahi dikha"
pass "installer UI aaya aur Update tap hua"
INST=""
for i in $(seq 1 40); do
  if tap_text "^(Open|Done|Finish)$"; then INST=yes; break; fi
  sleep 3
done
echo "  installer done-screen tap: ${INST:-n/a}"

say "7) PROOF C — naya version install hua"
sleep 5
NEW_VC=$(adb shell dumpsys package $PKG | grep -m1 versionCode | tr -d '\r')
echo "  base: $OLD_VC  →  now: $NEW_VC"
[ "$NEW_VC" != "$OLD_VC" ] || fail "C: versionCode badla nahi — install poora nahi hua"
pass "C: versionCode update hua ($OLD_VC → $NEW_VC)"

say "8) PROOF D — post-install auto-delete (pre/post count, root ls)"
# API 26+ par manifest receiver dead hota hai (official docs) — asli cleanup
# hook naye version ka pehla launch (onCreate) hai, isliye proof = relaunch
# se PEHLE file maujood, relaunch ke BAAD gayab.
adb root >/dev/null 2>&1; sleep 3
PRE_EXT=$(adb shell ls /sdcard/Android/data/$PKG/files/updates 2>/dev/null | grep -c "\.apk" || true)
PRE_INT=$(adb shell ls /data/data/$PKG/files/updates 2>/dev/null | grep -c "\.apk" || true)
PRE_TOTAL=$(( ${PRE_EXT:-0} + ${PRE_INT:-0} ))
echo "  install ke baad, relaunch se PEHLE updates/ me APKs: $PRE_TOTAL"
[ "${PRE_TOTAL:-0}" -ge 1 ] || fail "D0: install ke baad updates/ me APK mili hi nahi — in-app download proof adhoora"
adb shell am start -n $ACT >/dev/null   # naye version ka pehla launch = cleanup hook
sleep 20
adb logcat -d > "$ART/logs/logcat-full.txt"
grep -q "Cleanup ALLOWED (server policy)" "$ART/logs/logcat-full.txt" \
  && pass "D1: server verdict ALLOWED session me cached tha (R1 gate satisfied)" \
  || fail "D1: verdict ALLOWED logcat me nahi mila"
LEFT_EXT=$(adb shell ls /sdcard/Android/data/$PKG/files/updates 2>/dev/null | grep -c "\.apk" || true)
LEFT_INT=$(adb shell ls /data/data/$PKG/files/updates 2>/dev/null | grep -c "\.apk" || true)
LEFT_TOTAL=$(( ${LEFT_EXT:-0} + ${LEFT_INT:-0} ))
echo "  relaunch ke BAAD updates/ me APKs: $LEFT_TOTAL"
[ "${LEFT_TOTAL:-0}" = "0" ] \
  && pass "D2: updates/ khaali — install ke baad APK auto-delete hua ($PRE_TOTAL → 0)" \
  || fail "D2: updates/ me ab bhi $LEFT_TOTAL APK padi hai"

say "9) PROOF E — Downloads folder me koi MiniEsports file NAHI"
DL=$(adb shell ls /sdcard/Download 2>/dev/null | grep -ci "miniesports" || true)
[ "${DL:-0}" = "0" ] && pass "E: /sdcard/Download clean — phone me sirf app, file nahi" \
  || fail "E: Downloads me MiniEsports file mil gayi"

say "10) PROOF F — galat host ka deep-link allowlist se REFUSED"
adb shell am start -a android.intent.action.VIEW -d "miniesports://update?url=https%3A%2F%2Fevil.example.com%2Ffake.apk&v=x" >/dev/null
sleep 4
adb logcat -d | grep -q "REFUSED by host allowlist" && pass "F: non-allowlist URL block hua" \
  || fail "F: evil-host deep-link refuse nahi hua"

adb logcat -d > "$ART/logs/logcat-final.txt" 2>/dev/null || true
echo -e "\n\033[1;32mUPDATE-FLOW-E2E: SAARE PROOFS PASS (A–F)\033[0m"
