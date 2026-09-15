/* ================================================================
   supabase/functions/imgbb-upload/index.ts   —  v2 (2026-09-15b)
   ----------------------------------------------------------------
   KYA KARTA HAI: client ImgBB ko seedha call nahi karta (key public
   ho jaati). Yeh function IMGBB_KEY ko server-side secret se padhta
   hai, ImgBB ko upload karta hai, aur wahi response shape wapas
   deta hai jo pehle seedha ImgBB deta tha — isliye client ka
   `d.data.url` wala code bina badle chalta rahega.

   Client ise aise call karta hai (core/imgbb.js v33):
     POST /functions/v1/imgbb-upload
     headers: Authorization: Bearer <supabase anon key>
              Content-Type: application/json
     body:    { image: "<base64>", name: "optional", fb_token: "<firebase id token>" }

   ══════════════════════════════════════════════════════════════════
   v2 FIX #1 — "Failed to fetch" on every upload (client-side CORS)
   ══════════════════════════════════════════════════════════════════
   Purana client Firebase token ko ek CUSTOM header
   (`X-Firebase-Token`) mein bhejta tha. Custom header ka matlab hai
   CORS preflight (OPTIONS), aur browser POST bhejne se pehle check
   karta hai ki preflight ka Access-Control-Allow-Headers us header ko
   allow karta hai ya nahi.

   Supabase Edge Functions ka OPTIONS gateway se aata hai aur wo sirf
   yeh fixed list allow karta hai:
       authorization, x-client-info, apikey, content-type
   `x-firebase-token` usme kabhi nahi tha — isliye preflight fail, POST
   kabhi gaya hi nahi, aur client ko sirf TypeError("Failed to fetch")
   mila (koi status, koi message, kuch nahi). Fix do taraf se hua:
   • client ab koi custom header bhejta hi nahi, token BODY mein aata
     hai (core/imgbb.js v33),
   • aur neeche CORS allow-list ko bhi superset bana diya hai, taki
     purana (cached) client bhi na toote.

   ══════════════════════════════════════════════════════════════════
   v2 FIX #2 — "Invalid session, dobara login karo" on every upload
   ══════════════════════════════════════════════════════════════════
   Purana code gateway se aage nikalne wali cheez (anon key) ko hi
   user ki identity maan raha tha:
       const jwt = Authorization;              // ← yeh anon key hai
       supabaseAsUser.auth.getUser();          // ← 401 always
   Anon key ek valid Supabase JWT hai par usme `sub` claim hi nahi
   hota (payload: {iss, ref, role:"anon", iat, exp} — verify kiya
   gaya), aur GoTrue ke /user endpoint ko `sub` chahiye. Isliye ye
   line HAR baar fail hoti thi → "Invalid session, dobara login karo".
   Yaani CORS fix karne ke baad bhi upload kaam nahi karta.

   Ab pehle asli user token dhoonda jaata hai (body ka `fb_token`,
   purane clients ke liye `X-Firebase-Token` header) aur usse verify
   kiya jaata hai — Firebase ID token ko Google ke public JWKS se
   RS256 signature verify karke + aud/iss/exp check karke. Kisi bhi
   tarah ka bharosa client ke dene wale naam pe nahi, sirf
   cryptographically verified uid pe.

   Secret set karna (deploy se pehle, ek hi baar):
     supabase secrets set IMGBB_KEY=YOUR_IMGBB_KEY_HERE
   Optional (default already sahi hai):
     supabase secrets set FIREBASE_PROJECT_ID=fft-app-1e283
================================================================ */
import { createClient } from "jsr:@supabase/supabase-js@2";

/* Gateway ke standard allow-list ka superset. Jaan-boojh kar zyada
   headers allowed hain: purane cached clients (jo X-Firebase-Token
   bhejte the) ke preflight ko todne ke bajaye yahan se pass hone dete
   hain — wahi token hum neeche verify karte hain, isliye security pe
   koi asar nahi. Naya client in mein se koi extra header bhejta hi
   nahi. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const IMGBB_URL = "https://api.imgbb.com/1/upload";
const MAX_B64_CHARS = 32 * 1024 * 1024 * 1.4; // ~32MB image → base64 ~1.37x bada
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "fft-app-1e283";
/* Google ka public JWKS (wahi keys jo Firebase ID tokens sign karti
   hain). Koi secret nahi chahiye, rotate bhi khud handle ho jaata hai:
   unknown kid aane pe cache refresh ho jaata hai. */
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

type Identity = { uid: string; provider: "firebase" | "supabase" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "POST use karo" }, 405);

  try {
    /* Body pehle parse karo — Firebase token ab yahin aata hai. */
    const body = await req.json().catch(() => null) as
      | { image?: unknown; name?: unknown; fb_token?: unknown; token?: unknown; supabase_jwt?: unknown }
      | null;

    const image = body?.image;
    if (typeof image !== "string" || !image) {
      return json({ success: false, error: "image (base64 string) required hai" }, 400);
    }
    if (image.length > MAX_B64_CHARS) {
      return json({ success: false, error: "Image bahut badi hai (max ~32MB)" }, 400);
    }

    /* ── Sirf verified logged-in users hi upload kar sakein ── */
    const identity = await identifyUser(req, body);
    if (!identity) {
      return json({ success: false, error: "Login required — dobara login karo" }, 401);
    }

    const IMGBB_KEY = Deno.env.get("IMGBB_KEY");
    if (!IMGBB_KEY) {
      return json({ success: false, error: "IMGBB_KEY secret set nahi hai" }, 500);
    }

    const b64 = image.includes(",") ? image.split(",")[1] : image;
    const name = typeof body?.name === "string" ? body.name : "";
    const fd = new FormData();
    fd.append("key", IMGBB_KEY);
    fd.append("image", b64);
    fd.append("expiration", "0");
    if (name) fd.append("name", name.slice(0, 100));

    const r = await fetch(IMGBB_URL, { method: "POST", body: fd });
    const data = await r.json().catch(() => null);

    if (!data?.success) {
      console.error("imgbb-upload: ImgBB rejected:", JSON.stringify(data));
      return json(
        { success: false, error: data?.error?.message || "ImgBB upload fail ho gaya" },
        502,
      );
    }

    console.log(`imgbb-upload: ok uid=${identity.uid} via=${identity.provider} chars=${b64.length} name=${name}`);
    return json(data); // same shape as direct ImgBB response — client code untouched
  } catch (e) {
    console.error("imgbb-upload crash:", e);
    return json({ success: false, error: "Server error" }, 500);
  }
});

/* ════════════════════════════════════════════════════════════════
   IDENTITY — asli user token dhoondo aur verify karo
   Order: body ka fb_token (naya client) → legacy X-Firebase-Token
   header (purana cached client) → Authorization (agar woh anon key
   nahi, balki koi asli user JWT hai).
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
    /* Public anon/service key ko identity MAT maano — woh sirf gateway
       pass karne ke liye hoti hai, usme `sub` (user id) nahi hota. */
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

/* ── Supabase-issued JWT (agar client ne asli Supabase session bheja ho) ── */
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

/* ── Firebase ID token: signature Google ke public keys se, plus
      standard claim checks (iss/aud/exp/sub). ── */
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
  _jwksExpiry = now + 6 * 60 * 60 * 1000; // 6h — keys rarely rotate
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
