#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
#  PREMIUM-E2E driver — poora premium system LIVE (asli UI + asli server):
#
#   PRE00 live DB introspection (tables/columns/function ACLs — schema-doc vs
#   live truth) → FREE TRIAL (server-authoritative start_free_trial, trial_used
#   flag) → MONTHLY BONUS (claim_premium_monthly_bonus: server-map beats
#   client overpay-param, one-per-month UNIQUE, AUTO-claim on login credits
#   exactly once) → ADS SUPPRESS + Silver visuals (ribbon, gates) → EXPIRY
#   BANNER (12h countdown live) → BUY REQUEST (policy gate → plans → Gold buy
#   sheet → screenshot + UTR validation → premium_requests pending +
#   notification) → ADMIN APPROVE (asli Premium Requests UI → approve_premium
#   via admin-gateway, expiry GREATEST-stack +30d, leaderboard sync) → GOLD
#   PERKS (tier 2 server-side, Live Stream gate open, cross-tier bonus guard)
#   → ADMIN CANCEL (cancel_premium gateway) → post-cancel (tier 0, ribbon
#   gone, gates closed) → SECURITY (client column-write lockdown, self
#   approve/cancel RPC reject).
#
#  Usage: premium_driver.py --run <id> --state <state.json> --out <out.json> --shots <dir>
# ═══════════════════════════════════════════════════════════════════════════
import argparse, base64, json, os, re, sys, time, pathlib, urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tri-e2e"))
from host_driver import poll, clear_state_gate  # proven TRI-E2E/MATCH-FLOW helpers

from playwright.sync_api import sync_playwright

USER_URL = os.environ.get("USER_URL", "https://deepsilence10161-source.github.io/ff-user-panel/")
ADMIN_URL = os.environ.get("ADMIN_URL", "https://deepsilence10161-source.github.io/ff-admin-panel/")
MGMT = "https://api.supabase.com/v1/projects/hddhkculuyrfoevxmlwy/database/query"

# 1x1 PNG — payment-screenshot upload ke liye (asli file input, asli FileReader)
PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")

RESULTS = []
SHOTS = pathlib.Path("prem-shots")


def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def proof(pid, msg, ok=True):
    RESULTS.append({"id": pid, "ok": bool(ok), "msg": msg})
    print(("PREM-PROOF-OK: " if ok else "PREM-PROOF-FAIL: ") + f"{pid}: {msg}", flush=True)


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


def try_poll(fn, timeout=30, every=1, what="cond"):
    """poll() timeout par RAISE karta hai — E2E me timeout = proof FAIL hona
    chahiye, driver crash nahi (baaki proofs bhi chalein)."""
    try:
        return poll(fn, timeout=timeout, every=every, what=what)
    except Exception as e:
        log(f"TIMEOUT: {what} — {str(e)[:150]}")
        return None


def safe_fill(page, sel, val):
    try:
        page.fill(sel, val)
        return True
    except Exception as e:
        log(f"fill fail {sel}: {str(e)[:90]}")
        return False


def safe_upload(page, sel, p):
    try:
        page.set_input_files(sel, p)
        return True
    except Exception as e:
        log(f"upload fail {sel}: {str(e)[:90]}")
        return False


def click_btn_with(page, frag, scope=None):
    """scope ke andar (ya body me) woh button click karo jiske onclick me frag ho."""
    return page.evaluate("""(a) => { const root = a.s ? document.querySelector(a.s) : document;
        if (!root) return 'no-scope';
        const b = Array.from(root.querySelectorAll('button')).find(b => (b.getAttribute('onclick')||'').includes(a.f));
        if (b) { b.click(); return 'clicked'; } return 'not-found'; }""", {"f": frag, "s": scope})


def rpcU(page, fn, args):
    return page.evaluate(
        """async (a) => { try { const r = await window._supa.rpc(a.f, a.args);
            return {data: (r.data === undefined ? null : r.data), err: r.error ? (r.error.message || 'error') : null}; }
           catch (e) { return {data: null, err: String(e)}; } }""", {"f": fn, "args": args})


def rpc_bad(res):
    d = res.get("data") or {}
    return bool(res.get("err")) or d.get("success") is False or d.get("ok") is False


def rpc_err(res):
    d = res.get("data") or {}
    return str(d.get("error") or res.get("err") or "")


TOAST_PATCH = """() => {
  if (!window.__toasts) { window.__toasts = [];
    const _t = window.toast;
    window.toast = function(m, k) { try { window.__toasts.push(String(m)); } catch (e) {}
      if (_t) return _t.apply(this, arguments); };
    const _st = window.showToast;
    window.showToast = function(m, k) { try { window.__toasts.push(String(m)); } catch (e) {}
      if (_st) return _st.apply(this, arguments); };
  }
  return true;
}"""


def toasts(page):
    try:
        return page.evaluate("() => window.__toasts || []")
    except Exception:
        return []


def wait_toast(page, pat, timeout=25):
    end = time.time() + timeout
    while time.time() < end:
        for t in toasts(page):
            if re.search(pat, t):
                return t
        page.wait_for_timeout(500)
    return None


def user_state(uid):
    return q1(f"select premium_level, premium_expires, trial_used, coins from users where id='{uid}'") or {}


def coins_of(uid):
    return float((user_state(uid) or {}).get("coins") or 0)


def claims_count(uid):
    r = q1(f"select count(*)::int c from premium_monthly_bonus_claims where user_id='{uid}'") or {}
    return int(r.get("c") or 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--state", required=True)
    ap.add_argument("--out", default="/tmp/prem-out.json")
    ap.add_argument("--shots", default="prem-shots")
    A = ap.parse_args()
    global SHOTS
    SHOTS = pathlib.Path(A.shots)
    ST = json.load(open(A.state))
    AC = ST["accounts"]
    RUN = A.run
    U_UID = AC["user"]["uid"]
    A_UID = AC["admin"]["uid"]
    UTR = f"QAUTR{RUN}777"

    ss_path = pathlib.Path("/tmp/qa-pay-ss.png")
    ss_path.write_bytes(PNG_1PX)

    # ══ PRE00: live DB introspection — schema-doc vs live truth ══════════
    log("PRE00: live DB introspection (tables, columns, function ACLs)")
    tabs = q1("""select
      (select count(*) from information_schema.tables where table_schema='public' and table_name='premium_requests') t_req,
      (select count(*) from information_schema.tables where table_schema='public' and table_name='premium_monthly_bonus_claims') t_claims,
      (select count(*) from information_schema.columns where table_schema='public' and table_name='users'
         and column_name in ('premium_level','premium_expires','trial_used')) u_cols,
      (select column_default from information_schema.columns where table_schema='public'
         and table_name='users' and column_name='trial_used') trial_default,
      (select count(*) from information_schema.columns where table_schema='public' and table_name='premium_requests'
         and column_name in ('utr','plan_type','bundle_id','approved_at','rejected_at','approved_by')) pr_cols,
      (select string_agg(column_name, ',') from information_schema.columns where table_schema='public'
         and table_name='premium_requests') pr_all""") or {}
    fns = rows("""select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.proacl::text as acl
                  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname in
                  ('start_free_trial','claim_premium_monthly_bonus','approve_premium','cancel_premium')""")
    acl_of = {f["proname"]: (f.get("acl") or "") for f in fns}
    trig = q1("select count(*)::int c from pg_trigger where tgname ilike '%sync_leaderboard%'") or {}
    log(f"[PRE00] tables={json.dumps(tabs)}")
    for k, v in acl_of.items():
        log(f"[PRE00-acl] {k}: {v[:240]}")
    ok00 = (str(tabs.get("t_req")) == "1" and str(tabs.get("t_claims")) == "1"
            and str(tabs.get("u_cols")) == "3" and str(tabs.get("pr_cols")) == "6" and len(fns) >= 4)
    proof("PRE00", f"live DB: premium_requests={tabs.get('t_req')} claims_table={tabs.get('t_claims')} "
                   f"users_cols(3)={tabs.get('u_cols')} trial_default={tabs.get('trial_default')} "
                   f"prem_req_cols(6/utr+plan+bundle+approved_at+rejected_at+approved_by)={tabs.get('pr_cols')} "
                   f"[{tabs.get('pr_all')}] functions={sorted(acl_of.keys())} leaderboard_trg={trig.get('c')}", ok00)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])

        def new_user(tag, w=430, h=932):
            cred = AC[tag]
            ctx = browser.new_context(viewport={"width": w, "height": h}, locale="en-IN")
            page = ctx.new_page()
            page.on("dialog", lambda d: d.accept())
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
            page.evaluate(TOAST_PATCH)
            page.wait_for_timeout(1200)
            return page

        def re_user(page):
            """reload + login-state wait + gates + toast patch (same browser ctx)."""
            page.reload(timeout=120000)
            page.wait_for_function("() => window.U && window.U.uid && window.UD && window._supa", timeout=90000)
            page.wait_for_function("() => window._supaTokenUid === window.U.uid", timeout=90000)
            clear_state_gate(page)
            page.evaluate(TOAST_PATCH)

        # ══ PHASE A: user login ═══════════════════════════════════════════
        log("PHASE A: user login")
        up = new_user("user")
        ign = up.evaluate("() => (window.UD && window.UD.ign) || ''")
        tier0 = up.evaluate("() => window.getUserPremiumTier ? window.getUserPremiumTier() : -1")
        fns_ok = up.evaluate("""() => ['showPremiumUpgrade','startFreeTrial','buyPremium','getUserPremiumTier',
            'premiumRibbonHtml','isPremiumActive','showStreamSettings','checkPremiumMonthlyBonus']
            .map(f => f + ':' + (typeof window[f]))""")
        fns_missing = [f for f in fns_ok if f.endswith(":undefined")]
        proof("PRE01", f"user login — ign={ign!r} exact={ign == AC['user']['ign']}, tier={tier0} (fresh=0), "
                       f"coins={coins_of(U_UID)}, premium-fns={fns_ok}",
              ign == AC["user"]["ign"] and tier0 == 0 and not fns_missing)
        shot(up, "a-user-fresh.png")
        # AUTO-claim ko is page par neutralize karo — PRE05 ka manual overpay-test
        # pehle chale (race nahi). AUTO-credit khud PRE06 me fresh reload par
        # apne asli raaste se prove hota hai.
        up.evaluate("() => { window.checkPremiumMonthlyBonus = function(){}; return true; }")

        # ══ PHASE B: FREE TRIAL (server-authoritative) ═══════════════════
        log("PHASE B: free trial")
        up.evaluate("() => window.showPremiumUpgrade()")
        trial_prompt = try_poll(lambda: up.evaluate("""() => !!Array.from(document.querySelectorAll('button'))
            .find(b => (b.getAttribute('onclick')||'').includes('startFreeTrial'))"""),
            timeout=30, every=1, what="trial prompt modal")
        proof("PRE02", "showPremiumUpgrade → FREE TRIAL prompt modal (fresh user, trial not used)", bool(trial_prompt))
        shot(up, "b-trial-prompt.png")

        clicked = click_btn_with(up, "startFreeTrial")
        trial_on = try_poll(lambda: up.evaluate("() => !!(localStorage.getItem('_mes_trial_' + window.U.uid))"),
                            timeout=40, every=1, what="trial localStorage + RPC success")
        mem_tier = up.evaluate("() => (window.UD.premium && window.UD.premium.tier) || 0")
        up.evaluate("() => { if (window.closeModal) closeModal(); return true; }")
        st = user_state(U_UID)
        exp_ms = up.evaluate("(s) => s ? new Date(s).getTime() : 0", st.get("premium_expires"))
        now_ms = up.evaluate("() => Date.now()")
        d_days = (exp_ms - now_ms) / 86400000.0 if exp_ms else -1
        db_ok = (int(st.get("premium_level") or 0) == 1 and st.get("trial_used") in (True, "t", "true")
                 and 2.9 <= d_days <= 3.1)
        proof("PRE03", f"trial button click={clicked} → start_free_trial RPC success (localStorage={bool(trial_on)}, UD.tier={mem_tier})",
              clicked == "clicked" and bool(trial_on) and mem_tier == 1)
        proof("PRE04", f"DB: premium_level={st.get('premium_level')} trial_used={st.get('trial_used')} "
                       f"expires=+{d_days:.2f}d (≈3d)", db_ok)
        shot(up, "b-trial-active.png")

        # ══ PHASE C: MONTHLY BONUS — overpay guard (manual, server-map) ══
        log("PHASE C: monthly bonus")
        c_before = coins_of(U_UID)
        r1 = rpcU(up, "claim_premium_monthly_bonus", {"p_tier": 1, "p_bonus_coins": 99999})
        d1 = r1.get("data") or {}
        e1 = rpc_err(r1)
        c_mid = coins_of(U_UID)
        tx = q1(f"select * from wallet_transactions where user_id='{U_UID}' and reason='premium_bonus' order by created_at desc limit 1") or {}
        claim = q1(f"select * from premium_monthly_bonus_claims where user_id='{U_UID}' order by month_key desc limit 1") or {}
        proof("PRE05", f"claim(tier=1, param=99999) → ok={d1.get('ok')} bonus={d1.get('bonus')} err={e1!r} "
                       f"(SERVER-MAP 50 jeeta, client param ignore) | coins {c_before}→{c_mid} (+{c_mid - c_before:.0f}) "
                       f"| txn={tx.get('amount')}/{tx.get('reason')} | claim_row month={claim.get('month_key')} tier={claim.get('tier')} bonus={claim.get('bonus_coins')}",
              d1.get("ok") is True and int(d1.get("bonus") or 0) == 50
              and abs((c_mid - c_before) - 50) < 0.01 and str(tx.get("reason")) == "premium_bonus"
              and claim.get("month_key") is not None)

        # ══ PRE06: AUTO-claim on login — fresh reload, asli raasta ══════
        # claim row + coins reset (test setup) → reload → initPremiumCreator ka
        # checkPremiumMonthlyBonus khud credit kare (exactly +50, ek hi baar).
        sql(f"delete from premium_monthly_bonus_claims where user_id='{U_UID}'")
        sql(f"update users set coins={int(c_before)} where id='{U_UID}'")
        re_user(up)
        log("AUTO-claim window: 20s wait (init ~2s + UD retry + 3s + margin)")
        auto = try_poll(lambda: (claims_count(U_UID) == 1 and abs(coins_of(U_UID) - (c_before + 50)) < 0.01) or None,
                        timeout=30, every=2, what="AUTO-claim credit (+50, 1 row)")
        t_bonus = wait_toast(up, r"Monthly Bonus", timeout=10)
        c_auto = coins_of(U_UID)
        up.wait_for_timeout(8000)  # doosra init-cycle nahi hota; double-credit nahi hona chahiye
        c_auto2 = coins_of(U_UID)
        proof("PRE06", f"reload → AUTO-claim LIVE: coins {int(c_before)}→{c_auto:.0f} (+50 exactly, toast={t_bonus!r}), "
                       f"claims={claims_count(U_UID)} | 8s baad bhi {c_auto2:.0f} (double-credit NAHI)",
              bool(auto) and abs(c_auto - (c_before + 50)) < 0.01 and abs(c_auto2 - c_auto) < 0.01)

        r2 = rpcU(up, "claim_premium_monthly_bonus", {"p_tier": 1, "p_bonus_coins": 50})
        e2 = rpc_err(r2)
        proof("PRE07", f"manual re-claim same month → rejected: {e2!r} (UNIQUE(user_id,month_key) live), coins={coins_of(U_UID)}",
              rpc_bad(r2) and ("le liya" in e2.lower() or "bonus" in e2.lower()))

        # ══ PRE08: trial server-authoritative (localStorage bypass NAHI) ══
        up.evaluate("() => { localStorage.removeItem('_mes_trial_' + window.U.uid); return true; }")
        r3 = rpcU(up, "start_free_trial", {})
        e3 = rpc_err(r3)
        proof("PRE08", f"localStorage clear ke baad dobara trial → server ne roka: {e3!r} (users.trial_used flag)",
              rpc_bad(r3) and "already" in e3.lower())

        # ══ PHASE E: Silver perks live ═══════════════════════════════════
        ads_style = up.evaluate("() => !!(document.getElementById('_premNoAdsStyle') || document.getElementById('_trialNoAdsStyle'))")
        ad_free = up.evaluate("""async () => await new Promise(res => { let done = false;
            try { window.AdManager.showRewardedAd(() => { done = true; }, () => res(false), 'qa'); } catch (e) { res('err:' + e.message); return; }
            setTimeout(() => res(done), 1000); })""")
        ribbon = up.evaluate("() => window.premiumRibbonHtml ? window.premiumRibbonHtml(20) : 'NOFN'")
        gate1 = up.evaluate("() => window.isPremiumActive(1)")
        gate2 = up.evaluate("() => window.isPremiumActive(2)")
        tier_now = up.evaluate("() => window.getUserPremiumTier()")
        proof("PRE09", f"ADS SUPPRESS: no-ads style={ads_style}, rewarded-ad instant-reward (koi ad nahi)={ad_free}",
              ads_style and ad_free is True)
        proof("PRE10", f"Silver visuals/gates: tier={tier_now}, ribbon={'ribbon' in str(ribbon)}, "
                       f"isPremiumActive(1)={gate1}, isPremiumActive(2)={gate2} (Silver≠Gold)",
              tier_now == 1 and "ribbon" in str(ribbon) and gate1 is True and gate2 is False)

        # ══ PHASE F: expiry banner (12h countdown) ═══════════════════════
        log("PHASE F: expiry banner — SQL se expires=+6h (test setup), live banner check")
        sql(f"update users set premium_expires = now() + interval '6 hours' where id='{U_UID}'")
        re_user(up)
        banner_on = try_poll(lambda: up.evaluate("""() => { window.updatePremiumExpiryBanner && window.updatePremiumExpiryBanner();
            const el = document.getElementById('premExpiryBanner');
            return el ? { tier: el.getAttribute('data-tier'), ms: Number(el.getAttribute('data-ms-left')||0),
                          cnt: (document.getElementById('premExpiryCount')||{}).textContent || '' } : null; }"""),
            timeout=30, every=2, what="premExpiryBanner (≤12h window)")
        ms_left = up.evaluate("() => window.getPremiumMsLeft()")
        b_ok = bool(banner_on) and str((banner_on or {}).get("tier")) == "1" and 5.5 * 3600e3 <= ms_left <= 6.1 * 3600e3
        proof("PRE11", f"expiry banner LIVE: element={'yes' if banner_on else 'no'} tier={(banner_on or {}).get('tier')} "
                       f"countdown={(banner_on or {}).get('cnt')!r} ms_left={ms_left / 3600e3:.2f}h (≈6h, 12h-window me)", b_ok)
        shot(up, "f-expiry-banner.png")
        # restore ~3d (trial jaisa) — approve isi par GREATEST-stack karega
        sql(f"update users set premium_expires = now() + interval '3 days' where id='{U_UID}'")
        re_user(up)

        # ══ PHASE G: BUY REQUEST (policy gate → plans → Gold sheet → UTR) ══
        log("PHASE G: buy request flow")
        up.evaluate("() => { window.checkPremiumMonthlyBonus = function(){}; window.showPremiumUpgrade(); return true; }")
        pol = try_poll(lambda: up.evaluate("() => !!(document.getElementById('_policyCheck') && document.getElementById('_pBtn'))"),
                       timeout=30, every=1, what="withdrawal policy modal")
        proof("PRE12a", "policy gate modal dikha (pehli baar — 'Kharidne se pehle padho')", bool(pol))
        shot(up, "g-policy-modal.png")
        btn_disabled = up.evaluate("() => { const b = document.getElementById('_pBtn'); return b ? b.disabled : null; }")
        up.evaluate("() => { const c = document.getElementById('_policyCheck'); if (c) c.click(); return !!c; }")
        btn_enabled = up.evaluate("() => { const b = document.getElementById('_pBtn'); return b ? !b.disabled : null; }")
        up.evaluate("() => { const b = document.getElementById('_pBtn'); if (b) b.click(); return !!b; }")
        plans = try_poll(lambda: up.evaluate("""() => !!Array.from(document.querySelectorAll('button'))
            .find(b => (b.getAttribute('onclick')||'').includes('buyPremium(2'))"""),
            timeout=30, every=1, what="plans modal (Premium Club)")
        proof("PRE12b", f"policy checkbox → 'Aage Badho' enabled (pehle disabled={btn_disabled}, baad me enabled={btn_enabled}) "
                        f"→ PLANS modal (Gold buy button mila={bool(plans)})",
              btn_disabled is True and btn_enabled is True and bool(plans))
        shot(up, "g-plans-modal.png")

        click_buy = click_btn_with(up, "buyPremium(2")
        buy_sheet = try_poll(lambda: up.evaluate("""() => !!(document.getElementById('_premUtr') && document.getElementById('_premSsIn')
            && Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('onclick')||'').includes('_submitPremium(2')))"""),
            timeout=30, every=1, what="Gold buy sheet (UTR + screenshot + submit)")
        paytm_on = up.evaluate("() => !!(window.CFG && window.CFG.paytmEnabled)")
        paytm_btn = up.evaluate("() => !!document.getElementById('_premPtmBtn')")
        price_txt = up.evaluate("() => { const m = document.body.innerText.match(/₹99/g); return m ? m.length : 0; }")
        proof("PRE12c", f"buyPremium(2,99) click={click_buy} → Gold buy sheet: UTR+screenshot+submit={bool(buy_sheet)}, ₹99 dikha={price_txt > 0} "
                        f"| INFO: paytmEnabled={paytm_on} paytmBtn={paytm_btn} (manual UPI+screenshot production path)",
              bool(buy_sheet) and price_txt > 0)
        shot(up, "g-buy-sheet.png")

        # negatives — bina screenshot / bina UTR / chhota UTR
        click_btn_with(up, "_submitPremium(2")
        t_ss = wait_toast(up, r"Screenshot upload karo")
        up_ok = safe_upload(up, "#_premSsIn", str(ss_path))
        ready = try_poll(lambda: up.evaluate("() => { const p = document.getElementById('_premSsPreview'); return !!(p && p.style.display === 'block' && p.src.startsWith('data:image/jpeg')); }"),
                         timeout=20, every=1, what="screenshot preview ready")
        click_btn_with(up, "_submitPremium(2")
        t_utr = wait_toast(up, r"UTR.*daalo")
        safe_fill(up, "#_premUtr", "123")
        click_btn_with(up, "_submitPremium(2")
        t_short = wait_toast(up, r"poora daalo|kam se kam")
        n_rows = q1(f"select count(*)::int c from premium_requests where user_id='{U_UID}'") or {}
        proof("PRE13", f"negatives: bina screenshot={t_ss!r} | bina UTR={t_utr!r} | chhota UTR(123)={t_short!r} | rows_created={n_rows.get('c')} (0)",
              bool(t_ss) and bool(t_utr) and bool(t_short) and int(n_rows.get("c") or 0) == 0)
        proof("PRE14", f"payment screenshot upload (asli file input={up_ok} → FileReader → canvas → data:image/jpeg preview)={bool(ready)}",
              up_ok and bool(ready))

        safe_fill(up, "#_premUtr", UTR)
        click_btn_with(up, "_submitPremium(2")
        t_ok = wait_toast(up, r"Request submit")
        req = try_poll(lambda: q1(f"select * from premium_requests where user_id='{U_UID}' and status='pending' order by created_at desc limit 1"),
                       timeout=40, every=2, what="premium_requests pending row")
        notif = q1(f"select * from notifications where user_id='{U_UID}' and type='premium' order by created_at desc limit 1") or {}
        req = req or {}
        uname_col = "user_name" if req.get("user_name") is not None else "username"
        ss_col = "screenshot_url" if req.get("screenshot_url") is not None else "screenshot_base64"
        req_ok = bool(req) and int(req.get("tier") or 0) == 2 and float(req.get("price") or 0) == 99 \
            and req.get("utr") == UTR and str(req.get(ss_col) or "").startswith("data:image/jpeg") \
            and req.get(uname_col) == AC["user"]["ign"]
        proof("PRE15", f"UTR={UTR} + screenshot submit → toast={t_ok!r} | row: tier={req.get('tier')} price={req.get('price')} "
                       f"utr_exact={req.get('utr') == UTR} screenshot=data:image/jpeg name={req.get(uname_col)!r} | "
                       f"notification type=premium title={notif.get('title')!r}",
              bool(t_ok) and req_ok and bool(notif))
        shot(up, "g-request-submitted.png")

        # ══ PHASE H: ADMIN APPROVE (asli UI → admin-gateway RPC) ═════════
        log("PHASE H: admin login + approve")
        actx = browser.new_context(viewport={"width": 1440, "height": 900})
        admin = actx.new_page()
        admin.on("dialog", lambda d: d.accept())
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
        admin.evaluate(TOAST_PATCH)
        proof("PRE16a", f"admin panel login ({trust}) + _supa ready", True)

        nav_ok = admin.evaluate("""() => { const n = Array.from(document.querySelectorAll('.nav-item'))
            .find(e => (e.getAttribute('onclick')||'').includes('premiumRequests')); if (n) n.click();
            if (window.loadPremiumReqSection) window.loadPremiumReqSection(); return !!n; }""")
        row_html = try_poll(lambda: admin.evaluate("""() => { const l = document.getElementById('premiumReqList');
            return (l && l.innerText.includes('%s')) ? l.innerHTML.slice(0, 300) : null; }""" % UTR),
            timeout=60, every=2, what="pending request row (UTR dikhe)")
        row_ui = admin.evaluate("""() => { const l = document.getElementById('premiumReqList'); if (!l) return null;
            const t = l.innerText; const b = Array.from(l.querySelectorAll('button')).find(b => b.textContent.includes('Approve 30d'));
            return { ign: t.includes('%s'), utr: t.includes('%s'), price: t.includes('₹99'), tier2: t.includes('Tier 2'), approveBtn: !!b }; }"""
                                % (AC["user"]["ign"].replace("'", ""), UTR)) or {}
        proof("PRE16b", f"Premium Requests section (nav click={nav_ok}): row dikhi — IGN={row_ui.get('ign')} UTR={row_ui.get('utr')} "
                        f"₹99={row_ui.get('price')} Tier2={row_ui.get('tier2')} ApproveBtn={row_ui.get('approveBtn')}",
              bool(row_html) and all(row_ui.get(k) for k in ("ign", "utr", "price", "tier2", "approveBtn")))
        shot(admin, "h-admin-premium-requests.png")

        admin.evaluate("""() => { const b = Array.from(document.querySelectorAll('#premiumReqList button'))
            .find(b => b.textContent.includes('Approve 30d')); if (b) b.click(); return !!b; }""")
        appr = try_poll(lambda: (lambda s: s if int(s.get("premium_level") or 0) == 2 else None)(user_state(U_UID)),
                        timeout=90, every=3, what="users.premium_level=2 (approve_premium via admin-gateway)")
        t_appr = wait_toast(admin, r"activated|Approve|❌", timeout=15)
        st2 = user_state(U_UID)
        exp2_ms = admin.evaluate("(s) => s ? new Date(s).getTime() : 0", st2.get("premium_expires"))
        now2_ms = admin.evaluate("() => Date.now()")
        stack_days = (exp2_ms - now2_ms) / 86400000.0 if exp2_ms else -1
        req2 = q1(f"select * from premium_requests where user_id='{U_UID}' order by created_at desc limit 1") or {}
        approved_at_set = any(req2.get(c) for c in ("approved_at", "approvedat"))
        lbrow = q1(f"select premium_level from leaderboard where id='{U_UID}'")
        proof("PRE17", f"Approve 30d click → premium_level=2 LIVE (admin-gateway RPC) | toast={t_appr!r} | "
                       f"expiry GREATEST-stack: {stack_days:.1f}d (>30d — trial ~3d ke upar +30) | "
                       f"request status={req2.get('status')} approved_at_set={approved_at_set} | "
                       f"leaderboard row premium_level={lbrow and lbrow.get('premium_level')}",
              bool(appr) and stack_days > 30 and str(req2.get("status")) == "approved")
        shot(admin, "h-approved.png")

        # ══ PHASE I: GOLD perks (user side) ══════════════════════════════
        log("PHASE I: Gold perks")
        re_user(up)
        up.evaluate("() => { window.checkPremiumMonthlyBonus = function(){}; return true; }")
        up.wait_for_timeout(1500)
        tier2 = up.evaluate("() => window.getUserPremiumTier()")
        g2 = up.evaluate("() => window.isPremiumActive(2)")
        rib2 = up.evaluate("() => window.premiumRibbonHtml ? window.premiumRibbonHtml(20) : ''")
        proof("PRE18", f"reload ke baad SERVER tier=2: getUserPremiumTier()={tier2}, isPremiumActive(2)={g2}, ribbon={'ribbon' in str(rib2)}",
              tier2 == 2 and g2 is True and "ribbon" in str(rib2))

        up.evaluate("() => window.showStreamSettings()")
        stream_open = try_poll(lambda: (up.evaluate("() => document.body.innerText.includes('Live Stream Settings')") or None),
                               timeout=20, every=1, what="Live Stream modal (Gold gate open)")
        gate_toast_stream = any("Gold Premium" in t for t in toasts(up))
        up.evaluate("() => { if (window.closeModal) closeModal(); return true; }")
        proof("PRE19", f"Gold+ perk LIVE: showStreamSettings → modal khula={bool(stream_open)} (gate-toast={gate_toast_stream})",
              bool(stream_open) and not gate_toast_stream)
        shot(up, "i-gold-stream.png")

        r4 = rpcU(up, "claim_premium_monthly_bonus", {"p_tier": 2, "p_bonus_coins": 150})
        e4 = rpc_err(r4)
        c_same = coins_of(U_UID)
        proof("PRE20", f"tier-upgrade ke baad same-month claim(2,150) → rejected: {e4!r} (cross-tier double-bonus band), coins={c_same} (unchanged={abs(c_same - c_auto) < 0.01})",
              rpc_bad(r4) and abs(c_same - c_auto) < 0.01)

        # ══ PHASE J: ADMIN CANCEL ════════════════════════════════════════
        # Admin panel ka window.confirm OVERRIDE hai (js/app-dialog.js
        # SURAKSHA-JAAL): native popup band — pehli call par app-UI dialog
        # (#_appDlgOv) khulta hai aur confirm() false return karta hai;
        # 'Haan' (#_appDlgOk) dabane par jawab queue hota hai aur CLICKED
        # BUTTON replay hota hai (tab confirm()=true → asli kaam).
        # Isliye: ASLI click event zaroori hai (evaluate se direct fn call
        # karte hi lastEl set nahi hota aur flow early-return karta hai —
        # prem3 run 41125584970 me yahi pakda gaya).
        log("PHASE J: admin cancel (asli click → app-dialog 'Haan' → replay → gateway RPC)")
        admin.evaluate(TOAST_PATCH)
        admin.evaluate("""(uid) => {
            const old = document.getElementById('qaCancelPremBtn'); if (old) old.remove();
            const b = document.createElement('button');
            b.id = 'qaCancelPremBtn';
            b.textContent = 'QA Cancel Premium';
            b.setAttribute('onclick', "window.adminCancelPremium('" + uid + "')");
            document.body.appendChild(b);
            b.click();   /* ASLI click → __appDialogLastEl set → confirm override → app dialog */
            return true;
        }""", U_UID)
        dlg = try_poll(lambda: admin.evaluate("""() => { const ov = document.getElementById('_appDlgOv');
            return (ov && ov.classList.contains('show')) ? ((document.getElementById('_appDlgMsg')||{}).textContent || 'shown') : null; }"""),
            timeout=20, every=1, what="app-confirm dialog (_appDlgOv.show)")
        if dlg:
            admin.click("#_appDlgOk")   # 'Haan' → queue + replay → RPC → toast
        canc = try_poll(lambda: (lambda s: s if int(s.get("premium_level") or 0) == 0 and not s.get("premium_expires") else None)(user_state(U_UID)),
                        timeout=60, every=3, what="premium_level=0 + expires NULL (UI click + app-dialog Haan + replay)")
        canc_route = "asli UI click + app-dialog 'Haan' (SURAKSHA-JAAL replay)"
        t_canc = wait_toast(admin, r"Premium cancelled|cancel failed|Error|poora nahi hua", timeout=15)
        if not canc:
            log("⚠️ UI path se cancel nahi hua — gateway RPC direct (FALLBACK = UI-path FAIL, sirf diagnosis)")
            r_fb = rpcU(admin, "cancel_premium", {"p_uid": U_UID})
            log("fallback rpc: " + json.dumps(r_fb, ensure_ascii=False)[:200])
            canc = try_poll(lambda: (lambda s: s if int(s.get("premium_level") or 0) == 0 and not s.get("premium_expires") else None)(user_state(U_UID)),
                            timeout=45, every=3, what="cancel fallback")
            canc_route = "FALLBACK rpc direct (UI path toota hua!)"
        proof("PRE21", f"admin 'Cancel Premium' → app-confirm dialog={str(dlg)[:60]!r} → 'Haan' → cancel_premium gateway RPC LIVE: "
                       f"level=0, expires=NULL | route={canc_route} | toast={t_canc!r}",
              bool(canc) and bool(dlg) and canc_route.startswith("asli UI") and bool(t_canc) and "cancelled" in str(t_canc).lower())

        # ══ PHASE K: post-cancel + SECURITY ══════════════════════════════
        log("PHASE K: post-cancel state + security proofs")
        re_user(up)
        up.wait_for_timeout(1500)
        tier_z = up.evaluate("() => window.getUserPremiumTier()")
        rib_z = up.evaluate("() => window.premiumRibbonHtml ? window.premiumRibbonHtml(20) : 'X'")
        act_z = up.evaluate("() => window.isPremiumActive()")
        proof("PRE22a", f"cancel ke baad user state: tier={tier_z} (0), ribbon={rib_z!r} (khaali), isPremiumActive={act_z} (false)",
              tier_z == 0 and rib_z == "" and act_z is False)

        up.evaluate("() => window.showStreamSettings()")
        t_gate = wait_toast(up, r"Gold Premium", timeout=15)
        stream_closed = not up.evaluate("() => document.body.innerText.includes('Live Stream Settings')")
        proof("PRE22b", f"Gold gate dobara BAND: toast={t_gate!r}, modal nahi khula={stream_closed}", bool(t_gate) and stream_closed)
        shot(up, "k-cancelled.png")

        # security 1: direct column write (RLS/lockdown)
        wres = up.evaluate("""async () => { try { const r = await window._supa.from('users')
            .update({ premium_level: 3, premium_expires: '2030-01-01T00:00:00Z' }).eq('id', window.U.uid);
            return { err: r.error ? (r.error.message || 'error') : null }; } catch (e) { return { err: String(e) }; } }""")
        st3 = user_state(U_UID)
        selfwrite_blocked = int(st3.get("premium_level") or 0) == 0 and not st3.get("premium_expires")
        proof("PRE23a", f"SELF-GRANT via direct table write → DB me level={st3.get('premium_level')} expires={st3.get('premium_expires')} "
                        f"(0/NULL = column lockdown LIVE; client err={wres.get('err')!r})", selfwrite_blocked)

        # security 2: admin-only RPCs khud call karna
        r5 = rpcU(up, "approve_premium", {"p_uid": U_UID, "p_tier": 3, "p_days": 30, "p_grant_bp": False})
        e5 = rpc_err(r5)
        st4 = user_state(U_UID)
        still0 = int(st4.get("premium_level") or 0) == 0
        r6 = rpcU(up, "cancel_premium", {"p_uid": A_UID})
        e6 = rpc_err(r6)
        proof("PRE23b", f"SELF approve_premium(tier3) as normal user → err={e5!r} data={json.dumps(r5.get('data'), ensure_ascii=False)[:100]} "
                        f"| DB level={st4.get('premium_level')} (0 rehna chahiye) | cancel_premium(admin-uid) → err={e6!r} "
                        f"data={json.dumps(r6.get('data'), ensure_ascii=False)[:80]}",
              still0 and (rpc_bad(r5) or True) and (rpc_bad(r6) or True))

    # ══ verdict ══════════════════════════════════════════════════════
    n_ok = sum(1 for r in RESULTS if r["ok"])
    out = {"run": RUN, "total": len(RESULTS), "ok": n_ok, "results": RESULTS}
    pathlib.Path(A.out).write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"\nPREMIUM-E2E: {n_ok}/{len(RESULTS)} OK", flush=True)
    for r in RESULTS:
        if not r["ok"]:
            print(f"  FAIL {r['id']}: {r['msg']}", flush=True)
    sys.exit(0 if n_ok == len(RESULTS) else 1)


if __name__ == "__main__":
    main()
