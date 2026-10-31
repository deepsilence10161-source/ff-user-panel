#!/usr/bin/env node
/* ================================================================
   tools/supabase-secrets.mjs — Supabase Management API secrets ops
   (directive 16, 2026-10-31: OneSignal retirement + secret hygiene)
   ----------------------------------------------------------------
   Usage: node tools/supabase-secrets.mjs <action>
     list                 → secret NAMES + digests (values kabhi print
                            nahi hotin — API bhi masked deta hai)
     bridge-push-secret   → DB push_hook_config.hook_secret (id=1) ko
                            Management-API SQL se padh kar Supabase
                            secret PUSH_TRIGGER_SECRET set karta hai.
                            Value sirf in-memory rehti hai — na log,
                            na artifact. Iske baad push-send v4 ka
                            legacy ONESIGNAL_TRIGGER_SECRET env-fallback
                            hata dena safe hai (zero-downtime bridge).
     delete-onesignal     → ONESIGNAL_APP_ID / ONESIGNAL_REST_KEY /
                            ONESIGNAL_TRIGGER_SECRET delete (Supabase
                            side). GH-side secrets alag API se hataye
                            jate hain.
   Requires: env SUPABASE_ACCESS_TOKEN. Project: hddhkculuyrfoevxmlwy.
   ================================================================ */

const REF = "hddhkculuyrfoevxmlwy";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN missing");
  process.exit(1);
}
const API = `https://api.supabase.com/v1/projects/${REF}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function sql(query) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(`${API}/database/query`, {
        method: "POST", headers: H, body: JSON.stringify({ query }),
      });
      if (r.status >= 500) { await r.text(); await new Promise(s => setTimeout(s, 2000 + a * 3000)); continue; }
      if (!r.ok) throw new Error(`SQL HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return await r.json();
    } catch (e) {
      if (a === 3) throw e;
      await new Promise(s => setTimeout(s, 2000 + a * 3000));
    }
  }
  throw new Error("SQL retries exhausted");
}

const action = process.argv[2] || "list";

if (action === "list") {
  const r = await fetch(`${API}/secrets`, { headers: H });
  if (!r.ok) { console.error(`list HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  const d = await r.json();
  const rows = Array.isArray(d) ? d : [];
  console.log("secret names:", JSON.stringify(rows.map(s => ({ name: s.name, digest: s.digest }))));

} else if (action === "bridge-push-secret") {
  const rows = await sql("SELECT hook_secret FROM push_hook_config WHERE id = 1 AND enabled");
  const val = rows?.[0]?.hook_secret;
  if (!val || String(val).length < 8) { console.error("hook_secret nahi mila (ya chhota hai)"); process.exit(1); }
  const r = await fetch(`${API}/secrets`, {
    method: "POST", headers: H, body: JSON.stringify([{ name: "PUSH_TRIGGER_SECRET", value: String(val) }]),
  });
  const okTxt = r.ok ? "OK" : (await r.text()).slice(0, 200);
  console.log(`PUSH_TRIGGER_SECRET set → HTTP ${r.status} ${okTxt} (value length=${String(val).length}, printed nahi)`);
  if (!r.ok) process.exit(1);

} else if (action === "delete-onesignal") {
  const names = ["ONESIGNAL_APP_ID", "ONESIGNAL_REST_KEY", "ONESIGNAL_TRIGGER_SECRET"];
  const r = await fetch(`${API}/secrets`, {
    method: "DELETE", headers: H, body: JSON.stringify({ names }),
  });
  const okTxt = r.ok ? "OK" : (await r.text()).slice(0, 200);
  console.log(`delete ${names.join(", ")} → HTTP ${r.status} ${okTxt}`);
  if (!r.ok) process.exit(1);

} else {
  console.error(`unknown action: ${action} (list | bridge-push-secret | delete-onesignal)`);
  process.exit(1);
}
