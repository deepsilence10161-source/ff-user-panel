grant select, insert, update, delete on public.ig_settings to service_role;
grant select, insert, update, delete on public.ig_tokens to service_role;
grant select, insert, update, delete on public.ig_dm_templates to service_role;
grant select, insert, update, delete on public.ig_dm_messages to service_role;
grant usage, select on sequence public.ig_dm_messages_id_seq to service_role;
select 'grants-ok' as ig_grants_proof;
