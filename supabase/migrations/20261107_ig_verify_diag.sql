select (select value from public.ig_settings where key = 'ig_webhook_verify') as ig_verify_diag, (select count(*) from public.ig_dm_templates) as tpl;
