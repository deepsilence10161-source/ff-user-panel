/* ================================================================
   MINI eSPORTS — PREVIEW MODE v6.0   (2026-09-26)

   Preview mode = STRICT VIEW-ONLY user panel.
   Sab kuch dikhta hai (matches, wallet, leaderboard, clan, profile…)
   lekin user koi action nahi kar sakta — na match join, na request,
   na clan join, na vote, na redeem, na upload, kuch bhi nahi.

   v5.1 me sirf CLICK events block hote the (DOM-level) — jo bhi action
   programmatically ya click ke alawa trigger hota tha (auto-run code,
   keyboard submit, ya koi bhi .rpc()/.insert() call) wo chalta rehta
   tha. v6 me asli enforcement CLIENT LAYER par hai:

     1. @supabase client ka write-lock — client.from(t).insert/update/
        delete/upsert, client.rpc(), client.storage.*, client.functions.
        invoke(), client.auth.updateUser → sab ek blocked result dete
        hain ({data:null, error:{code:'PREVIEW_READ_ONLY'}}), to koi
        write kabhi network tak jaati hi nahi.
     2. Reads (select) 100% chalu rehte hain — view-only ka matlab
        dekhna, isliye reads kabhi block nahi hote.
     3. Read-only RPC allowlist (leaderboard / poll / room info jaise
        pure-read functions) — sirf view ke liye.
     4. DOM layer: click + submit + file-change par friendly toast,
        aur ek `window._previewMode.lastBlocked` telemetry flag
        (live testing + debugging ke liye).
     5. Factory patch: window.supabase.createClient bhi wrapped hai —
        token refresh par jab window._supa dobara banta hai (core/db.js
        ke 3 creation points) tab bhi lock zinda rehta hai, aur ek
        safety-net interval (sirf preview active hone par) kisi bhi
        naye client instance ko dobara wrap kar deta hai.

   Intentional exception: `early_access_users` insert allowed hai — yeh
   user ka "action" nahi, preview enrollment record hai (R29D fix), aur
   economy/actions par iska koi asar nahi.
   ================================================================ */
(function () {
  'use strict';

  var _previewActive = false;

  /* ── Pure-read RPC allowlist (view karne wale functions) ── */
  var READ_ONLY_RPC = [
    'get_my_poll_vote',       /* apna vote dekhna */
    'get_room_credentials',   /* eligible user ko room info dikhana (read) */
    'user_has_phone',         /* signup/verification read-helper */
    'is_caller_admin',        /* role badge */
    'f_referral_leaderboard', /* leaderboard view */
    'f_user_public_profiles'  /* public profiles view */
  ];

  /* ── Intentional write exception (enrollment record, koi action nahi) ── */
  var ALLOWED_INSERT_TABLES = ['early_access_users'];

  var BLOCK_CODE = 'PREVIEW_READ_ONLY';

  /* ════════════════ 1. Blocked-result builder ════════════════
     Supabase builders chainable + thenable hote hain. Yeh builder
     kisi bhi chain (.insert().select().eq().single()) ko safely
     absorb karta hai aur last me wahi {data:null,error} resolve
     karta hai jo ek normal failed call deta — isliye caller code
     kabhi crash nahi hota. */
  function _blockedBuilder(reason) {
    var result = {
      data: null,
      error: { message: reason || 'preview_mode_read_only', code: BLOCK_CODE, details: null, hint: null },
      count: null, status: 403, statusText: 'PREVIEW_READ_ONLY'
    };
    var proxy;
    var passthrough = function () { return proxy; };
    proxy = new Proxy(function () {}, {
      get: function (_t, prop) {
        if (prop === 'then') return function (onF, onR) { return Promise.resolve(result).then(onF, onR); };
        if (prop === 'catch') return function (onR) { return Promise.resolve(result).catch(onR); };
        if (prop === 'finally') return function (onFi) { return Promise.resolve(result).finally(onFi); };
        if (prop === 'data') return result.data;
        if (prop === 'error') return result.error;
        if (prop === 'count') return result.count;
        if (prop === 'status') return result.status;
        return passthrough;
      },
      apply: function () { return proxy; }
    });
    return proxy;
  }

  function _note(fnLabel) {
    window._previewMode.lastBlocked = { fn: fnLabel, at: Date.now() };
    _flashPreview(fnLabel);
  }

  /* ════════════════ 2. Client write-lock ════════════════ */
  function _lockFrom(client) {
    if (!client || client.__pvFromLocked || typeof client.from !== 'function') return client;
    try { client.__pvFromLocked = true; } catch (e) { return client; }

    var origFrom = client.from.bind(client);
    client.from = function (table) {
      var q = origFrom(table);
      if (!q) return q;
      ['insert', 'update', 'delete', 'upsert'].forEach(function (m) {
        var orig = (typeof q[m] === 'function') ? q[m].bind(q) : null;
        if (!orig) return;
        q[m] = function () {
          if (!_previewActive) return orig.apply(null, arguments);
          if (m === 'insert' && ALLOWED_INSERT_TABLES.indexOf(table) !== -1) return orig.apply(null, arguments);
          _note(m + ':' + table);
          return _blockedBuilder('preview_mode_read_only:' + m + ':' + table);
        };
      });
      return q;
    };
    return client;
  }

  function _lockRpc(client) {
    if (!client || client.__pvRpcLocked || typeof client.rpc !== 'function') return client;
    try { client.__pvRpcLocked = true; } catch (e) { return client; }
    var origRpc = client.rpc.bind(client);
    client.rpc = function (fn) {
      if (_previewActive && READ_ONLY_RPC.indexOf(fn) === -1) {
        _note('rpc:' + fn);
        return _blockedBuilder('preview_mode_read_only:rpc:' + fn);
      }
      return origRpc.apply(null, arguments);
    };
    return client;
  }

  function _lockStorage(client) {
    if (!client || client.__pvStorageLocked || !client.storage || typeof client.storage.from !== 'function') return client;
    try { client.__pvStorageLocked = true; } catch (e) { return client; }
    var origStorageFrom = client.storage.from.bind(client.storage);
    client.storage.from = function (bucket) {
      var b = origStorageFrom(bucket);
      ['upload', 'uploadToSignedUrl', 'remove', 'move', 'copy', 'update', 'createSignedUploadUrl', 'createSignedUrl'].forEach(function (m) {
        var orig = (b && typeof b[m] === 'function') ? b[m].bind(b) : null;
        if (!orig) return;
        b[m] = function () {
          if (!_previewActive) return orig.apply(null, arguments);
          _note('storage.' + m + ':' + bucket);
          return _blockedBuilder('preview_mode_read_only:storage:' + m);
        };
      });
      return b;
    };
    return client;
  }

  function _lockFunctions(client) {
    if (!client || client.__pvFnLocked || !client.functions || typeof client.functions.invoke !== 'function') return client;
    try { client.__pvFnLocked = true; } catch (e) { return client; }
    var origInvoke = client.functions.invoke.bind(client.functions);
    client.functions.invoke = function (name) {
      if (_previewActive) {
        /* preview me koi edge-function call nahi: payment (paytm-*),
           upload (imgbb), push registration, admin gateway — sab actions */
        _note('functions.invoke:' + name);
        return _blockedBuilder('preview_mode_read_only:invoke:' + name);
      }
      return origInvoke.apply(null, arguments);
    };
    return client;
  }

  function _lockAuth(client) {
    if (!client || client.__pvAuthLocked || !client.auth || typeof client.auth.updateUser !== 'function') return client;
    try { client.__pvAuthLocked = true; } catch (e) { return client; }
    var orig = client.auth.updateUser.bind(client.auth);
    client.auth.updateUser = function () {
      if (_previewActive) {
        _note('auth.updateUser');
        return Promise.resolve({ data: { user: null }, error: { message: 'preview_mode_read_only:auth', code: BLOCK_CODE } });
      }
      return orig.apply(null, arguments);
    };
    return client;
  }

  function wrapClient(client) {
    if (!client) return client;
    _lockFrom(client);
    _lockRpc(client);
    _lockStorage(client);
    _lockFunctions(client);
    _lockAuth(client);
    return client;
  }
  window._previewWrapClient = wrapClient;   /* debug/testing hook */

  /* Factory patch — core/db.js jahan bhi naya client banaye, lock laga rahe */
  function patchFactory() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return false;
    if (window.supabase.createClient.__pvPatched) return true;
    var orig = window.supabase.createClient;
    var patched = function () {
      var c = orig.apply(this, arguments);
      try { return wrapClient(c); } catch (e) { return c; }
    };
    patched.__pvPatched = true;
    patched.__orig = orig;
    window.supabase.createClient = patched;
    return true;
  }

  function armLock() {
    patchFactory();
    if (window._supa) window._supa = wrapClient(window._supa);
    if (!window._pvLockInterval) {
      window._pvLockInterval = setInterval(function () {
        if (!_previewActive) return;           /* idle par kuch nahi karta */
        patchFactory();
        if (window._supa && !window._supa.__pvFromLocked) window._supa = wrapClient(window._supa);
      }, 4000);
    }
  }

  /* ════════════════ 3. Toast UX ════════════════ */
  var _flashTimer = null;
  function _flashPreview(fnLabel) {
    if (_flashTimer) return;
    _flashTimer = setTimeout(function () { _flashTimer = null; }, 1800);

    var old = document.getElementById('_pvToast');
    if (old) old.remove();

    var actionTxt = '';
    if (fnLabel) {
      var map = {
        'rpc:validate_and_join_match': 'Match join', 'rpc:join_clan': 'Clan join',
        'rpc:leave_clan': 'Clan leave', 'rpc:cast_poll_vote': 'Vote', 'rpc:redeem_voucher': 'Voucher redeem',
        'rpc:claim_ad_reward': 'Ad reward', 'rpc:check_in_match': 'Check-in',
        'rpc:submit_age_verification': 'Verification submit', 'rpc:start_free_trial': 'Free trial',
        'rpc:contribute_to_squad_bank': 'Squad bank', 'rpc:purchase_cosmetic': 'Purchase'
      };
      actionTxt = map[fnLabel] || '';
      if (!actionTxt) {
        if (/^rpc:/.test(fnLabel)) actionTxt = 'Ye feature';
        else if (/^insert:|^update:|^delete:|^upsert:/.test(fnLabel)) actionTxt = 'Ye action';
        else if (/^storage\./.test(fnLabel)) actionTxt = 'Upload';
        else if (/^functions\.invoke:/.test(fnLabel)) actionTxt = 'Payment / upload';
        else if (/^auth\./.test(fnLabel)) actionTxt = 'Profile update';
      }
    }

    var toast = document.createElement('div');
    toast.id = '_pvToast';
    toast.style.cssText = [
      'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);',
      'background:linear-gradient(135deg,rgba(17,17,24,.97),rgba(26,26,40,.97));',
      'border:1px solid rgba(0,255,156,.35);border-radius:16px;',
      'padding:12px 18px;display:flex;align-items:center;gap:11px;',
      'z-index:99990;animation:pvToastIn .3s cubic-bezier(.2,.9,.3,1.2);',
      'box-shadow:0 10px 40px rgba(0,0,0,.65),0 0 0 1px rgba(0,255,156,.06);',
      'max-width:330px;width:90%;backdrop-filter:blur(8px)'
    ].join('');

    toast.innerHTML = [
      '<div style="width:38px;height:38px;border-radius:12px;flex-shrink:0;',
        'background:linear-gradient(135deg,rgba(0,255,156,.16),rgba(0,212,255,.12));',
        'border:1px solid rgba(0,255,156,.28);display:flex;align-items:center;',
        'justify-content:center;font-size:19px">👀</div>',
      '<div style="min-width:0">',
        '<div style="font-size:12.5px;font-weight:900;color:#fff;letter-spacing:.2px">Preview Mode — View Only</div>',
        '<div style="font-size:11px;color:#9aa0b4;margin-top:3px;line-height:1.45">',
          (actionTxt ? actionTxt + ' launch ke baad unlock hoga. ' : '') + 'Abhi aap sab kuch dekh sakte ho — sirf actions band hain. 🚀',
        '</div>',
      '</div>'
    ].join('');

    if (!document.getElementById('_pvStyle')) {
      var s = document.createElement('style');
      s.id = '_pvStyle';
      s.textContent = '@keyframes pvToastIn{from{opacity:0;transform:translateX(-50%) translateY(12px) scale(.96)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}@keyframes pvToastOut{from{opacity:1}to{opacity:0;transform:translateX(-50%) translateY(12px) scale(.98)}}';
      document.head.appendChild(s);
    }

    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) {
        toast.style.animation = 'pvToastOut .3s ease forwards';
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
      }
    }, 2400);
  }

  /* ════════════════ 4. DOM layer — click / submit / file-change ════════════════ */
  function showPreviewBlock(e) {
    if (!_previewActive) return;
    var target = e ? (e.target || e.srcElement) : null;
    if (target) {
      /* Allow nav tabs, filters, scroll, share */
      var allowEl = target.closest('.nav-item') || target.closest('[data-nav]') ||
                    target.closest('.hdr-bell') || target.closest('.status-tabs') ||
                    target.closest('.c-pill') || target.closest('.sp-toggle') ||
                    target.closest('.mode-filter') || target.closest('.tab-btn') ||
                    target.closest('.filter-tab') || target.closest('#_pvShareBtn') ||
                    target.closest('.ticker-wrap') || target.closest('#maintOverlay');
      if (allowEl) return;

      var tag = (target.tagName || '').toLowerCase();
      var isFileInput = tag === 'input' && (target.type || '').toLowerCase() === 'file';
      var shouldBlock = (
        tag === 'button' || isFileInput || tag === 'textarea' || tag === 'select' ||
        (tag === 'input' && (target.type || '').toLowerCase() !== 'search') ||
        target.getAttribute('onclick') || target.closest('button')
      );
      if (!shouldBlock) return;
    }
    e && e.preventDefault && e.preventDefault();
    e && e.stopPropagation && e.stopPropagation();
    _flashPreview(null);
    return false;
  }
  window._previewBlockHandler = showPreviewBlock;

  var _blockHandler = null;
  function enableBlock() {
    if (!_blockHandler) {
      _blockHandler = function (e) { showPreviewBlock(e); };
      document.addEventListener('click', _blockHandler, true);
      document.addEventListener('submit', _blockHandler, true);
      document.addEventListener('change', function (e) {
        var t = e && e.target;
        if (!_previewActive || !t) return;
        if ((t.tagName || '').toLowerCase() === 'input' && (t.type || '').toLowerCase() === 'file') {
          e.preventDefault(); e.stopPropagation(); _flashPreview('storage.upload');
        }
      }, true);
    }
  }
  function disableBlock() {
    if (_blockHandler) {
      document.removeEventListener('click', _blockHandler, true);
      document.removeEventListener('submit', _blockHandler, true);
      _blockHandler = null;
    }
    var t = document.getElementById('_pvToast');
    if (t) t.remove();
  }

  /* ── Ticker mein preview text inject karo ── */
  function injectTickerPreview(cfg) {
    var tickerWrap = document.querySelector('.ticker-wrap');
    var tickerTxt  = document.getElementById('tickerTxt');
    if (!tickerWrap) return;

    if (tickerTxt) tickerTxt.style.display = 'none';
    if (document.getElementById('_pvTickerRow')) return;

    var launchText = (cfg && cfg.launchDate) ? ' · Launch: ' + cfg.launchDate : '';

    tickerWrap.style.cssText = [
      'overflow:hidden;padding:5px 14px 6px;',
      'display:flex;align-items:center;justify-content:space-between;',
      'background:linear-gradient(135deg,rgba(0,255,156,.07),rgba(0,212,255,.04));',
      'border-bottom:1px solid rgba(0,255,156,.15);',
      'position:relative;'
    ].join('');

    var row = document.createElement('div');
    row.id = '_pvTickerRow';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;overflow:hidden';

    var dot = document.createElement('div');
    dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#00ff9c;flex-shrink:0;animation:pvBlink 1.5s infinite';

    var txt = document.createElement('span');
    txt.style.cssText = [
      'flex:1;overflow:hidden;white-space:nowrap;',
      'font-size:12px;font-weight:700;',
      'background:linear-gradient(90deg,#00ff9c,#00d4ff,#b964ff,#ffd700,#00ff9c);',
      'background-size:300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;',
      'background-clip:text;animation:tickerShine 4s linear infinite,pvScroll 18s linear infinite;',
      'display:inline-block;padding-left:100%'
    ].join('');
    txt.textContent = '👀 Preview Mode — View Only' + launchText + '  •  Sab kuch dekho, actions launch ke baad unlock honge  •  🪙 Coins + rewards  •  🏆 Free Fire Tournaments';

    var shareBtn = document.createElement('button');
    shareBtn.id = '_pvShareBtn';
    shareBtn.onclick = window._pvShare;
    shareBtn.style.cssText = [
      'flex-shrink:0;padding:3px 10px;border-radius:7px;',
      'background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.3);',
      'color:#00d4ff;font-size:10px;font-weight:800;cursor:pointer;',
      'white-space:nowrap;margin-left:8px'
    ].join('');
    shareBtn.innerHTML = '📤 Share';

    if (!document.getElementById('_pvAnimStyle')) {
      var as = document.createElement('style');
      as.id = '_pvAnimStyle';
      as.textContent = [
        '@keyframes pvBlink{0%,100%{opacity:1}50%{opacity:.25}}',
        '@keyframes pvScroll{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}',
        '@keyframes tickerShine{0%{background-position:0% 50%}100%{background-position:300% 50%}}'
      ].join('');
      document.head.appendChild(as);
    }

    row.appendChild(dot);
    row.appendChild(txt);
    row.appendChild(shareBtn);
    tickerWrap.appendChild(row);
  }

  function removeTickerPreview() {
    var row = document.getElementById('_pvTickerRow');
    if (row) row.remove();
    var tickerTxt = document.getElementById('tickerTxt');
    if (tickerTxt) tickerTxt.style.display = '';
    var tickerWrap = document.querySelector('.ticker-wrap');
    if (tickerWrap) tickerWrap.style.cssText = '';
  }

  /* Share */
  window._pvShare = function () {
    var ud = window.UD || {}; var U = window.U;
    var code = ud.referralCode || (U ? U.uid.substring(0, 8).toUpperCase() : '');
    var url  = window.location.href;
    var msg  = '🎮 Mini eSports is launching soon!\n\n🏆 Skill-based Free Fire Tournaments\n🪙 Free coins + 💎 diamonds rewards · 🏅 Live Leaderboards\n\n📲 Join Early:\n' + url +
               (code ? '\n\n🎁 Referral Code: *' + code + '*' : '');
    if (navigator.share) {
      navigator.share({ title: 'Mini eSports — Coming Soon', text: msg }).catch(function () {
        window.openWhatsApp ? window.openWhatsApp(msg) : (window.location.href = 'https://wa.me/?text=' + encodeURIComponent(msg));
      });
    } else {
      window.openWhatsApp ? window.openWhatsApp(msg) : (window.location.href = 'https://wa.me/?text=' + encodeURIComponent(msg));
    }
  };

  /* ════════════════ 5. Config apply (Supabase app_settings.preview_mode) ════════════════ */
  function applyPreviewCfg(cfg) {
    cfg = cfg || {};
    var wasActive = _previewActive;
    _previewActive = cfg.active === true;

    if (_previewActive) {
      if (!wasActive) {
        var tryInject = function (n) {
          if (document.querySelector('.ticker-wrap')) {
            injectTickerPreview(cfg);
            enableBlock();
            armLock();                       /* ← asli write-lock */
            if (window.U && window._supa) {
              /* R29D FIX (2026-09-22): INSERT-only enrollment (upsert ko
                 UPDATE privilege chahiye tha jo is table par nahi hai).
                 v6 me yeh insert allowed list me hai — preview enrollment
                 ek metadata record hai, user action nahi. */
              window._supa.from('early_access_users').insert({
                user_id: window.U.uid,
                name: (window.UD || {}).displayName || (window.UD || {}).ign || '',
                joined_at: new Date().toISOString(),
                platform: /Android/.test(navigator.userAgent) ? 'android' : 'web'
              }, { onConflict: 'user_id', ignoreDuplicates: true }).then(null, function (e) { console.warn('[PreviewMode] early_access_users insert failed:', e && e.message); });
            }
          } else if (n < 20) {
            setTimeout(function () { tryInject(n + 1); }, 300);
          }
        };
        tryInject(0);
      } else {
        armLock();                           /* already active — lock re-arm (new client instance ho sakta hai) */
      }
    } else {
      if (wasActive) {
        removeTickerPreview();
        disableBlock();
      }
    }
  }
  window.applyPreviewCfg = applyPreviewCfg;

  function checkPreviewMode() {
    if (!window._supa) { setTimeout(checkPreviewMode, 800); return; }

    window._supa.from('app_settings').select('value').eq('key', 'preview_mode').maybeSingle()
      .then(function (res) {
        if (res.error) { console.error('[PreviewMode] read failed:', res.error.message); return; }
        applyPreviewCfg(res.data && res.data.value);
      });

    if (!window._pvModePollTimer) {
      window._pvModePollTimer = setInterval(function () {
        window._supa.from('app_settings').select('value').eq('key', 'preview_mode').maybeSingle()
          .then(function (res) { if (!res.error) applyPreviewCfg(res.data && res.data.value); });
      }, 25000);
    }
  }

  /* Hook into boot */
  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.boot) {
      clearInterval(_iv);
      var _ob = window.boot;
      window.boot = function () {
        _ob.apply(this, arguments);
        setTimeout(checkPreviewMode, 600);
      };
    }
    if (_t > 40) { clearInterval(_iv); checkPreviewMode(); }
  }, 300);

  /* Ticker animation resume (M6/L1 fixes preserved) */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    var txt = document.querySelector('#_pvTickerRow span, .ticker-preview-txt');
    if (!txt) return;
    txt.style.animation = 'none';
    void txt.offsetWidth;
    txt.style.animation = '';
  });

  window._previewMode = {
    check: checkPreviewMode,
    isActive: function () { return _previewActive; },
    lastBlocked: null,
    readOnlyRpcs: READ_ONLY_RPC.slice(),
    wrapClient: wrapClient
  };

  /* Boot ke turant baad factory patch lagao (client create hone se pehle
     ho sakta hai ya baad me — dono case interval cover karta hai). */
  patchFactory();

  console.log('[Mini eSports] ✅ Preview Mode v6.0 — strict view-only (client write-lock + DOM guards)');
})();
