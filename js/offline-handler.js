/* ====== FEATURE 10: OFFLINE HANDLER (D94 rewrite, 08-Nov-2026) ======
   Owner complaint: "No connection — cached data dikh raha hai" banner
   hat hi nahi raha tha. Root cause: banner Firebase RTDB ke
   `.info connected` websocket se juda tha — app ka DATA Supabase par
   hai; Firebase WS agar carrier/WebView par block/atka to banner
   FOREVER raha (data sab normal phir bhi).
   Naya design (simple + sahi):
     • Startup par koi banner NAHI (pehle offline assume karna galat).
     • Offline sirf tab: browser bola offline (navigator.onLine/events)
       YA asli data-server (Supabase REST) probe FAIL hua (fetch throw).
     • Online hote hi (probe OK / 'online' event) banner turant hide —
       20s probe interval + instant event hooks.
     • Banner tap = manual re-probe (user control).
     • Firebase `.info connected` se koi dependency NAHI.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var _banner = null, _online = true, _lastFresh = Date.now(), _probeBusy = false;

  function _show(msg, color) {
    if (!_banner) {
      _banner = document.createElement('div');
      _banner.id = 'vnOfflineBanner';
      _banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;text-align:center;padding:8px 16px;font-size:12px;font-weight:700;color:#fff;transition:all .3s;cursor:pointer';
      _banner.onclick = function () { probe(true); };   // tap = dobara check
      document.body.prepend(_banner);
    }
    _banner.style.background = color || '#ff6600';
    _banner.textContent = msg;
    _banner.style.display = 'block';
    _banner.style.opacity = '1';
  }

  function _hide() {
    if (_banner) {
      _banner.style.opacity = '0';
      setTimeout(function () { if (_banner) _banner.style.display = 'none'; }, 300);
    }
  }

  function _setOffline() {
    if (!_online) return;
    _online = false;
    _show('📡 No connection — cached data dikh raha hai', '#e65c00');
  }
  function _setOnline() {
    var wasOffline = !_online;
    _online = true; _lastFresh = Date.now();
    _hide();
    if (wasOffline) {
      if (window.toast) toast('✅ Back online', 'ok');
      setTimeout(function () {
        if (window.renderHome) renderHome();
        if (window.renderMM) renderMM();
        if (window.renderWallet) renderWallet();
      }, 600);
    }
  }

  /* Asli data-connectivity probe: Supabase REST (app ka real data source).
     fetch THROW = network dead → offline. Resolve (SW cache se bhi) = app
     functional → online. Random nonce + no-store taaki browser cache na bole. */
  function probe(force) {
    if (_probeBusy && !force) return;
    _probeBusy = true;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      _probeBusy = false; _setOffline(); return;
    }
    var url = 'https://hddhkculuyrfoevxmlwy.supabase.co/rest/v1/app_settings?select=key&limit=1'; /* D97: np= nonce PostgREST filter-parse 400 deta tha — cache:'no-store' + Pragma kaafi hai */
    var done = false;
    var timer = setTimeout(function () {
      if (!done) { done = true; _probeBusy = false; }   // slow ≠ dead: banner mat dikhao
    }, 9000);
    try {
      fetch(url, { cache: 'no-store', credentials: 'omit', mode: 'cors', headers: Object.assign({ 'Pragma': 'no-cache' }, window._SUPA_ANON_KEY ? { apikey: window._SUPA_ANON_KEY } : {}) })
        .then(function () {
          if (done) return; done = true; clearTimeout(timer); _probeBusy = false;
          _setOnline();
        })
        .catch(function () {
          if (done) return; done = true; clearTimeout(timer); _probeBusy = false;
          _setOffline();
        });
    } catch (e) {
      done = true; clearTimeout(timer); _probeBusy = false;
      _setOffline();
    }
  }

  /* Browser-level events = instant reaction */
  window.addEventListener('offline', function () { _setOffline(); });
  window.addEventListener('online', function () { probe(true); });

  /* Boot: online assume (koi banner nahi), phir probe se confirm */
  _online = (typeof navigator === 'undefined') ? true : navigator.onLine !== false;
  if (!_online) _setOffline();
  setTimeout(function () { probe(true); }, 2500);
  setInterval(function () { probe(false); }, 20000);

  /* Stale data warning (purana behaviour, ab probe-se-fresh ke saath) */
  setInterval(function () {
    if (_online && Date.now() - _lastFresh > 300000) {
      _show('⚠️ Data purana ho sakta hai — refresh kar raha hai...', '#885500');
      if (window.renderHome) renderHome();
      _lastFresh = Date.now();
      setTimeout(_hide, 3000);
    }
  }, 120000);

  window._markDataFresh = function () { _lastFresh = Date.now(); };
  window._offlineProbe = probe;   /* test hook */
  console.log('[Mini eSports] ✅ Feature 10: Offline Handler v2 (Supabase-probe) loaded');
})();
