-- ✅ D76 (2026-11-07): duplicate-screenshot anti-cheat — SERVER backstop.
-- Client (js/shot-guard.js) select-time par hi duplicate rokta hai; ye trigger
-- guarantee deta hai ki bypass hone par bhi duplicate screenshot kisi bhi
-- request table me KABHI save na ho (pending/approved se match).
alter table public.premium_requests   add column if not exists img_hash text;
alter table public.season_pass_requests add column if not exists img_hash text;

create or replace function public.guard_duplicate_screenshot() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare h text;
begin
  h := coalesce(new.img_hash, '');
  if h = '' then return new; end if;
  perform 1 from public.premium_requests
    where img_hash = h and status in ('pending','approved') limit 1;
  if found then raise exception 'DUPLICATE_SCREENSHOT: ye screenshot pehle hi use ho chuka hai'; end if;
  perform 1 from public.sd_requests
    where img_hash = h and status in ('pending','approved') limit 1;
  if found then raise exception 'DUPLICATE_SCREENSHOT: ye screenshot pehle hi use ho chuka hai'; end if;
  perform 1 from public.season_pass_requests
    where img_hash = h and status in ('pending','approved') limit 1;
  if found then raise exception 'DUPLICATE_SCREENSHOT: ye screenshot pehle hi use ho chuka hai'; end if;
  return new;
end $$;

drop trigger if exists trg_dupe_shot_prem on public.premium_requests;
create trigger trg_dupe_shot_prem before insert on public.premium_requests
  for each row execute function public.guard_duplicate_screenshot();
drop trigger if exists trg_dupe_shot_sd on public.sd_requests;
create trigger trg_dupe_shot_sd before insert on public.sd_requests
  for each row execute function public.guard_duplicate_screenshot();
drop trigger if exists trg_dupe_shot_sp on public.season_pass_requests;
create trigger trg_dupe_shot_sp before insert on public.season_pass_requests
  for each row execute function public.guard_duplicate_screenshot();
