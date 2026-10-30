-- ═══════════════════════════════════════════════════════════════════════════
--  20261030_creator_read_own_match_joins.sql
--  MATCH-FLOW-E2E finding (run 40985057330, MF32): creator ka "Result Submit
--  Karo" form hamesha "Koi player nahi mila" dikhata hai — showCreatorResultForm
--  join_requests.select('id,user_ign,ign_at_join').eq('match_id',…) chalata hai,
--  par RLS creator ko APNE match ki join rows padhne ki ijazat hi nahi deta
--  (sirf own-row policies hain). Result: creator UI se result submit hi nahi
--  kar sakta — APK release se pehle pakda gaya P1 bug.
--
--  Fix: ek permissive SELECT policy — user apni rows (pehle se allowed) YA
--  us match ki rows jiska creator wo khud hai (matches.creator_uid = JWT sub).
--  Admin policies untouched; koi write access nahi milta.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'join_requests'
      and policyname = 'creator_read_own_match_joins'
  ) then
    create policy creator_read_own_match_joins on public.join_requests
      for select to authenticated
      using (
        user_id = (auth.jwt() ->> 'sub')
        or exists (
          select 1 from public.matches m
          where m.id = join_requests.match_id
            and m.creator_uid = (auth.jwt() ->> 'sub')
        )
      );
  end if;
end $$;
