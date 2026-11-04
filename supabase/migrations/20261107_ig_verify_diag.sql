select key, value from public.ig_settings where key = $$ig_webhook_verify$$ as ig_verify_diag;
select count(*) as tpl from public.ig_dm_templates;
