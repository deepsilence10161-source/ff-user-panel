/* ================================================================
   IMGBB UPLOAD — core/imgbb.js  v33-CORS-FIX
   ----------------------------------------------------------------
   HISTORY (keep this — every past fix here was real, and the next
   person needs to know which transport shape was already tried):
   • v32     uploadBannerImage was saving to avatar_url instead of
             banner_url — fixed to use the correct Supabase column.
   • v32.6   IMGBB_KEY hataya yahan se — ab Supabase Edge Function
             (imgbb-upload) use karta hai jo key ko server-side
             secret se padhta hai. Key ab public nahi hai.
   • 2026-09 bare firebase.auth() calls → "app-compat/no-app" throw,
             every upload died. Fixed via window.fbAuth().
   • 2026-09-15b (THIS FILE, v33) "Failed to fetch" on EVERY image
             upload — root cause + fix documented at _send() below.

   ── v33 ROOT CAUSE ("Failed to fetch" / "Screenshot upload failed") ──
   The request sent a CUSTOM header — X-Firebase-Token — alongside
   Content-Type + Authorization. A header that isn't on the browser's
   "simple" list forces a CORS *preflight* (OPTIONS), and the browser
   then refuses to send the POST unless the preflight's
   Access-Control-Allow-Headers explicitly allows every single one of
   those header names.

   Supabase Edge Functions answer that OPTIONS for you and only allow
   this fixed list — authorization, x-client-info, apikey,
   content-type (see supabase/supabase#41334: custom headers in the
   function's own CORS object are dropped at the gateway). "x-firebase-
   token" was never in it, so the preflight failed and the POST was
   never sent: fetch() rejected with TypeError("Failed to fetch") with
   ZERO information about why — which is exactly the red toast seen on
   profile photo, banner, and Sky Diamond screenshot uploads.

   ── THE FIX (two rules, do not break them) ──
   1. Only ever send header names the gateway's fixed allow-list
      contains: Authorization + Content-Type. Nothing custom, ever.
   2. The Firebase token therefore travels in the REQUEST BODY
      (`fb_token`), not in a header. The Edge Function reads it from
      there and verifies it server-side against Google's public keys.
      The token is no less secure in the body — it's the same HTTPS
      request — it just can't break the preflight.

   Plus, since a bare "Failed to fetch" is useless to debug:
   • transient failures (network blip / 5xx / timeout) retry with
     backoff, and if the normal path is still blocked we retry once as
     a 100% preflight-free request (no Authorization header at all).
   • every failure is mapped to an actionable message.
   • oversized images are quietly re-compressed before upload (a raw
     3-5 MB phone screenshot is also a real reason uploads drop on
     mobile data — see the size note at SHRINK_ABOVE).
================================================================ */
(function() {
  'use strict';

  var SUPA_URL       = window._SUPA_URL || 'https://hddhkculuyrfoevxmlwy.supabase.co';
  var IMGBB_PROXY_URL = SUPA_URL + '/functions/v1/imgbb-upload';

  /* BUG FIX (2026-07): SUPA_KEY here matches the fallback already used in
     core/db.js — this is the public "anon" key, safe to ship client-side.
     It is only used to get past the Edge Function gateway; it is NOT used
     as the user's identity any more (see fb_token in the body). */
  var SUPA_ANON_KEY = window._SUPA_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGhrY3VsdXlyZm9ldnhtbHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTQ1MTgsImV4cCI6MjA5NDAzMDUxOH0.2hhDGez1fVFjS5ljSU3tSOEJuusLmQpERjcrh45T7po';

  /* Upload tuning */
  var TIMEOUT_MS         = 60000; /* per attempt */
  var RETRIES_PER_STAGE  = 2;     /* 3 attempts total per transport stage */
  var SHRINK_ABOVE       = 1500000; /* base64 chars (~1.1 MB binary) —
     ABOVE THIS the image is re-compressed before upload. Not cosmetic:
     a screenshot straight off a modern phone camera/PNG capture is
     3-6 MB raw, which becomes a ~8 MB JSON body. On weak mobile data
     that alone makes uploads fail or time out ("Failed to fetch" on a
     dropped connection), and it burns the user's data. 1600px / q0.82
     keeps payment proofs fully readable at a fraction of the size. */

  /* ================================================================
     AUTH — Firebase ID token, resolved from the real app
     (see core/firebase.js: the app is named "mainApp", so bare
     firebase.auth() throws app-compat/no-app — ALWAYS use fbAuth()).
  ================================================================ */
  function _getAuthToken(cb) {
    try {
      var _a = window.fbAuth ? window.fbAuth() : null;
      if (!_a) { cb(null); return; }
      var cur = _a.currentUser;
      if (cur) {
        cur.getIdToken().then(cb).catch(function() { cb(null); });
        return;
      }
      /* Not ready yet — wait briefly for auth state to restore.
         (BUG FIX 2026-08: "Login required to upload" even when the user
         IS logged in — currentUser is momentarily null right after page
         load / tab switch, before Firebase finishes restoring the
         session from IndexedDB. The old code gave up instantly.) */
      var settled = false;
      var unsub = _a.onAuthStateChanged(function(user) {
        if (settled) return;
        settled = true;
        try { unsub(); } catch (e) {}
        if (user) { user.getIdToken().then(cb).catch(function() { cb(null); }); }
        else { cb(null); }
      });
      setTimeout(function() {
        if (settled) return;
        settled = true;
        try { unsub(); } catch (e) {}
        cb(null);
      }, 4000);
    } catch (e) { cb(null); }
  }

  /* Force-refresh the ID token (used when the server says 401 — an
     expired token would otherwise fail forever with the same answer). */
  function _refreshToken(cb) {
    try {
      var _a = window.fbAuth ? window.fbAuth() : null;
      var cur = _a && _a.currentUser;
      if (!cur) { cb(null); return; }
      cur.getIdToken(true).then(function(t) { cb(t || null); }, function() { cb(null); });
    } catch (e) { cb(null); }
  }

  function _loginMsg() {
    var _a = null;
    try { _a = window.fbAuth ? window.fbAuth() : null; } catch (e) {}
    return (_a && _a.currentUser)
      ? 'Could not verify login — please try again'
      : 'Login required to upload';
  }

  /* ================================================================
     PUBLIC API (signatures unchanged — every caller keeps working)
  ================================================================ */
  /* Guarded on purpose: `input instanceof File` throws a TypeError (and
     took the whole upload path down with it) if File/Blob isn't defined
     in the current WebView — the string/base64 path below works fine on
     its own and shouldn't be collateral damage. */
  function _isFileLike(x) {
    if (!x || typeof x === 'string') return false;
    try {
      if (typeof File !== 'undefined' && x instanceof File) return true;
      if (typeof Blob !== 'undefined' && x instanceof Blob) return true;
    } catch (e) {}
    return typeof x.size === 'number' && typeof x.type === 'string';
  }

  window.uploadToImgBB = function(input, name, callback) {
    if (typeof input === 'string') {
      _doUpload(_stripPrefix(input), name, callback, _mimeOf(input));
    } else if (_isFileLike(input)) {
      var reader = new FileReader();
      reader.onload  = function(e) {
        var d = String((e && e.target && e.target.result) || '');
        _doUpload(_stripPrefix(d), name, callback, _mimeOf(d));
      };
      reader.onerror = function()  { callback('File read error', null); };
      reader.readAsDataURL(input);
    } else {
      callback('Invalid input', null);
    }
  };

  function _stripPrefix(s) {
    if (typeof s !== 'string') return s;
    var i = s.indexOf('base64,');
    return (i > -1 && s.substring(0, i).indexOf('data:') === 0) ? s.substring(i + 7) : s;
  }
  function _mimeOf(s) {
    if (typeof s !== 'string') return 'image/jpeg';
    var m = /^data:([^;,]+)[;,]/.exec(s);
    return (m && m[1]) || 'image/jpeg';
  }

  function _doUpload(b64, name, callback, mime) {
    if (typeof b64 !== 'string' || !b64) { callback('Invalid input', null); return; }
    _maybeShrink(b64, mime, function(small) {
      _getAuthToken(function(token) {
        if (!token) { callback(_loginMsg(), null); return; }
        _attempt(small, name, token, 0, 0, '', callback);
      });
    });
  }

  /* ── Oversized payload guard (see SHRINK_ABOVE) ── */
  function _maybeShrink(b64, mime, cb) {
    if (typeof b64 !== 'string' || b64.length <= SHRINK_ABOVE || typeof Image !== 'function') {
      cb(b64); return;
    }
    try {
      var img = new Image();
      img.onload = function() {
        try {
          var maxDim = 1600, w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
            else       { w = Math.round(w * maxDim / h); h = maxDim; }
          }
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          var out = String(c.toDataURL('image/jpeg', 0.82).split(',')[1] || '');
          cb(out && out.length < b64.length ? out : b64);
        } catch (e) { cb(b64); }
      };
      img.onerror = function() { cb(b64); };
      img.src = 'data:' + (mime || 'image/jpeg') + ';base64,' + b64;
    } catch (e) { cb(b64); }
  }

  /* ================================================================
     TRANSPORT
     stage 0 — Authorization + Content-Type only. Exactly the header
               set Supabase's own JS client uses, so it is guaranteed to
               pass the gateway's preflight allow-list.
     stage 1 — no Authorization header at all, Content-Type text/plain
               (both CORS-"simple"), token in the body. Sends no
               preflight whatsoever, so no allow-list mismatch can block
               it. Only used if stage 0 exhausted its retries.
  ================================================================ */
  function _attempt(b64, name, token, stage, attempt, lastMsg, callback) {
    _send(b64, name, token, stage, function(err, status, data, raw) {
      /* ── Success ── */
      if (!err && status >= 200 && status < 300 && data && data.success && data.data && data.data.url) {
        callback(null, data.data.url, data.data.display_url, data.data.thumb && data.data.thumb.url);
        return;
      }
      if (!err && status >= 200 && status < 300) {
        /* 2xx but no usable URL — server answered, retrying won't help */
        callback(_serverMsg(data, raw) || 'Upload failed', null);
        return;
      }

      var authFail = !err && (status === 401 || status === 403);

      /* ── 401/403: refresh the Firebase token once, then retry ──
         (An expired ID token is the single most common cause of a
         hard 401 here; refreshing usually makes it succeed.) */
      if (authFail && stage === 0 && attempt === 0) {
        _refreshToken(function(fresh) {
          if (fresh) _attempt(b64, name, fresh, 0, 1, '', callback);
          else callback(_serverMsg(data, raw) || _loginMsg(), null);
        });
        return;
      }
      if (authFail) {
        callback(_serverMsg(data, raw) || _loginMsg(), null);
        return;
      }

      /* ── Hard 4xx (bad image, too big, wrong payload): permanent ── */
      if (!err && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        callback(_serverMsg(data, raw) || ('Upload failed (HTTP ' + status + ')'), null);
        return;
      }

      /* ── Transient: network error / timeout / 5xx / 408 / 429 ── */
      var msg = err ? _friendly(err) : (_serverMsg(data, raw) || ('Server busy (HTTP ' + status + ')'));
      if (attempt < RETRIES_PER_STAGE) {
        setTimeout(function() { _attempt(b64, name, token, stage, attempt + 1, msg, callback); },
                   900 * (attempt + 1));
        return;
      }
      /* Stage 0 exhausted → try the preflight-free transport once more. */
      if (stage === 0) { _attempt(b64, name, token, 1, 0, msg, callback); return; }
      callback(msg || lastMsg || 'Upload failed', null);
    });
  }

  function _send(b64, name, token, stage, cb) {
    /* ⚠️ RULE: never add a header here that isn't `authorization` or
       `content-type`. Any other name makes the browser preflight the
       request and block it — that is the entire v33 bug. */
    var headers = { 'Content-Type': (stage === 0 ? 'application/json' : 'text/plain;charset=UTF-8') };
    if (stage === 0) headers['Authorization'] = 'Bearer ' + SUPA_ANON_KEY;

    var opts = {
      method: 'POST',
      headers: headers,
      /* NOTE (v33): the Firebase token is in the BODY, not a header.
         The gateway only lets `authorization` + `content-type` through
         on a preflight, and the Edge Function verifies this token
         itself against Google's public keys. */
      body: JSON.stringify({ image: b64, name: name || undefined, fb_token: token })
    };

    var ctl = null, timer = null;
    try {
      if (typeof AbortController === 'function') {
        ctl = new AbortController();
        opts.signal = ctl.signal;
        /* A hung request used to leave the UI spinning forever. */
        timer = setTimeout(function() { try { ctl.abort(); } catch (e) {} }, TIMEOUT_MS);
      }
    } catch (e) { ctl = null; }

    function done(err, status, data, raw) {
      if (timer) { clearTimeout(timer); timer = null; }
      cb(err, status, data, raw);
    }

    try {
      fetch(IMGBB_PROXY_URL, opts).then(function(r) {
        return r.text().then(function(txt) {
          var d = null;
          try { d = JSON.parse(txt); } catch (e) {}
          done(null, r.status, d, txt);
        }, function() { done(null, r.status, null, ''); });
      }, function(e) {
        /* TypeError("Failed to fetch") lands here — could be offline,
           a dropped connection, a timeout, or a CORS block. _friendly()
           turns it into something the user can act on, and _attempt()
           decides whether to retry / switch transport. */
        done(e || new Error('Network error'), 0, null, '');
      });
    } catch (e) {
      done(e, 0, null, '');
    }
  }

  function _serverMsg(data, raw) {
    if (data) {
      if (typeof data.error === 'string' && data.error) return data.error;
      if (data.error && (data.error.message || data.error.info)) return data.error.message || data.error.info;
      if (typeof data.message === 'string' && data.message) return data.message;
    }
    var t = String(raw || '').replace(/\s+/g, ' ').trim();
    return (t && t.length <= 140) ? t : '';
  }

  /* Bare "Failed to fetch" tells the user nothing actionable. */
  function _friendly(e) {
    var m = String((e && (e.message || e.name)) || e || '');
    if (/abort|timeout/i.test(m)) return 'Upload timeout — internet slow lag raha hai, dobara try karo';
    if (/failed to fetch|load failed|networkerror|network request failed|err_|net::/i.test(m)) {
      return 'Network error — internet check karke dobara try karo';
    }
    return m || 'Upload failed';
  }

  /* ── Profile image upload ── */
  window.uploadProfileImage = function(file, callback) {
    var uid  = window.U ? window.U.uid : 'user';
    var name = 'profile_' + uid + '_' + Date.now();
    /* ✅ FIX (2026-09-15c): "image upload pe click karo to kuch hota hi
       nahi" — between the tap and the first visible feedback there was a
       silent window (compress + auth token + network round-trips) that
       read as a dead button, and on a failed upload the only toast came
       at the very end. Announce the start so every tap has an immediate,
       visible response; success/error toasts still follow as before. */
    if (window.toast) toast('⏳ Photo upload ho rahi hai…', 'inf');
    compImg(file, 400, 0.8, 150, function(b64) {
      uploadToImgBB(b64, name, function(err, url) {
        if (err) { if (window.toast) toast('Image upload failed: ' + err, 'err'); if (callback) callback(null); return; }
        /* ✅ BUG FIX (2026-08-23): "Profile image update hi nahi hota".
           Two stacked bugs — (1) window.DB.users.update() was called
           fire-and-forget, its result never checked, so the caller's
           success callback fired unconditionally even on a genuine DB
           failure. (2) `window.UD.avatar_url = url` set the WRONG field
           name — every screen that displays the photo reads
           UD.profileImage (camelCase, mapped from avatar_url by
           core/listeners.js _applyUser), not UD.avatar_url. So even a
           fully successful DB save would still render the OLD photo
           until the next ~30s background poll happened to overwrite
           UD wholesale — making it look broken when the save itself
           had actually worked. Now waits for DB confirmation and sets
           the field every screen actually reads. */
        if (window.DB) {
          window.DB.users.update({ avatar_url: url }).then(function(res) {
            if (!res || !res.ok) { if (window.toast) toast('Photo save failed — dobara try karo', 'err'); if (callback) callback(null); return; }
            if (window.UD) window.UD.profileImage = url;
            if (callback) callback(url);
          });
        } else if (callback) { callback(null); }
      });
    });
  };

  /* ── Banner image upload ── */
  window.uploadBannerImage = function(file, callback) {
    var uid  = window.U ? window.U.uid : 'user';
    var name = 'banner_' + uid + '_' + Date.now();
    /* ✅ FIX (2026-09-15c): immediate visible feedback on tap — see the
       matching note in uploadProfileImage above. */
    if (window.toast) toast('⏳ Banner upload ho rahi hai…', 'inf');
    compImg(file, 800, 0.75, 250, function(b64) {
      uploadToImgBB(b64, name, function(err, url) {
        if (err) { if (window.toast) toast('Banner upload failed: ' + err, 'err'); if (callback) callback(null); return; }
        /* ✅ BUG FIX (2026-08-23): same two bugs as profile image above —
           (1) fire-and-forget DB write with no result check, and (2)
           `window.UD.banner_url = url` set the wrong field name; every
           screen reads UD.bannerImage (camelCase). Also: users.banner_url
           didn't exist as a column at all until this session's migration
           — every banner save before this was failing outright at the
           database level with a genuine Postgres error this fire-and-
           forget call never surfaced. */
        if (window.DB) {
          window.DB.users.update({ banner_url: url }).then(function(res) {
            if (!res || !res.ok) { if (window.toast) toast('Banner save failed — dobara try karo', 'err'); if (callback) callback(null); return; }
            if (window.UD) window.UD.bannerImage = url;
            if (callback) callback(url);
          });
        } else if (callback) { callback(null); }
      });
    });
  };

  /* ── Wallet screenshot upload ── */
  window.uploadWalletScreenshot = function(b64, callback) {
    var uid  = window.U ? window.U.uid : 'user';
    var name = 'wallet_ss_' + uid + '_' + Date.now();
    uploadToImgBB(b64, name, function(err, url) {
      callback(err ? null : url);
    });
  };

  /* ── Base64 direct upload ── */
  window.uploadToImgBBBase64 = function(base64, name, callback) {
    _doUpload(_stripPrefix(base64), name || ('img_' + Date.now()), callback, _mimeOf(base64));
  };

  /* ── Image compressor ── */
  window.compImg = function(file, maxDim, quality, maxKB, cb) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else       { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        var q = quality, result = c.toDataURL('image/jpeg', q);
        while (result.length > maxKB * 1370 && q > 0.1) {
          q = Math.round((q - 0.1) * 10) / 10;
          result = c.toDataURL('image/jpeg', q);
        }
        cb(result);
      };
      img.onerror = function() { cb(e.target.result); };
      img.src = e.target.result;
    };
    reader.onerror = function() { cb(null); };
    reader.readAsDataURL(file);
  };

  console.log('[ImgBB] v33-CORS-FIX ready — no custom headers, token in body ✅');
})();
