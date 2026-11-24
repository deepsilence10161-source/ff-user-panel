/* ================================================================
   MINI eSPORTS — 20261124_banner_change_flag.sql
   ----------------------------------------------------------------
   OWNER ORDER (2026-11-24):
     "banner change band kar dete hain usse ui bigadta hai"
     "agar tune block kiya photo upload banner to admin panel me
      setting section me ise on off karne ka option rakh dena,
      agar kabhi man hua to change kar lenge"

   Flag:  app_settings.key = 'live_config'  ->  value.bannerChangeEnabled
          0 = banner change BAND (default, owner order)
          1 = banner change CHALU (admin panel se kabhi bhi ON)

   Reader (user app):  features/app-config.js  -> window.CFG.bannerChangeEnabled
                       screens/profile.js      -> uploadBannerImg() early-return
   Writer (admin):     ff-admin-panel js/fa-banner-toggle.js
                       (Settings -> App Settings -> "Profile Banner Change" card,
                        merge-only save: baaki live_config keys ko chhuta nahi)

   ⚠️ IDEMPOTENT + NON-DESTRUCTIVE:
      - row absent  -> create with bannerChangeEnabled = 0
      - key  absent -> add bannerChangeEnabled = 0, baaki keys untouched
      - key  present-> KUCH NAHI KARTE (admin ka choice respected; dobara
                       run karne par 1 se 0 par force nahi hota)
   Executed live on project hddhkculuyrfoevxmlwy on 2026-11-24 (flag = 0).
   ================================================================ */

insert into public.app_settings (key, value, updated_by, updated_at)
values (
  'live_config',
  jsonb_build_object('bannerChangeEnabled', 0),
  'owner-order-banner-off-2026-11-24',
  now()
)
on conflict (key) do update
   set value      = jsonb_set(
                      coalesce(public.app_settings.value, '{}'::jsonb),
                      '{bannerChangeEnabled}',
                      '0'::jsonb,
                      true
                    ),
       updated_by = 'owner-order-banner-off-2026-11-24',
       updated_at = now()
 where not (coalesce(public.app_settings.value, '{}'::jsonb) ? 'bannerChangeEnabled');

/* verify:
   select key, value->>'bannerChangeEnabled' as banner_change_enabled, updated_by, updated_at
     from public.app_settings where key = 'live_config';
   expected: banner_change_enabled = 0  (admin ON kare to 1)                       */
