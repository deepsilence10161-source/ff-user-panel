/* ================================================================
   supabase/functions/ig-dm-hub/index.ts  (v2 — 2026-11-05, D64)
   ----------------------------------------------------------------
   KYU: owner chahte hain ki Instagram ke DONO accounts (zone_queen_55
        = Saniya, mini_esports_official = Leader) ke DMs machine sambhale:
        FAQ type messages ka TURANT template reply, baaki sab owner ko
        admin-panel alert + agent draft-queue me.
   KYA: Meta webhook (Instagram API with Unified login — messaging).
        GET  = hub.verify handshake (verify_token DB ig_settings me).
        GET  ?debug=1 = DB/env probe.
        POST ?admin=store_token / ?admin=list_tokens (header
             x-verify-token) = token provisioning, service_role se DB.
        POST webhook = entry[].messaging[] → ig_dm_messages insert →
             template match → token ho to Graph
             POST /{ig_user_id}/messages se auto-reply → warna alert.
   v2 CHANGES (D64):
        - Tokens ab SYSTEM-USER (SUAT, never-expire) hain; SUAT par
          /me/messages chalta NAHI (live probe: GraphMethodException
          #100 subcode 33). Isliye send path = /{ig_user_id}/messages.
        - ig_user_id pehle unknown hota hai (store_token par
          'unresolved'); pehle webhook par Graph /{id}?fields=username
          se resolve karke row bind hoti hai.
        - GRAPH v24.0.
   SECURITY: tables server-only (anon/auth grants nahi); token DB
        (ig_tokens) me service_role-only; webhook verify_token DB me;
        admin endpoint wahi verify_token header me maangta hai.
   NOTE: Graph messaging 24h reply-window follow karta hai; window ke
        bahar ka message sirf queue/alert hota hai, auto-reply nahi.
   ================================================================ */
import { createClient } from 'npm:@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v24.0';
const UNRESOLVED = 'unresolved';
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

async function usernameOf(token: string, igUserId: string): Promise<string | null> {
  try {
    const r = await fetch(`${GRAPH}/${igUserId}?fields=username&access_token=${encodeURIComponent(token)}`);
    const j = await r.json();
    return j && j.username ? String(j.username).toLowerCase() : null;
  } catch (e) { log('usernameOf err', e); return null; }
}

async function tokenFor(igUserId: string) {
  const { data } = await supa
    .from('ig_tokens')
    .select('account,token,expires_at,ig_user_id')
    .eq('ig_user_id', igUserId)
    .maybeSingle();
  if (data) {
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
    return data;
  }
  /* resolve: unresolved rows me se username match karo aur bind karo */
  const { data: pend } = await supa
    .from('ig_tokens')
    .select('account,token,expires_at,ig_user_id')
    .eq('ig_user_id', UNRESOLVED);
  for (const row of pend || []) {
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) continue;
    const un = await usernameOf(row.token, igUserId);
    if (un && un === String(row.account).toLowerCase()) {
      await supa.from('ig_tokens').update({ ig_user_id: igUserId, updated_at: new Date().toISOString() }).eq('account', row.account);
      log('resolved', row.account, '->', igUserId);
      return row;
    }
  }
  return null;
}

async function sendReply(token: string, igUserId: string, senderPsid: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`${GRAPH}/${igUserId}/messages`, {
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
    if (url.searchParams.get('debug') === '1') {
      let dbOk: string = 'untested';
      try {
        const { data, error } = await supa.from('ig_settings').select('key').limit(1);
        dbOk = error ? ('err:' + error.message) : ('rows:' + JSON.stringify(data));
      } catch (e) { dbOk = 'throw:' + e; }
      return new Response(JSON.stringify({ hasURL: !!Deno.env.get('SUPABASE_URL'), hasSR: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), dbOk }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('ig-dm-hub alive', { status: 200 });
  }

  if (req.method !== 'POST') return new Response('method', { status: 405 });

  /* ---- admin: token provisioning (x-verify-token guard) ---- */
  const admin = url.searchParams.get('admin');
  if (admin === 'store_token' || admin === 'list_tokens') {
    const want = await getSetting('ig_webhook_verify');
    if (!want || req.headers.get('x-verify-token') !== want) return new Response('forbidden', { status: 403 });
    if (admin === 'list_messages') {
      const { data } = await supa
        .from('ig_dm_messages')
        .select('id,account,sender_psid,text,matched_key,replied_by,created_at')
        .order('id', { ascending: false })
        .limit(10);
      return new Response(JSON.stringify({ ok: true, rows: data || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (admin === 'list_tokens') {
      const { data } = await supa.from('ig_tokens').select('account,ig_user_id,expires_at,updated_at');
      const rows = (data || []).map((r: any) => ({ account: r.account, ig_user_id: r.ig_user_id, expires_at: r.expires_at, updated_at: r.updated_at }));
      return new Response(JSON.stringify({ ok: true, rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    let b: any;
    try { b = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
    const account = String(b?.account || '').trim();
    const token = String(b?.token || '').trim();
    if (!account || !token) return new Response('account+token chahiye', { status: 400 });
    const { data: ex } = await supa.from('ig_tokens').select('account,ig_user_id').eq('account', account).maybeSingle();
    if (ex) {
      await supa.from('ig_tokens').update({ token, updated_at: new Date().toISOString() }).eq('account', account);
    } else {
      await supa.from('ig_tokens').insert({ account, token, ig_user_id: UNRESOLVED });
    }
    log('store_token', account, ex ? 'updated' : 'inserted');
    return new Response(JSON.stringify({ ok: true, account, mode: ex ? 'updated' : 'inserted' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

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
        const ok = await sendReply(tok.token, recipientId, senderPsid, tpl.reply);
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
