/* ====== HELPERS ====== */
function $(id) { return document.getElementById(id); }

function toast(msg, type) {
  var w = $('toast-wrap'); if (!w) return;
  var d = document.createElement('div');
  d.className = 'toast-item t' + (type || 'ok');
  var ic = type === 'err' ? 'exclamation-circle' : type === 'inf' ? 'info-circle' : 'check-circle';
  d.innerHTML = '<i class="fas fa-' + ic + '"></i>' + msg;
  w.appendChild(d);
  setTimeout(function() { d.remove(); }, 1800);
}

function timeAgo(ts) {
  if (!ts) return '';
  var d = Date.now() - ts;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
  if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
  return Math.floor(d / 86400000) + 'd ago';
}

function fmtTime(mt) {
  if (!mt) return 'Time Not Announced';
  var ts = Number(mt);
  if (isNaN(ts) || ts <= 0) return 'Time Not Announced';
  var now = Date.now(), diff = ts - now;
  // Match time has passed
  if (diff <= 0) {
    var elapsed = now - ts;
    if (elapsed < 3600000) return 'Live Now'; // within 1 hour after start
    return 'Match Ended';
  }
  // Within 5 minutes — going live soon
  if (diff <= 300000) {
    var mins = Math.ceil(diff / 60000);
    return 'Starting in ' + mins + ' min!';
  }
  // Within 24 hours
  if (diff < 86400000) {
    var h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
    return 'Starts in: ' + h + 'h ' + m + 'm';
  }
  // More than 24 hours — show full date
  var d = new Date(ts);
  var mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var hr = d.getHours(), ap = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12 || 12;
  return d.getDate().toString().padStart(2, '0') + ' ' + mo[d.getMonth()] + ' ' + d.getFullYear() + ', ' + hr.toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0') + ' ' + ap;
}

function titleCase(s) {
  if (!s) return '';
  return s.replace(/\w\S*/g, function(t) { return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase(); });
}

function copyTxt(t) {
  /* ✅ Bug 30 Fix: navigator.clipboard with proper iOS fallback */
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t)
      .then(function() { toast('✅ Copied!', 'ok'); })
      .catch(function() { fbCopy(t); }); /* Permission denied — use fallback */
  } else {
    fbCopy(t);
  }
}
function fbCopy(t) {
  /* Fallback for iOS 13+ and older browsers */
  try {
    var ta = document.createElement('textarea');
    ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    /* iOS requires a range selection */
    if (navigator.userAgent.match(/ipad|iphone/i)) {
      var range = document.createRange();
      range.selectNodeContents(ta);
      var sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      ta.setSelectionRange(0, 999999);
    } else {
      ta.select();
    }
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) {
      toast('✅ Copied!', 'ok');
    } else {
      /* Manual instruction as last resort */
      toast('📋 Manually select and copy: ' + t.substring(0, 30) + '...', 'inf');
    }
  } catch(e) {
    toast('📋 Copy nahi hua — manually select karo', 'err');
  }
}

/* ====== SMART MATCH STATUS ====== */
/* Rules (STRICT — recalculated FRESH on every call):
   - Admin terminal states ALWAYS win (cancelled/completed/finished/ended/done)
   - Time-based automatic transitions:
     * Upcoming: now < matchTime - 5 minutes
     * Live: matchTime - 5min <= now < matchTime + 20min
     * Completed: now >= matchTime + 20 minutes (auto on UI)
   - Room ID release does NOT change status
   - 5 min early = players can see room & prepare
   - 20 min after = match auto-completes on UI
   - If Admin updates matchTime, status recalculates based on NEW time
   - Match status NEVER jumps to completed before 20 min past start
*/
function effSt(t) {
  if (!t) return 'upcoming';
  var st = (t.status || '').toString().toLowerCase().trim();

  // Admin-controlled terminal states (HIGHEST PRIORITY)
  if (st === 'cancelled' || st === 'canceled') return 'cancelled';
  if (st === 'resultpublished' || st === 'result_published') return 'resultPublished';
  if (st === 'completed' || st === 'finished' || st === 'ended' || st === 'done') return 'completed';

  var mt = Number(t.matchTime);
  if (!mt || mt <= 0) return st || 'upcoming';

  var now = Date.now();
  var relMin = Number(t.roomReleaseMinutes) || 5;
  var liveAt = mt - (relMin * 60000); // go live relMin minutes before match

  // If room already released → go live immediately
  if (t.roomStatus === 'released' || t.roomReleasedAt) {
    liveAt = Math.min(liveAt, Number(t.roomReleasedAt) || liveAt);
  }

  if (now < liveAt) return 'upcoming';                    // before liveAt = upcoming
  if (now >= liveAt && now < mt + 3600000) return 'live'; // liveAt to +1hr after match = live
  return 'completed';                                      // after 1hr = completed
}

/* ====== SMART DUO/SQUAD JOIN HELPER ====== */
/* Checks if user has a saved partner for duo/squad.
   Returns the saved team data or null.
   Priority: Firebase profile > localStorage */
function getSavedTeam(mode) {
  if (!UD) return null;
  if (mode === 'duo') {
    // Priority 1: duoTeam object
    var duoT = UD.duoTeam;
    if (duoT && duoT.memberUid) return { partners: [duoT] };
    // Priority 2: partnerUid field (quick lookup)
    if (UD.partnerUid) return { partners: [{ memberUid: UD.partnerUid, memberName: 'Linked Partner' }] };
    // Priority 3: localStorage fallback
    try {
      var saved = JSON.parse(localStorage.getItem('lastDuoPartner'));
      if (saved && saved.uid) return { partners: [{ memberUid: saved.uid, memberName: saved.name || 'Partner' }] };
    } catch(e) {}
  }
  if (mode === 'squad') {
    var sqMembers = (UD.squadTeam && UD.squadTeam.members) || [];
    if (sqMembers.length > 0) return { partners: sqMembers.map(function(m) { return { memberUid: m.uid, memberName: m.name }; }) };
    try {
      var saved = JSON.parse(localStorage.getItem('lastSquadPartners'));
      if (saved && saved.length) return { partners: saved.map(function(m) { return { memberUid: m.uid, memberName: m.name }; }) };
    } catch(e) {}
  }
  return null;
}

/* Validate saved partners in background before allowing join */
function validateSavedPartners(partners, callback) {
  var validated = [];
  var pending = partners.length;
  if (pending === 0) { callback([]); return; }
  partners.forEach(function(p, idx) {
    if (!p.memberUid) { pending--; if (pending === 0) callback(validated); return; }
    _findUserByFF(p.memberUid, function(fbKey, found) {
      if (found) {
        validated.push({
          index: idx,
          uid: p.memberUid,
          name: found ? (found.ign || found.displayName || p.memberName) : p.memberName,
          data: found,
          valid: true
        });
      } else {
        validated.push({ index: idx, uid: p.memberUid, name: p.memberName, valid: false });
      }
      pending--;
      if (pending === 0) callback(validated);
    });
  });
}

/* ====== AUTO-FILL SAVED TEAM HELPER ====== */
/* After join modal renders, auto-fill partner fields from saved team data
   Priority: 1) Saved team in Firebase profile, 2) Last used team in localStorage */
function autoFillSavedTeam(mode) {
  if (!UD) return;
  
  if (mode === 'duo') {
    var duoT = UD.duoTeam;
    /* Fallback to localStorage if no saved team in profile */
    if (!duoT || !duoT.memberUid) {
      try {
        var saved = JSON.parse(localStorage.getItem('lastDuoPartner'));
        if (saved && saved.uid) duoT = { memberUid: saved.uid, memberName: saved.name || 'Partner' }; // localStorage stores ffUid
      } catch(e) {}
    }
    if (duoT && duoT.memberUid) {
      /* duoTeam.memberUid = Firebase UID (fb key), memberFfUid = FF UID */
      /* We need to put FF UID in the input field, but ALSO set _fbUid in cache */
      var fbUid = duoT.memberUid;   // This is the Firebase UID
      var ffUid = duoT.memberFfUid || duoT.memberUid; // memberFfUid = FF UID if stored separately

      /* If we have the firebase UID stored directly, populate cache directly without re-query */
      if (fbUid && ffUid && fbUid !== ffUid) {
        /* We have both — directly populate partnerCache */
        var pData = { ign: duoT.memberName || 'Partner', displayName: duoT.memberName || 'Partner', ffUid: ffUid };
        pData._fbUid = fbUid;
        partnerCache[1] = pData;
        /* Also update the input UI */
        var inp = $('partnerUid1');
        if (inp) {
          inp.value = ffUid;
          var st = $('partnerSt1');
          if (st) st.innerHTML = '<span class="pf-ok">✓ Linked: ' + (duoT.memberName || 'Partner') + '</span>';
          var nm = $('partnerName1');
          if (nm) nm.innerHTML = '<span style="color:var(--green)">✅ ' + (duoT.memberName || 'Partner') + '</span>';
        }
        console.log('[Team] Duo cache loaded directly: fbUid=' + fbUid + ' ffUid=' + ffUid);
      } else {
        /* Fallback: ffUid lookup (localStorage case or old data) */
        var inp = $('partnerUid1');
        if (inp) {
          inp.value = ffUid;
          var nm = $('partnerName1');
          if (nm) nm.innerHTML = '<span style="color:var(--green)">✅ Auto-filled: ' + (duoT.memberName || 'Partner') + '</span>';
          valPartner(1); // will do Firebase query and set _fbUid
        }
      }
    }
  }
  
  if (mode === 'squad') {
    var sqData = UD.squadTeam;
    var sqMembers = (sqData && sqData.members) || [];
    /* Fallback to localStorage */
    if (!sqMembers.length) {
      try {
        var savedSq = JSON.parse(localStorage.getItem('lastSquadPartners'));
        if (savedSq && savedSq.length) sqMembers = savedSq;
      } catch(e) {}
    }
    for (var i = 0; i < Math.min(sqMembers.length, 3); i++) {
      var sm = sqMembers[i];
      if (!sm) continue;
      var smFbUid = sm.uid;     // Firebase UID (stored from previous join)
      var smFfUid = sm.ffUid || sm.uid; // FF UID
      var idx = i + 1;
      if (smFbUid && smFfUid && smFbUid !== smFfUid) {
        /* Direct cache populate */
        var pData = { ign: sm.name || 'Partner', displayName: sm.name || 'Partner', ffUid: smFfUid };
        pData._fbUid = smFbUid;
        partnerCache[idx] = pData;
        var inp = $('partnerUid' + idx);
        if (inp) {
          inp.value = smFfUid;
          var st = $('partnerSt' + idx);
          if (st) st.innerHTML = '<span class="pf-ok">✓ Linked: ' + (sm.name||'Partner') + '</span>';
          var nm = $('partnerName' + idx);
          if (nm) nm.innerHTML = '<span style="color:var(--green)">✅ ' + (sm.name || 'Partner') + '</span>';
        }
      } else if (smFfUid) {
        var inp = $('partnerUid' + idx);
        if (inp) {
          inp.value = smFfUid;
          var nm = $('partnerName' + idx);
          if (nm) nm.innerHTML = '<span style="color:var(--green)">✅ Auto-filled: ' + (sm.name || 'Partner') + '</span>';
          valPartner(idx);
        }
      }
    }
  }
  
  console.log('[Mini eSports] ✅ Auto-fill team complete for mode: ' + mode);
}

/* ====== 1-HOUR STATUS (Alternate — used where needed) ====== */
function getMatchStatus(matchTime, storedStatus) {
  var now = Date.now();
  var startTime = Number(matchTime);
  // If result already published, always completed
  if (storedStatus === 'resultPublished' || storedStatus === 'result_published') return 'resultPublished';
  if (!startTime || startTime <= 0) return storedStatus || 'upcoming';
  var endTime = startTime + 3600000; // 1 hour = 60 * 60 * 1000
  // ONLY go live at matchTime, never before
  if (now < startTime) return 'upcoming';
  if (now >= startTime && now < endTime) return 'live';
  return 'completed';
}

/* ====== SHARE APP FUNCTION ====== */
function shareApp() {
  var refCode = (UD && UD.referralCode) ? UD.referralCode : (U ? U.uid.substring(0, 8).toUpperCase() : '');
  var text = '🎮 Join me on Mini eSports and win REAL CASH in Free Fire tournaments! 🔥\n\n💰 Play matches, win prizes!\n🪙 Use my referral code: ' + refCode + ' to get bonus coins!\n\n👇 Download now:';
  var url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'Mini eSports - Win Real Cash!', text: text, url: url }).catch(function(err) {
      if (err.name !== 'AbortError') {
        copyTxt(text + '\n' + url);
        toast('Invite link copied!', 'ok');
      }
    });
  } else {
    copyTxt(text + '\n' + url);
    toast('Invite link copied to clipboard!', 'ok');
  }
}

/* ====== SHARE MATCH FUNCTION ====== */
function shareMatch(id) {
  var t = MT[id]; if (!t) return;
  var isCoin = ((t.entryType || '').toLowerCase() === 'coin' || Number(t.entryFee) === 0);
  var entryText = isCoin ? '🪙 ' + (t.entryFee || 0) + ' Coins' : '💎' + (t.entryFee || 0);
  var refCode = (UD && UD.referralCode) ? UD.referralCode : '';
  var text = '🎮 Join "' + (t.name || 'Match') + '" on Mini eSports!\n\n🎯 Entry: ' + entryText + '\n🗺️ Map: ' + titleCase(t.map || 'Unknown') + '\n⏰ ' + fmtTime(t.matchTime);
  if (refCode) text += '\n\n🎁 Use code ' + refCode + ' for bonus coins!';
  var url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: t.name || 'Mini eSports Match', text: text, url: url }).catch(function(err) {
      if (err.name !== 'AbortError') {
        copyTxt(text + '\n\n' + url);
        toast('Match details copied!', 'ok');
      }
    });
  } else {
    copyTxt(text + '\n\n' + url);
    toast('Match details copied!', 'ok');
  }
}

/* ====== ACCESS CONTROL ====== */
function isOk() { return UD && UD.profileStatus === 'approved'; }
function isVO() { return !UD || UD.profileStatus !== 'approved'; }
function hasJ(mid) {
  for (var k in JR) {
    if (JR[k].matchId === mid) return true;
  }
  return false;
}
function getJoinRole(mid) {
  for (var k in JR) {
    var jr = JR[k]; if (jr.matchId !== mid) continue;
    if (jr.isTeamMember && jr.captainUid) return 'member';
    if (jr.captainUid === undefined || jr.captainUid === null) return 'captain';
  }
  return null;
}
function getMoneyBal() {
  if (!UD) return 0;
  var rm = UD.realMoney || { deposited: 0, winnings: 0, bonus: 0 };
  return Math.max(Number(rm.deposited) || 0, 0) + Math.max(Number(rm.winnings) || 0, 0) + Math.max(Number(rm.bonus) || 0, 0);
}

/* ====== BACK BUTTON (ENHANCED) ====== */
/* Push state on load so first back press doesn't exit */
history.pushState(null, null, null);
window.addEventListener('popstate', function(e) {
  /* ALWAYS prevent default browser back behavior */
  e.preventDefault();
  /* Re-push state so we never run out of history entries */
  history.pushState(null, null, null);
  /* Handle what to close/navigate */
  goBack();
});

function goBack() {
  /* Priority 0: Close profile settings sheet */
  var ps = document.getElementById('profSettingsSheet');
  if (ps) { closeProfileSettings(); return; }
  /* Priority 0b: Close referral popup */
  var rcp = document.getElementById('_refCodePopup');
  if (rcp) { rcp.remove(); return; }
  /* Priority 1: Close Room ID Popup */
  var rp = $('rpContainer');
  if (rp && rp.children.length > 0) { rp.innerHTML = ''; return; }
  /* Priority 2: Close any open modal */
  var mo = $('modalOv');
  if (mo && mo.classList.contains('show')) { closeModal(); return; }
  /* Priority 3: Close wallet flow (back to wallet main) */
  var wf = $('walletFlow');
  if (wf && wf.style.display !== 'none' && wf.style.display !== '') { cancelWF(); return; }
  /* Priority 4: Navigate back from sub-screens */
  if (curScr === 'notif' || curScr === 'chat') { navTo(prevScr || 'home'); return; }
  /* Priority 5: Navigate to home from any other screen */
  if (curScr !== 'home') { navTo('home'); return; }
  /* Priority 6: Already on home — re-push state to prevent exit */
  history.pushState(null, null, null);
}

/* ====== NAVIGATION ====== */

/* Helper: Find user by FF UID using Supabase */
function _findUserByFF(ffUid, callback) {
  if (!ffUid || !window._supa) { callback(null, null); return; }
  window._supa.from('users').select('id,ign,ff_uid,avatar_url,profileStatus,coins,sky_diamonds,total_matches,total_wins,total_kills')
    .eq('ff_uid', ffUid).neq('id', window.U ? window.U.uid : '').limit(1).maybeSingle()
    .then(function(r) {
      if (!r.data) { callback(null, null); return; }
      var u = r.data;
      callback(u.id, { ign: u.ign||'', displayName: u.ign||'', ffUid: u.ff_uid||'', profileImage: u.avatar_url||'', profileStatus: u.profileStatus||'', coins: u.coins||0, skyDiamonds: u.sky_diamonds||0, stats: { matches: u.total_matches||0, wins: u.total_wins||0, kills: u.total_kills||0 } });
    }).catch(function() { callback(null, null); });
}
function _findUserByIGN(ign, callback) {
  if (!ign || !window._supa) { callback(null, null); return; }
  window._supa.from('users').select('id,ign,ff_uid,avatar_url,profileStatus').eq('ign', ign).limit(1).maybeSingle()
    .then(function(r) { callback(r.data ? r.data.id : null, r.data ? Object.assign(r.data, { ffUid: r.data.ff_uid, profileImage: r.data.avatar_url }) : null); })
    .catch(function() { callback(null, null); });
}
function _findUserByPhone(phone, callback) {
  if (!phone || !window._supa) { callback(null, null); return; }
  window._supa.from('users').select('id,ign,ff_uid,avatar_url').eq('phone', phone).limit(1).maybeSingle()
    .then(function(r) { callback(r.data ? r.data.id : null, r.data ? Object.assign(r.data, { ffUid: r.data.ff_uid, profileImage: r.data.avatar_url }) : null); })
    .catch(function() { callback(null, null); });
}
