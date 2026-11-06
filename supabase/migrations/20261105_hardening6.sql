-- H6: origin read ka sahi tarika — Supabase/PostgREST me reliable
-- source current_setting('request.headers',true)::jsonb hota hai.
create or replace function public.claim_ad_reward() returns jsonb
language plpgsql security definer set search_path='public' as $$
declare v_uid text; v_org text; v_hdrs jsonb;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Not authorized');
  end if;
  begin
    v_hdrs := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_hdrs := null;
  end;
  v_org := coalesce(current_setting('request.header.origin', true), v_hdrs ->> 'origin', '');
  if v_org not like '%deepsilence10161-source.github.io%' then
    return jsonb_build_object('success', false, 'error', 'origin not allowed');
  end if;
  return public.claim_ad_reward_inner();
end $$;
select jsonb_build_object('ad_wrapper_v2', (select count(*) from pg_proc where proname='claim_ad_reward' and prosrc like '%request.headers%')) as h6_proof;
