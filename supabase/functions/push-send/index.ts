/* ================================================================
   supabase/functions/push-send/index.ts  (R20, 2026-09-21)
   OneSignal push bhejne ka EK-MATRA server path. Ab tak project me
   sirf client-subscribe tha — send-path kahin nahi tha.
   Callers: DB-trigger (notifications INSERT → pg_net) secret-header ke
   saath. Public direct-call FORBIDDEN (x-push-secret mismatch → 403).
   BODY: { uid } ya { uids: [max 20] } + { title, body?, url? }
   ================================================================ */
const ONE = "https://onesignal.com/api/v1/notifications";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  const SECRET = Deno.env.get("ONESIGNAL_TRIGGER_SECRET");
  const APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
  const REST = Deno.env.get("ONESIGNAL_REST_KEY");
  if (!SECRET || !APP_ID || !REST) return json({ ok: false, error: "env missing" }, 500);
  const got = (req.headers.get("x-push-secret") || "").trim();
  if (got !== SECRET) return json({ ok: false, error: "not_authorized" }, 403);
  const body = await req.json().catch(() => null) as { uid?: string; uids?: string[]; title?: string; body?: string; url?: string } | null;
  const uids = (Array.isArray(body?.uids) && body!.uids!.length ? body!.uids!.slice(0, 20) : (body?.uid ? [body.uid] : []))
    .filter((u) => typeof u === "string" && u.length > 10);
  if (!uids.length) return json({ ok: false, error: "uid/uids required" }, 400);
  const title = typeof body?.title === "string" ? body.title.slice(0, 120) : "";
  if (!title) return json({ ok: false, error: "title required" }, 400);
  const text = typeof body?.body === "string" ? body.body.slice(0, 300) : "";
  const payload: Record<string, unknown> = {
    app_id: APP_ID,
    include_aliases: { external_id: uids },
    target_channel: "push",
    headings: { en: title },
    contents: { en: text || title },
  };
  if (body?.url && /^https?:\/\//.test(body.url)) payload.url = body.url;
  try {
    const r = await fetch(ONE, { method: "POST", headers: { "Authorization": `Basic ${REST}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => null);
    return json({ ok: r.status === 200, status: r.status, onesignal: data });
  } catch (e) {
    return json({ ok: false, error: (e && (e as Error).message) || "upstream fail" }, 502);
  }
});
