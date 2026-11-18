/* ═══════════════════════════════════════════════════════════════
   VERIFY-NUDGE (D90, 07-Nov-2026) — owner order: "jo user profile
   verification nahi kiya ho use har baar app kholne par verify ka
   system, bina irritating".
   Design (gentle-but-persistent):
     • Har APP LAUNCH par ek hi baar: soft bottom-sheet nudge
       (sessionStorage guard — launch ke andar repeat NAHI, reload
       par bhi nahi; agli launch par phir).
     • Sheet ke saath ek chhota passive chip (top-right) jab tak
       verification pending — tap = verification modal.
     • Verified hote hi (profileStatus 'approved' / profileVerified)
       sheet + chip dono turant gayab — poll har 700ms.
     • Koi hard-lock NAHI: app poori usable rehti hai, sheet ek
       tap se dismiss ("Abhi nahi").
   Verify action = existing showProfileUpdate() modal (wahi purana
   Profile Verification flow) — koi duplicate logic nahi.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  if (window._verifyNudgeLoaded) return;
  window._verifyNudgeLoaded = true;

  var SHEET_ID = 'vnSheet', CHIP_ID = 'vnChip', SS_KEY = 'vn_shown_this_launch';
  var _sheetQueued = false;

  function ud() { return window.UD || null; }
  function isUnverified() {
    var u = ud();
    return !!u && u.profileStatus !== 'approved' && !u.profileVerified;
  }
  function shownThisLaunch() {
    try { return sessionStorage.getItem(SS_KEY) === '1'; } catch (e) { return false; }
  }
  function markShown() {
    try { sessionStorage.setItem(SS_KEY, '1'); } catch (e) {}
  }
  function openVerify() {
    markShown();
    hideSheet();
    try { if (window.showProfileUpdate) { window.showProfileUpdate(); return; } } catch (e) {}
    try { if (window.navTo) window.navTo('profile'); } catch (e) {}
  }
  function dismiss() { markShown(); hideSheet(); }

  function injectCss() {
    if (document.getElementById('vnCss')) return;
    var st = document.createElement('style');
    st.id = 'vnCss';
    st.textContent =
      '#vnSheet{position:fixed;left:0;right:0;bottom:0;z-index:99998;background:linear-gradient(180deg,#12161f,#0b0e14);' +
      'border-top:1px solid rgba(0,255,156,.25);border-radius:18px 18px 0 0;padding:16px 16px calc(14px + env(safe-area-inset-bottom));' +
      'transform:translateY(110%);transition:transform .28s ease;box-shadow:0 -8px 30px rgba(0,0,0,.5)}' +
      '#vnSheet.vnIn{transform:translateY(0)}' +
      '#vnChip{position:fixed;top:52px;right:10px;z-index:99990;background:rgba(255,170,0,.12);border:1px solid rgba(255,170,0,.35);' +
      'color:#ffbb33;font-size:10px;font-weight:700;padding:4px 10px;border-radius:999px;backdrop-filter:blur(6px);cursor:pointer}' +
      '#vnSheet .vnBtn{flex:1;text-align:center;padding:11px 0;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer}';
    document.head.appendChild(st);
  }
  function hideSheet() {
    var s = document.getElementById(SHEET_ID);
    if (s && s.parentNode) s.parentNode.removeChild(s);
  }
  function removeChip() {
    var c = document.getElementById(CHIP_ID);
    if (c && c.parentNode) c.parentNode.removeChild(c);
    document.body.classList.remove('vn-chip-on');   /* D98 F3: ticker ko poori width wapas */
  }
  function showChip() {
    if (document.getElementById(CHIP_ID)) return;
    var c = document.createElement('div');
    c.id = CHIP_ID;
    c.textContent = '⚠️ Unverified — tap to verify';
    c.onclick = openVerify;
    document.body.appendChild(c);
    document.body.classList.add('vn-chip-on');   /* D98 F3: ticker text chip ke neeche na slide kare */
  }
  function showSheet() {
    if (shownThisLaunch() || !isUnverified() || document.getElementById(SHEET_ID)) return;
    injectCss();
    var s = document.createElement('div');
    s.id = SHEET_ID;
    s.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
      '<div style="width:38px;height:38px;border-radius:12px;background:rgba(0,255,156,.12);display:flex;align-items:center;justify-content:center;font-size:18px">🛡️</div>' +
      '<div><div style="font-size:14px;font-weight:800;color:#fff">Profile Verification pending</div>' +
      '<div style="font-size:11px;color:#9aa4b2;margin-top:2px">IGN + FF UID verify karayein — sirf 30 second, ek baar.</div></div></div>' +
      '<div style="font-size:11px;color:#8b93a1;line-height:1.5;margin-bottom:12px">Verified profile se match rewards, leaderboard trust aur team-features smooth chalte hain. Admin approval ke baad UID lock ho jata hai — safe.</div>' +
      '<div style="display:flex;gap:10px">' +
      '<div class="vnBtn" id="vnGo" style="background:linear-gradient(135deg,#00e68a,#00b368);color:#04110b">✔ Verify Now (30s)</div>' +
      '<div class="vnBtn" id="vnNo" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#aab3c0">Abhi nahi</div>' +
      '</div>';
    document.body.appendChild(s);
    setTimeout(function () { s.classList.add('vnIn'); }, 40);
    document.getElementById('vnGo').onclick = openVerify;
    document.getElementById('vnNo').onclick = dismiss;
  }

  setInterval(function () {
    try {
      if (!ud()) { hideSheet(); removeChip(); _sheetQueued = false; return; }  // logged out
      if (!isUnverified()) { hideSheet(); removeChip(); return; }             // verified → silent forever
      showChip();
      if (!shownThisLaunch() && !_sheetQueued) {
        _sheetQueued = true;
        setTimeout(showSheet, 1800);   // splash/boot settle hone ke baad, ek baar per launch
      }
    } catch (e) {}
  }, 700);

  /* test hook (QA harness / playwright) */
  window._vnTest = { show: showSheet, hide: hideSheet, chip: showChip, unverified: isUnverified };
})();
