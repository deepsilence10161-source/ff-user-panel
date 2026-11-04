-- TEMP QA-Mobile admin delete (mobile UI audit complete) +
-- QA test ke duplicate premium rows saaf (sirf latest rakho).
delete from public.admins where uid = '7T5KCAgylDQH0ey3QB5jbt3kks13';
delete from public.users where id = '7T5KCAgylDQH0ey3QB5jbt3kks13';
delete from public.notifications where user_id = '7T5KCAgylDQH0ey3QB5jbt3kks13';
delete from public.premium_requests
 where user_id = '9QC8yMUhvGg2Y90ZiI9xNri0Pvy1'
   and id <> (select id from public.premium_requests
               where user_id = '9QC8yMUhvGg2Y90ZiI9xNri0Pvy1'
               order by created_at desc limit 1);
select public.admin_notify('Mobile UI audit complete', '412+360px par poore admin panel ki live jaanch: tables side-swipe, topbar fit, tap-targets, modal buttons fix — sab live deploy + PNG proof. Temp QA admin delete.', 'session_end') as notified;
select jsonb_build_object(
  'admins_left', (select count(*) from public.admins),
  'qa_mobile_left', (select count(*) from public.users where id='7T5KCAgylDQH0ey3QB5jbt3kks13'),
  'qa_premium_rows', (select count(*) from public.premium_requests where user_id='9QC8yMUhvGg2Y90ZiI9xNri0Pvy1')
) as cleanup_proof;
