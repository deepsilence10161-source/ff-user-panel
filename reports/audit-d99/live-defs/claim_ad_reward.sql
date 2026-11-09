CREATE OR REPLACE FUNCTION public.claim_ad_reward()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid text; v_org text; v_hdrs jsonb; v_sid bigint;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Not authorized'); end if;
  begin
    v_hdrs := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then v_hdrs := null; end;
  v_org := coalesce(current_setting('request.header.origin', true), v_hdrs ->> 'origin', '');
  if v_org not like '%deepsilence10161-source.github.io%' then
    return jsonb_build_object('success', false, 'error', 'origin not allowed');
  end if;
  select id into v_sid from public.ad_watch_sessions
   where uid = v_uid and not consumed
     and started_at between now() - interval '150 seconds' and now() - interval '4 seconds'
   order by started_at desc limit 1;
  if v_sid is null then
    return jsonb_build_object('success', false, 'error', 'no active ad session — pehle ad dekhiye');
  end if;
  update public.ad_watch_sessions set consumed = true where id = v_sid;
  return public.claim_ad_reward_inner();
end $function$
