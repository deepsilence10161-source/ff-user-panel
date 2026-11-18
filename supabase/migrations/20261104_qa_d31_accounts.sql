-- D31 QA accounts (live E2E ke liye — screenshots ke baad owner bole to hata denge)
insert into public.users (id, ign, email, is_admin, is_creator, premium_level)
values ('9QC8yMUhvGg2Y90ZiI9xNri0Pvy1','QA-YouTuber31','qa.youtuber31@fft.test',false,false,0)
on conflict (id) do update set ign=excluded.ign;
insert into public.users (id, ign, email, is_admin, is_creator, premium_level)
values ('oZHczBc32oWoO1cJNe7KEhoFPl22','QA-Admin31','qa.admin31@fft.test',true,false,0)
on conflict (id) do update set is_admin=true;
insert into public.admins (uid, role, email, is_active, display_name)
values ('oZHczBc32oWoO1cJNe7KEhoFPl22','admin','qa.admin31@fft.test',true,'QA-Admin31')
on conflict (uid) do update set is_active=true;
select jsonb_build_object(
 'qa_user',(select to_jsonb(x) from (select id,ign,is_admin from public.users where id='9QC8yMUhvGg2Y90ZiI9xNri0Pvy1') x),
 'qa_admin',(select to_jsonb(x) from (select id,ign,is_admin from public.users where id='oZHczBc32oWoO1cJNe7KEhoFPl22') x),
 'admins_row',(select count(*) from public.admins where uid='oZHczBc32oWoO1cJNe7KEhoFPl22')
) as qa_proof;
