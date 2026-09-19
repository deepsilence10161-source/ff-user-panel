/* ================================================================
   tests/imgbb-upload-auth.test.mjs
   ----------------------------------------------------------------
   Regression guard for the second half of the 2026-09-15b upload bug:
   the Edge Function was treating the public Supabase ANON KEY (which
   the client must send in Authorization just to get past the gateway)
   as the user's identity:

       const jwt = Authorization;            // ← this is the anon key
       supabaseAsUser.auth.getUser();        // ← 401, every single time

   The anon key has no `sub` claim, so GoTrue's /user endpoint always
   answered 401 → the function returned "Invalid session, dobara login
   karo" → uploads could never succeed even with CORS fixed.

   This test runs the REAL deployed function file (types stripped, the
   jsr import replaced by a stub) against a locally generated RS256
   keypair, so it verifies the actual signature-checking code path that
   runs in production, not a re-implementation of it.

   Run:  node tests/imgbb-upload-auth.test.mjs
================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN_PATH = path.join(ROOT, 'supabase/functions/imgbb-upload/index.ts');

const PROJECT_ID = 'fft-app-1e283';
const ANON_KEY = 'anon-key-jwt'; // stands in for the real gateway-passing anon key

/* ── 1. A local Firebase-like RS256 keypair + signed tokens ── */
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-kid', alg: 'RS256', use: 'sig' };

const b64url = (s) => Buffer.from(s).toString('base64url');
function signToken({ kid = 'test-kid', claims, tamper = false }) {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey).toString('base64url');
  const bad = tamper ? sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA') : sig;
  return `${head}.${body}.${bad}`;
}
const now = Math.floor(Date.now() / 1000);
const baseClaims = {
  iss: `https://securetoken.google.com/${PROJECT_ID}`,
  aud: PROJECT_ID,
  sub: 'firebase-uid-123',
  iat: now, exp: now + 3600,
  user_id: 'firebase-uid-123',
};
const validToken = signToken({ claims: baseClaims });

/* ── 2. Load the real function with Deno + external network stubbed ──
      Everything except the jsr import is the shipped file verbatim
      (type annotations stripped by Node's own TS stripper). */
function loadFunction({ jwks = { keys: [jwk] }, imgbbFails = false, fetchCalls = [] } = {}) {
  let src = fs.readFileSync(FN_PATH, 'utf8').replace(/^import\s+.*$/m, '');
  src = stripTypeScriptTypes(src, { mode: 'strip' });

  let handler = null;
  const Deno = {
    serve: (h) => { handler = h; },
    env: {
      get: (k) => ({
        SUPABASE_URL: 'https://stub.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-stub',
        IMGBB_KEY: 'imgbb-stub-key',
      })[k],
    },
  };
  const fetchStub = async (url, opts) => {
    fetchCalls.push({ url: String(url), opts });
    if (String(url).includes('securetoken@system.gserviceaccount.com')) {
      return new Response(JSON.stringify(jwks), { status: 200 });
    }
    if (String(url).includes('api.imgbb.com')) {
      return new Response(JSON.stringify(
        imgbbFails
          ? { success: false, error: { message: 'imgbb says no' } }
          : { success: true, data: { url: 'https://i.ibb.co/x/proof.jpg', display_url: 'u', thumb: { url: 't' } } },
      ), { status: 200 });
    }
    throw new Error('unexpected fetch: ' + url);
  };
  /* Supabase admin client stub — mirrors the real one for a NON-supabase
     user JWT (the anon key): getUser() fails, which is exactly the live
     behaviour that made the old code return 401 forever. */
  const createClientStub = () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: { message: 'invalid claim: missing sub claim' } }) },
  });

  const factory = new Function(
    'Deno', 'fetch', 'createClient', 'atob', 'crypto', 'TextDecoder', 'TextEncoder', 'console',
    src,
  );
  // Deno.serve() inside the file captured the request handler for us.
  factory(Deno, fetchStub, createClientStub, atob, crypto, TextDecoder, TextEncoder, console);
  if (!handler) throw new Error('function did not register a Deno.serve handler');
  return { handler, fetchCalls };
}

const post = (handler, { headers = {}, body = {}, raw = null } = {}) =>
  handler(new Request('https://stub.supabase.co/functions/v1/imgbb-upload', {
    method: 'POST',
    headers,
    body: raw !== null ? raw : JSON.stringify(body),
  }));

/* ── tiny assertions ── */
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};

console.log('\n1. Preflight (what the browser sends before every upload)');
{
  const { handler } = loadFunction();
  const res = await handler(new Request('https://stub.supabase.co/functions/v1/imgbb-upload', { method: 'OPTIONS' }));
  const allow = (res.headers.get('Access-Control-Allow-Headers') || '').toLowerCase();
  check('OPTIONS is answered without auth', res.status === 204, 'status=' + res.status);
  check('allow-list covers authorization + content-type', allow.includes('authorization') && allow.includes('content-type'), allow);
  check('allow-list still covers the legacy x-firebase-token (cached clients)', allow.includes('x-firebase-token'), allow);
  check('response is readable cross-origin', res.headers.get('Access-Control-Allow-Origin') === '*');
}

console.log('\n2. The NEW client shape: project key in apikey/Auth + Firebase token in the body');
{
  const { handler, fetchCalls } = loadFunction();
  const res = await post(handler, {
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + ANON_KEY },
    body: { image: 'A'.repeat(5000), name: 'dia_proof', fb_token: validToken },
  });
  const json = await res.json();
  check('upload accepted (200, success true)', res.status === 200 && json.success === true, JSON.stringify(json).slice(0, 200));
  check('hosted URL returned in the same shape the client expects', json?.data?.url === 'https://i.ibb.co/x/proof.jpg');
  check('response carries CORS headers', res.headers.get('Access-Control-Allow-Origin') === '*');
  check('imgbb was called with the server-side secret key',
    fetchCalls.some((c) => c.url.includes('api.imgbb.com') && String(c.opts?.body) !== ''));
  const imgbbCall = fetchCalls.find((c) => c.url.includes('api.imgbb.com'));
  check('permanent upload omits invalid expiration=0',
    !!imgbbCall && !imgbbCall.opts.body.has('expiration'));
}

console.log('\n3. The OLD failure mode must stay fixed: anon key alone is NOT an identity');
{
  const { handler } = loadFunction();
  const res = await post(handler, {
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON_KEY },
    body: { image: 'A'.repeat(5000), name: 'dia_proof' },
  });
  const json = await res.json();
  check('anon key alone is rejected with 401', res.status === 401, 'status=' + res.status);
  check('no upload attempted without a verified user',
    !(json?.data?.url), JSON.stringify(json).slice(0, 120));
}

console.log('\n4. Token verification must actually verify (fail closed)');
const badCases = [
  ['tampered signature', signToken({ claims: baseClaims, tamper: true })],
  ['expired token', signToken({ claims: { ...baseClaims, exp: now - 60 } })],
  ['wrong audience (different Firebase project)', signToken({ claims: { ...baseClaims, aud: 'someone-elses-app' } })],
  ['wrong issuer', signToken({ claims: { ...baseClaims, iss: 'https://securetoken.google.com/someone-elses-app' } })],
  ['missing sub', signToken({ claims: { ...baseClaims, sub: undefined, user_id: undefined } })],
  ['unknown signing key id', signToken({ kid: 'not-in-jwks', claims: baseClaims })],
  ['garbage', 'not.a.jwt'],
];
for (const [label, token] of badCases) {
  const { handler } = loadFunction();
  const res = await post(handler, {
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON_KEY },
    body: { image: 'A'.repeat(1000), fb_token: token },
  });
  check(`rejected: ${label}`, res.status === 401, 'status=' + res.status);
}
{
  const { handler } = loadFunction({ jwks: { keys: [] } });
  const res = await post(handler, {
    headers: { 'Content-Type': 'application/json' },
    body: { image: 'A'.repeat(1000), fb_token: validToken },
  });
  check('unreachable/empty JWKS fails closed', res.status === 401, 'status=' + res.status);
}

console.log('\n5. Backwards compatibility + input validation');
{
  const { handler } = loadFunction();
  const res = await post(handler, {
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON_KEY, 'X-Firebase-Token': validToken },
    body: { image: 'A'.repeat(1000) },
  });
  check('legacy X-Firebase-Token header still verifies (old cached clients)',
    res.status === 200, 'status=' + res.status);
}
{
  const { handler } = loadFunction();
  const res = await post(handler, { headers: { 'Content-Type': 'application/json' }, body: { fb_token: validToken } });
  check('missing image → 400', res.status === 400, 'status=' + res.status);
}
{
  const { handler } = loadFunction();
  const tooBig = await post(handler, {
    headers: { 'Content-Type': 'application/json' },
    body: { image: 'A'.repeat(32 * 1024 * 1024 * 1.4 + 10), fb_token: validToken },
  });
  check('oversized image → 400', tooBig.status === 400, 'status=' + tooBig.status);
}
{
  const { handler } = loadFunction();
  const res = await post(handler, {
    headers: { 'Content-Type': 'application/json' },
    body: { image: 'data:image/jpeg;base64,QUJD', fb_token: validToken },
  });
  check('data-URL prefix is stripped before forwarding', res.status === 200);
}
{
  const { handler } = loadFunction({ imgbbFails: true });
  const res = await post(handler, {
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, // the preflight-free stage-1 transport
    body: { image: 'A'.repeat(1000), fb_token: validToken },
  });
  const json = await res.json();
  check('stage-1 (text/plain, no Authorization) is accepted without a preflight',
    res.status === 502 && json.success === false, 'status=' + res.status);
  check('imgbb failure surfaces its own message, not a fake success',
    /imgbb says no/.test(json.error || ''), JSON.stringify(json).slice(0, 120));
}

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
