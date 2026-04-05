/* =============================================
   FEATURE 29: Sunday Special + Monthly Special Tournament
   
   SUNDAY SPECIAL:
   - Har Sunday 6 matches (2 solo, 2 duo, 2 squad)
   - Eligibility: Leaderboard top players
   - Auto-unlock cascade:
     - 2hr pehle: Top 48
     - 1hr pehle: Top 100
     - 30min pehle: Top 200
     - Match time: All verified users
   
   MONTHLY SPECIAL:
   - Mahine ke 4th Sunday pe
   - 3 matches: 1 solo, 1 duo, 1 squad
   - Qualify: Sunday Special se top players
     Solo: Top 8 per match × 6 matches = 48
     Duo:  Top 4 teams per match × 6 = 48
     Squad: Top 2 teams per match × 6 = 48
   
   Firebase paths:
   - matches/{mid}/matchType = 'sunday_special' | 'monthly_special'
   - matches/{mid}/eligibilityTier = 'top96'|'top200'|'top400'|'all_verified'
   - sundayQualifiers/{month}/solo = [{uid, rank, matchId}]
   - monthlyEligible/{month}/{mode} = [uid1, uid2, ...]
   ============================================= */
(function() {
  'use strict';

  function getThisMonth() {
    var d = new Date();
    return d.getFullYear() + '_' + String(d.getMonth()+1).padStart(2,'0');
  }

  function isSundaySpecial(match) {
    return match && (match.matchType === 'sunday_special' || match.isSundaySpecial);
  }

  function isMonthlySpecial(match) {
    return match && (match.matchType === 'monthly_special' || match.isMonthlySpecial);
  }

  /* Check if current user is eligible for a special match */
  function checkEligibility(match, callback) {
    if (!window.db || !window.U || !window.UD) { callback(false, 'Login required'); return; }
    if (!isSundaySpecial(match) && !isMonthlySpecial(match)) { callback(true); return; }

    var uid = window.U.uid;
    var isVerified = window.UD.profileStatus === 'approved';
    var tier = match.eligibilityTier || 'top96';
    var now = Date.now();
    var matchTime = Number(match.matchTime) || 0;
    var diff = matchTime - now; // ms until match

    // Determine current allowed tier based on time
    var allowedTier = 'top96';
    if (diff <= 0) allowedTier = 'all_verified';
    else if (diff <= 30 * 60 * 1000) allowedTier = 'all_verified';
    else if (diff <= 60 * 60 * 1000) allowedTier = 'top400';
    else if (diff <= 2 * 60 * 60 * 1000) allowedTier = 'top200';
    else allowedTier = 'top96';

    if (allowedTier === 'all_verified') {
      if (!isVerified) { callback(false, 'Profile verify karo pehle'); return; }
      callback(true); return;
    }

    // Check if user is in eligible list for this match
    var month = getThisMonth();
    var mode = (match.mode || match.gameMode || 'solo').toLowerCase();
    var eligPath = 'monthlyEligible/' + month + '/' + mode;

    if (isMonthlySpecial(match)) {
      window.db.ref(eligPath).once('value', function(s) {
        var list = s.val() || [];
        if (list.indexOf(uid) >= 0) { callback(true); return; }
        // Cascade check
        _cascadeCheck(uid, allowedTier, isVerified, callback);
      });
    } else {
      // Sunday Special - check leaderboard rank
      _cascadeCheck(uid, allowedTier, isVerified, callback);
    }
  }

  function _cascadeCheck(uid, tier, isVerified, callback) {
    if (tier === 'all_verified') {
      callback(isVerified, isVerified ? null : 'Profile verify karo pehle');
      return;
    }
    var limit = tier === 'top96' ? 96 : tier === 'top200' ? 200 : 400;
    // Check leaderboard rank
    // Query users by earnings (leaderboard node may not exist — use users/stats/earnings)
    window.db.ref('users').orderByChild('stats/earnings').limitToLast(limit).once('value', function(s) {
      var inTop = false;
      s.forEach(function(c) { if (c.key === uid) inTop = true; });
      if (inTop) { callback(true); return; }
      // Not in top N
      var msg = 'Abhi sirf Top ' + limit + ' players eligible hain. ';
      if (tier === 'top96') msg += '1 ghante baad Top 200 eligible honge.';
      else if (tier === 'top200') msg += '30 min baad Top 400 eligible honge.';
      else msg += 'Match time par sab verified players eligible honge.';
      callback(false, msg);
    });
  }

  /* Show special match badge on match cards */
  function getSpecialBadge(match) {
    if (isMonthlySpecial(match)) {
      return '<span style="background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:800;display:inline-flex;align-items:center;gap:4px"><i class="fas fa-crown"></i> MONTHLY SPECIAL</span>';
    }
    if (isSundaySpecial(match)) {
      return '<span style="background:linear-gradient(135deg,#b964ff,#00d4ff);color:#fff;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:800;display:inline-flex;align-items:center;gap:4px"><i class="fas fa-star"></i> SUNDAY SPECIAL</span>';
    }
    return '';
  }

  /* Show eligibility countdown for special match */
  function getEligibilityInfo(match) {
    if (!isSundaySpecial(match) && !isMonthlySpecial(match)) return '';
    var now = Date.now();
    var matchTime = Number(match.matchTime) || 0;
    var diff = matchTime - now;
    var tier, timeStr;

    if (diff <= 0 || diff <= 30*60*1000) { tier = '✅ All Verified Players'; timeStr = ''; }
    else if (diff <= 60*60*1000) { tier = '🔵 Top 400 Players'; timeStr = Math.ceil((diff - 30*60*1000)/60000) + ' min mein sabhi verified eligible honge'; }
    else if (diff <= 2*60*60*1000) { tier = '🟡 Top 200 Players'; timeStr = Math.ceil((diff - 60*60*1000)/60000) + ' min mein Top 400 eligible honge'; }
    else { tier = '🔴 Top 96 Players'; timeStr = Math.ceil((diff - 2*60*60*1000)/60000) + ' min mein Top 200 eligible honge'; }

    return '<div style="background:rgba(185,100,255,.08);border:1px solid rgba(185,100,255,.2);border-radius:8px;padding:6px 10px;margin-top:6px;font-size:11px">' +
      '<div style="font-weight:700;color:#b964ff">👑 Eligible: ' + tier + '</div>' +
      (timeStr ? '<div style="color:var(--txt2);margin-top:2px">' + timeStr + '</div>' : '') +
    '</div>';
  }

  window.f29SpecialTournament = {
    isSundaySpecial: isSundaySpecial,
    isMonthlySpecial: isMonthlySpecial,
    checkEligibility: checkEligibility,
    getSpecialBadge: getSpecialBadge,
    getEligibilityInfo: getEligibilityInfo,
    getMonth: getThisMonth
  };
})();
