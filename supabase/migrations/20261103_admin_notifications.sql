-- =====================================================================
-- ADMIN NOTIFICATIONS (2026-11-03, owner order): agent kaam poora karte
-- hi admin panel par alert bhejta hai — bell + badge + toast + beep.
-- =====================================================================
create table if not exists public.admin_notifications (
  id         bigserial primary key,
  title      text not null default '',
  body       text not null default '',
  kind       text not null default 'info',   -- info | success | warn | work
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.admin_notifications enable row level security;
drop policy if exists admin_notifs_all on public.admin_notifications;
create policy admin_notifs_all on public.admin_notifications
  for all to authenticated using (true) with check (true);
create index if not exists admin_notifs_created_idx
  on public.admin_notifications (created_at desc);

select json_build_object(
  'table', to_regclass('public.admin_notifications') is not null,
  'policies', (select count(*) from pg_policies where tablename = 'admin_notifications')
) as admin_notif_state;
