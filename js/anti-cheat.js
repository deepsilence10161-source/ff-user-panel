/* ================================================================
   MINI ESPORTS — ANTI-CHEAT v3.0
   Bug 5 Fix: WebGL renderer + AudioContext fingerprint added
   Canvas alone doesn't catch headless browsers (Puppeteer)
================================================================ */
(function () {
  'use strict';

  /* ── 1. Canvas fingerprint (Issue #11 Fix: full dataURL hash, more entropy) ── */
  function _canvasFP() {
    try {
      var c = document.createElement('canvas');
      c.width = 240; c.height = 60;
      var ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';  ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';  ctx.fillText('MiniESports\uD83C\uDFAE', 2, 15);
      ctx.fillStyle = 'rgba(102,204,0,0.7)'; ctx.fillText('Fingerprint', 4, 17);
      /* Issue #11 Fix: add more entropy layers */
      ctx.fillStyle = '#f90';  ctx.fillRect(10, 30, 100, 5);
      ctx.fillStyle = '#09f';  ctx.fillText(navigator.language || 'en', 5, 38);
      ctx.fillStyle = 'rgba(255,0,128,0.5)';
      ctx.fillText((navigator.userAgent || '').substring(0, 24), 5, 48);
      /* Hash entire dataURL — not just last 40 chars (was insufficient) */
      var data = c.toDataURL();
      var h = 0, i = data.length;
      while (i--) { h = ((h << 5) - h) + data.charCodeAt(i); h |= 0; }
      return 'CV' + Math.abs(h).toString(36).toUpperCase().padStart(10, '0');
    } catch(e) { return 'canvas_err'; }
  }

  /* ── 2. WebGL renderer fingerprint (Bug 5 Fix) ── */
  function _webglFP() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return 'no_webgl';
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return 'no_ext';
      var vendor   = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)   || '';
      var renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
      /* Detect headless browsers — they return generic renderer strings */
      /* Bug #85 Fix: Multiple indicators required to reduce false positives */
      var _hCount = 0;
      var _rl = (renderer||'').toLowerCase(), _vl = (vendor||'').toLowerCase();
      if (_rl.indexOf('swiftshader')!==-1||_rl.indexOf('llvmpipe')!==-1||_rl.indexOf('softpipe')!==-1) _hCount++;
      if (_vl.indexOf('google')!==-1 && _rl.indexOf('swiftshader')!==-1) _hCount++;
      if (navigator.webdriver) _hCount += 2;
      if (navigator.plugins && navigator.plugins.length === 0) _hCount++;
      if (_hCount >= 2) {
        window._isHeadlessBrowser = true;
      }
      return (vendor + '|' + renderer).substring(0, 50);
    } catch(e) { return 'webgl_err'; }
  }

  /* ── 3. AudioContext fingerprint (Bug 5 Fix) ── */
  function _audioFP(cb) {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) { cb('no_audio'); return; }
      var ctx = new AudioCtx();
      var osc = ctx.createOscillator();
      var analyser = ctx.createAnalyser();
      var gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(analyser); analyser.connect(gain); gain.connect(ctx.destination);
      osc.start(0);
      setTimeout(function () {
        var buf = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(buf);
        osc.stop(0); ctx.close();
        var sum = buf.slice(0, 10).reduce(function (a, b) { return a + b; }, 0);
        cb(Math.abs(sum).toFixed(4));
      }, 100);
    } catch(e) { cb('audio_err'); }
  }

  /* ── 4. Combined stable device ID ── */
  function getDeviceId() {
    var stored = localStorage.getItem('_minieSport_did');
    var canvasFP = _canvasFP();
    var webglFP  = _webglFP();
    sessionStorage.setItem('_mes_cfp', canvasFP);
    sessionStorage.setItem('_mes_wfp', webglFP);
    /* Combined prefix using both canvas + webgl */
    var combined = canvasFP.replace(/[^a-zA-Z0-9]/g,'').substring(0,8) +
                   webglFP.replace(/[^a-zA-Z0-9|]/g,'').substring(0,8).replace('|','');
    var stablePrefix = 'D' + combined;
    /* Bug #29 Fix: Add 90-day expiry to device fingerprint
       Prevents permanent ban bypass AND allows legitimate re-use after expiry */
    var _didMeta = null;
    try { _didMeta = JSON.parse(localStorage.getItem('_minieSport_did_meta') || 'null'); } catch(e) {}
    var _didExpired = !_didMeta || (Date.now() - (_didMeta.created || 0)) > 90 * 24 * 60 * 60 * 1000;

    if (!stored || stored.length < 8 || _didExpired) {
      stored = stablePrefix + Math.random().toString(36).substr(2, 6);
      localStorage.setItem('_minieSport_did', stored);
      localStorage.setItem('_minieSport_did_meta', JSON.stringify({ created: Date.now(), version: 2 }));
    } else if (!stored.startsWith('D')) {
      stored = stablePrefix + stored.substring(0, 6);
      localStorage.setItem('_minieSport_did', stored);
      localStorage.setItem('_minieSport_did_meta', JSON.stringify({ created: Date.now(), version: 2 }));
    }
    /* Alert if headless detected */
    if (window._isHeadlessBrowser && window.db && window.U) {
      var fbDb = window._fbDb || window.db;
      try {
        fbDb.ref('adminAlerts').push({
          type: 'headless_browser', uid: window.U.uid,
          deviceId: stored, timestamp: Date.now(),
          userAgent: navigator.userAgent.substring(0, 100)
        });
      } catch(e) {}
    }
    return stored;
  }

  /* ── 5. Check device join in Firebase ── */
  function checkDeviceJoin(matchId, callback) {
    var did      = getDeviceId();
    var canvasFP = sessionStorage.getItem('_mes_cfp') || _canvasFP();
    var webglFP  = sessionStorage.getItem('_mes_wfp')  || _webglFP();
    var fbDb     = window._fbDb || window.db;
    if (!fbDb) { callback(false, null); return; }
    fbDb.ref('deviceJoins/' + did + '/' + matchId).once('value', function (s) {
      if (s.exists()) { callback(true, s.val()); return; }
      /* Check canvas FP key */
      var cfpKey = 'cfp_' + canvasFP.replace(/[^a-zA-Z0-9]/g,'').substring(0, 16);
      fbDb.ref('deviceJoins/' + cfpKey + '/' + matchId).once('value', function (s2) {
        if (s2.exists()) { callback(true, s2.val()); return; }
        /* Check WebGL FP key */
        var wfpKey = 'wfp_' + webglFP.replace(/[^a-zA-Z0-9]/g,'').substring(0, 16);
        fbDb.ref('deviceJoins/' + wfpKey + '/' + matchId).once('value', function (s3) {
          callback(s3.exists(), s3.val());
        });
      });
    });
  }

  /* ── 6. Save device join (all 3 keys for cross-detection) ── */
  function saveDeviceJoin(matchId, joinRequestId) {
    var did      = getDeviceId();
    var canvasFP = sessionStorage.getItem('_mes_cfp') || _canvasFP();
    var webglFP  = sessionStorage.getItem('_mes_wfp')  || _webglFP();
    var fbDb     = window._fbDb || window.db;
    var U = window.U; if (!U || !fbDb) return;
    var record = { uid: U.uid, joinRequestId: joinRequestId, joinedAt: Date.now(),
      userAgent: navigator.userAgent.substring(0, 80), isHeadless: !!window._isHeadlessBrowser };
    fbDb.ref('deviceJoins/' + did + '/' + matchId).set(record);
    var cfpKey = 'cfp_' + canvasFP.replace(/[^a-zA-Z0-9]/g,'').substring(0, 16);
    fbDb.ref('deviceJoins/' + cfpKey + '/' + matchId).set(record);
    var wfpKey = 'wfp_' + webglFP.replace(/[^a-zA-Z0-9]/g,'').substring(0, 16);
    fbDb.ref('deviceJoins/' + wfpKey + '/' + matchId).set(record);
    /* Issue #20 Fix: Store audio FP in sessionStorage so security-patches.js
       can read it, and use consistent key format matching canvas/webgl pattern */
    _audioFP(function (afp) {
      if (afp) sessionStorage.setItem('_mes_afp', afp);
      if (afp && afp !== 'no_audio' && afp !== 'audio_err') {
        var afpKey = 'AFP' + afp.replace(/\./g,'').replace(/-/g,'').substring(0, 12);
        sessionStorage.setItem('_mes_afp_key', afpKey);
        fbDb.ref('deviceJoins/' + afpKey + '/' + matchId).set(record)
          .catch(function(){});
      }
    });
    localStorage.setItem('_djoin_' + matchId, JSON.stringify(record));
  }

  function saveJoinMeta(joinRequestId) {
    var did = getDeviceId();
    var fbDb = window._fbDb || window.db; if (!fbDb) return;
    fbDb.ref('joinRequests/' + joinRequestId + '/deviceMeta').set({
      deviceId: did, canvasFP: (sessionStorage.getItem('_mes_cfp')||'').substring(0,20),
      webglFP: (sessionStorage.getItem('_mes_wfp')||'').substring(0,20),
      isHeadless: !!window._isHeadlessBrowser,
      userAgent: navigator.userAgent.substring(0, 80), joinTime: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenRes: screen.width + 'x' + screen.height
    });
  }

  window.getDeviceId     = getDeviceId;
  window.checkDeviceJoin = checkDeviceJoin;
  window.saveDeviceJoin  = saveDeviceJoin;
  window.saveJoinMeta    = saveJoinMeta;

  /* Compute audio FP in background and cache it */
  setTimeout(function () {
    _audioFP(function (afp) {
      if (afp) sessionStorage.setItem('_mes_afp', afp);
    });
  }, 3000);

  console.log('[AntiCheat] v3.0 loaded — Canvas+WebGL+Audio FP | Device:', getDeviceId().substring(0, 12) + '...');
})();
