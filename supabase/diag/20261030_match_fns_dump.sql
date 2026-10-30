-- READ-ONLY diagnostic dump (match-flow E2E iteration 5 ke liye):
-- server functions ke source + join_requests policies + team/gift tables ke
-- constraints. Kuch modify nahi hota.
select string_agg(x, E'\n@@@SPLIT@@@\n') as dump from (
  select 'FN: ' || p.proname || E'\n' || pg_get_functiondef(p.oid) as x
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('join_match_team', 'validate_and_join_match',
                      'respond_team_invite', 'invite_team_members',
                      'claim_match_refund', 'cancel_match_with_refunds',
                      'gift_match_entry')
  union all
  select 'POLICY[join_requests]: ' || policyname || ' cmd=' || cmd
         || ' permissive=' || permissive || ' roles=' || array_to_string(roles, ',')
         || ' qual=' || coalesce(qual, '-') || ' with_check=' || coalesce(with_check, '-')
  from pg_policies where schemaname = 'public' and tablename = 'join_requests'
  union all
  select 'TEAMTABLE: ' || table_name
  from information_schema.tables
  where table_schema = 'public'
    and (table_name like '%team%' or table_name like '%consent%'
         or table_name like '%gift%' or table_name like '%invite%')
  union all
  select 'CONSTRAINT: ' || c.conrelid::regclass::text || ' ' || c.conname
         || ' = ' || pg_get_constraintdef(c.oid)
  from pg_constraint c
  where c.conrelid::regclass::text in ('team_invitations', 'gifted_tickets', 'gift_tickets', 'match_gifts')
) t;
