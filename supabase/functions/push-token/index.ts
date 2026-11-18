/* ================================================================
   supabase/functions/push-token/index.ts  (FCM migration, 2026-10-31)
   ────────────────────────────────────────────────────────────────
   Client FCM tokens ka registration/deletion — user_push_tokens
   table ka EK-MATRA write path. Table RLS-LOCKED hai (koi anon/
   authenticated policy nahi): writes sirf yahan se, service_role
   client se, aur identity Firebase ID token (RS256 + Google JWKS)
   se CRYPTOGRAPHICALLY VERIFY hokar — wahi pattern jo imgbb-upload
   me saalon se proven hai.

   Deploy: --no-verify-jwt (gateway pass-through; asli gate yahan
   function-level auth hai — bina verified token 401 "Login required").

   BODY: { action: 'set' | 'delete', platform: 'android' | 'web',
           token: string }
   AUTH: Authorization: Bearer <firebase-idToken>  (ya body.fb_token /
         X-Firebase-Token header — imgbb wala legacy order)
   ================================================================ */
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "fft-app-1e283";
/* Google ka public JWKS (wahi keys jo Firebase ID tokens sign karti
   hain). Koi secret nahi chahiye; unknown kid par cache refresh. */
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

type Identity = { uid: string; provider: "firebase" | "supabase" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST use karo" }, 405);

  try {
    const body = await req.json().catch(() => null) as
      | { action?: unknown; platform?: unknown; token?: unknown; fb_token?: unknown; supabase_jwt?: unknown }
      | null;

    /* ── Sirf verified logged-in users apna token register kar sakte hain ── */
    const identity = await identifyUser(req, body);
    if (!identity) {
      return json({ ok: false, error: "Login required — dobara login karo" }, 401);
    }

    const action = body?.action === "delete" ? "delete" : "set";
    const platform = typeof body?.platform === "string" ? body.platform : "";
    if (platform !== "android" && platform !== "web") {
      return json({ ok: false, error: "platform 'android' ya 'web' hona chahiye" }, 400);
    }
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    const supaUrl = Deno.env.get("SUPABASE_URL") || "";
    const srvKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supaUrl || !srvKey) return json({ ok: false, error: "server config missing" }, 500);
    const admin = createClient(supaUrl, srvKey, { auth: { persistSession: false, autoRefreshToken: false } });

    if (action === "set") {
      if (token.length < 20 || token.length > 4096) {
        return json({ ok: false, error: "token invalid length" }, 400);
      }
      /* upsert on token-conflict: device dusre user par login kare to
         row naya user_id le leti hai (token device-unique hai). */
      const { error } = await admin.from("user_push_tokens").upsert(
        { user_id: identity.uid, platform, token },
        { onConflict: "token" },
      );
      if (error) {
        console.error("push-token upsert fail:", error.message);
        return json({ ok: false, error: "upsert fail" }, 500);
      }
      console.log(`push-token: set uid=${identity.uid} platform=${platform} via=${identity.provider} tok=...${token.slice(-6)}`);
      return json({ ok: true, action, platform });
    }

    /* delete — logout: SIRF is device ka token (token khali = uid+platform ke saare) */
    let q = admin.from("user_push_tokens").delete().eq("user_id", identity.uid).eq("platform", platform);
    if (token) q = q.eq("token", token);
    const { error } = await q;
    if (error) {
      console.error("push-token delete fail:", error.message);
      return json({ ok: false, error: "delete fail" }, 500);
    }
    console.log(`push-token: delete uid=${identity.uid} platform=${platform} via=${identity.provider}`);
    return json({ ok: true, action, platform });
  } catch (e) {
    console.error("push-token crash:", e);
    return json({ ok: false, error: "Server error" }, 500);
  }
});

/* ════════════════════════════════════════════════════════════════
   IDENTITY — imgbb-upload ka PROVEN pattern (as-is copy)
   Order: body fb_token/token/supabase_jwt → legacy X-Firebase-Token
   header → Authorization bearer. Public anon/service keys (role claim
   bina sub ke) identity NAHI maani jaati.
   ════════════════════════════════════════════════════════════════ */
async function identifyUser(
  req: Request,
  body: { fb_token?: unknown; token?: unknown; supabase_jwt?: unknown } | null,
): Promise<Identity | null> {
  const fromBody = [body?.fb_token, body?.token, body?.supabase_jwt]
    .filter((t): t is string => typeof t === "string" && t.length > 20);
  const legacyHeader = (req.headers.get("X-Firebase-Token") || "").trim();
  const authHeader = bearer(req.headers.get("Authorization"));

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const t of [...fromBody, legacyHeader, authHeader]) {
    if (typeof t === "string" && t.length > 20 && !seen.has(t)) { seen.add(t); candidates.push(t); }
  }

  for (const token of candidates) {
    const claims = peekClaims(token);
    if (claims && claims.role && !claims.sub) continue;

    if (claims && typeof claims.iss === "string" && claims.iss.startsWith("https://securetoken.google.com/")) {
      const id = await verifyFirebaseIdToken(token);
      if (id) return id;
      continue;
    }
    const supa = await verifySupabaseJwt(token);
    if (supa) return supa;
    const fb = await verifyFirebaseIdToken(token);
    if (fb) return fb;
  }
  return null;
}

function bearer(h: string | null): string {
  return (h || "").replace(/^Bearer\s+/i, "").trim();
}

function peekClaims(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return null;
  }
}

async function verifySupabaseJwt(token: string): Promise<Identity | null> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    return { uid: data.user.id, provider: "supabase" };
  } catch {
    return null;
  }
}

let _jwks: Record<string, JsonWebKey> | null = null;
let _jwksExpiry = 0;

async function _getFirebaseKeys(forceRefresh = false): Promise<Record<string, JsonWebKey>> {
  const now = Date.now();
  if (!forceRefresh && _jwks && now < _jwksExpiry) return _jwks;
  const r = await fetch(FIREBASE_JWKS_URL);
  const j = await r.json();
  const map: Record<string, JsonWebKey> = {};
  for (const k of (j?.keys ?? [])) if (k?.kid) map[k.kid] = k as JsonWebKey;
  if (!Object.keys(map).length) throw new Error("Empty Firebase JWKS");
  _jwks = map;
  _jwksExpiry = now + 6 * 60 * 60 * 1000;
  return _jwks;
}

async function verifyFirebaseIdToken(token: string): Promise<Identity | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    if (header?.alg !== "RS256" || !header?.kid) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload?.exp !== "number" || payload.exp < now) return null;
    if (payload?.aud !== FIREBASE_PROJECT_ID) return null;
    if (payload?.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    if (!payload?.sub || typeof payload.sub !== "string") return null;

    let keys = await _getFirebaseKeys();
    let jwk = keys[header.kid];
    if (!jwk) { keys = await _getFirebaseKeys(true); jwk = keys[header.kid]; }
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!ok) return null;

    return { uid: payload.sub, provider: "firebase" };
  } catch (e) {
    console.error("verifyFirebaseIdToken failed:", e);
    return null;
  }
}

function b64urlToBytes(s: string): Uint8Array {
  let b = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
