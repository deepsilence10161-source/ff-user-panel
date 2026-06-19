function renderMM() {
  var l = $('mmList'); if (!l) return;
  var f = [];
  var seenMatchIds = {}; // DEDUP: one card per matchId per user
  for (var k in JR) {
    var jr = JR[k], t = MT[jr.matchId]; if (!t) continue;
    // Skip if already showing this matchId
    if (seenMatchIds[jr.matchId]) continue;
    var es = effSt(t);
    // resultPublished treated as completed for display
    var displaySt = (es === 'resultPublished') ? 'completed' : es;
    if (displaySt !== mmSF) continue;
    seenMatchIds[jr.matchId] = true;
    f.push({ jr: jr, t: t, k: k });
  }
  if (!f.length) { l.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><p>No ' + mmSF + ' matches</p></div>'; return; }
  var h = '';
  f.forEach(function(item) {
    var jr = item.jr, t = item.t;
    var tp = (t.mode || t.type || jr.mode || 'solo').toString().toLowerCase().trim();
    if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
    h += '<div class="mm-card"><div class="mm-head"><span class="mm-name">' + (window.escHtml?window.escHtml(t.name||jr.matchName||'Match'):(t.name||jr.matchName||'Match')) + '</span>';
    var _isTeamMember = jr.isTeamMember && jr.captainUid;
    var _statusLabel = _isTeamMember ? '👥 Team' : '✅ Joined';
    var _captainNote = _isTeamMember ? '<div style="font-size:11px;color:var(--txt2);margin-top:2px"><i class="fas fa-crown" style="color:#ffd700;font-size:9px"></i> Captain: ' + (jr.captainName || 'Teammate') + ' ne join kiya</div>' : '';
    h += '<span class="mm-status ms-a">' + _statusLabel + '</span></div>' + _captainNote;

    /* MY INFO ROW */
    var _myFFUID = (UD && UD.ffUid) ? UD.ffUid : (U ? U.uid.substring(0,10) : '-');
    var _mySlot = jr.slotNumber || null;
    h += '<div style="background:rgba(0,255,156,.05);border:1px solid rgba(0,255,156,.15);border-radius:10px;padding:8px 10px;margin:6px 0">';
    h += '<div style="font-size:10px;color:var(--green);font-weight:700;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">👤 You ' + (_isTeamMember ? '(Team Member)' : '(Captain)') + '</div>';
    h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
    h += '<span style="font-size:12px;font-weight:800;color:var(--green)"><i class="fas fa-fingerprint" style="font-size:10px;margin-right:3px"></i>' + _myFFUID + '</span>';
    h += '<button onclick="copyTxt(\'' + _myFFUID + '\')" style="background:rgba(0,255,156,.12);border:none;color:var(--green);padding:2px 7px;border-radius:5px;font-size:10px;cursor:pointer"><i class="fas fa-copy"></i></button>';
    if (_mySlot) h += '<span style="margin-left:auto;background:rgba(0,255,156,.15);color:var(--green);padding:2px 8px;border-radius:6px;font-size:11px;font-weight:800">Slot ' + _mySlot + '</span>';
    h += '</div></div>';

    /* TEAMMATE ROWS for duo/squad */
    if (jr.teamMembers && jr.teamMembers.length > 1) {
      var myFfUid = UD && UD.ffUid;
      var teammates = jr.teamMembers.filter(function(m) { return m.ffUid !== myFfUid && m.uid !== myFfUid; });
      if (teammates.length > 0) {
        h += '<div style="background:rgba(185,100,255,.05);border:1px solid rgba(185,100,255,.15);border-radius:10px;padding:8px 10px;margin-bottom:6px">';
        h += '<div style="font-size:10px;color:var(--purple);font-weight:700;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">👥 Teammates</div>';
        teammates.forEach(function(m) {
          /* Find original index in full teamMembers array for correct slot */
          var origIdx = jr.teamMembers.indexOf(m);
          var mSlot = (jr.allSlots && origIdx >= 0) ? jr.allSlots[origIdx] : null;
          h += '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-top:1px solid rgba(185,100,255,.08);margin-top:4px">';
          h += '<div style="width:26px;height:26px;border-radius:50%;background:rgba(185,100,255,.15);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--purple)">' + (m.name||'?').charAt(0).toUpperCase() + '</div>';
          h += '<div style="flex:1"><div style="font-size:12px;font-weight:700">' + (m.name||'Teammate') + (m.role==='captain'?' 👑':'') + '</div>';
          if (m.ffUid) h += '<div style="font-size:10px;color:var(--txt2)">FF UID: <span style="color:var(--purple);font-weight:700">' + m.ffUid + '</span></div>';
          h += '</div>';
          if (mSlot) h += '<span style="background:rgba(185,100,255,.15);color:var(--purple);padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800">Slot ' + mSlot + '</span>';
          h += '</div>';
        });
        h += '</div>';
      }
    }
    /* Match details chips */
    h += '<div class="mm-details"><span><i class="fas fa-gamepad"></i> ' + tp.toUpperCase() + '</span>';
    h += '<span><i class="fas fa-coins"></i> ' + (jr.entryFee > 0 ? (jr.entryType==='coin'?'🪙 ':'💎') + jr.entryFee : 'FREE') + '</span>';
    if (t.map) h += '<span><i class="fas fa-map"></i> ' + titleCase(t.map) + '</span>';
    h += '<span><i class="fas fa-clock"></i> ' + fmtTime(t.matchTime) + '</span></div>';
    /* Room display: show ONLY if within release time window - regardless of roomStatus */
    var _roomReady = false;
    var _relMin = Number(t.roomReleaseMinutes) || 5;
    var _matchMsec = Number(t.matchTime) || 0;
    var _releaseAt = _matchMsec > 0 ? _matchMsec - (_relMin * 60000) : 0;
    if (t.roomId && t.roomPassword) {
      if (t.roomStatus === 'released') {
        /* Released manually by admin — respect timing: show only if release time has passed */
        var _releasedAt = Number(t.roomReleasedAt) || 0;
        /* Show if: manual release time has passed OR auto-release time has passed */
        if (_releasedAt > 0 && (window.serverNow?window.serverNow():Date.now()) >= _releasedAt) _roomReady = true;
        else if (_releaseAt > 0 && (window.serverNow?window.serverNow():Date.now()) >= _releaseAt) _roomReady = true;
        else if (_releaseAt <= 0) _roomReady = true; // no matchTime set, show anyway
      } else if (t.roomStatus === 'saved') {
        if (_releaseAt > 0 && (window.serverNow?window.serverNow():Date.now()) >= _releaseAt) _roomReady = true;
      }
    }
    if (_roomReady) {
      h += '<div class="room-box rb-green" style="margin-top:8px"><div style="display:flex;justify-content:space-between;align-items:center"><span><strong>Room ID:</strong> ' + t.roomId + '</span><button onclick="copyTxt(String(t.roomId||\'\'))" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer"><i class="fas fa-copy"></i></button></div>';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span><strong>Password:</strong> ' + t.roomPassword + '</span><button onclick="copyTxt(String(t.roomPassword||\'\'))" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer"><i class="fas fa-copy"></i></button></div></div>';
    } else if (t.roomId && t.roomPassword && _matchMsec > 0 && Date.now() < _releaseAt) {
      /* Room saved but not yet time to show — show countdown */
      var _minLeft = Math.ceil((_releaseAt - Date.now()) / 60000);
      h += '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);border-radius:10px;padding:8px 12px;margin-top:8px;text-align:center"><i class="fas fa-lock" style="color:#ffd700"></i> <span style="font-size:12px;color:#ffd700;font-weight:700">Room ' + _minLeft + ' min mein milegi</span></div>';
    }
    if (t.status === 'cancelled' && jr.refunded) {
      h += '<div style="background:rgba(0,255,106,.08);border:1px solid rgba(0,255,106,.2);border-radius:10px;padding:8px 12px;margin-top:8px;font-size:12px;color:var(--green)"><i class="fas fa-check-circle"></i> Entry fee refunded</div>';
    }
    // Feature 57: Result card
    if (jr.result && window.renderResultCard) h += renderResultCard(jr);
    /* Action buttons row — split into 2 halves */
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">';
    /* Left: Result button (if resultPublished/completed) else Chat button */
    var _matchSt = effSt(t);
    var _hasResult = jr.result || t.status === 'resultPublished' || _matchSt === 'resultPublished';
    if (_hasResult) {
      /* Result publish hua hai — Chat ki jagah Result button dikhao */
      h += '<button onclick="(function(){if(window.showMatchEndAd){window.showMatchEndAd(function(){window.showResultPage&&showResultPage(\'' + t.id + '\')});}else{window.showResultPage&&showResultPage(\'' + t.id + '\');}})()" style="padding:8px;border-radius:8px;background:linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,140,0,.08));border:1px solid rgba(255,215,0,.35);color:#ffd700;font-size:11px;font-weight:800;cursor:pointer"><i class="fas fa-trophy"></i> View Result</button>';
    } else if (_matchSt !== 'completed') {
      /* Match ongoing/upcoming — Chat button */
      h += '<button onclick="window.showMatchChat&&showMatchChat(\'' + t.id + '\')" style="padding:8px;border-radius:8px;background:rgba(185,100,255,.08);border:1px solid rgba(185,100,255,.15);color:var(--purple);font-size:11px;font-weight:700;cursor:pointer"><i class="fas fa-comments"></i> Chat</button>';
    } else {
      h += '<div></div>';
    }
    /* Right: Details button */
    h += '<button onclick="showDet(\'' + t.id + '\')" style="padding:8px;border-radius:8px;background:rgba(0,255,156,.08);border:1px solid rgba(0,255,156,.15);color:var(--green);font-size:11px;font-weight:700;cursor:pointer"><i class="fas fa-info-circle"></i> Details</button>';
    h += '</div>';
    h += '</div>';
  });
  l.innerHTML = h;
  if (window.updateRoomCountdowns) updateRoomCountdowns();
}

/* ====== SHOW MATCH DETAILS ====== */
function showDet(id) {
  var t = MT[id]; if (!t) return;
  history.pushState(null, null, null);
  var tp = (t.mode || t.type || 'solo').toString().toLowerCase().trim();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
  var isCoin = (t.entryType || '').toString().toLowerCase() === 'coin' || Number(t.entryFee) === 0;
  var h = '';
  var _detFFUID = (UD && UD.ffUid) ? UD.ffUid : '';
  if (_detFFUID) {
    h += '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:12px;background:linear-gradient(135deg,rgba(0,255,156,.08),rgba(0,212,255,.04));border:1px solid rgba(0,255,156,.2);border-radius:12px">';
    h += '<div style="width:38px;height:38px;border-radius:50%;background:rgba(0,255,156,.12);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:var(--green)">' + (UD.ign||'P').charAt(0).toUpperCase() + '</div>';
    h += '<div style="flex:1"><div style="font-size:11px;color:var(--txt2)">Playing As</div><div style="font-size:14px;font-weight:800">' + (window.escHtml?window.escHtml(UD.ign||'Player'):(UD.ign||'Player')) + '</div><div style="font-size:12px;font-weight:700;color:var(--green)">FF UID: ' + _detFFUID + '</div></div>';
    h += '<button onclick="copyTxt(\'' + _detFFUID + '\')" style="background:rgba(0,255,156,.12);border:none;color:var(--green);padding:8px 10px;border-radius:8px;font-size:11px;cursor:pointer"><i class="fas fa-copy"></i></button>';
    h += '</div>';
  }
  h += '<div class="d-row"><span class="dl">Match Name</span><span class="dv">' + (window.escHtml?window.escHtml(t.name||'Match'):(t.name||'Match')) + '</span></div>';
  h += '<div class="d-row"><span class="dl">Mode</span><span class="dv">' + tp.toUpperCase() + '</span></div>';
  // Only show Match Type for special tournaments
  if (t.matchType && t.matchType !== 'normal' && t.matchType !== (t.mode||'solo').toLowerCase()) {
    h += '<div class="d-row"><span class="dl">Match Type</span><span class="dv">' + t.matchType + '</span></div>';
  }
  if (t.map) h += '<div class="d-row"><span class="dl">Map</span><span class="dv">' + titleCase(t.map) + '</span></div>';
  h += '<div class="d-row"><span class="dl">Start Time</span><span class="dv blue">' + fmtTime(t.matchTime) + '</span></div>';
  // Prize Pool removed from detail
  h += '<div class="d-row"><span class="dl">Entry Fee</span><span class="dv ' + (isCoin ? 'yellow' : 'green') + '">' + (isCoin ? '🪙 ' : '💎') + (t.entryFee || 0) + '</span></div>';
  h += '<div class="d-row"><span class="dl">Slots</span><span class="dv">' + (t.joinedSlots || 0) + '/' + (t.maxSlots || 0) + '</span></div>';
  var _d1 = t.firstPrize || t.prize1st || 0;
  var _d2 = t.secondPrize || t.prize2nd || 0;
  var _d3 = t.thirdPrize || t.prize3rd || 0;
  if (_d1 || _d2 || _d3) {
    h += '<div style="margin-top:14px;padding:14px;background:linear-gradient(135deg,rgba(255,215,0,.08),rgba(255,215,0,.02));border:1px solid rgba(255,215,0,.2);border-radius:12px">';
    h += '<div style="font-size:14px;font-weight:700;color:var(--yellow);margin-bottom:10px"><i class="fas fa-trophy"></i> Prize Breakdown</div>';
    if (_d1) h += '<div class="d-row"><span class="dl">🥇 1st Prize</span><span class="dv green">💎' + _d1 + '</span></div>';
    if (_d2) h += '<div class="d-row"><span class="dl">🥈 2nd Prize</span><span class="dv">💎' + _d2 + '</span></div>';
    if (_d3) h += '<div class="d-row"><span class="dl">🥉 3rd Prize</span><span class="dv">💎' + _d3 + '</span></div>';
    h += '</div>';
  }
  if (t.description) h += '<div style="margin-top:12px;padding:12px;background:var(--card);border-radius:10px;font-size:13px;color:var(--txt2);line-height:1.5">' + t.description + '</div>';
  /* Room display: timing-based (same logic as My Matches) */
  var _dRelMin = Number(t.roomReleaseMinutes) || 5;
  var _dMatchMs = Number(t.matchTime) || 0;
  var _dReleaseAt = _dMatchMs > 0 ? _dMatchMs - (_dRelMin * 60000) : 0;
  var _dRoomReady = false;
  if (t.roomId && t.roomPassword) {
    if (t.roomStatus === 'released') {
      var _dRelAt = Number(t.roomReleasedAt) || 0;
      if (_dRelAt > 0 && Date.now() >= _dRelAt) _dRoomReady = true;
      else if (_dReleaseAt > 0 && Date.now() >= _dReleaseAt) _dRoomReady = true;
      else if (_dReleaseAt <= 0) _dRoomReady = true;
    } else if (t.roomStatus === 'saved' && _dReleaseAt > 0 && Date.now() >= _dReleaseAt) {
      _dRoomReady = true;
    }
  }
  if (_dRoomReady) {
    if (hasJ(id)) {
      h += '<div class="room-box rb-green" style="margin-top:12px"><div class="rp-label">Room ID</div><div style="display:flex;justify-content:space-between;align-items:center"><span class="room-big">' + t.roomId + '</span><button onclick="copyTxt(String(t.roomId||\'\'))" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div>';
      h += '<div class="rp-label" style="margin-top:8px">Password</div><div style="display:flex;justify-content:space-between;align-items:center"><span class="room-big">' + t.roomPassword + '</span><button onclick="copyTxt(String(t.roomPassword||\'\'))" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div></div>';
    } else { h += '<div class="room-box rb-yellow" style="margin-top:12px"><i class="fas fa-lock"></i> Join the match to see room details</div>'; }
  } else { h += '<div class="room-box rb-blue" style="margin-top:12px"><i class="fas fa-clock"></i> Room details will be shared before match start</div>'; }
  // Share Match button removed
  /* Bug 78 Fix: Only show share button for upcoming/live matches */
  var _shareStatus = (jr.status || '').toLowerCase();
  var _matchStatus = jr.matchId && window.MT && window.MT[jr.matchId] ? (window.MT[jr.matchId].status || '').toLowerCase() : _shareStatus;
  if (_matchStatus !== 'cancelled' && _matchStatus !== 'completed') {
    h += '<button onclick="shareMatch(\'' + id + '\')" style="width:100%;margin-top:14px;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-share-alt"></i> ⚡ Invite Friends</button>';
  }
  h += '<button onclick="window.shareToInstagram&&shareToInstagram(\'' + id + '\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#e1306c,#833ab4,#f77737);color:#fff;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fab fa-instagram"></i> Share to Instagram Stories</button>';

  // Watchlist button removed

  // Feature 1: Match Reminder
  if (t.matchTime && Number(t.matchTime) > (window.serverNow?window.serverNow():Date.now())) {
    h += '<button onclick="window.setMatchReminder&&setMatchReminder(\'' + id + '\',' + t.matchTime + ',\'' + (t.name||'Match') + '\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--txt2);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-bell"></i> Set Match Reminder</button>';
  }

  // Feature 45: Interest toggle
  h += '<button onclick="window.toggleInterest&&toggleInterest(\'' + id + '\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--txt2);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-hand-paper"></i> Mark as Interested</button>';

  // Feature 8: Roster Viewer
  // View Roster button removed

  // Feature 47: Match Chat (for joined players)
  if (hasJ(id)) {
    h += '<button onclick="window.showMatchChat&&showMatchChat(\'' + id + '\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(185,100,255,.2);background:rgba(185,100,255,.06);color:var(--purple);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-comments"></i> Match Chat</button>';
    // Kill Proof separate button removed — screenshot added inside Report Dispute
    h += '<button onclick="window.showResultDispute&&showResultDispute(\'' + id + '\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(255,170,0,.2);background:rgba(255,170,0,.06);color:#ffaa00;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-exclamation-triangle"></i> Report Dispute</button>';
    // Share Result Viral Card
    if (effSt(t) === 'completed') {
      var _jr = t.joinedPlayers && t.joinedPlayers[U.uid];
      var _myRank = (_jr && _jr.result && _jr.result.rank) || 0;
      var _myKills = (_jr && _jr.result && _jr.result.kills) || 0;
      h += '<button onclick="window.showShareCard&&showShareCard(\'' + id + '\',' + JSON.stringify(0) + ',' + JSON.stringify(0) + ',\'' + '\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(0,255,156,.2);background:rgba(0,255,156,.06);color:var(--green);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-share-alt"></i> Result Share Karo (+20🪙)</button>';
    }
    h += '<button onclick="window.showReportPlayer&&showReportPlayer(\'' + id + '\',\'\',\'Player\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(255,46,46,.2);background:rgba(255,46,46,.06);color:var(--red);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-flag"></i> 🚩 Report Player with Proof</button>';
  }

  // Live Feed button removed

  // Feature 36: Post-match feedback
  if (effSt(t) === 'completed' && hasJ(id)) {
    h += '<button onclick="window.showMatchFeedback&&showMatchFeedback(\'' + id + '\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(255,215,0,.2);background:rgba(255,215,0,.06);color:#ffd700;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-star"></i> Rate This Match</button>';
  }

  // Gift a Ticket — send match entry to a friend
  if (!hasJ(id) && effSt(t) !== 'completed') {
    h += '<button onclick="giftTicket(\'' + id + '\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(255,215,0,.25);background:rgba(255,215,0,.07);color:#ffd700;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-gift"></i> 🎁 Gift Entry to Friend</button>';
  }
  // QR Team Up — show QR for friend to scan and join squad
  if (tp !== 'solo' && !hasJ(id)) {
    h += '<button onclick="showTeamQR(\'' + id + '\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:1px solid rgba(0,212,255,.25);background:rgba(0,212,255,.07);color:var(--blue);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-qrcode"></i> QR Code se Team Join karo</button>';

    // ── Auto-Squad/Duo join option ──
    var _tm = (t.teamMode||t.matchType||'').toLowerCase();
    var _isSquad = _tm.includes('squad') || t.gameMode === 'squad';
    var _isDuo   = _tm.includes('duo')   || t.gameMode === 'duo';
    var _autoEnabled = window.CFG && window.CFG.autoSquadEnabled;
    if (_autoEnabled && (_isSquad || _isDuo) && effSt(t) === 'upcoming') {
      var _autoMode = _isSquad ? 'squad' : 'duo';
      var _autoNeeded = _isSquad ? 4 : 2;
      h += '<button onclick="if(window.showAutoSquadJoin)showAutoSquadJoin(\'' + id + '\',\''+_autoMode+'\')" ' +
        'style="width:100%;margin-top:8px;padding:12px;border-radius:12px;background:linear-gradient(135deg,rgba(0,255,156,.08),rgba(0,212,255,.06));border:1px solid rgba(0,255,156,.2);color:var(--green);font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">' +
        '<i class="fas fa-users"></i> Akele ho? Auto ' + (_isSquad?'Squad':'Duo') + ' Join Karo!</button>';
    }

    // ── Pre-match Check-In button ──
    if (window.CFG && window.CFG.checkInEnabled && window.renderCheckInBtn) {
      h += window.renderCheckInBtn(id, t);
    }

    // ── Watch & Earn button for live ──
    if ((t.streamLink || t.youtubeLink) && effSt(t) === 'live' && window.CFG && window.CFG.watchEarnEnabled) {
      h += '<button onclick="if(window.startWatching)startWatching(\'' + id + '\')" ' +
        'style="width:100%;margin-top:8px;padding:11px;border-radius:12px;background:linear-gradient(135deg,rgba(255,68,68,.12),rgba(204,0,0,.08));border:1px solid rgba(255,68,68,.25);color:#ff6b6b;font-size:13px;font-weight:800;cursor:pointer">' +
        '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff4444;margin-right:7px;vertical-align:middle"></span>👀 Watch & Earn Coins</button>';
    }
  }

  openModal('Match Details', h);
}

/* ====== GIFT TICKET ====== */
function giftTicket(matchId) {
  var t = MT[matchId]; if (!t) return;
  var fee = Number(t.entryFee) || 0;
  var isCoin = (t.entryType || '').toLowerCase() === 'coin';
  var bal = isCoin ? (UD.coins||0) : getMoneyBal();
  if (bal < fee) { toast('Insufficient balance to gift entry', 'err'); return; }
  var h = '<div style="text-align:center;padding:8px">';
  h += '<div style="font-size:40px;margin-bottom:8px">🎁</div>';
  h += '<div style="font-size:15px;font-weight:800;margin-bottom:4px">Gift Match Entry</div>';
  h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">Apne dost ke FF UID enter karo — unki entry fee tumhare wallet se kategi</div>';
  h += '<div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px">';
  h += '<span style="color:var(--txt2)">Match:</span> <strong>' + (window.escHtml?window.escHtml(t.name||'Match'):(t.name||'Match')) + '</strong><br>';
  h += '<span style="color:var(--txt2)">Fee:</span> <strong style="color:#ffd700">' + (isCoin ? '🪙 ' : '💎') + fee + ' will be deducted from you</strong></div>';
  h += '<input id="giftToUid" class="f-input" placeholder="Friend ka FF UID" style="margin-bottom:12px">';
  h += '<button onclick="confirmGiftTicket(\'' + matchId + '\')" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;border:none;font-weight:800;font-size:14px;cursor:pointer">🎁 Send Gift Entry!</button>';
  h += '</div>';
  openModal('Gift a Ticket', h);
}
function confirmGiftTicket(matchId) {
  var t = MT[matchId]; if (!t) return;
  var ffUid = ($('giftToUid')||{}).value; if (!ffUid || ffUid.trim().length < 5) { toast('Valid FF UID enter karo', 'err'); return; }
  ffUid = ffUid.trim();
  var isCoin = (t.entryType||'').toLowerCase() === 'coin';
  var fee = Number(t.entryFee)||0;
  // Find user by FF UID
  _findUserByFF(ffUid, function(friendUid, friendData) {
    if (!friendUid || !friendData) { toast('Player not found with this FF UID', 'err'); return; }
    if (friendUid === U.uid) { toast('Apne aap ko gift nahi kar sakte 😄', 'err'); return; }
    // Deduct from sender
    if (isCoin) {
      /* Bug Fix: Use atomic decrement_balance RPC instead of non-atomic transaction() */
      if (window._supa) {
        window._supa.rpc('decrement_balance', { p_uid: U.uid, p_col: 'coins', p_amount: fee }).catch(function(){});
      } /* Supabase decrement_balance handles it */
    }
    else deductMoney(fee, 'Gift to ' + (friendData.ign||ffUid) + ' - ' + (t.name||'Match'));
    /* ✅ Supabase gift_tickets table */
    if (window._supa) {
      window._supa.from('gift_tickets').insert({
        from_uid:   U.uid,
        from_name:  UD.ign || UD.displayName || '',
        to_uid:     friendUid,
        to_ff_uid:  ffUid,
        match_id:   matchId,
        match_name: t.name || '',
        fee:        fee,
        entry_type: t.entryType || 'paid',
        status:     'pending'
      }).then(function(gr) {
        /* Notify friend via Supabase notifications */
        window._supa.from('notifications').insert({
          user_id: friendUid,
          type:    'gift_ticket',
          title:   '🎁 Match Ticket Gift!',
          body:    (UD.ign||'A friend') + ' ne tumhe "' + (t.name||'Match') + '" ka entry ticket gift kiya!'
        }).catch(function(){});
        closeModal();
        toast('🎁 Gift ticket sent successfully!', 'ok');
      }).catch(function(e) {
        toast('Gift send failed — retry karo', 'err');
        console.error('[Gift]', e);
      });
    } else {
      closeModal();
      toast('🎁 Gift ticket sent!', 'ok');
    }
  });
}

/* ====== QR TEAM UP ====== */
function showTeamQR(matchId) {
  var t = MT[matchId]; if (!t) return;
  var joinLink = 'https://student-4356.github.io/FF-User-Panel/?join=' + matchId + '&ref=' + (UD.ffUid||U.uid.substr(0,8));
  var h = '<div style="text-align:center;padding:8px">';
  h += '<div style="font-size:14px;font-weight:800;margin-bottom:4px">📱 QR Code se Join karo</div>';
  h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:12px">Apne teammate ko yeh QR scan karne do — wo directly is match lobby mein aa jayega</div>';
  // Generate QR using API
  h += '<div style="background:#fff;padding:16px;border-radius:12px;display:inline-block;margin-bottom:12px">';
  h += '<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(joinLink) + '" style="width:180px;height:180px;display:block">';
  h += '</div>';
  h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:8px">Ya link share karo:</div>';
  h += '<div style="display:flex;gap:8px">';
  h += '<input readonly value="' + joinLink + '" class="f-input" style="flex:1;font-size:10px">';
  h += '<button onclick="copyTxt(\'' + joinLink + '\')" style="padding:10px 14px;border-radius:10px;background:rgba(0,255,106,.12);border:1px solid rgba(0,255,106,.2);color:var(--green);cursor:pointer"><i class="fas fa-copy"></i></button>';
  h += '</div></div>';
  openModal('🔗 Team QR', h);
}

/* ====== JOIN SYSTEM ====== */
