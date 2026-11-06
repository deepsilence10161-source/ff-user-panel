-- ====================================================================
-- D71 FIX (2026-11-06): poora showcase setup ek hi transaction-safe
-- batch me. Pehla attempt 22P02 (uuid literal) par roll-back hua tha,
-- isliye table bhi exist nahi karta. Policies (auth.jwt()->>'sub')
-- pattern use karti hain — hamara Supabase login Firebase-uid custom
-- token se hota hai (sub = text uid).
-- ====================================================================
create table if not exists public.creator_showcase (
  id          uuid primary key default gen_random_uuid(),
  creator_uid text not null,
  video_url   text not null,
  title       text,
  thumb_url   text,
  created_at  timestamptz not null default now()
);
alter table public.creator_showcase enable row level security;

drop policy if exists "showcase read all" on public.creator_showcase;
drop policy if exists "showcase insert own" on public.creator_showcase;
drop policy if exists "showcase delete own or owner" on public.creator_showcase;

create policy "showcase read all" on public.creator_showcase
  for select using (true);
create policy "showcase insert own" on public.creator_showcase
  for insert to authenticated with check ((auth.jwt() ->> 'sub') = creator_uid);
create policy "showcase delete own or owner" on public.creator_showcase
  for delete to authenticated using ((auth.jwt() ->> 'sub') = creator_uid
                    or (auth.jwt() ->> 'sub') = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3');

grant select on public.creator_showcase to anon, authenticated, service_role;
grant insert, delete on public.creator_showcase to authenticated;
