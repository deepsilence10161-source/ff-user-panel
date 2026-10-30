#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OCR-ACCURACY LIVE E2E (2026-10-30, saatvaan directive follow-up)
Owner ke ASLI Free Fire screenshots (2 result-screen + 1 lobby) ko admin panel
ke FA53 Tesseract.js OCR auto-fill pipeline (fa53-ocr-autofill.js v7 + fa53-ocr-
engine-plus.js) se guzaaro — bilkul waise jaise admin karta hai: Match Result
section → match select → screenshot upload → auto OCR → rank/kills fill.
Phir ground-truth (owner data) se accuracy naapo:
  - pehchaan: kitni rows me OCR ne fill kiya (7 me se)
  - kills / rank sahi ya galat (per-row, per-image)
  - ambiguity-guard skips (review box), verified-badge, engine stats
Lobby image: Joined Players section ka "OCR Verify" (runLobby) — auto-ticks.
Koi mock/stub NAHI — asli tesseract.js v5 wasm worker, asli CSP, asli DOM.
"""
import argparse, json, os, sys, time

from playwright.sync_api import sync_playwright

USER_URL = os.environ.get("USER_URL", "https://deepsilence10161-source.github.io/ff-user-panel/")
ADMIN_URL = os.environ.get("ADMIN_URL", "https://deepsilence10161-source.github.io/ff-admin-panel/")

# ground truth — owner ke screenshots se verbatim (result screens):
OWNER = [
    ("p1", "KESHAV·SAINi", 3, 1),
    ("p2", "Wail160g0_9", 0, 2),
    ("p3", "Linox모444..", 0, 3),
    ("p4", "મેહુલવસાવા1", 0, 4),
    ("p5", "hjVikram", 1, 5),
    ("p6", "AKGINMG", 0, 6),
    ("p7", "N0dc21b349c3", 0, 7),
]
GT = {ign: (k, r) for _t, ign, k, r in OWNER}


def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def proof(pid, msg, ok=True):
    print(f"OCR-PROOF-{'OK' if ok else 'FAIL'}: {pid}: {msg}", flush=True)


def main():
    A = argparse.ArgumentParser()
    A.add_argument("--state", required=True)
    A.add_argument("--fixtures", required=True)
    A.add_argument("--shots", default="ocr-shots")
    args = A.parse_args()

    os.makedirs(args.shots, exist_ok=True)
    AC = json.load(open(args.state))["accounts"]
    uid = {t: AC[t]["uid"] for t in AC}
    fails = []

    def shot(page, name):
        try:
            page.screenshot(path=os.path.join(args.shots, name), full_page=False)
        except Exception as e:
            log(f"  shot {name} skip: {e}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])

        def rpcU(page, fn, a):
            return page.evaluate(
                """async (x) => { try { const r = await window._supa.rpc(x.f, x.a);
                   return {data: (r && r.data !== undefined) ? r.data : null, err: (r && r.error) ? r.error.message : null}; }
                   catch (e) { return {data: null, err: String(e)}; } }""",
                {"f": fn, "a": a})

        # ── creator login ──
        ctx = browser.new_context(viewport={"width": 430, "height": 932}, locale="en-IN")
        cpage = ctx.new_page()
        cpage.goto(USER_URL, timeout=120000)
        cpage.wait_for_function("() => !!window.auth", timeout=90000)
        r = cpage.evaluate("""async (c) => { try { await window.auth.signInWithEmailAndPassword(c.e, c.p); return 'ok'; }
                             catch (e) { return 'err:' + (e.code || e.message); } }""",
                           {"e": AC["creator"]["email"], "p": AC["creator"]["password"]})
        if r != "ok":
            raise RuntimeError(f"creator signin: {r}")
        cpage.wait_for_function("() => window.U && window.U.uid && window.UD && window._supa", timeout=90000)
        proof("OCR01", "creator login OK")

        # ── M1 create (coins/solo) + 7/7 join server-side ──
        title = f"OCR-ACC-M1-{int(time.time())}"
        sched = time.strftime("%Y-%m-%dT%H:%M:00Z", time.gmtime(time.time() + 7200))
        cres = rpcU(cpage, "creator_create_match", {
            "p_title": title, "p_mode": "solo", "p_entry_type": "coins", "p_entry_fee": 10,
            "p_max_slots": 10, "p_per_kill_prize": 1, "p_scheduled_at": sched,
            "p_first_prize": 30, "p_second_prize": 20, "p_third_prize": 10})
        row = cpage.evaluate("""async (t) => { const r = await window._supa.from('matches').select('id,status').eq('title', t).order('created_at',{ascending:false}).limit(1).maybeSingle();
                               return r.data; }""", title)
        M1 = (row or {}).get("id") or ""
        proof("OCR02", f"M1 create: {json.dumps(cres, ensure_ascii=False)[:140]} id={M1[:10]}", bool(M1))
        joined = 0
        for i, (t, ign, _k, _r) in enumerate(OWNER):
            # join APSNI page/session se hona chahiye (server p_uid vs JWT verify karta hai)
            pctx = browser.new_context(viewport={"width": 430, "height": 932}, locale="en-IN")
            pp = pctx.new_page()
            pp.goto(USER_URL, timeout=120000)
            pp.wait_for_function("() => !!window.auth", timeout=90000)
            rr = pp.evaluate("""async (c) => { try { await window.auth.signInWithEmailAndPassword(c.e, c.p); return 'ok'; }
                                 catch (e) { return 'err:' + (e.code || e.message); } }""",
                             {"e": AC[t]["email"], "p": AC[t]["password"]})
            if rr != "ok":
                log(f"  signin {t}: {rr}")
                pctx.close()
                continue
            pp.wait_for_function("() => window.U && window._supa && window._supaTokenUid === window.U.uid", timeout=90000)
            j = rpcU(pp, "validate_and_join_match", {
                "p_uid": uid[t], "p_match_id": M1, "p_entry_fee": 10, "p_currency": "coins",
                "p_join_data": {"requestId": f"ocr-{t}", "userName": ign, "userFFUID": AC[t].get("ff_uid", ""),
                                "ign": ign, "matchName": title, "mode": "solo", "slotsBooked": 1,
                                "slotNumber": str(i + 1), "allSlots": json.dumps([str(i + 1)]),
                                "feeType": "each_pays", "isTeamMember": False,
                                "createdAt": int(time.time() * 1000)}})
            ok = (j.get("data") or {}).get("ok") is True or (j.get("data") or {}).get("success") is True
            joined += 1 if ok else 0
            if not ok:
                log(f"  join {t}: {json.dumps(j, ensure_ascii=False)[:160]}")
            pctx.close()
        nrow = cpage.evaluate("""async (m) => { const r = await window._supa.from('join_requests').select('id').eq('match_id', m);
                               return r.data ? r.data.length : -1; }""", M1)
        proof("OCR03", f"7/7 solo join (player sessions se server RPC): {joined}/7 ok; join_requests rows={nrow}", joined == 7)

        # ── admin login ──
        actx = browser.new_context(viewport={"width": 1440, "height": 900})
        admin = actx.new_page()
        admin.goto(ADMIN_URL, timeout=120000)
        admin.wait_for_function("() => !!window.auth", timeout=90000)
        r = admin.evaluate("""async (c) => { try { await window.auth.signInWithEmailAndPassword(c.e, c.p); return 'ok'; }
                              catch (e) { return 'err:' + (e.code || e.message); } }""",
                           {"e": AC["admin"]["email"], "p": AC["admin"]["password"]})
        if r != "ok":
            raise RuntimeError(f"admin signin: {r}")
        admin.wait_for_function("() => !!window._supa", timeout=90000)
        admin.wait_for_timeout(2500)
        trust = "pehle se trusted"
        if admin.locator("#v21-device-verify").count():
            admin.fill("#v21DeviceVerifyEmail", AC["admin"]["email"])
            admin.click("#v21TrustBtn")
            admin.wait_for_selector("#v21-device-verify", state="detached", timeout=30000)
            trust = "new-device trust kiya"
        proof("OCR04", f"admin login ({trust}); tesseract engine loaded: "
                       f"{admin.evaluate('() => !!(window._FFREOCR && window.fa53Plus)')}", True)

        # ── Match Result section + roster ──
        admin.evaluate("() => showSection('results')")
        admin.wait_for_selector("#mrPlayerTable", timeout=30000)
        admin.wait_for_function("() => !!window.loadMatchResultSection", timeout=30000)
        admin.evaluate("""(mid) => { const s = document.getElementById('mrMatchFilter');
            if (s) { s.value = mid; } }""", M1)
        admin.evaluate("() => window.loadMatchResultSection()")
        admin.wait_for_function("() => document.querySelectorAll('#mrPlayerTable tr[data-uid]').length >= 7",
                                timeout=60000)
        proof("OCR05", "result section: 7 player rows loaded (OCR roster ready)")

        def rows_now():
            return admin.evaluate("""() => [...document.querySelectorAll('#mrPlayerTable tr[data-uid]')]
                .map(tr => ({ uid: tr.dataset.uid,
                              name: (tr.querySelector('td div[title]') || {}).title || '',
                              rank: tr.querySelector('.mr-rank-input').value,
                              kills: tr.querySelector('.mr-kills-input').value }))""")

        def wait_ocr_done(tag, max_s=300):
            t0 = time.time()
            try:
                admin.wait_for_function("() => window._ocrWorkerBusy === true", timeout=45000)
                log(f"  [{tag}] OCR worker busy…")
            except Exception:
                log(f"  [{tag}] busy-flag start miss (already running ya fast)")
            admin.wait_for_function("() => window._ocrWorkerBusy !== true", timeout=max_s * 1000)
            last = None
            while time.time() - t0 < max_s:
                cur = rows_now()
                if cur == last:
                    return cur
                last = cur
                time.sleep(3)
            return last

        def acc_report(tag, before, after):
            filled = [r for r in after if (r["rank"] != "" or r["kills"] != "")
                      and all(b["uid"] != r["uid"] or (b["rank"] == "" and b["kills"] == "") for b in before)]
            identified = len(filled)
            kills_ok = sum(1 for r in filled if r["name"] in GT and int(r["kills"] or 0) == GT[r["name"]][0])
            rank_ok = sum(1 for r in filled if r["name"] in GT and int(r["rank"] or 0) == GT[r["name"]][1])
            pair_ok = sum(1 for r in filled if r["name"] in GT and int(r["kills"] or 0) == GT[r["name"]][0]
                          and int(r["rank"] or 0) == GT[r["name"]][1])
            wrong = [f"{r['name']}:{r['kills'] or 0}k/#{r['rank'] or 0}" for r in filled
                     if r["name"] in GT and (int(r["kills"] or 0) != GT[r["name"]][0] or int(r["rank"] or 0) != GT[r["name"]][1])]
            unknown = [r["name"] for r in filled if r["name"] not in GT]
            return identified, kills_ok, rank_ok, pair_ok, wrong, unknown

        results = {}
        for idx, fname in (("RES-1", "ocr-res-1.jpg"), ("RES-2", "ocr-res-2.jpg")):
            path = os.path.join(args.fixtures, fname)
            if not os.path.exists(path):
                proof(f"OCR06.{idx}", f"fixture missing {fname}", False)
                fails.append(idx)
                continue
            before = rows_now()
            admin.set_input_files("#mrFileInput", path)
            after = wait_ocr_done(idx)
            badge = admin.evaluate("() => (document.getElementById('_ocrVerifiedBadge') || {}).textContent || ''")
            review = admin.evaluate("() => (document.getElementById('_ocrEliminationReview') || {}).innerText || ''")
            stats = admin.evaluate("() => { try { return window.fa53Plus ? window.fa53Plus.stats() : null; } catch (e) { return null; } }")
            ident, kok, rok, pok, wrong, unknown = acc_report(idx, before, after)
            results[idx] = dict(identified=ident, kills_ok=kok, rank_ok=rok, pair_ok=pok,
                                wrong=wrong, unknown=unknown, badge=badge.strip(),
                                review=review[:220], stats=stats)
            proof(f"OCR06.{idx}",
                  f"{fname}: auto-fill {ident}/7 rows; kills {kok}/7 sahi; rank {rok}/7 sahi; "
                  f"pair-exact {pok}/7; galat={wrong}; unknown={unknown}; badge='{badge.strip()[:60]}'; "
                  f"review='{review[:120].replace(chr(10), ' | ')}'; stats={json.dumps(stats)[:140]}",
                  ident >= 5)
            shot(admin, f"ocr-{idx.lower()}.png")
            # agla image saaf slate par
            admin.evaluate("() => { try { window.mrClearScreenshots && window.mrClearScreenshots(); } catch (e) {} }")
            admin.evaluate("""() => { document.querySelectorAll('#mrPlayerTable .mr-rank-input, #mrPlayerTable .mr-kills-input')
                            .forEach(i => i.value = ''); const f = document.getElementById('mrFileInput'); if (f) f.value = ''; }""")
            admin.wait_for_timeout(800)

        # ── LOBBY image: Joined Players → OCR Verify (runLobby) ──
        try:
            admin.evaluate("() => showSection('joinedPlayers')")
            admin.wait_for_selector("#joinedPlayersTable", timeout=30000)
            admin.wait_for_function("() => !!window.loadJoinedPlayers", timeout=30000)
            admin.evaluate("""(mid) => { const s = document.getElementById('joinedTournamentFilter'); if (s) s.value = mid; }""", M1)
            admin.evaluate("() => window.loadJoinedPlayers()")
            admin.wait_for_function("() => document.querySelectorAll('#joinedPlayersTable tr').length >= 7", timeout=60000)
            pre_ticks = admin.evaluate("() => document.querySelectorAll('#joinedPlayersTable input[type=checkbox]:checked').length")
            lpath = os.path.join(args.fixtures, "ocr-lobby.jpg")
            admin.set_input_files("#_ocrLFile", lpath)
            t0 = time.time()
            try:
                admin.wait_for_function("() => window._ocrWorkerBusy === true", timeout=45000)
            except Exception:
                pass
            admin.wait_for_function("() => window._ocrWorkerBusy !== true", timeout=300000)
            admin.wait_for_timeout(4000)
            ticks = admin.evaluate("() => document.querySelectorAll('#joinedPlayersTable input[type=checkbox]:checked').length")
            lbadge = admin.evaluate("() => (document.getElementById('_ocrVerifiedBadge') || {}).textContent || ''")
            lreview = admin.evaluate("() => (document.getElementById('_ocrEliminationReview') || {}).innerText || ''")
            proof("OCR07", f"lobby OCR: auto-tick {pre_ticks} → {ticks}/7; badge='{lbadge.strip()[:60]}'; "
                           f"review='{lreview[:120].replace(chr(10), ' | ')}'", ticks >= 5)
            shot(admin, "ocr-lobby.png")
        except Exception as e:
            proof("OCR07", f"lobby OCR path FAIL: {str(e)[:160]}", False)
            fails.append("LOBBY")

        # ── summary ──
        tot_i = sum(v["identified"] for v in results.values())
        tot_k = sum(v["kills_ok"] for v in results.values())
        tot_r = sum(v["rank_ok"] for v in results.values())
        tot_p = sum(v["pair_ok"] for v in results.values())
        denom = 7 * max(1, len(results))
        log(f"OCR-ACC-SUMMARY: images={len(results)} identified={tot_i}/{denom} "
            f"kills={tot_k}/{denom} rank={tot_r}/{denom} pair-exact={tot_p}/{denom} "
            f"({round(100.0 * tot_p / denom, 1)}%)")
        browser.close()

    if fails:
        log(f"OCR-DRIVER: FAILS={fails}")
        sys.exit(1)
    log("OCR-DRIVER: done")


if __name__ == "__main__":
    main()
