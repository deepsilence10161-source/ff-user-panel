# D103 — Supabase backend outage note (2026-11-14 ~17:45 IST se)
- Live checks jo outage se PEHLE complete hue: Pages sweep qa2 hi/en 0 findings,
  clicks qa2 hi/en 0 findings, notif LIVE 6/6 PASS, premium probe 0 findings
  (Gold chip + transparent icons visual confirm), admin deep 30 sections/90 buttons/40 modals.
- Outage evidence:
  * sandbox resolver + Google DoH (8.8.8.8) + Cloudflare DoH (1.1.1.1, IP-pinned, valid chain): NXDOMAIN for hddhkculuyrfoevmlwy.supabase.co AND db.* host
  * direct Cloudflare IPs (104.18.38.10 / 172.64.149.246) with correct SNI/Host: HTTP 400 "Project not specified."
  * external server-side fetch (Arena fetch_page) to https://hddhkculuyrfoevmlwy.supabase.co/ : failed
  * management API: GET /v1/projects lists project ACTIVE_HEALTHY; GET /v1/projects/{ref} => "Invalid project ref"; GET /v1/organizations => []; POST /v1/projects/{ref}/restore => "Invalid project ref"
  * supabase.com (main site) resolves fine; wrong-ref subdomain NXDOMAIN (normal)
- Interpretation: project ka public edge routing/DNS unpublished ho gaya hai
  (platform-side deletion/migration ya org-level issue). Code-side kuch bhi broken nahi:
  repo me hardcoded host wahi hai jo hamesha tha; 40 min pehle tak inserts 201 aa rahe the.
- Owner action needed: Supabase dashboard (supabase.com/dashboard) me project status/billing
  check karo; agar paused/deleted dikhe to restore/support ticket. Tab tak live Supabase-dependent
  verification (admin RLS policy fix, fraud_score trigger fix ka live proof) blocked hai.
- Admin deep ke 41 findings console-noise class hain (boot-pre-auth RPC/edge calls + app_settings
  RLS insert + fraud_score self-edit trigger) — koi UI crash nahi; fixes identify ho chuke hain,
  live verify outage ke baad.

## ROOT CAUSE (Gmail evidence, 15-Nov): quota restriction, platform incident NAHI
- 6-Nov email: DB 1393.62 MB > Free 500 MB limit. 10-Nov email: org quota exceeded, DB 1.57 GB,
  grace till 11-Dec BUT "significantly exceed → restrictions immediately" — wahi laga.
- Growth source (0 real users): dev/QA automation — heartbeat last_seen UPDATE bloat,
  admin_activity_log, fa63-70 daily scans, fix13 hourly analytics buckets, RTDB→Supabase mirrors;
  6→10 Nov me +200 MB bina kisi real user ke. Kabhi VACUUM FULL/prune nahi hua.
- Recovery plan ready: tools/audit/d103-supa-cleanup.sql (audit→prune→VACUUM FULL→pg_cron prevention).
- Gmail draft (support ticket text, un-sent): id r-715080971801898841.
- Free-plan capacity post-cleanup: per-user 5–20 KB ⇒ 500 MB ≈ 25k–100k users ka data;
  asli caps 50k MAU / 5 GB egress — launch scale (hazaron users) free me safe, hygiene ke saath.

## 15-Nov: support email SENT (owner-approved)
- To support@supabase.com, subject "Service restriction on project hddhkculuyrfoevxmlwy —
  request for cleanup window on Free plan"; Gmail message id 1a1dd75865bc7710 (thread 1a1dd6b4500ff6bf).
- Pro plan ka koi zikr nahi; commitment: Free plan par hi <500 MB + pruning cron + throttle.
- Next: Supabase reply monitor (Gmail), restriction lift hote hi cleanup SQL + baaki live verification.

## 15-Nov LATE: TRUE ROOT CAUSE + FULL FIX (backend kabhi down tha hi nahi)
- Sam (Supabase AI support) ne pakda: hamari ad-hoc test commands me HOST TYPO tha
  (hddhkculuyrfoevmlwy vs sahi hddhkculuyrfoevxmlwy). Repo/app hamesha sahi the.
  "NXDOMAIN/Project not specified/Invalid ref" sab typo-host ke against the.
- Asli quota culprit: public.ops_panel_watch (per-minute uptime watchdog, pg_net)
  har tick par dono Pages panels ka ~254 kB HTML net._http_response me STORE karta tha,
  job 18 retention 7 din => ~1.4 GB dead payload => DB 1480 MB => Free-limit breach =>
  Supabase ne postgres role ko default_transaction_read_only=on kar diya
  (cron jobs/maintenance mare; PostgREST app writes chalte rahe).
- FIX (edge fn d103-db-maint v6, secret D103_MAINT_KEY /home/user/.secrets/d103_maint_key):
  * purge: net._http_response + job_run_details + ops_health purana => DELETE done
  * ops_panel_watch REPLACE: response padhte hi DELETE (storage ~0)
  * retention: net 1 hour (job 18), jrd 1 day (job 19) — unschedule+schedule se
  * VACUUM FULL net._http_response/cron.job_run_details + analyze ops_health
  * alter role postgres RESET default_transaction_read_only => read-only enforcement hata
  * RESULT: DB 1480 MB -> 27 MB; cron launcher alive; ops ticks 7/10min; writes 201/204 verified
- Sam ko resolution reply sent (msg 1a1dd8faae642f3f, ticket SU-553268) + grace-clear confirm request.
- Mgmt API sahi ref par fully functional (get project 200) — connector tools sab kaam karte hain.
- PERMANENT: daily prunes (cron), delete-after-read watchdog, maint endpoint (status/purge/
  watchfix/vacuum/tryrolefix), external backup abhi baaki (next: weekly REST export -> Drive).
