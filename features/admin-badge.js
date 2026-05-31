/* ================================================================
   ADMIN RESPONSE TIME BADGE — admin-badge.js
   
   Track karo admin response time:
   - Dispute/support submit hone ka time
   - Admin response dene ka time
   - Average calculate karo
   
   Firebase:
   appSettings/adminResponseStats: { totalResponded, totalTimeMs, avgResponseMs }
   ================================================================ */

(function() {
'use strict';

var _responseStats = null;

/* ── Load admin response stats ── */
window.loadAdminResponseStats = function() {
  if (!window.db) { setTimeout(window.loadAdminResponseStats, 1000); return; }
  window.db.ref('appSettings/adminResponseStats').on('value', function(snap) {
    _responseStats = snap.val();
  });
};

/* ── Get badge text ── */
function getResponseBadge() {
  if (!_responseStats || !_responseStats.totalResponded) {
    return { text: 'Active', color: '#00ff9c', icon: '⚡' };
  }
  var avgMs = _responseStats.avgResponseMs || 0;
  var avgHrs = avgMs / 3600000;
  var avgMins = avgMs / 60000;

  if (avgMins < 60) {
    return { text: 'Usually responds in ' + Math.round(avgMins) + ' min', color: '#00ff9c', icon: '⚡' };
  } else if (avgHrs < 6) {
    return { text: 'Usually responds in ' + Math.round(avgHrs) + ' hrs', color: '#ffd700', icon: '⏰' };
  } else if (avgHrs < 24) {
    return { text: 'Usually responds same day', color: '#ff9f1c', icon: '📅' };
  } else {
    return { text: 'Usually responds within 1-2 days', color: '#888', icon: '📬' };
  }
}

/* ── Render badge (shown in support/profile) ── */
window.renderAdminBadge = function() {
  var badge = getResponseBadge();
  return '<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:20px;padding:5px 12px">' +
    '<span style="font-size:12px">' + badge.icon + '</span>' +
    '<span style="font-size:11px;font-weight:700;color:' + badge.color + '">' + badge.text + '</span>' +
    '</div>';
};

/* ── Track when user submits a dispute/support ── */
window.trackSupportSubmit = function(requestId) {
  if (!window.db) return;
  window.db.ref('supportRequests/' + requestId + '/submittedAt').set(Date.now());
};

/* ── Track when admin responds (called from admin panel) ── */
window.trackAdminResponse = function(requestId, submittedAt) {
  if (!window.db) return;
  var responseTime = Date.now() - Number(submittedAt);
  if (responseTime <= 0 || responseTime > 7 * 86400000) return; // Ignore if > 7 days

  window.db.ref('appSettings/adminResponseStats').transaction(function(stats) {
    stats = stats || { totalResponded: 0, totalTimeMs: 0, avgResponseMs: 0 };
    stats.totalResponded += 1;
    stats.totalTimeMs    += responseTime;
    stats.avgResponseMs   = Math.round(stats.totalTimeMs / stats.totalResponded);
    stats.lastUpdated     = Date.now();
    return stats;
  });
};

/* ── Show support page with badge ── */
window.showSupportWithBadge = function() {
  var badge = getResponseBadge();
  var h = '';
  h += '<div style="background:linear-gradient(135deg,rgba(0,255,156,.06),rgba(0,212,255,.04));border:1px solid rgba(0,255,156,.15);border-radius:14px;padding:14px;margin-bottom:16px;text-align:center">';
  h += '<div style="font-size:28px;margin-bottom:6px">👨‍💼</div>';
  h += '<div style="font-size:13px;font-weight:800;margin-bottom:4px">Mini eSports Admin</div>';
  h += '<div style="margin-bottom:8px">' + window.renderAdminBadge() + '</div>';
  if (_responseStats && _responseStats.totalResponded > 5) {
    h += '<div style="font-size:10px;color:#666">' + _responseStats.totalResponded + '+ requests resolved</div>';
  }
  h += '</div>';

  h += '<div style="display:flex;flex-direction:column;gap:8px">';
  [
    { icon:'⚠️', label:'Match Dispute', fn:'showResultDispute' },
    { icon:'💬', label:'Support Chat', fn:'startChat' },
    { icon:'📝', label:'Feedback', fn:'showFeedback' },
  ].forEach(function(btn) {
    h += '<button onclick="if(window.' + btn.fn + ')' + btn.fn + '()" style="width:100%;padding:12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer;text-align:left">' + btn.icon + ' ' + btn.label + '</button>';
  });
  h += '</div>';

  if (window.openModal) openModal('🆘 Help & Support', h);
};

/* ── Load on startup ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { setTimeout(window.loadAdminResponseStats, 2000); });
} else {
  setTimeout(window.loadAdminResponseStats, 2000);
}

})();
