/* ================================================================
   supabase/functions/imgbb-upload/index.ts
   ----------------------------------------------------------------
   Client ab seedha api.imgbb.com ko apni key ke saath call NAHI
   karega — iske bajaye yeh function call karega, jo IMGBB_KEY ko
   server-side secret se padhta hai. Key ab kisi bhi client JS file
   mein nahi rahegi, isliye GitHub Pages pe public nahi dikhegi.

   Client (updated core/imgbb.js) yahan POST karega, Firebase ID
   token ke saath (Authorization: Bearer <token>) — taki sirf
   logged-in app users hi upload kar sakein, koi bhi random internet
   request nahi (yehi paytm-create-order wala hi auth pattern hai):
     { image: "<base64 without data: prefix>", name: "optional_name" }

   Response same shape jo pehle ImgBB seedha deta tha (jis se
   existing .then(d => d.data.url) wala code bina tod-phod ke chalta
   rahe — sirf URL badla hai, response shape nahi):
     { success: true, data: { url, display_url, thumb: { url } } }

   Secret set karna (deploy se pehle, ek hi baar):
     supabase secrets set IMGBB_KEY=YOUR_IMGBB_KEY_HERE
================================================================ */
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const IMGBB_URL = "https://api.imgbb.com/1/upload";
const MAX_B64_CHARS = 32 * 1024 * 1024 * 1.4; // ~32MB image → base64 ~1.37x bada

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "POST use karo" }, 405);

  try {
    /* ── Sirf logged-in users upload kar sakein ── */
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ success: false, error: "Login required" }, 401);

    const supabaseAsUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: userData, error: userErr } = await supabaseAsUser.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ success: false, error: "Invalid session, dobara login karo" }, 401);
    }

    const IMGBB_KEY = Deno.env.get("IMGBB_KEY");
    if (!IMGBB_KEY) {
      return json({ success: false, error: "IMGBB_KEY secret set nahi hai" }, 500);
    }

    const { image, name } = await req.json().catch(() => ({}));
    if (!image || typeof image !== "string") {
      return json({ success: false, error: "image (base64 string) required hai" }, 400);
    }
    if (image.length > MAX_B64_CHARS) {
      return json({ success: false, error: "Image bahut badi hai (max ~32MB)" }, 400);
    }

    const b64 = image.includes(",") ? image.split(",")[1] : image;
    const fd = new FormData();
    fd.append("key", IMGBB_KEY);
    fd.append("image", b64);
    fd.append("expiration", "0");
    if (name) fd.append("name", String(name).slice(0, 100));

    const r = await fetch(IMGBB_URL, { method: "POST", body: fd });
    const data = await r.json().catch(() => null);

    if (!data?.success) {
      console.error("ImgBB upload failed:", JSON.stringify(data));
      return json(
        { success: false, error: data?.error?.message || "ImgBB upload fail ho gaya" },
        502,
      );
    }

    return json(data); // same shape as direct ImgBB response — client code untouched
  } catch (e) {
    console.error("imgbb-upload crash:", e);
    return json({ success: false, error: "Server error" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
