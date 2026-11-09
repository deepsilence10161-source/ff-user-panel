CREATE OR REPLACE FUNCTION public.ad_watch_start()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid text; v_id bigint;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Not authorized'); end if;
  insert into public.ad_watch_sessions(uid) values (v_uid) returning id into v_id;
  return jsonb_build_object('success', true, 'session', v_id);
end $function$
