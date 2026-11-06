select public.admin_notify('Push chain test', 'Ye test alert push-chain verify karne ke liye hai.', 'push_test') as notified;
select jsonb_build_object('done', true) as chain_test_sent;
