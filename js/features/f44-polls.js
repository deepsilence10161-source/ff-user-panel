/* ====== FEATURE 44: POLL SYSTEM (User Side) ======
   Admin polls dekhna + vote karna
   Poll card home page ke neeche ya profile section mein
*/
(function(){
'use strict';

window._activePolls = [];

/* Load active polls from Firebase */
window.loadPolls = function() {
  if (!window.db || !window.U) return;
  db.ref('polls').orderByChild('status').equalTo('active').on('value', function(s) {
    window._activePolls = [];
    if (!s.exists()) { renderPollCards(); return; }
    s.forEach(function(c) {
      var p = c.val(); p._key = c.key;
      window._activePolls.push(p);
    });
    renderPollCards();
  });
};

/* Render poll cards in home section */
window.renderPollCards = function() {
  var el = document.getElementById('pollCardsWrap');
  if (!el) return;
  if (!window._activePolls.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  var myVotes = {};
  try { myVotes = JSON.parse(localStorage.getItem('_mes_votes_' + (window.U||{}).uid) || '{}'); } catch(e) {}

  var h = '<div style="margin-bottom:12px">';
  h += '<div style="font-size:11px;font-weight:800;color:var(--txt2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📊 Community Poll</div>';

  window._activePolls.forEach(function(poll) {
    var voted = myVotes[poll._key];
    var totalVotes = 0;
    var opts = poll.options || {};
    Object.values(opts).forEach(function(v) { totalVotes += (v.votes || 0); });

    h += '<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.15);border-radius:14px;padding:14px;margin-bottom:10px">';
    h += '<div style="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:8px">' + (poll.question || 'Poll') + '</div>';

    // Screenshot if any
    if (poll.imageUrl) {
      h += '<img src="' + poll.imageUrl + '" style="width:100%;border-radius:10px;margin-bottom:10px;max-height:150px;object-fit:cover">';
    }

    if (poll.description) {
      h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:10px">' + poll.description + '</div>';
    }

    // Options
    Object.keys(opts).forEach(function(optKey) {
      var opt = opts[optKey];
      var votes = opt.votes || 0;
      var pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      var isMyVote = voted === optKey;
      var barColor = isMyVote ? '#00ff9c' : 'rgba(0,212,255,.5)';

      if (voted) {
        // Show results
        h += '<div style="margin-bottom:6px">';
        h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">';
        h += '<span style="color:' + (isMyVote ? 'var(--green)' : 'var(--txt)') + ';font-weight:' + (isMyVote ? '700' : '400') + '">' + (isMyVote ? '✅ ' : '') + (opt.label || optKey) + '</span>';
        h += '<span style="color:var(--txt2);font-size:11px">' + pct + '% (' + votes + ')</span>';
        h += '</div>';
        h += '<div style="height:6px;background:rgba(255,255,255,.08);border-radius:6px;overflow:hidden">';
        h += '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:6px;transition:width .5s ease"></div></div>';
        h += '</div>';
      } else {
        // Show votable button
        h += '<button onclick="castVote(\'' + poll._key + '\',\'' + optKey + '\')" style="width:100%;margin-bottom:6px;padding:9px 12px;border-radius:10px;background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);color:var(--txt);font-size:12px;font-weight:600;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent">' + (opt.label || optKey) + '</button>';
      }
    });

    h += '<div style="font-size:10px;color:var(--txt2);margin-top:6px;text-align:right">' + totalVotes + ' votes';
    if (voted) h += ' • Voted ✓';
    h += '</div>';
    h += '</div>';
  });

  h += '</div>';
  el.innerHTML = h;
};

/* Cast vote */
window.castVote = function(pollKey, optionKey) {
  if (!window.U) return;
  var uid = window.U.uid;
  var voteRef = db.ref('polls/' + pollKey + '/votes/' + uid);

  voteRef.once('value', function(s) {
    if (s.exists()) { if (window.toast) toast('Tum pehle vote kar chuke ho!', 'inf'); return; }

    // Save vote
    voteRef.set({ option: optionKey, timestamp: Date.now() });
    // Increment option count
    db.ref('polls/' + pollKey + '/options/' + optionKey + '/votes').transaction(function(v) { return (v||0) + 1; });
    // Total votes
    db.ref('polls/' + pollKey + '/totalVotes').transaction(function(v) { return (v||0) + 1; });

    // Save in localStorage
    try {
      var myVotes = JSON.parse(localStorage.getItem('_mes_votes_' + uid) || '{}');
      myVotes[pollKey] = optionKey;
      localStorage.setItem('_mes_votes_' + uid, JSON.stringify(myVotes));
    } catch(e) {}

    if (window.toast) toast('✅ Vote registered!', 'ok');
    window.renderPollCards();
  });
};

/* Inject poll card wrap in home */
function injectPollWrap() {
  var homeList = document.getElementById('homeList');
  if (!homeList) return;
  if (!document.getElementById('pollCardsWrap')) {
    var div = document.createElement('div');
    div.id = 'pollCardsWrap';
    div.style.cssText = 'display:none;padding:0 0 4px 0';
    // Insert before homeList
    homeList.parentNode.insertBefore(div, homeList);
  }
}

// Hook into renderHome
var _t = 0;
var _i = setInterval(function() {
  _t++;
  if (window.renderHome && !window._pollHooked) {
    clearInterval(_i);
    window._pollHooked = true;
    var orig = window.renderHome;
    window.renderHome = function() {
      orig.apply(this, arguments);
      injectPollWrap();
      window.renderPollCards();
    };
  }
  if (_t > 60) clearInterval(_i);
}, 500);

// Auto-load when user data ready
var _t2 = 0, _i2 = setInterval(function() {
  _t2++;
  if (window.U && window.db) { clearInterval(_i2); setTimeout(window.loadPolls, 2000); }
  if (_t2 > 60) clearInterval(_i2);
}, 500);

console.log('[Mini eSports] ✅ Feature 44: Poll System loaded');
})();
