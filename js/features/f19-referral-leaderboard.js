/* =============================================
   FEATURE 19: Referral Leaderboard
   - Is mahine sabse zyada refer karne wale top 10
   - Home/Rank screen pe dikhta hai
   - Top 3 ko badge milta hai
   - Firebase: referrals/ node se count
   ============================================= */
(function() {
  'use strict';

  function getCurrentMonthStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1);
  }

  function showReferralLeaderboard() {
    if (!window.db) return;

    var month = getCurrentMonthStr();
    var monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    var msTs = monthStart.getTime();

    var h = '<div>';
    h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:12px;text-align:center">Is mahine ki referral ranking</div>';
    h += '<div id="f19LbList" style="min-height:80px"><div style="text-align:center;color:var(--txt2);font-size:12px;padding:20px">Loading...</div></div>';
    h += '</div>';

    if (window.openModal) window.openModal('🎖️ Referral Leaderboard', h);

    // Load data
    window.db.ref('referrals').orderByChild('createdAt').startAt(msTs).once('value', function(s) {
      var counts = {};
      var names = {};
      if (s.exists()) {
        s.forEach(function(c) {
          var r = c.val();
          if (!r || !r.referrerId) return;
          counts[r.referrerId] = (counts[r.referrerId] || 0) + 1;
          if (r.referrerIgn || r.referrerName) names[r.referrerId] = r.referrerIgn || r.referrerName;
        });
      }

      // Sort
      var sorted = Object.keys(counts).map(function(uid) {
        return { uid: uid, count: counts[uid], name: names[uid] || uid.substring(0,8) };
      }).sort(function(a,b) { return b.count - a.count; });

      var listEl = document.getElementById('f19LbList');
      if (!listEl) return;

      if (sorted.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:var(--txt2);font-size:12px;padding:20px">Abhi kisi ne refer nahi kiya</div>';
        return;
      }

      var medals = ['🥇','🥈','🥉'];
      var lbHTML = '';
      sorted.slice(0, 10).forEach(function(p, i) {
        var isMe = window.U && p.uid === window.U.uid;
        lbHTML += '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:' + (isMe ? 'rgba(0,255,156,.06)' : 'var(--card)') + ';border:1px solid ' + (isMe ? 'rgba(0,255,156,.2)' : 'var(--border)') + ';margin-bottom:6px">';
        lbHTML += '<div style="font-size:20px;width:28px;text-align:center">' + (medals[i] || '#' + (i+1)) + '</div>';
        lbHTML += '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + (p.name) + (isMe ? ' <span style="font-size:9px;color:#00ff9c">(You)</span>' : '') + '</div></div>';
        lbHTML += '<div style="font-size:13px;font-weight:800;color:var(--primary)">' + p.count + ' refers</div>';
        lbHTML += '</div>';
      });

      listEl.innerHTML = lbHTML;
    });
  }

  // Add to rank screen
  function addToRankScreen() {
    var rankContent = document.getElementById('rankContent');
    if (!rankContent || rankContent.querySelector('.f19-ref-lb-btn')) return;

    var btn = document.createElement('button');
    btn.className = 'f19-ref-lb-btn';
    btn.style.cssText = 'width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,rgba(185,100,255,.1),rgba(121,40,202,.05));color:var(--purple);border:1px solid rgba(185,100,255,.2);font-weight:700;font-size:13px;cursor:pointer;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:8px';
    btn.innerHTML = '🎖️ Referral Leaderboard';
    btn.onclick = showReferralLeaderboard;
    rankContent.prepend(btn);
  }

  function hookRenderRank() {
    var orig = window.renderRank;
    if (!orig || window._f19Hooked) return;
    window._f19Hooked = true;
    window.renderRank = function() {
      orig.apply(this, arguments);
      setTimeout(addToRankScreen, 300);
    };
  }

  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.renderRank) { clearInterval(_check); hookRenderRank(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f19ReferralLb = { show: showReferralLeaderboard };
  window.showReferralLeaderboard = showReferralLeaderboard;
})();
