-- =====================================================================
-- BELL GRANT FIX (D31) — engineer point #5 ka ASLI ilaaj:
-- Admin panel Supabase client Firebase ID-token (external JWT) bhejta
-- hai; usme `role` claim NAHIN hota, isliye PostgREST session role
-- ANON rehta hai (auth.uid() phir bhi Firebase UID = sahi). Purani
-- grants sirf `authenticated` ko thin → bell hamesha "permission
-- denied for table admin_notifications" khata tha (50/24h).
-- Fix: anon ko SELECT/UPDATE grant + RLS policy jo SIRF is_admin
-- uid ko rows dikhati hai (bina login auth.uid() null → 0 rows).
-- Saath hi purani admin_notifs_all (authenticated, using TRUE) ko
-- admin-gated policy se badla — warna koi bhi logged-in user admin
-- alerts padh sakta tha.
-- =====================================================================
grant select, update on public.admin_notifications to anon;

drop policy if exists admin_notifs_all on public.admin_notifications;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                 and tablename='admin_notifications' and policyname='admin_notifs_admin_read') then
    execute 'create policy admin_notifs_admin_read on public.admin_notifications
             for select to anon, authenticated
             using (exists (select 1 from public.users au
                            where au.id = (auth.jwt() ->> ''sub'') and au.is_admin = true))';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                 and tablename='admin_notifications' and policyname='admin_notifs_admin_upd') then
    execute 'create policy admin_notifs_admin_upd on public.admin_notifications
             for update to anon, authenticated
             using (exists (select 1 from public.users au
                            where au.id = (auth.jwt() ->> ''sub'') and au.is_admin = true))
             with check (exists (select 1 from public.users au
                            where au.id = (auth.jwt() ->> ''sub'') and au.is_admin = true))';
  end if;
end $$;

select jsonb_build_object(
  'grants',(select coalesce(jsonb_agg(jsonb_build_array(grantee,privilege_type)),'[]'::jsonb)
            from information_schema.role_table_grants
            where table_name='admin_notifications' and grantee in ('anon','authenticated')),
  'policies',(select coalesce(jsonb_agg(policyname),'[]'::jsonb) from pg_policies
              where schemaname='public' and tablename='admin_notifications')
) as bellfix_proof;
