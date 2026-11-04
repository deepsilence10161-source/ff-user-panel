/* ================================================================
   supabase/functions/ig-dm-hub/index.ts  (v1 — 2026-11-07, D46)
   ----------------------------------------------------------------
   KYU: owner chahte hain ki Instagram ke DONO accounts (zone_queen_55
        = Saniya, mini_esports_official = Leader) ke DMs machine sambhale:
        FAQ type messages ka TURANT template reply, baaki sab owner ko
        admin-panel alert + agent draft-queue me.
   KYA: Meta webhook (Instagram API with Instagram Login — messaging).
        GET  = hub.verify handshake (verify_token DB ig_settings me).
        POST = entry[].messaging[] → ig_dm_messages me insert →
               template match (keywords) → token ho to Graph
               /me/messages se auto-reply → warna admin_notify alert.
   SECURITY: tables server-only (anon/auth grants nahi); token DB
        (ig_tokens) me service_role-only; webhook verify_token DB me.
   NOTE: Graph messaging 24h reply-window follow karta hai; window ke
        bahar ka message sirf queue/alert hota hai, auto-reply nahi.
   ================================================================ */
import { createClient } from 'npm:@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v21.0';
const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function log(...a: unknown[]) { console.log('[ig-dm-hub]', ...a); }

async function getSetting(key: string): Promise<string | null> {
  const { data } = await supa.from('ig_settings').select('value').eq('key', key).maybeSingle();
  return data ? (data.value as string) : null;
}

async function findTemplate(text: string) {
  const t = (text || '').toLowerCase();
  const { data } = await supa.from('ig_dm_templates').select('key,reply,keywords').eq('active', true);
  for (const row of data || []) {
    const kws: string[] = row.keywords || [];
    if (kws.some((k) => t.includes(k.toLowerCase()))) return row;
  }
  return null;
}

async function tokenFor(igUserId: string) {
  const { data } = await supa
    .from('ig_tokens')
    .select('account,token,expires_at')
    .eq('ig_user_id', igUserId)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

async function sendReply(token: string, senderPsid: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`${GRAPH}/me/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderPsid }, message: { text } }),
    });
    const j = await r.json();
    if (!r.ok) { log('graph send fail', r.status, JSON.stringify(j).slice(0, 200)); return false; }
    return true;
  } catch (e) { log('graph send err', e); return false; }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  /* ---- Meta webhook verify handshake ---- */
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const vt = url.searchParams.get('hub.verify_token');
    const ch = url.searchParams.get('hub.challenge') || '';
    if (mode === 'subscribe' && vt) {
      const want = await getSetting('ig_webhook_verify');
      if (want && vt === want) {
        log('verify ok');
        return new Response(ch, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
      log('verify FAIL');
      return new Response('forbidden', { status: 403 });
    }
    return new Response('ig-dm-hub alive', { status: 200 });
  }

  if (req.method !== 'POST') return new Response('method', { status: 405 });

  let body: any;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  if (body?.object !== 'instagram' && !Array.isArray(body?.entry)) return new Response('ignored', { status: 200 });

  let handled = 0;
  for (const entry of body.entry || []) {
    for (const m of entry.messaging || []) {
      const senderPsid: string = m?.sender?.id || '';
      const recipientId: string = m?.recipient?.id || '';
      const text: string = m?.message?.text || '';
      if (!senderPsid || !text) continue;
      handled++;

      const tok = await tokenFor(recipientId);
      const acct: string = tok ? tok.account : 'unknown:' + recipientId;
      const tpl = await findTemplate(text);

      const { data: row, error } = await supa
        .from('ig_dm_messages')
        .insert({ account: acct, sender_psid: senderPsid, text, matched_key: tpl ? tpl.key : null })
        .select('id')
        .single();
      if (error) { log('insert fail', error.message); continue; }

      let repliedBy: string | null = null;
      if (tpl && tok) {
        const ok = await sendReply(tok.token, senderPsid, tpl.reply);
        if (ok) repliedBy = 'auto-template';
      }
      if (repliedBy) {
        await supa.from('ig_dm_messages').update({ replied_by: repliedBy, reply_text: tpl.reply }).eq('id', row.id);
        log('auto-reply', acct, tpl.key);
      } else {
        /* owner ko alert + agent draft queue */
        try {
          await supa.rpc('admin_notify', {
            p_title: '📩 Naya Instagram DM (' + acct + ')',
            p_body: 'Sender PSID ' + senderPsid + ' ne likha: "' + text.slice(0, 140) + '"' +
              (tpl ? ' • template "' + tpl.key + '" match hua par token/window nahi — draft queue me.' : ' • koi template match nahi — agent draft banayega.'),
            p_kind: 'ig_dm',
          });
        } catch (e) { log('admin_notify err', e); }
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, handled }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
