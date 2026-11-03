-- =====================================================================
-- 2026-11-03 USER-VISIBILITY FIX (owner report: "firebase me login hua
-- par admin panel me show nahi"):
--   (1) Soft-deleted ghosts: account delete (is_deleted=true) ke baad
--       user Firebase auth se phir login kar sakta tha → row ghost:
--       admin filter (.eq is_deleted false) use chhupata tha. Arif +
--       Gabriel (last login delete ke BAAD) restore kiye.
--   (2) ign=null rows (boot ign null se row banata hai, IGN baad me
--       set hota hai) admin me blank dikhte the → Tariq (insta wala
--       frustrated user) ka ign uske Firebase displayName se set.
--   (3) user_restore_account RPC: app ab soft-deleted login par
--       welcome-back restore sheet dikhata hai (boot.js hook).
-- =====================================================================
update public.users set is_deleted = false, ign = 'Arif Mansoori'
  where id = 'zbAzFwSYEnSbisdanTrcB1PriE52' and is_deleted = true;
update public.users set is_deleted = false, ign = 'Gabriel HanZ'
  where id = 'DNPC6OWHmLg5Dq4dByn5IcMHyGC2' and is_deleted = true;
update public.users set ign = 'TARIQ MUGHAL'
  where id = 'kdH67upXNFeQ8N05BfuFrkbOCNm1' and (ign is null or ign = '');
update public.users set is_deleted = false where is_deleted is null;
alter table public.users alter column is_deleted set default false;

create or replace function public.user_restore_account(p_uid text) returns json
language plpgsql security definer as $$
begin
  update public.users set is_deleted = false, updated_at = now()
    where id = p_uid and is_deleted = true;
  return json_build_object('ok', true);
end $$;

select json_build_object(
  'restored', (select count(*) from public.users where id in ('zbAzFwSYEnSbisdanTrcB1PriE52','DNPC6OWHmLg5Dq4dByn5IcMHyGC2') and is_deleted = false),
  'tariq_ign', (select ign from public.users where id = 'kdH67upXNFeQ8N05BfuFrkbOCNm1'),
  'rpc', (select count(*) from pg_proc where proname = 'user_restore_account'),
  'nulls_left', (select count(*) from public.users where is_deleted is null)
) as visibility_fix_state;
