/* ====== FEATURE 1: LIVE COUNTDOWN TIMER ON MATCH CARDS ====== */
/* Shows real-time countdown on every match card, updates every second */

/* Bug 68 Fix: _timerInterval exposed as window._timerInterval so renderHome()
   can check !window._timerInterval before calling startMatchTimers() again.
   Without this, every renderHome() call creates a NEW interval → multiple intervals
   run simultaneously (effectively running "twice per second" or more). */

/* ══════════════════════════════════════════════════════════════════════
   ✅ FIX (2026-10-06) — "match start wali counting smooth nahi hai, baar
   baar UI kharab karti hai"
   ──────────────────────────────────────────────────────────────────────
   असली वजहें (live code-reading se siddh):
     1. हर सेकंड `el.innerHTML = '<span …>🔴 LIVE</span>'` दोबारा लिखा जाता था
        → span नया बनता, उसकी CSS animation हर सेकंड शुरू से चलती → चमकना/
        झटका (flicker) — यही "UI kharab karti hai" वाला असर था।
     2. `el.style.color/fontWeight/animation` हर tick पर सेट होते थे — भले
        value वही हो — जिससे बेवजह style-recalc + repaint होता था।
     3. जब text बदलता (मसलन "5m 9s" → "5m 8s") तो digits की चौड़ाई बदलने से
        पूरा row hilti थी (layout shift).

   अब:
     • text सिर्फ़ तभी लिखा जाता है जब वह असल में बदला हो (change-guard)।
     • innerHTML कभी नहीं — हमेशा textContent (+ class से animation)।
     • style सिर्फ़ state बदलने पर लगते हैं (हर सेकंड नहीं)।
     • font-variant-numeric: tabular-nums + min-width → digits की चौड़ाई fix,
       इसलिए कोई layout shift नहीं।
   ══════════════════════════════════════════════════════════════════════ */

(function() {
  var _timerInterval = null;

  /* एक बार का CSS — digits की चौड़ाई स्थिर + LIVE बैज की animation CSS से */
  (function injectTimerCss() {
    if (document.getElementById('_mtTimerCss')) return;
    var s = document.createElement('style');
    s.id = '_mtTimerCss';
    s.textContent =
      '[id^="timer-"]{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";min-width:74px;display:inline-block;text-align:center;transition:color .2s ease}' +
      '[id^="timer-"].mt-live{color:#ff003c;animation:pulse 1.2s infinite}' +
      '[id^="timer-"].mt-soon{color:#ff003c;font-weight:900;animation:pulse .5s infinite}' +
      '[id^="timer-"].mt-warn{color:#ffaa00}' +
      '[id^="timer-"].mt-calm{color:#00d4ff}' +
      '[id^="timer-"].mt-dead{color:#666;animation:none;font-weight:400}';
    (document.head || document.documentElement).appendChild(s);
  })();

  /* सिर्फ़ ज़रूरत पर class बदलो (हर tick नहीं) */
  function setState(el, cls) {
    if (el._mtCls === cls) return;
    el._mtCls = cls;
    el.className = (el.className || '').replace(/\bmt-(live|soon|warn|calm|dead)\b/g, '').trim();
    if (cls) el.className = (el.className ? el.className + ' ' : '') + cls;
  }
  /* text सिर्फ़ बदलने पर लिखो */
  function setText(el, txt) {
    if (el._mtTxt === txt) return;
    el._mtTxt = txt;
    el.textContent = txt;
  }

  function startMatchTimers() {
    /* Bug 24 Fix: Guard against multiple concurrent intervals */
    if (_timerInterval) {
      clearInterval(_timerInterval);
      window._timerInterval = null;
    }
    _timerInterval = setInterval(function() {
      for (var mid in MT) {
        var el = document.getElementById('timer-' + mid);
        if (!el) continue;
        var t = MT[mid];
        /* L7 Fix: Stop timer for completed/cancelled matches immediately */
        var st = (t.status || t.matchStatus || '').toLowerCase();
        if (st === 'completed' || st === 'cancelled' || t.resultPublished) {
          setText(el, st === 'cancelled' ? 'Cancelled' : 'Ended');
          setState(el, 'mt-dead');
          continue;
        }
        var mt = Number(t.matchTime);
        if (!mt) { setText(el, ''); continue; }
        var diff = mt - (window.serverNow ? window.serverNow() : Date.now());

        if (diff > 86400000) {
          var days = Math.floor(diff / 86400000);
          setText(el, days + 'd ' + Math.floor((diff % 86400000) / 3600000) + 'h');
          setState(el, 'mt-calm');
        } else if (diff > 3600000) {
          var h = Math.floor(diff / 3600000);
          var m1 = Math.floor((diff % 3600000) / 60000);
          setText(el, h + 'h ' + m1 + 'm');
          setState(el, 'mt-calm');
        } else if (diff > 60000) {
          var m2 = Math.floor(diff / 60000);
          var s2 = Math.floor((diff % 60000) / 1000);
          setText(el, m2 + 'm ' + s2 + 's');
          setState(el, diff < 300000 ? 'mt-warn' : 'mt-calm');
        } else if (diff > 0) {
          setText(el, '⚡ ' + Math.floor(diff / 1000) + 's');
          setState(el, 'mt-soon');
        } else if (diff > -1200000) {
          /* LIVE — pehle har second innerHTML se span dobara banta tha
             (animation restart = flicker). Ab text ek baar + CSS class. */
          setText(el, '🔴 LIVE');
          setState(el, 'mt-live');
        } else {
          setText(el, 'Ended');
          setState(el, 'mt-dead');
        }
      }
    }, 1000);
    /* Bug 68 Fix: Expose interval ID as window._timerInterval so home.js guard works */
    window._timerInterval = _timerInterval;
  }

  /* Bug 24 Fix: Debounced wrapper prevents rapid re-calls after each renderHome
     (listeners.js calls renderHome on every MT change — each would restart timers) */
  var _timerDebounce = null;
  function debouncedStartTimers() {
    clearTimeout(_timerDebounce);
    _timerDebounce = setTimeout(startMatchTimers, 150);
  }

  /* Hook into renderHome to start timers after cards are rendered.
     Use debounced version to coalesce rapid successive render calls. */
  var _origRenderHome = window.renderHome;
  if (_origRenderHome) {
    window.renderHome = function() {
      _origRenderHome();
      debouncedStartTimers();
    };
  }

  var _origRenderSP = window.renderSP;
  if (_origRenderSP) {
    window.renderSP = function() {
      _origRenderSP();
      debouncedStartTimers();
    };
  }

  /* Export for manual use */
  window.startMatchTimers = startMatchTimers;

  console.log('[Mini eSports] ✅ Feature 1: Match Timer loaded (smooth-update fix 2026-10-06)');
})();
