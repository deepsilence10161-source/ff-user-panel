/* ================================================================
   PAYTM SHARED MODULE — supabase/functions/_shared/paytm.ts
   ----------------------------------------------------------------
   Yeh file teen cheezein deti hai:
     1. Checksum generate/verify  (Paytm ka official AES-128-CBC +
        SHA-256 algorithm — verified against paytm/Paytm_PHP_Checksum
        aur paytm/Paytm_Node_Checksum ke source code se, June 2026)
     2. Paytm config (env vars se — KABHI bhi hardcode mat karna)
     3. Sky Diamonds idempotent credit (taki webhook + callback dono
        fire hone par bhi DOUBLE credit kabhi na ho)

   SECRETS (Supabase Dashboard → Edge Functions → Secrets mein set
   karne hain — yeh file khud kuch hardcode nahi karti):
     PAYTM_MID            → Paytm dashboard se milega
     PAYTM_MERCHANT_KEY   → Paytm dashboard se milega (SECRET — kabhi
                             client/GitHub mein mat dalna)
     PAYTM_WEBSITE        → "WEBSTAGING" (test) ya "DEFAULT"/your live
                             website name (production — dashboard mein
                             check karo exact value)
     PAYTM_ENV            → "staging" ya "production"
     PAYTM_CALLBACK_URL   → is project ka paytm-callback function URL
                             (deploy ke baad milta hai)
   Yeh sab `supabase secrets set KEY=value` se set karna — README dekho.
================================================================ */

const SALT_CHARS =
  "9876543210ZYXWVUTSRQPONMLKJIHGFEDCBAabcdefghijklmnopqrstuvwxyz!@#$&_";
const IV_STRING = "@@@@&&&&####$$$$"; // Paytm ka fixed IV — sabke liye same, secret nahi hai

function toBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function randomSalt(len: number): string {
  const out: string[] = [];
  const rnd = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out.push(SALT_CHARS[rnd[i] % SALT_CHARS.length]);
  return out.join("");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", toBytes(input) as BufferSource);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function aesKey(merchantKey: string): Promise<CryptoKey> {
  // Paytm merchant keys 16-byte (AES-128) hote hain. Safety ke liye
  // pad/truncate kiya hai, par real key 16 bytes hi hogi normally.
  const raw = toBytes(merchantKey);
  const key16 = new Uint8Array(16);
  key16.set(raw.slice(0, 16));
  return crypto.subtle.importKey("raw", key16, { name: "AES-CBC" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function aesEncryptB64(plain: string, merchantKey: string): Promise<string> {
  const key = await aesKey(merchantKey);
  const iv = toBytes(IV_STRING) as BufferSource;
  const cipher = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, toBytes(plain) as BufferSource);
  return btoa(String.fromCharCode(...new Uint8Array(cipher)));
}

async function aesDecryptB64(b64: string, merchantKey: string): Promise<string> {
  const key = await aesKey(merchantKey);
  const iv = toBytes(IV_STRING) as BufferSource;
  const cipherBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) as BufferSource;
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}

/** JSON-body APIs (Initiate Transaction, Transaction Status) ke liye —
 *  JSON.stringify(body) seedha pass karo, yeh khud salt+hash+encrypt karega. */
export async function generateSignature(
  paramsString: string,
  merchantKey: string,
): Promise<string> {
  const salt = randomSalt(4);
  const hash = await sha256Hex(paramsString + "|" + salt);
  return aesEncryptB64(hash + salt, merchantKey);
}

/** Flat key-value params (jaise callback/webhook se aate hain) verify karne ke liye. */
export async function verifySignature(
  params: Record<string, unknown>,
  merchantKey: string,
  checksum: string,
): Promise<boolean> {
  try {
    const clean = { ...params };
    delete (clean as Record<string, unknown>).CHECKSUMHASH;
    delete (clean as Record<string, unknown>).checksumhash;
    const joined = Object.keys(clean)
      .sort()
      .map((k) => {
        const v = clean[k];
        return v == null || String(v).toLowerCase() === "null" ? "" : String(v);
      })
      .join("|");
    const decrypted = await aesDecryptB64(checksum, merchantKey);
    const salt = decrypted.slice(-4);
    const expected = (await sha256Hex(joined + "|" + salt)) + salt;
    return decrypted === expected;
  } catch (_e) {
    return false; // malformed checksum → treat as unverified, not a crash
  }
}

/* ── Config (env vars only — koi default secret value yahan nahi) ── */
export function getPaytmConfig() {
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

/* ── Idempotent Sky Diamond credit ──
   sd_requests row ko PENDING → APPROVED sirf ek hi baar flip karta hai
   (atomic conditional update). Agar webhook + callback dono fire ho jayein
   isi order ke liye, dusri call ko rowCount=0 milega → double-credit nahi hoga. */
export async function creditIfFirstTime(
  supabaseAdmin: any,
  orderId: string,
  note: string,
): Promise<"credited" | "already_done" | "not_found"> {
  const { data: flipped, error: flipErr } = await supabaseAdmin
    .from("sd_requests")
    .update({ status: "approved", review_note: note })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("id, user_id, sd_amount")
    .maybeSingle();

  if (flipErr) throw flipErr;
  if (!flipped) return "already_done"; // ya to already approved/rejected, ya exist nahi karta

  const { error: rpcErr } = await supabaseAdmin.rpc("increment_balance", {
    p_uid: flipped.user_id,
    p_col: "sky_diamonds",
    p_amount: flipped.sd_amount,
  });
  if (rpcErr) throw rpcErr;

  await supabaseAdmin.from("wallet_transactions").insert({
    user_id: flipped.user_id,
    currency: "sky_diamonds",
    txn_type: "credit",
    amount: flipped.sd_amount,
    reason: "sd_purchase",
    note,
  });

  await supabaseAdmin.from("notifications").insert({
    user_id: flipped.user_id,
    title: "Sky Diamonds Added! 💎",
    body: `${flipped.sd_amount} Sky Diamonds aapke wallet mein add ho gaye.`,
    type: "wallet",
  }).catch(() => {}); // notification fail ho to bhi credit revert nahi karna

  return "credited";
}

export async function markFailedIfPending(
  supabaseAdmin: any,
  orderId: string,
  note: string,
): Promise<void> {
  await supabaseAdmin
    .from("sd_requests")
    .update({ status: "rejected", review_note: note })
    .eq("id", orderId)
    .eq("status", "pending");
}
