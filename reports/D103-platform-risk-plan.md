# D103 — Platform Risk & Quota Master Plan
**Date:** 15-Nov-2026 · **Status:** Supabase restriction ACTIVE (support ticket sent) · **Owner policy:** NO Pro plan; Free plan par hi launch-safe banana hai.

---

## 0) Executive summary
- **Abhi ki incident:** Supabase free-org quota restriction (DB 1.57 GB vs 500 MB limit + fair-use). Data safe hai; access blocked hai.
- **Research se confirm:** restrictions **next billing-cycle start par auto-lift** hoti hain (ya upgrade par — jo humne rule out kiya), aur grace-period use ho chuka hone par "under limits me kuch cycles tak rahne" ki condition lag sakti hai. Hamara support ticket early-lift + cleanup-window maangta hai. Backup plan: cycle-start (~10-Dec) tak launch gate nahi rokna — neeche contingency ladder hai.
- **Do permanent lessons (FCM-wale discipline ke barabar):**
  1. Free plan par **koi automatic backup NAHIN** → apna weekly dump zaroori.
  2. Free plan **fail-closed** hai (quota cross = service band) → har quota par **pre-alert + auto-prune** chahiye, reaction nahi.
- **Firebase side bhi fail-closed hai (Spark):** RTDB 100 simultaneous connections — launch se PEHLE iska decision-frame ready hai (Section 5).

---

## 1) Incident #1 runbook — Supabase restriction
**Evidence chain:** 6-Nov space email (1393.62 MB) → 10-Nov quota email (1.57 GB, grace till 11-Dec, "restrictions immediately" warning) → ~14-Nov 12:15 UTC ke baad endpoint NXDOMAIN + edge 400 "Project not specified" + mgmt ref-routes "Invalid project ref" → 15-Nov support email sent (msg id `1a1dd75865bc7710`).

**Lift kab hoga (research):**
| Rasta | Kab | Note |
|---|---|---|
| Support early-lift (hamara ticket) | hours–days | sabse tez ummeed |
| Next billing-cycle start | ~10-Dec-2026 | research: restrictions lift at cycle start |
| Usage under limit + cycles | variable | grace already used → stricter |
| Pro upgrade | instant | **OWNER NE RULE OUT KIYA** |

**Access aate hi ordered runbook (usi turn me):**
1. `tools/audit/d103-supa-cleanup.sql` STEP 0–3: size audit + top-25 tables + row counts + replication slots.
2. Prune: `admin_activity_log` >30d, `notifications` read >60d, `app_settings` hourlyPeak >14d, realtime internal purge.
3. `VACUUM (FULL, ANALYZE)` top bloated tables **raat me** (exclusive lock lagta hai — research-confirmed); autovacuum already on hai.
4. Target verify: `pg_database_size` < 500 MB; screenshot/evidence Doc me.
5. **Turant backup:** pg_dump (direct conn / REST export) → Drive folder "mini eSports" + private repo snapshot. Free plan par NO backups — ye sabse bada gap tha.
6. Section 2 ke prevention jobs install (pg_cron free plan par available hai — research-confirmed).
7. Baaki D103 pending verification: 6-account Pages sweeps, admin 3-fix live proof + push, real-device Devanagari/emoji.

---

## 2) Permanent prevention package (Supabase)
**P1 — Daily prune (pg_cron, free plan par available):**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('d103-prune','0 3 * * *',$$
  DELETE FROM admin_activity_log WHERE created_at < now() - interval '30 days';
  DELETE FROM notifications WHERE created_at < now() - interval '60 days' AND read = true;
  DELETE FROM app_settings WHERE key LIKE 'appSettings/analytics/hourlyPeak/%'
    AND key < 'appSettings/analytics/hourlyPeak/' || to_char(now() - interval '14 days','YYYY-MM-DD-HH');
$$);
```
**P2 — Weekly maintenance:** `VACUUM ANALYZE` weekly (cron); `VACUUM FULL` sirf monthly off-peak top-3 bloated tables par (lock warning ke saath); pg_repack extension available ho to prefer (no exclusive lock).
**P3 — Write-rate cuts (code-side, admin+user panel):**
- heartbeat/last_seen write interval **≥60s** (abhi ~5s) — dono panels.
- `admin_activity_log`: sirf meaningful admin actions; har RTDB echo/heartbeat log OFF.
- RTDB→Supabase mirror: high-frequency fields (last_seen) ko mirror se bahar; `fraudScore` map remove (trigger-safe, Section 6).
- analytics buckets: 14-din retention (P1 se enforced).
**P4 — Size guard + alerts:** daily cron job size check; thresholds **300 MB (info) / 400 MB (warn) / 450 MB (alert)** → alert = edge function se Gmail/FCM push owner ko. (Edge 500k inv/month free — daily 1 call = 30/month, kaafi headroom.)
**P5 — Health ping (do kaam):** 6-hourly external ping (GitHub Actions cron, free) endpoint + login-flow canary → fail par owner ko email. Ye **inactivity-pause (7 din) se bhi bachata hai** — research: free projects 1 week low-activity par pause ho jaate hain, restore dashboard se 1 saal tak.
**P6 — Weekly backup (sabse zaroori):** GH Actions cron → `pg_dump` (direct connection string dashboard se) → compress → Drive "mini eSports" + private repo `backups/` (7-retention). Free = zero backups; ye gap ab permanent band.
**P7 — Retention policy table:**
| Table | Retention | Enforce |
|---|---|---|
| admin_activity_log | 30d | P1 cron |
| notifications (read) | 60d | P1 cron |
| notifications (unread) | 180d | P1 cron |
| app_settings hourlyPeak | 14d | P1 cron |
| user_push_tokens stale | 90d inactive | P1 cron |
| match_interests purane matches | match+30d | P1 cron |

---

## 3) Capacity model — launch traffic vs free quotas
Per-user data ≈ **5–20 KB** (users row + cosmetics + notifications + history). Fixed overhead ≈ 40–60 MB (extensions/system — research).
| Resource | Free limit | Launch estimate (5k MAU) | Headroom |
|---|---|---|---|
| DB size | 500 MB | ~150–250 MB post-cleanup | ✅ 2x |
| Egress | 5+5 GB/mo | ~1–2 GB (JSON-light API, images assets/CDN se) | ✅ |
| Auth MAU | 50,000 | 5k | ✅ 10x |
| Edge invocations | 500k/mo | <5k | ✅ 100x |
| Realtime concurrent | 200 | agar Supabase realtime use ho to monitor; app ka live traffic zyada tar Firebase RTDB par hai | ⚠️ monitor |
| API requests | unlimited | — | ✅ |
**Conclusion:** 5k–10k MAU tak Free plan comfortably, BAS P1–P7 chalte rahein. 50k MAU cross ho ya DB dobara bhoole → tabhi paid sochna (owner decision).

---

## 4) Contingency ladder (agar lift launch se pehle na ho)
1. **T+0:** ticket sent ✅ · reply monitor har turn.
2. **T+24–48h:** reply na aaye to ticket thread par polite escalation (Gmail se reply).
3. **Parallel safety:** naya QA/verify environment local mock Supabase par already hai (harness `_SUPA_URL` override) — dev/verify rukti nahi.
4. **Last resort (sirf launch-block ho to):** app ka db-bridge `SUPA_URL` config se padhta hai → PostgREST-compatible endpoint swap possible (Neon free 500 MB + self-hosted PostgREST, ya sasta VPS). Effort: medium-high (schema migration + RLS port + JWT config). **Recommend nahi** jab tak support/cycle route fail na ho — data integrity risk zyada, fayda sirf timing.
5. **Kabhi bhi nahi:** naya free org bana kar data phenkna (2-project limit ka loop, migration cost, aur wahi quota rules).

---

## 5) Firebase-side risk (Spark fail-closed) — decision frame ready
Research: Spark = RTDB **100 simultaneous connections**, 1 GB stored, 10 GB downloads/mo; quota cross = **app stops till midnight reset** (fail-closed). Blaze = koi monthly fee NAHIN, Spark allowance poora milta hai, RTDB 200k connections, $5/GB stored + $1/GB downloaded overage.
- **Abhi:** QA traffic negligible; koi action nahi.
- **Launch gate:** observed peak concurrent RTDB connections monitor karo (RTDB usage dashboard). **Peak 60 cross** hote hi decision: (a) non-critical live surfaces ko REST-polling par switch (Supabase REST unlimited requests hai), ya (b) Blaze + GCP budget alert (₹500/mo cap) — monthly fee zero hai, sirf overage.
- Ye decision **launch+30d data** par lena, abhi nahi — FCM-wale rule ke mutabik pehle real numbers.

---

## 6) Baaki open issues — fix runbook (har bug live-verify ke saath, outage ke baad)
| # | Issue | Root cause | Fix | Verify |
|---|---|---|---|---|
| 1 | Admin boot par pre-auth RPC/edge 400/403 (`admin_match_interests`, fa63-70 auto-run) | calls before `supabase:authenticated` | `_supaAuthed` gate + event-par-retry (pattern codebase me already hai: admin-fixes-v24/v25) | admin-deep probe: 0 console 400/403 |
| 2 | `app_settings` hourlyPeak INSERT RLS deny (unhandled rejection) | policy admin-insert allow nahi karti | migration: INSERT grant via `is_caller_admin()` security-definer policy | boot par 0 unhandled rejection |
| 3 | users self-update 400 "fraud_score is not self-editable" | `USER_FIELD_MAP` me fraudScore→fraud_score mirror (v32.18 revocation ke against) | map se fraudScore hatao (fraud writes sirf `admin_set_fraud_score` RPC se) | admin login par 0 P0001 |
| 4 | Results section blank-ish (txt=39) | empty-data state | friendly empty-state message check (data-dependent, crash nahi) | QA acct par empty-state visible |
| 5 | 27 stale `*@fft.com` Firebase accounts | purane QA | firebase-admin bulk delete (cleanup script extend) | listUsers me 0 fft.com |
| 6 | lh3 avatar fetch fails (sandbox CDN rate-limit) | external artifact | already `[env]` bucket me alag — app finding nahi | sweep ext-bucket count stable |

---

## 7) Monitoring & owner reporting
- Har turn: Gmail reply check + endpoint health check (abhi se).
- Weekly (access ke baad): GH Actions cron → size + quota summary → Gmail draft owner ko (auto-send nahi, review ke liye).
- Doc me har round ka §-append jaari rahega (§73, §74 done).

---

## 8) Launch gate checklist (D103 acceptance + quota health)
- [ ] Supabase access restored + DB <500 MB evidence
- [ ] P1–P7 jobs installed & ek cycle chuke hain
- [ ] Weekly backup ka pehla dump Drive me
- [ ] 7-account × hi/en live sweeps 0 findings (Pages, obfuscated build)
- [ ] clicks matrix + notif 6/6 + premium probe 0 (Pages par dobara)
- [ ] admin deep 0 UI findings + Section-6 ke 3 console fixes verified
- [ ] real-device Devanagari/emoji confirm (owner)
- [ ] Firebase RTDB peak-conn monitor setup + decision-frame note
- [ ] Stale accounts purge + final source zip + Doc §-close

---

### Sources (research 15-Nov-2026)
- Supabase free-tier limits & restriction behavior: aiagencyplus.com/supabase-free-tier-limits, getvoroa.com/blog/supabase-free-tier-limits, park23.io/insights/supabase-free-tier-limits, freecloudzone.com (2026 tables); restrictions lift at next billing cycle / upgrade — Voroa + park23.
- Bloat/VACUUM/pg_cron: supabase.com/blog/postgres-bloat; cronjobpro.com/blog/supabase-cron (pg_cron all plans); github supabase issue #43487 (free disk/read-only behaviour, ~40-60MB baseline).
- Firebase Spark/Blaze: deploymanage.com/firebase-pricing, lilachbullock.com/is-firebase-free, techdepot.blog (RTDB 100 conn hard cap, Blaze fail-open, $5/GB+$1/GB).

---
## UPDATE 15-Nov late: plan ke assumptions vs reality
- "Outage" typo tha; backend operational tha. Quota breach KA REAL ROOT CAUSE pg_net watchdog
  responses (254 kB/min × 7d retention) — user data ya hamare sweeps NAHI.
- IMPLEMENTED (plan se aage): maint edge endpoint d103-db-maint (secret-protected),
  delete-after-read watchdog, retention 1h/1d, read-only role reset, DB 27 MB.
- Supabase enforcement seekha: quota breach par postgres role read-only hota hai
  (PostgREST app writes chalti hain) — isliye app "chalti" dikhi par cron/maintenance mare.
- Remaining plan items: weekly external backup (REST export -> Drive), size-alert job
  (maint endpoint ko GH/turn-based call), baaki D103 verification (backend ab full alive).
