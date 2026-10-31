-- 2026-10-31: UI-audit (directive 17) ke QA accounts ka zero-residue cleanup.
-- sirf QA pattern — asli users ko kabhi nahi chhuta.
delete from public.user_push_tokens
 where user_id in (select id from public.users where email like 'qa-push-uia%');
delete from public.wallet_transactions
 where user_id in (select id from public.users where email like 'qa-push-uia%');
delete from public.users where email like 'qa-push-uia%';
select json_build_object(
  'qa_users_left',   (select count(*) from public.users where email like 'qa-push-uia%'),
  'qa_tokens_left',  (select count(*) from public.user_push_tokens where user_id in (select id from public.users where email like 'qa-push-uia%')),
  'users_total_now', (select count(*) from public.users)
) as qa_cleanup_state;
