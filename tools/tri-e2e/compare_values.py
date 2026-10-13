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
        "premium_level", "premium_ribbon"]


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
