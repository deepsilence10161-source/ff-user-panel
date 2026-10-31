#!/usr/bin/env python3
"""
tools/push-e2e/push_driver.py — PUSH-E2E WEB DRIVER (FCM LIVE PROOF)
════════════════════════════════════════════════════════════════════
Poori chain ASLI (koi mock nahi):
  browser login (Firebase email/pass QA acct)
  → _bindPushIdentity → messaging.getToken(VAPID) → window._fcmToken
  → push-token edge fn (Firebase idToken RS256 verified) → user_push_tokens row
  → notifications INSERT (Management-API SQL)
  → trg_notifications_push → notifications_push_hook (tokens ke saath)
  → pg_net → push-send edge fn → FCM HTTP v1 (service-account JWT)
  → browser me LIVE receipt (onMessage → _lastPushPayload + toast)

Usage: python3 push_driver.py --run <run> --state <json> --out <json> --shots <dir>
Env:   SUPABASE_ACCESS_TOKEN, USER_URL (optional)
"""
import json
import os
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get("USER_URL", "https://deepsilence10161-source.github.io/ff-user-panel/")
ORIGIN = "/".join(BASE.split("/")[:3])
MGMT = "https://api.supabase.com/v1/projects/hddhkculuyrfoevxmlwy/database/query"
SBT = os.environ.get("SUPABASE_ACCESS_TOKEN") or ""


def sql(q):
    req = urllib.request.Request(
        MGMT, data=json.dumps({"query": q}).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + SBT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


argv = sys.argv[1:]
args = {}
i = 0
while i < len(argv):
    if argv[i].startswith("--"):
        k = argv[i][2:]
        v = argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith("--") else ""
        args[k] = v
        i += 2 if v else 1
    else:
        i += 1
RUN = args.get("run") or ""
STATE = args.get("state") or "/tmp/pe-state.json"
OUT = args.get("out") or "/tmp/pe-web-out.json"
SHOTS = args.get("shots") or "pe-shots"
os.makedirs(SHOTS, exist_ok=True)
if not RUN or not SBT:
    print("❌ --run aur SUPABASE_ACCESS_TOKEN zaroori hain")
    sys.exit(2)

st = json.load(open(STATE))
uid, email, password = st["uid"], st["email"], st["password"]
TITLE = f"PUSHE2E-{RUN}"

results = []


def proof(tag, detail, ok):
    results.append({"tag": tag, "ok": bool(ok), "detail": detail})
    print(("✅ " if ok else "❌ ") + f"{tag}: {detail}", flush=True)


with sync_playwright() as pw:
    HEADED = os.environ.get("PUSH_E2E_HEADED", "1") == "1"   # xvfb + headed default
    if HEADED:
        # fcm2 run ki seekh: Playwright new_context() = INCOGNITO profile,
        # aur Chrome incognito me Push API support hi nahi karta
        # (crbug.com/41124656 → DOMException code 20 "permission denied").
        # Persistent user-data-dir = normal window → push subscribe chalta hai.
        ctx = pw.chromium.launch_persistent_context(
            "/tmp/pe-profile", headless=False,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
            viewport={"width": 430, "height": 932}, locale="en-IN")
        browser = ctx   # close() dono par kaam karta hai
    else:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 430, "height": 932}, locale="en-IN")
    ctx.grant_permissions(["notifications"], origin=ORIGIN)
    page = ctx.new_page()
    page.on("dialog", lambda d: d.accept())
    consoles = []
    page.on("console", lambda m: consoles.append(f"[{m.type}] {m.text[:250]}"))
    page.on("pageerror", lambda e: consoles.append(f"[pageerror] {str(e)[:250]}"))

    def dump_consoles(label, keywords=("fcm", "firebase", "push", "messaging", "service worker", "service-worker", "sw.js", "vapid")):
        rel = [c for c in consoles if any(k in c.lower() for k in keywords)]
        print(f"🔎 {label} — browser console ({len(rel)} relevant / {len(consoles)} total):", flush=True)
        for c in (rel or consoles)[-40:]:
            print("   console|", c, flush=True)

    page.goto(BASE, timeout=120000)
    page.wait_for_function("() => !!window.auth", timeout=90000)

    # ══ PUSH01: live login (asli raasta — premium_driver pattern) ══
    r = page.evaluate("""async (c) => { try { await window.auth.signInWithEmailAndPassword(c.e, c.p); return 'ok'; }
                         catch (e) { return 'err:' + (e.code || e.message); } }""",
                      {"e": email, "p": password})
    if r != "ok":
        proof("PUSH01", f"login fail: {r}", False)
        page.screenshot(path=f"{SHOTS}/push-web-fail-{RUN}.png")
        browser.close()
        json.dump({"run": RUN, "results": results, "pass": False}, open(OUT, "w"), indent=2)
        sys.exit(1)
    page.wait_for_function("() => window.U && window.U.uid && window._supa", timeout=90000)
    got_uid = page.evaluate("() => window.U.uid")
    proof("PUSH01", f"live login OK — uid match={got_uid == uid}", got_uid == uid)

    # ══ PUSH02: FCM web token (VAPID + sw registration + getToken) ══
    try:
        page.wait_for_function("() => !!window._fcmToken", timeout=120000)
        tok_tail = page.evaluate("() => window._fcmToken.slice(-6)")
        proof("PUSH02", f"FCM web token mila (…{tok_tail}) — _bindPushIdentity→getToken live chala", True)
    except Exception as e:
        diag = {}
        try:
            diag = page.evaluate("""() => ({
                stage: window._fcmStage || null, err: window._fcmError || null,
                perm: (typeof Notification !== 'undefined') ? Notification.permission : 'no-Notification',
                hasFirebase: typeof firebase !== 'undefined',
                hasMsgFactory: (typeof firebase !== 'undefined') && !!firebase.messaging,
                windowMessaging: !!window.messaging,
                swController: !!(navigator.serviceWorker && navigator.serviceWorker.controller) })""")
        except Exception as e2:
            diag = {"diagErr": str(e2)[:120]}
        try:
            diag["swRegs"] = page.evaluate("""async () => {
                const rs = await navigator.serviceWorker.getRegistrations();
                return rs.map(r => ({ scope: r.scope, active: !!r.active, waiting: !!r.waiting,
                                      installing: !!r.installing, url: (r.active && r.active.scriptURL) || null })); }""")
        except Exception:
            pass
        print("🔎 PUSH02 DIAG:", json.dumps(diag), flush=True)
        dump_consoles("PUSH02")
        proof("PUSH02", f"120s me window._fcmToken nahi mila — stage={diag.get('stage')} err={diag.get('err')}: {str(e)[:100]}", False)

    # ══ PUSH03: DB row (push-token fn → service_role upsert) ══
    row = 0
    for _ in range(24):
        try:
            d = sql(f"select count(*)::int c from public.user_push_tokens where user_id='{uid}' and platform='web'")
            row = d[0]["c"] if d else 0
        except Exception:
            row = 0
        if row:
            break
        time.sleep(5)
    if not row:
        try:
            print("🔎 PUSH03 _pushTokenLast:", json.dumps(page.evaluate("() => window._pushTokenLast || null"))[:300], flush=True)
        except Exception:
            pass
        dump_consoles("PUSH03")
    proof("PUSH03", f"user_push_tokens web row={row} (edge fn verified-write)", row >= 1)

    # ══ PUSH04: notifications INSERT → hook → pg_net → push-send → FCM ══
    # fcm4-run race fix: sirf APNE insert ke BAAD wale net._http_response
    # padho (android leg ka purana via=fcm response ya koi stale fallback
    # result na ban jaye) — max(id) baseline insert se pehle capture.
    try:
        pre = sql("select coalesce(max(id),0)::bigint m from net._http_response")
        max_id = int(pre[0]["m"]) if pre else 0
    except Exception:
        max_id = 0
    sql(f"insert into public.notifications (user_id, type, title, body, ref_id) "
        f"values ('{uid}', 'e2e_push', '{TITLE}', 'FCM live E2E — web leg', 'pushe2e-{RUN}')")
    via, sent, raw = "", None, ""
    for _ in range(30):
        time.sleep(3)
        try:
            d = sql(f"select content::text c from net._http_response where id > {max_id} order by id desc limit 8")
            for rr in d:
                c = rr.get("c") or ""
                if '"via"' in c:
                    try:
                        j = json.loads(c)
                        via = j.get("via", "?")
                        sent = j.get("sent", j.get("status"))
                    except Exception:
                        via = "fcm" if '"via":"fcm"' in c else "?"
                    raw = c[:200]
                    break
        except Exception:
            pass
        if via:
            break
    fcm_ok = (via == "fcm") and (isinstance(sent, int) and sent >= 1)
    hint = ""
    if via == "onesignal":
        hint = " (FALLBACK chala — FIREBASE_SERVICE_ACCOUNT_JSON Supabase secret missing?)"
    if via == "none":
        hint = " (koi delivery path nahi mila)"
    proof("PUSH04", f"push-send live response via={via} sent={sent}{hint} raw={raw}", fcm_ok)

    # ══ PUSH05: browser me LIVE foreground receipt ══
    try:
        page.wait_for_function(
            "(t) => window._lastPushPayload && window._lastPushPayload.data && window._lastPushPayload.data.title === t",
            arg=TITLE, timeout=90000)
        proof("PUSH05", f"browser me FCM push LIVE receive hua — title '{TITLE}' (onMessage)", True)
    except Exception as e:
        dump_consoles("PUSH05")
        try:
            print("🔎 PUSH05 lastPayload:", json.dumps(page.evaluate("() => window._lastPushPayload || null"))[:300], flush=True)
        except Exception:
            pass
        proof("PUSH05", f"90s me foreground receipt nahi: {str(e)[:150]}", False)

    try:
        page.screenshot(path=f"{SHOTS}/push-web-{RUN}.png")
    except Exception:
        pass
    browser.close()

ok_all = all(x["ok"] for x in results)
json.dump({"run": RUN, "uid": uid, "title": TITLE, "results": results, "pass": ok_all}, open(OUT, "w"), indent=2)
npass = sum(1 for x in results if x["ok"])
print(("🎉 PUSH-WEB E2E PASS " if ok_all else "💥 PUSH-WEB E2E FAIL ") + f"({npass}/{len(results)})", flush=True)
sys.exit(0 if ok_all else 1)
