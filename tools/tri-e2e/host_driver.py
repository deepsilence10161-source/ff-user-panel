#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
#  TRI-E2E host driver — Admin Panel  ←→  User Panel (web)
# ═══════════════════════════════════════════════════════════════════════════
#  Teen surfaces ek hi Supabase (hddhkculuyrfoevxmlwy) + ek hi Firebase
#  (fft-app-1e283) par chalte hain. Ye driver HOST par chalta hai (Playwright
#  + asli Chrome) aur teeno ke beech ke round-trips ko ASLI UI se chalata hai:
#
#    1) APK user  →  Admin Panel   : APK ka support ticket admin ki live list
#                                    me dikhta hai + admin reply karta hai
#    2) Admin     →  User Panel web: match, notification, wallet credit
#    3) User web  →  Admin Panel   : SD deposit request (screenshot + UTR) →
#                                    admin approve (server RPC)
#    4) Admin     →  User web      : approve hone par balance + notification
#    5) Values compare             : web ke values APK ke values se milaaye
#                                    jaate hain (workflow step me)
#
#  Sab QA accounts/data run-id se tagged hote hain aur run ke ant me delete
#  ho jaate hain (qa-accounts.mjs cleanup) — 0 residue.
#
#  Usage:
#    host_driver.py --run <runid> --state <state.json> --out <out.json> \
#                   --shots <dir> [--skip-match] [--wait-apk 480]
# ═══════════════════════════════════════════════════════════════════════════
import argparse, json, os, re, sys, time, pathlib

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

ADMIN_URL = os.environ.get("ADMIN_URL", "https://deepsilence10161-source.github.io/ff-admin-panel/")
USER_URL = os.environ.get("USER_URL", "https://deepsilence10161-source.github.io/ff-user-panel/")

RESULTS = []
VALUES = {}
CUR = "?"


def log(msg):
    print(f"[tri-host] {msg}", flush=True)


def step(name, fn, critical=False):
    t0 = time.time()
    try:
        detail = fn()
        ok = True
        d = detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False)[:300]
    except Exception as e:
        ok, d = False, f"{type(e).__name__}: {str(e)[:260]}"
    RESULTS.append({"step": name, "ok": ok, "detail": d, "secs": round(time.time() - t0, 1)})
    print(f"{'✅' if ok else '❌'} {name} — {d} ({RESULTS[-1]['secs']}s)", flush=True)
    if not ok and critical:
        print("   (critical step — aage badhna bekaar)", flush=True)
        finish(1)
    return ok


def finish(code=0):
    out = {"run": CUR, "results": RESULTS, "values": VALUES,
           "ok": sum(1 for r in RESULTS if r["ok"]), "total": len(RESULTS)}
    path = ARGS.out
    with open(path, "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    log(f"HOST-E2E-RESULT: {out['ok']}/{out['total']} OK → {path}")
    if ARGS.compare_apk and os.path.exists(ARGS.compare_apk):
        try:
            apk = json.load(open(ARGS.compare_apk))
            same, diff = [], []
            for k in apk:
                if k in VALUES:
                    (same if str(apk[k]) == str(VALUES[k]) else diff).append(f"{k}: apk={apk[k]} web={VALUES[k]}")
            log(f"CROSS-SURFACE: {len(same)} match, {len(diff)} mismatch")
            for d in diff:
                log("   ⚠️ " + d)
            out["cross"] = {"match": same, "mismatch": diff}
            json.dump(out, open(path, "w"), indent=1, ensure_ascii=False)
        except Exception as e:
            log("compare fail: " + str(e)[:200])
    sys.exit(code)


# ── polling helper ─────────────────────────────────────────────────────────
def poll(fn, timeout=180, every=4, what="condition"):
    t0 = time.time()
    last = None
    while time.time() - t0 < timeout:
        try:
            r = fn()
            if r:
                return r
            last = r
        except Exception as e:
            last = e
        time.sleep(every)
    raise RuntimeError(f"{what} timeout ({timeout}s) — last={str(last)[:160]}")


def clear_state_gate(page, state="Haryana"):
    """App ke asli compliance gates (js/legal-compliance.js) ko ASLI UI wale
    raaste se clear karta hai — koi shortcut nahi:
      1. State Verification → window.mesStateOk (wahi function jo asli button
         ka onclick chalata hai; DB me users.state save hota hai)
      2. 18+ Age Gate      → #_mes_dob me dob bhar kar asli Confirm button
         (mesConfirmAge → server RPC submit_age_verification)
      3. T&C Gate          → dono checkbox + asli mesAcceptTC (server RPC accept_terms)
    Warna ye gates modals ke UPAR reh jaate hain aur cosmetics store jaise
    flow block ho jaate hain (TRI 38540317554/38545748414 me H6d isi se fail)."""
    out = []
    try:
        r = page.evaluate("""async (s) => {
            if (window.UD && window.UD.state) return 'already';
            if (typeof window.mesStateOk !== 'function') return 'no-gate';
            try { window.mesStateOk(s); } catch (e) { return 'err'; }
            return 'set'; }""", state)
        out.append("state:" + r)
        if r == "set":
            try:
                page.wait_for_function("(s) => (window.UD && window.UD.state) === s", arg=state, timeout=20000)
            except Exception:
                out[-1] = "state:set-save-pending"
    except Exception as e:
        out.append("state:skip:" + str(e)[:60])

    # age gate state ke 400ms baad khulta hai (legal-compliance.js)
    try:
        page.wait_for_timeout(900)
        r2 = page.evaluate("""async () => {
            if (window.UD && window.UD.age_verified) return 'already';
            const inp = document.getElementById('_mes_dob');
            if (!inp) return 'no-gate';
            inp.value = '2000-01-01';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            const btn = Array.from(document.querySelectorAll('button'))
              .find(b => (b.getAttribute('onclick') || '').indexOf('mesConfirmAge') !== -1);
            if (!btn) return 'no-btn';
            btn.click();
            return 'clicked'; }""")
        out.append("age:" + r2)
        if r2 == "clicked":
            try:
                page.wait_for_function("() => window.UD && window.UD.age_verified === true", timeout=25000)
            except Exception:
                out[-1] = "age:verify-pending"
    except Exception as e:
        out.append("age:skip:" + str(e)[:60])

    # 3b. First-login onboarding tour (features-user.js checkShowTutorial) —
    #     slide 3 ke hisaab se poora overlay modals ke upar aa jata hai
    #     (TRI 38551529009 me "Welcome to Mini eSports!" ne store dhak diya).
    #     Pehle wahi keys set karte hain jo app TOUR poora hone par khud lagata
    #     hai (tutorialSeen/tutorialSeen_<uid> — dobara na khule), aur agar
    #     khula hua mile to ASLI buttons (Next → / Let's Play!) se poora.
    try:
        page.evaluate("""() => { try {
            localStorage.setItem('tutorialSeen', '1');
            if (window.U && window.U.uid) localStorage.setItem('tutorialSeen_' + window.U.uid, '1');
        } catch (e) {} }""")
        r4 = 'no-tour'
        for _ in range(8):
            r4 = page.evaluate("""() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const d = btns.find(b => ((b.getAttribute('onclick') || '').indexOf('_tutDone') !== -1));
                if (d) { d.click(); return 'done'; }
                const n = btns.find(b => ((b.getAttribute('onclick') || '').indexOf('_tutNext') !== -1));
                if (n) { n.click(); return 'next'; }
                return 'no-tour'; }""")
            if r4 == 'no-tour':
                break
            page.wait_for_timeout(400)
        out.append("tour:" + r4)
    except Exception as e:
        out.append("tour:skip:" + str(e)[:60])

    # 3. T&C gate (age ke baad: _runNext('age') → accepted_policy)
    try:
        r3 = page.evaluate("""async () => {
            if (window.UD && window.UD.accepted_policy) return 'already';
            const c1 = document.getElementById('_mes_tc1'), c2 = document.getElementById('_mes_tc2');
            if (!c1 || !c2) return 'no-gate';
            c1.checked = true; c2.checked = true;
            c1.dispatchEvent(new Event('change', { bubbles: true }));
            c2.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof window.mesAcceptTC !== 'function') return 'no-fn';
            window.mesAcceptTC((window.U || {}).uid);
            return 'accepted'; }""")
        out.append("tc:" + r3)
        if r3 == "accepted":
            try:
                page.wait_for_function("() => window.UD && window.UD.accepted_policy === true", timeout=25000)
            except Exception:
                out[-1] = "tc:save-pending"
    except Exception as e:
        out.append("tc:skip:" + str(e)[:60])

    # 4. referral popup (naye user ko login ke ~1.8s baad: "Kisi ka Referral
    #    Code hai?" — z-index 99980, poora full-screen overlay; iske upar
    #    koi bhi click (jaise store ka Buy) block ho jata hai). Asli UI ka
    #    "Skip — Code nahi hai" dabate hain, warna H6d jaisa live step
    #    bekaar me timeout karta hai.
    ref = "no-popup"
    try:
        for _ in range(10):
            ref = page.evaluate("""() => {
                const ov = document.getElementById('_refCodePopup');
                if (ov) {
                    const s = Array.from(ov.querySelectorAll('button'))
                        .find(b => /Skip/i.test(b.innerText || ''));
                    if (s) { s.click(); return 'skipped'; }
                    ov.remove(); return 'removed';
                }
                return (window.UD && window.UD.referralPopupDone) ? 'already' : 'wait'; }""")
            if ref != "wait":
                break
            page.wait_for_timeout(600)
    except Exception as e:
        ref = "skip:" + str(e)[:50]
    out.append("ref:" + ref)
    return " | ".join(out)


def shot(page, name):
    try:
        pathlib.Path(ARGS.shots).mkdir(parents=True, exist_ok=True)
        page.screenshot(path=os.path.join(ARGS.shots, name))
    except Exception as e:
        log("shot fail: " + str(e)[:120])


# ═══════════════════════════════════════════════════════════════════════════
def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        actx = browser.new_context(viewport={"width": 1440, "height": 950})
        admin = actx.new_page()
        admin.on("pageerror", lambda e: log(f"   [admin pageerror] {str(e)[:150]}"))

        # ── H1: admin panel login (asli form) ─────────────────────────────
        def h1():
            admin.goto(ADMIN_URL, timeout=120000)
            admin.wait_for_selector("#loginEmail", timeout=60000)
            admin.fill("#loginEmail", ST["admin"]["email"])
            admin.fill("#loginPassword", ST["admin"]["password"])
            admin.click("#loginBtn")
            admin.wait_for_selector("#mainApp", state="visible", timeout=120000)
            admin.wait_for_function("() => !!window._supa && !!window.rtdb", timeout=60000)
            # ✅ asli suraksha-check jo naye device par aata hai: "New Device
            # Detected" — admin email likhkar Trust This Device (warna poora
            # panel click-block rehta hai; pehli baar yahi trap hua tha).
            admin.wait_for_timeout(2500)
            if admin.locator("#v21-device-verify").count():
                admin.fill("#v21DeviceVerifyEmail", ST["admin"]["email"])
                admin.click("#v21TrustBtn")
                admin.wait_for_selector("#v21-device-verify", state="detached", timeout=30000)
                trust = "device trust bhi kiya"
            else:
                trust = "device pehle se trusted"
            shot(admin, "h1-admin-panel.png")
            return f"panel khula — {ST['admin']['email']} (admins row + is_admin gate pass; {trust})"

        step("H1 admin panel login (QA admin)", h1, critical=True)

        # ── H2: APK ka ticket admin ki live list me ───────────────────────
        def h2():
            wait = ARGS.wait_apk
            def ticket_in_db():
                r = admin.evaluate(
                    """async (o) => {
                         const { data } = await window._supa.from('support_tickets')
                           .select('id,subject,message,user_id,status,admin_reply,user_ign')
                           .eq('user_id', o.uid).like('message', '%' + o.mark + '%')
                           .order('created_at',{ascending:false}).limit(3);
                         return data && data.length ? data[0] : null; }""",
                    {"uid": ST["player"]["uid"],
                     "mark": ST["markers"].get("ticketMarker") or ST["markers"]["ticketSubject"].split("—")[0].strip()})
                return r
            tk = poll(ticket_in_db, timeout=wait, every=5, what="APK ka support ticket DB me")
            TICKET["row"] = tk

            # ⚠️ 2026-10-13 (TRI 38362119910/38365319525 me H2 fail hone ke baad
            # pakda gaya): admin list (js/admin-inline-d.js) chat-list hai —
            # row par IGN dikhta hai (user_ign = submit ke waqt ka IGN), uid
            # SIRF tab jab IGN khaali ho. Purana check sirf uid[:6] dhoondhta
            # tha (aur "QA-TRI" — jo asli marker "QA-TEST TRI <run>" me kabhi
            # nahi hota), isliye IGN set hone par ticket dikhte hue bhi FAIL.
            # Ab: har round list DOBARA load (ticket baad me aaye to bhi mile)
            # + marker/uid/ign/id sab par match + fail par asli list text.
            mark = (ST["markers"].get("ticketMarker") or "").strip()
            keys = [k for k in [mark, (tk.get("user_id") or "")[:6], (tk.get("id") or "")[:8],
                                (tk.get("user_ign") or "").strip()] if k]

            def _list_seen():
                try:
                    admin.evaluate("() => window.loadSupportTickets && loadSupportTickets('open')")
                except Exception:
                    pass
                txt = admin.inner_text("#supportTicketsList") or ""
                hit = next((k for k in keys if k in txt), None)
                return {"txt": txt, "hit": hit} if hit else None

            try:
                seen = poll(_list_seen, timeout=120, every=4, what="admin list render")
            except Exception as e:
                shot(admin, "h2-admin-list-FAIL.png")
                try:
                    tail = (admin.inner_text("#supportTicketsList") or "")[:200].replace("\n", " ")
                except Exception:
                    tail = "(list nahi padhi ja saki)"
                raise RuntimeError(f"{e} — list text: {tail!r}")
            txt = seen["txt"]
            shot(admin, "h2-admin-sees-apk-ticket.png")
            return (f"APK ticket #{tk['id'][:8]} admin list me dikha — match '{seen['hit']}' "
                    f"(uid {tk['user_id'][:8]}) — list text len {len(txt)}")

        step("H2 APK → Admin: ticket admin panel me", h2, critical=True)

        # ── H3: admin reply (asli thread UI se) ───────────────────────────
        def h3():
            tk = TICKET["row"]
            # ASLI UI ka wahi raasta (nav item ke onclick me yahi functions hain —
            # headless me element overlay/scroll ki wajah se click flaky tha):
            admin.evaluate("() => { showSection('support'); if (window.switchSupportSubView) switchSupportSubView('tickets'); }")
            admin.wait_for_timeout(1500)
            admin.evaluate("() => window.loadSupportTickets && loadSupportTickets('open')")
            # ⚠️ index 0 bhi valid hai — isliye dict return (0 falsy hone ka trap)
            idx = poll(lambda: (lambda i: {"i": i} if i is not None and i >= 0 else None)(
                admin.evaluate(
                    """(uid) => { const c=window._supportTicketsCache||[]; return c.findIndex(t=>t.uid===uid); }""",
                    tk["user_id"])), timeout=120, every=4, what="admin cache me player thread")["i"]
            # us thread ki row par asli click
            admin.evaluate("""(i) => { const rows=[...document.querySelectorAll('#supportTicketsList div[onclick^=\"_openSupportThread\"]')];
                                  if(rows[i]) rows[i].click(); else _openSupportThread(i); }""", idx)
            key = admin.evaluate("(i) => window._supportTicketsCache[i].msgs.slice(-1)[0]._key", idx)
            box = f"#ticketReplyBox_{key}"
            admin.wait_for_selector(box, timeout=30000)
            admin.fill(box, ST["markers"]["ticketReply"])
            admin.click(f'button[onclick*="replyTicket(null,\'{key}\'"]')
            r = poll(lambda: admin.evaluate(
                """async (id) => { const {data}=await window._supa.from('support_tickets')
                     .select('admin_reply,status').eq('id',id).maybeSingle(); return (data&&data.admin_reply)?data:null; }""",
                tk["id"]), timeout=90, every=3, what="admin_reply DB me")
            shot(admin, "h3-admin-replied.png")
            return f"reply DB me set: {r['admin_reply'][:40]}… status={r.get('status')}"

        step("H3 Admin → (DB) ticket reply", h3)

        # ── H4: admin match banata hai (panel ke bridge se, wahi RLS path) ─
        def h4():
            if ARGS.skip_match:
                return "skip"
            title = ST["markers"]["matchTitle"]
            res = admin.evaluate(
                """async (m) => {
                     const id = (window.rtdb && window.rtdb.ref) ? (await window.rtdb.ref('matches').push(m)).key : null;
                     if (!id) return { error: 'bridge push fail' };
                     await new Promise(r => setTimeout(r, 2500));
                     const { data, error } = await window._supa.from('matches')
                        .select('id,title,status,entry_fee,max_slots').ilike('title', m.title).limit(1);
                     return { key: id, row: (data||[])[0] || null, err: error ? error.message : null };
                   }""",
                {"title": title, "status": "upcoming", "mode": "solo", "entry_fee": 0, "entry_type": "free",
                 "max_slots": 12, "map": "Bermuda", "scheduled_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 3600)) + ".000Z",
                 "prize_pool": 0, "data": {"tri": CUR}})
            if res.get("error") or not res.get("row"):
                raise RuntimeError("match insert/verify fail: " + json.dumps(res)[:200])
            MATCH["row"] = res["row"]
            shot(admin, "h4-admin-match-created.png")
            return f"match #{res['row']['id'][:8]} '{title[:28]}' Supabase me"

        step("H4 Admin match banata hai (Supabase rows)", h4)

        # ── H5: admin targeted notification ───────────────────────────────
        def h5():
            r = admin.evaluate(
                """async (o) => {
                     const { data, error } = await window._supa.from('notifications')
                       .insert({ user_id: o.uid, type: 'e2e', title: o.title, body: o.body, is_read: false })
                       .select('id').maybeSingle();
                     return { row: data, err: error ? error.message : null }; }""",
                {"uid": ST["player"]["uid"], "title": ST["markers"]["notifTitle"], "body": ST["markers"]["notifBody"]})
            if r.get("err"):
                raise RuntimeError("notif insert: " + r["err"])
            NOTIF["row"] = r.get("row")
            return f"notification insert ok ({str(r.get('row'))[:40]})"

        step("H5 Admin → user notification (DB row)", h5)

        # ── H6: user panel web — QA player login ──────────────────────────
        uctx = browser.new_context(viewport={"width": 412, "height": 915})
        user = uctx.new_page()
        user.on("pageerror", lambda e: log(f"   [user pageerror] {str(e)[:150]}"))

        def h6():
            user.goto(USER_URL, timeout=120000)
            user.wait_for_function("() => !!window.auth", timeout=90000)
            r = user.evaluate(
                """async (c) => { try { await window.auth.signInWithEmailAndPassword(c.e, c.p); return 'ok'; }
                                  catch (e) { return 'err:' + (e.code || e.message); } }""",
                {"e": ST["player"]["email"], "p": ST["player"]["password"]})
            if r != "ok":
                raise RuntimeError("firebase signin: " + str(r))
            user.wait_for_function("() => window.U && window.U.uid && window.UD", timeout=90000)
            # Supabase client ko Firebase token async milta hai; us se pehle ki
            # koi write RLS se reject hoti hai (policy: auth.jwt()->>'sub'=uid)
            user.wait_for_function("() => window._supaTokenUid === window.U.uid", timeout=90000)
            uid = user.evaluate("() => window.U.uid")
            if uid != ST["player"]["uid"]:
                raise RuntimeError(f"wrong uid logged in: {uid}")
            gate = clear_state_gate(user)
            shot(user, "h6-user-web-login.png")
            return f"user web login OK (uid {uid[:8]}) — state gate: {gate}"

        step("H6 User Panel web login (QA player)", h6, critical=True)

        # ── H6b: Admin → user: PREMIUM grant (approve_premium RPC) ─────────
        #  Asli admin RPC (wahi jo premium request approve karne par chalta
        #  hai). Iske baad: (a) users row par premium_level, (b) leaderboard
        #  row par bhi (naya trigger) — yani DOOSRE players ko ribbon dikhega.
        PREMIUM = {}

        def h6b():
            res = admin.evaluate("""async (o) => {
                const { data, error } = await window._supa.rpc('approve_premium',
                  { p_uid: o.uid, p_tier: 1, p_days: 30, p_grant_bp: false });
                return { data, err: error ? error.message : null }; }""",
                {"uid": ST["player"]["uid"]})
            if res.get("err") or not (res.get("data") or {}).get("success"):
                raise RuntimeError("approve_premium fail: " + json.dumps(res)[:200])
            PREMIUM["rpc"] = res["data"]

            def _row():
                return admin.evaluate("""async (o) => {
                    const { data: u } = await window._supa.from('users')
                      .select('premium_level,premium_expires').eq('id', o.uid).maybeSingle();
                    const { data: l } = await window._supa.from('leaderboard')
                      .select('premium_level,premium_expires').eq('id', o.uid).maybeSingle();
                    if (u && Number(u.premium_level) > 0 && l && Number(l.premium_level) > 0) return { u, l };
                    return null; }""", {"uid": ST["player"]["uid"]})

            row = poll(_row, timeout=90, every=4, what="premium users + leaderboard row")
            shot(admin, "h6b-admin-premium-granted.png")
            return (f"admin ne premium diya (tier 1, 30 din, RPC={json.dumps(PREMIUM['rpc'])[:60]}) — "
                    f"users.premium_level={row['u']['premium_level']}, leaderboard.premium_level={row['l']['premium_level']} (doosron ko dikhega)")

        step("H6b Admin → user: premium grant (approve_premium)", h6b, critical=True)

        # ── H6c: aakhri 12 ghante ka countdown banner (live DB → user UI) ──
        #  Admin panel se premium_expires badalte hain (RLS: is_caller_admin()
        #  wahi raasta jo panel use karta hai) aur USER ki asli UI par dekhte
        #  hain: (1) 6 ghante bache → banner + chalta hua countdown,
        #  (2) 30 ghante bache → banner GAYAB (12h window ke bahar — jhoota
        #  countdown kabhi nahi), (3) wapas 6 ghante → banner phir aa jaye.
        #  Ant me 6 ghante hi chhodte hain (APK step 12 isi par check karta hai).
        BANNER = {}

        def h6c():
            def set_exp(hours):
                return admin.evaluate("""async (o) => {
                    const iso = new Date(Date.now() + o.h * 3600 * 1000).toISOString();
                    const { data, error } = await window._supa.from('users')
                      .update({ premium_expires: iso }).eq('id', o.uid)
                      .select('premium_level,premium_expires');
                    if (error) return { err: error.message };
                    const { data: lb } = await window._supa.from('leaderboard')
                      .select('premium_level,premium_expires').eq('id', o.uid).maybeSingle();
                    return { data, lb }; }""", {"uid": ST["player"]["uid"], "h": hours})

            def reload_user():
                user.reload(wait_until="domcontentloaded")
                user.wait_for_function("() => window.U && window.U.uid && window.UD", timeout=90000)
                user.wait_for_function("() => window._supaTokenUid === window.U.uid", timeout=90000)

            def banner_state():
                return user.evaluate("""() => {
                    const el = document.getElementById('premExpiryBanner');
                    const cnt = document.getElementById('premExpiryCount');
                    const ud = (window.UD && window.UD.premium && window.UD.premium.expiresAt) || 0;
                    return { has: !!el, ms: el ? Number(el.getAttribute('data-ms-left') || 0) : null,
                             txt: (cnt && cnt.textContent) || '',
                             cta: el ? !!el.querySelector('button') : false,
                             udExp: Number(ud) || 0 }; }""")

            won = []
            # (1) 6 ghante bache → banner
            r1 = set_exp(6)
            if r1.get("err"):
                raise RuntimeError("expiry set fail: " + r1["err"])
            reload_user()

            def _due():
                b = banner_state()
                if b["has"] and b["ms"] and b["ms"] <= 12 * 3600 * 1000:
                    return b
                # UI ko apna state check karne ka mauka (asli function)
                user.evaluate("() => { if (window.checkTrialState) window.checkTrialState(); }")
                return None

            b1 = poll(_due, timeout=120, every=4, what="6h bache par countdown banner")
            BANNER["pos"] = b1
            VALUES["premium_banner"] = "app-banner"
            VALUES["premium_expires_ms"] = str(b1["ms"])
            shot(user, "h6c-user-web-countdown-banner.png")
            won.append(f"6h → banner (data-ms-left={b1['ms']}, '{b1['txt']}', CTA={b1['cta']})")
            if not re.match(r"^\d\d:\d\d:\d\d$", str(b1.get("txt") or "")):
                raise RuntimeError("countdown format galat: " + str(b1.get("txt")))
            if not b1.get("cta"):
                raise RuntimeError("banner par continue/CTA button nahi mila")
            if not (b1.get("udExp") or 0) > time.time() * 1000:
                raise RuntimeError("UD.premium.expiresAt future me nahi (DB se aaya hi nahi)")

            # countdown apne aap chalta hai? (2.2s baad wahi text nahi hona chahiye)
            t0 = b1["txt"]
            time.sleep(2.4)
            b1b = banner_state()
            if not b1b["has"] or b1b["txt"] == t0:
                raise RuntimeError(f"countdown chal nahi raha ({t0} → {b1b['txt']})")
            won.append(f"live tick {t0} → {b1b['txt']}")

            # (2) 30 ghante bache → banner nahi
            set_exp(30)
            reload_user()
            time.sleep(3)
            user.evaluate("() => { if (window.checkTrialState) window.checkTrialState(); }")
            time.sleep(1.5)
            b2 = banner_state()
            if b2["has"]:
                raise RuntimeError("30 ghante bache hone par bhi banner dikh raha (jhoota countdown)")
            won.append("30h → banner gayab ✔")
            if b2["udExp"] <= time.time() * 1000:
                raise RuntimeError("30h par bhi UD.premium.expiresAt purana hi reh gaya")

            # (3) wapas 6 ghante → banner phir aa jaye (aur APK ke liye yahi chhodo)
            set_exp(6)
            reload_user()

            def _back():
                b = banner_state()
                if b["has"]:
                    return b
                user.evaluate("() => { if (window.checkTrialState) window.checkTrialState(); }")
                return None

            b3 = poll(_back, timeout=120, every=4, what="wapas 6h par banner")
            shot(user, "h6c-user-web-banner-back.png")
            won.append(f"wapas 6h → banner aa gaya ('{b3['txt']}')")

            # leaderboard bhi update hua? (trigger premium_expires ko bhi sync karta hai)
            lb = (r1.get("lb") or {})
            lbexp = lb.get("premium_expires")
            lbnote = "leaderboard.premium_expires " + ("sync hua" if lbexp else "khali (chhoti expiry par bhi row update)")
            return " | ".join(won) + " | " + lbnote

        step("H6c Admin → user: aakhri 12 ghante ka countdown banner (live)", h6c, critical=True)

        # ── H6d: admin SD deta hai → user asli cosmetics store se RING kharidta
        #        hai (purchase_cosmetic RPC, server price) → equip → profile
        #        par medal art. Ye naye 9 avatar-ring cosmetics ka live proof
        #        hai (master plan 3.5) — paisa/currency asli me katta hai.
        RING = {"key": "frame_ring_gold", "price": 100, "art": "assets/img/ranks/gold.png"}

        def h6d():
            # 1) admin: sky diamonds credit (asli admin RPC — wallet adjust)
            cr = admin.evaluate("""async (o) => {
                const { data, error } = await window._supa.rpc('admin_adjust_wallet',
                  { p_uid: o.uid, p_col: 'sky_diamonds', p_amount: o.amt, p_reason: 'TRI E2E avatar-ring test' });
                return { data, err: error ? error.message : null }; }""",
                {"uid": ST["player"]["uid"], "amt": 300})
            if cr.get("err") or not (cr.get("data") or {}).get("success"):
                raise RuntimeError("SD credit fail: " + json.dumps(cr)[:200])

            # 2) user: balance aaye (DB se) → store kholo
            user.reload(wait_until="domcontentloaded")
            user.wait_for_function("() => window.U && window.U.uid && window.UD", timeout=90000)
            user.wait_for_function("() => Number(window.UD.skyDiamonds||0) >= 100", timeout=90000)
            clear_state_gate(user)      # reload ke baad gate dobara aa sakta hai
            sd_before = user.evaluate("() => Number(window.UD.skyDiamonds||0)")
            user.evaluate("() => { if (window.showCosmeticsStore) showCosmeticsStore(); }")
            user.wait_for_timeout(2000)
            shot(user, "h6d-store-rings.png")

            # 3) asli UI button click (confirm() accept karke) — frame_ring_gold
            user.on("dialog", lambda d: d.accept())
            btn = user.query_selector("button[onclick*=\"buyCosmetic('frame_ring_gold'\"]")
            if not btn:
                # frames tab par switch karke dobara dekho (store default 'all' kholta hai)
                user.evaluate("() => { if (window.renderCosmeticsStore) {} }")
                try:
                    user.click("text=Frames", timeout=6000)
                except Exception:
                    pass
                user.wait_for_timeout(1200)
                btn = user.query_selector("button[onclick*=\"buyCosmetic('frame_ring_gold'\"]")
            if not btn:
                raise RuntimeError("store me frame_ring_gold ka buy button nahi mila")
            btn.click()

            # 2026-10-14 (root cause of TRI 38557658545 ka H6d timeout):
            # app me ab NATIVE confirm() nahi hai — core/app-dialog.js (B3,
            # 2026-10-06) ne window.confirm ko shim kar diya hai: wo turant
            # `false` return karta hai aur asli sawaal app ki apni UI
            # (#_appDlgOv) me kholta hai. "Haan, karo" dabaane par wahi
            # button (replay) dobara chalta hai aur tab purchase RPC jaata
            # hai. Pehle yahan sirf `page.on('dialog')` tha, jo ab kabhi
            # fire nahi hota → click ke baad purchase ruk jaata tha aur
            # 60s poll "DB row + balance debit timeout" deta tha.
            # Ab bilkul asli user jaisa: #_appDlgOk ("Haan, karo") dabao.
            user.on("dialog", lambda d: d.accept())   # safety (agar kahin native bacha ho)
            dlg_txt = ""
            try:
                user.wait_for_selector("#_appDlgOv.show", timeout=15000)
                dlg_txt = (user.inner_text("#_appDlgMsg") or "").strip().replace("\n", " ")
                user.click("#_appDlgOk", timeout=8000)
            except Exception as e:
                raise RuntimeError("purchase ka app-UI confirm dialog nahi mila: " + str(e)[:160])
            if RING["key"] not in dlg_txt and "kharidna" not in dlg_txt:
                raise RuntimeError("confirm dialog ka text galat: " + dlg_txt[:120])
            time.sleep(3)

            # 4) DB se verify: user_cosmetics row + balance kata
            def _bought():
                r = user.evaluate("""async (o) => {
                    const { data: c } = await window._supa.from('user_cosmetics')
                       .select('cosmetic_key').eq('user_id', o.uid).eq('cosmetic_key', o.key);
                    const { data: u } = await window._supa.from('users')
                       .select('sky_diamonds').eq('id', o.uid).maybeSingle();
                    return { rows: (c||[]).length, sd: u ? Number(u.sky_diamonds) : null }; }""",
                    {"uid": ST["player"]["uid"], "key": RING["key"]})
                return r if (r["rows"] == 1 and r["sd"] == sd_before - RING["price"]) else None

            bought = poll(_bought, timeout=60, every=4, what="ring purchase (DB row + balance debit)")
            shot(user, "h6d-ring-bought.png")

            # 5) equip → profile par medal — 2026-10-14: dono taraf ASLI UI.
            #    (a) store ke 'Apply' button par asli click (purchase ke baad
            #        store khud re-render hota hai → us item ka button "Apply"
            #        ban jata hai = toggleCosmeticEquip).
            apply_btn = None
            for _ in range(20):
                apply_btn = user.query_selector(
                    "button[onclick*=\"toggleCosmeticEquip('" + RING["key"] + "'\"]")
                if apply_btn:
                    break
                user.wait_for_timeout(800)
            if not apply_btn:
                raise RuntimeError("store me ring ka 'Apply' button nahi mila")
            apply_btn.click()
            time.sleep(2)

            #    (b) DB se sach: is_equipped = true
            def _equipped():
                return user.evaluate("""async (o) => {
                    const { data } = await window._supa.from('user_cosmetics')
                      .select('is_equipped').eq('user_id', o.uid)
                      .eq('cosmetic_key', o.key).maybeSingle();
                    return (data && data.is_equipped === true) ? 'ok' : null; }""",
                    {"uid": ST["player"]["uid"], "key": RING["key"]})
            poll(_equipped, timeout=60, every=4, what="ring ka is_equipped=true (DB)")

            #    (c) modal band → ASLI profile tab tap. ⚠️ Pehle yahan
            #        showScreen('profile') bulaya ja raha tha — aisa koi
            #        function app me hi nahi hai (asli router core/router.js
            #        me navTo hai), is liye profile screen khulti hi nahi thi
            #        aur medal art ka 90s timeout aata tha (TRI 38564900102).
            user.evaluate("() => { if (window.closeModal) closeModal(); }")
            user.wait_for_timeout(800)
            try:
                user.click('.nav-item[data-nav="profile"]', timeout=10000)
            except Exception:
                user.evaluate("() => { if (window.navTo) navTo('profile'); }")
            user.wait_for_timeout(2500)

            def _medal():
                try:
                    return user.evaluate("""() => {
                        const el = document.querySelector('img.pf2-ring-art');
                        if (!el || !el.offsetWidth) return null;   /* sirf asli dikhta hua art */
                        return { src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '',
                                 w: el.offsetWidth, h: el.offsetHeight }; }""")
                except Exception:
                    return None

            med = poll(_medal, timeout=90, every=4, what="profile par equipped ring ka medal art")
            if RING["art"] not in (med.get("src") or "") or (med.get("w") or 0) < 20:
                raise RuntimeError("medal art galat/chhupa hua: " + json.dumps(med)[:160])
            shot(user, "h6d-profile-ring-medal.png")
            VALUES["cosmetic_ring"] = RING["key"]
            VALUES["ring_medal"] = "profile-medal"
            VALUES["purchase_dialog"] = dlg_txt[:70]
            VALUES["ring_equipped"] = "user_cosmetics.is_equipped=true (Apply button se)"
            return (f"admin ne 300 SD diya → user ne store se '{RING['key']}' kharida "
                    f"(SD {sd_before} → {bought['sd']}, user_cosmetics row ✔; confirm app-UI: '{dlg_txt[:46]}') "
                    f"→ store ke 'Apply' se equip (DB is_equipped=true ✔) → asli profile tab "
                    f"(navTo) par medal art "
                    f"({med['src'].split('/')[-1]}) ✔")

        step("H6d Admin SD → user rings kharidta + equip karta hai (live store)", h6d, critical=True)

        # ── H7: user web ko admin ka data dikhta hai ──────────────────────
        def h7():
            seen = {}
            # ⚠️ 2026-10-14 (TRI 38569273537 me yahi 150s timeout hua): H6d ke
            # baad user page ASLI PROFILE tab par reh jata hai (wahan
            # navTo('profile') hua tha). Home screen (#scrHome) tabhi dikhta
            # hai jab wo .active ho — warna document.body.innerText se poori
            # tarah bahar rehta hai, is liye match ka title kabhi nahi milta.
            # Ab pehle asli home tab par (jaise user karta hai), phir data.
            user.evaluate("() => { if (window.navTo) navTo('home'); if (window.renderHome) renderHome(); }")
            user.wait_for_timeout(1500)
            user.evaluate("() => { if (window._loadMatches) window._loadMatches(); if (window._loadNotifs) window._loadNotifs(); }")
            # match — pehle home screen par (asli card), warna poore body par
            title = ST["markers"]["matchTitle"]
            def match_visible():
                return user.evaluate(
                    """(t) => {
                         const scr = document.getElementById('scrHome');
                         if (scr && (scr.innerText || '').includes(t)) return { where: 'home-card' };
                         const mt = Object.keys(window.MT || {}).some(k => ((window.MT[k].name || window.MT[k].title || '') === t));
                         if (mt) return { where: 'MT-data' };
                         return document.body.innerText.includes(t) ? { where: 'body' } : null; }""", title)
            poll(match_visible, timeout=150, every=5, what="user web par admin ka match")
            seen["match"] = True
            # notification
            def notif_seen():
                return user.evaluate(
                    """(t) => (window.NOTIFS || []).some(n => (n.title || '') === t)
                              || document.body.innerText.includes(t);""", ST["markers"]["notifTitle"])
            poll(notif_seen, timeout=150, every=5, what="user web par notification")
            seen["notif"] = True
            # ticket reply — pehle DB me confirm, PHIR modal kholo (modal
            # ek baar render hota hai, isliye stale render par atak na jaayein)
            poll(lambda: user.evaluate(
                """async (id) => { const {data}=await window._supa.from('support_tickets')
                     .select('admin_reply').eq('id',id).maybeSingle();
                     return (data && data.admin_reply) ? true : null; }""", TICKET["row"]["id"]),
                timeout=150, every=5, what="ticket reply DB me")
            repaid = False
            for _ in range(20):
                user.evaluate("() => { if (window.closeModal) closeModal(); }")
                user.wait_for_timeout(400)
                user.evaluate("() => window.showMyTickets && showMyTickets()")
                user.wait_for_timeout(2500)
                if ST["markers"]["ticketReply"][:30] in user.inner_text("body"):
                    repaid = True
                    break
            if not repaid:
                raise RuntimeError("My-Tickets modal me reply render nahi hua")
            seen["reply"] = True
            shot(user, "h7-user-web-sees-admin.png")
            return json.dumps(seen)

        step("H7 Admin → User web (match + notif + reply)", h7, critical=True)

        # ── H7b: DOOSRA player (user web) wahi match join karta hai ────────
        #  Yeh user ↔ user flow hai: P1 (APK) pehle join karta hai, P2 (web)
        #  baad me — aur dono admin panel ke Joined Players me dikhne chahiye.
        p2ctx = browser.new_context(viewport={"width": 412, "height": 915})
        p2 = p2ctx.new_page()
        p2.on("pageerror", lambda e: log(f"   [p2 pageerror] {str(e)[:150]}"))

        def h7b():
            if "player2" not in ST:
                raise RuntimeError("state me player2 nahi — qa-accounts.mjs dobara chalao")
            p2.goto(USER_URL, timeout=120000)
            p2.wait_for_function("() => !!window.auth", timeout=90000)
            r = p2.evaluate(
                """async (c) => { try { await window.auth.signInWithEmailAndPassword(c.e, c.p); return 'ok'; }
                                  catch (e) { return 'err:' + (e.code || e.message); } }""",
                {"e": ST["player2"]["email"], "p": ST["player2"]["password"]})
            if r != "ok":
                raise RuntimeError("P2 firebase signin: " + str(r))
            p2.wait_for_function("() => window.U && window.U.uid && window._supa", timeout=90000)
            # 2026-10-14: P2 ke liye bhi wahi parde hatate hain (first-login
            # tour + referral popup) — asli UI se, bilkul P1 jaisa. Warna H13
            # ke asli clicks P2 ke overlay ke neeche chhup jaate hain.
            clear_state_gate(p2)
            mid = MATCH["row"]["id"]
            p2.evaluate("() => { if (window._loadMatches) window._loadMatches(); }")
            p2.wait_for_timeout(2500)
            shot(p2, "h7b-p2-login.png")
            p2.evaluate("(id) => { if (window.doJoin) doJoin(id); }", mid)

            def _row():
                return p2.evaluate(
                    """async (id) => { const {data} = await window._supa.from('join_requests')
                         .select('id,status').eq('match_id', id).eq('user_id', window.U.uid);
                         return (data||[])[0] || null; }""", mid)

            via = "doJoin (asli UI path)"
            try:
                row = poll(_row, timeout=60, every=4, what="P2 join (doJoin)")
            except Exception:
                # UI path kisi modal/wait par ruk jaye to wahi server authority:
                # validate_and_join_match — bilkul wahi RPC jo Confirm Join
                # button chalaata hai (slot/fee/duplicate sab server-side).
                p2.evaluate(
                    """(id) => window._supa.rpc('validate_and_join_match', {
                         p_uid: window.U.uid, p_match_id: id, p_entry_fee: 0, p_currency: 'coins',
                         p_join_data: { mode: 'solo', ign: (window.UD && window.UD.ign) || '' } })""", mid)
                row = poll(_row, timeout=120, every=4, what="P2 join (RPC fallback)")
                via = "validate_and_join_match RPC (same server path)"
            if not isinstance(row, dict):
                raise RuntimeError("P2 join row nahi mila: " + str(row)[:160])
            P2["row"] = row
            shot(p2, "h7b-p2-joined.png")
            return f"P2 ne match #{mid[:8]} join kiya — row {str(row.get('id'))[:8]} ({via})"

        step("H7b User Panel web (P2, doosra player) match join", h7b, critical=True)

        # ── H7c: admin panel — Joined Players me DONO players ──────────────

        # ── H8: user web → Admin — KYC submit (asli modal) ───────────────
        def h8():
            user.evaluate("() => { if (window.closeModal) closeModal(); }")
            user.wait_for_timeout(400)
            user.evaluate("() => window.mesShowKYC && window.mesShowKYC()")
            user.wait_for_selector("#_mes_pan", timeout=40000)
            user.fill("#_mes_pan", "ABCDE1234F")
            user.fill("#_mes_aadhaar", "123456789012")
            user.fill("#_mes_kycname", "QA TRITEST PLAYER")
            # ⚠️ Playwright ka check() yahan flaky tha (CI: "waiting for element
            #    to be visible, enabled and stable" 30s timeout — modal ke
            #    animation/scroll ki wajah se). Asli user bhi checkbox ko click
            #    hi karta hai, isliye JS se native click + verify.
            st = user.evaluate("""() => {
                const cb = document.getElementById('_mes_kyc_cbx');
                if (!cb) return 'no-cb';
                cb.scrollIntoView({ block: 'center' });
                if (!cb.checked) cb.click();
                return cb.checked ? 'checked' : 'unchecked';
            }""")
            if st != 'checked':
                user.evaluate("""() => { const l = document.querySelector('label[for=\"_mes_kyc_cbx\"]'); if (l) l.click(); }""")
                st = user.evaluate("""() => { const cb = document.getElementById('_mes_kyc_cbx'); return (cb && cb.checked) ? 'checked' : 'unchecked'; }""")
            if st != 'checked':
                raise RuntimeError("KYC checkbox tick nahi hua: " + str(st))
            shot(user, "h8a-kyc-form.png")
            user.evaluate("""() => {
                const b = [...document.querySelectorAll('button')].find(x => /Submit KYC/i.test(x.textContent || ''));
                if (b) b.click();
                else if (window.mesSubmitKYC && window.U) window.mesSubmitKYC(window.U.uid);
            }""")
            row = poll(lambda: user.evaluate(
                """async () => { const {data}=await window._supa.from('kyc_requests')
                     .select('id,status,user_id,document_type').eq('user_id', window.U.uid)
                     .order('created_at',{ascending:false}).limit(1); return (data||[])[0] || null; }"""),
                timeout=120, every=4, what="kyc_requests row")
            KYC["row"] = row
            shot(user, "h8b-kyc-submitted.png")
            return f"KYC #{row['id'][:8]} pending ({row.get('document_type')}) — admin queue isi ko dekhega"

        step("H8 User web → Admin: KYC submit", h8, critical=True)

        # ── H9: admin queue me KYC + approve (asli modal) ────────────────
        def h9():
            row = KYC["row"]
            admin.evaluate("() => window.faKYCQueue && window.faKYCQueue()")
            # ⚠️ KYC queue #genericModalBody me render hota hai (#adminGeneric…
            # alag modal hai) — isliye poore body text par check.
            txt = poll(lambda: (lambda t: t if "ABCDE1234F" in t else None)(
                admin.inner_text("body")), timeout=120, every=4, what="admin KYC queue me PAN")
            shot(admin, "h9a-admin-kyc-queue.png")
            clicked = admin.evaluate(
                """(uid) => { const b=[...document.querySelectorAll('button')]
                     .find(x => (x.getAttribute('onclick')||'').includes("faKYCApprove(") && (x.getAttribute('onclick')||'').includes(uid));
                     if(!b) return null; b.click(); return true; }""", row["user_id"])
            if not clicked:
                raise RuntimeError("KYC approve button nahi mila")
            res = poll(lambda: admin.evaluate(
                """async (id) => { const {data}=await window._supa.from('kyc_requests').select('status').eq('id',id).maybeSingle();
                     return (data && (data.status==='approved'||data.status==='verified')) ? data.status : null; }""",
                row["id"]), timeout=120, every=4, what="kyc approved")
            shot(admin, "h9b-admin-kyc-approved.png")
            return f"admin ne KYC approve kiya (DB status={res}); queue text len {len(txt)}"

        step("H9 Admin: KYC queue + approve (server)", h9, critical=True)

        # ── H10: admin → user wallet credit (asli admin RPC + ledger) ────
        def h10():
            before = admin.evaluate(
                """async (u) => { const {data}=await window._supa.from('users').select('coins,sky_diamonds').eq('id',u).maybeSingle(); return data; }""",
                ST["player"]["uid"])
            COIN["before"] = before
            # NOTE: admin panel ka wrapper fa14GiveCoins() andar se YAHI server
            # RPC call karta hai (admin panel ke apne client se; shim ise
            # trusted admin-gateway se route karta hai). Wrapper ka amount
            # window.prompt() se aata hai jo headless me drivable nahi — isliye
            # wahi rpc seedha chalaya ja raha hai (server-side admin-check +
            # FOR UPDATE + wallet_transactions ledger wahi rehta hai).
            r = admin.evaluate(
                """async (o) => { const res = await window._supa.rpc('admin_set_coins',
                       { p_uid: o.uid, p_action: 'add', p_amount: o.amt });
                     return { err: res.error ? res.error.message : null, data: res.data }; }""",
                {"uid": ST["player"]["uid"], "amt": ST["markers"]["coinAmount"]})
            if r.get("err") or (r.get("data") or {}).get("success") is False:
                raise RuntimeError("admin_set_coins fail: " + json.dumps(r, ensure_ascii=False)[:200])
            after = poll(lambda: (lambda d: d if d and int(d["coins"]) >= int(before["coins"]) + ST["markers"]["coinAmount"] else None)(
                admin.evaluate("""async (u) => { const {data}=await window._supa.from('users').select('coins,sky_diamonds').eq('id',u).maybeSingle(); return data; }""",
                               ST["player"]["uid"])), timeout=120, every=4, what="coins credit")
            tx = admin.evaluate(
                """async (u) => { const {data}=await window._supa.from('wallet_transactions')
                     .select('amount,reason,currency').eq('user_id',u).order('created_at',{ascending:false}).limit(1);
                     return (data||[])[0] || null; }""", ST["player"]["uid"])
            COIN["after"] = after
            shot(admin, "h10-admin-gave-coins.png")
            return f"admin ne 🪙{ST['markers']['coinAmount']} diye: {before['coins']} → {after['coins']} (ledger: {json.dumps(tx, ensure_ascii=False)[:80]})"

        # ── H9b (Phase-3): ROOM ID/password — creator (asli app UI) set karta
        #        hai, joda hua player (P2) usi ko asli RPC se dekhta hai.
        #  Raasta: admin match ka creator_uid = P1 (asli admin write, RLS
        #  matches_admin_write) → P1 app ki apni creator-room-entry UI se
        #  Room ID/password save karta hai (creator_set_room RPC) → admin room
        #  release karta hai (room_status='released' + released_at past) →
        #  P2 (join kiya hua player) get_room_credentials se wahi Room ID UI
        #  me dekhta hai.
        ROOM = {"id": "TRIROOM" + str(CUR)[:6].upper(), "pw": "TRIPW" + str(CUR)[-4:].upper()}

        def h9b():
            # ⚠️ 2026-10-16 (asli wajah mili): pehle ye test WAHI match use karta
            # tha jisme P1 (APK) join karta hai — par yahan `creator_uid = P1`
            # set hota hai, aur server ka validate_and_join_match usi ko saaf
            # rok deta hai: "Apne khud ke hosted match mein join nahi kar sakte"
            # (SELF_PLAY_BLOCKED, HTTP 200). Isi se APK ka join (step 9) na row
            # banata tha, na H11b (dono players) pass hota tha — har run me.
            # Ab Room-ID test ka apna ALAG match hai, is liye main match ka
            # creator_uid khaali rehta hai aur P1 ka join khula hai.
            rmid = admin.evaluate(
                """async (m) => {
                     const id = (window.rtdb && window.rtdb.ref) ? (await window.rtdb.ref('matches').push(m)).key : null;
                     if (!id) return { error: 'bridge push fail' };
                     await new Promise(r => setTimeout(r, 2500));
                     const { data, error } = await window._supa.from('matches')
                        .select('id,title,status,mode,max_slots').ilike('title', m.title).limit(1);
                     return { row: (data||[])[0] || null, err: error ? error.message : null };
                   }""",
                {"title": ST["markers"]["matchTitle"] + " — Room", "status": "upcoming", "mode": "solo",
                 "entry_fee": 0, "entry_type": "free", "max_slots": 6, "map": "Bermuda",
                 "scheduled_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 5400)) + ".000Z",
                 "prize_pool": 0, "data": {"tri": CUR, "room_test": True}})
            if rmid.get("err") or not rmid.get("row"):
                raise RuntimeError("room match insert/verify fail: " + json.dumps(rmid)[:200])
            ROOM["mid"] = rmid["row"]["id"]
            mid = ROOM["mid"]
            # 1) admin: P1 ko (room match ka) creator banao (asli admin-panel write)
            r1 = admin.evaluate("""async (o) => {
                const { error } = await window._supa.from('matches')
                  .update({ creator_uid: o.uid }).eq('id', o.mid);
                return error ? error.message : null; }""",
                {"uid": ST["player"]["uid"], "mid": mid})
            if r1:
                raise RuntimeError("creator_uid set fail: " + str(r1)[:140])

            # 1b) P2 (joined player) room match me join kare — asli UI path
            p2.evaluate("() => { if (window._loadMatches) _loadMatches(); }")
            p2.wait_for_timeout(2000)
            p2.evaluate("(id) => { if (window.doJoin) doJoin(id); }", mid)

            def _p2_row():
                return p2.evaluate(
                    """async (id) => { const {data} = await window._supa.from('join_requests')
                         .select('id,status').eq('match_id', id).eq('user_id', window.U.uid);
                         return (data||[])[0] || null; }""", mid)
            try:
                p2row = poll(_p2_row, timeout=60, every=4, what="P2 join row (room match, doJoin)")
            except Exception:
                p2.evaluate("""(id) => window._supa.rpc('validate_and_join_match', {
                     p_uid: window.U.uid, p_match_id: id, p_entry_fee: 0, p_currency: 'coins',
                     p_join_data: { mode: 'solo', ign: (window.UD && window.UD.ign) || '' } })""", mid)
                p2row = poll(_p2_row, timeout=120, every=4, what="P2 join row (room match, RPC fallback)")
            ROOM["p2_join"] = str(p2row.get("id"))[:8]

            # 2) P1 (creator) — APP KI APNI UI se room ID save karo
            user.evaluate("(id) => { if (window.showCreatorRoomEntry) showCreatorRoomEntry(id); }", mid)
            user.wait_for_timeout(1200)
            ok_ui = user.evaluate("""(o) => {
                const a = document.getElementById('crRoomId'), b = document.getElementById('crRoomPw');
                if (!a || !b) return false;
                a.value = o.id; b.value = o.pw;
                return true; }""", ROOM)
            if not ok_ui:
                raise RuntimeError("creator room-entry UI ke input nahi mile (crRoomId/crRoomPw)")
            shot(user, "h9b-creator-room-ui.png")
            user.evaluate("(id) => { if (window.submitCreatorRoomId) submitCreatorRoomId(id); }", mid)

            def _saved():
                return admin.evaluate("""async (mid) => {
                    const { data } = await window._supa.from('match_rooms')
                       .select('room_id,room_password').eq('match_id', mid).maybeSingle();
                    return data || null; }""", mid)

            saved = poll(_saved, timeout=90, every=4, what="match_rooms row (creator_set_room ke baad)")
            if (saved.get("room_id") or "").strip() != ROOM["id"]:
                raise RuntimeError("DB me room_id match nahi: " + json.dumps(saved)[:160])

            # 3) admin: room release (jaise release_due_rooms/cron karta hai)
            r3 = admin.evaluate("""async (mid) => {
                const { error } = await window._supa.from('matches').update({
                    room_status: 'released',
                    room_released_at: new Date(Date.now() - 60000).toISOString(),
                    room_release_minutes: 5 }).eq('id', mid);
                return error ? error.message : null; }""", mid)
            if r3:
                raise RuntimeError("room release fail: " + str(r3)[:140])

            # 4) P2 (joined player) — wahi Room ID apni UI me dekhe
            p2.evaluate("() => { if (window._loadMatches) _loadMatches(); if (window.navTo) navTo('matches'); }")
            p2.wait_for_timeout(2500)

            def _player_sees():
                try:
                    return p2.evaluate("""(id) => {
                        const t = (document.body.innerText || '');
                        return t.indexOf(id) !== -1 ? { seen: true, txt: t.slice(0, 0) } : null; }""", ROOM["id"])
                except Exception:
                    return None

            # pehle asli room-open path (RPC), phir text scan
            p2.evaluate("(id) => { if (window._showRoomViaRpc) _showRoomViaRpc(id); }", mid)
            try:
                seen = poll(_player_sees, timeout=120, every=5, what="P2 ki UI par Room ID")
            except Exception:
                # dialog band ho gaya ho / screen badal gaya — dobara kholo aur scan
                p2.evaluate("(id) => { if (window._showRoomViaRpc) _showRoomViaRpc(id); }", mid)
                seen = poll(_player_sees, timeout=90, every=5, what="P2 ki UI par Room ID (dobara)")
            shot(p2, "h9b-p2-room-visible.png")
            VALUES["room_id"] = ROOM["id"]
            VALUES["room_pw"] = ROOM["pw"]
            return (f"room match #{ROOM['mid'][:8]} (P2 joined ✔) → creator (app UI, P1) ne Room ID "
                    f"'{ROOM['id']}' + password set kiya (DB match_rooms ✔), admin ne release kiya, aur jode hue "
                    f"player (P2) ko wahi Room ID uski UI me dikha ✔")

        step("H9b Phase-3: Room ID/password — creator se player tak (live)", h9b, critical=True)

        step("H10 Admin → user: coins credit (admin_set_coins + ledger)", h10, critical=True)

        # ── H11: user web par dono cheezein dikhein ──────────────────────
        def h11():
            seen = {}
            # 1) coins wallet UI par
            want = int(COIN["after"]["coins"])
            poll(lambda: (lambda v: v if v is not None and int(v) >= want else None)(
                user.evaluate("() => window.UD && Number(window.UD.coins)")), timeout=180, every=6,
                what="user web coins")
            seen["coins"] = True
            # 2) KYC verified (asli modal)
            user.evaluate("() => { if (window.closeModal) closeModal(); if (window.mesShowKYC) mesShowKYC(); }")
            poll(lambda: "KYC Verified" in user.inner_text("body") or "verify ho chuki" in user.inner_text("body"),
                 timeout=120, every=4, what="user web KYC verified")
            seen["kyc"] = True
            shot(user, "h11-user-web-final.png")
            return json.dumps(seen)

        step("H11 Admin → User web: coins + KYC verified", h11, critical=True)

        # ── H11b: P1 (user web) ke match me DO players dikhein ─────────────
        def h11b():
            mid = MATCH["row"]["id"]
            # ⚠️ join_requests par RLS hai — ek player doosre player ki row nahi
            #    dekh sakta (sirf apni + admin sab). Isliye "2 players" ka pakka
            #    signal matches.filled_slots hai (wo sabko dikhta hai) + apni row.
            # 2026-10-16: APK step 9 ab join ki 6 koshish karta hai (har ek
            # ~30s; emulator me ek request hang ho jaye to wo dobara bhejta
            # hai) — is liye yahan ka intezaar 330s se badha kar 480s.
            fs = poll(lambda: (lambda v: int(v) if v is not None and int(v) >= 2 else None)(
                user.evaluate("""async (id) => { const {data} = await window._supa.from('matches')
                     .select('filled_slots').eq('id', id).maybeSingle(); return data ? data.filled_slots : null; }""", mid)),
                timeout=480, every=6, what="match filled_slots >= 2 (dono players)")
            mine = poll(lambda: user.evaluate("""async (id) => { const {data} = await window._supa.from('join_requests')
                     .select('id').eq('match_id', id).eq('user_id', window.U.uid); return (data||[]).length ? true : null; }""", mid),
                timeout=120, every=5, what="P1 ki apni join row")
            user.evaluate("() => { if (window._loadMatches) window._loadMatches(); }")
            card = poll(lambda: (lambda v: v if v is not None and int(v) >= 2 else None)(
                user.evaluate("(id) => (window.MT && window.MT[id]) ? Number(window.MT[id].filledSlots || 0) : None", mid)),
                timeout=180, every=6, what="match card par 2 players")
            shot(user, "h11b-user-web-2-players.png")
            VALUES["joined_players"] = str(fs)
            return f"match #{mid[:8]} filled_slots={fs} (card: {card}) — P1 (web) + P2 (web) dono andar"

        step("H11b User web (P1): match me dono players dikhe", h11b, critical=True)

        # ── H11c: admin panel — Joined Players me DONO players ────────────
        #  ⚠️ Pehle yeh check H7b ke turant baad tha — par P1 (APK) ka join
        #  us waqt tak hota hi nahi (APK step 9, jo khud host H8/H9 ka
        #  intezaar karta hai). Isse DONO taraf ka circular wait ban gaya:
        #  host H7c P1 ke join ka, aur APK step 8/9 host H9 ka. Ab yeh check
        #  sab ke baad aata hai, aur pehle DB se confirm karta hai ki match me
        #  sach me 2 players hain (filled_slots = server ka sach).
        def h11c():
            mid = MATCH["row"]["id"]
            u1, u2 = ST["player"]["uid"], ST["player2"]["uid"]
            fs = poll(lambda: (lambda v: int(v) if v is not None and int(v) >= 2 else None)(
                admin.evaluate("""async (id) => { const {data} = await window._supa.from('matches')
                     .select('filled_slots').eq('id', id).maybeSingle(); return data ? data.filled_slots : null; }""", mid)),
                timeout=300, every=6, what="match filled_slots >= 2 (P1 APK + P2 web)")

            admin.evaluate("""() => {
                try { if (window.showSection) showSection('joinedPlayers'); } catch(e){}
                try { if (window.loadTournaments) loadTournaments(); } catch(e){}
            }""")
            admin.wait_for_timeout(3000)
            diag = {}

            def _tbl():
                try:
                    admin.evaluate("""() => {
                        try { const f=document.getElementById('joinedTournamentFilter'); if (f) f.value='all'; } catch(e){}
                        try { if (window.loadJoinedPlayers) loadJoinedPlayers(); } catch(e){}
                    }""")
                    admin.wait_for_timeout(1200)
                    st = admin.evaluate("""(o) => {
                        const t = document.getElementById('joinedPlayersTable');
                        const rows = t ? [...t.querySelectorAll('tr[data-uid]')] : [];
                        const jr = window.allJoinRequests || {};
                        const mine = Object.keys(jr).filter(k => (jr[k].tournamentId||jr[k].matchId) === o.mid);
                        return {
                          rows: rows.length,
                          uids: rows.map(r => r.getAttribute('data-uid')),
                          hasTable: !!t,
                          sec: window.currentSection || '',
                          jr_count: Object.keys(jr).length,
                          mine_in_jr: mine.length,
                          mine_status: mine.slice(0,4).map(k => jr[k].status || '?'),
                          filter: (document.getElementById('joinedTournamentFilter')||{}).value || '',
                          text: t ? (t.innerText || '').slice(0, 320) : ''
                        };
                    }""", {"mid": mid})
                    diag.clear(); diag.update(st)
                    if st.get("rows") and u1 in st.get("uids", []) and u2 in st.get("uids", []):
                        return st
                    if not st.get("mine_in_jr"):
                        admin.evaluate("() => { try { if (window.loadTournaments) loadTournaments(); } catch(e){} }")
                except Exception as e:
                    diag["err"] = str(e)[:150]
                return None

            try:
                hit = poll(_tbl, timeout=240, every=6, what="admin Joined Players me dono players (data-uid)")
            except Exception:
                raise RuntimeError("Joined Players me dono players nahi mile — diag=" +
                                   json.dumps(diag, ensure_ascii=False)[:420])
            shot(admin, "h11c-admin-joined-players.png")
            # IGN marker ka check — table text me (case-insensitive)
            _t = (hit.get("text", "") or "").upper()
            p1name = ST["markers"]["ignTag"].upper() in _t
            p2name = ST["markers"]["ignTag2"].upper() in _t
            return (f"admin panel (Joined Players) me dono ki live row mili "
                    f"({u1[:8]} + {u2[:8]}, table rows={hit['rows']}, match ki JRs={hit['mine_in_jr']}, filled_slots={fs})"
                    + f"; IGN: P1={'✔' if p1name else '—'} P2={'✔' if p2name else '—'}")

        step("H11c Admin panel: Joined Players me dono (P1 APK + P2 web)", h11c, critical=True)

        # ── H11d: P2 (DOOSRA player) ke leaderboard par P1 ke naam ke aage ──
        #  ribbon — yehi "premium dikhta hai" ka asli saboot hai (social proof):
        #  doosre user ki screen par, public leaderboard row se.
        def h11d():
            u1 = ST["player"]["uid"]
            p2.evaluate("() => { if (window.navTo) navTo('rank'); else if (window.showScreen) showScreen('rank'); }")
            p2.wait_for_timeout(2500)
            shot(p2, "h11d-p2-rank-open.png")

            ign1 = ST["markers"]["ignTag"]        # 'TRIQA <runid>'
            ign2 = ST["markers"]["ignTag2"]       # 'TRIQA2 <runid>' (P2 khud — uski row se match nahi karna)
            #  ⚠️ 2026-10-13d: pehle IGN 'QA-TRI ...' tha — app ka leaderboard
            #  filter (/^QA[-_]?/i) QA accounts chhupa deta hai, isliye P1 ki
            #  row kabhi render hi nahi hoti thi aur ye step hamesha time out
            #  hota tha (fail ka asli reason ribbon code nahi, prefix tha).
            #  Ab IGN 'TRIQA ...' hai → row asli leaderboard par dikhti hai.

            def _check():
                try:
                    return p2.evaluate("""(o) => {
                        /* Leaderboard ki asli screen js/fixes-v7.js ke renderRank se
                           banti hai: podium (.pod-name) + rows (.rank-row[data-uid]).
                           Row dono jagah dhoondho — data-uid se (pakka), IGN text se
                           (fallback). Ribbon .prem-ribbon <img> hai. */
                        const holders = [...document.querySelectorAll('.rank-row[data-uid], .rank-row, .pod-name')];
                        let rib = null, rowTxt = null, rowUid = null, seen = false, qaLeak = false;
                        for (const r of holders) {
                          const t = (r.innerText || '');
                          const uid = r.closest('[data-uid]') ? r.closest('[data-uid]').getAttribute('data-uid') : (r.getAttribute('data-uid') || '');
                          const byUid = uid === o.uid;
                          const byIgn = o.ign && t.toUpperCase().indexOf(o.ign.toUpperCase()) !== -1
                                        && t.toUpperCase().indexOf(o.ign2.toUpperCase()) === -1;
                          if (byUid || byIgn) {
                            seen = true;
                            const box = r.closest('[data-uid]') || r;
                            rib = box.querySelector('.prem-ribbon') || r.querySelector('.prem-ribbon');
                            rowTxt = t.slice(0, 90); rowUid = uid || '(ign-match)';
                            break;
                          }
                        }
                        /* QA- wale IGN kabhi render nahi hone chahiye (app ka filter) */
                        qaLeak = [...document.querySelectorAll('.rank-row, .pod-name')]
                                   .some(x => /^QA[-_]?/i.test((x.innerText || '').trim()));
                        return { seen: seen, qaLeak: qaLeak,
                                 ok: !!rib, tier: rib ? rib.getAttribute('data-premium-tier') : null,
                                 rowTxt: rowTxt, rowUid: rowUid };
                    }""", {"uid": u1, "ign": ign1, "ign2": ign2})
                except Exception:
                    return None

            def _ready():
                r = _check()
                if not r:
                    return None
                # row mil gayi par ribbon nahi → data ka issue hai, ye bhi report karo
                if r.get("seen") and not r.get("ok"):
                    return None
                return r if r.get("ok") else None

            try:
                hit = poll(_ready, timeout=240, every=6, what="P2 ke leaderboard par P1 ke aage premium ribbon")
            except Exception as _e:
                diag = _check() or {}
                raise RuntimeError(
                    ("leaderboard par row mili par ribbon nahi (merge/DB issue): " + json.dumps(diag)[:220])
                    if diag.get("seen") else
                    ("P1 ki row hi leaderboard par nahi aayi (RTDB mirror/QA filter): " + json.dumps(diag)[:220]))
            shot(p2, "h11d-p2-leaderboard-ribbon.png")
            if hit.get("qaLeak"):
                raise RuntimeError("QA- prefix wala IGN leaderboard par dikh gaya — app ka filter toot gaya")
            VALUES["premium_level"] = str(hit.get("tier") or "1")
            VALUES["premium_ribbon"] = "leaderboard-row"
            return (f"P2 (doosra player) ke leaderboard me P1 ke row par premium ribbon dikha "
                    f"(tier={hit.get('tier')}, row [{hit.get('rowUid')}]='{str(hit.get('rowTxt'))[:44]}')")

        step("H11d Doosra player (P2) ko leaderboard par premium ribbon", h11d, critical=True)

        # ── H13 (Phase-3): DUO team — captain (P1) app ke ASLI join UI se
        #     partner ko invite karta hai, partner (P2) apni notification ke
        #     ASLI Accept button se consent deta hai, phir captain ka team-join
        #     server par pass hota hai (join_match_team). Poora raasta asli hai:
        #     cJoin → partner FF UID validate → doJoin → invite_team_members →
        #     (P2) respond_team_invite → doJoin → join_match_team.
        DUO = {}

        def h13():
            title = ST["markers"]["duoTitle"]
            # 1) admin: DUO match (mode duo, 2 slots) — wahi bridge jo H4 me
            res = admin.evaluate(
                """async (m) => {
                     const id = (window.rtdb && window.rtdb.ref) ? (await window.rtdb.ref('matches').push(m)).key : null;
                     if (!id) return { error: 'bridge push fail' };
                     await new Promise(r => setTimeout(r, 2500));
                     const { data, error } = await window._supa.from('matches')
                        .select('id,title,status,mode,max_slots').ilike('title', m.title).limit(1);
                     return { key: id, row: (data||[])[0] || null, err: error ? error.message : null };
                   }""",
                {"title": title, "status": "upcoming", "mode": "duo", "entry_fee": 0, "entry_type": "free",
                 "max_slots": 2, "map": "Bermuda",
                 "scheduled_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 7200)) + ".000Z",
                 "prize_pool": 0, "data": {"tri": CUR, "duo": True}})
            if res.get("error") or not res.get("row"):
                raise RuntimeError("duo match insert/verify fail: " + json.dumps(res)[:200])
            DUO["row"] = res["row"]; DUO["id"] = res["row"]["id"]
            shot(admin, "h13-duo-match-created.png")

            # P2 ka FF UID (partner verify isi se hota hai)
            ff2 = admin.evaluate(
                """async (uid) => { const {data} = await window._supa.from('users').select('ff_uid').eq('id', uid).maybeSingle();
                     return data ? data.ff_uid : null; }""", ST["player2"]["uid"])
            if not ff2:
                raise RuntimeError("P2 ka ff_uid nahi mila (users row)")

            # 2) P1: ASLI join UI — cJoin → partner UID → doJoin (invite chala jayega)
            #  ⚠️ 2026-10-14: cJoin `MT[id]` dekh kar chalta hai — match data-
            #  layer me na ho to wo CHUP-CHAAP return kar deta hai (koi error
            #  nahi). Naya duo match abhi-abhi bana hai, is liye pehle usko
            #  MT me aane ka intezaar karo (asli _loadMatches se), phir click.
            user.evaluate("() => { if (window.navTo) navTo('matches'); if (window._loadMatches) _loadMatches(); }")
            poll(lambda: user.evaluate("(id) => (window.MT && window.MT[id]) ? true : null", DUO["id"]),
                 timeout=120, every=4, what="user ke MT me duo match")
            user.wait_for_timeout(1500)
            user.evaluate("(id) => { if (window.cJoin) cJoin(id); }", DUO["id"])
            user.wait_for_timeout(1500)
            # ⚠️ 2026-10-16 (asli wajah): agar P1 ka koi SAVED duo partner hai
            # (localStorage linked team), to join modal UID input ko
            # `#manualPartnerWrap` (display:none) ke andar chhupa deta hai aur
            # uski jagah 'Linked Partner — Auto Joined!' card dikhata hai.
            # Is liye `#partnerUid1` milta hi nahi tha. App ka apna
            # 'Use different partner?' link (`showManualPartner('duo')`) click
            # karke asli manual-UID field kholna padta hai.
            vis = user.evaluate(
                """() => { const a = document.getElementById('partnerUid1');
                     if (!a) return 'na';
                     if (a.offsetParent === null) {
                       if (window.showManualPartner) showManualPartner('duo');
                       const w = document.getElementById('manualPartnerWrap');
                       if (w) w.style.display = 'block';
                     }
                     return 'ok'; }""")
            if vis != "ok":
                raise RuntimeError("duo join modal me partner UID input (#partnerUid1) hai hi nahi")
            user.wait_for_timeout(600)
            filled = user.evaluate(
                """(o) => { const a = document.getElementById('partnerUid1'); if (!a) return false;
                     a.value = o.ff; a.dispatchEvent(new Event('input', { bubbles: true })); return true; }""",
                {"ff": ff2})
            if not filled:
                raise RuntimeError("duo join modal me partner UID input (#partnerUid1) nahi mila")
            # asli screenshot par field dikhni chahiye (manual wrap khuli ho)
            user.evaluate(
                """() => { const a = document.getElementById('partnerUid1');
                     const w = document.getElementById('manualPartnerWrap'); if (w) w.style.display = 'block';
                     if (a) a.scrollIntoView({block: 'center'}); }""")
            shot(user, "h13-duo-join-modal.png")

            def _partner_ok():
                try:
                    return user.evaluate("() => (window.partnerCache && window.partnerCache[1]) ? (window.partnerCache[1].ffUid || 'ok') : null")
                except Exception:
                    return None

            poll(_partner_ok, timeout=90, every=4, what="partner FF UID verify (partnerCache[1])")
            user.evaluate("(id) => { if (window.doJoin) doJoin(id); }", DUO["id"])
            # app ka apna confirm (#_appDlgOv) aaye to asli 'Haan, karo'
            try:
                user.wait_for_selector("#_appDlgOv.show", timeout=6000)
                user.click("#_appDlgOk", timeout=6000)
            except Exception:
                pass

            # 3) DB me invitation (captain ke invite ka server-proof)
            def _invite():
                return admin.evaluate(
                    """async (id) => { const {data} = await window._supa.from('team_invitations')
                         .select('id,member_uid,status,captain_uid').eq('match_id', id).limit(5);
                         return (data||[])[0] || null; }""", DUO["id"])

            inv = poll(_invite, timeout=120, every=5, what="team_invitations row (captain ka invite)")
            DUO["invite"] = inv
            shot(user, "h13-duo-invite-sent.png")

            # 4) P2: apni NOTIFICATION ke asli Accept button se consent
            p2.evaluate("() => { if (window._loadMatches) _loadMatches(); if (window.renderNotifs) renderNotifs(); }")
            p2.wait_for_timeout(3000)

            def _click_accept():
                try:
                    return p2.evaluate(
                        """(mid) => {
                             const btns = [...document.querySelectorAll('button')];
                             const b = btns.find(x => { const oc = x.getAttribute('onclick') || '';
                                return oc.indexOf('_respondTeamInvite') !== -1 && oc.indexOf(mid) !== -1; });
                             if (!b) return null;
                             b.click();
                             return { clicked: true, label: (b.innerText || '').trim().slice(0, 16) };
                           }""", DUO["id"])
                except Exception:
                    return None

            hit = poll(_click_accept, timeout=150, every=6, what="P2 ki notification par Accept button")
            shot(p2, "h13-p2-accept-invite.png")

            def _inv_status():
                return admin.evaluate(
                    """async (id) => { const {data} = await window._supa.from('team_invitations')
                         .select('status,member_uid').eq('match_id', id).limit(5);
                         const rows = data || [];
                         const acc = rows.filter(r => r.status === 'accepted');
                         return acc.length ? { accepted: acc.length, status: acc[0].status } : null; }""", DUO["id"])

            acc = poll(_inv_status, timeout=150, every=5, what="team_invitations status=accepted")
            DUO["accepted"] = acc

            # 5) P1: dobara ASLI join (ab server team authorize karega)
            user.evaluate("() => { if (window._loadMatches) _loadMatches(); if (window.navTo) navTo('matches'); }")
            user.wait_for_timeout(2000)
            user.evaluate("(id) => { if (window.cJoin) cJoin(id); }", DUO["id"])
            user.wait_for_timeout(1500)
            user.evaluate(
                """(o) => { const a = document.getElementById('partnerUid1');
                     if (a && !(window.partnerCache && window.partnerCache[1])) { a.value = o.ff; a.dispatchEvent(new Event('input', { bubbles: true })); } }""",
                {"ff": ff2})
            user.wait_for_timeout(2500)
            user.evaluate("(id) => { if (window.doJoin) doJoin(id); }", DUO["id"])

            def _team_joined():
                return admin.evaluate(
                    """async (o) => {
                         const { data: jr } = await window._supa.from('join_requests')
                            .select('user_id,status').eq('match_id', o.mid);
                         const { data: m } = await window._supa.from('matches')
                            .select('filled_slots').eq('id', o.mid).maybeSingle();
                         const rows = jr || [];
                         const uids = rows.map(r => r.user_id);
                         return (uids.indexOf(o.u1) !== -1 && uids.indexOf(o.u2) !== -1)
                            ? { rows: rows.length, statuses: rows.map(r => r.status).join(','),
                                filled: m ? m.filled_slots : null } : null; }""",
                    {"mid": DUO["id"], "u1": ST["player"]["uid"], "u2": ST["player2"]["uid"]})

            tj = poll(_team_joined, timeout=240, every=6, what="duo match me dono players (join_match_team)")
            shot(user, "h13-duo-team-joined.png")
            VALUES["duo_players"] = str(tj.get("rows") or 2)
            VALUES["duo_match_id"] = DUO["id"]
            return (f"duo #{DUO['id'][:8]}: captain (app UI) ne invite bheja (team_invitations row ✔) → "
                    f"partner ne notification ke Accept se consent diya (status=accepted ✔) → team join server par pass "
                    f"(join_requests {tj.get('rows')} rows: {tj.get('statuses')}, filled_slots={tj.get('filled')}) ✔")

        step("H13 Phase-3: DUO team — invite → accept → team join (live)", h13, critical=True)

        # ── H14 (3.6): check-in streak — home par ASLI strip (streak_days se),
        #     aaj ki check-in asli button se, aur DB me daily_checkins row.
        #     Poora raasta asli: renderLoginStreakStrip → Check-in button →
        #     doCheckIn → process_daily_checkin RPC → strip "आज हो गया ✓".
        def h14():
            user.evaluate("() => { if (window.navTo) navTo('home'); if (window.renderHome) renderHome(); }")
            user.wait_for_timeout(2500)

            def _strip():
                return user.evaluate("""() => {
                    const el = document.getElementById('loginStreakStrip');
                    if (!el) return null;
                    return { streak: el.getAttribute('data-streak'), cycle: el.getAttribute('data-cycle'),
                             done: el.getAttribute('data-done-today'),
                             warrior: !!el.querySelector('img[src*="badges/week-warrior.png"]'),
                             btn: !!el.querySelector('button'),
                             label: (document.getElementById('lsToday')||{}).innerText || '' }; }""")

            st = poll(_strip, timeout=120, every=5, what="home par loginStreakStrip")
            shot(user, "h14-web-streak-strip.png")
            if not st.get("warrior"):
                raise RuntimeError("strip me Week Warrior kala nahi mili: " + json.dumps(st)[:160])

            # aaj ki check-in (agar ho chuki ho to button hi nahi hoga)
            before = admin.evaluate(
                """async (uid) => { const {data} = await window._supa.from('users').select('streak_days').eq('id', uid).maybeSingle();
                     return data ? Number(data.streak_days) || 0 : 0; }""", ST["player"]["uid"])

            if st.get("done") != "1":
                clicked = user.evaluate("""() => {
                    const el = document.getElementById('loginStreakStrip');
                    const b = el ? el.querySelector('button') : null;
                    if (!b) return false; b.click(); return true; }""")
                if not clicked:
                    raise RuntimeError("strip par Check-in button nahi mila (aur aaj check-in bhi nahi hua)")
                shot(user, "h14-web-checkin-clicked.png")

            def _dbrow():
                return admin.evaluate(
                    """async (uid) => {
                         const {data:ci} = await window._supa.from('daily_checkins')
                            .select('checkin_date,streak_day,coins_earned').eq('user_id', uid)
                            .order('created_at', {ascending:false}).limit(1);
                         const {data:u} = await window._supa.from('users').select('streak_days').eq('id', uid).maybeSingle();
                         const row = (ci||[])[0];
                         return row ? { date: row.checkin_date, day: row.streak_day, coins: row.coins_earned,
                                        streak: u ? Number(u.streak_days)||0 : 0 } : null; }""",
                    ST["player"]["uid"])

            row = poll(_dbrow, timeout=150, every=5, what="daily_checkins row + users.streak_days")

            def _done_live():
                return user.evaluate("""() => {
                    const el = document.getElementById('loginStreakStrip');
                    return (el && el.getAttribute('data-done-today') === '1' && !el.querySelector('button')) ? true : null; }""")

            poll(_done_live, timeout=90, every=4, what="strip par live 'आज हो गया ✓' (bina reload)")
            shot(user, "h14-web-streak-done.png")
            VALUES["streak_days"] = str(row.get("streak") or 0)
            VALUES["streak_strip"] = "home-strip"
            return (f"home par asli streak strip (Week Warrior kala ✔), check-in asli button se → "
                    f"daily_checkins row (din {row.get('day')}, +🪙{row.get('coins')}) + users.streak_days "
                    f"{before}→{row.get('streak')} → strip ne live 'आज हो गया ✓' dikhaya (bina reload)")

        step("H14 3.6: check-in streak strip + asli check-in (home par)", h14)

        # ── H15 (3.8/11): Season Champion ka bada ailaan — asli table +
        #     asli banner (web) + asli kala. Row TRI ke P1 ka (QA), 1 ghante ka
        #     window; ant me row + UD flag reset (residue 0).
        #     Server flow (pg_cron 1 tareekh) alag se SQL test me proved hai —
        #     yahan CLIENT ki asli parat live chalti hai.
        def h15():
            mk = admin.evaluate("""() => { const d = new Date();
                 return d.getFullYear() + '_' + String(d.getMonth() + 1).padStart(2, '0'); }""")
            champ_ign = "QA Champion " + str(CUR)[-4:]
            row = admin.evaluate("""async (a) => {
                 await window._supa.from('season_champions').delete().eq('month_key', a.mk);
                 const { error } = await window._supa.from('season_champions').insert({
                   month_key: a.mk, user_id: a.uid, ign: a.ign, kills: 4242, wins: 99, rank_points: 1234,
                   banner_until: new Date(Date.now() + 3600 * 1000).toISOString() });
                 if (error) return { error: error.message };
                 const { data } = await window._supa.from('season_champions').select('month_key,user_id,ign,kills')
                   .eq('month_key', a.mk).limit(1);
                 return { row: (data || [])[0] || null };
               }""", {"mk": mk, "uid": ST["player"]["uid"], "ign": champ_ign})
            if not row or row.get("error") or not row.get("row"):
                raise RuntimeError("season_champions row nahi bani: " + json.dumps(row)[:160])

            # web (asli user panel) — banner asli row se, apna champion
            user.evaluate("() => { if (window.navTo) navTo('home'); if (window.renderHome) renderHome(); }")
            user.wait_for_timeout(2000)
            user.evaluate("() => { if (window.refreshSeasonChampion) refreshSeasonChampion(); }")

            def _banner():
                return user.evaluate("""() => {
                     const el = document.getElementById('seasonChampionBanner');
                     if (!el) return null;
                     const inner = el.querySelector('#seasonChampionBanner') || el;
                     if (inner.getAttribute('data-mine') !== '1') return null;
                     const t = (inner.innerText || '');
                     return { mine: inner.getAttribute('data-mine'), kills: t.indexOf('4242') !== -1,
                              txt: t.replace(/\n/g, ' ').slice(0, 80),
                              kala: !!(window._assetUnlocked && window.ASSET_CATALOG &&
                                       window._assetUnlocked(window.ASSET_CATALOG.special.find(x => x.id === 'sp_season_champion'),
                                                             window._assetStats ? window._assetStats() : { seasonChampion: 1 })) }; }""")

            b = poll(_banner, timeout=120, every=5, what="web par champion banner (apna)")
            shot(user, "h15-web-champion-banner.png")
            if not b.get("kala"):
                raise RuntimeError("champion banner to aaya par kala unlock nahi: " + json.dumps(b)[:160])

            # ⚠️ 2026-10-16: ye row ABHI delete NAHI hoti. APK ka step 17 (banner
            # APK par) isi row par depend karta hai, aur wo APK host ke baad
            # chal sakta hai. Pehle yahan turant delete hota tha — APK step 17
            # usi wajah se 300s timeout karta. Residue ka intezaam workflow ke
            # ant me chalta hai: `qa-accounts.mjs cleanup` (season_champions
            # delete wahan add kiya gaya hai) → run ke baad 0 rows.

            VALUES["champion_banner"] = "ok"
            VALUES["champion_ign"] = champ_ign
            return (f"web home par bada ailaan (apna champion → \"tum champion ho\", kills 4242), "
                    f"Season Champion kala asli flag se unlock — row {mk} APK step 17 ke liye zinda "
                    f"rakhi (run ke ant me QA cleanup hatayega)")

        step("H15 3.8/11: Season Champion bada ailaan (web banner + kala)", h15)

        # ── H16 (3.9 client): badge unlock push — stats asli users row me
        #     badhao, home render par asli notifyNewBadges chale, aur EK
        #     notification row bane (wahi row push trigger karti hai).
        def h16():
            uid = ST["player"]["uid"]
            old = admin.evaluate("""async (uid) => { const {data} = await window._supa.from('users')
                 .select('total_wins,total_kills,total_matches').eq('id', uid).maybeSingle(); return data || {}; }""", uid)
            newst = {"w": 600, "k": 600, "m": max(40, int(old.get("total_matches") or 0))}
            # 2026-10-14: badge-engine ka pehla call (device+uid par) sirf
            # BASELINE banata hai — koi push nahi (js/features/badge-engine.js:
            # 'pehli baar … sirf baseline'). App ye kaam pehli home render par
            # hi kar leta hai, par agar nahi hua ho to yahan ka single call
            # sirf baseline banata aur 0 row aata → H16 bekaar timeout.
            # Is liye pehle baseline (asli client function), phir stats badlo.
            user.evaluate("() => { if (window.notifyNewBadges) notifyNewBadges(); }")
            user.wait_for_timeout(1000)
            admin.evaluate("""async (a) => { const {error} = await window._supa.from('users')
                 .update({ total_wins: a.w, total_kills: a.k, total_matches: a.m }).eq('id', a.uid);
                 return { error: error ? error.message : null }; }""",
                 {"uid": uid, "w": newst["w"], "k": newst["k"], "m": newst["m"]})
            # asli client: UD ko sync karo (app bhi yahi karta hai) + home render
            user.evaluate("""(a) => { if (window.UD) { window.UD.total_wins = a.w; window.UD.total_kills = a.k;
                 window.UD.total_matches = a.m; } if (window.renderHome) renderHome();
                 if (window.notifyNewBadges) notifyNewBadges(); }""", newst)

            def _badge_notifs():
                return admin.evaluate("""async (uid) => {
                     const {data} = await window._supa.from('notifications')
                       .select('type,title,ref_id').eq('user_id', uid)
                       .in('type', ['badge_unlock','badge_near_unlock']).limit(6);
                     const rows = data || [];
                     return rows.length ? { n: rows.length, rows: rows.slice(0, 3) } : null; }""", uid)

            hit = poll(_badge_notifs, timeout=150, every=5, what="badge unlock notification row (asli)")
            shot(user, "h16-web-badge-unlock-notif.png")

            # ⚠️ 2026-10-16: badge notification rows ABHI delete nahi hoti —
            # APK ka step 18 (asli notification row APK par) inhi par depend
            # karta hai. Run ke ant me `qa-accounts.mjs cleanup` saari
            # notifications (user ke) delete karta hai → residue 0.
            admin.evaluate("""async (a) => { await window._supa.from('users')
                 .update({ total_wins: a.w, total_kills: a.k }).eq('id', a.uid); }""",
                 {"uid": uid, "w": int(old.get("total_wins") or 0), "k": int(old.get("total_kills") or 0)})
            user.evaluate("""(a) => { if (window.UD) { window.UD.total_wins = a.w; window.UD.total_kills = a.k; }
                 if (window.renderHome) renderHome(); }""",
                 {"w": int(old.get("total_wins") or 0), "k": int(old.get("total_kills") or 0)})

            first = hit["rows"][0] if hit.get("rows") else {}
            VALUES["badge_unlock_push"] = "ok"
            return (f"stats asli users row me badhaye (wins/kills 600) → home render par asli "
                    f"notifyNewBadges chala → {hit.get('n')} notification row bani "
                    f"({first.get('type')}: {str(first.get('title'))[:40]}) — push wahi trigger karta hai; "
                    f"rows APK step 18 ke liye zinda (run-end cleanup), stats wapas")

        step("H16 3.9: badge unlock push (asli client → notification row)", h16)

        # ── H12: values dump (APK ke logcat values se milane ke liye) ────
        def h12():
            v = user.evaluate(
                """async () => {
                     const {data:u} = await window._supa.from('users').select('coins,sky_diamonds').eq('id', window.U.uid).maybeSingle();
                     const {data:k} = await window._supa.from('kyc_requests').select('status').eq('user_id', window.U.uid).order('created_at',{ascending:false}).limit(1);
                     const {data:t} = await window._supa.from('support_tickets').select('admin_reply,status').eq('user_id', window.U.uid).order('created_at',{ascending:false}).limit(1);
                     const {data:m} = await window._supa.from('matches').select('title').ilike('title','QA-TEST TRI%').order('created_at',{ascending:false}).limit(1);
                     const {data:n} = await window._supa.from('notifications').select('title').eq('user_id', window.U.uid).order('created_at',{ascending:false}).limit(1);
                     const {data:pr} = await window._supa.from('users').select('premium_level').eq('id', window.U.uid).maybeSingle();
                     const {data:rc} = await window._supa.from('user_cosmetics').select('cosmetic_key')
                        .eq('user_id', window.U.uid).eq('cosmetic_key','frame_ring_gold');
                     const {data:jr} = await window._supa.from('join_requests').select('user_id')
                        .in('match_id', (m||[]).map(x=>x.id).length ? (m||[]).map(x=>x.id) : ['00000000-0000-0000-0000-000000000000']);
                     return { coins: u && String(u.coins), sky_diamonds: u && String(u.sky_diamonds),
                              kyc_status: k && k[0] && k[0].status,
                              ticket_reply: t && t[0] && t[0].admin_reply, ticket_status: t && t[0] && t[0].status,
                              match_title: m && m[0] && m[0].title, notif_title: n && n[0] && n[0].title,
                              joined_players: String((jr || []).length),
                              premium_level: (pr && String(pr.premium_level)) || '',
                              premium_ribbon: (document.querySelector('.prem-ribbon') ? 'leaderboard-row' : ''),
                              premium_banner: (document.getElementById('premExpiryBanner') ? 'app-banner' : ''),
                              room_id: (String(document.body.innerText||'').indexOf(ROOM['id']) !== -1) ? ROOM['id'] : '',
                              streak_days: (function () { try {
                                  const el = document.getElementById('loginStreakStrip');
                                  return el ? String(el.getAttribute('data-streak') || '') : '';
                                } catch (e) { return ''; } })(),
                              duo_players: (function () { try {
                                  const t = Object.values(window.MT || {}).filter(x => (x.name || x.title || '').indexOf('— Duo') !== -1)[0];
                                  return t ? String(t.filledSlots || t.joinedSlots || '') : '';
                                } catch (e) { return ''; } })(),
                              cosmetic_ring: (rc && rc[0] && rc[0].cosmetic_key) || '',
                              ring_medal: (document.querySelector('img.pf2-ring-art') ? 'profile-medal' : ''),
                              ign: (window.UD && window.UD.ign) || '' }; }""")
            VALUES.update({k2: v2 for k2, v2 in v.items() if v2 is not None})
            shot(user, "h12-final-values.png")
            return json.dumps({k3: str(x)[:26] for k3, x in VALUES.items()}, ensure_ascii=False)

        step("H12 web ke final values (APK se milane ke liye)", h12)

        browser.close()
    finish(0)


PROOF_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000100000001008060000001ff3ff610000001c"
    "4944415478da6360606060f80fc4ffd1f81c0c0c0c0c000000ffff0300000000ffff030000"
    "0000ffff030000000000000000000000000000000000494e44ae426082")

TICKET, MATCH, NOTIF, KYC, COIN, PICKED, P2 = {}, {}, {}, {}, {}, {}, {}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--state", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--shots", required=True)
    ap.add_argument("--wait-apk", type=int, default=480, help="APK ke ticket ka intezaar (sec)")
    ap.add_argument("--skip-match", action="store_true")
    ap.add_argument("--compare-apk", help="APK values JSON (logcat se nikaala hua)")
    global ARGS, ST
    ARGS = ap.parse_args()
    CUR = ARGS.run
    ST = json.load(open(ARGS.state))
    pathlib.Path(ARGS.shots).mkdir(parents=True, exist_ok=True)
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        log("DRIVER FATAL: " + str(e)[:400])
        RESULTS.append({"step": "driver", "ok": False, "detail": str(e)[:300], "secs": 0})
        finish(1)
