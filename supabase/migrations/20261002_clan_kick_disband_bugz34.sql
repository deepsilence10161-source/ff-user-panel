-- ═══════════════════════════════════════════════════════════════
-- 2026-10-02 · BUG Z3 (kick fake-success) + BUG Z4 (disband half-done)
-- WALK10s live-proven:
--   Z3: leader Kick → v30 client chain sirf apni hi rows delete kar
--       paata tha (cm_delete_own policy) → 0-rows "success", member row
--       bachi rehti thi, total_members galat, partner ka clan_id stale.
--   Z4: leader Disband → clans table par koi DELETE policy hi nahi thi
--       → clan row kabhi delete nahi hoti (silent 0-rows), partner rows
--       stale. Half-disband + fake-success toast.
-- Fix: server-authoritative RPCs (join_clan/leave_clan jaisa pattern —
-- auth.jwt()->>'sub' caller verify, SECURITY DEFINER, search_path pinned)
-- + client RPC-first patches (bugfix-v30-final.js usi commit me).
-- ═══════════════════════════════════════════════════════════════

create or replace function kick_clan_member(p_clan_id uuid, p_member_uid text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.jwt() ->> 'sub';
  v_leader text;
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select leader_uid into v_leader from clans where id = p_clan_id;
  if coalesce(v_leader, '') is distinct from v_caller then
    return jsonb_build_object('ok', false, 'error', 'not_leader');
  end if;
  if p_member_uid = v_caller then
    return jsonb_build_object('ok', false, 'error', 'cannot_kick_self');
  end if;
  delete from clan_members where clan_id = p_clan_id and user_id = p_member_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_a_member');
  end if;
  update users set clan_id = null
   where id = p_member_uid and clan_id = p_clan_id;
  update clans c
     set total_members = (select count(*) from clan_members m where m.clan_id = c.id)
       + case when c.leader_uid is not null
               and not exists (select 1 from clan_members m2
                                where m2.clan_id = c.id and m2.user_id = c.leader_uid)
              then 1 else 0 end
   where c.id = p_clan_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function disband_clan(p_clan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.jwt() ->> 'sub';
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if not exists (select 1 from clans where id = p_clan_id and leader_uid = v_caller) then
    return jsonb_build_object('ok', false, 'error', 'not_leader');
  end if;
  update users set clan_id = null where clan_id = p_clan_id;
  delete from clan_members where clan_id = p_clan_id;
  delete from clan_war_challenges
   where from_clan = p_clan_id or to_clan = p_clan_id;
  delete from clans where id = p_clan_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'delete_failed');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function kick_clan_member(uuid, text) to anon, authenticated;
grant execute on function disband_clan(uuid) to anon, authenticated;
