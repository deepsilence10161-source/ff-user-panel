-- ═══════════════════════════════════════════════════════════════
-- BUG Z9 FIX (2026-10-02) — WALK11s live-proven:
-- (1) admin_roll_battle_pass_season: v_next CURRENT_DATE+1month से बनता था —
--     lapsed-month roll (Sep-season active रहना, Oct में roll) पर वह महीना
--     छूट जाता है (live: Oct-roll ने Nov बनाया, Oct कभी नहीं)। अब next-key
--     CURRENT SEASON-CHAIN से (cur.key+1month) — mid-month व lapsed दोनों सही।
-- (2) season_pass_requests पर UPDATE-policy ही नहीं थी — admin approve/reject
--     bridge-update मौन-0-rows (status pending-hी रहता, झूठा 'approved' toast)।
--     अब spr_update_admin (admin-only)।
-- ═══════════════════════════════════════════════════════════════

create or replace function admin_roll_battle_pass_season()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid text := auth.jwt() ->> 'sub';
  v_admin boolean;
  v_cur battle_passes%rowtype;
  v_y int; v_m int; v_next_key text; v_next_num int; v_start date; v_end date; v_name text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;
  select is_admin into v_admin from users where id = v_uid;
  if not coalesce(v_admin, false) then
    return jsonb_build_object('ok', false, 'error', 'Admin only');
  end if;
  select * into v_cur from battle_passes where is_active = true order by start_date desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'No active season found');
  end if;
  if v_cur.end_date is not null and v_cur.end_date >= current_date then
    return jsonb_build_object('ok', false, 'error', 'Current season abhi chal raha hai (ends ' || v_cur.end_date || ') — mahina khatam hone ke baad roll karo');
  end if;
  -- ✅ BUG Z9 FIX: next-month CURRENT_DATE से नहीं — current season-chain से,
  -- वरना lapsed-month roll पर एक महीना छूट जाता है (live-proven)।
  v_y := split_part(v_cur.season_key, '_', 1)::int;
  v_m := split_part(v_cur.season_key, '_', 2)::int;
  v_m := v_m + 1;
  if v_m > 12 then v_m := 1; v_y := v_y + 1; end if;
  v_next_key := v_y::text || '_' || lpad(v_m::text, 2, '0');
  v_next_num := coalesce(v_cur.season_num, 0) + 1;
  v_start := make_date(v_y, v_m, 1);
  v_end := (make_date(v_y, v_m, 1) + interval '1 month - 1 day')::date;
  if exists (select 1 from battle_passes where season_key = v_next_key) then
    return jsonb_build_object('ok', false, 'error', 'Season ' || v_next_key || ' already exists');
  end if;
  v_name := 'Season ' || v_next_num || ' — ' || trim(to_char(v_start, 'Mon')) || ' ' || to_char(v_start, 'YYYY');
  update battle_passes set is_active = false where is_active = true;
  insert into battle_passes(id, name, season_num, season_key, is_active, tiers, start_date, end_date)
  values (gen_random_uuid(), v_name, v_next_num, v_next_key, true, v_cur.tiers, v_start, v_end);
  return jsonb_build_object('ok', true, 'season', v_next_key, 'name', v_name, 'tiers', jsonb_array_length(v_cur.tiers));
end;
$$;

create policy spr_update_admin on season_pass_requests for update to anon, authenticated
using ((auth.jwt() ->> 'sub') in (select id from users where is_admin = true))
with check ((auth.jwt() ->> 'sub') in (select id from users where is_admin = true));
