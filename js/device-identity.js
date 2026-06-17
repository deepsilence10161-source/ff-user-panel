/* ════════════════════════════════════════════════════════════════
   DEVICE FINGERPRINT — Anti-Cheat Only
   Auth = Firebase Google Login (auth.js handles it)
   This file ONLY generates fingerprint for:
   · Multi-account detection
   · Fake player detection
   · Admin alert on device switch

   generateAdvancedFingerprint() — 5 layers combined → SHA-256
════════════════════════════════════════════════════════════════ */

(function() {
'use strict';

/* ── SHA-256 ── */
async function _sha256(str) {
  if (window.crypto && window.crypto.subtle) {
    var buf  = new TextEncoder().encode(str);
    var hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
  }
  /* Fallback djb2 */
  var h = 5381;
  for (var i=0;i<str.length;i++){ h=((h<<5)+h)+str.charCodeAt(i); h|=0; }
  return Math.abs(h).toString(16).padStart(16,'0');
}

/* Layer 1: Canvas */
function _canvasLayer() {
  try {
    var c = document.createElement('canvas');
    c.width = 280; c.height = 60;
    var ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial,sans-serif';
    ctx.fillStyle = '#f60';   ctx.fillRect(0,0,280,60);
    ctx.fillStyle = '#069';   ctx.fillText('MiniESports\uD83C\uDFAE', 2, 4);
    ctx.fillStyle = 'rgba(102,204,0,.8)';
    ctx.fillText(navigator.userAgent.slice(0,40), 5, 28);
    ctx.strokeStyle = '#b964ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(120,30,20,0,Math.PI*2); ctx.stroke();
    ctx.font = '11px "Courier New"';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText(screen.width+'x'+screen.height, 150, 44);
    var data = c.toDataURL('image/png');
    var h = 0, i = data.length;
    while(i--){ h=((h<<5)-h)+data.charCodeAt(i); h|=0; }
    return 'CV' + Math.abs(h).toString(36).toUpperCase().padStart(10,'0');
  } catch(e){ return 'canvas_err'; }
}

/* Layer 2: WebGL */
function _webglLayer() {
  try {
    var c  = document.createElement('canvas');
    var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return 'no_webgl';
    var ext      = gl.getExtension('WEBGL_debug_renderer_info');
    var vendor   = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)   : gl.getParameter(gl.VENDOR);
    var renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return (vendor||'') + '|' + (renderer||'');
  } catch(e){ return 'webgl_err'; }
}

/* Layer 3: Audio */
function _audioLayer() {
  return new Promise(function(resolve) {
    /* Bug #84 Fix: Add 2-second timeout for Safari/blocked browsers */
    var _audioTimeout = setTimeout(function() {
      console.warn('[DeviceID] Audio fingerprint timeout — using no_audio fallback');
      resolve('no_audio_timeout');
    }, 2000);

    try {
      var AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AC) { clearTimeout(_audioTimeout); resolve('no_audio'); return; }
      var ctx = new AC(1, 44100, 44100);
      var osc = ctx.createOscillator();
      var cmp = ctx.createDynamicsCompressor();
      osc.type = 'triangle'; osc.frequency.value = 10000;
      [['threshold',-50],['knee',40],['ratio',12],['attack',0],['release',.25]]
        .forEach(function(p){ try{ cmp[p[0]].value=p[1]; }catch(e){} });
      osc.connect(cmp); cmp.connect(ctx.destination);
      osc.start(0); ctx.startRendering();
      ctx.oncomplete = function(e) {
        clearTimeout(_audioTimeout);
        var buf = e.renderedBuffer.getChannelData(0);
        var sum = 0; for(var i=4500;i<5000;i++) sum += Math.abs(buf[i]);
        resolve('A' + sum.toString().slice(0,12));
      };
      setTimeout(function(){ resolve('audio_to'); }, 400);
    } catch(e){ resolve('audio_err'); }
  });
}

/* Layer 4: Hardware */
function _hwLayer() {
  return [
    screen.width, screen.height, screen.colorDepth,
    navigator.hardwareConcurrency  || 0,
    navigator.deviceMemory         || 0,
    navigator.maxTouchPoints       || 0,
    navigator.language             || '',
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    navigator.platform             || '',
    (navigator.connection && navigator.connection.effectiveType) || ''
  ].join('|');
}

/* Layer 5: Storage capabilities */
function _storageLayer() {
  return [
    !!window.indexedDB    ?'1':'0',
    !!window.localStorage ?'1':'0',
    !!window.crypto       ?'1':'0',
    !!window.GPU          ?'1':'0'
  ].join('');
}

/* ── Main fingerprint generator ── */
window.generateAdvancedFingerprint = async function() {
  var cached = sessionStorage.getItem('_mes_dfp');
  if (cached && cached.startsWith('DFP_')) return cached;

  var audio = await _audioLayer();
  var raw   = [_canvasLayer(), _webglLayer(), audio, _hwLayer(), _storageLayer()].join(':::');
  var hash  = await _sha256(raw);
  var fp    = 'DFP_' + hash.substring(0,20).toUpperCase();

  sessionStorage.setItem('_mes_dfp', fp);
  return fp;
};

/* ── Auto-generate on load and save to Firebase ── */
document.addEventListener('DOMContentLoaded', function() {
  /* Wait for user to be signed in, then save fingerprint */
  var _fpCheckCount = 0;
  var _fpIv = setInterval(function() {
    _fpCheckCount++;
    if (window.U && window.U.uid && window.db) {
      clearInterval(_fpIv);
      window.generateAdvancedFingerprint().then(function(fp) {
        window.db.ref('users/' + window.U.uid + '/lastFP').set(fp);
        window.db.ref('deviceJoins').once('value', function(s) {
          /* Anti-cheat: check if same FP used by another UID */
          if (!s.exists()) return;
          s.forEach(function(devSnap) {
            devSnap.forEach(function(matchSnap) {
              var rec = matchSnap.val();
              if (rec && rec.uid && rec.uid !== window.U.uid &&
                  devSnap.key.indexOf(fp.replace('DFP_','').substring(0,10)) >= 0) {
                /* Same device, different account → alert admin */
                window.db.ref('deviceAnomalies').push({
                  uid:       window.U.uid,
                  otherUid:  rec.uid,
                  fp:        fp,
                  type:      'multi_account',
                  detectedAt: Date.now()
                });
              }
            });
          });
        });
      });
    }
    if (_fpCheckCount > 40) clearInterval(_fpIv);
  }, 500);
});

console.log('[DeviceFP] ✅ Advanced fingerprint system loaded (anti-cheat)');
})();
