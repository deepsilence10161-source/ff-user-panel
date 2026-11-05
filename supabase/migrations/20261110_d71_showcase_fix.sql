-- ====================================================================
-- D71 FIX (2026-11-06): showcase policies me auth.uid() (uuid) ki jagah
-- (auth.jwt() ->> 'sub') — hamara Supabase login Firebase-uid custom
-- token se hota hai (sub = text uid), isliye uuid literal crash karta
-- tha (22P02). Partial state saaf karke sahi policies banate hain.
-- ====================================================================
drop policy if exists "showcase insert own" on public.creator_showcase;
drop policy if exists "showcase delete own or owner" on public.creator_showcase;

create policy "showcase insert own" on public.creator_showcase
  for insert to authenticated with check ((auth.jwt() ->> 'sub') = creator_uid);
create policy "showcase delete own or owner" on public.creator_showcase
  for delete to authenticated using ((auth.jwt() ->> 'sub') = creator_uid
                    or (auth.jwt() ->> 'sub') = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3');
