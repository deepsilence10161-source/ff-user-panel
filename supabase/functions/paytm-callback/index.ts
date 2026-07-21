/* ================================================================
   paytm-callback — STANDALONE (no _shared import needed)
   Dashboard se directly paste karo — koi aur file upload karne
   ki zaroorat nahi hai.

   Paytm Dashboard mein dono jagah yeh URL set karna:
     1. Developer Settings → Webhook → Payment Status URL
     2. PAYTM_CALLBACK_URL secret mein (paytm-create-order isko use karta hai)
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
    isProd,
    baseUrl: isProd ? "https://securegw.paytm.in" : "https://securegw-stage.paytm.in",
  };
}
async function creditIfFirstTime(admin: any, orderId: string, note: string) {
  const { data: flipped, error: flipErr } = await admin
    .from("sd_requests").update({ status: "approved", review_note: note })
    .eq("id", orderId).eq("status", "pending")
    .select("id, user_id, sd_amount").maybeSingle();
  if (flipErr) throw flipErr;
  if (!flipped) return "already_done";
  const { error: rpcErr } = await admin.rpc("increment_balance",
    { p_uid: flipped.user_id, p_col: "sky_diamonds", p_amount: flipped.sd_amount });
  if (rpcErr) throw rpcErr;
  await admin.from("wallet_transactions").insert({
    user_id: flipped.user_id, currency: "sky_diamonds", txn_type: "credit",
    amount: flipped.sd_amount, reason: "sd_purchase", note,
  });
  await admin.from("notifications").insert({
    user_id: flipped.user_id, title: "Sky Diamonds Added! 💎",
    body: `${flipped.sd_amount} Sky Diamonds aapke wallet mein add ho gaye.`, type: "wallet",
  }).catch(() => {});
  return "credited";
}
async function markFailedIfPending(admin: any, orderId: string, note: string) {
  await admin.from("sd_requests").update({ status: "rejected", review_note: note })
    .eq("id", orderId).eq("status", "pending");
}
/* ═══════════════════════════════════════════════════════════════════ */

Deno.serve(async (req: Request) => {
  try {
    const orderId = await extractOrderId(req);
    if (!orderId) { console.warn("paytm-callback: orderId missing"); return html("Order reference missing"); }

    const cfg = getPaytmConfig();
    const statusBody = { mid: cfg.mid, orderId };
    const signature = await generateSignature(JSON.stringify(statusBody), cfg.merchantKey);
    const statusRes = await fetch(`${cfg.baseUrl}/v3/order/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: statusBody, head: { signature } }),
    });
    const statusData = await statusRes.json().catch(() => null);
    const resultStatus = statusData?.body?.resultInfo?.resultStatus;
    const txnId = statusData?.body?.txnId || "";
    console.log(`paytm-callback: order=${orderId} status=${resultStatus}`);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (resultStatus === "TXN_SUCCESS") {
      const outcome = await creditIfFirstTime(admin, orderId, `Paytm auto-credit — txnId ${txnId}`);
      console.log(`credit outcome=${outcome}`);
      return html("Payment successful! Sky Diamonds added.", true);
    }
    if (resultStatus === "TXN_FAILURE") {
      await markFailedIfPending(admin, orderId, `Paytm failure — txnId ${txnId}`);
      return html("Payment failed or was cancelled.", false);
    }
    return html("Payment is still processing...");
  } catch (e) {
    console.error("paytm-callback crash:", e);
    return html("Something went wrong, please check your wallet.");
  }
});

async function extractOrderId(req: Request): Promise<string | null> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      return j?.ORDERID || j?.orderId || j?.body?.orderId || j?.body?.ORDERID || null;
    }
    if (ct.includes("form")) {
      const f = await req.formData();
      return (f.get("ORDERID") || f.get("orderId")) as string | null;
    }
    const text = await req.text();
    try { const j = JSON.parse(text); return j?.ORDERID || j?.orderId || j?.body?.orderId || null; }
    catch { return new URLSearchParams(text).get("ORDERID") || new URLSearchParams(text).get("orderId"); }
  } catch (e) { console.error("extractOrderId failed:", e); return null; }
}

function html(msg: string, success?: boolean) {
  const icon = success === true ? "✅" : success === false ? "❌" : "⏳";
  return new Response(
    `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font-family:sans-serif;text-align:center;padding:40px 20px;background:#0f0f1a;color:#fff}
    .icon{font-size:48px}</style></head>
    <body><div class="icon">${icon}</div><p>${msg}</p>
    <p style="opacity:.6;font-size:13px">Aap is tab ko band kar sakte hain.</p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
