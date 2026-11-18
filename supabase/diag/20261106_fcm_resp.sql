select jsonb_build_object(
 'fcm_resp', (select coalesce(jsonb_agg(jsonb_build_array(id, left(to_jsonb(z)::text,220))),'[]'::jsonb) from (select id, to_jsonb(z) as j, z from net._http_response z where to_jsonb(z)::text not like '%DOCTYPE%' order by id desc limit 6) x)
) as fcm_probe;
