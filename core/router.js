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
      if (Object.keys(rdUpdates).length) {
        db.ref('users/' + U.uid + '/readNotifications').update(rdUpdates);
      }
    }
  }
}
function setST(w, v) {
  if (w === 'home') {
    hSF = v;
    document.querySelectorAll('#homeST .s-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.st === v); });
    renderHome();
  } else {
    mmSF = v;
    document.querySelectorAll('#mmST .s-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.st === v); });
    renderMM();
  }
}
function setCat(v) {
  hCF = v;
  document.querySelectorAll('#homeCat .c-pill').forEach(function(p) { p.classList.toggle('active', p.dataset.cat === v); });
  renderHome();
}

