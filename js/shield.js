/* ================================================================
   MINI eSPORTS — js/shield.js  (D88, 07-Nov-2026)
   Owner: "koi mere app ya web ka code ki ek line tak na chura sake"
   ----------------------------------------------------------------
   1. ORIGIN LOCK — ye code sirf Mini eSports ke official origins par
      chalta hai. Copy karke doosre domain/hosts par lagaya gaya to
      app turant lock-screen me badal jata hai (aur interval se wapas
      bhi nahi la sakte).
   2. ANTI-DEVTOOLS DETERRENT — right-click / F12 / Ctrl+U/S/P /
      view-source shortcuts block; debugger-trap sirf devtools khulne
      par pause karta hai (normal user par zero asar).
   3. CONSOLE LEGAL WARNING — IT Act 2000 u/s 66 + Copyright Act 1957
      u/s 63 ka notice.
   4. SELECT/DRAG OFF — UI text copy-select nahi hoti (inputs exempt).
   Note: client-side code ko 100% hidden karna technically impossible
   hai (browser ko chalane ke liye code chahiye) — isliye asli source
   ab PRIVATE repo me hai aur public par sirf obfuscated build jaata
   hai (scripts/protect-build.mjs). Ye shield copied/rehosted copies
   ko todta hai + chori ko legally/technically mehnga karta hai.
   ================================================================ */
(function () {
  'use strict';

  /* ---------- 1. ORIGIN LOCK ---------- */
  var ALLOWED_HOSTS = [
    'deepsilence10161-source.github.io',   // official web (GitHub Pages)
    'localhost', '127.0.0.1',              // dev / QA harness
    'capacitor', 'ionic'                   // APK WebView schemes (capacitor://, https://localhost)
  ];
  function _hostKind() {
    try {
      var h = (location.hostname || '').toLowerCase();
      var p = (location.protocol || '').toLowerCase();
      if (p === 'file:') return 'ok';                 // APK local assets (if any)
      for (var i = 0; i < ALLOWED_HOSTS.length; i++) {
        if (h === ALLOWED_HOSTS[i]) return 'ok';
        if (h.indexOf('.' + ALLOWED_HOSTS[i]) > -1) return 'ok';  // subdomains
      }
      if (p.indexOf('capacitor') === 0) return 'ok';
      return 'bad:' + h;
    } catch (e) { return 'ok'; }
  }
  var _lockMsg =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#07070c;color:#fff;font-family:system-ui,Segoe UI,sans-serif;text-align:center;padding:24px">' +
    '<div style="max-width:420px"><div style="font-size:44px">🔒</div>' +
    '<h1 style="font-size:20px;margin:14px 0 6px;color:#ff5470">Unauthorized Copy Detected</h1>' +
    '<p style="font-size:13px;line-height:1.7;color:#c9c9d6">Ye application <b>Mini eSports</b> ki proprietary property hai ' +
    '(© 2026 Mini eSports, India). Is host par chalana <b>Copyright Act 1957 u/s 63</b> aur <b>IT Act 2000 u/s 66</b> ka ' +
    'ullanghan hai. Asli app sirf official source se install karein.</p>' +
    '<p style="font-size:12px;color:#8b8ba0;margin-top:10px">Host: ' + (location.hostname || '?') + '</p></div></div>';
  function _applyLock() {
    try {
      document.title = '🔒 Unauthorized Copy';
      if (document.body) document.body.innerHTML = _lockMsg;
      else document.documentElement.innerHTML = '<body style="margin:0">' + _lockMsg + '</body>';
    } catch (e) {}
  }
  var _kind = _hostKind();
  if (_kind !== 'ok') {
    window.__MINI_LOCKED = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _applyLock);
    } else { _applyLock(); }
    setInterval(_applyLock, 800);   // DOM wapas lane ki koshish na kam aaye
  }

  /* ---------- 2. ANTI-DEVTOOLS DETERRENT ---------- */
  function _isField(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }
  document.addEventListener('contextmenu', function (e) {
    if (_isField(e.target)) return;
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('keydown', function (e) {
    if (_isField(e.target)) return;
    var k = e.key || '';
    if (k === 'F12') { e.preventDefault(); return; }
    if (e.ctrlKey && (k === 'u' || k === 'U' || k === 's' || k === 'S' || k === 'p' || k === 'P')) { e.preventDefault(); return; }
    if (e.ctrlKey && e.shiftKey && (k === 'I' || k === 'i' || k === 'J' || k === 'j' || k === 'C' || k === 'c')) { e.preventDefault(); return; }
    if (e.ctrlKey && (k === 'a' || k === 'A') && !_isField(e.target)) { e.preventDefault(); return; }
  });
  document.addEventListener('dragstart', function (e) { if (!_isField(e.target)) e.preventDefault(); });
  document.addEventListener('selectstart', function (e) { if (!_isField(e.target)) e.preventDefault(); });
  /* debugger-trap: sirf devtools khula ho to pause; normal user ko feel nahi hota */
  setInterval(function () { try { Function('debugger')(); } catch (e) {} }, 1600);

  /* ---------- 3. CONSOLE LEGAL WARNING ---------- */
  setTimeout(function () {
    try {
      console.log('%c⛔ RUK JAIYE!', 'font-size:34px;color:#ff5470;font-weight:900');
      console.log('%cYe browser console Mini eSports app ka proprietary code debug karne ke liye protected area hai.\n' +
        'Yahan paste karne ko kaha jaye to wo SCAM hai (self-XSS).\n' +
        'Code/content ki anadhikrit copy: Copyright Act 1957 u/s 63 + IT Act 2000 u/s 66 — 3 saal tak ki saza + jurmana.\n' +
        '© 2026 Mini eSports. All rights reserved.', 'font-size:13px;color:#c9c9d6');
    } catch (e) {}
  }, 600);
})();
