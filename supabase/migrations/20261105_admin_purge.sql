-- ADMIN PURGE (owner directive 05 Nov): admin@fft.com (BwZglJY2XffByLls8KHaFyi519t2)
-- ke alawa KOI admin user nahi rahega. QA-Admin31 test account poora
-- delete (users + admins + notifications + push tokens), aur safety ke
-- liye kisi bhi baaki user ka is_admin flag bhi false.
do $$
declare v_qa text := 'oZHczBc32oWoO1cJNe7KEhoFPl22';
        v_keep text := 'BwZglJY2XffByLls8KHaFyi519t2';
begin
  delete from public.notifications where user_id = v_qa;
  if to_regclass('public.user_push_tokens') is not null then
    begin
      execute 'delete from public.user_push_tokens where uid = $1' using v_qa;
    exception when undefined_column then
      execute 'delete from public.user_push_tokens where user_id = $1' using v_qa;
    end;
  end if;
  delete from public.admins where uid <> v_keep;
  update public.users set is_admin = false where is_admin = true and id <> v_keep;
  delete from public.users where id = v_qa;
end $$;

-- D32 end-alert ab sirf admin@fft.com ko jayega (QA admin delete ho chuka)
select public.admin_notify('Admin purge complete', 'admin@fft.com ke alawa sab admin users delete (QA-Admin31 poora hataya). Ab admin alerts sirf aapko.', 'admin_purge') as notified;

select jsonb_build_object(
  'admins_left', (select coalesce(jsonb_agg(jsonb_build_array(uid,email,is_active)),'[]'::jsonb) from public.admins),
  'is_admin_users_left', (select coalesce(jsonb_agg(jsonb_build_array(id,ign,email)),'[]'::jsonb) from public.users where is_admin = true),
  'qa_rows_left', jsonb_build_array(
     (select count(*) from public.users where id='oZHczBc32oWoO1cJNe7KEhoFPl22'),
     (select count(*) from public.notifications where user_id='oZHczBc32oWoO1cJNe7KEhoFPl22'),
     (select count(*) from public.admins where uid='oZHczBc32oWoO1cJNe7KEhoFPl22'))
) as purge_proof;
