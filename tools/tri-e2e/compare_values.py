#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ═══════════════════════════════════════════════════════════════════════════
#  TRI-E2E — cross-surface compare (APK ↔ User Panel web, ek hi QA account)
#
#  2026-10-17 — sudhaar (asli wajah):
#  Pehle har key ko "barabar hona chahiye" maana jata tha. Par kuch cheezein
#  run ke dauraan BADALTI rehti hain (wallet: admin credit +25, ring kharid
#  -100 SD, check-in +5; aur "sabse nayi notification"), aur APK apne VALUES
#  run ke apne aant me likhta hai jabki web ke values host ke aant me — do
#  alag lamhe. Is liye wahi farq "mismatch" dikhta tha jo asal me sirf samay
#  ka farq tha (jaise coins 50 vs 80) — aur asli fail chhup jate the.
#
#  Ab teen darje:
#    STRICT — jo cheez poore run me nahi badalti: dono taraf bilkul ek honi
#             chahiye (KYC, match, premium level/banner, ribbon, ring, duo
#             players, streak, champion banner, badge push).
#    SOFT   — dono taraf ho to ek honi chahiye; ek taraf na mile to sirf
#             batao (uska apna asli proof host ke H9b/H3/H7 me hai).
#    INFO   — samay ke hisaab se badalne wali cheezein; inhe HAR surface ne
#             apne waqt par DB se milaya hota hai (APK step 5: wallet UI vs DB,
#             host H10/H11: DB, H16: notification row DB). Is liye ye fail
#             nahi karate, par saaf dikhaye jate hain.
# ═══════════════════════════════════════════════════════════════════════════
import argparse, json, sys

STRICT = ["kyc_status", "match_title", "premium_level", "premium_banner",
          "cosmetic_ring", "ring_medal", "duo_players", "streak_days",
          "champion_banner", "badge_unlock_push"]

SOFT = ["ticket_reply", "room_id"]

INFO = ["coins", "sky_diamonds", "notif_title"]

# jinpe "dono taraf kuch dikha" hi maayne rakhta hai (naam alag ho sakta hai:
# APK 'screen-ribbon', web 'leaderboard-row')
PRESENCE = {"premium_ribbon": "yes"}


def norm(k, v):
    if v is None:
        return None
    if k in PRESENCE and str(v) not in ("", "None", "0", "false", "False"):
        return PRESENCE[k]
    return str(v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apk", required=True, help="apk-values.json (emulator logcat se)")
    ap.add_argument("--web", required=True, help="host_out.json (Playwright driver)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    try:
        apk = json.load(open(a.apk))
    except Exception as e:
        print("APK values padhi nahi ja saki:", e)
        apk = {}
    try:
        web = json.load(open(a.web)).get("values", {})
    except Exception as e:
        print("host values padhi nahi ja saki:", e)
        web = {}

    same, diff, soft_gap, info = [], [], [], []

    for k in STRICT + list(PRESENCE.keys()):
        av, wv = norm(k, apk.get(k)), norm(k, web.get(k))
        if av is None or wv is None:
            diff.append(f"{k}: apk={av!r} web={wv!r} (dono taraf hona chahiye)")
        elif av == wv:
            same.append(f"{k}={av[:34]}")
        else:
            diff.append(f"{k}: apk={av[:34]!r} web={wv[:34]!r}")

    for k in SOFT:
        av, wv = norm(k, apk.get(k)), norm(k, web.get(k))
        if av and wv:
            if av == wv:
                same.append(f"{k}={av[:34]}")
            else:
                diff.append(f"{k}: apk={av[:34]!r} web={wv[:34]!r}")
        else:
            soft_gap.append(f"{k}: apk={av!r} web={wv!r} (ek taraf nahi mila — apna alag proof maujood)")

    for k in INFO:
        av, wv = norm(k, apk.get(k)), norm(k, web.get(k))
        info.append(f"{k}: apk={av!r} web={wv!r}"
                    + ("  (barabar)" if av == wv else "  — samay ka farq: har surface ne apne waqt par DB se milaya"))

    print("CROSS-SURFACE (APK ↔ User Panel web), ek hi QA account:")
    for s in same:
        print("   ✅ " + s)
    for g in soft_gap:
        print("   •  " + g)
    for i in info:
        print("   ℹ️  " + i)
    for d in diff:
        print("   ❌ " + d)

    ok = (not diff) and len([s for s in same if not s.startswith(tuple(SOFT))]) >= 8
    json.dump({"same": same, "soft_gap": soft_gap, "info": info, "mismatch": diff, "ok": ok},
              open(a.out, "w"), indent=1, ensure_ascii=False)
    print(f"CROSS-SURFACE-RESULT: {len(same)} match / {len(diff)} mismatch / "
          f"{len(soft_gap)} adhoora / {len(info)} samay-par-nirbhar → {'OK' if ok else 'FAIL'}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
