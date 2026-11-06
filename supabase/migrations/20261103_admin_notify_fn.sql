-- =====================================================================
-- ADMIN NOTIFY FN (2026-11-03, owner order): "notification browser se
-- mile, admin panel band ho tab bhi — user panel ki tarah".
-- admin_notify() do jagah likhta hai:
--   1) admin_notifications → panel me bell/badge/toast
--   2) notifications (owner uid) → existing push trigger → device PUSH
--      (FCM/web-push, bilkul user panel jaisa, panel band ho tab bhi)
-- =====================================================================
create or replace function public.admin_notify(p_title text, p_body text, p_kind text default 'info')
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_owner text := 'TyHtzFOnggMxWbEdTnTdEl2j7oF3';
begin
  insert into public.admin_notifications (title, body, kind) values (p_title, p_body, p_kind);
  insert into public.notifications (user_id, type, title, body)
       values (v_owner, 'admin_alert', p_title, p_body);
  return json_build_object('ok', true, 'owner_push', true);
end $$;

select json_build_object('fn', to_regprocedure('public.admin_notify(text,text,text)') is not null) as admin_notify_state;
