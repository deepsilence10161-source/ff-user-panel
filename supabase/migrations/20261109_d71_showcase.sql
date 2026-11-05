-- ====================================================================
-- D71 (2026-11-06): CREATOR SHOWCASE — owner approved ("hn bana de
-- showcase system"). Creator ki YouTube videos ki gallery, Creator
-- Profile sheet me. KOI watch-reward nahi (YouTube ToS-safe) — sirf
-- promotion/self-expression.
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

create policy "showcase read all" on public.creator_showcase
  for select using (true);
create policy "showcase insert own" on public.creator_showcase
  for insert with check (auth.uid()::text = creator_uid);
create policy "showcase delete own or owner" on public.creator_showcase
  for delete using (auth.uid()::text = creator_uid
                    or auth.uid() = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3');

grant select on public.creator_showcase to anon, authenticated, service_role;
grant insert, delete on public.creator_showcase to authenticated;
