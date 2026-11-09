CREATE OR REPLACE FUNCTION public.claim_watch_earn_reward(p_match_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid text; v_started timestamptz; v_beat timestamptz;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Not authorized'); end if;
  select started_at, last_beat into v_started, v_beat
    from public.watch_earn_sessions
   where uid = v_uid and match_id = p_match_id and closed_at is null
   order by started_at desc limit 1;
  if v_started is null then
    return jsonb_build_object('success', false, 'error', 'watch session not active');
  end if;
  if now() - v_beat > interval '100 seconds' then
    return jsonb_build_object('success', false, 'error', 'watch session stale — match live dekhte rahiye');
  end if;
  if now() - v_started < interval '45 seconds' then
    return jsonb_build_object('success', false, 'error', 'abhi watch shuru hua — thodi der me reward');
  end if;
  return public.claim_watch_earn_inner(p_match_id);
end $function$
