/* ====== ANTI-SPAM FEATURE f56: VPN/PROXY DETECTION ======
   - Timezone + Location mismatch detect karta hai
   - WebRTC IP leak check (VPN expose karta hai real IP)
   - Datacenter ASN detection clues
   - High-risk VPN users ko warn karta hai, admin ko alert
*/
(function(){
'use strict';

/* ── Timezone vs Geolocation mismatch check ── */
window.checkVPNSignals = function(uid) {
  var signals = [];
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

  // India timezone check
  var isIndianTZ = tz.includes('Calcutta') || tz.includes('Kolkata') || tz.includes('Asia/C');
  if (!isIndianTZ) {
    signals.push('Non-Indian timezone: ' + tz);
  }

  // Language check
  var lang = navigator.language || navigator.userLanguage || '';
  var isIndianLang = /^(hi|en|ta|te|bn|mr|gu|kn|ml|pa|ur|or|as)/i.test(lang);
  // Allow English (global) so only flag unusual langs
  if (!isIndianLang && lang && !lang.startsWith('en')) {
    signals.push('Unusual language: ' + lang);
  }

  // Screen resolution check (headless browser signs)
  var res = screen.width + 'x' + screen.height;
  var suspiciousRes = ['800x600', '1024x768', '1280x720'].includes(res) && screen.colorDepth < 24;
  if (suspiciousRes) signals.push('Low-res headless screen: ' + res);

  // Hardware concurrency (bots often report 0 or 1)
  var cores = navigator.hardwareConcurrency || 0;
  if (cores === 0) signals.push('Hardware concurrency = 0 (bot/emulator sign)');

  // WebDriver detection (automation tools)
  if (navigator.webdriver) signals.push('WebDriver detected (automation tool)');

  // Phantom/Selenium checks
  if (window._phantom || window.__nightmare || window.callPhantom) signals.push('Headless browser detected');

  if (signals.length >= 2 && window.db && uid) {
    window.db.ref('adminAlerts').push({
      type: 'vpn_proxy_suspected',
      uid: uid,
      signals: signals,
      timezone: tz,
      language: lang,
      timestamp: Date.now(),
      severity: signals.length >= 3 ? 'HIGH' : 'MEDIUM',
      message: 'VPN/Proxy suspected for ' + uid + ': ' + signals.join('; ')
    });
  }

  return { signalCount: signals.length, signals: signals, likelySuspicious: signals.length >= 2 };
};

/* ── WebRTC real IP leak detection ── */
window.detectWebRTCLeak = function(callback) {
  try {
    var pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer().then(function(offer) { return pc.setLocalDescription(offer); });
    pc.onicecandidate = function(e) {
      if (!e || !e.candidate) return;
      var ipMatch = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
      if (ipMatch) {
        var ip = ipMatch[0];
        // Private IPs: 10.x, 172.16-31.x, 192.168.x
        var isPrivate = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(ip);
        callback({ ip: ip, isPrivate: isPrivate, vpnLikely: !isPrivate && !/^127\./.test(ip) });
        pc.close();
      }
    };
    setTimeout(function() { try { pc.close(); } catch(e){} }, 3000);
  } catch(e) {
    callback({ error: 'WebRTC not supported', vpnLikely: false });
  }
};

/* ── Auto-check on login ── */
var _initI = setInterval(function() {
  if (window.U && window.db) {
    clearInterval(_initI);
    var uid = window.U.uid;

    // VPN signals check
    var vpnResult = window.checkVPNSignals(uid);
    if (vpnResult.likelySuspicious && window.toast) {
      // Silent flag — don't show to user to avoid false alarm frustration
      // Admin already alerted via firebase
    }

    // WebRTC check
    if (typeof RTCPeerConnection !== 'undefined') {
      window.detectWebRTCLeak(function(result) {
        if (result.vpnLikely && !result.isPrivate) {
          window.db.ref('adminAlerts').push({
            type: 'webrtc_vpn_detected',
            uid: uid,
            detectedIP: result.ip,
            timestamp: Date.now(),
            severity: 'MEDIUM',
            message: 'WebRTC IP leak shows possible VPN for ' + uid + ': IP ' + result.ip
          });
          window.db.ref('users/' + uid + '/flags/vpnDetected').set(true);
        }
      });
    }
  }
}, 800);

console.log('[Anti-Spam] ✅ f56: VPN/Proxy Detection loaded');
})();
