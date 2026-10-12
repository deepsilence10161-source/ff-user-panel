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
            admin.evaluate("() => loadSupportTickets('open')")
            poll(lambda: (tk.get("user_id") or "")[:6] in admin.inner_text("#supportTicketsList")
                         or "QA-TRI" in admin.inner_text("#supportTicketsList"),
                 timeout=90, every=4, what="admin list render")
            txt = admin.inner_text("#supportTicketsList")
            shot(admin, "h2-admin-sees-apk-ticket.png")
            return f"APK ticket #{tk['id'][:8]} admin list me dikha (uid {tk['user_id'][:8]}) — list text len {len(txt)}"

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
            shot(user, "h6-user-web-login.png")
            return f"user web login OK (uid {uid[:8]})"

        step("H6 User Panel web login (QA player)", h6, critical=True)

        # ── H7: user web ko admin ka data dikhta hai ──────────────────────
        def h7():
            seen = {}
            user.evaluate("() => { if (window.loadMatches) window.loadMatches(); if (window._loadNotifs) window._loadNotifs(); }")
            # match
            title = ST["markers"]["matchTitle"]
            def match_visible():
                return user.evaluate(
                    """(t) => { const m = (window.MATCHES || window._matches || []);
                         if (m.length) return m.some(x => (x.title||x.name||'') === t);
                         return document.body.innerText.includes(t); }""", title)
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
            mid = MATCH["row"]["id"]
            p2.evaluate("() => { if (window.loadMatches) window.loadMatches(); }")
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
        def h7c():
            want1 = ST["markers"]["ignTag"]        # P1  (QA-TRI <runid>)
            want2 = ST["markers"]["ignTag2"]       # P2  (QA-TRI2 <runid>)
            admin.evaluate("() => { if (window.showSection) window.showSection('joinedPlayers'); else if (window.loadJoinedPlayers) window.loadJoinedPlayers(); }")
            admin.wait_for_timeout(1500)

            def _tbl():
                try:
                    admin.evaluate("() => { if (window.loadJoinedPlayers) window.loadJoinedPlayers(); }")
                    t = admin.inner_text("#joinedPlayersTable")
                except Exception:
                    t = ""
                return t if (want1 in t and want2 in t) else None

            txt = poll(_tbl, timeout=180, every=6, what="admin Joined Players me dono QA players")
            shot(admin, "h7c-admin-joined-players.png")
            return f"admin panel (Joined Players) me dono players dikhe: {want1} + {want2} (table text len {len(txt)})"

        step("H7c Admin panel: Joined Players me dono (P1 APK + P2 web)", h7c, critical=True)

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
            rows = poll(lambda: (lambda r: r if len(r) >= 2 else None)(
                user.evaluate("""async (id) => { const {data} = await window._supa.from('join_requests')
                     .select('user_id,status').eq('match_id', id); return data || []; }""", mid)),
                timeout=180, every=6, what="match me 2 players (DB)")
            user.evaluate("() => { if (window.loadMatches) window.loadMatches(); }")
            filled = poll(lambda: (lambda v: v if v is not None and int(v) >= 2 else None)(
                user.evaluate("(id) => (window.MT && window.MT[id]) ? Number(window.MT[id].filledSlots || 0) : None", mid)),
                timeout=180, every=6, what="match card par 2 players")
            shot(user, "h11b-user-web-2-players.png")
            VALUES["joined_players"] = str(len(rows))
            return f"match #{mid[:8]} me {len(rows)} players (card: {filled}/slots) — dono QA players"

        step("H11b User web (P1): match me dono players dikhe", h11b, critical=True)

        # ── H12: values dump (APK ke logcat values se milane ke liye) ────
        def h12():
            v = user.evaluate(
                """async () => {
                     const {data:u} = await window._supa.from('users').select('coins,sky_diamonds').eq('id', window.U.uid).maybeSingle();
                     const {data:k} = await window._supa.from('kyc_requests').select('status').eq('user_id', window.U.uid).order('created_at',{ascending:false}).limit(1);
                     const {data:t} = await window._supa.from('support_tickets').select('admin_reply,status').eq('user_id', window.U.uid).order('created_at',{ascending:false}).limit(1);
                     const {data:m} = await window._supa.from('matches').select('title').ilike('title','QA-TEST TRI%').order('created_at',{ascending:false}).limit(1);
                     const {data:n} = await window._supa.from('notifications').select('title').eq('user_id', window.U.uid).order('created_at',{ascending:false}).limit(1);
                     const {data:jr} = await window._supa.from('join_requests').select('user_id')
                        .in('match_id', (m||[]).map(x=>x.id).length ? (m||[]).map(x=>x.id) : ['00000000-0000-0000-0000-000000000000']);
                     return { coins: u && String(u.coins), sky_diamonds: u && String(u.sky_diamonds),
                              kyc_status: k && k[0] && k[0].status,
                              ticket_reply: t && t[0] && t[0].admin_reply, ticket_status: t && t[0] && t[0].status,
                              match_title: m && m[0] && m[0].title, notif_title: n && n[0] && n[0].title,
                              joined_players: String((jr || []).length),
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
