update public.users set ign='QAPc2', ff_uid='12345678' where id='IEjEYy5o66Z2tJBy7L9UYdDW4UA2' and (ign is null or ign='');
select jsonb_build_object('ign', (select ign from public.users where id='IEjEYy5o66Z2tJBy7L9UYdDW4UA2'), 'ffuid', (select ff_uid from public.users where id='IEjEYy5o66Z2tJBy7L9UYdDW4UA2')) as qa5_fix;
