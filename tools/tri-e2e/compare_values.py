#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
#  TRI-E2E — cross-surface compare
#  APK ke values (logcat se) vs User Panel web ke values (host driver se)
#  vs DB — teeno ek hi account ke hone chahiye. Ye script teeno ko milaati hai.
# ═══════════════════════════════════════════════════════════════════════════
import argparse, json, sys

KEYS = ["coins", "sky_diamonds", "kyc_status", "ticket_reply", "match_title", "notif_title",
        # 2026-10-12: premium ribbon — dono taraf (APK ↔ web) ek hi premium_level
        # dikhna chahiye (admin ne approve_premium se diya tha)
        "premium_level", "premium_ribbon",
        # 2026-10-13: aakhri 12 ghante ka countdown banner — APK aur web
        # dono par ek hi jagah (DB ki premium_expires) se aana chahiye
        "premium_banner",
        # 2026-10-13: 9 avatar-ring cosmetics — web par kharida ring APK par bhi
        "cosmetic_ring", "ring_medal",
        # 2026-10-13 Phase-3: Room ID — creator ne web par set kiya, APK par dikha
        "room_id",
        # 2026-10-13d Phase-3: DUO team — web par invite/accept ke baad APK par 2 players
        "duo_players",
        # 2026-10-13d 3.6: check-in streak — web par asli check-in ke baad APK par wahi streak
        "streak_days",
        # 2026-10-13d 3.8/11: Season Champion bada ailaan — web aur APK dono par
        "champion_banner"]


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

    same, diff, missing = [], [], []
    for k in KEYS:
        av, wv = apk.get(k), web.get(k)
        if av is None or wv is None:
            missing.append(f"{k}: apk={av!r} web={wv!r}")
        elif str(av) == str(wv):
            same.append(f"{k}={str(av)[:34]}")
        else:
            diff.append(f"{k}: apk={str(av)[:34]!r} web={str(wv)[:34]!r}")

    print("CROSS-SURFACE (APK ↔ User Panel web), ek hi QA account:")
    for s in same:
        print("   ✅ " + s)
    for m in missing:
        print("   ⚠️  missing " + m)
    for d in diff:
        print("   ❌ mismatch " + d)
    ok = (not diff) and len(same) >= 4
    json.dump({"same": same, "missing": missing, "mismatch": diff, "ok": ok},
              open(a.out, "w"), indent=1, ensure_ascii=False)
    print(f"CROSS-SURFACE-RESULT: {len(same)} match / {len(diff)} mismatch / {len(missing)} missing → {'OK' if ok else 'FAIL'}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
