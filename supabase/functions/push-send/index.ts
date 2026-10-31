/* ================================================================
   supabase/functions/push-send/index.ts  (v3 — FCM, 2026-10-31)
   ────────────────────────────────────────────────────────────────
   Push bhejne ka EK-MATRA server path.
   MIGRATION: OneSignal → Firebase FCM direct ($0 + unlimited;
   OneSignal free cap 1,000 MAU 1-Oct-2026 se live tha).

   PRIMARY  : FCM HTTP v1 — data-only messages (android+web dono par
              onMessageReceived/onBackgroundMessage hi display karte
              hain → consistent tap behaviour). Auth: service-account
              RS256 JWT (WebCrypto) → OAuth2 access token (cached).
              Secret: FIREBASE_SERVICE_ACCOUNT_JSON.
   FALLBACK : OneSignal (transition) — JAB user ke koi FCM token na
              ho (purane APK abhi bhi OneSignal SDK chalate hain) AUR
              ONESIGNAL_* secrets maujood hon. Naye APK/web par FCM
              tokens hote hain, isliye double-send KABHI nahi hota.
              (Old-APK adoption poori hone ke baad yeh block hat jayega.)

   Callers: DB-trigger (notifications INSERT → notifications_push_hook
   → pg_net) secret-header ke saath; body me hook 'tokens' array bhi
   bhejta hai (migration 20261031_fcm_push_tokens.sql). Public
   direct-call FORBIDDEN (x-push-secret mismatch → 403).

   BODY: { uid } ya { uids: [max 20] } ya { tokens: [max 10] }
         + { title, body?, url? }
   PRUNING: FCM 404/UNREGISTERED (ya token-specific INVALID_ARGUMENT)
   → dead token user_push_tokens se delete (service_role).
   ================================================================ */
import { createClient } from "jsr:@supabase/supabase-js@2";

const ONE = "https://onesignal.com/api/v1/notifications";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/* ── Service account (Supabase secret FIREBASE_SERVICE_ACCOUNT_JSON) ── */
type ServiceAccount = { project_id: string; private_key: string; client_email: string; token_uri?: string };
let _saRaw = "";
let _sa: ServiceAccount | null = null;
function getServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "";
  if (!raw) return null;
  if (raw !== _saRaw) {
    try {
      const p = JSON.parse(raw);
      _sa = (p && p.project_id && p.private_key && p.client_email) ? p as ServiceAccount : null;
    } catch { _sa = null; }
    _saRaw = raw;
  }
  return _sa;
}

/* ── OAuth2: RS256 JWT (WebCrypto, koi npm dep nahi) → access token ── */
let _at: { v: string; exp: number } | null = null;

function b64urlBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----BEGIN [A-Z ]+-----/g, "").replace(/-----END [A-Z ]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_at && _at.exp - 300 > now) return _at.v;
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const enc = new TextEncoder();
  const head = b64urlBytes(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64urlBytes(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${head}.${claim}`));
  const jwt = `${head}.${claim}.${b64urlBytes(new Uint8Array(sig))}`;
  const r = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  if (!r.ok) throw new Error(`oauth ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  if (!j.access_token) throw new Error("oauth: access_token missing");
  _at = { v: j.access_token as string, exp: now + (typeof j.expires_in === "number" ? j.expires_in : 3600) };
  return _at.v;
}

/* ── Ek token par FCM HTTP v1 send (data-only, high priority) ── */
async function fcmSendOne(sa: ServiceAccount, token: string, data: Record<string, string>):
  Promise<{ status: number; reason: string; dead: boolean }> {
  try {
    const at = await fcmAccessToken(sa);
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${at}` },
      body: JSON.stringify({
        message: {
          token,
          data,
          android: { priority: "high", ttl: "86400s" },
          webpush: { headers: { Urgency: "high", TTL: "86400" } },
        },
      }),
    });
    const txt = await r.text();
    if (r.status === 200) return { status: 200, reason: "", dead: false };
    let reason = "";
    try {
      const j = JSON.parse(txt);
      reason = String(j?.error?.details?.[0]?.reason || j?.error?.status || "");
    } catch { /* raw text hi reason rahega */ }
    /* Dead token: 404 / UNREGISTERED / token-specific INVALID_ARGUMENT.
       ⚠️ blanket INVALID_ARGUMENT = kharab MESSAGE — usme tokens prune
       karna sab tokens uda deta, isliye 'token' zikr zaroori hai. */
    const dead = r.status === 404 || reason === "UNREGISTERED" ||
      (reason === "INVALID_ARGUMENT" && /token/i.test(txt));
    return { status: r.status, reason: reason || txt.slice(0, 120), dead };
  } catch (e) {
    return { status: -1, reason: (e as Error)?.message || "fetch fail", dead: false };
  }
}

function adminClient() {
  const supaUrl = Deno.env.get("SUPABASE_URL") || "";
  const srvKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supaUrl || !srvKey) return null;
  return createClient(supaUrl, srvKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const SECRET = Deno.env.get("PUSH_TRIGGER_SECRET") || Deno.env.get("ONESIGNAL_TRIGGER_SECRET");
  if (!SECRET) return json({ ok: false, error: "env missing" }, 500);
  const got = (req.headers.get("x-push-secret") || "").trim();
  if (got !== SECRET) return json({ ok: false, error: "not_authorized" }, 403);

  const body = await req.json().catch(() => null) as
    | { uid?: string; uids?: string[]; tokens?: string[]; title?: string; body?: string; url?: string }
    | null;

  const uids = (Array.isArray(body?.uids) && body!.uids!.length ? body!.uids!.slice(0, 20) : (body?.uid ? [body.uid] : []))
    .filter((u) => typeof u === "string" && u.length > 10);
  let tokens = (Array.isArray(body?.tokens) ? body!.tokens : [])
    .filter((t): t is string => typeof t === "string" && t.length >= 20 && t.length <= 4096)
    .slice(0, 10);
  if (!uids.length && !tokens.length) return json({ ok: false, error: "uid/uids/tokens required" }, 400);

  const title = typeof body?.title === "string" ? body.title.slice(0, 120) : "";
  if (!title) return json({ ok: false, error: "title required" }, 400);
  const text = typeof body?.body === "string" ? body.body.slice(0, 300) : "";
  const urlOk = (body?.url && /^https?:\/\//.test(body.url)) ? body.url.slice(0, 500) : "";

  /* Data-only payload — values SAB strings (FCM data rule). */
  const data: Record<string, string> = {
    title,
    body: text || title,
    url: urlOk,
    type: "app",
    ts: String(Date.now()),
  };

  const sa = getServiceAccount();

  /* uids-only call (cron/admin path, hook ne tokens nahi bheje):
     tokens DB se khud nikaal lo. */
  if (sa && !tokens.length && uids.length) {
    const admin = adminClient();
    if (admin) {
      try {
        const since = new Date(Date.now() - 45 * 86400 * 1000).toISOString();
        const { data: rows, error } = await admin.from("user_push_tokens")
          .select("token").in("user_id", uids).gt("updated_at", since).limit(50);
        if (!error && rows) {
          tokens = rows.map((r) => r.token as string)
            .filter((t) => typeof t === "string" && t.length >= 20).slice(0, 20);
        }
      } catch (e) {
        console.error("push-send token-fetch fail:", (e as Error)?.message);
      }
    }
  }

  /* ── PRIMARY: FCM HTTP v1 ── */
  if (sa && tokens.length) {
    let sent = 0;
    const dead: string[] = [];
    const fails: { tok: string; status: number; reason: string }[] = [];
    for (const t of tokens.slice(0, 20)) {
      const res = await fcmSendOne(sa, t, data);
      if (res.status === 200) sent++;
      else if (res.dead) dead.push(t);
      else fails.push({ tok: t.slice(-6), status: res.status, reason: String(res.reason).slice(0, 120) });
    }
    let pruned = 0;
    if (dead.length) {
      const admin = adminClient();
      if (admin) {
        try {
          const { error } = await admin.from("user_push_tokens").delete().in("token", dead);
          if (!error) pruned = dead.length;
        } catch { /* pruning best-effort */ }
      }
    }
    console.log(`push-send FCM: sent=${sent}/${tokens.length} dead=${dead.length} fails=${fails.length}`);
    return json({ ok: sent > 0, via: "fcm", sent, pruned, failed: fails });
  }

  /* ── FALLBACK (transition): OneSignal — sirf bina-FCM-token users ke liye
     (purane APK). FCM secret ya tokens maujood hue to upar se return ho
     chuka hai — double-send impossible. ── */
  const APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
  const REST = Deno.env.get("ONESIGNAL_REST_KEY");
  if (!uids.length || !APP_ID || !REST) {
    console.log(`push-send: no delivery path (fcm_secret=${sa ? "yes" : "no"} tokens=${tokens.length} uids=${uids.length} os_env=${APP_ID && REST ? "yes" : "no"})`);
    return json({
      ok: false, via: "none", sent: 0,
      error: "no delivery path — user ke FCM tokens nahi aur OneSignal fallback env missing",
    });
  }
  const payload: Record<string, unknown> = {
    app_id: APP_ID,
    include_aliases: { external_id: uids },
    target_channel: "push",
    headings: { en: title },
    contents: { en: text || title },
  };
  if (urlOk) payload.url = urlOk;
  try {
    const r = await fetch(ONE, {
      method: "POST",
      headers: { Authorization: `Basic ${REST}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => null);
    console.log(`push-send OneSignal fallback: status=${r.status} uids=${uids.length}`);
    return json({ ok: r.status === 200, via: "onesignal", status: r.status, onesignal: d });
  } catch (e) {
    return json({ ok: false, via: "onesignal", error: (e && (e as Error).message) || "upstream fail" }, 502);
  }
});
