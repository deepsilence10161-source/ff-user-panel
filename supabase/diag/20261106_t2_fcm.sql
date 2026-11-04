select jsonb_build_object(
 't2_fcm', (select coalesce(jsonb_agg(jsonb_build_array(id, left(to_jsonb(z)::text,140))),'[]'::jsonb) from (select id, z from net._http_response z where to_jsonb(z)::text not like '%DOCTYPE%' order by id desc limit 2) x)
) as t2_fcm_probe;
