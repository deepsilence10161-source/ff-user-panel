-- D83 (6-Nov-2026, owner: "user interested hai to admin ko pata hi nahi chalta")
-- match_interest me naya row ghusate hi admin panel ki notification feed me
-- entry chali jaati hai (server-side trigger — client par bharosa nahi).
create or replace function public.notify_admin_match_interest()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (title, body, kind)
  values (
    '💡 Match Interest',
    coalesce(nullif(new.name, ''), 'Ek user') || ' ne match ' || left(coalesce(new.match_id::text, '?'), 12) || ' me interest dikhaya',
    'info'
  );
  return new;
end $$;

drop trigger if exists trg_interest_admin_notify on public.match_interest;
create trigger trg_interest_admin_notify
  after insert on public.match_interest
  for each row execute function public.notify_admin_match_interest();
