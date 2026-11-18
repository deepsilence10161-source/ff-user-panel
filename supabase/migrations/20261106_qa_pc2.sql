insert into public.users (id, email, ign, ff_uid, is_admin, created_at)
values ('IEjEYy5o66Z2tJBy7L9UYdDW4UA2', 'qa.pc2@fft.test', 'QAPc2', '12345678', false, now())
on conflict (id) do nothing;
select jsonb_build_object('qa5', (select count(*) from public.users where id='IEjEYy5o66Z2tJBy7L9UYdDW4UA2')) as qa5_proof;
