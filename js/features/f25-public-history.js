/* =============================================
   FEATURE 25: Public Match History
   - Search karo kisi bhi verified player ka history
   - FF UID se dhundho
   - Dikhao: matches, wins, kills, earnings
   ============================================= */
(function() {
  'use strict';

  function showPublicProfile(ffUid) {
    if (!window.db || !ffUid) return;
    if (!window.openModal) return;
    openModal('🔍 Player Search', '<div style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--primary)"></i><div style="margin-top:8px;color:var(--txt2);font-size:13px">Searching...</div></div>');
    // Search by ffUid
    window.db.ref('users').orderByChild('ffUid').equalTo(ffUid).once('value', function(s) {
      if (!s.exists()) {
        openModal('🔍 Not Found', '<div style="text-align:center;padding:20px"><div style="font-size:40px">😕</div><div style="margin-top:8px;font-size:14px;font-weight:700">Player nahi mila</div><div style="font-size:12px;color:var(--txt2);margin-top:4px">FF UID check karo aur dobara try karo</div></div>');
        return;
      }
      var userData = null;
      s.forEach(function(c) { userData = c.val(); });
      if (!userData) return;
      renderPublicProfile(userData);
    });
  }

  function renderPublicProfile(u) {
    var st = u.stats || {};
    var badges = u.badges || {};
    var isVerified = u.profileStatus === 'approved';
    var av = (u.ign || u.displayName || '?').charAt(0).toUpperCase();

    var badgeList = '';
    if (isVerified) badgeList += '<span style="background:rgba(0,255,156,.15);color:#00ff9c;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;border:1px solid rgba(0,255,156,.3)">✅ Verified</span> ';
    if (badges.weekWarrior) badgeList += '<span style="font-size:13px" title="Week Warrior">🔥</span> ';
    if (badges.monthlyLegend) badgeList += '<span style="font-size:13px" title="Monthly Legend">👑</span> ';
    if (badges.first_win) badgeList += '<span style="font-size:13px" title="First Win">🥇</span> ';
    if (badges.kill_machine) badgeList += '<span style="font-size:13px" title="Kill Machine">🎯</span> ';

    var h = '<div style="text-align:center">' +
      '<div style="width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,var(--primary),var(--purple));display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;margin:0 auto 8px">' + av + '</div>' +
      '<div style="font-size:18px;font-weight:800">' + (u.ign || u.displayName || 'Player') + '</div>' +
      '<div style="font-size:12px;color:var(--txt2);margin-bottom:6px">FF UID: ' + (u.ffUid || '—') + '</div>' +
      '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:14px">' + (badgeList || '<span style="font-size:11px;color:var(--txt2)">No badges yet</span>') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">' +
        _statBox('🎮', st.matches||0, 'Matches') +
        _statBox('🏆', st.wins||0, 'Wins') +
        _statBox('🎯', st.kills||0, 'Kills') +
      '</div>' +
      '<div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:10px;margin-bottom:14px">' +
        '<div style="font-size:11px;color:var(--txt2)">Total Earnings</div>' +
        '<div style="font-size:22px;font-weight:900;color:#ffd700">₹' + (st.earnings||0) + '</div>' +
      '</div>' +
      '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:700;border:none;cursor:pointer">Close</button>' +
    '</div>';
    if (window.openModal) openModal('👤 Player Profile', h);
  }

  function _statBox(icon, val, label) {
    return '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px 6px">' +
      '<div style="font-size:16px">' + icon + '</div>' +
      '<div style="font-size:16px;font-weight:800;margin:2px 0">' + val + '</div>' +
      '<div style="font-size:9px;color:var(--txt2)">' + label + '</div>' +
    '</div>';
  }

  function showSearchModal() {
    if (!window.openModal) return;
    var h = '<div>' +
      '<div style="font-size:13px;color:var(--txt2);margin-bottom:10px">Kisi bhi player ka FF UID enter karo</div>' +
      '<div style="display:flex;gap:8px">' +
        '<input id="pubSearchInput" type="text" placeholder="FF UID (e.g. 6287747762)" style="flex:1;padding:12px;border-radius:10px;background:var(--bg);border:1px solid var(--border);color:var(--txt);font-size:14px">' +
        '<button onclick="window.f25PublicHistory.search(document.getElementById(\'pubSearchInput\').value.trim())" style="padding:12px 16px;border-radius:10px;background:var(--primary);color:#000;font-weight:700;border:none;cursor:pointer"><i class="fas fa-search"></i></button>' +
      '</div>' +
    '</div>';
    openModal('🔍 Search Player', h);
    setTimeout(function() { var el = document.getElementById('pubSearchInput'); if (el) el.focus(); }, 300);
  }

  window.f25PublicHistory = { search: showPublicProfile, open: showSearchModal };
  window.showPlayerSearch = showSearchModal;
})();
