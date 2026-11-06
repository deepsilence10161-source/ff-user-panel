insert into public.users (id, email, ign, ff_uid, is_admin, created_at)
values ('W2Gt9VTGCAWIboTf43vxR6Htmkz2', 'qa.pc6@fft.test', 'QAPc6', '77775555', false, now())
on conflict (id) do update set ign='QAPc6', ff_uid='77775555';
select jsonb_build_object('qa6', (select ign from public.users where id='W2Gt9VTGCAWIboTf43vxR6Htmkz2')) as qa6_proof;
