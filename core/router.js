function navTo(scr) {
  if (scr === curScr && scr !== 'notif' && scr !== 'chat') return;
  prevScr = curScr; curScr = scr;
  history.pushState(null, null, null);
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  var el = $('scr' + scr.charAt(0).toUpperCase() + scr.slice(1));
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.toggle('active', n.dataset.nav === scr); });
  /* Reset scroll to top */
  var mc = $('mainContent'); if (mc) mc.scrollTop = 0;
  if (scr === 'rank') renderRank();
  if (scr === 'profile') renderProfile();
  if (scr === 'chat') startChat();
  if (scr === 'wallet') renderWallet();
  if (scr === 'notif') {
    renderNotifs();
    /* FIX: Mark all as read when user opens notification tab */
    if (NOTIFS.length && U) {
      var rdUpdates = {};
      NOTIFS.forEach(function(n) {
        if (!n._key) return;
        rdUpdates[n._key] = true;
        n._localRead = true;
        _READ_KEYS[n._key] = true; // persistent — survives any NOTIFS rebuild
      });
      if (UD) {
        if (!UD.readNotifications) UD.readNotifications = {};
        Object.assign(UD.readNotifications, rdUpdates);
      }
      updateBell();
      _saveReadKeys();
      /* Supabase handles read status — mark all via batch update */
      if (window._supa && U) {
        window._supa.from('notifications')
          .update({ is_read: true })
          .eq('user_id', U.uid)
          .in('id', Object.keys(rdUpdates))
          .then(null, function(){});
      }
    }
  }
}
/* UPDATED (2026-08 redesign #2): status filter is now a custom dark
   dropdown (core/custom-dropdown.js), not a native <select> — keep the
   displayed label in sync with hSF/mmSF whenever set programmatically. */
var _ST_LABELS = { upcoming:'⏱️ Upcoming', live:'🔴 Live', completed:'✅ Completed' };
function setST(w, v) {
  if (w === 'home') {
    hSF = v;
    var cur = document.querySelector('#homeStatusDd .dd-current');
    if (cur && _ST_LABELS[v]) cur.textContent = _ST_LABELS[v];
    renderHome();
  } else {
    mmSF = v;
    var mCur = document.querySelector('#mmStatusDd .dd-current');
    if (mCur && _ST_LABELS[v]) mCur.textContent = _ST_LABELS[v];
    renderMM();
  }
}
function setCat(v) {
  hCF = v;
  document.querySelectorAll('#homeCat .c-pill').forEach(function(p) { p.classList.toggle('active', p.dataset.cat === v); });
  renderHome();
}

