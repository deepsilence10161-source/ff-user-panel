-- QA E2E ke duplicate premium rows saaf (sirf latest 1 demo row rakhi)
delete from public.premium_requests
 where user_id = '9QC8yMUhvGg2Y90ZiI9xNri0Pvy1'
   and id <> (select id from public.premium_requests
               where user_id = '9QC8yMUhvGg2Y90ZiI9xNri0Pvy1'
               order by created_at desc limit 1);
select public.admin_notify(
 '✅ D31 LIVE: Request system + Users view fix',
 'Creator Applications aur Premium Requests sections ab admin panel me live hain (pehle sections toote the). Har nayi request par bell + device push turant aayega. Users tab me Premium/Season/Creator/Admin filters + badges lage. QA-YouTuber31 ki demo request pending rakhi hai — panel kholkar Approve/Reject khud try karein. Hunter7 ab normal user hai. PNG screenshots chat me bheje hain.',
 'success') as notified;
