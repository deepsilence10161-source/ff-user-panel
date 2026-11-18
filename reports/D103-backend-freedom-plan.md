# D103 — "Project Freedom": FCM-style permanent free & unlimited backend plan
**Date:** 15-Nov-2026 · **Owner policy:** koi paid plan nahi (Supabase Pro nahi, Blaze abhi nahi).
**Analogy:** OneSignal ki per-message limit ke against humne **Firebase FCM** chuna tha — free aur effectively unlimited, vendor-cap se permanent chhutkara. Isi tarah Supabase free ke intrinsic caps ke against ye plan hai.

---

## 0) Status jis par ye plan khada hai
- Supabase backend **fully operational** (typo-incident closed; DB **27 MB**; hygiene jobs live; grace flag **auto-clear** hoga jab usage report refresh hogi — Sam confirm, ticket SU-553268).
- Hygiene package live: delete-after-read watchdog, retention 1h/1d, daily prunes, maint edge endpoint, read-only reset.
- Isliye ye migration **emergency nahi, strategic hai** — launch Track A par ho sakta hai, Track B parallel banta hai.

## 1) Supabase free ke INTRINSIC caps (jo hygiene se khatam nahi hote)
| Cap | Free limit | Kab bite karega |
|---|---|---|
| DB size | 500 MB | ~25k–100k users (post-hygiene) |
| Egress | 5 GB/mo (+5 cached) | ~1–2M API requests/mo |
| Auth MAU | 50,000 | bahut door |
| Backups | **NONE** | hamesha risk |
| Inactivity pause | 7 din | ping se bachta hai |
| Enforcement style | **fail-closed + postgres role read-only** (dekha gaya) | quota touch = partial outage |
Hygiene ne growth ~0 kar diya, par caps vendor-side rahenge. FCM lesson: **cap wale vendor se cap-free platform par jao, reaction-based hygiene par depend mat karo.**

## 2) Candidate matrix (research 15-Nov-2026, numbers verified)
| Option | Free storage | Caps jo bite karte | Migration cost | Verdict |
|---|---|---|---|---|
| Supabase free (abhi) | 500 MB | upar wali poori table | 0 | **Track A (launch)** |
| Neon free | 1 GB/project (20 GB total, 100 projects) | per-project 1 GB; compute autosuspend; egress cap | medium (Postgres compatible) | partial relief, same vendor-class caps |
| Turso free | 5 GB total | **500M rows read/mo, 10M writes/mo**; SQLite/libSQL dialect | **HIGH** (saara plpgsql rewrite) | ❌ |
| Cloudflare D1 | 5 GB total, **500 MB/DB** | **5M reads/day, 100K writes/day**; SQLite | **HIGH** | ❌ |
| PocketBase self-host | unlimited | koi nahi, par SQLite + API model alag | **EXTREME** (app rewrite) | ❌ |
| Firebase Firestore/RTDB | 1 GiB | 50K reads/20K writes **per day**; RTDB 100 conn | EXTREME | ❌ (Spark fail-closed) |
| **Oracle Cloud Always Free VM + self Postgres** | **200 GB block** | **koi per-request/MAU/egress-row cap nahi**; egress 10 TB/mo; sirf VM resources (2 OCPU/12 GB ARM continuous, 2026 docs) | **MEDIUM** (schema dump + PostgREST + config-URL flip) | ✅ **Track B = MiniDB** |

**Oracle Always Free 2026 verified numbers:** Ampere A1 = 1,500 OCPU-hrs + 9,000 GB-hrs/mo ⇒ **2 OCPU + 12 GB RAM continuous** (ya 2 VMs me split); block 200 GB; object 20 GB; **egress 10 TB/mo**; flexible LB 1×10 Mbps; home-region lock (India: **Hyderabad recommend** — Mumbai ARM capacity chronically full); idle-reclaim se bachne ke liye light keepalive activity; signup me card lagta par charge nahi.

## 3) MiniDB architecture (Track B) — "hamara apna Supabase"
```
[User panel / Admin panel / APK]
        |  (window._SUPA_URL / build config — ek URL flip)
        v
[PostgREST :3000]  <-- JWT verify = FIREBASE JWKS (@file, cron refresh + NOTIFY pgrst reload)
        |           roles: anon / authenticated / service_role (Supabase role-model mirror)
        v
[Postgres 17 on Oracle A1 VM (Hyderabad)]  schema = COMPLETE_SCHEMA.sql as-is
        |                                    (plpgsql RPCs, RLS policies, triggers — sab portable)
        +-- pg_cron: prune jobs + size guard (port from Supabase jobs 2/3/4/8/9/17/18/19/27)
        +-- watchdog: VM cron curl (response DB me STORE nahi hota — pg_net mistake repeat nahi)
        +-- maint service: Node/Express (d103-db-maint ka port, secret-protected)
[Backups]: pg_dump cron -> OCI Object Storage (20 GB) + weekly -> Drive "mini eSports"
[Edge functions]: Supabase par HI rahenge (500k/mo free, DB se independent) — migration scope chhota
[Standby/Failback]: Supabase free project (27 MB, hygiene live) = hot fallback, config flip wapas
```
**Key insight jo migration cheap banata hai:** hamara db-bridge Supabase URL **config se** padhta hai (`window._SUPA_URL` override harness me already proven). PostgREST = Supabase REST se wire-compatible (same `/rest/v1/...` shape, same RLS semantics, same JWT claim `role`). Isliye app-code me **zero business-logic change** — sirf URL + keys.

**Auth flow:** Firebase ID token → PostgREST `jwt-secret = @/etc/minidb/jwks.json` (JWKS set supported, reloadable via `NOTIFY pgrst, 'reload config'`); VM cron har 6h Firebase JWKS fetch (`https://www.googleapis.com/service_accounts/v1/metadata/jwk/securetoken@system.gserviceaccount.com`) → file → NOTIFY. Token me `sub` = Firebase uid = `auth.uid()` equivalent (PostgREST requesting role claim `.role` map: anon/authenticated/service_role humara authenticator role set karega, Supabase jaisa).

## 4) Migration runbook (phased, rollback-safe)
- **P0 (OWNER, 10 min):** Oracle Cloud free signup — home region **Hyderabad** select karna (lock hota hai); card verify, charge nahi. Console access mujhe session/OAuth se dena ya VM banakar SSH key mere repo-secret pattern me rakhna.
- **P1 (main, ~1 turn):** VM provision (A1 2 OCPU/12 GB, 200 GB block, Ubuntu 24 ARM); Postgres 17 + pg_cron + PostgREST 12 install; firewall (sirf 443 via LB/caddy TLS); schema load = `COMPLETE_SCHEMA.sql` + migrations folder order se; roles/grants mirror; JWKS cron; maint service; size-guard.
- **P2 (main):** Data migration: Supabase REST export (service_role, table-by-table, ~27 MB) → import; sequences/IDs sync; row-count verify report.
- **P3 (main):** **Dual-mode E2E**: harness `BASE` + `_SUPA_URL` override se poori D103 suite (7 accounts × hi/en sweeps, clicks, notif, premium, admin deep) **MiniDB ke against**; findings 0 gate.
- **P4 (owner + main):** Config flip decision: launch MiniDB par YA Supabase par. **Default recommendation: launch Supabase free par (stable, verified), MiniDB ko 7 din dual-run backup/standby rakho; launch+7 din E2E green rahe to flip** (ek URL, zero downtime window < 5 min, rollback = URL wapas).
- **P5:** Supabase project ko 30 din cold-standby/backup-target rakho, phir pause (free) ya retain as canary.

## 5) MiniDB capacity (launch ke liye kitna "unlimited")
- Storage 200 GB ≈ **10–40 lakh users** ka data (5–20 KB/user) — Supabase free se **400x**.
- Egress 10 TB/mo ≈ Supabase free se **2000x**.
- Koi MAU cap nahi, koi per-request cap nahi, koi read/write row-cap nahi.
- 2 OCPU/12 GB: Postgres+PostgREST easily **hazaron req/sec** — launch traffic (GT-Battle-class ~2k installs/day) se 100x upar.
- Cost: **₹0 forever** (Always Free); sirf hamara ops time.

## 6) Risks & mitigations
| Risk | Mitigation |
|---|---|
| Mumbai ARM "out of capacity" | Hyderabad home-region (research-verified easier); signup-time retry window |
| Oracle idle-reclaim | keepalive cron (light CPU/net spike daily) + external uptime ping + alert |
| Single VM SPOF | Supabase hot-fallback (config flip), daily pg_dump object-storage + weekly Drive, LB health |
| Ops burden | runbook repo me; maint service ports; weekly auto-report Gmail draft |
| JWKS rotation | 6h fetch + NOTIFY reload; failure par purani keys 24h valid (Firebase rotation slow) |
| Migration bugs | P3 full E2E gate + URL-flip rollback (<5 min) |
| Owner time | P0 ke alawa sab main karunga; har phase live-verified report |

## 7) Decision gates
- G1: Owner Oracle signup (P0) → Track B start.
- G2: P3 E2E 0 findings → flip eligible.
- G3: Launch+7 din dual-run green → flip execute (owner approve).
- Kabhi bhi Supabase quota dobara breach ho (enforcement read-only) → **emergency flip** pre-approved by this plan.

## 8) Sources
- Oracle Always Free 2026: grokipedia, archive.ph Oracle review, easecloud, cloudpricecheck, dev.to (2 OCPU/12 GB continuous, 200 GB, 10 TB egress, Hyderabad tip, idle-reclaim keepalive).
- PostgREST 12.2 docs: jwt-secret JWK/JWKS set, @file, NOTIFY reload, role model.
- DB free tiers 2026: agentdeals comparison, toolchew Turso-vs-D1 (500 MB/DB D1, row caps), Neon 1 GB/project.
- Supabase free caps/enforcement: prior D103 research (Voroa/park23/freecloudzone) + live incident evidence.

---

# ADDENDUM (15-Nov, late) — "PLAN N": NO-CARD PERMANENT STACK
Owner ke paas credit/debit card nahi hai ⇒ Oracle Always Free signup impossible (Oracle FAQ: sirf Visa/Mastercard credit ya PIN-less debit; RuPay, virtual, prepaid, single-use REJECTED; no UPI). MiniDB (Oracle) parked — runbook ready, card milte hi 1-2 turn me executable.

## Research verdict — bina card kya milta hai (2026 verified)
| Service | Card? | Free limit | Hamare liye verdict |
|---|---|---|---|
| Oracle Always Free | ❌ CHAHIYE | 2 CPU/12 GB, 200 GB, 10 TB egress | PARKED (card milte hi primary candidate) |
| Neon | ✅ **no card** | Postgres, ~0.5–1 GB/project (100 projects, 20 GB total), 100 CU-hrs/mo, scale-to-zero 5 min, 5 GB egress, 6h PITR | **YES — as live backup / emergency fallback DB** (same Postgres engine ⇒ schema+RLS portable). Primary ke liye nahi (cold-start + CU-hrs hard cutoff) |
| Render free | ✅ no card | 512 MB/0.1 CPU, sleeps 15 min, 750 inst-hrs/mo, **no persistent disk**, free Postgres 1 GB **30-din expiry + zero backups** | ❌ DB ke liye bekaar |
| Koyeb free | ✅ no card | 512 MB, sleeps 1h, **no volumes** | ❌ |
| Cloudflare R2 | ✅ no card | **10 GB storage, 1M write + 10M read ops/mo, egress $0 FOREVER** | **YES — images/assets (rank, cosmetics, avatars, banners) yahan shift** ⇒ Supabase Storage 1 GB cap + 5 GB egress cap se azaadi |
| GitHub Actions | ✅ no card | private repo 2,000 min/mo (public unlimited) | **YES — daily backup, size-guard alert, health ping** (Supabase cron par dependency kam) |
| Appwrite Cloud | ✅ no card | 75k MAU, 2 GB, 750k fn exec | ❌ poori app rewrite |

## Plan N (final, no-card)
- **N1 Backup (top priority):** daily/weekly DB export → Drive "mini eSports" + private repo `backups/` + **Neon free project (nightly sync, live second Postgres)**. GitHub Actions se automated.
- **N2 Assets → Cloudflare R2:** image URL prefix config-driven; Supabase storage/egress pressure ~0.
- **N3 Primary = Supabase free** (27 MB, hygiene live) + GH Actions size-guard 300/400/450 MB alerts + 6-hourly health ping (7-din inactivity-pause bhi rokta hai).
- **N4 MiniDB parked:** Oracle runbook ready; trigger = owner ko genuine Visa/Mastercard mile (verification hold ~₹100, 3–5 din me reverse, charge ₹0).
- **N5 Capacity (no-card world):** DB growth ~0/day (hygiene) ⇒ 25k–1 lakh users safe; images R2 par ⇒ DB size par user-growth ka asar minimal; egress bhi R2 se bachta hai.

## Owner effort (total ~5 min, bina card)
1. Neon signup (email/GitHub se) → connection string mujhe.
2. Cloudflare account + R2 API token mujhe.
Dono me card nahi maanga jaata. Baaki sab main.
