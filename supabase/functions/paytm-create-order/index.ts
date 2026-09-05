/* ================================================================
   paytm-create-order — STANDALONE (no _shared import needed)
   Dashboard se directly paste karo — koi aur file upload karne
   ki zaroorat nahi hai.
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
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MIN_INR = 10, MAX_INR = 50000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method !== "POST") return json({ error: "POST use karo" }, 405);

    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Login required" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabaseAsUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await supabaseAsUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session, dobara login karo" }, 401);
    const uid = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount);
    if (!amount || isNaN(amount) || amount < MIN_INR || amount > MAX_INR)
      return json({ error: `Amount ₹${MIN_INR} se ₹${MAX_INR} ke beech hona chahiye` }, 400);

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

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
