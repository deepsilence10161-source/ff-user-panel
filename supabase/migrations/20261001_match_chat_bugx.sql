-- ═══════════════════════════════════════════════════════════════════
-- 2026-10-01 — Bug X fix: match_chat table (Match Chat backend)
--
-- Bug X (live-proven WALK10o): Match Chat feature-ne db.ref('matchChat/')
-- par messages bheje the, lekin db-bridge me na write case tha na read —
-- sab messages SILENTLY vanish (sender ko tak apna message nahi dikhta tha).
--
-- Fix: (1) ye table + RLS;  (2) user-panel core/db-bridge.js me
-- matchChat read/write cases (commit isi ke saath).
--
-- RLS model = project ka established pattern:
--   - Firebase Third-Party Auth JWT me 'role' claim NAHI hota
--     (effective role = anon), isliye policies 'public' par hain
--   - identity = auth.jwt() ->> 'sub' (Firebase UID, uuid NAHI —
--     isliye auth.uid() use NAHI kar sakte)
-- Grants harden-projects ke default (no implicit grants) ko cover karte hain.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists match_chat (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references matches(id) on delete cascade,
  user_id text not null,
  name text,
  text text not null,
  created_at timestamptz not null default now()
);

alter table match_chat enable row level security;

drop policy if exists chat_insert_own on match_chat;
create policy chat_insert_own on match_chat for insert to public
  with check (auth.jwt() ->> 'sub' = user_id);

-- sirf wahi dekh sakta hai jo khud ka message hai, ya us match me
-- active join hai, ya admin hai
drop policy if exists chat_select_player on match_chat;
create policy chat_select_player on match_chat for select to public
  using (
    auth.jwt() ->> 'sub' = user_id
    or exists (
      select 1 from join_requests jr
      where jr.match_id = match_chat.match_id
        and jr.user_id = auth.jwt() ->> 'sub'
        and jr.status not in ('cancelled','refunded','no_show','rejected')
    )
    or (auth.jwt() ->> 'sub') in (select users.id from users where users.is_admin = true)
  );

create index if not exists idx_match_chat_mid on match_chat(match_id, created_at);

grant select, insert on public.match_chat to anon, authenticated;
