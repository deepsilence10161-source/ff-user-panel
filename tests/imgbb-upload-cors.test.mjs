/* ================================================================
   tests/imgbb-upload-cors.test.mjs
   ----------------------------------------------------------------
   Regression guard for the 2026-09-15b "Failed to fetch" upload bug.

   WHY THIS TEST EXISTS
   The bug was invisible from the outside: the browser refused to send
   the upload POST at all, and fetch() rejected with a bare
   TypeError("Failed to fetch") — no status, no server message. The only
   way to know the request shape is wrong is to evaluate it against the
   browser's actual CORS rules, which is what this harness does: it
   implements the preflight allow-list check (header names in a
   cross-origin request must all be listed in the preflight response's
   Access-Control-Allow-Headers, minus the CORS-safelisted ones).

   It then loads the REAL core/imgbb.js and drives it through that
   harness — not a copy of its logic.

   Run:  node tests/imgbb-upload-cors.test.mjs
================================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* The two Access-Control-Allow-Headers lists that a Supabase Edge
   Function can plausibly answer a preflight with:
     A — the truncated standard list the gateway returns for deployed
         functions (supabase/supabase#41334 — custom headers in the
         function's own CORS object are dropped before user code runs)
     B — the function's minimal standard CORS set: authorization +
         apikey + content-type (legacy cached-client extras omitted).
   The upload has to work under BOTH, because we cannot control which
   one wins in production. */
const ALLOW_LISTS = {
  'gateway standard (truncated)': ['authorization', 'x-client-info', 'apikey', 'content-type'],
  'function-owned list': ['authorization', 'apikey', 'content-type'],
};

const SAFELISTED_CT = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
const isSafelistedValue = (v) => {
  const s = String(v).toLowerCase().trim();
  if (s.startsWith('text/plain')) return true; // params are ignored by the check
  return SAFELISTED_CT.includes(s);
};

/* ── The browser: decides whether a preflight even happens, and
      refuses to send the request if any requested header name isn't
      allowed back. This is the exact rule the production failure hit. ── */
function browserFetch({ allowHeaders, server, log }) {
  return async function fetchImpl(url, opts = {}) {
    const headers = opts.headers || {};
    const names = Object.keys(headers).map((h) => h.toLowerCase());
    const needsPreflight = names.some((n) => {
      if (n === 'content-type') return !isSafelistedValue(headers['Content-Type'] ?? headers['content-type']);
      return !['accept', 'accept-language', 'content-language'].includes(n);
    });

    if (needsPreflight) {
      const blocked = names.filter((n) => !allowHeaders.includes(n));
      log.preflights.push({ requested: names, blocked, sent: blocked.length === 0 });
      if (blocked.length) {
        log.blockedRequests.push({ url, blocked });
        throw new TypeError('Failed to fetch'); // what Chrome/WebView throws
      }
    } else {
      log.preflights.push({ requested: names, blocked: [], sent: 'no-preflight' });
    }

    const res = await server(opts, log);
    const acao = res.headers?.['Access-Control-Allow-Origin'];
    if (!acao) throw new TypeError('Failed to fetch'); // response not readable cross-origin
    return res;
  };
}

const jsonResponse = (status, body) => ({
  status,
  headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  text: async () => JSON.stringify(body),
});

const okBody = { success: true, data: { url: 'https://i.ibb.co/x/proof.jpg', display_url: 'u', thumb: { url: 't' } } };

/* ── Load the real core/imgbb.js into a sandbox with the mocked
      window/fetch, then call uploadToImgBB with a small base64 image. ── */
function loadClient({ fetchImpl, idToken = 'FAKE.FIREBASE.TOKEN', refreshToken }) {
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, Promise, JSON, Math, Date, String, Error, TypeError,
    AbortController, TextDecoder,
    Image: undefined, File: function File() {}, Blob: function Blob() {}, FileReader: undefined,
    document: { createElement: () => ({ getContext: () => ({}) }) },
    toast() {},
    fetch: fetchImpl,
  };
  sandbox.window = sandbox;
  sandbox.fbAuth = () => ({
    currentUser: {
      getIdToken: (force) => Promise.resolve(force && refreshToken ? refreshToken : idToken),
    },
  });
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'core/imgbb.js'), 'utf8'), sandbox, { filename: 'core/imgbb.js' });
  return sandbox;
}

function callUpload(client, b64 = 'A'.repeat(4000)) {
  return new Promise((resolve) => {
    client.uploadToImgBB('data:image/jpeg;base64,' + b64, 'test_img', (err, url) => resolve({ err, url }));
  });
}

/* ── tiny assertion helpers ── */
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};

console.log('\n1. The OLD request shape (custom X-Firebase-Token header) must be reproduced as broken');
for (const [label, allow] of Object.entries(ALLOW_LISTS)) {
  const log = { preflights: [], blockedRequests: [] };
  const client = loadClient({
    fetchImpl: browserFetch({
      allowHeaders: allow,
      server: async () => jsonResponse(200, okBody),
      log,
    }),
  });
  // emulate the pre-fix client: same call, but with the custom header added
  const origFetch = client.fetch;
  client.fetch = (url, opts = {}) => origFetch(url, {
    ...opts,
    headers: { ...opts.headers, 'X-Firebase-Token': 'FAKE.FIREBASE.TOKEN' },
  });
  const { err } = await callUpload(client);
  check(`[${label}] blocked with "Failed to fetch" (bug reproduced)`,
    err === 'Network error — internet check karke dobara try karo' || /Failed to fetch/.test(String(err)),
    'got: ' + err);
  check(`[${label}] POST was never sent`,
    log.preflights.some((p) => p.sent === false),
    JSON.stringify(log.preflights));
}

console.log('\n2. The SHIPPED client must succeed under both preflight allow-lists');
for (const [label, allow] of Object.entries(ALLOW_LISTS)) {
  const log = { preflights: [], blockedRequests: [] };
  let body = null;
  const client = loadClient({
    fetchImpl: browserFetch({
      allowHeaders: allow,
      server: async (opts) => { body = JSON.parse(opts.body); return jsonResponse(200, okBody); },
      log,
    }),
  });
  const { err, url } = await callUpload(client);
  check(`[${label}] upload succeeded`, !err && url === okBody.data.url, 'err=' + err);
  check(`[${label}] only Supabase standard headers sent`,
    log.preflights.every((p) => p.requested.every((h) => ['content-type', 'authorization', 'apikey'].includes(h))),
    JSON.stringify(log.preflights[0] || {}));
  check(`[${label}] project key sent in apikey (current gateway requirement)`,
    log.preflights.some((p) => p.requested.includes('apikey')),
    JSON.stringify(log.preflights[0] || {}));
  check(`[${label}] firebase token travelled in the body`,
    body && typeof body.fb_token === 'string' && body.fb_token.length > 10,
    JSON.stringify(body && Object.keys(body)));
}

console.log('\n3. If gateway headers are refused, the preflight-free stage-1 fallback must still land');
{
  const log = { preflights: [], blockedRequests: [] };
  let sawNoPreflightPost = false;
  let body = null;
  const client = loadClient({
    fetchImpl: browserFetch({
      allowHeaders: ['content-type'], // deliberately denies authorization
      server: async (opts) => { body = JSON.parse(opts.body); return jsonResponse(200, okBody); },
      log,
    }),
  });
  const origFetch = client.fetch;
  client.fetch = (url, opts = {}) => {
    if (!opts.headers || (!opts.headers['Authorization'] && !opts.headers.apikey)) sawNoPreflightPost = true;
    return origFetch(url, opts);
  };
  const { err, url } = await callUpload(client);
  check('fell back to a request with no Authorization header', sawNoPreflightPost);
  check('fallback upload succeeded', !err && url === okBody.data.url, 'err=' + err);
  check('fallback carried the token in the body', body && !!body.fb_token);
  check('fallback sent no preflight at all',
    log.preflights.some((p) => p.sent === 'no-preflight'));
}

console.log('\n4. Transient failures retry; expired-token 401 refreshes the token');
{
  const log = { preflights: [], blockedRequests: [] };
  let calls = 0;
  const client = loadClient({
    fetchImpl: browserFetch({
      allowHeaders: ALLOW_LISTS['gateway standard (truncated)'],
      server: async () => { calls++; return calls < 3 ? jsonResponse(503, { error: 'busy' }) : jsonResponse(200, okBody); },
      log,
    }),
  });
  const { err, url } = await callUpload(client);
  check(`retried through 503s and succeeded (attempts=${calls})`, !err && url === okBody.data.url, 'err=' + err);
}
{
  const log = { preflights: [], blockedRequests: [] };
  let calls = 0, refreshed = 0;
  const client = loadClient({
    idToken: 'STALE.FIREBASE.TOKEN',
    refreshToken: 'FRESH.FIREBASE.TOKEN',
    fetchImpl: browserFetch({
      allowHeaders: ALLOW_LISTS['gateway standard (truncated)'],
      server: async (opts) => {
        calls++;
        const body = JSON.parse(opts.body);
        if (body.fb_token === 'STALE.FIREBASE.TOKEN') return jsonResponse(401, { success: false, error: 'Login required — dobara login karo' });
        refreshed++;
        return jsonResponse(200, okBody);
      },
      log,
    }),
  });
  const { err, url } = await callUpload(client);
  check('refreshed the Firebase token after 401 and succeeded', !err && url === okBody.data.url, 'err=' + err);
  check('server saw the refreshed token on retry', refreshed === 1);
}

console.log('\n5. The server-side function must be a superset of the old allow-list (cached clients)');
{
  const fn = fs.readFileSync(path.join(ROOT, 'supabase/functions/imgbb-upload/index.ts'), 'utf8');
  const m = /"Access-Control-Allow-Headers":\s*"([^"]+)"/.exec(fn);
  const allowed = (m?.[1] || '').split(',').map((s) => s.trim().toLowerCase());
  for (const h of ['authorization', 'apikey', 'content-type', 'x-firebase-token']) {
    check(`function allows "${h}"`, allowed.includes(h), 'list: ' + m?.[1]);
  }
  check('function verifies the Firebase token itself (Google JWKS)', /securetoken@system\.gserviceaccount\.com/.test(fn));
  check('function no longer trusts the anon key as a user identity',
    /role && !claims\.sub/.test(fn));
  check('invalid expiration=0 is not sent to ImgBB', !/fd\.append\(["']expiration["'],\s*["']0["']\)/.test(fn));

  const config = fs.readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8');
  check('gateway verify_jwt is source-controlled OFF for this self-verifying function',
    /\[functions\.imgbb-upload\][\s\S]*?verify_jwt\s*=\s*false/.test(config));
}

console.log('\n6. Profile and banner helpers save the correct confirmed database fields');
{
  const log = { preflights: [], blockedRequests: [] };
  const client = loadClient({
    fetchImpl: browserFetch({
      allowHeaders: ALLOW_LISTS['gateway standard (truncated)'],
      server: async () => jsonResponse(200, okBody),
      log,
    }),
  });
  client.U = { uid: 'firebase-uid-123' };
  client.UD = { profileImage: 'old-avatar', bannerImage: 'old-banner' };
  const writes = [];
  client.DB = { users: { updateImage: async (field, url) => {
    writes.push({ field, url });
    return { ok: true, data: { id: client.U.uid, [field]: url } };
  } } };

  const avatar = await new Promise((resolve) => client.uploadProfileImage(
    'data:image/jpeg;base64,' + 'A'.repeat(4000), resolve,
  ));
  const banner = await new Promise((resolve) => client.uploadBannerImage(
    'data:image/jpeg;base64,' + 'B'.repeat(4000), resolve,
  ));
  check('avatar saves avatar_url', writes[0]?.field === 'avatar_url');
  check('banner saves banner_url (never avatar_url)', writes[1]?.field === 'banner_url');
  check('profile helper updates the field the UI renders',
    avatar === okBody.data.url && client.UD.profileImage === okBody.data.url);
  check('banner helper updates the field the UI renders',
    banner === okBody.data.url && client.UD.bannerImage === okBody.data.url);
}
{
  const wallet = fs.readFileSync(path.join(ROOT, 'screens/wallet.js'), 'utf8');
  check('wallet no longer overrides the canonical global compressor',
    !/function\s+compImg\s*\(/.test(wallet));
  check('wallet explicitly uses the canonical compressor', /window\.compImg\(/.test(wallet));
}

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
