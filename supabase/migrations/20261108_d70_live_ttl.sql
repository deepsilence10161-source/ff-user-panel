-- ====================================================================
-- D70 (2026-11-06): LIVE STREAM TTL — purani/atki hui "live" streams
-- khud hide ho jaayen (owner complaint: din-purane test streams abhi
-- tak "Live" dikha rahe the).
--   1. users.stream_live_until : go-live save par now()+6h set hota hai;
--      stream end/off par NULL.
--   2. user_live_streams VIEW : sirf wo rows jo sach me live-window me
--      hain (is_live + link + until > now()). Purani rows (NULL until)
--      view me aati hi nahi ⇒ list se khud hat jaati hain.
--   3. Grants waise hi jaise user_public_profiles ke hain (anon+
--      authenticated read-only).
-- ====================================================================
alter table public.users add column if not exists stream_live_until timestamptz;

create or replace view public.user_live_streams as
select id, ign, avatar_url, stream_link, stream_title, stream_live_until
from public.users
where is_live is true
  and stream_link is not null
  and stream_live_until is not null
  and stream_live_until > now();

grant select on public.user_live_streams to anon, authenticated, service_role;
