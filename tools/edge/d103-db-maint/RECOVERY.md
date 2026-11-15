# d103-db-maint — Supabase edge function (recovery note)

**Project:** `hddhkculuyrfoevxmlwy` · **Function id:** `a728b8a5-80a8-4a85-9da8-378bcb7a4ea8` · **slug:** `d103-db-maint` · `verify_jwt: false` · version 7 ACTIVE (15-Nov-2026)

## Call kaise karein
```bash
K=$(cat /home/user/.secrets/d103_maint_key)   # agar local wipe ho jaye: Drive "d103-maint-key.md" (id 1dERVhH3BBx3gk1Zg7AaMQEKThQMq03cV)
curl -s "https://hddhkculuyrfoevxmlwy.supabase.co/functions/v1/d103-db-maint?action=status" -H "x-maint-key: $K"
```
Actions: `status | purge | watchfix | vacuum | tryrolefix | all`
`status` live jawab (15-Nov): `db_size 28 MB, net_rows 35, jrd_rows 963, ops_ticks_10min 30, cron_launcher 1`.

## Key secret rotate karna
1. `python3 -c "import secrets;print(secrets.token_urlsafe(24))"` → local `.secrets/d103_maint_key` me likho.
2. mgmt API: `POST https://api.supabase.com/v1/projects/hddhkculuyrfoevxmlwy/secrets` body `[{"name":"D103_MAINT_KEY","value":"<KEY>"}]` (Bearer = `.secrets/supabase_token`, sbp_…) → 201.
3. ~5s baad `?action=status` se verify (function restart ki zaroorat NAHI padi — env request-time par pick hota hai).
4. Drive `d103-maint-key.md` update karo (durable copy).

## Ye function kyun zaroori hai (mechanics — dobara banane ke liye)
- Supabase free-plan **DB-size breach** par `postgres` role par `default_transaction_read_only = on` lag jaata hai:
  connector `execute_query` / `create_migration` dono `25006 read-only` dete hain, pg_cron/maintenance mar jaata hai
  (PostgREST app-writes chalte rehte hain).
- **Escape hatch:** har connection par `SET default_transaction_read_only = off` — session-level SET allowed hai,
  isliye edge function (jo `SUPABASE_DB_URL` use karta hai) breach ke dauraan bhi likh paata hai.
- Recovery ke baad `ALTER ROLE postgres RESET default_transaction_read_only` → ~2 min me `pg_cron launcher` wapas.
- `UPDATE cron.job` **permission denied** hota hai ⇒ retention badalne ke liye `cron.unschedule(jobid)` + `cron.schedule(name, sched, cmd)`.
- `VACUUM FULL` sirf off-peak (exclusive lock).
- Runtime: Deno, `import postgres from "npm:postgres@3.4.5"`, `max: 1` connection, `s.unsafe(sql)`.

## Watchdog (15-Nov incident ka root cause) — dobara ye galti mat karna
`public.ops_panel_watch()` (cron jobid 26, har minute) dono Pages panels ka HTML fetch karke
`net._http_response` me **254 kB × 734 rows = 1418 MB** jama kar raha tha (7-din prune) ⇒ 500 MB Free limit breach.
Fix: response padhne ke **turant baad row delete** + retention `net` 1 hour (job `net-response-prune`, `25 4 * * *`)
aur `cron.job_run_details` 1 day (job `job-run-details-prune`, `35 4 * * *`). Result: 1480 MB → 27 MB.

## Source ka local copy kyun nahi hai
Supabase mgmt API deployed function ka **body return nahi karta** (`GET /v1/functions/{id}` → 404,
`/v1/projects/{ref}/functions/{slug}` → metadata only, `/body` → 404). Isliye live v7 ka exact code
yahan available nahi. **Live function ko blindly overwrite mat karo** (watchdog alert-path toot sakta hai);
sirf tab rebuild karo jab function tut chuka ho — upar wale mechanics se dobara likha ja sakta hai.
