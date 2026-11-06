/* Tariq (kdH67upXNFeQ8N05BfuFrkbOCNm1) — app me usne kya kya kiya, sab IST me */
select json_build_object(
  'profile', (select to_jsonb(x) from (select id, ign, email, avatar_url, is_deleted,
                to_char(created_at at time zone 'Asia/Kolkata','DD Mon YYYY HH12:MI AM') as bana_ist,
                to_char(updated_at at time zone 'Asia/Kolkata','DD Mon YYYY HH12:MI AM') as update_ist
              from public.users where id='kdH67upXNFeQ8N05BfuFrkbOCNm1') x),
  'wallet_tx', (select coalesce(json_agg(to_jsonb(x)),'[]'::json) from (
      select amount, txn_type, reason, to_char(created_at at time zone 'Asia/Kolkata','DD Mon HH12:MI AM') as at_ist
        from public.wallet_transactions where user_id='kdH67upXNFeQ8N05BfuFrkbOCNm1'
       order by created_at desc limit 10) x),
  'joins', (select coalesce(json_agg(to_jsonb(x)),'[]'::json) from (
      select jr.status, left(coalesce(m.title,'?'),36) as match_title,
             to_char(jr.created_at at time zone 'Asia/Kolkata','DD Mon HH12:MI AM') as at_ist
        from public.join_requests jr left join public.matches m on m.id=jr.match_id
       where jr.user_id='kdH67upXNFeQ8N05BfuFrkbOCNm1' order by jr.created_at desc limit 10) x),
  'notifs', (select coalesce(json_agg(to_jsonb(x)),'[]'::json) from (
      select type, title, to_char(created_at at time zone 'Asia/Kolkata','DD Mon HH12:MI AM') as at_ist
        from public.notifications where user_id='kdH67upXNFeQ8N05BfuFrkbOCNm1'
       order by created_at desc limit 8) x),
  'support_tickets', (select coalesce(json_agg(to_jsonb(x)),'[]'::json) from (
      select * from public.support_tickets where user_id='kdH67upXNFeQ8N05BfuFrkbOCNm1' limit 5) x),
  'chat_msgs', (select coalesce(json_agg(to_jsonb(x)),'[]'::json) from (
      select match_id, left(text,50) as text, to_char(created_at at time zone 'Asia/Kolkata','DD Mon HH12:MI AM') as at_ist
        from public.match_chat where user_id='kdH67upXNFeQ8N05BfuFrkbOCNm1' order by created_at desc limit 8) x),
  'sd_requests', (select coalesce(json_agg(to_jsonb(x)),'[]'::json) from (
      select * from public.sd_requests where user_id='kdH67upXNFeQ8N05BfuFrkbOCNm1' limit 5) x),
  'match_row', (select to_jsonb(x) from (
      select m.title, m.status, m.mode, m.entry_fee, m.max_slots, m.filled_slots, m.first_prize,
             to_char(m.scheduled_at at time zone 'Asia/Kolkata','DD Mon YYYY HH12:MI AM') as time_ist
        from public.matches m where m.id = 'cm_c6a5d4dc-7611-4f49-aa1c-311ff2aeae21') x)
) as tariq_activity;
