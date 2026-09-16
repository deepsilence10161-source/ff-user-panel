/* ================================================================
   IMGBB UPLOAD — core/imgbb.js  v35-SAVE-ERROR-VISIBLE
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
   • 2026-09-15b (v33) "Failed to fetch" on EVERY image upload —
             root cause + fix documented at _send() below.
   • 2026-09-16 (v34) Supabase's current Edge gateway also expects the
             public project key in `apikey`. The client only sent it as
             Authorization, then its no-header fallback was rejected with
             `UNAUTHORIZED_NO_AUTH_HEADER / Missing authorization header`.
             v34 sends the standard Supabase browser header set and keeps
             the Firebase identity token in the HTTPS request body.
   • 2026-09-16c (v35) "Photo save failed — dobara try karo" even though
             ImgBB upload AND banner save both succeeded: avatar_url ka DB
             update server-side rok gaya (trigger/constraint class ka bug —
             client ka dono path identical hai) aur purana toast wajah khaa
             jaata tha. _saveUserImage ab updateImage ka ASLI reason
             dikhata hai (message + pg code), taaki ek hi screenshot se
             DB-side culprit pakda jaa sake. Diagnosis + fix SQL:
             supabase/migrations/20260916_diagnose_avatar_url_save.sql

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
      contains: Authorization + apikey + Content-Type. Nothing custom.
      `apikey` is required by the current Supabase Edge gateway; the
      public anon project key belongs in both standard gateway fields.
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
      /* ✅ FIX (2026-09-16): _getAuthToken already waits a few seconds for
         auth state to restore, but on a fresh WebView/app-open the restore
         can take a little longer — and the upload used to fail instantly
         with "Login required" the moment the token wasn't ready. Retry the
         token a couple of times with backoff before surfacing an error, so
         a momentary restore lag no longer kills a user-triggered upload. */
      _authTokenWithRetry(small, name, 0, callback);
    });
  }

  function _authTokenWithRetry(b64, name, attempt, callback) {
    _getAuthToken(function(token) {
      if (token) { _attempt(b64, name, token, 0, 0, '', callback); return; }
      if (attempt < 2) {
        setTimeout(function() { _authTokenWithRetry(b64, name, attempt + 1, callback); }, 1500 * (attempt + 1));
        return;
      }
      callback(_loginMsg(), null);
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
     stage 0 — Supabase's standard browser headers: `apikey`,
               `Authorization`, and `Content-Type`. All three are on the
               Edge gateway's fixed CORS allow-list. Earlier code omitted
               `apikey`; the relay can reject that request before the
               function runs.
     stage 1 — no gateway headers, Content-Type text/plain (CORS-simple),
               Firebase token in the body. This is a genuinely preflight-
               free recovery path. It works because imgbb-upload is
               deployed with verify_jwt=false and then cryptographically
               verifies the Firebase token itself. Only used after stage
               0 exhausts transient retries.
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

      /* A preflight-free stage-1 request cannot pass while an old
         deployment still has gateway verify_jwt enabled. Do not replace
         the real stage-0 network/server reason with the gateway's
         misleading "Missing authorization header" response. The source-
         controlled config + deploy workflow turn that gateway check off;
         the function still verifies Firebase cryptographically itself. */
      if (authFail && stage === 1 && /missing authorization header/i.test(_serverMsg(data, raw))) {
        callback(lastMsg || 'Image service update pending — thodi der baad dobara try karo', null);
        return;
      }

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
    /* ⚠️ RULE: stage 0 may use ONLY Supabase's documented standard
       CORS headers. In particular, never move the Firebase token into a
       custom header again. `apikey` is not custom from the gateway's
       perspective; it is part of the fixed allow-list and is required by
       the current relay. */
    var headers = { 'Content-Type': (stage === 0 ? 'application/json' : 'text/plain;charset=UTF-8') };
    if (stage === 0) {
      headers['apikey'] = SUPA_ANON_KEY;
      headers['Authorization'] = 'Bearer ' + SUPA_ANON_KEY;
    }

    var opts = {
      method: 'POST',
      headers: headers,
      /* The Firebase token is in the BODY, not a custom header. The
         gateway's fixed preflight list accepts the standard project-key
         headers above, and the Edge Function verifies this identity token
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

  /* ── Persist a hosted profile/banner URL and only report success after
     PostgREST confirms that the authenticated user's row was affected.
     A normal update can return error:null with zero rows when RLS blocks
     it; DB.users.updateImage() deliberately detects that case. */
  function _saveUserImage(field, url, callback) {
    var label = field === 'avatar_url' ? 'Photo' : 'Banner';
    if (!window.DB || !window.DB.users) {
      if (window.toast) toast(label + ' save failed — service unavailable', 'err');
      if (callback) callback(null);
      return;
    }
    var fields = {}; fields[field] = url;
    var write;
    try {
      write = window.DB.users.updateImage
        ? window.DB.users.updateImage(field, url)
        : window.DB.users.update(fields);
    } catch (e) {
      if (window.toast) toast(label + ' save failed — dobara try karo', 'err');
      if (callback) callback(null);
      return;
    }
    Promise.resolve(write).then(function(res) {
      if (!res || !res.ok) {
        var why = res && res.error ? String(res.error) : '';
        console.warn('[ImgBB] ' + label + ' DB save rejected:', why);
        /* ✅ FIX (2026-09-16c): generic "dobara try karo" hata diya — ImgBB
           upload SUCCESS + banner save SUCCESS ke baad bhi sirf profile
           PHOTO ka save fail ho raha tha, aur generic toast se asli
           Postgres reason (trigger FK violation / constraint / column
           issue) kabhi saamne hi nahi aata tha. Ab DB.users.updateImage ka
           asli reason hi dikhata hai — ek screenshot culprit bata dega.
           Jaan-bujhe map kiye gaye codes ko Hinglish line milti hai;
           baaki raw reason (message + pg code, 180 chars tak) dikhata hai. */
        var line;
        if (why === 'update_not_applied_rls') {
          line = label + ' save nahi hui (permission) — logout/login karke dobara try karo';
        } else if (why === 'db_trigger_rewrote_value') {
          line = label + ' server ne save nahi ki (DB trigger blocked) — support ko report karo';
        } else if (why === 'not_authenticated') {
          line = 'Login expire ho gaya — dobara login karo';
        } else {
          line = label + ' save failed: ' + (why ? why.slice(0, 140) : 'dobara try karo');
        }
        if (window.toast) toast(line, 'err');
        if (callback) callback(null);
        return;
      }
      if (window.UD) {
        if (field === 'avatar_url') window.UD.profileImage = url;
        else window.UD.bannerImage = url;
      }
      if (callback) callback(url);
    }, function(e) {
      console.warn('[ImgBB] ' + label + ' DB save failed:', e && e.message);
      if (window.toast) toast(label + ' save failed — internet check karke dobara try karo', 'err');
      if (callback) callback(null);
    });
  }

  function _prepareImage(input, maxDim, quality, maxKB, callback) {
    /* profile.js already compresses the banner once for its instant
       preview. Accepting that data URL here avoids decoding/compressing
       the exact same file a second time. Existing File callers remain
       fully compatible. */
    if (typeof input === 'string') { callback(input); return; }
    _compressImage(input, maxDim, quality, maxKB, callback);
  }

  /* ── Profile image upload ── */
  window.uploadProfileImage = function(fileOrDataUrl, callback) {
    var uid  = window.U ? window.U.uid : 'user';
    var name = 'profile_' + uid + '_' + Date.now();
    if (window.toast) toast('⏳ Photo upload ho rahi hai…', 'inf');
    _prepareImage(fileOrDataUrl, 400, 0.8, 150, function(b64) {
      if (!b64) {
        if (window.toast) toast('Image read nahi hui — JPG/PNG image dobara choose karo', 'err');
        if (callback) callback(null);
        return;
      }
      window.uploadToImgBB(b64, name, function(err, url) {
        if (err || !url) {
          if (window.toast) toast('Image upload failed: ' + (err || 'server ne URL nahi diya'), 'err');
          if (callback) callback(null);
          return;
        }
        _saveUserImage('avatar_url', url, callback);
      });
    });
  };

  /* ── Banner image upload ── */
  window.uploadBannerImage = function(fileOrDataUrl, callback) {
    var uid  = window.U ? window.U.uid : 'user';
    var name = 'banner_' + uid + '_' + Date.now();
    if (window.toast) toast('⏳ Banner upload ho rahi hai…', 'inf');
    _prepareImage(fileOrDataUrl, 800, 0.75, 250, function(b64) {
      if (!b64) {
        if (window.toast) toast('Banner image read nahi hui — JPG/PNG dobara choose karo', 'err');
        if (callback) callback(null);
        return;
      }
      window.uploadToImgBB(b64, name, function(err, url) {
        if (err || !url) {
          if (window.toast) toast('Banner upload failed: ' + (err || 'server ne URL nahi diya'), 'err');
          if (callback) callback(null);
          return;
        }
        _saveUserImage('banner_url', url, callback);
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

  /* ── Canonical image compressor ─────────────────────────────────
     This is deliberately private and then exported. screens/wallet.js
     used to declare a second global `compImg` later in script order,
     silently replacing this implementation with one that had no read or
     decode error handlers. Profile/banner selection could then hang with
     no callback and no toast on an unsupported/corrupt image. There is now
     one implementation, every terminal path calls back exactly once, and
     profile helpers call the private reference so another script cannot
     accidentally replace it again. */
  function _compressImage(file, maxDim, quality, maxKB, cb) {
    var finished = false;
    function finish(value) {
      if (finished) return;
      finished = true;
      cb(value || null);
    }
    if (!_isFileLike(file) || typeof FileReader !== 'function') { finish(null); return; }

    var reader;
    try { reader = new FileReader(); }
    catch (e) { finish(null); return; }

    reader.onload = function(e) {
      var original = String((e && e.target && e.target.result) || '');
      if (!original || original.indexOf('data:') !== 0) { finish(null); return; }
      if (typeof Image !== 'function') { finish(original); return; }

      var img = new Image();
      var decodeTimer = setTimeout(function() {
        /* Keep the original image rather than hanging forever. The shared
           uploader will still apply its own size guard/recompression. */
        finish(original);
      }, 15000);
      img.onload = function() {
        if (finished) return;
        clearTimeout(decodeTimer);
        try {
          var w = Number(img.width) || 0, h = Number(img.height) || 0;
          if (!w || !h) { finish(original); return; }
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.max(1, Math.round(h * maxDim / w)); w = maxDim; }
            else       { w = Math.max(1, Math.round(w * maxDim / h)); h = maxDim; }
          }
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          var ctx = c.getContext && c.getContext('2d');
          if (!ctx) { finish(original); return; }
          ctx.drawImage(img, 0, 0, w, h);
          var q = Math.min(1, Math.max(0.1, Number(quality) || 0.8));
          var result = c.toDataURL('image/jpeg', q);
          while (result.length > maxKB * 1370 && q > 0.1) {
            q = Math.max(0.1, Math.round((q - 0.1) * 10) / 10);
            result = c.toDataURL('image/jpeg', q);
          }
          finish(result);
        } catch (e2) { finish(original); }
      };
      img.onerror = function() { clearTimeout(decodeTimer); finish(original); };
      try { img.src = original; } catch (e3) { clearTimeout(decodeTimer); finish(original); }
    };
    reader.onerror = function() { finish(null); };
    reader.onabort = function() { finish(null); };
    try { reader.readAsDataURL(file); } catch (e4) { finish(null); }
  }
  window.compImg = _compressImage;

  console.log('[ImgBB] v35-SAVE-ERROR-VISIBLE ready — DB save failure ka asli reason ab toast me ✅');
})();
