select json_agg(json_build_object('fn', proname, 'args', pg_get_function_arguments(oid))) as pgnet_sigs
  from pg_proc where proname in ('http_get','http_post') and pronamespace = (select oid from pg_namespace where nspname='net');
