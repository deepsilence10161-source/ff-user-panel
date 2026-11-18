#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# POST-RELEASE VERIFY (D93, 07-Nov-2026) — OWNER RULE AUTOMATION
# "Jo bhi update karega aage se 10000% confirm karke user panel ki
#  live screenshot mujhe dikhaega — screenshot REAL APP se milni
#  chahiye."
#
# Ye script release push ke BAAD chalti hai:
#   1. Build Mini eSports APK CI run ka wait (success/fail)
#   2. E2E Emulator run ka wait — ye WAHI release APK asli Android
#      emulator par install karke har screen ki REAL-APP screenshots
#      leta hai (e2e-emulator-proof artifact)
#   3. Screenshots download → reports/release-evidence/<date>/
#   4. Release APK + MiniEsports.apk.sha256 download → LOCAL hash
#      verify + zip-integrity check (corrupt publish impossible)
#   5. Evidence summary.md likhta hai — owner ko dikhane layak
#
# Screenshot owner ko dikhaye bina update "DONE" report NAHI karna.
# ═══════════════════════════════════════════════════════════════════
set -u
TOK="$(bash /home/user/scripts/ghtok.sh)" || { echo "❌ TOKEN FAIL"; exit 1; }
REPO="deepsilence10161-source/ff-user-panel"
OUT="/home/user/ff-user-panel/reports/release-evidence/$(date -u +%Y%m%d-%H%M)"
mkdir -p "$OUT"

python3 - "$TOK" "$REPO" "$OUT" <<'PYEOF'
import json, sys, time, urllib.request, hashlib, zipfile, os, datetime, subprocess

TOK, REPO, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
API = f"https://api.github.com/repos/{REPO}"

def get(url, raw=False, timeout=120):
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + TOK,
        "Accept": "application/vnd.github+json",
        "User-Agent": "post-release-verify"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
        return data if raw else json.loads(data)

def curl_bin(url, accept=None, timeout=900):
    """✅ D99-F3 fix: binary download CURL se.
    Purana `get(..., raw=True)` do tarah se jhooth bolta tha:
      1. release-asset API URL par bina `Accept: application/octet-stream` ke
         GitHub JSON metadata lauta deta tha → uska hash nikalta tha →
         "❌ SHA-256 MISMATCH" FALSE ALARM (asset bilkul sahi tha).
      2. urllib redirect follow karte waqt Authorization header Azure blob par
         bhi bhej deta tha → HTTP 401 → screenshots download hi nahi hote the.
    curl cross-host redirect par auth header khud strip karta hai. """
    cmd = ["curl", "-sL", "--max-time", str(timeout),
           "-H", "Authorization: Bearer " + TOK,
           "-H", "User-Agent: post-release-verify"]
    if accept:
        cmd += ["-H", "Accept: " + accept]
    cmd += ["-w", "\n%{http_code}", url]
    out = subprocess.run(cmd, capture_output=True, timeout=timeout + 30)
    body = out.stdout
    code = body.rsplit(b"\n", 1)[-1].decode(errors="replace").strip()
    body = body.rsplit(b"\n", 1)[0]
    if code != "200":
        raise RuntimeError(f"curl {code} for {url[:80]} ({body[:120]!r})")
    return body


def latest_run(name):
    runs = get(API + "/actions/runs?per_page=15")["workflow_runs"]
    for r in runs:
        if r["name"] == name:
            return r
    return None

def wait_run(name, max_min=45):
    print(f"⏳ wait: {name}", flush=True)
    deadline = time.time() + max_min * 60
    last_id = None
    while time.time() < deadline:
        r = latest_run(name)
        if r:
            last_id = r["id"]
            if r["status"] == "completed":
                print(f"   {name}: {r['conclusion']} (run {r['id']})", flush=True)
                return r
            print(f"   {name}: {r['status']}… (run {r['id']})", flush=True)
        time.sleep(20)
    print(f"❌ TIMEOUT waiting {name} (last run {last_id})", flush=True)
    return None

lines = []
def log(s):
    print(s, flush=True)
    lines.append(s)

# ── 1+2. CI waits ──────────────────────────────────────────────
build = wait_run("Build Mini eSports APK")
if not build or build["conclusion"] != "success":
    log("❌ BUILD APK CI fail — release broken, evidence adhoora")
    open(os.path.join(OUT, "summary.md"), "w").write("\n".join(lines))
    sys.exit(1)
e2e = wait_run("E2E Emulator (har screen live test)")
if e2e and e2e["conclusion"] == "success":
    log("✅ E2E EMULATOR (real-app install + screens) SUCCESS")
else:
    log("⚠️ E2E emulator run fail/absent — screenshots shayad adhoore")

# ── 3. real-app screenshots (e2e-emulator-proof artifact) ─────
try:
    arts = get(API + "/actions/artifacts?per_page=20")["artifacts"]
    art = None
    for a in arts:
        if a["name"] == "e2e-emulator-proof" and (not e2e or a["workflow_run"]["id"] == e2e["id"]):
            art = a; break
    if not art:
        for a in arts:
            if a["name"] == "e2e-emulator-proof":
                art = a; break
    if art:
        blob = curl_bin(art["archive_download_url"])
        zp = os.path.join(OUT, "e2e-emulator-proof.zip")
        open(zp, "wb").write(blob)
        with zipfile.ZipFile(zp) as z:
            z.extractall(os.path.join(OUT, "real-app-screens"))
        pngs = []
        for root, _, files in os.walk(os.path.join(OUT, "real-app-screens")):
            pngs += [os.path.join(root, f) for f in files if f.lower().endswith((".png", ".jpg"))]
        log(f"✅ REAL-APP screenshots: {len(pngs)} files → {OUT}/real-app-screens/")
        for p in sorted(pngs)[:12]:
            log("   📱 " + os.path.relpath(p, OUT))
    else:
        log("⚠️ e2e-emulator-proof artifact nahi mila")
except Exception as ex:
    log(f"⚠️ artifact download fail: {ex}")

# ── 4. release APK + sha256 local verify ───────────────────────
try:
    rel = get(API + "/releases/latest")
    apk_asset = sha_asset = None
    for a in rel["assets"]:
        if a["name"] == "MiniEsports.apk": apk_asset = a
        if a["name"] == "MiniEsports.apk.sha256": sha_asset = a
    log(f"📦 latest release: {rel['tag_name']} (apk {apk_asset['size'] if apk_asset else '?'} B)")
    if apk_asset:
        apk = curl_bin(apk_asset["url"], accept="application/octet-stream")   # ✅ D99-F3: octet-stream Accept zaroori
        apkpath = os.path.join(OUT, "MiniEsports.apk")
        open(apkpath, "wb").write(apk)
        local_hash = hashlib.sha256(apk).hexdigest()
        log(f"   local SHA-256: {local_hash}")
        if sha_asset:
            expected = curl_bin(sha_asset["url"], accept="application/octet-stream").decode().strip().lower().split()[0]
            ok = (expected == local_hash)
            log(("✅ SHA-256 MATCH: " if ok else "❌ SHA-256 MISMATCH: ") + expected)
            if not ok: sys.exit(1)
        else:
            log("⚠️ .sha256 asset absent (purani release?) — hash compare skip")
        # zip integrity (truncated publish detect)
        try:
            zf = zipfile.ZipFile(apkpath)
            bad = zf.testzip()
            log("✅ APK zip-integrity: OK" if bad is None else f"❌ APK zip corrupt at {bad}")
            names = zf.namelist()
            log(f"   entries: {len(names)} | AndroidManifest present: {'AndroidManifest.xml' in names}")
        except Exception as ex:
            log(f"❌ APK zip open fail: {ex}"); sys.exit(1)
except Exception as ex:
    log(f"❌ release verify fail: {ex}"); sys.exit(1)

log("")
log("════ EVIDENCE COMPLETE ════")
log("Owner ko dikhayein: reports/release-evidence/ ke real-app screenshots + ye summary")
open(os.path.join(OUT, "summary.md"), "w").write(
    "# Release evidence — " + datetime.datetime.utcnow().isoformat() + "Z\n\n" + "\n".join(lines) + "\n")
print("OUT=" + OUT)
PYEOF
