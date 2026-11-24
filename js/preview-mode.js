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

  /* SupabaseClient.functions ek GETTER hai (supabase-js v2):
       get functions() { return new FunctionsClient(this.functionsUrl.href, {...}) }
     Matlab har `client.functions` access par ek NAYA FunctionsClient milta hai — isliye
     instance par invoke patch karne se asli call bach jaati thi (live test me pakda gaya:
     functions.invoke server tak pahunch raha tha, "Edge Function returned a non-2xx").
     Ab: prototype ka getter hi wrap hota hai, aur jo client wapas milta hai uspar invoke
     lock lagta hai; instance par bhi ek shadow getter define karte hain (belt & braces). */
  function _lockFunctionsProto(client) {
    try {
      var proto = Object.getPrototypeOf(client);
      if (!proto || proto.__pvFnProto) return;
      var desc = Object.getOwnPropertyDescriptor(proto, 'functions');
      if (!desc || typeof desc.get !== 'function') return;
      proto.__pvFnProto = true;
      var origGet = desc.get;
      Object.defineProperty(proto, 'functions', {
        configurable: true,
        get: function () {
          var real = origGet.call(this);
          if (!real || real.__pvInvokeLocked || typeof real.invoke !== 'function') return real;
          try {
            real.__pvInvokeLocked = true;
            var origInvoke = real.invoke.bind(real);
            real.invoke = function (name) {
              if (_previewActive) {
                /* preview me koi edge-function call nahi: payment (paytm-*),
                   upload (imgbb), push registration, admin gateway — sab actions */
                _note('functions.invoke:' + name);
                return _blockedBuilder('preview_mode_read_only:invoke:' + name);
              }
              return origInvoke.apply(null, arguments);
            };
          } catch (e) {}
          return real;
        }
      });
    } catch (e) {}
  }

  function _lockFunctions(client) {
    if (!client || client.__pvFnLocked) return client;
    _lockFunctionsProto(client);
    var fns = null;
    try { fns = client.functions; } catch (e) { return client; }
    if (!fns || typeof fns.invoke !== 'function') return client;
    try {
      client.__pvFnLocked = true;
      if (!fns.__pvInvokeLocked) {
        fns.__pvInvokeLocked = true;
        var origInvoke = fns.invoke.bind(fns);
        fns.invoke = function (name) {
          if (_previewActive) {
            _note('functions.invoke:' + name);
            return _blockedBuilder('preview_mode_read_only:invoke:' + name);
          }
          return origInvoke.apply(null, arguments);
        };
      }
      /* getter ko instance par shadow karo — har access par wahi locked instance mile */
      Object.defineProperty(client, 'functions', { configurable: true, get: function () { return fns; } });
    } catch (e) {}
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

  /* ════════════════ 3. Toast UX — REDESIGN v6.2 (2026-09-27) ════════════════
   Pehle wala toast ek flat dark card tha. Ab: glass card + gradient border ring +
   pulsing icon + "PREVIEW MODE" chip + auto-dismiss progress bar. Text same rehta
   hai (title me "Preview Mode — View Only" — test/compat ke liye). */
  var _flashTimer = null;
  function _pvUIStyle() {
    if (document.getElementById('_pvStyle')) return;
    var s = document.createElement('style');
    s.id = '_pvStyle';
    s.textContent = [
      /* toast shell */
      '#_pvToast{position:fixed;bottom:calc(88px + env(safe-area-inset-bottom,0px));left:50%;',
        'transform:translateX(-50%);width:min(360px,calc(100vw - 26px));z-index:99990;',
        'font-family:inherit;-webkit-tap-highlight-color:transparent;pointer-events:none;',
        'animation:pvToastIn .34s cubic-bezier(.2,.9,.3,1.15) both}',
      '#_pvToast .pv-card{position:relative;display:flex;gap:12px;align-items:flex-start;',
        'padding:13px 15px 14px;border-radius:18px;overflow:hidden;',
        'background:linear-gradient(150deg,rgba(20,24,38,.94),rgba(10,12,22,.96));',
        'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'box-shadow:0 18px 50px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06)}',
      /* gradient border ring */
      '#_pvToast .pv-card:before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.4px;',
        'background:conic-gradient(from 140deg,rgba(0,255,156,.85),rgba(0,212,255,.75),rgba(185,100,255,.7),rgba(255,215,0,.75),rgba(0,255,156,.85));',
        '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;',
        'mask-composite:exclude;opacity:.85;animation:pvSpin 6s linear infinite}',
      /* glow sweep */
      '#_pvToast .pv-glow{position:absolute;inset:-40% -60%;background:radial-gradient(closest-side,rgba(0,255,156,.16),transparent 70%);',
        'animation:pvBreathe 3.2s ease-in-out infinite;pointer-events:none}',
      /* icon */
      '#_pvToast .pv-ico{position:relative;flex-shrink:0;width:42px;height:42px;border-radius:14px;',
        'display:flex;align-items:center;justify-content:center;font-size:20px;',
        'background:linear-gradient(150deg,rgba(0,255,156,.18),rgba(0,212,255,.12));',
        'border:1px solid rgba(0,255,156,.3);box-shadow:0 0 0 0 rgba(0,255,156,.28);',
        'animation:pvPulse 2.1s ease-out infinite}',
      /* text */
      '#_pvToast .pv-body{min-width:0;flex:1}',
      '#_pvToast .pv-chip{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;',
        'background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.26);color:#8effcf;',
        'font-size:8.5px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:5px}',
      '#_pvToast .pv-chip i{width:5px;height:5px;border-radius:50%;background:#00ff9c;box-shadow:0 0 6px #00ff9c;animation:pvBlink 1.4s infinite}',
      '#_pvToast .pv-title{font-size:13px;font-weight:900;color:#fff;letter-spacing:.2px;line-height:1.25}',
      '#_pvToast .pv-msg{font-size:11.5px;color:#9aa0b4;margin-top:4px;line-height:1.5}',
      '#_pvToast .pv-msg b{color:#dfe6ff;font-weight:800}',
      /* auto-dismiss bar */
      '#_pvToast .pv-bar{position:absolute;left:0;right:0;bottom:0;height:2.5px;background:rgba(255,255,255,.06);overflow:hidden;border-radius:0 0 18px 18px}',
      '#_pvToast .pv-bar span{display:block;height:100%;width:100%;transform-origin:left;',
        'background:linear-gradient(90deg,#00ff9c,#00d4ff);animation:pvDrain 2.6s linear forwards}',
      /* keyframes */
      '@keyframes pvToastIn{from{opacity:0;transform:translateX(-50%) translateY(16px) scale(.94)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}',
      '@keyframes pvToastOut{from{opacity:1}to{opacity:0;transform:translateX(-50%) translateY(10px) scale(.97)}}',
      '@keyframes pvSpin{to{transform:rotate(360deg)}}',
      '@keyframes pvBreathe{0%,100%{opacity:.5}50%{opacity:1}}',
      '@keyframes pvPulse{0%{box-shadow:0 0 0 0 rgba(0,255,156,.3)}70%{box-shadow:0 0 0 12px rgba(0,255,156,0)}100%{box-shadow:0 0 0 0 rgba(0,255,156,0)}}',
      '@keyframes pvDrain{from{transform:scaleX(1)}to{transform:scaleX(0)}}',
      '@keyframes pvBlink{0%,100%{opacity:1}50%{opacity:.25}}',
      /* ticker */
      '@keyframes pvScroll{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}',
      '@keyframes pvShine{0%{background-position:0% 50%}100%{background-position:300% 50%}}',
      /* view-only join buttons (home cards) */
      '.mc-join.join-vo{background:linear-gradient(135deg,rgba(255,255,255,.09),rgba(255,255,255,.03))!important;',
        'color:#c8d2ee!important;border:1px dashed rgba(255,255,255,.3)!important;letter-spacing:.4px;',
        'display:flex;align-items:center;justify-content:center;gap:6px;opacity:1!important}',
      '.mc-join.join-vo:before{content:"🔒";font-size:12px}',
      '@media (prefers-reduced-motion: reduce){#_pvToast *,#_pvToast{animation:none!important}}'
    ].join('');
    document.head.appendChild(s);
  }

  function _flashPreview(fnLabel) {
    if (_flashTimer) return;
    _flashTimer = setTimeout(function () { _flashTimer = null; }, 2000);

    var old = document.getElementById('_pvToast');
    if (old) old.remove();

    var actionTxt = '';
    if (fnLabel) {
      var map = {
        'rpc:validate_and_join_match': 'Match join', 'rpc:join_clan': 'Clan join',
        'rpc:leave_clan': 'Clan leave', 'rpc:cast_poll_vote': 'Vote', 'rpc:redeem_voucher': 'Voucher redeem',
        'rpc:claim_ad_reward': 'Ad reward',   /* ✅ B30: check-in hata — uski entry bhi gayi */
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

    _pvUIStyle();

    var toast = document.createElement('div');
    toast.id = '_pvToast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = [
      '<div class="pv-card">',
        '<div class="pv-glow"></div>',
        '<div class="pv-ico">👀</div>',
        '<div class="pv-body">',
          '<div class="pv-chip"><i></i> Preview</div>',
          '<div class="pv-title">Preview Mode — View Only</div>',
          '<div class="pv-msg">',
            (actionTxt ? '<b>' + actionTxt + '</b> launch ke baad unlock hoga. ' : '') +
            'Abhi aap sab kuch dekh sakte ho — sirf actions band hain. 🚀',
          '</div>',
        '</div>',
        '<div class="pv-bar"><span></span></div>',
      '</div>'
    ].join('');
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) {
        toast.style.animation = 'pvToastOut .3s ease forwards';
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
      }
    }, 2600);
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
      /* Reload/retry jaise app-level screens (maintenance overlay) aur apna
         toast preview mode me bhi kaam karte rahenge — warna maintenance ke
         "Abhi Check Karo" / Support buttons preview ke saath chalta nahi. */
      if (target.closest && target.closest('#maintOverlay')) return;
      var shouldBlock = (
        tag === 'button' || isFileInput || tag === 'textarea' || tag === 'select' ||
        (tag === 'input' && (target.type || '').toLowerCase() !== 'search') ||
        target.getAttribute('onclick') || target.closest('button') ||
        target.closest('.btn, [role="button"], .nav-item, .tab, [data-action]')
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

  /* ── Ticker (REDESIGN v6.2): glass strip + icon chip + marquee + LIVE chip ── */
  function injectTickerPreview(cfg) {
    var tickerWrap = document.querySelector('.ticker-wrap');
    var tickerTxt  = document.getElementById('tickerTxt');
    if (!tickerWrap) return;

    if (tickerTxt) tickerTxt.style.display = 'none';
    if (document.getElementById('_pvTickerRow')) return;

    _pvUIStyle();
    var launchText = (cfg && cfg.launchDate) ? ' · 🚀 Launch: ' + cfg.launchDate : '';

    tickerWrap.style.cssText = [
      'overflow:hidden;padding:0;position:relative;',
      'background:linear-gradient(120deg,rgba(0,255,156,.10),rgba(0,212,255,.07) 45%,rgba(185,100,255,.09));',
      'border-bottom:1px solid rgba(0,255,156,.2);',
      'box-shadow:0 6px 20px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05)'
    ].join('');

    var row = document.createElement('div');
    row.id = '_pvTickerRow';
    row.style.cssText = 'display:flex;align-items:center;gap:9px;width:100%;padding:7px 12px 8px;position:relative;overflow:hidden';

    var chip = document.createElement('div');
    chip.style.cssText = [
      'flex-shrink:0;width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;',
      'background:linear-gradient(150deg,rgba(0,255,156,.22),rgba(0,212,255,.14));border:1px solid rgba(0,255,156,.34);',
      'box-shadow:0 0 14px rgba(0,255,156,.18)'
    ].join('');
    chip.textContent = '👀';

    /* marquee viewport */
    var vp = document.createElement('div');
    vp.style.cssText = 'flex:1;min-width:0;overflow:hidden;position:relative';
    var txt = document.createElement('span');
    txt.style.cssText = [
      'display:inline-block;white-space:nowrap;padding-left:100%;font-size:12px;font-weight:800;letter-spacing:.2px;',
      'background:linear-gradient(90deg,#00ff9c,#00d4ff,#b964ff,#ffd700,#00ff9c);',
      'background-size:300%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;',
      'animation:pvShine 5s linear infinite,pvScroll 19s linear infinite'
    ].join('');
    txt.textContent = 'Preview Mode — View Only' + launchText +
      '  •  Sab kuch dekho, actions launch ke baad unlock honge  •  🪙 Coins + rewards  •  🏆 Free Fire Tournaments  •  👥 Teams & Leaderboards';

    /* LIVE chip */
    var live = document.createElement('div');
    live.style.cssText = [
      'flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;',
      'background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);color:#dfe6ff;',
      'font-size:8.5px;font-weight:900;letter-spacing:1.2px'
    ].join('');
    live.innerHTML = '<i style="width:5px;height:5px;border-radius:50%;background:#00ff9c;box-shadow:0 0 7px #00ff9c;display:inline-block;animation:pvBlink 1.4s infinite"></i>LIVE PREVIEW';

    var shareBtn = document.createElement('button');
    shareBtn.id = '_pvShareBtn';
    shareBtn.onclick = window._pvShare;
    shareBtn.style.cssText = [
      'flex-shrink:0;padding:4px 11px;border-radius:999px;cursor:pointer;font-family:inherit;',
      'background:linear-gradient(135deg,rgba(0,212,255,.2),rgba(0,255,156,.16));',
      'border:1px solid rgba(0,212,255,.38);color:#bfeaff;font-size:10.5px;font-weight:900;white-space:nowrap'
    ].join('');
    shareBtn.innerHTML = '📤 Share';

    vp.appendChild(txt);
    row.appendChild(chip);
    row.appendChild(vp);
    row.appendChild(live);
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
