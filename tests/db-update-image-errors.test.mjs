/* ================================================================
   tests/db-update-image-errors.test.mjs
   ----------------------------------------------------------------
   Regression guard for the 2026-09-16c fix:

     "Photo save failed — dobara try karo" even though the ImgBB upload
     SUCCEEDED and the banner (banner_url) — which travels the exact same
     code path — saved fine.

   Photo aur banner sirf ek hi method se guzarte hain:
   DB.users.updateImage('avatar_url' | 'banner_url', url). Avatar-only
   failure ka matlab Postgres ne avatar_url wali UPDATE roki (trigger
   exception / trigger rewrite / CHECK / column change). Purana code woh
   asli reason khaa jaata tha. Yeh test real core/db.js ko ek mock
   PostgREST ke saath chala ke verify karta hai ki:

     1. Postgres error ka message + pg code caller tak pahunchta hai
        (taaki toast pe ek screenshot se culprit dikhe — e.g. FK
        violation "profile_requests_user_id_fkey" [23503]).
     2. "Row update hui par stored value alag hai" (BEFORE UPDATE trigger
        ne avatar_url rewrite kar diya) RLS zero-row se ALAG identify hota
        hai ('db_trigger_rewrote_value' vs 'update_not_applied_rls') aur
        forensic detail console pe jaata hai.
     3. Success path bilkul pehle jaisa hai ({ ok:true, data }).
     4. Field whitelist + https URL guard pehle jaisa hi strict hai.

   Note: core/db.js browser me likha gaya hai — bare `DB.config.poll()`
   jaise references `window.DB` se resolve hote hain. Isliye file ek vm
   context me chalti hai jiska global khud `window` hai (exactly jaisa
   browser me hota hai), na ki Function-parameter se.

   Run:  node tests/db-update-image-errors.test.mjs
================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = path.join(ROOT, 'core/db.js');
const CODE = fs.readFileSync(DB_PATH, 'utf8');

/* ── Chainable PostgREST mock ──────────────────────────────────────
   Koi bhi builder method chain hi return karta hai; single()/maybeSingle()
   canned result dete hain; chain khud thenable bhi hai (taaki koi bhi
   `await window._supa.from(...)....` path throw na kare). */
function makeSupa(result) {
  const noop = { data: null, error: null };
  const chain = {
    then(res, rej) { return Promise.resolve(noop).then(res, rej); },
    single()       { return Promise.resolve(result); },
    maybeSingle()  { return Promise.resolve(result); },
  };
  ['update', 'insert', 'upsert', 'delete', 'select', 'eq', 'neq', 'in',
   'or', 'order', 'limit', 'gte', 'lte', 'lt', 'gt', 'like', 'ilike',
   'is', 'not', 'contains', 'range', 'match', 'filter', 'csv', 'rpc']
    .forEach(m => { chain[m] = () => chain; });
  return {
    from() { return chain; },
    rpc() { return Promise.resolve(noop); },
    auth: {},
    channel() { return { on() { return this; }, subscribe() { return this; }, unsubscribe() {} }; },
    removeChannel() {},
  };
}

/* Real core/db.js ko browser-jaise context me load karo: context ka
   global hi window hai, console.error/warn capture hote hain (forensic
   output ka test), baaki logs chhupi rehti hain. */
function loadDB(result, errs) {
  const fakeConsole = new Proxy(console, {
    get(t, p) {
      if (p === 'error' || p === 'warn') return (...a) => errs.push(a.map(String).join(' '));
      if (p === 'log') return () => {};
      return t[p];
    },
  });
  const supa = makeSupa(result);
  const sandbox = {
    console: fakeConsole,
    U: { uid: 'firebase-uid-xyz' },
    /* window.CFG jaan-bujh kar set NAHI — varna load-time config fetch
       chal padega (browser me bhi CFG baad me aata hai, DB.config.load
       guard se skip hota hai). */
    supabase: { createClient() { return supa; } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    AbortController, fetch: async () => { throw new Error('offline-mock'); },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox, { filename: 'core/db.js' });
  return sandbox.DB;
}

const URL_OK = 'https://i.ibb.co/AbCdEf/profile_x_123.jpg';
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); }
  catch (e) { failures++; console.error(`  ❌ ${name}\n     ${e.message}`); }
}

console.log('DB.users.updateImage — avatar-only failure visibility (2026-09-16c)\n');

await check('success: row returned with exact URL → { ok:true }', async () => {
  const DB = loadDB({ data: { id: 'firebase-uid-xyz', avatar_url: URL_OK }, error: null }, []);
  const res = await DB.users.updateImage('avatar_url', URL_OK);
  assert.equal(res.ok, true);
  assert.equal(res.data.avatar_url, URL_OK);
});

await check('Postgres error: FK violation message + [23503] caller tak pahunchta hai', async () => {
  const errs = [];
  const DB = loadDB({
    data: null,
    error: {
      message: 'insert or update on table "profile_requests" violates foreign key constraint "profile_requests_user_id_fkey"',
      code: '23503',
      details: 'Key is not present in table "users".',
    },
  }, errs);
  const res = await DB.users.updateImage('avatar_url', URL_OK);
  assert.equal(res.ok, false);
  assert.match(res.error, /profile_requests/);
  assert.match(res.error, /foreign key/);
  assert.match(res.error, /\[23503\]/, 'pg error code must travel with the message');
  assert.ok(errs.some(l => /\[DB:users\.updateImage\]/.test(l)), 'full error must also hit console');
});

await check('PostgREST schema-cache miss (column gayab): poora message + [42703] dikhta hai', async () => {
  const errs = [];
  const DB = loadDB({
    data: null,
    error: { message: "column users.avatar_url does not exist", code: '42703' },
  }, errs);
  const res = await DB.users.updateImage('avatar_url', URL_OK);
  assert.equal(res.ok, false);
  assert.match(res.error, /avatar_url does not exist/);
  assert.match(res.error, /\[42703\]/);
});

await check('trigger rewrite: stored ≠ sent → db_trigger_rewrote_value + forensic console line', async () => {
  const errs = [];
  const DB = loadDB({ data: { id: 'firebase-uid-xyz', avatar_url: 'https://cdn.internal/placeholder.png' }, error: null }, errs);
  const res = await DB.users.updateImage('avatar_url', URL_OK);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'db_trigger_rewrote_value');
  assert.ok(errs.some(l => /trigger ne avatar_url rewrite/.test(l) && /stored:/.test(l)),
    'console must show the actually-stored value for forensics');
  assert.ok(errs.some(l => /placeholder\.png/.test(l)), 'stored value must be visible in console output');
});

await check('zero rows (RLS denial): update_not_applied_rls — rewrite se alag label', async () => {
  const errs = [];
  const DB = loadDB({ data: null, error: null }, errs);
  const res = await DB.users.updateImage('avatar_url', URL_OK);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'update_not_applied_rls');
});

await check('banner_url same-URL round-trip clean pass (banner regression guard)', async () => {
  const DB = loadDB({ data: { id: 'firebase-uid-xyz', banner_url: URL_OK }, error: null }, []);
  const res = await DB.users.updateImage('banner_url', URL_OK);
  assert.equal(res.ok, true);
});

await check('guards: invalid field / non-https url / empty url unchanged', async () => {
  const DB = loadDB({ data: null, error: null }, []);
  /* vm-context objects ke prototype alag realm ke hote hain — fields
     alag-alag compare karo (deepEqual cross-realm objects ko false
     deta hai). */
  for (const [field, url, want] of [
    ['coins', URL_OK, 'invalid_image_field'],
    ['avatar_url', 'http://evil.example/x.jpg', 'invalid_image_url'],
    ['avatar_url', '', 'invalid_image_url'],
  ]) {
    const res = await DB.users.updateImage(field, url);
    assert.equal(res.ok, false);
    assert.equal(res.error, want);
  }
});

console.log(failures === 0 ? '\nALL CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
