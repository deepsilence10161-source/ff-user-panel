/* ====== ANTI-FRAUD COMPLETE SYSTEM (User Panel) ======
   Features:
   - Device change cooldown (24h)
   - Geo-location mismatch warning
   - Mass reporting trigger
   - Real-time cheat reporting button
   - Entry refund if room not opened
   - Match attendance verification
   - Risk level indicator
   - Trusted player tag
   - Match integrity score
   - Auto-flag repeated top winners
*/
(function(){
'use strict';

/* ══ 1. DEVICE CHANGE COOLDOWN (24h) ══ */
window.checkDeviceCooldown = function(uid) {
  if (!window.db || !uid) return Promise.resolve(true);
  var currentFP = window.getStrongFingerprint ? window.getStrongFingerprint() : 'unknown';
  return db.ref('users/' + uid + '/deviceFP').once('value').then(function(s) {
    var saved = s.val();
    if (!saved || !saved.fp) return true; // First time = allow
    if (saved.fp === currentFP) return true; // Same device = allow
    // Different device — check last change time
    var lastChange = saved.changedAt || 0;
    var hoursSince = (Date.now() - lastChange) / 3600000;
    if (hoursSince < 24) {
      var hoursLeft = Math.ceil(24 - hoursSince);
      return Promise.reject('Device change detected! ' + hoursLeft + 'h baad try karo. (Anti-fraud protection)');
    }
    // 24h passed — update device
    db.ref('users/' + uid + '/deviceFP').update({ fp: currentFP, changedAt: Date.now() });
    // Log device change
    db.ref('adminAlerts').push({
      type: 'device_change',
      uid: uid,
      oldFP: saved.fp,
      newFP: currentFP,
      timestamp: Date.now(),
      severity: 'LOW',
      message: 'User ne device change kiya (24h cooldown expired)'
    });
    return true;
  });
};

/* ══ 2. GEO-LOCATION MISMATCH WARNING ══ */
window.checkGeoMismatch = function(uid) {
  if (!navigator.geolocation || !window.db) return;
  navigator.geolocation.getCurrentPosition(function(pos) {
    var lat = pos.coords.latitude, lon = pos.coords.longitude;
    // India bounds check: lat 8-37, lon 68-97
    var inIndia = (lat >= 8 && lat <= 37 && lon >= 68 && lon <= 97);
    db.ref('users/' + uid + '/geo').once('value', function(s) {
      var saved = s.val();
      if (!saved || !saved.country) {
        // First time — save
        db.ref('users/' + uid + '/geo').set({ lat: lat, lon: lon, inIndia: inIndia, savedAt: Date.now() });
        return;
      }
      // Check if location drastically changed (> 1000km movement in < 1 hour = suspicious)
      var distKm = Math.sqrt(Math.pow(lat - saved.lat, 2) + Math.pow(lon - saved.lon, 2)) * 111;
      var hoursSince = (Date.now() - (saved.savedAt || 0)) / 3600000;
      if (distKm > 800 && hoursSince < 2) {
        // Impossible travel — VPN or fake location
        db.ref('adminAlerts').push({
          type: 'geo_anomaly',
          uid: uid,
          message: 'Impossible location change: ' + Math.round(distKm) + 'km in ' + hoursSince.toFixed(1) + 'h (VPN suspected)',
          timestamp: Date.now(),
          severity: 'MEDIUM'
        });
        if (window.toast) toast('⚠️ Location anomaly detected. Account flagged for review.', 'err');
      }
      db.ref('users/' + uid + '/geo').update({ lat: lat, lon: lon, inIndia: inIndia, savedAt: Date.now() });
    });
  }, null, { timeout: 5000 });
};

/* ══ 3. REAL-TIME CHEAT REPORTING BUTTON ══ */
window.openCheatReport = function(matchId, matchName) {
  if (!window.U) return;
  var h = '<div>';
  h += '<div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.2);border-radius:12px;padding:12px;margin-bottom:14px">';
  h += '<div style="font-size:12px;color:#ff6464;font-weight:700;margin-bottom:4px">⚠️ Cheater Report</div>';
  h += '<div style="font-size:11px;color:var(--txt2)">Match: ' + (matchName || matchId) + '</div></div>';

  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Cheater\'s FF UID</label>';
  h += '<input id="crUid" type="text" placeholder="e.g. 12345678" style="width:100%;padding:9px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-size:13px;box-sizing:border-box"></div>';

  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Cheat Type</label>';
  h += '<select id="crType" style="width:100%;padding:9px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-size:13px">';
  h += '<option value="aimbot">🎯 Aimbot / Auto-aim</option>';
  h += '<option value="wallhack">👁️ Wallhack / ESP</option>';
  h += '<option value="speed">⚡ Speed Hack</option>';
  h += '<option value="fake_kills">💀 Fake Kill Count</option>';
  h += '<option value="fake_rank">🏆 Fake Rank Screenshot</option>';
  h += '<option value="teaming">🤝 Teaming with Enemy</option>';
  h += '<option value="other">❓ Other</option>';
  h += '</select></div>';

  h += '<div style="margin-bottom:14px"><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Extra Details (optional)</label>';
  h += '<textarea id="crDesc" rows="3" maxlength="300" placeholder="Kya dekha describe karo..." style="width:100%;padding:9px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-size:12px;resize:none;box-sizing:border-box"></textarea></div>';

  h += '<button onclick="submitCheatReport(\'' + matchId + '\')" style="width:100%;padding:12px;border-radius:10px;background:linear-gradient(135deg,#ff4444,#cc2222);color:#fff;font-weight:800;border:none;cursor:pointer;font-size:13px">🚨 Submit Report</button>';
  h += '</div>';
  if (window.openModal) openModal('🚨 Report Cheater', h);
};

window.submitCheatReport = function(matchId) {
  var ffUid = ((document.getElementById('crUid')||{}).value||'').trim();
  var type = ((document.getElementById('crType')||{}).value||'other');
  var desc = ((document.getElementById('crDesc')||{}).value||'').trim();

  if (!ffUid || ffUid.length < 5) { if(window.toast) toast('FF UID enter karo', 'err'); return; }

  // Rate limit: per match only 1 report per user
  var _ck = '_mes_cr_' + (window.U||{}).uid + '_' + matchId;
  if (localStorage.getItem(_ck)) { if(window.toast) toast('Is match ke liye already report kiya hai', 'inf'); return; }

  var reportData = {
    reportedByUid: (window.U||{}).uid,
    reportedByName: (window.UD && (window.UD.ign || window.UD.displayName)) || 'User',
    targetFfUid: ffUid,
    matchId: matchId,
    cheatType: type,
    description: desc,
    status: 'pending',
    timestamp: Date.now()
  };

  db.ref('cheatReports').push(reportData).then(function() {
    localStorage.setItem(_ck, '1');
    // Check if 3+ reports for same FF UID in same match = auto-flag
    db.ref('cheatReports').orderByChild('targetFfUid').equalTo(ffUid).once('value', function(s) {
      var matchReports = 0;
      if (s.exists()) s.forEach(function(c) {
        if (c.val().matchId === matchId) matchReports++;
      });
      if (matchReports >= 3) {
        // Mass reporting triggered — auto alert admin
        db.ref('adminAlerts').push({
          type: 'mass_cheat_report',
          targetFfUid: ffUid,
          matchId: matchId,
          reportCount: matchReports,
          timestamp: Date.now(),
          severity: 'HIGH',
          message: ffUid + ' ko ' + matchReports + ' users ne cheat report kiya ek hi match mein!'
        });
      }
    });
    if(window.toast) toast('✅ Report submitted! Admin review karega.', 'ok');
    if(window.closeModal) closeModal();
  });
};

/* ══ 4. ENTRY REFUND IF ROOM NOT OPENED ══ */
// Match time + 30 min ke baad bhi room nahi aaya to auto-refund
window.checkRoomNotOpenedRefund = function() {
  if (!window.U || !window.JR || !window.MT) return;
  Object.keys(window.JR).forEach(function(jrKey) {
    var jr = window.JR[jrKey];
    if (!jr || jr.userId !== window.U.uid) return;
    if (jr.refundedNoRoom) return; // Already refunded
    var match = window.MT[jr.matchId];
    if (!match) return;
    var matchTime = Number(match.matchTime) || 0;
    if (!matchTime) return;
    var elapsed = Date.now() - matchTime; // ms since match time
    // 45 minutes passed AND room still not released AND match not completed
    var roomReleased = match.roomStatus === 'released' && match.roomId;
    var matchDone = (match.status || '').toLowerCase() === 'completed' || (match.status || '').toLowerCase() === 'resultpublished';
    if (elapsed > 45 * 60000 && !roomReleased && !matchDone) {
      var fee = Number(jr.entryFee || match.entryFee) || 0;
      var entryType = (jr.entryType || match.entryType || '').toLowerCase();
      if (fee <= 0) return;
      // Request refund (admin approval needed)
      db.ref('joinRequests/' + jrKey + '/refundedNoRoom').set(true);
      db.ref('refundRequests').push({
        uid: window.U.uid,
        matchId: jr.matchId,
        matchName: match.name || '',
        jrKey: jrKey,
        reason: 'room_not_opened',
        fee: fee,
        entryType: entryType,
        requestedAt: Date.now(),
        status: 'auto_pending'
      });
      // Notify user
      if (window.toast) toast('⏳ Room 45 min se nahi aaya — refund request submit ho gayi!', 'ok');
      db.ref('adminAlerts').push({
        type: 'room_not_opened_refund',
        uid: window.U.uid,
        matchId: jr.matchId,
        matchName: match.name || '',
        fee: fee,
        entryType: entryType,
        timestamp: Date.now(),
        severity: 'HIGH',
        message: 'Match "' + (match.name||jr.matchId) + '" mein room 45 min baad bhi release nahi hua. Auto-refund requested.'
      });
    }
  });
};

// Check every 5 min
setInterval(function() {
  if (window.U && window.JR && window.MT) window.checkRoomNotOpenedRefund();
}, 5 * 60000);

/* ══ 5. RISK LEVEL INDICATOR (on profile) ══ */
window.getUserRiskLevel = function(ud) {
  if (!ud) return { level: 'LOW', color: '#00ff9c', icon: '✅' };
  var score = 0;
  if (ud.banned) score += 100;
  if (ud.flags && ud.flags.multiAccount) score += 40;
  if (ud.flags && ud.flags.fakeScreenshot) score += 30;
  var createdAt = Number(ud.createdAt) || Date.now();
  var daysSince = (Date.now() - createdAt) / 86400000;
  if (daysSince < 3) score += 15; // New account
  if ((ud.stats && ud.stats.matches || 0) < 2) score += 10;
  if (ud.reputation && ud.reputation < 0) score += 20;

  if (score >= 50) return { level: 'HIGH', color: '#ff4444', icon: '🔴', score: score };
  if (score >= 20) return { level: 'MEDIUM', color: '#ffaa00', icon: '🟡', score: score };
  return { level: 'LOW', color: '#00ff9c', icon: '🟢', score: score };
};

/* ══ 6. TRUSTED PLAYER TAG ══ */
window.renderTrustedBadge = function(ud) {
  if (!ud || !ud.trustedPlayer) return '';
  return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:8px;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.25);font-size:10px;font-weight:700;color:#00d4ff">🛡️ Trusted</span>';
};

/* ══ 7. MATCH INTEGRITY SCORE (visible on match detail) ══ */
window.calcMatchIntegrity = function(match) {
  var score = 100;
  var issues = [];
  var js = Number(match.joinedSlots) || 0, ms = Number(match.maxSlots) || 1;
  // Low participation = less competitive
  if (js < ms * 0.5) { score -= 15; issues.push('Low participation'); }
  // No room released before match time + 30min = integrity issue
  if (match.matchTime && Date.now() > Number(match.matchTime) + 1800000 && !match.roomId) {
    score -= 30; issues.push('Room not released');
  }
  // Result published very fast (< 10 min after match) = suspicious
  if (match.resultPublishedAt && match.matchTime) {
    var timeDiff = (Number(match.resultPublishedAt) - Number(match.matchTime)) / 60000;
    if (timeDiff < 10) { score -= 20; issues.push('Result too fast'); }
  }
  score = Math.max(0, score);
  var color = score >= 80 ? '#00ff9c' : score >= 50 ? '#ffaa00' : '#ff4444';
  return { score: score, color: color, issues: issues };
};

/* ══ 8. AUTO-FLAG REPEATED TOP WINNERS ══ */
window.checkRepeatedWinner = function(uid, matchId) {
  if (!window.db) return;
  db.ref('joinRequests').orderByChild('userId').equalTo(uid).limitToLast(50).once('value', function(s) {
    if (!s.exists()) return;
    var wins = 0, total = 0;
    s.forEach(function(c) {
      var jr = c.val();
      if (jr.status === 'completed' || jr.result) total++;
      if (jr.result && (jr.result.rank === 1 || jr.result.rank === '1')) wins++;
    });
    // Win rate > 80% with 10+ matches = suspicious
    if (total >= 10 && wins / total > 0.8) {
      db.ref('adminAlerts').push({
        type: 'repeated_winner',
        uid: uid,
        wins: wins,
        total: total,
        winRate: Math.round((wins/total)*100),
        timestamp: Date.now(),
        severity: 'MEDIUM',
        message: uid + ' ka win rate ' + Math.round((wins/total)*100) + '% hai (' + wins + '/' + total + ' matches). Suspicious!'
      });
    }
  });
};

/* ══ 9. ADD REPORT BUTTON TO MY MATCHES ══ */
// Inject report button in match result cards
window.getCheatReportBtn = function(matchId, matchName) {
  return '<button onclick="openCheatReport(\'' + matchId + '\',\'' + (matchName||'').replace(/'/g,'') + '\')" style="padding:5px 10px;border-radius:8px;background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.2);color:#ff6464;font-size:10px;font-weight:700;cursor:pointer;margin-top:6px"><i class="fas fa-flag"></i> Report</button>';
};

/* ══ AUTO-INIT ══ */
var _initT = 0;
var _initI = setInterval(function() {
  _initT++;
  if (window.U && window.db && window.UD) {
    clearInterval(_initI);
    var uid = window.U.uid;
    // Geo check (background, silent)
    setTimeout(function() { window.checkGeoMismatch(uid); }, 3000);
    // Device cooldown check on join
    // Room refund check
    setTimeout(function() { window.checkRoomNotOpenedRefund(); }, 10000);
  }
  if (_initT > 60) clearInterval(_initI);
}, 500);

// Hook into doJoin for device cooldown check
var _djI = setInterval(function() {
  if (window.doJoin && !window._djHooked) {
    clearInterval(_djI);
    window._djHooked = true;
    var origDJ = window.doJoin;
    window.doJoin = function(id) {
      if (!window.U) { origDJ(id); return; }
      window.checkDeviceCooldown(window.U.uid).then(function() {
        origDJ(id);
      }).catch(function(msg) {
        if (window.toast) toast('🔒 ' + msg, 'err');
      });
    };
  }
}, 800);

console.log('[Mini eSports] ✅ Anti-Fraud Complete System loaded');
})();
