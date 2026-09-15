/* ================================================================
   MINI eSPORTS — PREVIEW MODE v5.0
   - Koi alag banner NAHI — ticker mein hi preview text slide karta hai
   - Share button ticker ke andar right side pe
   - App normally run hota hai (view-only)
   - Actions pe "Coming Soon" toast
   ================================================================ */
(function () {
  'use strict';

  var _previewActive = false;

  /* ── Coming Soon toast ── */
  var _flashTimer = null;
  function _flashComingSoon() {
    if (_flashTimer) return;
    _flashTimer = setTimeout(function () { _flashTimer = null; }, 2000);

    var old = document.getElementById('_pvToast');
    if (old) old.remove();

    var toast = document.createElement('div');
    toast.id = '_pvToast';
    toast.style.cssText = [
      'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);',
      'background:linear-gradient(135deg,#111118,#1a1a28);',
      'border:1px solid rgba(0,255,156,.3);border-radius:16px;',
      'padding:12px 20px;display:flex;align-items:center;gap:10px;',
      'z-index:99990;animation:pvToastIn .3s ease;',
      'box-shadow:0 8px 32px rgba(0,0,0,.6);max-width:320px;width:90%'
    ].join('');

    toast.innerHTML = [
      '<div style="font-size:24px">🚀</div>',
      '<div>',
        '<div style="font-size:13px;font-weight:800;color:#fff">App Coming Soon!</div>',
        '<div style="font-size:11px;color:#888;margin-top:2px">Launch hone pe feature available hoga</div>',
      '</div>'
    ].join('');

    if (!document.getElementById('_pvStyle')) {
      var s = document.createElement('style');
      s.id = '_pvStyle';
      s.textContent = '@keyframes pvToastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes pvToastOut{from{opacity:1}to{opacity:0;transform:translateX(-50%) translateY(10px)}}';
      document.head.appendChild(s);
    }

    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) {
        toast.style.animation = 'pvToastOut .3s ease forwards';
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
      }
    }, 2200);
  }

  function showComingSoon(e) {
    if (!_previewActive) return;
    var target = e ? (e.target || e.srcElement) : null;
    if (target) {
      /* Allow nav tabs, filters, scroll */
      var allowEl = target.closest('.nav-item') || target.closest('[data-nav]') ||
                    target.closest('.hdr-bell') || target.closest('.status-tabs') ||
                    target.closest('.c-pill') || target.closest('.sp-toggle') ||
                    target.closest('.mode-filter') || target.closest('.tab-btn') ||
                    target.closest('.filter-tab') || target.closest('#_pvShareBtn') ||
                    target.closest('.ticker-wrap');
      if (allowEl) return;

      var tag = (target.tagName || '').toLowerCase();
      var shouldBlock = (
        tag === 'button' || tag === 'input' || tag === 'textarea' || tag === 'select' ||
        target.getAttribute('onclick') || target.closest('button')
      );
      if (!shouldBlock) return;
    }
    e && e.preventDefault && e.preventDefault();
    e && e.stopPropagation && e.stopPropagation();
    _flashComingSoon();
    return false;
  }

  /* ── Ticker mein preview text inject karo ── */
  function injectTickerPreview(cfg) {
    var tickerWrap = document.querySelector('.ticker-wrap');
    var tickerTxt  = document.getElementById('tickerTxt');
    if (!tickerWrap) return;

    /* Existing ticker span hide karo */
    if (tickerTxt) tickerTxt.style.display = 'none';

    /* Already injected? */
    if (document.getElementById('_pvTickerRow')) return;

    var launchText = (cfg && cfg.launchDate) ? ' · Launch: ' + cfg.launchDate : '';

    /* Style for ticker wrap */
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

    /* Blinking dot */
    var dot = document.createElement('div');
    dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#00ff9c;flex-shrink:0;animation:pvBlink 1.5s infinite';

    /* Scrolling text */
    var txt = document.createElement('span');
    txt.style.cssText = [
      'flex:1;overflow:hidden;white-space:nowrap;',
      'font-size:12px;font-weight:700;',
      'background:linear-gradient(90deg,#00ff9c,#00d4ff,#b964ff,#ffd700,#00ff9c);',
      'background-size:300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;',
      'background-clip:text;animation:tickerShine 4s linear infinite,pvScroll 18s linear infinite;',
      'display:inline-block;padding-left:100%'
    ].join('');
    txt.textContent = '🚀 Preview Mode — App Coming Soon' + launchText + '  •  Join karo aur tournament mein participate karo!  •  💰 Real cash prizes  •  🏆 Free Fire Tournaments';

    /* Share button */
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

    /* Restore original ticker */
    var tickerTxt = document.getElementById('tickerTxt');
    if (tickerTxt) tickerTxt.style.display = '';
    var tickerWrap = document.querySelector('.ticker-wrap');
    if (tickerWrap) tickerWrap.style.cssText = '';
  }

  /* ── Block action clicks ── */
  var _blockHandler = null;
  function enableBlock() {
    if (_blockHandler) return;
    _blockHandler = function (e) { showComingSoon(e); };
    document.addEventListener('click', _blockHandler, true);
  }
  function disableBlock() {
    if (_blockHandler) {
      document.removeEventListener('click', _blockHandler, true);
      _blockHandler = null;
    }
    var t = document.getElementById('_pvToast');
    if (t) t.remove();
  }

  /* Share */
  window._pvShare = function () {
    var ud = window.UD || {}; var U = window.U;
    var code = ud.referralCode || (U ? U.uid.substring(0, 8).toUpperCase() : '');
    var url  = window.location.href;
    var msg  = '🎮 Mini eSports is launching soon!\n\n🏆 Free Fire Tournaments · 💎 Real Cash Prizes\n⚡ Instant Payouts · 🏅 Live Leaderboards\n\n📲 Join Early:\n' + url +
               (code ? '\n\n🎁 Referral Code: *' + code + '*' : '');
    if (navigator.share) {
      navigator.share({ title: 'Mini eSports — Coming Soon', text: msg }).catch(function () {
        window.openWhatsApp ? window.openWhatsApp(msg) : (window.location.href = 'https://wa.me/?text=' + encodeURIComponent(msg));
      });
    } else {
      window.openWhatsApp ? window.openWhatsApp(msg) : (window.location.href = 'https://wa.me/?text=' + encodeURIComponent(msg));
    }
  };

  /* ── Live config source — Supabase app_settings, key='preview_mode' ── */
  /* ✅ FIX (2026-08-21): this was reading window.db.ref('appSettings/previewMode')
     — a Firebase RTDB path — while the Admin Panel's togglePreviewMode()
     had already been migrated (2026-08) to write Supabase app_settings
     with key='preview_mode' instead. The two were completely
     disconnected: admin toggled it on, wrote to Supabase, and this
     listener — still pointed at the old dead Firebase path — never saw
     the change, so Preview Mode never actually activated for users no
     matter what the admin did. Same fix pattern as checkMaintenance
     above: Supabase read + postgres_changes realtime subscription
     instead of the old Firebase .on('value'). */
  function checkPreviewMode() {
    if (!window._supa) { setTimeout(checkPreviewMode, 800); return; }

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
              if (window.U && window._supa) {
                window._supa.from('early_access_users').upsert({
                  user_id: window.U.uid,
                  name: (window.UD || {}).displayName || (window.UD || {}).ign || '',
                  joined_at: new Date().toISOString(),
                  platform: /Android/.test(navigator.userAgent) ? 'android' : 'web'
                }, { onConflict: 'user_id' }).then(null, function(e){ console.warn('[PreviewMode] early_access_users upsert failed:', e && e.message); });
              }
            } else if (n < 20) {
              setTimeout(function () { tryInject(n + 1); }, 300);
            }
          };
          tryInject(0);
        }
      } else {
        if (wasActive) {
          removeTickerPreview();
          disableBlock();
        }
      }
    }

    /* Initial read */
    window._supa.from('app_settings').select('value').eq('key', 'preview_mode').maybeSingle()
      .then(function (res) {
        if (res.error) { console.error('[PreviewMode] read failed:', res.error.message); return; }
        applyPreviewCfg(res.data && res.data.value);
      });

    /* Live updates — mirrors the old Firebase .on('value') behavior */
    window._supa.channel('app_settings_preview_mode_user')
      .on('postgres_changes', {event:'UPDATE', schema:'public', table:'app_settings', filter:'key=eq.preview_mode'}, function (payload) {
        applyPreviewCfg(payload.new && payload.new.value);
      }).subscribe();
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

  /* M6 Fix: Resume ticker animation when tab becomes visible again.
     CSS animation pauses on hidden tabs — force reflow to restart it.
     L1 Fix: Do NOT add a periodic setInterval restart (causes flicker).
     visibilitychange is the correct lightweight approach. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    var txt = document.querySelector('#_pvTickerRow span, .ticker-preview-txt');
    if (!txt) return;
    /* Force reflow to restart paused CSS animation */
    txt.style.animation = 'none';
    void txt.offsetWidth; // trigger reflow
    txt.style.animation = '';
  });

  window._previewMode = {
    check: checkPreviewMode,
    isActive: function () { return _previewActive; }
  };

  console.log('[Mini eSports] ✅ Preview Mode v5.1 — visibility-aware ticker, no flicker');
})();
