#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
#  MATCH-FLOW E2E driver — owner ke Free Fire screenshots wale EXACT 7
#  usernames ke saath POORA match lifecycle, asli UI + asli server RPCs:
#
#   create (coins/green/sky × solo/duo/squad + negatives) → join (solo,
#   duo captain_pays, squad each_pays, team-consent invite/accept, gift) →
#   room (set/release-window/creds/confirm/chat) → cancel + refund (admin
#   gateway RPC + claim_match_refund) → result (creator staging with owner's
#   REAL kill data → admin publish → payouts → correction) → rate → history.
#
#  "OCR" note: product me koi OCR engine hai hi nahi (user panel, admin
#  panel, SQL — sab grep ho chuka). Name-matching = _findUserByFF/_findUserByIGN
#  (user_public_profiles exact/ilike). OCR-equivalent proof = owner ke
#  screenshot ka EXACT data (7 IGN + kills + ranks) byte-for-byte har surface:
#  UD.ign, join rows, admin publish payload, wallet deltas, history DOM.
#
#  Usage: match_driver.py --run <id> --state <state.json> --out <out.json> --shots <dir>
# ═══════════════════════════════════════════════════════════════════════════
import argparse, json, os, sys, time, pathlib, urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tri-e2e"))
from host_driver import poll, clear_state_gate  # proven TRI-E2E helpers

from playwright.sync_api import sync_playwright

USER_URL = os.environ.get("USER_URL", "https://deepsilence10161-source.github.io/ff-user-panel/")
ADMIN_URL = os.environ.get("ADMIN_URL", "https://deepsilence10161-source.github.io/ff-admin-panel/")
MGMT = "https://api.supabase.com/v1/projects/hddhkculuyrfoevxmlwy/database/query"

# owner ke screenshots ka REAL result data: (tag, ign, kills, rank)
OWNER = [
    ("p1", "KESHAV\u00B7SAINi", 3, 1),
    ("p2", "Wail160g0_9", 0, 2),
    ("p3", "Linox\uBAA8444..", 0, 3),
    ("p4", "\u0AAE\u0AC7\u0AB9\u0AC1\u0AB2\u0AB5\u0AB8\u0ABE\u0AB5\u0ABE1", 0, 4),
    ("p5", "hjVikram", 1, 5),
    ("p6", "AKGINMG", 0, 6),
    ("p7", "N0dc21b349c3", 0, 7),
]
PTAGS = [o[0] for o in OWNER]
IGN_OF = {t: ign for t, ign, _k, _r in OWNER}

RESULTS = []
SHOTS = pathlib.Path("mf-shots")


def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def proof(pid, msg, ok=True):
    RESULTS.append({"id": pid, "ok": bool(ok), "msg": msg})
    print(("MF-PROOF-OK: " if ok else "MF-PROOF-FAIL: ") + f"{pid}: {msg}", flush=True)


def sql(q):
    req = urllib.request.Request(MGMT, data=json.dumps({"query": q}).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + os.environ["SUPABASE_ACCESS_TOKEN"]})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def rows(q):
    d = sql(q)
    return d if isinstance(d, list) else (d.get("result") or [])


def q1(q):
    r = rows(q)
    return r[0] if r else None


def shot(page, name):
    try:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / name), full_page=False)
    except Exception as e:
        log("shot fail " + name + ": " + str(e)[:100])


# ── matches/join_requests column introspection (schema-drift safe) ──────────
_COLS = {}


def cols_of(table):
    if table not in _COLS:
        _COLS[table] = [r["column_name"] for r in rows(
            f"select column_name from information_schema.columns where table_name='{table}'")]
    return _COLS[table]


def mcol(sem):
    """matches table ka column name (semantic se)."""
    pats = {
        "name": ["title", "name", "match_name"],
        "time": ["scheduled_at", "match_time", "starts_at", "start_time"],
        "status": ["status", "match_status", "state"],
        "room": ["room_id", "roomid"],
        "rpass": ["room_password", "room_pass", "roompass"],
    }[sem]
    cs = cols_of("matches")
    for p in pats:
        if p in cs:
            return p
    for p in pats:
        for c in cs:
            if p in c:
                return c
    return None


def jr_ign_col():
    for c in ("user_ign", "ign", "user_name", "username", "player_name", "display_name"):
        if c in cols_of("join_requests"):
            return c
    return None


def bal(uid_, col):
    r = q1(f"select {col} from users where id='{uid_}'")
    return float((r or {}).get(col) or 0)


def wallets(uid_):
    r = q1(f"select coins, green_diamonds, sky_diamonds from users where id='{uid_}'") or {}
    return {k: float(r.get(k) or 0) for k in ("coins", "green_diamonds", "sky_diamonds")}


def jr_rows(mid):
    return rows(f"select * from join_requests where match_id='{mid}'")


def rpcU(page, fn, args):
    return page.evaluate(
        """async (a) => { try { const r = await window._supa.rpc(a.f, a.args);
            return {data: (r.data === undefined ? null : r.data), err: r.error ? (r.error.message || 'error') : null}; }
           catch (e) { return {data: null, err: String(e)}; } }""", {"f": fn, "args": args})


def rpc_bad(res):
    """server ne reject kiya? (error ya success/ok === false)"""
    d = res.get("data") or {}
    return bool(res.get("err")) or d.get("success") is False or d.get("ok") is False


def rpc_err_code(res):
    d = res.get("data") or {}
    return str(d.get("error") or res.get("err") or "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--state", required=True)
    ap.add_argument("--out", default="/tmp/mf-out.json")
    ap.add_argument("--shots", default="mf-shots")
    A = ap.parse_args()
    global SHOTS
    SHOTS = pathlib.Path(A.shots)
    ST = json.load(open(A.state))
    AC = ST["accounts"]
    RUN = A.run

    def match_by_name(nm):
        return q1(f"select * from matches where {mcol('name')}=$u${nm}$u$ order by created_at desc limit 1")

    def wait_match(nm, timeout=90):
        return poll(lambda: match_by_name(nm), timeout=timeout, every=3, what=f"match {nm}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        pages = {}

        def new_user(tag):
            cred = AC[tag]
            ctx = browser.new_context(viewport={"width": 430, "height": 932}, locale="en-IN")
            page = ctx.new_page()
            page.goto(USER_URL, timeout=120000)
            page.wait_for_function("() => !!window.auth", timeout=90000)
            r = page.evaluate("""async (c) => { try { await window.auth.signInWithEmailAndPassword(c.e, c.p); return 'ok'; }
                                 catch (e) { return 'err:' + (e.code || e.message); } }""",
                              {"e": cred["email"], "p": cred["password"]})
            if r != "ok":
                raise RuntimeError(f"{tag} signin: {r}")
            page.wait_for_function("() => window.U && window.U.uid && window.UD && window._supa", timeout=90000)
            page.wait_for_function("() => window._supaTokenUid === window.U.uid", timeout=90000)
            clear_state_gate(page)
            page.wait_for_timeout(1200)
            pages[tag] = page
            return page

        # ══ PHASE A: logins ══════════════════════════════════════════════════
        log("PHASE A: logins (creator + admin + 7 players)")
        cpage = new_user("creator")
        is_cr = cpage.evaluate("() => !!(window.UD && (window.UD.isCreator || window.UD.is_creator))")
        proof("MF01", f"creator login + creator flag={is_cr}", is_cr)
        shot(cpage, "a-creator-home.png")

        actx = browser.new_context(viewport={"width": 1440, "height": 900})
        admin = actx.new_page()
        admin.goto(ADMIN_URL, timeout=120000)
        admin.wait_for_function("() => !!window.auth", timeout=90000)
        r = admin.evaluate("""async (c) => { try { await window.auth.signInWithEmailAndPassword(c.e, c.p); return 'ok'; }
                              catch (e) { return 'err:' + (e.code || e.message); } }""",
                           {"e": AC["admin"]["email"], "p": AC["admin"]["password"]})
        if r != "ok":
            raise RuntimeError("admin signin: " + r)
        admin.wait_for_function("() => !!window._supa", timeout=90000)
        admin.wait_for_timeout(2500)
        trust = "pehle se trusted"
        if admin.locator("#v21-device-verify").count():
            admin.fill("#v21DeviceVerifyEmail", AC["admin"]["email"])
            admin.click("#v21TrustBtn")
            admin.wait_for_selector("#v21-device-verify", state="detached", timeout=30000)
            trust = "new-device trust kiya"
        proof("MF02", f"admin panel login ({trust}) + _supa ready")
        shot(admin, "a-admin-panel.png")

        ign_ok = []
        for tag, ign, _k, _r in OWNER:
            p = new_user(tag)
            got = p.evaluate("() => (window.UD && window.UD.ign) || ''")
            ok = got == ign
            ign_ok.append(ok)
            proof(f"MF03.{tag}", f"{tag} login — UD.ign EXACT: db={got!r} want={ign!r}", ok)
        shot(pages["p1"], "a-p1-home.png")
        if not all(ign_ok):
            log("⚠️ kuch IGN byte-match nahi hue — aage continue (report me dikhega)")

        uid = {t: AC[t]["uid"] for t in AC}

        # ══ PHASE B: match creation (asli creator form UI) ═══════════════════
        log("PHASE B: create matches")

        def create_ui(page, name, mtype, fee, maxp, mode, kill, pz, mins):
            page.evaluate("() => window.showCreatorMatchForm()")
            page.wait_for_selector("#cmName", timeout=15000)
            page.fill("#cmName", name)
            page.select_option("#cmType", mtype)
            page.fill("#cmFee", str(fee))
            page.select_option("#cmMaxPlayers", str(maxp))
            page.select_option("#cmMode", mode)
            page.fill("#cmKillPts", str(kill))
            page.fill("#cmPrize1", str(pz[0]))
            page.fill("#cmPrize2", str(pz[1]))
            page.fill("#cmPrize3", str(pz[2]))
            dt = time.strftime("%Y-%m-%dT%H:%M", time.gmtime(time.time() + mins * 60 + 120))
            page.evaluate("(v) => { const e = document.getElementById('cmDateTime'); e.value = v; e.dispatchEvent(new Event('input', {bubbles:true})); }", dt)
            page.evaluate("() => window.submitCreatorMatch()")

        def neg_create(title, fee, pz):
            return rpcU(cpage, "creator_create_match", {
                "p_title": f"{title} {RUN}", "p_mode": "solo", "p_entry_type": "coins", "p_entry_fee": fee,
                "p_max_slots": 10, "p_per_kill_prize": 1,
                "p_scheduled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 7200)),
                "p_first_prize": pz[0], "p_second_prize": pz[1], "p_third_prize": pz[2]})

        M1N, M2N, M3N = f"MF7 Solo Cup {RUN}", f"MF7 Duo Green {RUN}", f"MF7 Squad Sky {RUN}"
        m1 = m2 = m3 = None
        try:
            create_ui(cpage, M1N, "coins", 10, 10, "solo", 1, (30, 20, 10), 120)
            m1 = wait_match(M1N)
            proof("MF10", f"M1 coins/solo fee=10 max=10 kill=1 prizes 30/20/10 created id={m1['id'][:8]} status={m1.get(mcol('status'))}", True)
        except Exception as e:
            diag = neg_create("MF7 Solo Cup", 10, (30, 20, 10))
            proof("MF10", f"M1 create FAIL: {str(e)[:140]}; server diag={json.dumps(diag, ensure_ascii=False)[:160]}", False)
        shot(cpage, "b-create-form.png")

        neg = neg_create("MF7 FeeTooBig", 51, (10, 5, 0))
        proof("MF11", f"fee=51 server-rejected: {json.dumps(neg, ensure_ascii=False)[:160]}",
              rpc_bad(neg) and "premium" not in rpc_err_code(neg))

        neg2 = neg_create("MF7 PrizeCap", 10, (200, 0, 0))
        proof("MF12", f"prize>max-collection server-rejected: {json.dumps(neg2, ensure_ascii=False)[:160]}",
              rpc_bad(neg2) and "premium" not in rpc_err_code(neg2))

        try:
            create_ui(cpage, M2N, "green_diamond", 20, 10, "duo", 1, (40, 20, 0), 150)
            m2 = wait_match(M2N)
            proof("MF13", f"M2 green_diamond/duo fee=20 created id={m2['id'][:8]}", True)
        except Exception as e:
            diag = rpcU(cpage, "creator_create_match", {"p_title": M2N, "p_mode": "duo", "p_entry_type": "green_diamond", "p_entry_fee": 20, "p_max_slots": 10, "p_per_kill_prize": 1, "p_scheduled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 9000)), "p_first_prize": 40, "p_second_prize": 20, "p_third_prize": 0})
            proof("MF13", f"M2 create FAIL: {str(e)[:140]}; server diag={json.dumps(diag, ensure_ascii=False)[:160]}", False)
        try:
            create_ui(cpage, M3N, "sky_diamond", 50, 25, "squad", 2, (100, 50, 0), 180)
            m3 = wait_match(M3N)
            proof("MF14", f"M3 sky_diamond/squad fee=50 created id={m3['id'][:8]}", True)
        except Exception as e:
            diag = rpcU(cpage, "creator_create_match", {"p_title": M3N, "p_mode": "squad", "p_entry_type": "sky_diamond", "p_entry_fee": 50, "p_max_slots": 25, "p_per_kill_prize": 2, "p_scheduled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 10800)), "p_first_prize": 100, "p_second_prize": 50, "p_third_prize": 0})
            proof("MF14", f"M3 create FAIL: {str(e)[:140]}; server diag={json.dumps(diag, ensure_ascii=False)[:160]}", False)

        neg3 = neg_create("MF7 Fourth", 10, (10, 0, 0))
        proof("MF15", f"4th open match server-rejected (limit 3): {json.dumps(neg3, ensure_ascii=False)[:160]}",
              rpc_bad(neg3) and "premium" not in rpc_err_code(neg3))

        if not (m1 and m2 and m3):
            log("matches create nahi hue — aage ke phases skip")
            finish(A)
            return

        M1, M2, M3 = m1["id"], m2["id"], m3["id"]
        tc, sc = mcol("time"), mcol("status")

        # ══ PHASE C: joins (asli cJoin modal UI) ═════════════════════════════
        log("PHASE C: joins")

        def ensure_mt(page, mid):
            page.evaluate("() => { try { navTo('matches'); } catch (e) {} }")
            page.wait_for_function("(id) => window.MT && window.MT[id]", arg=mid, timeout=60000)

        def open_join(page, mid):
            ensure_mt(page, mid)
            page.evaluate("(id) => window.cJoin(id)", mid)

        def join_solo(page, mid):
            open_join(page, mid)
            page.wait_for_selector("#confirmJoinBtn:not([disabled])", timeout=20000)
            page.click("#confirmJoinBtn")

        def accept_invites(mid, member_tags):
            """team_invitations (server consent) → members respond_team_invite."""
            tic = cols_of("team_invitations")
            mcolu = next((c for c in ("member_uid", "invitee_uid", "user_id", "uid") if c in tic), None)
            acc = []
            for t in member_tags:
                inv = q1(f"select id from team_invitations where match_id='{mid}' and {mcolu}='{uid[t]}' order by created_at desc limit 1") if mcolu else None
                if not inv:
                    acc.append(f"{t}:no-invite")
                    continue
                rr = rpcU(pages[t], "respond_team_invite", {"p_invite_id": inv["id"], "p_accept": True})
                acc.append(f"{t}:{'ok' if not rpc_bad(rr) else json.dumps(rr, ensure_ascii=False)[:60]}")
                time.sleep(1.2)
            return acc

        def join_team(captain_tag, mid, partner_tags, fee_type):
            """REAL UI: cJoin modal → #partnerUidN me FF UID → valPartner ✓ Found →
            fee-split → Confirm Join → (TEAM_NOT_AUTHORIZED → invites) → members
            accept → 31s lock wait → captain retry join."""
            page = pages[captain_tag]
            open_join(page, mid)
            page.wait_for_selector("#partnerUid1", timeout=20000)
            for i, t in enumerate(partner_tags, 1):
                page.fill(f"#partnerUid{i}", AC[t]["ff_uid"])
                page.dispatch_event(f"#partnerUid{i}", "input")
            page.wait_for_function("(n) => document.querySelectorAll('.pf-ok').length >= n",
                                   arg=len(partner_tags), timeout=30000)
            # fee split radio (captain_pays/each_pays) — asli control + fallback global
            picked = page.evaluate("""(ft) => {
                const rs = Array.from(document.querySelectorAll('input[type=radio]'));
                const r = rs.find(x => (x.value || x.id || '').toLowerCase().indexOf(ft.toLowerCase().slice(0,4)) !== -1);
                if (r) { r.checked = true; r.dispatchEvent(new Event('change', {bubbles:true})); r.click && r.click(); return 'radio:' + (r.value || r.id); }
                window._feeType = ft; return 'global'; }""", fee_type)
            shot(page, f"c-team-{captain_tag}-modal.png")
            page.click("#confirmJoinBtn")
            time.sleep(6)
            acc = accept_invites(mid, partner_tags)
            log(f"  invites({captain_tag}→{partner_tags}): {acc}")
            log("  31s join-lock wait (Bug#18 30s in-flight timer)…")
            time.sleep(31)
            page.evaluate("(id) => window.doJoin(id)", mid)  # captain retry (modal band ho chuka)
            time.sleep(5)
            return picked, acc

        # C1: saaton players M1 solo join
        pre = {t: wallets(uid[t]) for t in PTAGS}
        for t in PTAGS:
            try:
                join_solo(pages[t], M1)
            except Exception as e:
                log(f"  {t} solo join UI issue: {str(e)[:120]} — direct doJoin fallback")
                try:
                    open_join(pages[t], M1)
                except Exception:
                    pass
                pages[t].evaluate("(id) => { window._feeType='each_pays'; window.doJoin(id); }", M1)
            time.sleep(1.5)

        jrs = poll(lambda: (lambda rr: rr if len(rr) >= 7 else None)(jr_rows(M1)),
                   timeout=90, every=4, what="M1 7 joins")
        ignc = jr_ign_col()
        ign_map = {r.get("user_id"): (r.get(ignc) if ignc else None) for r in jrs}
        ign_all_ok = all(ign_map.get(uid[t]) == IGN_OF[t] for t in PTAGS) if ignc else None
        post = {t: wallets(uid[t]) for t in PTAGS}
        debits = {t: round(pre[t]["coins"] - post[t]["coins"], 2) for t in PTAGS}
        debit_ok = all(abs(debits[t] - 10) < 0.01 for t in PTAGS)
        proof("MF16", f"7/7 M1 solo joined (each ₹10 coins): {len(jrs)} rows; jr_ign_col={ignc} exact_all={ign_all_ok}; coin debits={debits}",
              len(jrs) >= 7 and debit_ok and ign_all_ok is not False)
        shot(pages["p1"], "c-m1-joined.png")

        # C2: creator self-join server-block
        selfj = rpcU(cpage, "validate_and_join_match", {
            "p_uid": uid["creator"], "p_match_id": M1, "p_entry_fee": 10, "p_currency": "coins",
            "p_join_data": json.dumps({"mode": "solo", "feeType": "each_pays"})})
        proof("MF17", f"creator self-join blocked: {json.dumps(selfj, ensure_ascii=False)[:160]}", rpc_bad(selfj))

        # C3: P1 duplicate join block (asli cJoin UI)
        n_before = len([r for r in jr_rows(M1) if r.get("user_id") == uid["p1"]])
        try:
            open_join(pages["p1"], M1)
            time.sleep(3)
        except Exception:
            pass
        pages["p1"].evaluate("(id) => { try { window.doJoin(id); } catch (e) {} }", M1)
        time.sleep(4)
        n_after = len([r for r in jr_rows(M1) if r.get("user_id") == uid["p1"]])
        proof("MF18", f"P1 duplicate join blocked (rows {n_before}→{n_after})", n_after == n_before == 1)

        # C4: M2 duo captain_pays — P6 captain + P7 partner (FF-UID search UI se)
        g6, g7 = bal(uid["p6"], "green_diamonds"), bal(uid["p7"], "green_diamonds")
        try:
            picked, acc = join_team("p6", M2, ["p7"], "captain_pays")
            jr2 = poll(lambda: (lambda rr: rr if len(rr) >= 2 else None)(jr_rows(M2)), timeout=60, every=3, what="M2 duo rows")
            g6a, g7a = bal(uid["p6"], "green_diamonds"), bal(uid["p7"], "green_diamonds")
            d6, d7 = round(g6 - g6a, 2), round(g7 - g7a, 2)
            proof("MF19", f"M2 duo captain_pays (feeUI={picked}, invites={acc}): {len(jr2)} rows; P6 green -{d6} (want 40), P7 -{d7} (want 0)",
                  abs(d6 - 40) < 0.01 and abs(d7) < 0.01)
        except Exception as e:
            proof("MF19", f"M2 duo join FAIL: {str(e)[:200]}", False)

        # C5: M3 squad each_pays — P5 captain + P2,P3,P4 partners
        wpre = {t: bal(uid[t], "sky_diamonds") for t in ("p5", "p2", "p3", "p4")}
        try:
            picked, acc = join_team("p5", M3, ["p2", "p3", "p4"], "each_pays")
            poll(lambda: (lambda rr: rr if len(rr) >= 4 else None)(jr_rows(M3)), timeout=60, every=3, what="M3 squad rows")
            wpost = {t: bal(uid[t], "sky_diamonds") for t in wpre}
            deltas = {t: round(wpre[t] - wpost[t], 2) for t in wpre}
            ok = all(abs(v - 50) < 0.01 for v in deltas.values())
            proof("MF20", f"M3 squad each_pays (feeUI={picked}, invites={acc}): 4 rows; sky deltas {deltas} (each 50)", ok)
        except Exception as e:
            proof("MF20", f"M3 squad join FAIL: {str(e)[:200]}", False)

        # C6: already-member P2 ka M3 re-join block
        n2b = len([r for r in jr_rows(M3) if r.get("user_id") == uid["p2"]])
        try:
            open_join(pages["p2"], M3)
            time.sleep(3)
        except Exception:
            pass
        pages["p2"].evaluate("(id) => { try { window.doJoin(id); } catch (e) {} }", M3)
        time.sleep(4)
        n2a = len([r for r in jr_rows(M3) if r.get("user_id") == uid["p2"]])
        proof("MF21", f"M3 re-join by existing member blocked (rows {n2b}→{n2a})", n2a == n2b)

        # ══ PHASE D: room / chat / reminder / gift ═══════════════════════════
        log("PHASE D: room flow")
        rc = mcol("room")
        ROOM_ID, ROOM_PW = f"MF777{RUN[-4:]}", f"MF888{RUN[-4:]}"
        rm = rpcU(cpage, "creator_set_room", {"p_match_id": M1, "p_room_id": ROOM_ID, "p_room_password": ROOM_PW})
        rowm = q1(f"select * from matches where id='{M1}'") or {}
        set_ok = (rowm.get(rc) == ROOM_ID) if rc else not rpc_bad(rm)
        proof("MF22", f"creator_set_room M1 → resp={json.dumps(rm, ensure_ascii=False)[:100]}; db {rc}={rowm.get(rc)}", set_ok)

        early = rpcU(pages["p1"], "get_room_credentials", {"p_match_id": M1})
        ed = early.get("data") or {}
        proof("MF23", f"room creds BEFORE release window refused: {json.dumps(early, ensure_ascii=False)[:160]}",
              rpc_bad(early) or "not_released" in json.dumps(ed))

        sql(f"update matches set {tc} = now() + interval '4 minutes' where id='{M1}'")
        time.sleep(2)

        def try_creds():
            rr = rpcU(pages["p1"], "get_room_credentials", {"p_match_id": M1})
            d = rr.get("data") or {}
            return rr if (d.get("success") or d.get("room_id")) else None
        try:
            rel = poll(try_creds, timeout=120, every=6, what="room release window")
            d = rel.get("data") or {}
            pw_got = d.get("room_password") or d.get("room_pass")
            ok = d.get("room_id") == ROOM_ID and pw_got == ROOM_PW
            proof("MF24", f"room creds released in window: id={d.get('room_id')} pass={pw_got}", ok)
        except Exception as e:
            proof("MF24", f"room creds after window-shift FAIL: {str(e)[:140]}", False)

        jr1 = q1(f"select id from join_requests where match_id='{M1}' and user_id='{uid['p1']}'") or {}
        cin = rpcU(pages["p1"], "confirm_in_room", {"p_join_id": jr1.get("id")})
        cd = cin.get("data") or {}
        proof("MF25", f"confirm_in_room P1: {json.dumps(cin, ensure_ascii=False)[:140]}",
              not cin.get("err") and cd.get("success") is not False)

        msg = f"MF7-hello-{RUN}"
        rpcU(pages["p1"], "send_match_chat", {"p_match_id": M1, "p_uid": uid["p1"], "p_name": IGN_OF["p1"], "p_text": msg})
        time.sleep(2)
        g1 = rpcU(pages["p2"], "get_match_chat", {"p_match_id": M1, "p_uid": uid["p2"], "p_limit": 60})
        blob = json.dumps(g1.get("data"), ensure_ascii=False)
        proof("MF26", f"match chat P1→P2: msg-found={msg in blob} sender-ign-exact={IGN_OF['p1'] in blob}",
              msg in blob and IGN_OF["p1"] in blob)

        rem = rpcU(pages["p2"], "set_match_reminder", {"p_uid": uid["p2"], "p_match_id": M1, "p_mins": 10})
        intr = rpcU(pages["p2"], "toggle_match_interest", {"p_uid": uid["p2"], "p_match_id": M1, "p_name": M1N})
        proof("MF27", f"reminder={json.dumps(rem, ensure_ascii=False)[:90]} interest={json.dumps(intr, ensure_ascii=False)[:90]}",
              not rpc_bad(rem) and not rpc_bad(intr))

        cpre = wallets(uid["p1"])
        gift = rpcU(pages["p1"], "gift_match_entry", {"p_match_id": M1, "p_to_uid": uid["b1"]})
        time.sleep(3)
        gjr = q1(f"select * from join_requests where match_id='{M1}' and user_id='{uid['b1']}'")
        cpost = wallets(uid["p1"])
        charged = any(abs(cpre[k] - cpost[k]) > 0.01 for k in cpre)
        proof("MF28", f"gift_match_entry P1→Bench1: row={bool(gjr)} p1-debit={charged} resp={json.dumps(gift, ensure_ascii=False)[:110]}",
              bool(gjr) and not rpc_bad(gift))

        # ══ PHASE E: cancel + refunds ════════════════════════════════════════
        log("PHASE E: cancel + refund")
        can2 = rpcU(admin, "cancel_match_with_refunds", {"p_match_id": M2})
        st2 = (q1(f"select {sc} as s from matches where id='{M2}'") or {}).get("s")
        proof("MF29", f"admin cancel M2 → status={st2} resp={json.dumps(can2, ensure_ascii=False)[:110]}",
              str(st2).lower() in ("cancelled", "canceled"))

        g6b, g7b = bal(uid["p6"], "green_diamonds"), bal(uid["p7"], "green_diamonds")
        for r in jr_rows(M2):
            who = "p6" if r.get("user_id") == uid["p6"] else "p7"
            rpcU(pages[who], "claim_match_refund", {"p_join_id": r.get("id"), "p_uid": r.get("user_id")})
            time.sleep(1.5)
        g6c, g7c = bal(uid["p6"], "green_diamonds"), bal(uid["p7"], "green_diamonds")
        r6, r7 = round(g6c - g6b, 2), round(g7c - g7b, 2)
        proof("MF30", f"M2 refunds: P6 +{r6} green (want 40 — captain_pays dono slots), P7 +{r7} (want 0)",
              abs(r6 - 40) < 0.01 and abs(r7) < 0.01)

        sky_pre = {t: bal(uid[t], "sky_diamonds") for t in ("p5", "p2", "p3", "p4")}
        can3 = rpcU(admin, "cancel_match_with_refunds", {"p_match_id": M3})
        st3 = (q1(f"select {sc} as s from matches where id='{M3}'") or {}).get("s")
        for r in jr_rows(M3):
            u = r.get("user_id")
            tg = next((t for t in sky_pre if uid[t] == u), None)
            if tg:
                rpcU(pages[tg], "claim_match_refund", {"p_join_id": r.get("id"), "p_uid": u})
                time.sleep(1.2)
        sky_post = {t: bal(uid[t], "sky_diamonds") for t in sky_pre}
        rd = {t: round(sky_post[t] - sky_pre[t], 2) for t in sky_pre}
        proof("MF31", f"admin cancel M3 (status={st3}) → sky refunds {rd} (each want 50)",
              str(st3).lower() in ("cancelled", "canceled") and all(abs(v - 50) < 0.01 for v in rd.values()))

        # ══ PHASE F: results with OWNER's real screenshot data ═══════════════
        log("PHASE F: result upload + publish + correction")
        sql(f"update matches set {tc} = now() - interval '30 minutes' where id='{M1}'")
        try:
            if sc:
                sql(f"update matches set {sc}='live' where id='{M1}' and {sc} not in ('completed','cancelled','canceled')")
        except Exception as e:
            log("  status→live update skip: " + str(e)[:100])
        time.sleep(2)

        # F1: creator result form (asli UI) — owner ka EXACT data stage karo
        try:
            cpage.evaluate("(id) => window.showCreatorResultForm(id)", M1)
            cpage.wait_for_selector("._crKills", timeout=30000)
            time.sleep(2)
            n_inputs = cpage.evaluate("() => document.querySelectorAll('._crKills').length")
            jrs1 = jr_rows(M1)
            jid_by_uid = {r.get("user_id"): r.get("id") for r in jrs1}
            fill = [{"jid": jid_by_uid.get(uid[t]), "k": k, "r": rk} for t, ign, k, rk in OWNER if uid[t] in jid_by_uid]
            cpage.evaluate("""(f) => { f.forEach(x => {
                const k = document.querySelector('._crKills[data-jr="' + x.jid + '"]');
                const p = document.querySelector('._crPlacement[data-jr="' + x.jid + '"]');
                if (k) { k.value = x.k; k.dispatchEvent(new Event('input', {bubbles:true})); }
                if (p) { p.value = x.r; p.dispatchEvent(new Event('input', {bubbles:true})); } }); }""", fill)
            shot(cpage, "f-creator-result-form.png")
            cpage.evaluate("(id) => window.submitCreatorResult(id)", M1)
            time.sleep(5)
            staged = jr_rows(M1)
            rescols = [c for c in cols_of("join_requests") if any(x in c for x in ("kill", "place", "rank", "result"))]
            filled = sum(1 for r in staged if any(r.get(c) not in (None, "", 0, "0") for c in rescols))
            proof("MF32", f"creator result form: {n_inputs} inputs (want ≥7); owner kill/rank data staged — cols={rescols} filled_rows={filled}/{len(staged)}",
                  n_inputs >= 7 and filled >= 7)
        except Exception as e:
            proof("MF32", f"creator result staging FAIL: {str(e)[:200]}", False)

        # F2: admin publish (gateway edge function — single money authority)
        w_pre = {t: wallets(uid[t]) for t in PTAGS}
        pub_res = [{"user_id": uid[t], "rank": rk, "kills": k} for t, ign, k, rk in OWNER]
        pub = rpcU(admin, "publish_match_results", {"p_match_id": M1, "p_results": pub_res})
        pd_ = pub.get("data") or {}
        time.sleep(3)
        w_post = {t: wallets(uid[t]) for t in PTAGS}
        deltas = {}
        for t in PTAGS:
            dd = {k: round(w_post[t][k] - w_pre[t][k], 2) for k in w_pre[t] if abs(w_post[t][k] - w_pre[t][k]) > 0.001}
            if dd:
                deltas[t] = dd
        st1 = (q1(f"select {sc} as s from matches where id='{M1}'") or {}).get("s")
        proof("MF33", f"admin publish_match_results (OWNER data: KESHAV 3k/#1, hjVikram 1k/#5) → {json.dumps(pub, ensure_ascii=False)[:150]}; match status={st1}; wallet deltas={json.dumps(deltas, ensure_ascii=False)}",
              pd_.get("ok") is True and str(st1).lower() in ("completed", "finished", "done"))
        shot(admin, "f-admin-after-publish.png")

        # F3: correction — hjVikram kills 1→2 (was_correction path)
        w5pre = wallets(uid["p5"])
        corr_res = [{"user_id": uid[t], "rank": rk, "kills": (2 if t == "p5" else k)} for t, ign, k, rk in OWNER]
        corr = rpcU(admin, "publish_match_results", {"p_match_id": M1, "p_results": corr_res})
        cd2 = corr.get("data") or {}
        time.sleep(3)
        w5post = wallets(uid["p5"])
        d5 = {k: round(w5post[k] - w5pre[k], 2) for k in w5pre if abs(w5post[k] - w5pre[k]) > 0.001}
        proof("MF34", f"correction re-publish (hjVikram 1→2 kills) → was_correction={cd2.get('was_correction')} corrections={cd2.get('corrections')} P5 extra={d5}",
              cd2.get("ok") is True and bool(cd2.get("was_correction")) and bool(d5))

        # F4: rating
        rate = rpcU(pages["p1"], "rate_creator_match", {"p_match_id": M1, "p_uid": uid["p1"], "p_rating": 5})
        proof("MF35", f"rate_creator_match P1→5★: {json.dumps(rate, ensure_ascii=False)[:140]}", not rpc_bad(rate))

        # F5: history/list DOM me owner ka EXACT IGN (Unicode render proof)
        try:
            p1 = pages["p1"]
            p1.evaluate("() => { try { navTo('matches'); } catch (e) {} }")
            time.sleep(4)
            try:
                p1.evaluate("() => { const el = document.querySelector('[onclick*=history], #histTab, [data-tab=history]'); if (el) el.click(); }")
                time.sleep(2)
            except Exception:
                pass
            html = p1.content()
            found = IGN_OF["p1"] in html
            proof("MF36", f"user panel DOM me EXACT IGN render: 'KESHAV·SAINi' found={found}", found)
            shot(p1, "f-p1-history.png")
        except Exception as e:
            proof("MF36", f"history check FAIL: {str(e)[:150]}", False)

        # F6: cancelled matches client list me cancelled/absent
        try:
            ensure_mt(pages["p6"], M1)
            gone = pages["p6"].evaluate("""(a) => { const es = (t) => t ? String(t.status || '').toLowerCase() : 'absent';
                return {m2: es(window.MT[a.m2]), m3: es(window.MT[a.m3])}; }""", {"m2": M2, "m3": M3})
            proof("MF37", f"cancelled M2/M3 client-side status: {json.dumps(gone)}",
                  all(v in ("cancelled", "canceled", "absent") for v in gone.values()))
        except Exception as e:
            proof("MF37", f"cancelled-list check FAIL: {str(e)[:140]}", False)

    finish(A)


def finish(A):
    okc = sum(1 for r in RESULTS if r["ok"])
    out = {"run": A.run, "ok": okc, "total": len(RESULTS), "results": RESULTS}
    pathlib.Path(A.out).parent.mkdir(parents=True, exist_ok=True)
    json.dump(out, open(A.out, "w"), indent=1, ensure_ascii=False)
    log(f"MATCH-FLOW-E2E: {okc}/{len(RESULTS)} OK → {A.out}")
    for r in RESULTS:
        if not r["ok"]:
            log("  ❌ " + r["id"] + ": " + r["msg"][:220])
    sys.exit(0 if okc == len(RESULTS) else 1)


if __name__ == "__main__":
    main()
