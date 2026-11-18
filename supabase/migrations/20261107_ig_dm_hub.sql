-- ================================================================
-- 20261107_ig_dm_hub.sql — Instagram DM hub (D46/D47)
-- Owner: "message sambhalne ke liye connect kar raha hu" ⇒ DMs ka
-- server-side hub: webhook tables + FAQ templates + server-only grants.
-- Tokens kabhi client ko nahi dikhte; sirf service_role (edge fn).
-- ================================================================

create table if not exists public.ig_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ig_tokens (
  id integer primary key generated always as identity,
  account text not null unique,          -- 'saniya' | 'leader'
  ig_user_id text not null,              -- Graph /me id (webhook recipient.id)
  token text not null,                   -- long-lived IG token
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ig_dm_templates (
  id integer primary key generated always as identity,
  key text not null unique,
  keywords text[] not null,
  reply text not null,
  active boolean not null default true
);

create table if not exists public.ig_dm_messages (
  id bigint primary key generated always as identity,
  account text not null,
  sender_psid text not null,
  text text not null,
  matched_key text,
  replied_by text,                       -- 'auto-template' | null (draft queue)
  reply_text text,
  created_at timestamptz not null default now()
);

-- webhook handshake token (sirf webhook-verify ke liye; secret-grade nahi)
insert into public.ig_settings (key, value) values ('ig_webhook_verify', 'igdmc_verify_20261107')
on conflict (key) do update set value = excluded.value;

-- FAQ templates (Saniya/brand voice, aap-form, D24/25 tone)
insert into public.ig_dm_templates (key, keywords, reply) values
 ('how_to_join',
  array['join','kaise','how','naya','signup','sign up','register','start'],
  'Hi! Main Saniya, Mini eSports team se 🎮 App me sign-up karke profile me apna Free Fire IGN set kijiye, phir Matches tab se pasand ka room join kar sakte hain. Entry fee wallet se kat-ti hai aur prize turant wallet me aa jata hai 😊'),
 ('payment_safety',
  array['safe','paisa','payment','wallet','withdraw','deposit','upi','secure'],
  'Aapka paisa wallet me safe rehta hai — entry fee sirf match join hone par kat-ti hai ✅ Match cancel ho jaye to full refund milta hai. Withdrawal KYC ke baad hota hai, isliye sab transparent hai.'),
 ('room_credentials',
  array['room id','password','room kab','delay','late','notification','room credentials'],
  'Room ID + password match se 15 minute pehle push notification me aayega 🎯 Tab tak ready rehna. Koi issue ho to app ke Support tab me likhiye, team turant dekhegi.'),
 ('refund_policy',
  array['refund','wapas','paise wapas','money back'],
  'Match cancel ho jaye to full refund wallet me milta hai ✅ No-show par refund nahi hota; platform/admin fault par full refund hota hai. Detail ke liye app ka Support tab use kijiye.'),
 ('creator_program',
  array['creator','youtuber','commission','partner','collab'],
  'Mini eSports creator program me har sponsored match par 20% commission milta hai 💰 Apply app me Creator section se kijiye — main guide kar sakti hoon 😊')
on conflict (key) do update set keywords = excluded.keywords, reply = excluded.reply;

-- RLS: server-only (client ko kuch nahi)
alter table public.ig_settings enable row level security;
alter table public.ig_tokens enable row level security;
alter table public.ig_dm_templates enable row level security;
alter table public.ig_dm_messages enable row level security;
revoke all on public.ig_settings from anon, authenticated;
revoke all on public.ig_tokens from anon, authenticated;
revoke all on public.ig_dm_templates from anon, authenticated;
revoke all on public.ig_dm_messages from anon, authenticated;

-- edge function (service_role) ko admin_notify call karne ka grant
grant execute on function public.admin_notify(text, text, text) to service_role;

select jsonb_build_object(
  'templates', (select count(*) from public.ig_dm_templates),
  'tables', (select count(*) from (values (1),(2),(3),(4)) t)
) as ig_hub_proof;
