/* =============================================
   FEATURE 14: Post Match Survey
   - Match complete hone ke baad 2 quick questions
   - Admin ko feedback data milta hai Firebase me
   - User ek baar survey de sakta hai per match
   - Firebase: matchFeedback/{matchId}/{uid}
   ============================================= */
(function() {
  'use strict';

  var _surveyedMatches = {};

  function showSurvey(matchId, matchName) {
    if (!window.U || !window.db) return;
    var uid = window.U.uid;
    var key = uid + '_' + matchId;
    if (_surveyedMatches[key]) return;
    _surveyedMatches[key] = true;

    // Check Firebase if already surveyed
    window.db.ref('matchFeedback/' + matchId + '/' + uid).once('value', function(s) {
      if (s.exists()) return; // Already submitted
      renderSurveyModal(matchId, matchName);
    });
  }

  function renderSurveyModal(matchId, matchName) {
    var selected = { rating: 0, experience: '' };

    var h = '<div style="text-align:center">';
    h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:4px">Match feedback</div>';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:16px">' + (matchName || 'Match') + '</div>';

    // Star rating
    h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:8px">Match experience kaisi rahi?</div>';
    h += '<div id="f14Stars" style="display:flex;justify-content:center;gap:8px;margin-bottom:16px">';
    for (var i = 1; i <= 5; i++) {
      h += '<span data-star="' + i + '" onclick="window.f14Survey.setRating(' + i + ')" style="font-size:28px;cursor:pointer;transition:.1s;opacity:.4" id="f14s' + i + '">⭐</span>';
    }
    h += '</div>';

    // Experience options
    h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:8px">Koi specific feedback?</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px">';
    var opts = ['Fair Play था ✅', 'Cheaters थे ❌', 'Smooth Experience 🎮', 'Lag Issues 📶', 'Great Competition 🔥', 'Room Late आई ⏳'];
    opts.forEach(function(opt) {
      h += '<div class="f14-opt" onclick="window.f14Survey.setExp(\'' + opt.replace(/'/g, '') + '\', this)" style="padding:8px;border:1px solid var(--border);border-radius:10px;font-size:11px;cursor:pointer;transition:.1s;color:var(--txt2)">' + opt + '</div>';
    });
    h += '</div>';

    h += '<button onclick="window.f14Survey.submit(\'' + matchId + '\')" style="width:100%;padding:13px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;font-size:14px;border:none;cursor:pointer">Submit Feedback</button>';
    h += '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:8px;border:none;background:transparent;color:var(--txt2);font-size:12px;cursor:pointer;margin-top:4px">Skip</button>';
    h += '</div>';

    if (window.openModal) window.openModal('📝 Quick Feedback', h);
  }

  window.f14Survey = {
    rating: 0,
    experience: '',
    setRating: function(n) {
      this.rating = n;
      for (var i = 1; i <= 5; i++) {
        var el = document.getElementById('f14s' + i);
        if (el) el.style.opacity = i <= n ? '1' : '.3';
      }
    },
    setExp: function(val, el) {
      this.experience = val;
      document.querySelectorAll('.f14-opt').forEach(function(e) {
        e.style.background = 'transparent';
        e.style.borderColor = 'var(--border)';
        e.style.color = 'var(--txt2)';
      });
      if (el) {
        el.style.background = 'rgba(0,255,156,.08)';
        el.style.borderColor = 'rgba(0,255,156,.3)';
        el.style.color = 'var(--green)';
      }
    },
    submit: function(matchId) {
      if (!window.U || !window.db) return;
      if (this.rating === 0) {
        if (window.toast) window.toast('Rating do pehle!', 'err');
        return;
      }
      var data = {
        uid: window.U.uid,
        ign: (window.UD && window.UD.ign) || '',
        rating: this.rating,
        experience: this.experience,
        timestamp: Date.now()
      };
      window.db.ref('matchFeedback/' + matchId + '/' + window.U.uid).set(data);
      if (window.closeModal) window.closeModal();
      if (window.toast) window.toast('Feedback dene ke liye shukriya! 🙏', 'ok');

      // Bonus coin for feedback
      window.db.ref('users/' + window.U.uid + '/coins').transaction(function(c) { return (c||0) + 2; });
    }
  };

  // Hook renderMM to detect completed matches
  function hookRenderMM() {
    var orig = window.renderMM;
    if (!orig || window._f14Hooked) return;
    window._f14Hooked = true;

    window.renderMM = function() {
      orig.apply(this, arguments);
      setTimeout(function() {
        if (!window.MT || !window.JR) return;
        for (var jk in window.JR) {
          var jr = window.JR[jk];
          var mid = jr.matchId || jr.tournamentId;
          if (!mid) continue;
          var match = window.MT[mid];
          if (!match) continue;
          var es = window.effSt ? window.effSt(match) : (match.status || '');
          if (es === 'completed' && !jr._surveyed) {
            jr._surveyed = true;
            setTimeout(function(m) {
              showSurvey(m.id, m.name);
            }.bind(null, match), 1500);
            break; // Only one survey at a time
          }
        }
      }, 500);
    };
  }

  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.renderMM) { clearInterval(_check); hookRenderMM(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f14PostMatchSurvey = { show: showSurvey };
})();
