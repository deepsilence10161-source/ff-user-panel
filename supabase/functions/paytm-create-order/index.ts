/* ================================================================
   paytm-create-order — v3 (2026-09-20j ROUND-7 FIX)
   ----------------------------------------------------------------
   ★ FIX (Round-7 live-audit): PayTM deposits were 100% DEAD.
     Old flow sent the Firebase ID token as `Authorization: Bearer`
     → Supabase Edge gateway (verify_jwt) rejects third-party
     asymmetric JWTs with 401 UNAUTHORIZED_ASYMMETRIC_JWT before
     the function ever runs. Proven live on 2026-09-20.
     Even past the gateway, auth.getUser() (GoTrue) can never
     validate a Firebase token (this project has ZERO native
     Supabase auth users — auth.users count = 0).

   NEW AUTH (same battle-tested pattern as imgbb-upload v2):
     • Gateway verify_jwt disabled for this function
       (see supabase/config.toml + dashboard setting).
     • Function does its own fail-closed identity check:
       body fb_token → legacy X-Firebase-Token header →
       Authorization bearer (any real user JWT). Keys with
       `role` but no `sub` (public anon key) are skipped.
     • Firebase RS256 signature verified against Google's
       public JWKS + iss/aud/exp/sub checks. No crypto trust
       in anything the client says.

   Everything else (amount caps, sd_request creation, PayTM
   initiateTransaction, checksum) is unchanged.
================================================================ */
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ══════════════ PAYTM CHECKSUM (inlined from _shared) ══════════════ */
const _SALT_CHARS = "9876543210ZYXWVUTSRQPONMLKJIHGFEDCBAabcdefghijklmnopqrstuvwxyz!@#$&_";
const _IV = "@@@@&&&&####$$$$";
function _toB(s: string) { return new TextEncoder().encode(s); }
function _randSalt(n: number) {
  const out: string[] = [], r = crypto.getRandomValues(new Uint8Array(n));
  for (let i = 0; i < n; i++) out.push(_SALT_CHARS[r[i] % _SALT_CHARS.length]);
  return out.join("");
}
async function _sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", _toB(s) as BufferSource);
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join("");
}
async function _aesKey(k: string) {
  const raw = _toB(k), k16 = new Uint8Array(16);
  k16.set(raw.slice(0,16));
  return crypto.subtle.importKey("raw", k16, {name:"AES-CBC"}, false, ["encrypt","decrypt"]);
}
async function _enc(plain: string, mk: string) {
  const key = await _aesKey(mk), iv = _toB(_IV) as BufferSource;
  const c = await crypto.subtle.encrypt({name:"AES-CBC",iv}, key, _toB(plain) as BufferSource);
  return btoa(String.fromCharCode(...new Uint8Array(c)));
}
async function generateSignature(paramsString: string, merchantKey: string) {
  const salt = _randSalt(4);
  const hash = await _sha256(paramsString + "|" + salt);
  return _enc(hash + salt, merchantKey);
}
function getPaytmConfig() {
  const env = (Deno.env.get("PAYTM_ENV") || "staging").toLowerCase();
  const isProd = env === "production";
  return {
    mid: Deno.env.get("PAYTM_MID") ?? "",
    merchantKey: Deno.env.get("PAYTM_MERCHANT_KEY") ?? "",
    website: Deno.env.get("PAYTM_WEBSITE") || (isProd ? "DEFAULT" : "WEBSTAGING"),
    callbackUrl: Deno.env.get("PAYTM_CALLBACK_URL") ?? "",
    isProd,
    baseUrl: isProd ? "https://securegw.paytm.in" : "https://securegw-stage.paytm.in",
  };
}
/* ═══════════════════════════════════════════════════════════════════ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MIN_INR = 10, MAX_INR = 50000;
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "fft-app-1e283";
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

type Identity = { uid: string; provider: "firebase" | "supabase" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method !== "POST") return json({ error: "POST use karo" }, 405);

    /* Body parse FIRST — fb_token ab body me aata hai (CORS-safe). */
    const body = await req.json().catch(() => ({})) as
      { amount?: unknown; fb_token?: unknown } | null;
    const amount = Number(body?.amount);

    /* ── Identity: fail-closed, crypto-verified (imgbb-upload pattern) ── */
    const identity = await identifyUser(req, body);
    if (!identity) return json({ error: "Login required — dobara login karo" }, 401);
    const uid = identity.uid;

    if (!amount || isNaN(amount) || amount < MIN_INR || amount > MAX_INR)
      return json({ error: `Amount ₹${MIN_INR} se ₹${MAX_INR} ke beech hona chahiye` }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row, error: insErr } = await admin
      .from("sd_requests")
      .insert({ user_id: uid, sd_amount: amount, amount_inr: amount, request_type: "paytm_auto", status: "pending" })
      .select("id").single();
    if (insErr || !row) { console.error("insert failed:", insErr); return json({ error: "Order create nahi ho saka" }, 500); }
    const orderId = row.id as string;

    const cfg = getPaytmConfig();
    if (!cfg.mid || !cfg.merchantKey) {
      await admin.from("sd_requests").delete().eq("id", orderId);
      return json({ error: "Paytm secrets missing (PAYTM_MID / PAYTM_MERCHANT_KEY)" }, 500);
    }

    const txnBody = {
      requestType: "Payment", mid: cfg.mid, websiteName: cfg.website, orderId,
      txnAmount: { value: amount.toFixed(2), currency: "INR" },
      userInfo: { custId: uid }, callbackUrl: cfg.callbackUrl,
      enablePaymentMode: [{ mode: "UPI" }],
    };
    const signature = await generateSignature(JSON.stringify(txnBody), cfg.merchantKey);
    const paytmRes = await fetch(
      `${cfg.baseUrl}/theia/api/v1/initiateTransaction?mid=${cfg.mid}&orderId=${orderId}`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: txnBody, head: { signature } }) }
    );
    const paytmData = await paytmRes.json().catch(() => null);
    const txnToken = paytmData?.body?.txnToken;
    if (!txnToken) {
      console.error("Paytm failed:", JSON.stringify(paytmData));
      await admin.from("sd_requests").update({ status: "rejected", review_note: "Paytm token failed" }).eq("id", orderId);
      return json({ error: paytmData?.body?.resultInfo?.resultMsg || "Paytm se connect nahi ho paya" }, 502);
    }
    return json({ orderId, txnToken, amount, mid: cfg.mid, website: cfg.website, isProd: cfg.isProd });
  } catch (e) {
    console.error("crash:", e);
    return json({ error: "Server error, dobara try karo" }, 500);
  }
});

/* ══════════════ IDENTITY (inlined from imgbb-upload v2) ══════════════
   Order: body fb_token → legacy X-Firebase-Token header → Authorization
   bearer. Public anon/service keys (role bina sub) skip hoti hain. */
async function identifyUser(
  req: Request,
  body: { fb_token?: unknown } | null,
): Promise<Identity | null> {
  const fromBody = typeof body?.fb_token === "string" && body.fb_token.length > 20 ? [body.fb_token as string] : [];
  const legacyHeader = (req.headers.get("X-Firebase-Token") || "").trim();
  const authHeader = bearer(req.headers.get("Authorization"));

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const t of [...fromBody, legacyHeader, authHeader]) {
    if (typeof t === "string" && t.length > 20 && !seen.has(t)) { seen.add(t); candidates.push(t); }
  }

  for (const token of candidates) {
    const claims = peekClaims(token);
    /* Public anon/service key ko identity MAT maano — usme sub nahi hota. */
    if (claims && claims.role && !claims.sub) continue;
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
  } catch { return null; }
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
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
