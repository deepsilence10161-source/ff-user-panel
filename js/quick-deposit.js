/* quick-deposit.js - Sky Diamond purchase flow */
window.startAdd = function() {
  if (!window.UD || !window.U) return;
  var h = '<div style="text-align:center;padding:6px 0 16px">';
  h += '<div style="font-size:36px;margin-bottom:8px">💎</div>';
  h += '<div style="font-size:17px;font-weight:900;color:#00d4ff">Buy Sky Diamonds</div>';
  h += '<div style="font-size:12px;color:#888;margin-top:4px">Sky Diamonds se Paid matches khelo</div>';
  h += '</div>';
  /* Info box */
  h += '<div style="background:rgba(0,212,255,.07);border:1px solid rgba(0,212,255,.2);border-radius:12px;padding:12px;margin-bottom:14px;font-size:12px;color:#00d4ff;line-height:1.7">';
  h += '💎 <b>Sky Diamond</b> = Paid matches ki entry fee<br>';
  h += '<img src="js/green-diamond.png" style="width:14px;height:14px;vertical-align:middle;object-fit:contain;display:inline-block"> <b>Green Diamond</b> = Matches jeetne par milta hai (rank ke liye)<br>';
  h += '🪙 <b>Coins</b> = Daily bonus/Ads se milta hai (free matches ke liye)<br>';
  h += '⚠️ Koi bhi diamond <b>withdraw nahi</b> hota — sirf matches khelo!';
  h += '</div>';
  /* Packages from admin settings */
  /* ✅ FIX (2026-08): was reading Firebase 'appSettings/diamondPackages',
     a second, disconnected package-config source from what wallet.js's
     deposit flow uses (window.CFG.sdPackages, sourced from Supabase
     app_settings.live_config — the one the admin's "Sky Diamond
     Packages" editor in App Settings actually saves to). Having two
     separate editors/sources for the same packages meant admin changes
     in one place silently didn't reach this screen. Now reads the same
     live_config-backed CFG.sdPackages everywhere. */
  var pkgs = (window.CFG && window.CFG.sdPackages && window.CFG.sdPackages.length) ? window.CFG.sdPackages : [
    { diamonds: 50,  price: 49,  label: 'Starter' },
    { diamonds: 120, price: 99,  label: 'Popular' },
    { diamonds: 260, price: 199, label: 'Value' },
    { diamonds: 600, price: 399, label: 'Mega' }
  ];
  var pkgHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">';
  pkgs.forEach(function(p) {
    pkgHtml += '<div onclick="window._buyDiamondPkg(' + p.diamonds + ',' + p.price + ')" style="background:rgba(0,212,255,.07);border:1.5px solid rgba(0,212,255,.25);border-radius:14px;padding:14px 10px;text-align:center;cursor:pointer;transition:all .2s">';
    pkgHtml += '<div style="font-size:22px;font-weight:900;color:#00d4ff">💎 ' + p.diamonds + '</div>';
    pkgHtml += '<div style="font-size:10px;color:#00ff9c;font-weight:700;margin:2px 0">' + p.label + '</div>';
    pkgHtml += '<div style="font-size:16px;font-weight:800;color:#fff;margin-top:4px">₹' + p.price + '</div>';
    pkgHtml += '</div>';
  });
  pkgHtml += '</div>';
  var modal = document.getElementById('modalB');
  if (modal) modal.innerHTML = h + pkgHtml + '<div style="font-size:11px;color:#555;text-align:center">UPI payment karo → screenshot admin ko bhejo → 1-2 ghante mein diamonds add honge</div>';
  if (window.openModal) openModal('💎 Buy Sky Diamonds', h + pkgHtml + '<div style="font-size:11px;color:#555;text-align:center">UPI payment karo → screenshot admin ko bhejo → 1-2 ghante mein diamonds add honge</div>');
  return;
};

/* ✅ R26 (2026-09-21): Paytm Instant — isi file ke modal ka handler.
   wallet.js ka wfPaytmPay() seedha wfAmt (manual wizard amount) use karta
   tha; is quick-deposit flow me price package se aata hai. closeModal is
   liye pehle — Paytm checkout modal ke UPPER khulega. Amount validation
   ₹10 min (RPC/Edge bhi enforce karta hai). */
window._paytmInstantPay = function(price) {
  if (!window.startPaytmPayment) { if (window.toast) toast('Paytm abhi ready nahi hai, app update karo', 'err'); return; }
  var a = Math.round(Number(price) || 0);
  if (!a || a < 10) { if (window.toast) toast('Invalid amount', 'err'); return; }
  if (window.closeModal) closeModal();
  window.startPaytmPayment(a, {
    onStatus: function(status, detail) {
      if (status === 'loading')    { if (window.toast) toast('Order ban raha hai...', 'info'); }
      else if (status === 'processing') { if (window.toast) toast('Confirm ho raha hai...', 'info'); }
      else if (status === 'approved')   { if (window.toast) toast('💎 Sky Diamonds add ho gaye!', 'success'); }
      else if (status === 'rejected')   { if (window.toast) toast('Payment fail ho gaya', 'err'); }
      else if (status === 'timeout')    { if (window.toast) toast('Thodi der lag rahi hai — Wallet History mein check karo', 'info'); }
      else if (status === 'error')      { if (window.toast) toast(detail || 'Kuch galat ho gaya', 'err'); }
    }
  });
};

window._buyDiamondPkg = function(diamonds, price) {
  var h = '<div style="text-align:center;padding:8px 0 14px">';
  h += '<div style="font-size:28px;font-weight:900;color:#00d4ff">💎 ' + diamonds + '</div>';
  h += '<div style="font-size:22px;font-weight:900;color:#fff;margin:6px 0">₹' + price + '</div>';
  h += '</div>';
  h += '<div style="background:rgba(0,0,0,.3);border-radius:12px;padding:12px;margin-bottom:12px;font-size:12px;line-height:1.7;color:#ccc">';
  h += 'UPI ID: <b style="color:#ffd700">miniesports@upi</b><br>';
  h += 'Amount: <b style="color:#00ff9c">₹' + price + '</b><br>';
  h += 'Note: <b>Diamonds-' + (window.UD && window.UD.ffUid || 'myUID') + '</b>';
  h += '</div>';
  h += '<div class="f-group"><label>Payment Screenshot *</label>';
  h += '<div id="_diaDepArea" onclick="document.getElementById(\'_diaDepIn\').click()" style="border:2px dashed rgba(0,212,255,.25);border-radius:12px;padding:18px;text-align:center;cursor:pointer">';
  h += '<i class="fas fa-camera" style="font-size:26px;color:#00d4ff55;display:block;margin-bottom:6px"></i>';
  h += '<div style="font-size:12px;color:#666">Screenshot tap karke upload karo</div>';
  h += '<input type="file" id="_diaDepIn" accept="image/*" style="display:none" onchange="window._diaDepSs(this)"></div>';
  h += '<img id="_diaDepPreview" style="display:none;width:100%;border-radius:10px;margin-top:8px"></div>';
  /* ✅ FIX (2026-08-17, CRITICAL): the form never collected a UTR/UPI
     reference number at all — sd_requests.upi_ref stayed permanently
     empty for every purchase, which is exactly why the admin's Wallet
     Requests table always showed "—" under UTR/UPI even after a payment
     screenshot was uploaded. */
  h += '<div class="f-group" style="margin-top:10px"><label>UTR / UPI Reference Number *</label>';
  h += '<input type="text" id="_diaDepUtr" placeholder="e.g. 123456789012" style="width:100%;padding:11px;border-radius:10px;border:1px solid rgba(0,212,255,.25);background:rgba(0,0,0,.3);color:#fff;font-size:13px;box-sizing:border-box">';
  h += '<div style="font-size:10px;color:#666;margin-top:4px">Payment app ke transaction/UTR number screenshot ke saath match karo</div></div>';
  /* ✅ FIX (2026-09-15c, SPEED): button now has an id so the submit flow
     can disable it and show live stage labels the instant it is tapped.
     Previously the button gave ZERO feedback for the whole (slow) upload
     window, which read as "button kaam hi nahi kar raha". */
  h += '<button id="_diaDepBtn" onclick="window._submitDiaDep(' + diamonds + ',' + price + ')" style="width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,#0066ff,#00d4ff);color:#fff;font-size:14px;font-weight:900;cursor:pointer;margin-top:4px">Submit Payment 💎</button>';
  /* ✅ R26 FIX (2026-09-21): Paytm Instant Checkout was UNREACHABLE.
     Root cause: wallet.js ka Paytm button showWFStep() step-1 mein tha,
     lekin wallet ka "Buy Sky Diamonds" startAdd() quick-deposit.js ke
     window.startAdd se override ho chuka hai (quick-deposit baad mein load
     hota hai) — isliye wallet.js ka step-1 flow kabhi render hi nahi hota
     tha aur Paytm button (chahe admin toggle ON bhi kare) user ko kabhi
     nahi dikhta tha. Ab Paytm Instant option isi LIVE user-flow mein
     dikhta hai — sirf tab jab admin ne toggle ON kiya ho
     (CFG.paytmEnabled). Manual screenshot-path bilkul waise hi rehta hai. */
  if (window.CFG && window.CFG.paytmEnabled && window.startPaytmPayment) {
    h += '<button onclick="window._paytmInstantPay(' + price + ')" style="width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,#00baf2,#0095d7);color:#fff;font-size:13px;font-weight:800;cursor:pointer;margin-top:6px">⚡ Pay Instantly via Paytm (UPI) — Auto Credit</button>';
  }
  if (window.openModal) openModal('💎 Buy ' + diamonds + ' Sky Diamonds', h);
  var _ss = '';
  var _submitting = false;
  /* ✅ FIX (2026-09-15c, SPEED): the screenshot upload used to start only
     when Submit was tapped, so the tap appeared to do nothing for as long
     as the ImgBB round-trip took (seconds on mobile data, longer with
     retries). Now the upload starts IN THE BACKGROUND the moment the
     screenshot is picked — by the time the user has typed the UTR and
     tapped Submit the hosted URL is usually already there, so Submit
     becomes a single fast DB write. Generations guard against a stale
     upload answering for a re-picked screenshot. */
  var _pre = null; /* { gen, state:'uploading'|'done'|'error', url, err, waiters[] } */

  function _btn(label, disabled) {
    var b = document.getElementById('_diaDepBtn');
    if (!b) return;
    if (label != null) b.textContent = label;
    b.disabled = !!disabled;
    b.style.opacity = disabled ? '.75' : '1';
  }
  function _startPreUpload() {
    if (!_ss || !window.uploadToImgBBBase64) return;
    var gen = (_pre ? _pre.gen + 1 : 1);
    _pre = { gen: gen, state: 'uploading', url: null, err: null, waiters: [] };
    try {
      window.uploadToImgBBBase64(_ss, 'dia_proof_' + Date.now(), function(err, url) {
        if (!_pre || _pre.gen !== gen) return; /* stale generation — ignore */
        if (err) { _pre.state = 'error'; _pre.err = err; }
        else     { _pre.state = 'done';  _pre.url = url; }
        var ws = _pre.waiters; _pre.waiters = [];
        for (var i = 0; i < ws.length; i++) { try { ws[i](); } catch (e) {} }
      });
    } catch (e) { _pre.state = 'error'; _pre.err = String((e && e.message) || e); }
  }
  /* Resolve the hosted screenshot URL: reuse the background upload when
     possible, otherwise start one now. cb(errOrNull, urlOrNull, inlineB64OrNull) */
  function _ensureUpload(retried, cb) {
    if (_pre && _pre.state === 'done') { cb(null, _pre.url, null); return; }
    if (_pre && _pre.state === 'uploading') {
      _btn('⏳ Screenshot upload ho raha hai…', true);
      _pre.waiters.push(function() { _ensureUpload(retried, cb); });
      return;
    }
    if (_pre && _pre.state === 'error' && !retried) {
      /* One fresh attempt before falling back (transient blip?) */
      _pre = null; _startPreUpload();
      _ensureUpload(true, cb);
      return;
    }
    var reason = (_pre && _pre.err) || 'upload fail';
    /* User has already paid, so the proof must never be lost. The
       compressed data URL is a fully supported screenshot_url value and
       the admin panel renders it directly. That is a SUCCESS fallback,
       not a failed payment: log the hosting issue for diagnosis, but do
       not show a scary "server pe upload nahi hua" toast immediately
       before the confirmed request-success toast. */
    if (_ss && _ss.length < 700000 && _ss.indexOf('data:image/') === 0) {
      console.warn('[quick-deposit] Hosted proof upload failed; saving compressed proof inline:', reason);
      cb(null, null, _ss);
      return;
    }
    cb(reason, null, null);
  }

  window._diaDepSs = function(inp) {
    if (!inp.files || !inp.files[0]) return;
    var f = inp.files[0];
    /* Clear immediately so selecting the same proof again after any
       failure always emits onchange. */
    inp.value = '';
    /* Bug #45 pattern (already used in screens/wallet.js) — validate type
       before doing anything else, so a non-image can't reach the uploader. */
    if (f.type && f.type.indexOf('image/') !== 0) {
      if (window.toast) toast('Sirf image file upload karo!', 'err');
      return;
    }
    /* ✅ FIX (2026-09-15b): this used to store the RAW FileReader data URL.
       A phone screenshot is typically 2-5 MB, so every submit POSTed a
       ~3-7 MB JSON body to the Edge Function on mobile data — slow at
       best, and on a weak connection it simply dropped mid-request, which
       the user saw as "Failed to fetch" / upload failed even after the
       CORS bug was fixed. Now compressed the same way every other upload
       in this app already compresses (800px/0.7 ≈ 100-200 KB is plenty
       for a payment proof admin reads on a phone). Falls back to the raw
       data URL if canvas compression is unavailable or fails. */
    function _apply(dataUrl) {
      if (!dataUrl) return;
      _ss = dataUrl;
      var prev = document.getElementById('_diaDepPreview');
      var area = document.getElementById('_diaDepArea');
      if (prev) { prev.src = _ss; prev.style.display = 'block'; }
      if (area) area.innerHTML = '<i class="fas fa-check-circle" style="color:#00ff9c;font-size:20px;display:block;margin-bottom:4px"></i><div style="font-size:11px;color:#00ff9c">Screenshot ready ✅</div><input type="file" id="_diaDepIn" accept="image/*" style="display:none" onchange="window._diaDepSs(this)">';
      _startPreUpload(); /* background upload — Submit becomes instant */
    }
    function _raw() {
      var r = new FileReader();
      r.onload = function(e) { _apply(e.target.result); };
      r.readAsDataURL(f);
    }
    if (window.compImg) {
      try { compImg(f, 800, 0.7, 200, function(b64) { if (b64) _apply(b64); else _raw(); }); }
      catch (e) { _raw(); }
    } else {
      _raw();
    }
  };
  window._submitDiaDep = function(diamonds, price) {
    /* ✅ DEBUG WRAP (2026-09-14): Junaid confirmed screenshot uploaded +
       UTR filled correctly (both error toasts fired correctly on their
       respective missing-field cases) yet Submit still does nothing on
       the fully-filled form — meaning something is throwing silently
       AFTER both guards pass, with no visible error anywhere. Wrapping
       the entire body in try/catch so that IF something throws, we get
       a visible red toast with the exact error instead of a silent
       hang — this is temporary instrumentation to pin down the exact
       line, not a permanent fix by itself. */
    try {
      window.__realSubmitDiaDep(diamonds, price);
    } catch (e) {
      if (window.toast) toast('❌ Submit error: ' + (e && e.message || e), 'err');
      console.error('[quick-deposit] _submitDiaDep threw:', e);
      _submitting = false;
      _btn('Submit Payment 💎', false);
    }
  };
  window.__realSubmitDiaDep = function(diamonds, price) {
    if (_submitting) return;
    if (!_ss) { if (window.toast) toast('Screenshot upload karo!', 'err'); return; }
    /* ✅ FIX (2026-08-17, CRITICAL): UTR/UPI reference number was never
       collected or validated at all before this fix. */
    var _utrInput = document.getElementById('_diaDepUtr');
    var _utr = _utrInput ? _utrInput.value.trim() : '';
    if (!_utr) { if (window.toast) toast('UTR / UPI reference number daalo!', 'err'); return; }
    /* ✅ DEBUG FIX (2026-09-14): this used to be a silent
       `if (!window.U || !window.db) return;` — if either wasn't ready
       yet, the button did LITERALLY NOTHING with zero feedback, which
       is indistinguishable from "click isn't registering at all" from
       the user's side. Now tells us exactly which one is missing so we
       can pin down whether this is an init-timing race or something
       else, instead of guessing blind.
       window.db check removed (2026-09-14): this flow is Supabase-only
       now (see _doSubmit's fix note) — window.db (Firebase RTDB/bridge)
       is no longer used or required here. */
    if (!window.U) { if (window.toast) toast('⚠️ Login state load ho raha hai, thodi der ruk kar try karo (window.U missing)', 'err'); return; }
    if (!window._supa) { if (window.toast) toast('⚠️ App abhi poora load nahi hua, thodi der ruk kar try karo (Supabase missing)', 'err'); return; }
    _submitting = true;
    _btn('⏳ Submit ho raha hai…', true); /* instant feedback on tap */

    /* Issue #10 Fix: Replace djb2 with SHA-256 (crypto.subtle) to eliminate
       hash collisions on large user base. async/await handled via Promise chain. */
    function _hashStr(str) {
      if (window.crypto && window.crypto.subtle) {
        var msgBuf = new TextEncoder().encode(str.substring(0, 4000));
        return window.crypto.subtle.digest('SHA-256', msgBuf).then(function(hashBuf) {
          var hexArr = Array.from(new Uint8Array(hashBuf));
          var hex = hexArr.map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
          return 'DP' + hex.substring(0, 16).toUpperCase();
        });
      }
      /* Fallback for old browsers (no crypto.subtle) */
      var h = 0, i = str.length;
      while (i--) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
      return Promise.resolve('DP' + Math.abs(h).toString(36).toUpperCase().padStart(8,'0'));
    }

    function _abort(msg) {
      _submitting = false;
      _btn('Submit Payment 💎', false);
      if (msg && window.toast) toast(msg, 'err');
    }

    _hashStr(_ss.substring(0, 2000)).then(function(_imgHash) {

    /* ✅ FIX (2026-08-17, CRITICAL): _doSubmit() used to take no arguments
       and always write screenshotBase64 (the raw base64 data URL) to
       Firebase instead of the ImgBB-hosted URL — the ImgBB upload ran
       earlier but its returned `url` was silently discarded, never
       reaching either Firebase or Supabase. sd_requests.screenshot_url
       and sd_requests.upi_ref stayed NULL for every single purchase,
       which is exactly why the admin's Wallet Requests / Sky Diamond
       Requests tables always showed "No photo" and blank UTR/UPI even
       though the user had uploaded a screenshot. Now takes the real
       ImgBB URL and writes it (plus the UTR) to both sides. */
    function _doSubmit(screenshotUrl) {
      try {
        /* 🐛→✅ ROOT CAUSE FIX (2026-09-14): THIS was the real reason
           Submit did nothing — confirmed live via the visible DEBUG
           ERROR toast: "No Firebase App '[DEFAULT]' has been created".
           core/firebase.js's own header comment says it plainly: "Firebase
           RTDB = REMOVED (Supabase Realtime pe migrate ho gaya) ... Firebase
           sirf support/ chat ke liye bacha hai" — and its app is even
           initialized under the name "mainApp", not the default app
           (`firebase.initializeApp({...}, "mainApp")`). But this function
           still called `firebase.database.ServerValue.TIMESTAMP` and wrote
           to `window.db.ref('walletRequests')` as if a default Firebase
           app existed — window.db itself resolved fine (it's actually the
           Supabase bridge shim from core/db-bridge.js, which overwrites the
           top-level `var db` from firebase.js), but `firebase.database`
           internally looks for the DEFAULT-named app, which was never
           created, and threw immediately. This dead legacy write is fully
           removed now — Supabase's sd_requests is already the actual
           source of truth the Admin Panel reads (loadSkyDiamondReqSection,
           status='pending'), so nothing is lost by dropping it. A random
           client-side ID replaces the old Firebase push-key purely as a
           label for sd_requests.firebase_req_id (nullable, legacy column,
           kept only so existing admin-panel display code that references
           it doesn't need touching). */
        var id = 'sd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        _btn('⏳ Request save ho rahi hai…', true);
        /* ✅ FIX (2026-09-15c): the insert used to be fire-and-forget with
           the success toast + closeModal fired unconditionally BEFORE any
           DB confirmation — a rejected insert (RLS/offline) still showed
           "Request submit!" and closed the form, losing the purchase.
           supabase-js v2 also RESOLVES with `.error` instead of rejecting
           on DB errors, so both outcomes are checked here. The toast and
           modal close now only happen on a confirmed save. */
        window._supa.from('sd_requests').insert({
          user_id: window.U.uid,
          ign: (window.UD && window.UD.ign) || '',
          firebase_req_id: id,
          request_type: 'sky_diamond_purchase',
          sd_amount: diamonds,
          amount_inr: price,
          screenshot_url: screenshotUrl,
          upi_ref: _utr,
          img_hash: _imgHash,
          status: 'pending'
        }).then(function(res) {
          if (res && res.error) {
            console.warn('[quick-deposit] Supabase insert failed:', res.error.message);
            _abort('❌ Request save nahi hua — internet check karke dobara try karo');
            return;
          }
          /* ✅ FIX (2026-08-17): removed self-notification — the user just
             submitted this request themselves, so notifying them "you sent a
             request" adds no information and only irritates (per direct
             feedback). The success toast below already confirms submission;
             a real notification will arrive once admin approves/rejects. */
          _submitting = false;
          if (window.toast) toast('✅ Request submit! Admin 1-2 ghante mein diamonds add karega.', 'ok');
          if (window.closeModal) closeModal();
        }, function(e) {
          console.warn('[quick-deposit] Supabase insert failed:', e && e.message);
          _abort('❌ Request save nahi hua — internet check karke dobara try karo');
        });
      } catch (e) {
        /* ✅ DEBUG (2026-09-14): this whole function runs inside an
           async callback (ImgBB upload's callback, itself inside a
           .then()) — a synchronous try/catch around the OUTER click
           handler does NOT reach in here. Any throw in this block used
           to become a silent unhandled rejection with zero visible
           feedback, indistinguishable from the button "doing nothing".
           Now always surfaces visibly. */
        if (window.toast) toast('❌ Submit error (save): ' + (e && e.message || e), 'err');
        console.error('[quick-deposit] _doSubmit threw:', e);
        _submitting = false;
        _btn('Submit Payment 💎', false);
      }
    }

    /* Duplicate screenshot check via Supabase
       ✅ BUG FIX (2026-09-14): this chain used to be
       `.then(function(res){...}).catch(function(){_doSubmit(_ss)})`.
       Supabase-js query builders are thenables, not real Promises — a
       chained .catch() after .then() does not reliably fire on them,
       so a genuine rejection here (RLS denying the select, a network
       blip) silently vanished with _doSubmit() never called: no error,
       no insert, nothing. Same class of bug already fixed in 74 other
       places in this app; this one was chained rather than passed
       directly to a builder, so that sweep missed it. Confirmed live:
       sd_requests was empty in the DB despite a submitted request and
       a visible success toast (which only ever depended on the
       separate Firebase walletRequests write below, not this path).
       Fix: pass both callbacks directly to the same .then() call —
       .then(onFulfilled, onRejected) — instead of chaining .catch(). */
    if (window._supa) {
      window._supa.from('sd_requests')
        .select('id,status')
        .eq('img_hash', _imgHash)
        .limit(1)
        .then(_onDupCheckResult, _onDupCheckFail);
    } else {
      _onDupCheckFail();
    }

    function _onDupCheckResult(res) {
      try {
        /* v2 resolves with .error on DB/RLS/network trouble — fail OPEN
           (same as _onDupCheckFail) instead of silently stalling. */
        if (res && res.error) { _onDupCheckFail(); return; }
        if (res.data && res.data.length > 0) {
          var existing = res.data[0];
          _submitting = false;
          _btn('Submit Payment 💎', false);
          if (window.toast) toast('⚠️ Yeh screenshot pehle se use ho chuka hai! (Status: ' + existing.status + ')', 'err');
          return;
        }
        /* Issue #29 Fix: ImgBB error handling before submitting.
           ✅ 2026-09-15c: reuses the background pre-upload started when
           the screenshot was picked — normally already finished, so this
           returns instantly and Submit feels instant. */
        _ensureUpload(false, function(err, url, inlineB64) {
          if (err) {
            _abort('❌ Screenshot upload failed: ' + err);
            return;
          }
          _doSubmit(url || inlineB64);
        });
      } catch (e) {
        if (window.toast) toast('❌ Submit error (dupcheck): ' + (e && e.message || e), 'err');
        console.error('[quick-deposit] _onDupCheckResult threw:', e);
        _submitting = false;
        _btn('Submit Payment 💎', false);
      }
    }

    function _onDupCheckFail() {
      _ensureUpload(false, function(err, url, inlineB64) {
        if (err) { _abort('❌ Screenshot upload failed: ' + err); return; }
        _doSubmit(url || inlineB64);
      });
    }

    }, function(hashErr) {
      /* ✅ DEBUG (2026-09-14): if crypto.subtle.digest ever rejects on
         this device (some WebView builds have partial/buggy support),
         the whole submit used to hang silently forever with zero
         feedback — this is exactly Junaid's "click does nothing" report
         after both field-validation guards pass correctly. Now surfaces
         it visibly instead of hanging. */
      if (window.toast) toast('❌ Submit error (hash): ' + (hashErr && hashErr.message || hashErr), 'err');
      console.error('[quick-deposit] _hashStr rejected:', hashErr);
      _submitting = false;
      _btn('Submit Payment 💎', false);
    }); /* end _hashStr .then */
  };
};
