/* ====== FIREBASE INIT — Named app to isolate auth from Admin Panel ====== */
var _userApp = firebase.initializeApp({
  apiKey:"AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec",
  authDomain:"fft-app-1e283.firebaseapp.com",
  databaseURL:"https://fft-app-1e283-default-rtdb.firebaseio.com",
  projectId:"fft-app-1e283",
  storageBucket:"fft-app-1e283.firebasestorage.app",
  messagingSenderId:"247829466483",
  appId:"1:247829466483:web:6961488f1d3c4e3fff4906"
}, "userPanel");
var auth = _userApp.auth(), db = _userApp.database(), gp = new firebase.auth.GoogleAuthProvider();
gp.setCustomParameters({ prompt: 'select_account' });
/* Auth persistence: LOCAL = login same device pe browser close hone ke baad bhi rahe */
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(){});
var U = null, UD = null, MT = {}, JR = {}, NOTIFS = [], PAY = {}, WH = [], REFS = [];
var _READ_KEYS = {}; // persistent read state - never cleared
/* Load read keys from localStorage on startup for extra persistence */
(function() {
  try {
    var saved = localStorage.getItem('_mes_read_keys');
    if (saved) Object.assign(_READ_KEYS, JSON.parse(saved));
  } catch(e) {}
})();
function _saveReadKeys() {
  try { localStorage.setItem('_mes_read_keys', JSON.stringify(_READ_KEYS)); } catch(e) {}
}
var curScr = 'home', prevScr = 'home', hSF = 'upcoming', hCF = 'paid', mmSF = 'upcoming', spType = 'weekly', cdInt = null;
var TXNS = []; // All wallet transactions (entry fees, winnings, etc)
var prevMTKeys = {}, partnerCache = {}, wfStep = 0, wfAmt = 0, wfScreenshot = '';

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
  if (navigator.clipboard) {
    navigator.clipboard.writeText(t).then(function() { toast('Copied!', 'ok'); }).catch(function() { fbCopy(t); });
  } else { fbCopy(t); }
}
function fbCopy(t) {
  var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('Copied!', 'ok'); } catch (e) { toast('Copy failed', 'err'); }
  document.body.removeChild(ta);
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
    db.ref('users').orderByChild('ffUid').equalTo(p.memberUid).once('value', function(s) {
      if (s.exists()) {
        var found = null;
        s.forEach(function(c) { found = c.val(); });
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

/* ====== MODAL ====== */
function openModal(title, html) {
  history.pushState(null, null, null);
  $('modalT').textContent = title; $('modalB').innerHTML = html; $('modalOv').classList.add('show');
}
window.showModal = openModal;
function closeModal() { $('modalOv').classList.remove('show'); }
window._showSetLocation = function() {
  var states = ['Andaman and Nicobar','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
  var h = '<div style="margin-bottom:14px">';
  h += '<div style="font-size:13px;font-weight:700;color:#ffaa00;margin-bottom:12px"><i class="fas fa-map-marker-alt"></i> Set Your Location</div>';
  h += '<div class="f-group"><label>State / City</label>';
  h += '<select class="f-input" id="_locSelect" style="color:#fff;background:var(--card2)">';
  h += '<option value="">-- Select State --</option>';
  states.forEach(function(s) { h += '<option value="' + s + '">' + s + '</option>'; });
  h += '</select></div>';
  h += '<div class="f-group"><label>City (optional)</label>';
  h += '<input type="text" class="f-input" id="_cityInput" placeholder="Your city name...">';
  h += '</div></div>';
  h += '<button onclick="window._saveLocation()" class="f-btn" style="background:linear-gradient(135deg,#ffaa00,#ff8c00);color:#000;font-weight:900">Save Location</button>';
  if (window.openModal) openModal('📍 Set Location', h);
};
window._saveLocation = function() {
  var state = (document.getElementById('_locSelect')||{}).value || '';
  var city = ((document.getElementById('_cityInput')||{}).value||'').trim();
  if (!state) { if(window.toast) toast('State select karo', 'err'); return; }
  var loc = city ? city + ', ' + state : state;
  if (!window.U || !window.db) return;
  window.db.ref('users/' + window.U.uid).update({ city: loc, state: state });
  if (window.UD) { window.UD.city = loc; window.UD.state = state; }
  if (window.toast) toast('📍 Location saved: ' + loc, 'ok');
  if (window.closeModal) closeModal();
  if (window.renderRank) setTimeout(function(){ window.renderRank('city'); }, 500);
};


/* ====== STATE BANNER ====== */
function applyState() {
  var b = $('stateBanner'); if (!b) return;
  if (!UD) { b.style.display = 'none'; return; }
  if (UD.profileStatus === 'approved') {
    b.style.display = 'none';
  } else if (UD.profileStatus === 'pending') {
    b.className = 'state-banner yellow';
    b.innerHTML = '<i class="fas fa-clock"></i> Profile verification pending. App is in view-only mode until admin approval.';
    b.style.display = 'flex';
  } else {
    b.className = 'state-banner blue';
    b.innerHTML = '<i class="fas fa-info-circle"></i> Complete your profile to participate. <a onclick="navTo(\'profile\')">Go to Profile →</a>';
    b.style.display = 'flex';
  }
}

/* ====== GOOGLE LOGIN ====== */
/* Simple signInWithPopup — works on browser & GitHub Pages */
var _GOOGLE_BTN_HTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google';

function doGoogleLogin() {
  var btn = $('googleBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...'; }
  auth.signInWithPopup(gp).then(function() {
    /* onAuthStateChanged handle karega */
  }).catch(function(err) {
    if (btn) { btn.disabled = false; btn.innerHTML = _GOOGLE_BTN_HTML; }
    if (err.code === 'auth/popup-closed-by-user') {
      toast('Login cancelled', 'inf');
    } else if (err.code === 'auth/popup-blocked') {
      toast('Popup blocked! Browser mein popups allow karo.', 'err');
    } else if (err.code === 'auth/network-request-failed') {
      toast('Network error — internet check karo', 'err');
    } else {
      toast(err.message || 'Login failed', 'err');
    }
  });
}

function enablePushNotifs() {
  if (window.f17MatchReminder) {
    window.f17MatchReminder.request(function(ok) {
      if (ok) {
        toast('🔔 Notifications enabled! Match reminders milenge.', 'ok');
      } else if (('Notification' in window) && Notification.permission === 'denied') {
        openModal('🔔 Notifications Blocked', '<div style="text-align:center;padding:8px"><div style="font-size:40px;margin-bottom:12px">🔕</div><div style="font-size:14px;font-weight:700;margin-bottom:8px">Browser ne block kar diya hai</div><div style="font-size:12px;color:var(--txt2);line-height:1.6">Notifications enable karne ke liye:<br><strong>1.</strong> Address bar mein 🔒 lock icon tap karo<br><strong>2.</strong> Notifications → Allow karo<br><strong>3.</strong> Page refresh karo</div></div>');
      } else {
        toast('❌ Notifications supported nahi hain is browser mein', 'err');
      }
    });
  }
}

/* ====== MY TEAM MODAL ====== */
function showMyTeamModal() {
  if (!window.UD || !window.U) return;
  var UD = window.UD, U = window.U;
  var h = '';

  // Duo Partner
  h += '<div style="background:var(--card2);border-radius:16px;padding:16px;margin-bottom:14px">';
  h += '<h4 style="margin:0 0 14px;font-size:14px;display:flex;align-items:center;gap:8px"><i class="fas fa-user-friends" style="color:var(--green)"></i> Duo Partner</h4>';
  h += '<div style="display:flex;gap:14px;align-items:flex-start">';
  // You slot
  h += '<div style="text-align:center"><div style="width:54px;height:54px;border-radius:50%;background:rgba(0,255,156,.15);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:var(--green);margin:0 auto 6px">' + (UD.profileImage ? '<img src="'+UD.profileImage+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : (UD.ign||'Y').charAt(0)) + '</div><div style="font-size:11px;font-weight:700;color:var(--green)">You 👑</div></div>';
  // Partner slot
  var duoT = UD.duoTeam;
  if (duoT && duoT.memberUid) {
    h += '<div style="text-align:center"><div style="width:54px;height:54px;border-radius:50%;background:rgba(0,255,156,.1);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:var(--txt);margin:0 auto 6px">' + (duoT.memberName||'T').charAt(0) + '</div><div style="font-size:11px;font-weight:600;color:var(--txt)">' + (duoT.memberName||'Teammate') + '</div><div onclick="removeTM(\'duo\',0)" style="font-size:10px;color:#ff5555;cursor:pointer;margin-top:4px">✕ Remove</div></div>';
  } else {
    h += '<div style="text-align:center"><div onclick="if(window.closeModal)closeModal();addTM(\'duo\')" style="width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.04);border:2px dashed rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;color:rgba(255,255,255,.3);margin:0 auto 6px;cursor:pointer">+</div><div style="font-size:11px;color:var(--txt2)">Add</div></div>';
  }
  h += '</div></div>';

  // Squad Team
  h += '<div style="background:var(--card2);border-radius:16px;padding:16px">';
  h += '<h4 style="margin:0 0 14px;font-size:14px;display:flex;align-items:center;gap:8px"><i class="fas fa-users" style="color:var(--green)"></i> Squad Team</h4>';
  h += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
  // You
  h += '<div style="text-align:center"><div style="width:50px;height:50px;border-radius:50%;background:rgba(0,255,156,.15);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:var(--green);margin:0 auto 6px">' + (UD.profileImage ? '<img src="'+UD.profileImage+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : (UD.ign||'Y').charAt(0)) + '</div><div style="font-size:10px;font-weight:700;color:var(--green)">You 👑</div></div>';
  var sqMembers = (UD.squadTeam && UD.squadTeam.members) || [];
  for (var i = 0; i < 3; i++) {
    if (sqMembers[i]) {
      h += '<div style="text-align:center"><div style="width:50px;height:50px;border-radius:50%;background:rgba(0,255,156,.1);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:var(--txt);margin:0 auto 6px">' + (sqMembers[i].name||'T').charAt(0) + '</div><div style="font-size:10px;font-weight:600;color:var(--txt)">' + (sqMembers[i].name||'Mate') + '</div><div onclick="removeTM(\'squad\',' + i + ')" style="font-size:10px;color:#ff5555;cursor:pointer;margin-top:3px">✕</div></div>';
    } else {
      h += '<div style="text-align:center"><div onclick="if(window.closeModal)closeModal();addTM(\'squad\')" style="width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.04);border:2px dashed rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px;color:rgba(255,255,255,.3);margin:0 auto 6px;cursor:pointer">+</div><div style="font-size:10px;color:var(--txt2)">Add</div></div>';
    }
  }
  h += '</div></div>';

  if (window.openModal) openModal('👥 My Team', h);
}

/* ====== VOUCHER MODAL ====== */
function showVoucherModal() {
  var h = '<div style="text-align:center;padding:10px 0 20px">';
  h += '<div style="font-size:48px;margin-bottom:12px">🎫</div>';
  h += '<div style="font-size:15px;font-weight:700;color:var(--txt);margin-bottom:6px">Redeem Voucher</div>';
  h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:20px">Enter your voucher code to get coins or balance</div>';
  h += '<input type="text" id="voucherIn" placeholder="Enter voucher code" style="width:100%;padding:13px 16px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:14px;text-align:center;text-transform:uppercase;letter-spacing:2px;box-sizing:border-box;margin-bottom:14px">';
  h += '<button onclick="redeemVoucher()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ffaa00,#ff8800);color:#000;font-weight:900;border:none;cursor:pointer;font-size:14px">🎫 Redeem</button>';
  h += '</div>';
  if (window.openModal) openModal('🎫 Redeem Voucher', h);
}

/* ====== PROFILE SETTINGS BOTTOM SHEET ====== */
function showProfileSettings() {
  var existing = document.getElementById('profSettingsSheet');
  if (existing) existing.remove();

  var sheet = document.createElement('div');
  sheet.id = 'profSettingsSheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;justify-content:flex-end';

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';
  overlay.onclick = function() { closeProfileSettings(); };

  var panel = document.createElement('div');
  panel.style.cssText = 'position:relative;background:#111;border-radius:22px 22px 0 0;padding:0 0 32px;max-height:90vh;overflow-y:auto;animation:slideUp .28s cubic-bezier(.4,0,.2,1)';

  var items = [
    { icon: 'fa-users',       label: 'My Team',         color: '#00ff9c', fn: "showMyTeamModal()",                                   bg: 'rgba(0,255,156,.08)',   border: 'rgba(0,255,156,.2)' },
    { icon: 'fa-gift',        label: 'Refer & Earn',    color: '#aa55ff', fn: "window.showReferralStats&&showReferralStats()",        bg: 'rgba(170,85,255,.08)',  border: 'rgba(170,85,255,.2)' },
    { icon: 'fa-medal',       label: 'Achievements',    color: '#ffd700', fn: "window.showAchievements&&showAchievements()",          bg: 'rgba(255,215,0,.08)',   border: 'rgba(255,215,0,.2)' },
    { icon: 'fa-crosshairs',  label: 'My Rival 🎯',    color: '#ff4444', fn: "window.showRivalCard&&showRivalCard()",               bg: 'rgba(255,68,68,.08)',   border: 'rgba(255,68,68,.2)' },
    { icon: 'fa-id-card',     label: 'Player Card',     color: '#00ff9c', fn: "window.generateAdvancedPlayerCard&&generateAdvancedPlayerCard()", bg: 'rgba(0,255,156,.1)', border: 'rgba(0,255,156,.25)' },
    { icon: 'fa-chart-bar',   label: 'Stat Card',       color: '#00d4ff', fn: "window.generateStatCard&&generateStatCard()",         bg: 'rgba(0,212,255,.08)',   border: 'rgba(0,212,255,.2)' },
    { icon: 'fa-store',       label: 'Rewards Store',   color: '#ff8c00', fn: "window.showRewardsStore&&showRewardsStore()",         bg: 'rgba(255,140,0,.08)',   border: 'rgba(255,140,0,.2)' },
    { icon: 'fa-ticket-alt',  label: 'Redeem Voucher',  color: '#ffaa00', fn: "showVoucherModal()",                                  bg: 'rgba(255,170,0,.08)',   border: 'rgba(255,170,0,.2)' },
    { icon: 'fa-history',     label: 'Match History',   color: '#00d4ff', fn: "window.showMatchHistory&&showMatchHistory()",         bg: 'rgba(0,212,255,.08)',   border: 'rgba(0,212,255,.2)' },
    { icon: 'fa-crown',       label: 'Season Stats',    color: '#ffd700', fn: "window.showSeasonStats&&showSeasonStats()",           bg: 'rgba(255,215,0,.08)',   border: 'rgba(255,215,0,.2)' },
    { icon: 'fa-map-marker-alt', label: 'Set Location', color: '#ffaa00', fn: "window._showSetLocation&&_showSetLocation()",        bg: 'rgba(255,170,0,.08)',   border: 'rgba(255,170,0,.2)' },

    { icon: 'fa-sign-out-alt',label: 'Logout',          color: '#ff4444', fn: "doLogout()",                                          bg: 'rgba(255,60,60,.08)',   border: 'rgba(255,60,60,.25)' },
  ];

  var html = '<div style="display:flex;justify-content:center;padding:12px 0 4px"><div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.15)"></div></div>';
  html += '<div style="padding:16px 20px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.07)">';
  html += '<span style="font-size:16px;font-weight:700;color:#fff"><i class="fas fa-cog" style="color:var(--green);margin-right:8px"></i>Settings</span>';
  html += '<div onclick="closeProfileSettings()" style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer"><i class="fas fa-times" style="color:#aaa;font-size:13px"></i></div>';
  html += '</div>';
  html += '<div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px">';

  items.forEach(function(item) {
    html += '<div onclick="(function(){history.pushState(null,null,null);try{' + item.fn + '}catch(e){}setTimeout(function(){closeProfileSettings();},250);})()" style="display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;background:' + item.bg + ';border:1px solid ' + item.border + ';cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent">';
    html += '<div style="width:32px;height:32px;border-radius:9px;background:' + item.border + ';display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas ' + item.icon + '" style="color:' + item.color + ';font-size:14px"></i></div>';
    html += '<span style="font-size:12px;font-weight:700;color:#ddd;line-height:1.3">' + item.label + '</span>';
    html += '</div>';
  });

  // Legal & Compliance section
  html += '</div>';
  /* Permissions section */
  html += '<div style="padding:4px 16px 8px">';
  html += '<div style="font-size:10px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:1px;padding:8px 0 6px;border-top:1px solid rgba(255,255,255,.05)">🔔 App Permissions</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  var permHtml = '';
  /* Notification permission */
  var notifStatus = (typeof Notification !== 'undefined') ? Notification.permission : 'unknown';
  var notifColor = notifStatus === 'granted' ? '#00ff9c' : '#ffaa00';
  var notifLabel = notifStatus === 'granted' ? '✅ Notifications' : '🔔 Notifications';
  permHtml += '<div onclick="window._reqNotifPerm&&_reqNotifPerm()" style="display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;background:rgba(255,170,0,.06);border:1px solid rgba(255,170,0,.2);cursor:pointer">';
  permHtml += '<div style="width:32px;height:32px;border-radius:9px;background:rgba(255,170,0,.15);display:flex;align-items:center;justify-content:center"><i class="fas fa-bell" style="color:' + notifColor + ';font-size:14px"></i></div>';
  permHtml += '<span style="font-size:12px;font-weight:700;color:#ddd">' + notifLabel + '</span></div>';
  /* Location permission */
  permHtml += '<div onclick="window._reqLocationPerm&&_reqLocationPerm()" style="display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);cursor:pointer">';
  permHtml += '<div style="width:32px;height:32px;border-radius:9px;background:rgba(0,255,156,.15);display:flex;align-items:center;justify-content:center"><i class="fas fa-map-marker-alt" style="color:#00ff9c;font-size:14px"></i></div>';
  permHtml += '<span style="font-size:12px;font-weight:700;color:#ddd">📍 Location</span></div>';
  html += permHtml + '</div></div>';

  /* Legal section */
  html += '<div style="padding:4px 16px 8px"><div style="font-size:10px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:1px;padding:8px 0 6px;border-top:1px solid rgba(255,255,255,.05)">⚖️ Legal & Compliance</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  var legalDefs = [
    { icon: 'fa-file-contract',  label: 'Terms',          color: '#00d4ff', fn: 'mesShowTerms',   bg: 'rgba(0,212,255,.06)',   brd: 'rgba(0,212,255,.2)' },
    { icon: 'fa-user-shield',    label: 'Privacy',        color: '#00d4ff', fn: 'mesShowPrivacy', bg: 'rgba(0,212,255,.06)',   brd: 'rgba(0,212,255,.2)' },
    { icon: 'fa-money-bill-wave',label: 'Tax Summary',    color: '#ffd700', fn: 'mesTDSSummary',  bg: 'rgba(255,215,0,.06)',   brd: 'rgba(255,215,0,.2)' },
    { icon: 'fa-id-card',        label: 'KYC',            color: '#b964ff', fn: 'mesShowKYC',     bg: 'rgba(185,100,255,.06)', brd: 'rgba(185,100,255,.2)' },
    { icon: 'fa-heart',          label: 'Safe Gaming',    color: '#00ff9c', fn: 'mesRG',          bg: 'rgba(0,255,156,.06)',   brd: 'rgba(0,255,156,.2)' },
    { icon: 'fa-exclamation-circle', label: 'Dispute',   color: '#ffaa00', fn: 'mesDispute',     bg: 'rgba(255,170,0,.06)',   brd: 'rgba(255,170,0,.2)' },
  ];
  legalDefs.forEach(function(ld) {
    html += '<div onclick="(function(){' +
      'var sh=document.getElementById(\'profSettingsSheet\');' +
      'if(sh){sh.style.opacity=\'0\';sh.style.transform=\'translateY(30px)\';sh.style.transition=\'all .25s\';' +
      'setTimeout(function(){if(sh.parentNode)sh.remove();' +
      'history.pushState(null,null,null);' +
      'setTimeout(function(){if(window.' + ld.fn + ')window.' + ld.fn + '();},80);},250);}' +
      'else{history.pushState(null,null,null);if(window.' + ld.fn + ')window.' + ld.fn + '();}' +
      '})()" style="display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;background:' + ld.bg + ';border:1px solid ' + ld.brd + ';cursor:pointer;-webkit-tap-highlight-color:transparent">';
    html += '<div style="width:32px;height:32px;border-radius:9px;background:' + ld.brd + ';display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas ' + ld.icon + '" style="color:' + ld.color + ';font-size:14px"></i></div>';
    html += '<span style="font-size:12px;font-weight:700;color:#ddd;line-height:1.3">' + ld.label + '</span>';
    html += '</div>';
  });
  html += '</div></div>';
  panel.innerHTML = html;
  sheet.appendChild(overlay);
  sheet.appendChild(panel);
  document.body.appendChild(sheet);
}

function closeProfileSettings() {
  var s = document.getElementById('profSettingsSheet');
  if (s) {
    s.style.opacity = '0';
    s.style.transform = 'translateY(20px)';
    s.style.transition = 'all .2s';
    setTimeout(function() { if (s.parentNode) s.remove(); }, 200);
  }
}

/* ====== PERMISSION REQUEST FUNCTIONS ====== */
window._reqNotifPerm = function() {
  if (!('Notification' in window)) {
    if (window.toast) toast('Notifications not supported in this browser', 'inf'); return;
  }
  if (Notification.permission === 'granted') {
    if (window.toast) toast('✅ Notifications already enabled!', 'ok'); return;
  }
  Notification.requestPermission().then(function(result) {
    if (result === 'granted') {
      if (window.toast) toast('✅ Notifications enabled! You will get match reminders.', 'ok');
      if (window.enablePushNotifs) enablePushNotifs();
    } else if (result === 'denied') {
      if (window.toast) toast('Notifications blocked. Go to browser settings to enable.', 'err');
    }
  });
};

window._reqLocationPerm = function() {
  if (!('geolocation' in navigator)) {
    if (window.toast) toast('Location not supported', 'inf'); return;
  }
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      /* Got location — do reverse geocode via open API */
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json')
        .then(function(r){ return r.json(); })
        .then(function(data) {
          var addr = data.address || {};
          var state = addr.state || addr.province || '';
          var city = addr.city || addr.town || addr.village || addr.county || '';
          var loc = city ? city + ', ' + state : state;
          if (loc && window.U && window.db) {
            window.db.ref('users/' + window.U.uid).update({ city: loc, state: state, lat: lat, lon: lon });
            if (window.UD) { window.UD.city = loc; window.UD.state = state; }
            if (window.toast) toast('📍 Location saved: ' + loc, 'ok');
          }
        })
        .catch(function() {
          if (window.toast) toast('📍 Location detected! Set manually in Settings → Set Location', 'ok');
        });
    },
    function(err) {
      if (err.code === 1) {
        if (window.toast) toast('Location permission denied. Enable in browser settings.', 'err');
      } else {
        if (window.toast) toast('Could not get location. Try again.', 'err');
      }
    },
    { timeout: 10000, enableHighAccuracy: false }
  );
};

/* Also add slideUp animation if not already there */
(function() {
  if (!document.getElementById('profSettingsStyle')) {
    var style = document.createElement('style');
    style.id = 'profSettingsStyle';
    style.textContent = '@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(style);
  }
})();

function doLogout() {
  auth.signOut(); UD = null; U = null; MT = {}; JR = {}; NOTIFS = []; WH = []; REFS = []; TXNS = []; _READ_KEYS = {};
  $('header').style.display = 'none'; $('bottomNav').style.display = 'none';
  $('mainContent').style.display = 'none'; $('loginScreen').style.display = 'flex';
}

/* ====== AUTH STATE ====== */
/* Named app "userPanel" isolates auth from admin panel completely */

/* ── SPLASH HARD FALLBACK: agar onAuthStateChanged 4 sec mein fire na kare ── */
var _authFired = false;
function _hideSplash() {
  var sp = $('splash');
  if (sp) sp.style.display = 'none';
}
setTimeout(function() {
  if (!_authFired) {
    _hideSplash();
    $('loginScreen').style.display = 'flex';
  }
}, 4000);

auth.onAuthStateChanged(function(user) {
  _authFired = true;
  _hideSplash();
  if (user) {
    // Extra safety: if email/password provider sneaks in, reject
    var isEmailProvider = user.providerData && user.providerData.some(function(p) { return p.providerId === 'password'; });
    if (isEmailProvider) {
      auth.signOut();
      $('loginScreen').style.display = 'flex';
      var msg = document.querySelector('.login-help');
      if (msg) msg.innerHTML = '⚠️ Admin account user panel mein use nahi ho sakta. Apni Google account se login karo.';
      return;
    }
    U = user;
    $('loginScreen').style.display = 'none';
    afterLogin(user);
    if (window.saveDeviceFingerprint) window.saveDeviceFingerprint(user.uid);
  } else {
    $('loginScreen').style.display = 'flex';
    $('header').style.display = 'none';
    $('bottomNav').style.display = 'none';
    $('mainContent').style.display = 'none';
  }
});

function afterLogin(user) {
  /* Safety timeout: DB read 6 sec mein na ho toh bhi boot karo */
  var _bootDone = false;
  var _bootTimer = setTimeout(function() {
    if (!_bootDone) { _bootDone = true; boot(); }
  }, 6000);

  db.ref('users/' + user.uid).once('value').then(function(snap) {
    clearTimeout(_bootTimer);
    if (!snap.exists()) {
      var rc = user.uid.substring(0, 8).toUpperCase();
      db.ref('users/' + user.uid).set({
        uid: user.uid, email: user.email || '', displayName: user.displayName || '',
        profileStatus: 'not_requested', role: 'user', coins: 0,
        realMoney: { deposited: 0, winnings: 0, bonus: 0 },
        stats: { matches: 0, wins: 0, kills: 0, earnings: 0 },
        referralCode: rc, referralCount: 0, referralCoinsEarned: 0,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      if (user.photoURL) db.ref('users/' + user.uid + '/profileImage').set(user.photoURL);
    } else {
      var d = snap.val();
      if (d.profileStatus === 'pending') {
        db.ref('profileRequests').orderByChild('uid').equalTo(user.uid).once('value', function(rs) {
          var real = false;
          if (rs.exists()) rs.forEach(function(c) { if (c.val().status === 'pending') real = true; });
          if (!real) db.ref('users/' + user.uid + '/profileStatus').set('not_requested');
        });
      }
    }
    if (!_bootDone) { _bootDone = true; boot(); }
  }).catch(function(err) {
    /* DB read fail hone pe bhi app chalu karo */
    clearTimeout(_bootTimer);
    console.warn('[afterLogin] DB read failed:', err && err.message);
    if (!_bootDone) { _bootDone = true; boot(); }
  });
}

/* ====== UPDATE HEADER ====== */
function updateHdr() {
  if (!UD) return;
  var coins = Number(UD.coins) || 0;
  var money = getMoneyBal();
  var hc = $('hdrCoins'), hm = $('hdrMoney');
  if (hc) {
    var oldC = Number(hc.textContent) || 0;
    hc.textContent = coins;
    if (coins !== oldC && oldC > 0) {
      hc.parentElement.style.animation = 'none';
      hc.parentElement.offsetHeight;
      hc.parentElement.style.animation = 'pulse 0.5s ease';
    }
  }
  if (hm) {
    var oldM = Number(hm.textContent) || 0;
    hm.textContent = parseFloat(money.toFixed(2));
    if (money !== oldM && oldM > 0) {
      hm.parentElement.style.animation = 'none';
      hm.parentElement.offsetHeight;
      hm.parentElement.style.animation = 'pulse 0.5s ease';
    }
  }
}

/* ====== BELL ====== */
function updateBell() {
  var dot = $('bellDot'); if (!dot) return;
  var unread = 0;
  var rd = (UD && UD.readNotifications) || {};
  // Count ALL notifications — unread = not in _READ_KEYS, not in Firebase readNotifications, not locally marked
  NOTIFS.forEach(function(n) {
    if (!_READ_KEYS[n._key] && !rd[n._key] && !n._localRead) unread++;
  });
  if (unread > 0) {
    dot.style.display = 'block';
    if (unread > 3) {
      // Show number for 4+ unread
      dot.style.cssText = 'display:flex;align-items:center;justify-content:center;min-width:15px;height:15px;padding:0 3px;border-radius:8px;background:#ff4444;color:#fff;font-size:9px;font-weight:800;position:absolute;top:-3px;right:-3px;z-index:10;';
      dot.textContent = unread > 9 ? '9+' : unread;
    } else {
      // Just a small dot for 1-3 unread
      dot.style.cssText = 'display:block;width:8px;height:8px;border-radius:50%;background:#ff4444;position:absolute;top:-1px;right:-1px;z-index:10;';
      dot.textContent = '';
    }
  } else {
    dot.style.display = 'none';
    dot.textContent = '';
  }
}

/* ====== BOOT - ALL REAL-TIME LISTENERS ====== */
var _notifiedRooms = {}, _notifiedDone = {};
function boot() {
  if (!U) return;
  $('header').style.display = ''; $('bottomNav').style.display = ''; $('mainContent').style.display = '';

  // L1: User Data
  db.ref('users/' + U.uid).on('value', function(s) {
    if (!s.exists()) return;
    UD = s.val();
    // Sync _READ_KEYS from Firebase readNotifications whenever user data updates
    var _rdFirebase = (UD.readNotifications) || {};
    Object.keys(_rdFirebase).forEach(function(k) { _READ_KEYS[k] = true; });
    updateHdr(); applyState(); renderHome(); renderProfile(); renderWallet();
    if (window.checkStreakBonus) checkStreakBonus();
    updateBell();
    // ✅ LEGAL COMPLIANCE: Run after user data loaded
    if (window.mesInit) window.mesInit();
  });

  // L2: matches/ (primary match store)
  db.ref('matches').on('value', function(s) {
    for (var k in MT) { if (MT[k]._src === 'matches') delete MT[k]; }
    if (s.exists()) {
      s.forEach(function(c) {
        var v = c.val(); if (!v) return;
        var st = (v.status||'').toLowerCase();
        if (['cancelled','canceled','deleted','removed','hidden','disabled','closed'].indexOf(st) !== -1) return;
        v.id = c.key; v._src = 'matches'; MT[c.key] = v;
      });
    }
    detectChanges(); renderHome(); renderSP(); renderMM();
  });

  // L3: tournaments/ (fallback match store)
  db.ref('tournaments').on('value', function(s) {
    for (var k in MT) { if (MT[k]._src === 'tournaments') delete MT[k]; }
    if (s.exists()) {
      s.forEach(function(c) {
        if (MT[c.key]) return;
        var v = c.val(); if (!v) return;
        var st = (v.status||'').toLowerCase();
        if (['cancelled','canceled','deleted','removed','hidden','disabled','closed'].indexOf(st) !== -1) return;
        v.id = c.key; v._src = 'tournaments'; MT[c.key] = v;
      });
    }
    renderHome(); renderSP(); renderMM();
  });

  // L4: joinRequests for this user
  db.ref('joinRequests').orderByChild('userId').equalTo(U.uid).on('value', function(s) {
    JR = {};
    if (s.exists()) s.forEach(function(c) { var v = c.val(); v._key = c.key; JR[c.key] = v; });
    renderHome(); renderMM(); checkRefunds();
  });

  // L4b: User transactions (entry fees, winnings, bonuses)
  db.ref('users/' + U.uid + '/transactions').orderByChild('timestamp').limitToLast(50).on('value', function(s) {
    TXNS = [];
    if (s.exists()) s.forEach(function(c) { var v = c.val(); v._key = c.key; if (!v.timestamp) v.timestamp = Date.now(); TXNS.push(v); });
    TXNS.sort(function(a,b) { return b.timestamp - a.timestamp; });
    if (curScr === 'wallet') renderWallet();
  });

  // L5: Notifications (global + user-targeted)
  db.ref('notifications').limitToLast(50).on('value', function(s) {
    var oldKeys = {};
    NOTIFS.forEach(function(n) { if (n._key) oldKeys[n._key] = true; });
    NOTIFS = [];
    if (s.exists()) {
      var _rd = (UD && UD.readNotifications) || {};
      // Sync _READ_KEYS from Firebase readNotifications (handles fresh page load)
      Object.keys(_rd).forEach(function(k) { _READ_KEYS[k] = true; });
      s.forEach(function(c) {
        var n = c.val();
        var hasTarget = n && n.targetUserId;
        var isPersonal = hasTarget && (n.targetUserId === U.uid || n.uid === U.uid);
        var isPublic = !hasTarget || n.targetUserId === 'all';
        if (n && (isPersonal || isPublic)) {
          n._key = c.key;
          n._src = isPersonal ? 'personal' : 'public';
          // Restore read state from Firebase-synced readNotifications
          if (_rd[c.key]) n._localRead = true;
          // Auto-mark public notifications older than 24h as read
          if (!isPersonal && n.timestamp && (Date.now() - n.timestamp) > 86400000) {
            n._localRead = true;
            if (UD && !_rd[n._key]) {
              db.ref('users/' + U.uid + '/readNotifications/' + n._key).set(true);
              if (!UD.readNotifications) UD.readNotifications = {};
              UD.readNotifications[n._key] = true;
            }
          }
          NOTIFS.push(n);
        }
      });
    }
    NOTIFS.reverse();
    updateBell();
    if (curScr === 'notif') renderNotifs();
    // Room ID popup for newly-released rooms
    NOTIFS.forEach(function(n) {
      if (n.type === 'room_released' && n.matchId && !oldKeys[n._key]) {
        var t = MT[n.matchId];
        if (t && t.roomId && t.roomPassword && hasJ(n.matchId) && !_notifiedRooms[n.matchId]) {
          _notifiedRooms[n.matchId] = true;
          // Toast removed - bell notification enough, no duplicate popups
          // showRP removed - handled by once-only Firebase check
        }
      }
    });
  });

  // L5b: User-specific notifications node
  db.ref('users/' + U.uid + '/notifications').orderByChild('timestamp').limitToLast(20).on('value', function(s) {
    if (!s.exists()) return;
    var _rd2 = (UD && UD.readNotifications) || {};
    // ✅ FIX: Pehle _READ_KEYS sync karo, phir badge update karo
    Object.keys(_rd2).forEach(function(k) { _READ_KEYS[k] = true; });
    // localStorage se bhi read keys load karo
    try {
      var _lsRead = JSON.parse(localStorage.getItem('_mes_read_' + U.uid) || '{}');
      Object.keys(_lsRead).forEach(function(k) { _READ_KEYS[k] = true; });
    } catch(e) {}
    s.forEach(function(c) {
      var n = c.val(); if (!n) return;
      var exists = NOTIFS.some(function(x) { return x._key === c.key; });
      if (!exists) { 
        n._key = c.key; n._srcUser = true; 
        if (_rd2[c.key] || _READ_KEYS[c.key]) n._localRead = true;
        NOTIFS.push(n); 
      } else {
        NOTIFS.forEach(function(x) { if (x._key === c.key && (_READ_KEYS[c.key] || _rd2[c.key])) x._localRead = true; });
      }
    });
    updateBell();
  });

  // L5c: readNotifications real-time listener — keeps _READ_KEYS always in sync
  db.ref('users/' + U.uid + '/readNotifications').on('value', function(s) {
    if (!s.exists()) return;
    s.forEach(function(c) { _READ_KEYS[c.key] = true; });
    // Also sync to UD
    if (UD) {
      if (!UD.readNotifications) UD.readNotifications = {};
      s.forEach(function(c) { UD.readNotifications[c.key] = true; });
    }
    updateBell();
  });

  // New user notification - show toast (admin alerts only)
  db.ref('users/' + U.uid + '/notifications').orderByChild('timestamp').startAt(Date.now()).on('child_added', function(s) {
    var n = s.val(); if (!n) return;
    // Only show important admin alerts, NOT promotional ones
    var importantTypes = ['result', 'wallet_approved', 'wallet_rejected', 'withdraw_done', 'withdraw_rejected', 'admin_alert', 'ban', 'room_released'];
    if (importantTypes.indexOf(n.type) !== -1) {
      toast('🔔 ' + (n.title || 'New Notification'), n.type === 'result' || n.type === 'wallet_approved' || n.type === 'withdraw_done' ? 'ok' : 'inf');
      // Show loot crate animation on win
      if (n.type === 'result' && n.prize && Number(n.prize) > 0) {
        showLootCrate(n.prize);
      }
    }
  });

  // L6: Payment settings
  db.ref('appSettings/payment').on('value', function(s) { if (s.exists()) PAY = s.val(); });

  // L7: Ticker
  db.ref('appSettings/ticker').on('value', function(s) {
    if (s.exists()) { var tt = $('tickerTxt'); if (tt) tt.textContent = s.val(); }
  });
  // Live payout proof ticker — show recent withdrawals as social proof
  db.ref('walletRequests').orderByChild('status').equalTo('done').limitToLast(5).once('value', function(s) {
    if (!s.exists()) return;
    var payouts = [];
    s.forEach(function(c) {
      var v = c.val();
      if (v.type === 'withdraw' && v.amount && (v.userName || v.displayName)) {
        payouts.push({ name: v.userName || v.displayName || 'A player', amount: v.amount });
      }
    });
    if (payouts.length === 0) return;
    var msgs = payouts.map(function(p) { return '💸 ' + p.name + ' withdrew ₹' + p.amount + ' via UPI'; });
    var tt = $('tickerTxt');
    if (tt && !tt.textContent) {
      tt.textContent = msgs.join('  •  ');
    } else if (tt) {
      tt.textContent = tt.textContent + '  •  ' + msgs.join('  •  ');
    }
  });

  // L8: App banner (admin-controlled only)
  db.ref('appSettings/banner').on('value', function(s) {
    var el = $('dynamicBanner'); if (!el) return;
    if (s.exists() && s.val()) {
      var val = s.val();
      el.style.display = 'block';
      el.textContent = typeof val === 'string' ? val : (val.text || '');
      el.style.background = (typeof val === 'object' && val.color) ? val.color : 'rgba(0,255,156,.1)';
      el.style.color = (typeof val === 'object' && val.textColor) ? val.textColor : 'var(--green)';
    } else { el.style.display = 'none'; }
  });

  // L9: Wallet requests (this user)
  var prevWHStatus = {};
  db.ref('walletRequests').orderByChild('uid').equalTo(U.uid).on('value', function(s) {
    WH = [];
    if (s.exists()) {
      s.forEach(function(c) {
        var v = c.val(); v._key = c.key; WH.push(v);
        var st = (v.status||'').toLowerCase();
        var prevSt = prevWHStatus[c.key];
        if (prevSt && prevSt !== st) {
          if (v.type === 'deposit' || v.type === 'add') {
            if (st === 'approved' || st === 'done') toast('✅ Deposit 💎' + (v.amount||0) + ' added to wallet!', 'ok');
            else if (st === 'rejected' || st === 'failed') toast('❌ Deposit rejected', 'err');
          } else if (v.type === 'withdraw') {
            if (st === 'approved' || st === 'done') toast('✅ Withdrawal ₹' + (v.amount||0) + ' processed!', 'ok');
            else if (st === 'rejected' || st === 'failed') {
              toast('❌ Withdrawal rejected. Amount refunded.', 'err');
              db.ref('users/' + U.uid + '/realMoney/winnings').transaction(function(w) { return (w||0) + (Number(v.amount)||0); });
            }
          }
        }
        prevWHStatus[c.key] = st;
      });
    }
    WH.sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
    renderWallet();
  });

  // L10: Referrals
  db.ref('referrals').orderByChild('referrerId').equalTo(U.uid).on('value', function(s) {
    REFS = [];
    if (s.exists()) s.forEach(function(c) { REFS.push(c.val()); });
    if (curScr === 'profile') renderProfile();
  });

  // L11: Profile request status sync
  db.ref('profileRequests/' + U.uid).on('value', function(s) {
    if (!s.exists()) return;
    var r = s.val();
    if (r.status === 'approved') {
      var ign = r.requestedIgn||r.ign||'', ffUid = r.requestedUid||r.ffUid||'';
      db.ref('users/' + U.uid).update({
        ign: ign, ffUid: ffUid, profileStatus: 'approved',
        profileRequired: null, pendingIgn: null, pendingUid: null
      });
      // ✅ FIX: Sirf ek baar show karo — localStorage se track karo
      var _approvalKey = '_mes_approved_' + U.uid;
      if (!localStorage.getItem(_approvalKey)) {
        localStorage.setItem(_approvalKey, '1');
        toast('🎉 Profile approved! Full access unlocked!', 'ok');
      }
    }
  });

  // L11b: Profile Updates listener — admin ne update approve kiya to UI refresh ho
  db.ref('profileUpdates/' + U.uid).on('value', function(s) {
    if (!s.exists()) return;
    var r = s.val();
    if (r.status === 'approved') {
      // Admin ne users/{uid} directly update kar diya hoga, lekin agar nahi hua to yahan bhi karo
      var newIgn = r.requestedIgn||r.ign||r.newIgn||'';
      var newFfUid = r.requestedUid||r.ffUid||r.newFfUid||r.newUid||'';
      if (newIgn || newFfUid) {
        var upd = { pendingIgn: null, pendingUid: null, profileStatus: 'approved' };
        if (newIgn) upd.ign = newIgn;
        if (newFfUid) upd.ffUid = newFfUid;
        db.ref('users/' + U.uid).update(upd);
      }
      // ✅ FIX: Sirf ek baar — updateKey se track karo
      var _updateKey = '_mes_upd_' + U.uid + '_' + (r.requestedAt || r.updatedAt || '');
      if (!localStorage.getItem(_updateKey)) {
        localStorage.setItem(_updateKey, '1');
        toast('✅ Profile update approved!', 'ok');
      }
    } else if (r.status === 'rejected') {
      // Clear pending state so user can re-request
      db.ref('users/' + U.uid).update({ profileUpdatePending: false, profileStatus: 'not_requested', pendingIgn: null, pendingUid: null });
      toast('❌ Profile update rejected. Reason: ' + (r.rejectionReason || 'See notifications'), 'err');
    }
  });

  // L12: Match-based room reveal watcher (30s poll)
  setInterval(function() {
    for (var mid in MT) {
      var t = MT[mid]; if (!t || !hasJ(mid)) continue;
      if (t.roomStatus === 'released' && t.roomId && t.roomPassword && !_notifiedRooms[mid]) {
        var mt = Number(t.matchTime)||0, diff = mt - Date.now();
        if (diff > -7200000 && diff < 7200000) {
          _notifiedRooms[mid] = true;
          // Toast removed - already handled by L4 notification
          // showRP removed - handled by once-only Firebase check
        }
      }
      var st = (t.status||'').toLowerCase();
      if ((st === 'completed'||st === 'finished'||st === 'ended') && !_notifiedDone[mid]) {
        _notifiedDone[mid] = true;
        // Toast removed - handled by match watcher notification
      }
    }
  }, 30000);

  // Smart timer updates every second - ONLY update timer divs, no full re-render
  (function startMatchTimers() {
    window.startMatchTimers = startMatchTimers;
    function fmtCountdown(ms) {
      if (ms <= 0) return 'Starting soon...';
      var h = Math.floor(ms / 3600000);
      var m = Math.floor((ms % 3600000) / 60000);
      var s = Math.floor((ms % 60000) / 1000);
      if (h > 0) return h + 'h ' + m + 'm';
      if (m > 5) return m + 'm ' + s + 's';
      return (m > 0 ? m + 'm ' : '') + s + 's';
    }
    setInterval(function() {
      var now = Date.now();
      for (var mid in MT) {
        var el = document.getElementById('timer-' + mid);
        if (!el) continue;
        var t = MT[mid];
        var mt = Number(t.matchTime) || 0;
        if (!mt) { el.textContent = ''; continue; }
        var diff = mt - now;
        var es = effSt(t);
        if (es === 'live') {
          el.style.color = '#ff4455';
          el.textContent = '🔴 LIVE';
        } else if (es === 'completed') {
          el.style.color = 'var(--text-muted)';
          el.textContent = 'Ended';
        } else if (diff > 0) {
          el.style.color = diff < 300000 ? '#ff9900' : '#ffaa00';
          el.textContent = '⏱ ' + fmtCountdown(diff);
        } else {
          el.textContent = '';
        }
      }
    }, 1000);
    // Full re-render only on status CHANGE (upcoming→live→completed), not every 60s
    setInterval(function() {
      var needsRefresh = false;
      for (var mid in MT) {
        var t = MT[mid];
        var newSt = effSt(t);
        if (!t._lastSt) t._lastSt = newSt;
        if (t._lastSt !== newSt) { t._lastSt = newSt; needsRefresh = true; }
      }
      if (needsRefresh) { renderHome(); renderSP(); renderMM(); }
    }, 5000); // Check every 5s, but only re-render if status changed
  })();
}

/* ====== DETECT CHANGES ====== */
function detectChanges() {
  var newKeys = {};
  for (var k in MT) newKeys[k] = true;
  for (var k in newKeys) {
    var t = MT[k]; if (!t) continue;
    // New match detected
    if (!prevMTKeys[k]) {
      // auto new_match notif removed - only admin alerts shown in-app
    }
    // Room ID released — ONLY notify joined users + auto-show popup
    if (t.roomStatus === 'released' && t.roomId && t.roomPassword && !prevMTKeys[k + '_room']) {
      prevMTKeys[k + '_room'] = true;
      if (hasJ(k)) {
        // Push notification to database
        pushLocalNotif('room_released', '🔑 Room Details Released!',
          'Room ID & Password ready for "' + (t.name || 'Match') + '". Tap to view & copy.',
          t.name, k);
        // Show toast
        toast('🔑 Room ID released! Bell icon tap karo.', 'ok');
        // Show popup ONCE — Firebase seenRoomPopup tracks it
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        setTimeout(function(match){ showRP(match); }.bind(null, t), 600);
      }
    }
    // Match status changed to completed by admin — notify joined users
    var adminSt = (t.status || '').toString().toLowerCase().trim();
    if ((adminSt === 'completed' || adminSt === 'finished' || adminSt === 'ended') && !prevMTKeys[k + '_done']) {
      prevMTKeys[k + '_done'] = true;
      if (hasJ(k)) {
        pushLocalNotif('match_completed', '✅ Match Completed!',
          '"' + (t.name || 'Match') + '" has ended. Results will be announced soon.',
          t.name, k);
      }
    }
  }
  for (var k in newKeys) prevMTKeys[k] = true;
}
function pushLocalNotif(type, title, msg, matchName, matchId) {
  var exists = false;
  // For wallet/chat notifications, use matchId as unique key — don't duplicate
  NOTIFS.forEach(function(n) {
    if (n.matchId === matchId && n.type === type) exists = true;
  });
  if (exists) return;

  // Smart icon based on notification type
  var icon = 'fa-bell';
  if (type === 'room_released') icon = 'fa-key';
  else if (type === 'new_match' || type === 'match_starting' || type === 'match_completed') icon = 'fa-trophy';
  else if (type === 'wallet_approved' || type === 'withdraw_done') icon = 'fa-check-circle';
  else if (type === 'wallet_rejected' || type === 'withdraw_rejected') icon = 'fa-times-circle';
  else if (type === 'chat_reply') icon = 'fa-comments';
  else if (type === 'result') icon = 'fa-medal';

  var id = db.ref('notifications').push().key;
  db.ref('notifications/' + id).set({
    id: id, targetUserId: U.uid, type: type, title: title, message: msg,
    matchName: matchName || '', matchId: matchId || '',
    faIcon: icon,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });
}

/* ====== USER SEARCH ====== */
function showUserSearch() {
  var h = '<div>';
  h += '<div style="position:relative;margin-bottom:8px">';
  h += '<input type="text" id="usrSrchInput" placeholder="IGN ya FF UID search karo..." autocomplete="off" ';
  h += 'style="width:100%;padding:12px 14px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:14px;box-sizing:border-box" ';
  h += 'oninput="liveSearchUsers(this.value)">';
  h += '<i class="fas fa-search" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--txt2);font-size:14px"></i>';
  h += '</div>';
  h += '<div id="usrSrchResults" style="max-height:400px;overflow-y:auto"></div>';
  h += '</div>';
  openModal('🔍 Search Players', h);
  setTimeout(function() { var el = document.getElementById('usrSrchInput'); if (el) el.focus(); }, 100);
}

var _searchTimer = null;
function liveSearchUsers(q) {
  q = (q || '').trim();
  var res = document.getElementById('usrSrchResults'); if (!res) return;
  if (q.length < 1) { res.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt2);font-size:13px">Type karo search karne ke liye...</div>'; return; }
  res.innerHTML = '<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
  clearTimeout(_searchTimer);
  // Search from 1 char onwards
  _searchTimer = setTimeout(function() {
    var ql = q.toLowerCase();
    var results = [];
    // Search by IGN (name match)
    db.ref('users').orderByChild('ign').startAt(q).endAt(q + '').limitToFirst(10).once('value', function(s) {
      if (s.exists()) s.forEach(function(c) {
        var u = c.val(); if (u && (u.ign || u.displayName)) results.push({ uid: c.key, u: u });
      });
      // Also search by FF UID
      db.ref('users').orderByChild('ffUid').equalTo(q).limitToFirst(5).once('value', function(s2) {
        if (s2.exists()) s2.forEach(function(c) {
          var u = c.val();
          if (u && !results.find(function(r){ return r.uid === c.key; })) results.push({ uid: c.key, u: u });
        });
        renderSearchResults(results, q);
      });
    });
  }, 300);
}

function renderSearchResults(results, q) {
  var res = document.getElementById('usrSrchResults'); if (!res) return;
  if (!results.length) {
    res.innerHTML = '<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:30px;opacity:.3">🔍</div><p style="font-size:13px">Koi player nahi mila</p></div>';
    return;
  }
  var h = '';
  results.forEach(function(item) {
    var u = item.u, uid = item.uid;
    var isSelf = uid === (U && U.uid);
    var st = u.stats || {};
    var av = u.profileImage
      ? '<img src="' + u.profileImage + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'
      : '<span style="font-size:16px;font-weight:700">' + (u.ign || u.displayName || '?').charAt(0).toUpperCase() + '</span>';
    h += '<div onclick="viewPublicProfile(\'' + uid + '\')" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:var(--card);border:1px solid var(--border);margin-bottom:6px;cursor:pointer;transition:.1s" onmouseover="this.style.borderColor=\'var(--primary)\'" onmouseout="this.style.borderColor=\'var(--border)\'">';
    h += '<div style="width:44px;height:44px;border-radius:50%;background:rgba(0,255,156,.1);border:2px solid rgba(0,255,156,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0">' + av + '</div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:14px;font-weight:800;color:var(--txt)">' + (u.ign || u.displayName || 'Player') + (isSelf ? ' <span style="font-size:10px;color:var(--green)">(You)</span>' : '') + '</div>';
    h += '<div style="font-size:11px;color:var(--txt2);margin-top:1px">FF: ' + (u.ffUid || '—') + '</div>';
    h += '<div style="font-size:11px;color:var(--txt2)">';
    h += '🎮 ' + (st.matches || 0) + ' matches · 🏆 ' + (st.wins || 0) + ' wins · 💀 ' + (st.kills || 0) + ' kills';
    h += '</div></div>';
    h += '<i class="fas fa-chevron-right" style="color:var(--txt2);font-size:12px"></i>';
    h += '</div>';
  });
  res.innerHTML = h;
}

function viewPublicProfile(uid) {
  closeModal();
  db.ref('users/' + uid).once('value', function(s) {
    var u = s.val(); if (!u) { toast('Player nahi mila', 'err'); return; }
    var st = u.stats || {};
    var av = u.profileImage
      ? '<img src="' + u.profileImage + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'
      : '<span style="font-size:32px;font-weight:700">' + (u.ign || '?').charAt(0).toUpperCase() + '</span>';
    var h = '<div style="text-align:center;padding-bottom:12px">';
    h += '<div style="width:80px;height:80px;border-radius:50%;background:rgba(0,255,156,.1);border:3px solid rgba(0,255,156,.3);display:flex;align-items:center;justify-content:center;margin:0 auto 10px">' + av + '</div>';
    h += '<div style="font-size:20px;font-weight:900">' + (u.ign || u.displayName || 'Player') + '</div>';
    h += '<div style="font-size:12px;color:var(--txt2);margin-top:2px">FF UID: <strong style="color:var(--green)">' + (u.ffUid || '—') + '</strong></div>';
    if (u.bio) h += '<div style="font-size:12px;color:var(--txt2);margin-top:6px;font-style:italic">"' + u.bio + '"</div>';
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
    [['🎮', st.matches || 0, 'Matches'], ['🏆', st.wins || 0, 'Wins'], ['💀', st.kills || 0, 'Kills']].forEach(function(d) {
      h += '<div style="text-align:center;padding:10px;background:var(--card2);border-radius:10px;border:1px solid var(--border)">';
      h += '<div style="font-size:18px">' + d[0] + '</div><div style="font-size:16px;font-weight:800">' + d[1] + '</div>';
      h += '<div style="font-size:10px;color:var(--txt2)">' + d[2] + '</div></div>';
    });
    h += '</div>';
    var wr = st.matches > 0 ? Math.round((st.wins || 0) / st.matches * 100) : 0;
    h += '<div style="padding:10px;background:rgba(0,255,156,.06);border-radius:10px;text-align:center;font-size:12px;border:1px solid rgba(0,255,156,.12)">';
    h += 'Win Rate: <strong style="color:var(--green)">' + wr + '%</strong> · Earnings: <strong style="color:#ffd700">💎' + (st.earnings || 0) + '</strong>';
    h += '</div>';
    openModal('👤 ' + (u.ign || 'Player'), h);
  });
}


/* ====== MATCH CARD HTML ====== */
function mcHTML(t) {
  var es = effSt(t);
  /* Check t.mode FIRST (preferred), then t.type as fallback */
  var tp = (t.mode || t.type || 'solo').toString().toLowerCase().trim();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
  console.log('[Mini eSports] Card: ' + (t.name||'?') + ' mode=' + tp + ' (mode=' + t.mode + ', type=' + t.type + ')');
  var et = (t.entryType || '').toString().toLowerCase().trim();
  var isAd = et === 'ad';
  var isCoin = !isAd && (et === 'coin' || Number(t.entryFee) === 0);
  var joined = hasJ(t.id);
  var js = Number(t.joinedSlots) || 0, ms = Number(t.maxSlots) || 1;
  var pct = Math.min(Math.round(js / ms * 100), 100);
  var bc = tp === 'duo' ? 'badge-duo' : tp === 'squad' ? 'badge-squad' : 'badge-solo';
  var feeHTML = isAd ? '<span style="color:#ff9f1c;font-weight:800;font-size:12px">📺 ' + (Number(t.adsRequired)||2) + ' Ads Watch</span>' : (isCoin ? '<span class="fee-coin">🪙 ' + (t.entryFee || 0) + '</span>' : '<span class="fee-money">💎' + (t.entryFee || 0) + '</span>');
  var timeHTML = fmtTime(t.matchTime);
  if (timeHTML === 'Time Not Announced') timeHTML = '<span class="time-val">Time Not Announced</span>';
  else timeHTML = '<span class="time-val">' + timeHTML + '</span>';

  var modeClr = tp==='squad' ? '#b964ff' : tp==='duo' ? '#00d4ff' : '#00ff9c';
  // Hot badge: match full > 70% OR prize > 200
  var isHot = (pct >= 70);
  var isFeatured = t.isFeatured || t.isSpecial;
  var glowStr = es === 'live' ? '0 0 20px ' + modeClr + '55' : '0 4px 20px rgba(0,0,0,.35)';
  var h = '<div class="m-card" style="border-top:3px solid ' + modeClr + ';position:relative;overflow:hidden;box-shadow:' + glowStr + '">';
  h += '<div style="position:absolute;top:-40px;right:-40px;width:140px;height:140px;background:radial-gradient(circle,' + modeClr + '20,transparent 70%);pointer-events:none"></div>';
  if (isHot) h += '<div style="position:absolute;top:10px;left:-1px;background:linear-gradient(135deg,#ff4500,#ff8c00);color:#fff;font-size:9px;font-weight:900;padding:3px 10px 3px 6px;border-radius:0 20px 20px 0;letter-spacing:.5px">🔥 HOT</div>';
  if (t.isMonthlySpecial || t.specialCategory === 'monthly_special') h += '<div style="position:absolute;top:10px;right:8px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:8px;font-weight:900;padding:2px 8px;border-radius:20px;letter-spacing:.3px">👑 MONTHLY</div>'; 
  else if (t.isSundaySpecial || t.specialCategory === 'sunday_special') h += '<div style="position:absolute;top:10px;right:8px;background:linear-gradient(135deg,#b964ff,#00d4ff);color:#fff;font-size:8px;font-weight:900;padding:2px 8px;border-radius:20px;letter-spacing:.3px">⭐ SUNDAY</div>'; 
  h += '<div class="mc-top" style="' + (isHot?'padding-top:22px':'') + '"><div class="mc-head"><span class="mc-name" style="font-size:16px;font-weight:800;letter-spacing:-.2px">' + (t.name || 'Match') + '</span><div class="mc-badges"><span class="badge ' + bc + '" style="background:' + modeClr + '22;color:' + modeClr + ';border:1px solid ' + modeClr + '55;font-weight:800">' + tp.toUpperCase() + '</span>';
  if (isCoin) h += '<span class="badge badge-coin">COIN</span>';
  if (isAd) h += '<span class="badge" style="background:rgba(255,159,28,.15);color:#ff9f1c;border:1px solid rgba(255,159,28,.3);font-weight:800">📺 AD FREE</span>';
  if (t.minRank) { var _rEmoji={'Bronze':'🥉','Silver':'🥈','Gold':'🥇','Platinum':'🔷','Diamond':'💎'}; h += '<span class="badge" style="background:rgba(255,215,0,.1);color:#ffd700;border:1px solid rgba(255,215,0,.25);font-weight:800">' + (_rEmoji[t.minRank]||'🏅') + ' ' + t.minRank + '+</span>'; }
  if (es === 'live') h += '<span class="badge badge-live" style="animation:hotPulse 1.5s infinite">🔴 LIVE</span>';
  h += '</div></div>';
  if (es === 'live') {
    var matchStarted = t.matchTime && Date.now() >= Number(t.matchTime);
    if (matchStarted) {
      h += '<div class="mc-live"><i class="fas fa-circle"></i> Match is Live Now</div>';
    } else {
      h += '<span style="font-size:11px;color:var(--yellow);font-weight:600"><i class="fas fa-clock" style="animation:none;margin-right:3px"></i>Starting Soon</span>';
    }
  }
  var _subTypeMap = { battle_royale:'Battle Royale', clash_squad:'Clash Squad', sniper_only:'Sniper Only', shotgun_only:'Shotgun Only', pistol_only:'Pistol Only', no_heal:'No Heal', rush_only:'Rush Only' };
  var _subTypeLbl = _subTypeMap[t.matchSubType] || t.matchType || 'Battle Royale';
  h += '<div class="mc-sub"><span><i class="fas fa-gamepad"></i> ' + _subTypeLbl + '</span>';
  if (t.map) h += '<span><i class="fas fa-map"></i> ' + titleCase(t.map) + '</span>';
  var _subPerKill = Number(t.perKillPrize || t.perKill) || 0;
  if (_subPerKill) h += '<span style="color:#ff6b6b"><i class="fas fa-skull"></i> 💎' + _subPerKill + '/Kill</span>';

  h += '</div></div>';

  /* PRIZE BOXES - screenshot jaisa neon style */
  var _p1 = Number(t.firstPrize || t.prize1st) || 0;
  var _p2 = Number(t.secondPrize || t.prize2nd) || 0;
  var _p3 = Number(t.thirdPrize || t.prize3rd) || 0;
  if (_p1 || _p2 || _p3) {
    h += '<div class="mc-prizes">';
    var prizeDefs = [
      { cls:'mc-prize-1', icon:'🏆', rank:'1st PRIZE', val:_p1 },
      { cls:'mc-prize-2', icon:'🥈', rank:'2nd PRIZE', val:_p2 },
      { cls:'mc-prize-3', icon:'🥉', rank:'3rd PRIZE', val:_p3 }
    ];
    prizeDefs.forEach(function(p) {
      h += '<div class="mc-prize-box ' + p.cls + '">';
      h += '<div class="mc-prize-icon">' + p.icon + '</div>';
      h += '<div class="mc-prize-rank">' + p.rank + '</div>';
      h += '<div class="mc-prize-amt">' + (p.val ? '💎' + p.val : '—') + '</div>';
      h += '</div>';
    });
    h += '</div>';
  }

  /* BOTTOM 3-COL ROW: Entry Fee 30% | Per Kill 30% | Time 40% — NO prize pool box */
  var perKillVal = Number(t.perKillPrize || t.perKill) || 0;
  var perKillHTML = perKillVal
    ? '<span class="kill-val"><i class="fas fa-skull" style="font-size:11px;margin-right:2px"></i>💎' + perKillVal + '/Kill</span>'
    : '<span style="color:var(--txt2);font-size:11px;font-weight:600">N/A</span>';
  h += '<div class="mc-mid" style="grid-template-columns:30% 30% 40%">';
  h += '<div class="mc-cell" style="border-right:1px solid rgba(0,229,255,.12)"><label style="color:#00e5ff99">Entry Fee</label>' + feeHTML + '</div>';
  h += '<div class="mc-cell" style="border-right:1px solid rgba(255,107,107,.12)"><label style="color:#ff6b6b99">Per Kill</label>' + perKillHTML + '</div>';
  h += '<div class="mc-cell"><label style="color:#b964ff99">Start Time</label>' + timeHTML + '</div></div>';
  h += '<div class="mc-bot"><div class="mc-slots"><div class="mc-slots-txt">' + js + '/' + ms + ' Slots (' + pct + '% Full)</div>';
  h += '<div class="mc-bar"><div class="mc-bar-fill" style="width:' + pct + '%"></div></div>';
  h += '<div id="timer-' + t.id + '" style="font-size:11px;font-weight:700;margin-top:4px;color:#ffaa00;min-height:14px"></div></div>';
  // Share button removed from card
  h += '<div class="mc-info-btn" onclick="shareMatch(\'' + t.id + '\')" title="Invite Card"><i class="fas fa-share-alt"></i></div>';
  h += '<div class="mc-info-btn" onclick="showDet(\'' + t.id + '\')"><i class="fas fa-info-circle"></i></div>';

  // Determine if match actually started (past matchTime) or just in prep window
  var matchActuallyStarted = t.matchTime && Date.now() >= Number(t.matchTime);

  if (isVO()) h += '<button class="mc-join join-vo" disabled>View Only</button>';
  else if (joined) h += '<button class="mc-join joined" disabled>Joined ✔️</button>';
  else if (js >= ms) h += '<button class="mc-join join-full" disabled>Full</button>';
  else if (es === 'completed') h += '<button class="mc-join join-dis" disabled>Ended</button>';
  else if (es === 'live' && matchActuallyStarted) h += '<button class="mc-join join-dis" disabled>Started</button>';
  else if (es === 'live' && !matchActuallyStarted) h += isAd ? '<button class="mc-join join-ok" onclick="cJoin(\'' + t.id + '\')" style="background:linear-gradient(135deg,#ff9f1c,#ff6b00);color:#fff;font-weight:800;border:none">📺 Watch Ad & Join</button>' : '<button class="mc-join join-ok" onclick="cJoin(\'' + t.id + '\')">Join</button>';
  else h += isAd ? '<button class="mc-join join-ok" onclick="cJoin(\'' + t.id + '\')" style="background:linear-gradient(135deg,#ff9f1c,#ff6b00);color:#fff;font-weight:800;letter-spacing:0.5px;border:none">📺 Watch Ad & Join</button>' : '<button class="mc-join join-ok" onclick="cJoin(\'' + t.id + '\')" style="background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;letter-spacing:0.5px;border:none">⚡ JOIN</button>';
  /* Special Tournament eligibility info */
  if ((t.isSundaySpecial || t.isMonthlySpecial) && window.f29SpecialTournament) {
    h += window.f29SpecialTournament.getEligibilityInfo(t);
  }
  h += '</div></div>';
  return h;
}

/* ====== RENDER HOME ====== */
function renderHome() {
  var l = $('homeList'); if (!l) return;
  var f = [];
  for (var id in MT) {
    var t = MT[id];
    if (!t.maxSlots || t.maxSlots <= 0) continue;
    var es = effSt(t);
    if (es === 'cancelled') continue;
    /* Keep result-published matches visible in completed tab */
    if (es !== hSF) continue;
    if (t.isSpecial === true) continue;
    var tEntry = (t.entryType || '').toString().toLowerCase().trim();
    var wantCat = hCF.toString().toLowerCase().trim();
    var catMatch = false;
    if (wantCat === 'coin') catMatch = (tEntry === 'coin' || Number(t.entryFee) === 0);
    else if (wantCat === 'ad') catMatch = (tEntry === 'ad');
    else catMatch = (tEntry !== 'coin' && tEntry !== 'ad' && Number(t.entryFee) > 0);
    if (!catMatch) continue;
    // Mode filter from Feature 37
    if (window._modeFilter && window._modeFilter !== 'all') {
      var mMode = (t.mode || t.type || 'solo').toLowerCase();
      if (mMode !== window._modeFilter) continue;
    }
    f.push(t);
  }
  f.sort(function(a, b) { return (Number(a.matchTime) || 0) - (Number(b.matchTime) || 0); });
  console.log('[Mini eSports] renderHome: ' + f.length + ' matches for tab=' + hCF + ' status=' + hSF);

  // Build header with widgets
  var topHtml = '';
  // Feature 14: Quick Stats Widget
  /* Removed promotional home widget */
  // Feature 2: Profile Completion Bar — ONLY in profile section, not home
  // (profile section mein f41 already render karta hai)
  // Dynamic Banner (Feature 49)
  topHtml += '<div id="dynamicBanner" style="display:none;margin-bottom:10px;padding:8px 12px;border-radius:10px;font-size:12px;font-weight:700;text-align:center"></div>';
  // Trust badges row
  topHtml += '<div onclick="window.showTrustBadge&&showTrustBadge()" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 14px;margin-bottom:8px;background:rgba(0,255,106,.04);border:1px solid rgba(0,255,106,.1);border-radius:12px;cursor:pointer">';
  topHtml += '<span style="font-size:11px;color:var(--green);font-weight:700">🛡️ Zero Bots</span>';
  topHtml += '<span style="color:rgba(255,255,255,.15);font-size:10px">|</span>';
  topHtml += '<span style="font-size:11px;color:var(--txt2);font-weight:600">✅ 100% Skill</span>';
  topHtml += '<span style="color:rgba(255,255,255,.15);font-size:10px">|</span>';
  topHtml += '<span style="font-size:11px;color:var(--txt2);font-weight:600">🚫 No Gambling</span>';
  topHtml += '<span style="margin-left:auto;font-size:10px;color:var(--txt2)"><i class="fas fa-info-circle"></i></span></div>';
  // Feature 37: Mode Filter Chips
  if (window.renderFilterChips) topHtml += renderFilterChips();
  // Recommended widget removed

  l.innerHTML = topHtml + (f.length ? f.map(mcHTML).join('') : '<div class="empty-state"><i class="fas fa-trophy"></i><p>No ' + hCF + ' matches ' + hSF + '</p></div>');
  if (window.startMatchTimers) startMatchTimers();
  /* Promotional banners removed */
  // Feature 20: session match counter
  if (window._sessionMatches !== undefined) window._sessionMatches++;
}

/* ====== RENDER SPECIAL ====== */
function renderSP() {
  var l = $('specialList'); if (!l) return;
  var f = [];
  for (var id in MT) {
    var t = MT[id]; if (t.isSpecial !== true) continue;
    /* sunday_special OR weekly maps to spType='weekly', monthly_special maps to 'monthly' */
    var st = (t.specialType || t.matchType || 'weekly').toString().toLowerCase();
    var mappedType = (st === 'sunday_special' || st === 'weekly') ? 'weekly' : 'monthly';
    if (mappedType !== spType) continue; f.push(t);
  }
  f.sort(function(a, b) { return (Number(a.matchTime) || 0) - (Number(b.matchTime) || 0); });
  var label = spType === 'weekly' ? 'Sunday Special' : 'Monthly Special';
  l.innerHTML = f.length ? f.map(mcHTML).join('') : '<div class="empty-state"><i class="fas fa-crown"></i><p>No ' + label + ' matches</p></div>';
  updateCD(f);
}
function setSpec(type, el) {
  spType = type;
  document.querySelectorAll('.sp-tog-btn').forEach(function(b) { b.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderSP();
}
function updateCD(list) {
  if (cdInt) clearInterval(cdInt);
  var next = null;
  list.forEach(function(t) { var mt = Number(t.matchTime); if (mt && mt > Date.now() && (!next || mt < next)) next = mt; });
  if (!next) { $('cdD').textContent = '00'; $('cdH').textContent = '00'; $('cdM').textContent = '00'; $('cdS').textContent = '00'; return; }
  function tick() {
    var diff = next - Date.now();
    if (diff <= 0) { $('cdD').textContent = '00'; $('cdH').textContent = '00'; $('cdM').textContent = '00'; $('cdS').textContent = '00'; clearInterval(cdInt); return; }
    $('cdD').textContent = String(Math.floor(diff / 86400000)).padStart(2, '0');
    $('cdH').textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
    $('cdM').textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    $('cdS').textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  }
  tick(); cdInt = setInterval(tick, 1000);
}

/* ====== RENDER MY MATCHES ====== */
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
    h += '<div class="mm-card"><div class="mm-head"><span class="mm-name">' + (t.name || jr.matchName || 'Match') + '</span>';
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
        if (_releasedAt > 0 && Date.now() >= _releasedAt) _roomReady = true;
        else if (_releaseAt > 0 && Date.now() >= _releaseAt) _roomReady = true;
        else if (_releaseAt <= 0) _roomReady = true; // no matchTime set, show anyway
      } else if (t.roomStatus === 'saved') {
        if (_releaseAt > 0 && Date.now() >= _releaseAt) _roomReady = true;
      }
    }
    if (_roomReady) {
      h += '<div class="room-box rb-green" style="margin-top:8px"><div style="display:flex;justify-content:space-between;align-items:center"><span><strong>Room ID:</strong> ' + t.roomId + '</span><button onclick="copyTxt(\'' + t.roomId + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer"><i class="fas fa-copy"></i></button></div>';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span><strong>Password:</strong> ' + t.roomPassword + '</span><button onclick="copyTxt(\'' + t.roomPassword + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer"><i class="fas fa-copy"></i></button></div></div>';
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
      h += '<button onclick="window.showResultPage&&showResultPage(\'' + t.id + '\')" style="padding:8px;border-radius:8px;background:linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,140,0,.08));border:1px solid rgba(255,215,0,.35);color:#ffd700;font-size:11px;font-weight:800;cursor:pointer"><i class="fas fa-trophy"></i> View Result</button>';
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
    h += '<div style="flex:1"><div style="font-size:11px;color:var(--txt2)">Playing As</div><div style="font-size:14px;font-weight:800">' + (UD.ign || 'Player') + '</div><div style="font-size:12px;font-weight:700;color:var(--green)">FF UID: ' + _detFFUID + '</div></div>';
    h += '<button onclick="copyTxt(\'' + _detFFUID + '\')" style="background:rgba(0,255,156,.12);border:none;color:var(--green);padding:8px 10px;border-radius:8px;font-size:11px;cursor:pointer"><i class="fas fa-copy"></i></button>';
    h += '</div>';
  }
  h += '<div class=div class="d-row"><span class="dl">Match Name</span><span class="dv">' + (t.name || 'Match') + '</span></div>';
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
      h += '<div class="room-box rb-green" style="margin-top:12px"><div class="rp-label">Room ID</div><div style="display:flex;justify-content:space-between;align-items:center"><span class="room-big">' + t.roomId + '</span><button onclick="copyTxt(\'' + t.roomId + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div>';
      h += '<div class="rp-label" style="margin-top:8px">Password</div><div style="display:flex;justify-content:space-between;align-items:center"><span class="room-big">' + t.roomPassword + '</span><button onclick="copyTxt(\'' + t.roomPassword + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div></div>';
    } else { h += '<div class="room-box rb-yellow" style="margin-top:12px"><i class="fas fa-lock"></i> Join the match to see room details</div>'; }
  } else { h += '<div class="room-box rb-blue" style="margin-top:12px"><i class="fas fa-clock"></i> Room details will be shared before match start</div>'; }
  // Share Match button removed
  h += '<button onclick="shareMatch(\'' + id + '\')" style="width:100%;margin-top:14px;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-share-alt"></i> ⚡ Invite Friends</button>';
  h += '<button onclick="window.shareToInstagram&&shareToInstagram(\'' + id + '\')" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#e1306c,#833ab4,#f77737);color:#fff;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fab fa-instagram"></i> Share to Instagram Stories</button>';

  // Watchlist button removed

  // Feature 1: Match Reminder
  if (t.matchTime && Number(t.matchTime) > Date.now()) {
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
  h += '<span style="color:var(--txt2)">Match:</span> <strong>' + (t.name||'Match') + '</strong><br>';
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
  db.ref('users').orderByChild('ffUid').equalTo(ffUid).once('value', function(s) {
    if (!s.exists()) { toast('Player not found with this FF UID', 'err'); return; }
    var friendUid = null, friendData = null;
    s.forEach(function(c) { if (!friendUid) { friendUid = c.key; friendData = c.val(); } });
    if (friendUid === U.uid) { toast('Apne aap ko gift nahi kar sakte 😄', 'err'); return; }
    // Deduct from sender
    if (isCoin) db.ref('users/' + U.uid + '/coins').transaction(function(c) { return Math.max((c||0)-fee, 0); });
    else deductMoney(fee, 'Gift to ' + (friendData.ign||ffUid) + ' - ' + (t.name||'Match'));
    // Create gift ticket record
    var gid = db.ref('giftTickets').push().key;
    db.ref('giftTickets/' + gid).set({ fromUid: U.uid, fromName: UD.ign||UD.displayName||'', toUid: friendUid, toFFUid: ffUid, matchId: matchId, matchName: t.name||'', fee: fee, entryType: t.entryType||'paid', status: 'pending', createdAt: Date.now() });
    // Notify friend
    var nid = db.ref('users/' + friendUid + '/notifications').push().key;
    db.ref('users/' + friendUid + '/notifications/' + nid).set({ type: 'gift_ticket', title: '🎁 Match Ticket Gift!', body: (UD.ign||'A friend') + ' ne tumhe "' + (t.name||'Match') + '" ka entry ticket gift kiya!', matchId: matchId, giftId: gid, read: false, createdAt: Date.now() });
    closeModal();
    toast('🎁 Gift ticket sent successfully!', 'ok');
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
function cJoin(id) {
  // Check if already joined (as captain or team member)
  var _role = getJoinRole(id);
  if (_role === 'member') {
    toast('✅ Tum already team mein ho — captain ne join kar liya!', 'ok');
    navTo('matches'); return;
  }
  var t = MT[id]; if (!t || isVO()) return;
  if (hasJ(id)) { toast('Already joined!', 'inf'); return; }
  var es = effSt(t);
  var matchActuallyStarted = t.matchTime && Date.now() >= Number(t.matchTime);
  // Allow join during upcoming OR early live window (5 min before start)
  if (es === 'completed') { toast('Match has ended', 'err'); return; }
  if (es === 'live' && matchActuallyStarted) { toast('Match already started', 'err'); return; }
  if (es === 'cancelled') { toast('Match cancelled', 'err'); return; }
  var js = Number(t.joinedSlots) || 0, ms = Number(t.maxSlots) || 1;
  if (js >= ms) { toast('Slots full!', 'err'); return; }

  // ── RANK CHECK (if match has minRank set) ──
  if (t.minRank) {
    var rankOrder = { 'Bronze': 1, 'Silver': 2, 'Gold': 3, 'Platinum': 4, 'Diamond': 5 };
    var myStats = (UD && UD.stats) ? UD.stats : {};
    var myRankObj = calcRk(myStats);
    var myRankVal = rankOrder[myRankObj.badge] || 1;
    var reqRankVal = rankOrder[t.minRank] || 1;
    if (myRankVal < reqRankVal) {
      var reqEmojis = {'Bronze':'🥉','Silver':'🥈','Gold':'🥇','Platinum':'🔷','Diamond':'💎'};
      var rh = '<div style="text-align:center;padding:8px 0">';
      rh += '<div style="font-size:40px;margin-bottom:8px">🔒</div>';
      rh += '<div style="font-size:16px;font-weight:800;margin-bottom:6px">Rank Kam Hai!</div>';
      rh += '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">Is match ke liye minimum <b style="color:#ffd700">' + t.minRank + '</b> rank chahiye.</div>';
      rh += '<div style="display:flex;justify-content:center;gap:24px;margin-bottom:16px">';
      rh += '<div style="text-align:center"><div style="font-size:11px;color:#888;margin-bottom:4px">Tumhara Rank</div><div style="font-size:26px">' + myRankObj.emoji + '</div><div style="font-size:13px;font-weight:700;color:' + myRankObj.color + '">' + myRankObj.badge + '</div></div>';
      rh += '<div style="text-align:center"><div style="font-size:11px;color:#888;margin-bottom:4px">Required</div><div style="font-size:26px">' + (reqEmojis[t.minRank]||'🏅') + '</div><div style="font-size:13px;font-weight:700;color:#ffd700">' + t.minRank + '</div></div>';
      rh += '</div><div style="font-size:12px;color:#aaa;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.15);border-radius:10px;padding:10px">💡 Zyada matches khelo, kills karo — rank badh jayegi!</div></div>';
      showModal('🔒 Rank Lock', rh); return;
    }
  }

  // ── AD-BASED MATCH ──
  if ((t.entryType || '') === 'ad') { showAdJoinPopup(id); return; }

  var tp = (t.mode || t.type || 'solo').toString().toLowerCase().trim();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
  var isCoin = (t.entryType || '').toString().toLowerCase() === 'coin' || Number(t.entryFee) === 0;
  var fee = Number(t.entryFee) || 0;
  var bal = isCoin ? (UD.coins || 0) : getMoneyBal();
  var enough = bal >= fee;
  var slotsNeeded = tp === 'duo' ? 2 : tp === 'squad' ? 4 : 1;
  var h = '<div class="confirm-info">';
  h += '<div class="ci-row"><span class="cl">Match</span><span class="cv">' + (t.name || 'Match') + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Mode</span><span class="cv">' + tp.toUpperCase() + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Entry Fee</span><span class="cv">' + (isCoin ? '🪙 ' : '💎') + fee + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Slots Needed</span><span class="cv">' + slotsNeeded + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Your Balance</span><span class="cv" style="color:' + (enough ? 'var(--green)' : 'var(--red)') + '">' + (isCoin ? '🪙 ' : '💎') + bal + '</span></div></div>';
  if (UD.ign && UD.ffUid) h += '<div class="ci-locked"><i class="fas fa-lock"></i> Playing as: <strong>' + UD.ign + '</strong> (UID: ' + UD.ffUid + ')</div>';

  /* FEE SPLIT SELECTOR — only for duo/squad */
  if (tp === 'duo' || tp === 'squad') {
    window._feeType = 'captain_pays'; // default
    h += '<div style="margin:12px 0;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.08)">';
    h += '<div style="padding:8px 12px;background:rgba(255,255,255,.04);font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.5px">💸 Entry Fee — Kaun Pay Karega?</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0">';
    // Captain pays all
    h += '<div id="feeSplit_cap" onclick="selectFeeType(\'captain_pays\')" style="padding:10px;cursor:pointer;background:rgba(0,212,255,.12);border:2px solid rgba(0,212,255,.6);border-right:1px solid rgba(255,255,255,.08);transition:.2s">';
    h += '<div style="text-align:center"><div style="font-size:18px">👑</div>';
    h += '<div style="font-size:11px;font-weight:800;color:#00d4ff;margin-top:3px">Sirf Main</div>';
    h += '<div style="font-size:10px;color:#aaa;margin-top:2px">' + (isCoin?'🪙':'💎') + (fee * slotsNeeded) + ' akele dunga</div>';
    h += '<div style="font-size:9px;color:#ffd700;margin-top:3px">⚠️ Saari earning bhi mujhe milegi</div></div></div>';
    // Each pays own
    h += '<div id="feeSplit_each" onclick="selectFeeType(\'each_pays\')" style="padding:10px;cursor:pointer;background:rgba(255,255,255,.02);border:2px solid transparent;transition:.2s">';
    h += '<div style="text-align:center"><div style="font-size:18px">🤝</div>';
    h += '<div style="font-size:11px;font-weight:800;color:#00ff9c;margin-top:3px">Sab Apna Denge</div>';
    h += '<div style="font-size:10px;color:#aaa;margin-top:2px">Har player ' + (isCoin?'🪙':'💎') + fee + ' dega</div>';
    h += '<div style="font-size:9px;color:#00ff9c;margin-top:3px">✅ Har player apna prize pata hai</div></div></div>';
    h += '</div></div>';
  }
  if (tp === 'duo') {
    var savedDuo = getSavedTeam('duo');
    h += '<div style="margin:14px 0"><div style="font-size:14px;font-weight:700;margin-bottom:4px"><i class="fas fa-users"></i> Partner Details</div>';
    if (savedDuo && savedDuo.partners[0] && savedDuo.partners[0].memberUid) {
      /* SAVED PARTNER EXISTS — HIDE UID input completely, use saved partner silently */
      h += '<div id="savedTeamCard" style="background:rgba(0,255,106,.06);border:1px solid rgba(0,255,106,.2);border-radius:12px;padding:12px;margin-bottom:8px">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><i class="fas fa-link" style="color:var(--green);font-size:16px"></i><span style="font-size:13px;font-weight:700;color:var(--green)">Linked Partner — Auto Joined!</span></div>';
      h += '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--card);border-radius:10px">';
      h += '<div style="width:40px;height:40px;border-radius:50%;background:rgba(0,255,106,.12);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:var(--green)">' + (savedDuo.partners[0].memberName || 'P').charAt(0).toUpperCase() + '</div>';
      h += '<div style="flex:1"><div style="font-size:14px;font-weight:700">' + (savedDuo.partners[0].memberName || 'Partner') + '</div>';
      h += '<div style="font-size:11px;color:var(--txt2)">FF UID: ' + savedDuo.partners[0].memberUid + '</div></div>';
      h += '<span id="savedPartnerSt1" style="font-size:11px;color:var(--blue);padding:4px 8px;border-radius:6px;background:rgba(0,212,255,.1)">Verifying...</span></div>';
      h += '<div style="font-size:11px;color:var(--txt2);margin-top:8px;text-align:center"><i class="fas fa-info-circle"></i> Partner will be auto-added. No action needed.</div></div>';
      h += '<div style="text-align:center;margin-bottom:4px"><span style="font-size:11px;color:var(--txt2);cursor:pointer;text-decoration:underline" onclick="showManualPartner(\'duo\')">Use different partner?</span></div>';
      h += '<div id="manualPartnerWrap" style="display:none">';
    }
    h += '<div class="partner-field"><span class="pf-num">2</span><input type="text" id="partnerUid1" placeholder="Enter Partner FF UID" oninput="valPartner(1)"><span id="partnerSt1" class="pf-status"></span></div>';
    h += '<div id="partnerName1" style="font-size:12px;color:var(--txt2);margin-top:-6px;margin-bottom:8px"></div>';
    if (savedDuo && savedDuo.partners[0] && savedDuo.partners[0].memberUid) h += '</div>';
    h += '</div>';
  }
  if (tp === 'squad') {
    var savedSquad = getSavedTeam('squad');
    h += '<div style="margin:14px 0"><div style="font-size:14px;font-weight:700;margin-bottom:4px"><i class="fas fa-users"></i> Squad Details</div>';
    if (savedSquad && savedSquad.partners.length === 3) {
      /* ALL 3 LINKED — HIDE UID inputs, use saved squad silently */
      h += '<div id="savedTeamCard" style="background:rgba(0,255,106,.06);border:1px solid rgba(0,255,106,.2);border-radius:12px;padding:12px;margin-bottom:8px">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><i class="fas fa-link" style="color:var(--green);font-size:16px"></i><span style="font-size:13px;font-weight:700;color:var(--green)">Linked Squad — Auto Joined!</span></div>';
      savedSquad.partners.forEach(function(p, pi) {
        h += '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--card);border-radius:10px;margin-bottom:4px">';
        h += '<div style="width:32px;height:32px;border-radius:50%;background:rgba(0,255,106,.12);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--green)">' + (pi + 2) + '</div>';
        h += '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + (p.memberName || 'Partner') + '</div>';
        h += '<div style="font-size:11px;color:var(--txt2)">FF UID: ' + p.memberUid + '</div></div>';
        h += '<span id="savedPartnerSt' + (pi + 1) + '" style="font-size:11px;color:var(--blue);padding:3px 6px;border-radius:6px;background:rgba(0,212,255,.1)">Verifying...</span></div>';
      });
      h += '<div style="font-size:11px;color:var(--txt2);margin-top:8px;text-align:center"><i class="fas fa-info-circle"></i> All partners auto-added. No action needed.</div></div>';
      h += '<div style="text-align:center;margin-bottom:4px"><span style="font-size:11px;color:var(--txt2);cursor:pointer;text-decoration:underline" onclick="showManualPartner(\'squad\')">Enter manually instead?</span></div>';
      h += '<div id="manualPartnerWrap" style="display:none">';
    } else if (savedSquad && savedSquad.partners.length > 0) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 12px;background:rgba(0,255,106,.06);border:1px solid rgba(0,255,106,.15);border-radius:10px"><i class="fas fa-bolt" style="color:var(--green)"></i><span style="flex:1;font-size:12px;color:var(--green);font-weight:600">Saved ' + savedSquad.partners.length + ' member(s)! Auto-filling...</span></div>';
    }
    for (var i = 1; i <= 3; i++) {
      h += '<div class="partner-field"><span class="pf-num">' + (i + 1) + '</span><input type="text" id="partnerUid' + i + '" placeholder="Partner ' + i + ' FF UID" oninput="valPartner(' + i + ')"><span id="partnerSt' + i + '" class="pf-status"></span></div>';
      h += '<div id="partnerName' + i + '" style="font-size:12px;color:var(--txt2);margin-top:-6px;margin-bottom:8px"></div>';
    }
    if (savedSquad && savedSquad.partners.length === 3) h += '</div>';
    h += '</div>';
  }
  h += '<div class="ci-warn"><i class="fas fa-exclamation-triangle"></i> You must play using your registered IGN & UID. Mismatch = disqualification.</div>';
  if (!enough) h += '<div style="color:var(--red);font-size:13px;font-weight:600;margin-top:10px;text-align:center">❌ Insufficient balance!</div>';
  /* Balance check depends on feeType selection */
  var totalFeeForMe = (tp !== 'solo') ? ((window._feeType||'captain_pays') === 'captain_pays' ? fee * slotsNeeded : fee) : fee;
  var enoughForMe = bal >= totalFeeForMe;
  h += '<button class="f-btn fb-green" style="margin-top:14px" id="confirmJoinBtn" onclick="doJoin(\'' + id + '\')" ' + (enoughForMe ? '' : 'disabled') + '>Confirm Join (' + slotsNeeded + ' Slot' + (slotsNeeded > 1 ? 's' : '') + ')</button>';
  if (!enoughForMe) h += '<div style="font-size:11px;color:var(--red);text-align:center;margin-top:4px">⚠️ Insufficient balance. Wallet recharge karo.</div>';
  openModal('Join Tournament', h);
  
  /* AUTO-FILL or AUTO-VALIDATE saved teammates after modal renders */
  if (tp === 'duo' || tp === 'squad') {
    setTimeout(function() {
      var saved = getSavedTeam(tp);
      if (saved && saved.partners.length > 0) {
        /* If saved team card is showing (all partners saved), validate in background */
        var savedCard = $('savedTeamCard');
        if (savedCard) {
          validateSavedPartners(saved.partners, function(results) {
            var allValid = true;
            results.forEach(function(r) {
              var stEl = $('savedPartnerSt' + (r.index + 1));
              if (r.valid) {
                if (stEl) stEl.innerHTML = '<span style="color:var(--green)">✓ Verified</span>';
                partnerCache[r.index + 1] = r.data;
              } else {
                if (stEl) stEl.innerHTML = '<span style="color:var(--red)">✗ Not found</span>';
                allValid = false;
              }
            });
            if (!allValid) {
              toast('Some saved partners not found. Enter manually.', 'err');
              showManualPartner(tp);
            } else {
              console.log('[Mini eSports] ✅ All saved partners verified for ' + tp);
            }
          });
        } else {
          /* Partial saved team — auto-fill the fields */
          autoFillSavedTeam(tp);
        }
      }
    }, 300);
  }
}

/* Show manual partner entry fields (when user wants different partner) */
function selectFeeType(type) {
  window._feeType = type;
  var capEl = document.getElementById('feeSplit_cap');
  var eachEl = document.getElementById('feeSplit_each');
  if (capEl) {
    capEl.style.background = type === 'captain_pays' ? 'rgba(0,212,255,.12)' : 'rgba(255,255,255,.02)';
    capEl.style.border = type === 'captain_pays' ? '2px solid rgba(0,212,255,.6)' : '2px solid transparent';
  }
  if (eachEl) {
    eachEl.style.background = type === 'each_pays' ? 'rgba(0,255,156,.1)' : 'rgba(255,255,255,.02)';
    eachEl.style.border = type === 'each_pays' ? '2px solid rgba(0,255,156,.5)' : '2px solid transparent';
  }
}

function showManualPartner(mode) {
  var wrap = $('manualPartnerWrap');
  var card = $('savedTeamCard');
  if (wrap) wrap.style.display = '';
  if (card) card.style.display = 'none';
  /* Clear partnerCache so user must fill manually */
  partnerCache = {};
  /* Auto-fill from saved data as starting point */
  setTimeout(function() { autoFillSavedTeam(mode); }, 100);
}

function valPartner(n) {
  var inp = $('partnerUid' + n), st = $('partnerSt' + n), nm = $('partnerName' + n);
  if (!inp || !st) return;
  var uid = inp.value.trim();
  if (!uid) { st.innerHTML = ''; if (nm) nm.textContent = ''; return; }
  if (uid.length < 5) { st.innerHTML = '<span class="pf-err">Too short</span>'; if (nm) nm.textContent = ''; return; }
  if (uid === UD.ffUid) { st.innerHTML = '<span class="pf-err">Can\'t add yourself</span>'; if (nm) nm.textContent = ''; return; }
  st.innerHTML = '<span style="color:var(--blue)">...</span>';
  db.ref('users').orderByChild('ffUid').equalTo(uid).once('value', function(s) {
    if (s.exists()) {
      var found = null, foundKey = null; s.forEach(function(c) { found = c.val(); foundKey = c.key; });
      st.innerHTML = '<span class="pf-ok">✓ Found</span>';
      if (nm) nm.textContent = found.ign || found.displayName || 'Player';
      partnerCache[n] = found;
      partnerCache[n]._fbUid = foundKey; // Store Firebase UID for partner joinRequest
    } else { st.innerHTML = '<span class="pf-err">✗ Not found</span>'; if (nm) nm.textContent = ''; delete partnerCache[n]; }
  });
}

function doJoin(id) {
  // ✅ LEGAL: Self-exclusion check
  if (window.mesCheckExclusion && window.mesCheckExclusion()) return;
  var t = MT[id]; if (!t) return;
  var tp = (t.mode || t.type || 'solo').toString().toLowerCase().trim();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
  /* Special Tournament eligibility check */
  if (window.f29SpecialTournament && (t.matchType === 'sunday_special' || t.matchType === 'monthly_special' || t.isSundaySpecial || t.isMonthlySpecial)) {
    window.f29SpecialTournament.checkEligibility(t, function(ok, reason) {
      if (!ok) { toast('❌ ' + (reason || 'Aap is match ke liye eligible nahi hain abhi'), 'err'); return; }
      _doJoinCore(id, t, tp);
    });
    return;
  }
  _doJoinCore(id, t, tp);
}

function _doJoinCore(id, t, tp) {
  var isCoin = (t.entryType || '').toString().toLowerCase() === 'coin' || Number(t.entryFee) === 0;
  var fee = Number(t.entryFee) || 0;
  var slotsNeeded = tp === 'duo' ? 2 : tp === 'squad' ? 4 : 1;
  var team = [{ uid: UD.ffUid || '', name: UD.ign || UD.displayName || '', role: 'captain' }];
  if (tp === 'duo') {
    /* Check if partner is linked (saved) — use directly without manual input */
    if (!partnerCache[1]) {
      /* No partner validated yet — check if saved partner is available */
      var savedDuo = getSavedTeam('duo');
      if (savedDuo && savedDuo.partners[0] && savedDuo.partners[0].memberUid) {
        /* Use saved partner silently — but need to verify they exist */
        toast('Verifying linked partner...', 'inf');
        return; /* Wait for background validation to populate partnerCache */
      }
      toast('Validate partner UID first', 'err'); return;
    }
    team.push({ uid: partnerCache[1].ffUid, name: partnerCache[1].ign || partnerCache[1].displayName || '', role: 'member' });
  }
  if (tp === 'squad') {
    for (var i = 1; i <= 3; i++) {
      if (!partnerCache[i]) {
        /* Check if saved squad exists — use directly */
        var savedSquad = getSavedTeam('squad');
        if (savedSquad && savedSquad.partners.length === 3) {
          toast('Verifying linked squad...', 'inf');
          return; /* Wait for background validation */
        }
        toast('Validate all 3 partner UIDs', 'err'); return;
      }
      for (var j = 1; j < i; j++) { if (partnerCache[j].ffUid === partnerCache[i].ffUid) { toast('Duplicate partner UID!', 'err'); return; } }
      team.push({ uid: partnerCache[i].ffUid, name: partnerCache[i].ign || partnerCache[i].displayName || '', role: 'member' });
    }
  }
  var matchPath = (t._src || 'matches') + '/' + id;
  var ref = db.ref(matchPath + '/joinedSlots');
  ref.transaction(function(cur) {
    cur = (cur || 0) + slotsNeeded;
    if (cur > (Number(t.maxSlots) || 1)) return;
    return cur;
  }, function(err, committed, snap) {
    if (err || !committed) { toast('Failed to book slots', 'err'); return; }
    /* BUG FIX #5: Also update filledSlots for Admin panel sync */
    db.ref(matchPath + '/filledSlots').transaction(function(v) {
      return (v || 0) + slotsNeeded;
    });

    /* SLOT ASSIGNMENT: Calculate slot(s) for this player */
    var newTotal = snap ? snap.val() : 0;
    var firstSlotNum = newTotal - slotsNeeded + 1; // e.g. if total=4,needed=2 → first=3
    var assignedSlots = [];
    if (tp === 'solo') {
      assignedSlots = [String(firstSlotNum)];
    } else if (tp === 'duo') {
      // Team number = ceil(firstSlotNum/2), positions 1 and 2
      var teamNum = Math.ceil(firstSlotNum / 2);
      assignedSlots = [teamNum + '/1', teamNum + '/2'];
    } else { // squad
      var teamNumS = Math.ceil(firstSlotNum / 4);
      assignedSlots = [teamNumS+'/1', teamNumS+'/2', teamNumS+'/3', teamNumS+'/4'];
    }
    var mySlot = assignedSlots[0]; // captain/solo gets first slot

    // DUPLICATE JOIN CHECK - prevent same user joining same match twice
    var existingJoin = false;
    Object.keys(JR).forEach(function(k) {
      var jr = JR[k];
      if (jr && jr.matchId === id && jr.userId === U.uid && jr.status !== 'cancelled') {
        existingJoin = true;
      }
    });
    if (existingJoin) {
      toast('⚠️ Tum already is match mein join ho!', 'err');
      setLoading(null, false);
      return;
    }
    var jid = db.ref('joinRequests').push().key;
    var _feeType = (tp !== 'solo') ? (window._feeType || 'captain_pays') : 'solo';
    /* captain_pays: captain pays full fee×slots, all winnings to captain */
    /* each_pays: each player pays own fee, each gets own prize */
    var _captainFee = (_feeType === 'captain_pays') ? fee * slotsNeeded : fee;
    db.ref('joinRequests/' + jid).set({
      requestId: jid, userId: U.uid, userName: UD.ign || '', userFFUID: UD.ffUid || '',
      displayName: UD.displayName || '', userEmail: UD.email || '',
      matchId: id, matchName: t.name || '', entryFee: _captainFee, entryType: isCoin ? 'coin' : 'money',
      mode: tp, status: 'joined', slotsBooked: slotsNeeded, teamMembers: team,
      slotNumber: mySlot, allSlots: assignedSlots,
      captainUid: tp !== 'solo' ? U.uid : null,
      feeType: _feeType,
      isTeamMember: false,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    if (isCoin) {
      db.ref('users/' + U.uid + '/coins').transaction(function(c) { return Math.max((c || 0) - _captainFee, 0); });
      db.ref('users/' + U.uid + '/coinHistory').push({ amount: -_captainFee, reason: 'Match Entry: ' + (t.name || 'Match') + (_feeType==='captain_pays'&&tp!=='solo'?' (Full team)':''), timestamp: Date.now() });
    }
    else deductMoney(_captainFee, 'Match Entry: ' + (t.name || 'Match') + (_feeType==='captain_pays'&&tp!=='solo'?' (Full team)':''));
    db.ref('users/' + U.uid + '/stats/matches').transaction(function(m) { return (m || 0) + 1; });
    /* Save last used team to localStorage for quick join next time */
    if (tp === 'duo' && partnerCache[1]) {
      try { localStorage.setItem('lastDuoPartner', JSON.stringify({ uid: partnerCache[1].ffUid, name: partnerCache[1].ign || partnerCache[1].displayName || '' })); } catch(e) {}
      /* AUTO-SAVE to Firebase duoTeam so profile mein bhi dikhe */
      if (partnerCache[1].ffUid && partnerCache[1]._fbUid) {
        var _pc1 = partnerCache[1];
        db.ref('users/' + U.uid + '/duoTeam').set({ memberUid: _pc1._fbUid, memberFfUid: _pc1.ffUid, memberName: _pc1.ign || _pc1.displayName || '', addedAt: Date.now() });
        db.ref('users/' + _pc1._fbUid + '/duoTeam').set({ memberUid: U.uid, memberFfUid: UD.ffUid || '', memberName: UD.ign || UD.displayName || '', addedAt: Date.now() });
      }
    }
    if (tp === 'squad') {
      var savedSquad = [];
      for (var si = 1; si <= 3; si++) { if (partnerCache[si]) savedSquad.push({ uid: partnerCache[si].ffUid, name: partnerCache[si].ign || partnerCache[si].displayName || '' }); }
      try { localStorage.setItem('lastSquadPartners', JSON.stringify(savedSquad)); } catch(e) {}
      /* AUTO-SAVE squad to Firebase */
      var _sqMembers = [];
      for (var qi = 1; qi <= 3; qi++) {
        if (partnerCache[qi] && partnerCache[qi]._fbUid) {
          var _pm = partnerCache[qi];
          _sqMembers.push({ uid: _pm._fbUid, ffUid: _pm.ffUid || '', name: _pm.ign || _pm.displayName || '', addedAt: Date.now() });
          /* Also update partner's squadTeam */
          db.ref('users/' + _pm._fbUid + '/squadTeam').set({ members: [{ uid: U.uid, ffUid: UD.ffUid||'', name: UD.ign||UD.displayName||'' }].concat(_sqMembers.filter(function(m){return m.uid!==_pm._fbUid;})), updatedAt: Date.now() });
        }
      }
      if (_sqMembers.length > 0) {
        db.ref('users/' + U.uid + '/squadTeam').set({ members: _sqMembers, updatedAt: Date.now() });
      }
    }
    // Partner joinRequests banao taaki unhe My Matches mein dikhe
    var _makePartnerJR = function(pUid, pName, pFFUid, pIndex) {
      if (!pUid) { console.warn('[Team] _makePartnerJR: pUid missing for index', pIndex); return; }
      if (pUid === U.uid) return; // don't create for self
      var pSlotIdx = (pIndex || 1);
      var pSlot = assignedSlots ? (assignedSlots[pSlotIdx] || assignedSlots[0]) : null;
      var pjid = db.ref('joinRequests').push().key;
      /* each_pays: partner pays own fee; captain_pays: partner entry is free */
      var pEntryFee = (_feeType === 'each_pays') ? fee : 0;
      var pjData = {
        requestId: pjid, userId: pUid, userName: pName || '', userFFUID: pFFUid || '',
        displayName: pName || '',
        matchId: id, matchName: t.name || '', entryFee: pEntryFee,
        entryType: isCoin ? 'coin' : 'money', mode: tp, status: 'joined',
        slotsBooked: 0, teamMembers: team, captainUid: U.uid,
        captainName: UD.ign || UD.displayName || '',
        slotNumber: pSlot || null,
        allSlots: assignedSlots || null,
        feeType: _feeType,
        isTeamMember: true,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      db.ref('joinRequests/' + pjid).set(pjData);
      db.ref('users/' + pUid + '/stats/matches').transaction(function(m) { return (m||0)+1; });
      
      /* each_pays: deduct fee from partner's wallet */
      if (_feeType === 'each_pays' && pEntryFee > 0) {
        if (isCoin) {
          db.ref('users/' + pUid + '/coins').transaction(function(c) { return Math.max((c||0)-pEntryFee, 0); });
        } else {
          /* Deduct from partner's money — winnings first, then deposited */
          db.ref('users/' + pUid + '/realMoney').once('value', function(rs) {
            var rm = rs.val() || {};
            var dep = Number(rm.deposited)||0, win = Number(rm.winnings)||0, bon = Number(rm.bonus)||0;
            var left = pEntryFee;
            if (dep >= left) { db.ref('users/'+pUid+'/realMoney/deposited').set(dep-left); }
            else { left -= dep; db.ref('users/'+pUid+'/realMoney/deposited').set(0);
              if (win >= left) { db.ref('users/'+pUid+'/realMoney/winnings').set(win-left); }
              else { left -= win; db.ref('users/'+pUid+'/realMoney/winnings').set(0);
                db.ref('users/'+pUid+'/realMoney/bonus').set(Math.max(bon-left, 0)); }
            }
            db.ref('users/'+pUid+'/transactions').push({type:'debit',amount:-pEntryFee,description:'Match Entry: '+(t.name||'Match')+' (Each pays own)',timestamp:Date.now()});
          });
        }
      }
      
      // Notify partner
      var notifId = db.ref('users/' + pUid + '/notifications').push().key;
      var notifBody = _feeType === 'each_pays'
        ? (UD.ign||'Captain') + ' ne team join kiya! \"' + (t.name||'match') + '\" — Entry fee 💎' + pEntryFee + ' tumhare wallet se kati gai.'
        : (UD.ign || 'Your teammate') + ' ne "' + (t.name||'match') + '" join kiya — tum bhi team mein ho! Captain ne fee di hai.';
      db.ref('users/' + pUid + '/notifications/' + notifId).set({
        type: 'team_joined', title: '🎮 Match Joined!',
        body: notifBody,
        matchId: id, read: false, createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      console.log('[Team] Created joinRequest for partner: uid=' + pUid + ' feeType=' + _feeType + ' slot=' + pSlot);
    };

    /* Safe wrapper: if _fbUid available use it, else look up by ffUid */
    var _safePartnerJR = function(partnerObj, pIndex) {
      if (!partnerObj) return;
      if (partnerObj._fbUid && partnerObj._fbUid !== U.uid) {
        _makePartnerJR(partnerObj._fbUid, partnerObj.ign||partnerObj.displayName||'', partnerObj.ffUid||'', pIndex);
      } else if (partnerObj.ffUid) {
        /* Fallback: look up Firebase UID from ffUid */
        var _ffUid = partnerObj.ffUid;
        var _pName = partnerObj.ign || partnerObj.displayName || '';
        db.ref('users').orderByChild('ffUid').equalTo(_ffUid).once('value', function(s) {
          if (s.exists()) {
            var fbKey = null; s.forEach(function(c) { fbKey = c.key; });
            if (fbKey && fbKey !== U.uid) {
              _makePartnerJR(fbKey, _pName, _ffUid, pIndex);
            } else {
              console.warn('[Team] _safePartnerJR fallback: fbKey not found for ffUid', _ffUid);
            }
          }
        });
      } else {
        console.warn('[Team] _safePartnerJR: no uid or ffUid for partner at index', pIndex);
      }
    };
    if (tp === 'duo' && partnerCache[1]) {
      _safePartnerJR(partnerCache[1], 1);
    }
    if (tp === 'squad') {
      for (var _si = 1; _si <= 3; _si++) {
        if (partnerCache[_si]) {
          _safePartnerJR(partnerCache[_si], _si);
        }
      }
    }
    partnerCache = {}; closeModal(); toast('Joined successfully! 🎮', 'ok');
  }, false);
}

function deductMoney(amt, reason) {
  var rm = UD.realMoney || {};
  var dep = Number(rm.deposited) || 0, win = Number(rm.winnings) || 0, bon = Number(rm.bonus) || 0;
  var left = amt;
  if (dep >= left) { db.ref('users/' + U.uid + '/realMoney/deposited').set(dep - left); }
  else { left -= dep; db.ref('users/' + U.uid + '/realMoney/deposited').set(0);
    if (win >= left) { db.ref('users/' + U.uid + '/realMoney/winnings').set(win - left); }
    else { left -= win; db.ref('users/' + U.uid + '/realMoney/winnings').set(0);
      db.ref('users/' + U.uid + '/realMoney/bonus').set(Math.max(bon - left, 0)); }
  }
  // Record in wallet transaction history
  db.ref('users/' + U.uid + '/transactions').push({
    type: 'debit', amount: -amt,
    description: reason || 'Entry Fee',
    timestamp: Date.now(), read: false
  });
  // TDS TRACKING: Entry fees paid cumulative track karo (Section 194BA)
  if (amt > 0) { db.ref('users/' + U.uid + '/tds/entryFeesPaid').transaction(function(v) { return (v||0)+amt; }); }
}

/* ====== REFUND SYSTEM ====== */
function checkRefunds() {
  for (var k in JR) {
    var jr = JR[k]; if (jr.refunded) continue;
    var t = MT[jr.matchId]; if (!t) continue;
    var st = (t.status || '').toString().toLowerCase().trim();
    if (st === 'cancelled' || st === 'canceled') {
      var fee = Number(jr.entryFee) || 0; if (fee <= 0) continue;
      if (jr.entryType === 'coin') db.ref('users/' + U.uid + '/coins').transaction(function(c) { return (c || 0) + fee; });
      else db.ref('users/' + U.uid + '/realMoney/deposited').transaction(function(d) { return (d || 0) + fee; });
      db.ref('joinRequests/' + k + '/refunded').set(true);
      toast('💎' + fee + ' refunded for cancelled match!', 'ok');
    }
  }
}

/* ====== ROOM POPUP ====== */
/* Room ID sirf 15 min pehle se dikhao, join karte hi nahi */
function showRP(t, forceShow) {
  if (!t || !t.roomId || !t.roomPassword) return;
  // Check: match time ke 15 min pehle se hi dikhao
  var mt = Number(t.matchTime) || 0;
  var now = Date.now();
  var diff = mt - now; // positive = future, negative = past
  // 15 min = 900000ms. Only show if within 15 min window or already started (up to 2 hrs after)
  if (!forceShow && mt > 0 && diff > 900000) {
    // Match 15+ min dur hai, abhi nahi dikhao
    return;
  }
  var mid = t.id || t.matchId || t.key || '';
  if (!forceShow && mid && U) {
    // ✅ FIX: localStorage check bhi karo — Firebase call se pehle instant check
    var _lsRoomKey = '_mes_room_' + U.uid + '_' + mid;
    if (localStorage.getItem(_lsRoomKey)) return; // Already shown
    db.ref('users/' + U.uid + '/seenRoomPopup/' + mid).once('value', function(snap) {
      if (snap.val()) { localStorage.setItem(_lsRoomKey, '1'); return; } // Already shown
      db.ref('users/' + U.uid + '/seenRoomPopup/' + mid).set(true);
      localStorage.setItem(_lsRoomKey, '1');
      _doShowRP(t);
    });
    return;
  }
  _doShowRP(t);
}
function _doShowRP(t) {
  if (!t || !t.roomId || !t.roomPassword) return;
  history.pushState(null, null, null);

  // Find this user's joinRequest for this match to get slotNumber
  var jKey = null, mySlot = null, allSlots = null;
  for (var k in JR) {
    if ((JR[k].matchId === t.id || JR[k].matchId === t.matchId) && JR[k].userId === U.uid) {
      jKey = k; mySlot = JR[k].slotNumber; allSlots = JR[k].allSlots; break;
    }
  }
  var gameMode = (t.mode || t.type || 'solo').toLowerCase();

  var h = '<div class="room-popup-overlay" onclick="if(event.target===this)this.remove()"><div class="room-popup">';
  h += '<div class="rp-icon">🔑</div>';
  h += '<div class="rp-title">Room Details Released!</div>';
  h += '<div class="rp-match">' + (t.name || 'Match') + '</div>';

  // SLOT DISPLAY — prominent
  if (mySlot) {
    var slotLabel = gameMode === 'solo' ? 'Your Slot Number' : 'Your Team Slots';
    var slotDisplay = gameMode === 'solo' ? mySlot : (allSlots ? allSlots.join(', ') : mySlot);
    h += '<div class="rp-slot-box">' +
      '<div class="rp-slot-label">' + slotLabel + '</div>' +
      '<div class="rp-slot-value">' + slotDisplay + '</div>' +
    '</div>';
    // STRICT WARNING
    h += '<div class="rp-slot-warning">' +
      '<i class="fas fa-exclamation-triangle"></i>' +
      '<strong> STRICT WARNING:</strong> Aapko <strong>Slot ' + slotDisplay + '</strong> mein hi baithna hai. ' +
      'Galat slot mein baithne par aapko <strong>disqualify</strong> kar diya jaega aur prize nahi milega. ' +
      'Slot mein baithne ke baad hi <strong>"I\'m In Room"</strong> confirm karein.' +
    '</div>';
  }

  h += '<div class="rp-box"><div class="rp-label">Room ID</div><div class="rp-value"><span>' + t.roomId + '</span><button class="rp-copy" onclick="copyTxt(\'' + t.roomId + '\')"><i class="fas fa-copy"></i></button></div></div>';
  h += '<div class="rp-box"><div class="rp-label">Password</div><div class="rp-value"><span>' + t.roomPassword + '</span><button class="rp-copy" onclick="copyTxt(\'' + t.roomPassword + '\')"><i class="fas fa-copy"></i></button></div></div>';
  // Find joinRequest key for this match
  var jKey = null;
  for (var k in JR) { if (JR[k].matchId === t.id || JR[k].matchId === t.matchId) { jKey = k; break; } }
  var alreadyIn = jKey && JR[jKey] && JR[jKey].inRoom;
  
  if (jKey) {
    if (alreadyIn) {
      h += '<div class="inroom-confirmed"><i class="fas fa-check-circle"></i> You confirmed entering the room!</div>';
    } else {
      h += '<button class="btn-inroom" onclick="confirmInRoom(\'' + jKey + '\',this)"><i class="fas fa-gamepad"></i> I\'m In Room ✅</button>';
    }
  }
  h += '<button class="rp-close" onclick="this.closest(\'.room-popup-overlay\').remove()">Got it!</button></div></div>';
  $('rpContainer').innerHTML = h;
}

/* ====== IN ROOM CONFIRM ====== */
function confirmInRoom(jKey, btn) {
  if (!jKey || !U) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
  db.ref('joinRequests/' + jKey).update({
    inRoom: true,
    inRoomAt: Date.now()
  }).then(function() {
    btn.outerHTML = '<div class="inroom-confirmed"><i class="fas fa-check-circle"></i> You confirmed entering the room!</div>';
    toast('✅ Room entry confirmed! Admin will see you.', 'ok');
  }).catch(function(e) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-gamepad"></i> I\'m In Room ✅';
    toast('Error: ' + e.message, 'err');
  });
}

/* ====== WALLET ====== */

function setWFilter(f) {
  window._wFilter = f;
  renderWallet(); // re-renders with updated filter tabs
}
function renderWallet() {
  if (!UD) return;
  // Null-safe balance calculation — ALWAYS works even if realMoney missing
  var rm = UD.realMoney || { deposited: 0, winnings: 0, bonus: 0 };
  var dep = Math.max(Number(rm.deposited) || 0, 0);
  var win = Math.max(Number(rm.winnings) || 0, 0);
  var bon = Math.max(Number(rm.bonus) || 0, 0);
  var total = dep + win + bon;
  var coins = Math.max(Number(UD.coins) || 0, 0);

  // Update wallet UI elements
  var wt = $('wTotal'), wb = $('wBreak'), wc = $('wCoins');
  if (wt) wt.textContent = '💎 ' + total;
  if (wb) wb.innerHTML = 'Deposited: 💎' + dep + ' | Winnings: 💎' + win + ' | Bonus: 💎' + bon;
  if (wc) wc.textContent = '🪙 ' + coins;

  // ALWAYS update header balance in real-time
  updateHdr();
  console.log('[Mini eSports] 💰 Wallet: ₹' + total + ' (D:' + dep + ' W:' + win + ' B:' + bon + ') Coins:' + coins);

  // Check milestone
  // milestone/promo notifications removed

  var wh = $('walletHist'); if (!wh) return;

  // Feature 15: Wallet Stats widget above history
  var statsHtml = '';
  if (window.renderWalletStats) statsHtml = window.renderWalletStats();

  // Merge wallet requests (deposit/withdraw) + transactions (entry fees, winnings)
  var allTxns = [];
  WH.forEach(function(w) {
    allTxns.push({ _src: 'wh', _ts: w.createdAt || w.timestamp || 0, data: w });
  });
  TXNS.forEach(function(t) {
    allTxns.push({ _src: 'txn', _ts: t.timestamp || 0, data: t });
  });
  // Synthetic entry: if winnings > 0 but no winning transaction, show balance entry
  var existingWinTxn = TXNS.some(function(t) { return t.type === 'winning' || t.type === 'result'; });
  var currentWin = Number((UD.realMoney || {}).winnings) || 0;
  if (currentWin > 0 && !existingWinTxn) {
    allTxns.push({ _src: 'txn', _ts: 0, data: { type: 'winning', amount: currentWin, description: 'Match Winnings (total)', timestamp: 0, _synthetic: true } });
  }
  allTxns.sort(function(a,b) { return b._ts - a._ts; });

  if (!allTxns.length) {
    wh.innerHTML = statsHtml + '<div style="text-align:center;color:var(--txt2);padding:20px;font-size:13px">No transactions yet</div>';
    return;
  }
  // Build filter tabs dynamically (single row, always fresh)
  var activeFilter = (window._wFilter || 'all');
  var filterHtml = '<div id="walletFilterRow" style="display:flex;gap:8px;margin-bottom:12px">' +
    ['all','credit','debit'].map(function(f) {
      var labels = { all: 'All', credit: 'Credits (+)', debit: 'Debits (-)' };
      var isActive = activeFilter === f;
      return '<button onclick="setWFilter(\'' + f + '\')" style="flex:1;padding:7px;border-radius:10px;' +
        (isActive ? 'background:var(--primary,#00ff9c);color:#000;' : 'background:rgba(255,255,255,.06);color:var(--txt2);') +
        'font-size:12px;font-weight:700;border:none;cursor:pointer">' + labels[f] + '</button>';
    }).join('') + '</div>';
  var h = filterHtml + statsHtml;
  allTxns.forEach(function(item) {
    var w = item.data;
    if (item._src === 'wh') {
      // Deposit/Withdrawal request
      var isD = w.type === 'deposit' || w.type === 'add';
      if (activeFilter === 'credit' && !isD) return;
      if (activeFilter === 'debit' && isD) return;
      var sc = w.status === 'approved' || w.status === 'done' ? 'whs-a' : w.status === 'rejected' ? 'whs-r' : 'whs-p';
      var sl = w.status === 'approved' || w.status === 'done' ? 'Done' : w.status === 'rejected' ? 'Failed' : 'Pending';
      var amt = Math.abs(w.amount || 0);
      h += '<div class="wh-card"><div class="wh-icon ' + (isD ? 'whi-g' : 'whi-r') + '"><i class="fas fa-' + (isD ? 'arrow-up' : 'arrow-down') + '"></i></div>';
      h += '<div class="wh-info"><div class="wh-name">' + (isD ? 'Deposit via UPI' : 'Withdrawal') + '</div>';
      h += '<div class="wh-time">' + timeAgo(w.createdAt || w.timestamp) + '</div>';
      if (w.utr || w.transactionId) h += '<div class="wh-utr">UTR: ' + (w.utr || w.transactionId) + '</div>';
      h += '</div><div class="wh-amt ' + (isD ? 'wha-g' : 'wha-r') + '">' + (isD ? '+' : '-') + '💎' + amt + '</div>';
      h += '<span class="wh-status ' + sc + '">' + sl + '</span></div>';
    } else {
      // Internal transactions (entry fee, winnings, cashback, etc)
      var amt2 = w.amount || 0;
      var isCredit = amt2 > 0;
      if (activeFilter === 'credit' && !isCredit) return;
      if (activeFilter === 'debit' && isCredit) return;
      var typeMap = { winning: '🏆 Prize Won', debit: '🎮 Entry Fee', credit: '💰 Bonus', cashback: '🔄 Cashback', referral: '🤝 Referral', refund: '↩️ Refund' };
      var label = typeMap[w.type] || w.description || w.type || 'Transaction';
      var desc = w.description || '';
      var iconColor = isCredit ? 'whi-g' : 'whi-r';
      var amtColor = isCredit ? 'wha-g' : 'wha-r';
      h += '<div class="wh-card"><div class="wh-icon ' + iconColor + '"><i class="fas fa-' + (isCredit ? 'coins' : 'gamepad') + '"></i></div>';
      h += '<div class="wh-info"><div class="wh-name">' + label + '</div>';
      h += '<div class="wh-time">' + timeAgo(w.timestamp) + '</div>';
      if (desc && desc !== label) h += '<div class="wh-utr">' + desc + '</div>';
      h += '</div><div class="wh-amt ' + amtColor + '">' + (isCredit ? '+' : '') + '💎' + Math.abs(amt2) + '</div></div>';
    }
  });
  wh.innerHTML = h;
}

function startAdd() {
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  history.pushState(null, null, null); wfStep = 1; wfAmt = 0; wfScreenshot = ''; showWFStep();
}
function startWd() {
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  // ✅ LEGAL: KYC gate for > ₹500
  var _rm0 = (window.UD && window.UD.realMoney) || {};
  var _wdable = (Number(_rm0.deposited)||0) + (Number(_rm0.winnings)||0);
  if (window.mesKYCGate && !window.mesKYCGate(_wdable, null)) return;
  history.pushState(null, null, null);
  var rm = UD.realMoney || {};
  var win = Number(rm.winnings)||0, dep = Number(rm.deposited)||0, bon = Number(rm.bonus)||0;
  var totalBal = win + dep + bon;
  var h = '<div style="background:rgba(0,255,106,.06);border:1px solid rgba(0,255,106,.15);border-radius:12px;padding:12px;margin-bottom:14px">';
  h += '<div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:8px">💰 Your Balance Breakdown</div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--txt2)">🏆 Winnings</span><span style="color:var(--green);font-weight:700">💎' + win + '</span></div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--txt2)">💳 Deposited</span><span style="font-weight:700">💎' + dep + '</span></div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px"><span style="color:var(--txt2)">🎁 Bonus</span><span style="color:#ffd700;font-weight:700">₹' + bon + ' (non-withdrawable)</span></div>';
  h += '<div style="border-top:1px solid var(--border);padding-top:8px;display:flex;justify-content:space-between;font-size:13px;font-weight:800"><span>Withdrawable</span><span style="color:var(--green)">₹' + (win+dep) + '</span></div></div>';
  h += '<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.15);border-radius:10px;padding:10px;margin-bottom:14px;font-size:12px;color:var(--txt2)"><i class="fas fa-info-circle" style="color:var(--blue)"></i> <strong>No hidden charges.</strong> You get exactly what you request. Bonus coins cannot be withdrawn, only used for entry fees.</div>';
  h += '<div class="f-group"><label>Amount (₹)</label><input type="number" class="f-input" id="wdAmt" placeholder="Enter amount" min="1" max="' + (win+dep) + '"></div>';
  h += '<div class="f-group"><label>Your UPI ID</label><input type="text" class="f-input" id="wdUpi" placeholder="yourname@upi"></div>';
  h += '<button class="f-btn fb-green" onclick="submitWd()">Request Withdrawal</button>';
  openModal('Withdraw', h);
}
function submitWd() {
  var amt = Number($('wdAmt').value), upi = ($('wdUpi').value || '').trim();
  var rm = UD.realMoney || {};
  var withdrawable = (Number(rm.deposited)||0) + (Number(rm.winnings)||0);
  if (!amt || amt < 1) { toast('Amount enter karo', 'err'); return; }
  if (!upi || !upi.includes('@')) { toast('Enter valid UPI ID', 'err'); return; }
  if (amt > withdrawable) { toast('Insufficient balance', 'err'); return; }
  // ✅ LEGAL: TDS disclosure — once per session
  if (window.mesTDSDisclosure && !sessionStorage.getItem('_mes_tds_shown')) {
    sessionStorage.setItem('_mes_tds_shown', '1');
    mesTDSDisclosure(amt, function() { submitWd(); });
    return;
  }

  // ✅ Admin-set limits enforce karo
  db.ref('appSettings/withdrawal').once('value', function(cfgSnap) {
    var cfg = cfgSnap.val() || { minAmount: 50, maxAmount: 5000, dailyLimit: 10000 };
    var minAmt = Number(cfg.minAmount) || 50;
    var maxAmt = Number(cfg.maxAmount) || 5000;
    var dailyLim = Number(cfg.dailyLimit) || 10000;

    if (amt < minAmt) { toast('Minimum withdrawal ₹' + minAmt + ' hai', 'err'); return; }
    if (amt > maxAmt) { toast('Maximum withdrawal per request ₹' + maxAmt + ' hai', 'err'); return; }

    // Daily limit check — aaj ke approved withdrawals sum karo
    var today = new Date(); today.setHours(0,0,0,0);
    var todayTs = today.getTime();
    db.ref('walletRequests').orderByChild('uid').equalTo(U.uid).once('value', function(wSnap) {
      var todayWd = 0;
      if (wSnap.exists()) {
        wSnap.forEach(function(c) {
          var w = c.val();
          if (w.type === 'withdraw' && w.status !== 'rejected' && (w.createdAt||0) >= todayTs) {
            todayWd += Number(w.amount) || 0;
          }
        });
      }
      if (todayWd + amt > dailyLim) {
        var remaining = Math.max(0, dailyLim - todayWd);
        toast('Daily limit ₹' + dailyLim + '! Aaj ₹' + todayWd + ' already withdraw kiya. Remaining: ₹' + remaining, 'err');
        return;
      }

      // Sab checks pass — submit karo
      // ===== TDS SYSTEM: Smart threshold-based =====
      // Testing phase: TDS deduction disabled
      // Records maintain ho rahe hain future ke liye
      // Jab limits cross honge → admin alert + user notice auto milega
      db.ref('appSettings/tdsConfig').once('value', function(cfgSnap) {
        var tdsConfig = cfgSnap.val() || {};
        var tdsActive = tdsConfig.active === true; // default: false (testing phase)

        db.ref('users/' + U.uid + '/tds').once('value', function(tdsSnap) {
          var tdsData = tdsSnap.val() || {};
          var totalWinnings = Number(tdsData.winningsCredited) || 0;
          var totalFees     = Number(tdsData.entryFeesPaid) || 0;
          var netWinnings   = Math.max(0, totalWinnings - totalFees);
          var tdsNow = 0;
          var userReceives = amt;

          // TDS sirf tab deduct karo jab admin ne activate kiya ho
          if (tdsActive) {
            var alreadyDeducted = Number(tdsData.tdsDeducted) || 0;
            var totalTdsOwed = Math.round(netWinnings * 0.30);
            tdsNow = Math.min(Math.max(0, totalTdsOwed - alreadyDeducted), amt);
            userReceives = amt - tdsNow;
          }

          var id = db.ref('walletRequests').push().key;
          var fy = (function(){ var d=new Date(); return d.getMonth()<3?(d.getFullYear()-1)+'-'+d.getFullYear():d.getFullYear()+'-'+(d.getFullYear()+1); })();
          var data = {
            requestId: id, uid: U.uid,
            userName: UD.ign || UD.displayName || '',
            displayName: UD.displayName || '',
            userEmail: UD.email || '',
            amount: amt,
            amountAfterTDS: userReceives,
            tdsDeducted: tdsNow,
            tdsActive: tdsActive,
            upiId: upi, status: 'pending', type: 'withdraw',
            netWinningsAtTime: netWinnings,
            financialYear: fy,
            createdAt: firebase.database.ServerValue.TIMESTAMP
          };
          db.ref('walletRequests/' + id).set(data);
          db.ref('paymentRequests/' + id).set(data);

          // Wallet se amount deduct karo
          var _rm = UD.realMoney || {};
          var _win = Number(_rm.winnings)||0, _dep = Number(_rm.deposited)||0;
          var _remaining = amt;
          var _wdWin = Math.min(_win, _remaining); _remaining -= _wdWin;
          var _wdDep = Math.min(_dep, _remaining);
          if (_wdWin > 0) db.ref('users/' + U.uid + '/realMoney/winnings').transaction(function(w) { return Math.max((w||0) - _wdWin, 0); });
          if (_wdDep > 0) db.ref('users/' + U.uid + '/realMoney/deposited').transaction(function(w) { return Math.max((w||0) - _wdDep, 0); });

          // Payout log maintain karo (hamesha — testing phase mein bhi)
          db.ref('payoutLogs').push({
            uid: U.uid, ign: UD.ign || UD.displayName || '',
            amount: amt, netWinnings: netWinnings,
            tdsActive: tdsActive, tdsDeducted: tdsNow,
            upiId: upi, financialYear: fy, timestamp: Date.now()
          });

          // Agar TDS active hai to deduction record karo
          if (tdsActive && tdsNow > 0) {
            db.ref('users/' + U.uid + '/tds/tdsDeducted').transaction(function(v) { return (v||0) + tdsNow; });
            db.ref('tdsRecords').push({
              uid: U.uid, ign: UD.ign||UD.displayName||'',
              pan: ((UD.kyc||{}).panFull)||'NOT_SUBMITTED',
              type: 'tds_deducted', withdrawalAmount: amt,
              tdsDeducted: tdsNow, amountPaid: userReceives,
              netWinnings: netWinnings, upiId: upi,
              walletRequestId: id, financialYear: fy, timestamp: Date.now()
            });
            db.ref('tdsHeld').push({
              uid: U.uid, ign: UD.ign||UD.displayName||'',
              amount: tdsNow, walletRequestId: id,
              depositedToGovt: false, financialYear: fy, timestamp: Date.now()
            });
          }

          // Threshold check — admin ko alert bhejo agar limits near hain
          if (window.mesCheckTDSThreshold) window.mesCheckTDSThreshold(amt, netWinnings);

          closeModal();
          if (tdsActive && tdsNow > 0) {
            toast('Request submitted! ₹' + userReceives + ' UPI pe aayega (₹' + tdsNow + ' TDS deducted)', 'ok');
          } else {
            toast('Withdrawal request submitted!', 'ok');
          }
        });
      });
    });
  });
}
function cancelWF() { $('walletFlow').style.display = 'none'; $('walletMain').style.display = ''; }

function showWFStep() {
  $('walletMain').style.display = 'none'; var wf = $('walletFlow'); wf.style.display = '';
  var prog = '<div class="w-progress"><div class="w-step-dot ' + (wfStep >= 1 ? 'active' : '') + '">1</div><div class="w-step-line ' + (wfStep >= 2 ? 'done' : '') + '"></div><div class="w-step-dot ' + (wfStep >= 2 ? 'active' : '') + '">2</div><div class="w-step-line ' + (wfStep >= 3 ? 'done' : '') + '"></div><div class="w-step-dot ' + (wfStep >= 3 ? 'active' : '') + '">3</div></div>';
  var h = prog;
  if (wfStep === 1) {
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px">Enter Amount</div>';
    h += '<div class="f-group"><label>Amount (₹) — Min ₹10</label><input type="number" class="f-input" id="addAmt" placeholder="Enter amount" min="10" value="' + (wfAmt || '') + '"></div>';
    h += '<div class="w-amt-grid"><div class="w-amt-btn" onclick="pickAmt(50)">₹50</div><div class="w-amt-btn" onclick="pickAmt(100)">₹100</div><div class="w-amt-btn" onclick="pickAmt(200)">₹200</div><div class="w-amt-btn" onclick="pickAmt(500)">₹500</div></div>';
    h += '<button class="f-btn fb-green" onclick="wfNext()">Continue</button>';
    h += '<button class="f-btn" style="background:var(--card2);color:var(--txt2);margin-top:8px" onclick="cancelWF()">Cancel</button>';
  } else if (wfStep === 2) {
    var upiId = PAY.upiId || 'merchant@upi', payeeName = PAY.payeeName || 'Mini eSports';
    var upiLink = 'upi://pay?pa=' + upiId + '&pn=' + encodeURIComponent(payeeName) + '&am=' + wfAmt + '&cu=INR&tn=Mini_eSports_Wallet';
    // UPI 2.0 deeplinks for specific apps
    var gpayLink = 'gpay://upi/pay?pa=' + upiId + '&pn=' + encodeURIComponent(payeeName) + '&am=' + wfAmt + '&cu=INR&tn=Mini_eSports';
    var phonepeLink = 'phonepe://pay?pa=' + upiId + '&pn=' + encodeURIComponent(payeeName) + '&am=' + wfAmt + '&cu=INR&tn=Mini_eSports';
    var paytmLink = 'paytmmp://pay?pa=' + upiId + '&pn=' + encodeURIComponent(payeeName) + '&am=' + wfAmt + '&cu=INR&tn=Mini_eSports';
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px">Pay ₹' + wfAmt + '</div>';
    h += '<div style="background:var(--card);border-radius:12px;padding:12px;margin-bottom:12px"><div style="font-size:11px;color:var(--txt2);margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Pay To</div><div style="font-size:15px;font-weight:800;display:flex;justify-content:space-between;align-items:center">' + upiId + '<button onclick="copyTxt(\'' + upiId + '\')" style="background:rgba(0,255,106,.1);border:none;color:var(--green);padding:5px 10px;border-radius:8px;cursor:pointer;font-size:12px"><i class="fas fa-copy"></i></button></div><div style="font-size:12px;color:var(--txt2);margin-top:2px">Amount: <strong style="color:var(--green)">₹' + wfAmt + '</strong></div></div>';
    h += '<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--txt2);margin-bottom:8px;font-weight:700">⚡ UPI INSTANT — App Choose Karo:</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
    h += '<a href="' + gpayLink + '" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;background:rgba(66,133,244,.12);border:1.5px solid rgba(66,133,244,.3);color:#4285f4;font-weight:800;font-size:13px;text-decoration:none"><img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" style="height:18px;filter:brightness(2)" onerror="this.style.display=\'none\'"> Google Pay</a>';
    h += '<a href="' + phonepeLink + '" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;background:rgba(99,36,242,.12);border:1.5px solid rgba(99,36,242,.3);color:#6324f2;font-weight:800;font-size:13px;text-decoration:none">💜 PhonePe</a>';
    h += '<a href="' + paytmLink + '" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;background:rgba(0,149,215,.12);border:1.5px solid rgba(0,149,215,.3);color:#0095d7;font-weight:800;font-size:13px;text-decoration:none">🔵 Paytm</a>';
    h += '<a href="' + upiLink + '" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;background:rgba(0,255,106,.08);border:1.5px solid rgba(0,255,106,.25);color:var(--green);font-weight:800;font-size:13px;text-decoration:none"><i class="fas fa-university"></i> Any UPI App</a>';
    h += '</div></div>';
    h += '<div class="f-warn"><i class="fas fa-info-circle"></i> App open hone ke baad payment karo, phir "I Have Paid" tap karo.</div>';
    h += '<button class="f-btn fb-green" style="margin-top:12px" onclick="wfNext()">✅ I Have Paid →</button>';
    h += '<button class="f-btn" style="background:var(--card2);color:var(--txt2);margin-top:8px" onclick="cancelWF()">Cancel</button>';
  } else if (wfStep === 3) {
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px">Enter Transaction Details</div>';
    h += '<div class="f-group"><label>UTR Number (Mandatory)</label><input type="text" class="f-input" id="addUtr" placeholder="Enter UTR from your UPI app"><div style="font-size:11px;color:var(--txt2);margin-top:4px">Find UTR in your UPI app payment history</div></div>';
    h += '<div class="f-group"><label>Payment Screenshot</label><div class="upload-area" onclick="$(\'ssInput\').click()"><i class="fas fa-cloud-upload-alt" style="display:block;font-size:28px;color:var(--txt2);margin-bottom:8px"></i><p>Tap to upload screenshot</p><input type="file" id="ssInput" accept="image/*" style="display:none" onchange="handleSS(this)"></div><img id="ssPreview" class="upload-preview" style="display:none"></div>';
    h += '<button class="f-btn fb-green" onclick="submitAddMoney()">Submit for Verification</button>';
    h += '<button class="f-btn" style="background:var(--card2);color:var(--txt2);margin-top:8px" onclick="cancelWF()">Cancel</button>';
  }
  wf.innerHTML = h;
}
function pickAmt(v) { var inp = $('addAmt'); if (inp) inp.value = v; wfAmt = v; }
function wfNext() { if (wfStep === 1) { var a = Number(($('addAmt') || {}).value); if (!a || a < 10) { toast('Minimum ₹10', 'err'); return; } wfAmt = a; } wfStep++; showWFStep(); }
function handleSS(inp) {
  if (!inp.files || !inp.files[0]) return;
  compImg(inp.files[0], 800, 0.7, 150, function(b64) { wfScreenshot = b64; var prev = $('ssPreview'); if (prev) { prev.src = b64; prev.style.display = 'block'; } });
}
function compImg(file, maxDim, quality, maxKB, cb) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) { if (w > h) { h = h * (maxDim / w); w = maxDim; } else { w = w * (maxDim / h); h = maxDim; } }
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
      var q = quality, result = c.toDataURL('image/jpeg', q);
      while (result.length > maxKB * 1370 && q > 0.1) { q -= 0.1; result = c.toDataURL('image/jpeg', q); }
      cb(result);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
var _addMoneySubmitting = false;
function submitAddMoney() {
  if (_addMoneySubmitting) return; // Prevent double tap
  if (!wfScreenshot || wfScreenshot.length < 100) { toast("Payment screenshot upload karo — mandatory hai!", "err"); return; }
  var utr = ($('addUtr') || {}).value;
  if (!utr || utr.trim().length < 6) { toast('Enter valid UTR (min 6 chars)', 'err'); return; }
  utr = utr.trim();
  _addMoneySubmitting = true;
  var btn = document.querySelector('.fb-green');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  db.ref('walletRequests').orderByChild('utr').equalTo(utr).once('value', function(s) {
    if (s.exists()) {
      toast('This UTR has already been submitted!', 'err');
      _addMoneySubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
      return;
    }
    var id = db.ref('walletRequests').push().key;
    var data = { requestId: id, uid: U.uid, userName: UD.ign || UD.displayName || '', displayName: UD.displayName || '', userEmail: UD.email || '', amount: wfAmt, transactionId: utr, utr: utr, screenshotBase64: wfScreenshot || '', status: 'pending', type: 'deposit', createdAt: firebase.database.ServerValue.TIMESTAMP };
    db.ref('walletRequests/' + id).set(data);
    db.ref('paymentRequests/' + id).set(data);
    _addMoneySubmitting = false;
    cancelWF(); toast('Payment submitted for verification! ✅', 'ok');
  }, function() {
    _addMoneySubmitting = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
    toast('Network error. Try again.', 'err');
  });
}
/* ====== LOOT CRATE ANIMATION ====== */
function showLootCrate(prize) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.85);backdrop-filter:blur(4px)';
  overlay.innerHTML = '<div id="_lootBox" style="text-align:center;animation:lootDrop .6s cubic-bezier(.175,.885,.32,1.275)">' +
    '<div style="font-size:80px;margin-bottom:8px;filter:drop-shadow(0 0 30px #ffd700)">📦</div>' +
    '<div style="font-size:16px;color:#ffd700;font-weight:800;margin-bottom:4px">PRIZE BOX DROPPED!</div>' +
    '<div id="_lootOpen" style="font-size:48px;cursor:pointer;animation:spin .3s ease" onclick="this.parentElement.parentElement._burst()">🎁</div>' +
    '<div style="font-size:13px;color:var(--txt2);margin-top:8px">Tap to open!</div>' +
  '</div>';
  // Add burst animation
  var style = document.createElement('style');
  style.textContent = '@keyframes lootDrop{from{transform:translateY(-200px) scale(.3);opacity:0}to{transform:none;opacity:1}}@keyframes spin{from{transform:rotate(-20deg)}to{transform:rotate(20deg)}}@keyframes confettiFall{from{transform:translateY(-20px) rotate(0);opacity:1}to{transform:translateY(100vh) rotate(720deg);opacity:0}}';
  document.head.appendChild(style);
  overlay._burst = function() {
    var box = document.getElementById('_lootBox');
    if (box) {
      // Burst with coins
      var coins = ['💰','💵','🪙','💸','⭐','✨'];
      for (var i = 0; i < 20; i++) {
        var c = document.createElement('div');
        c.textContent = coins[Math.floor(Math.random()*coins.length)];
        c.style.cssText = 'position:fixed;font-size:24px;left:'+(Math.random()*100)+'vw;top:30vh;animation:confettiFall '+(1+Math.random())+'s ease forwards;z-index:100000;animation-delay:'+(Math.random()*.5)+'s';
        document.body.appendChild(c);
        setTimeout(function(el){el.remove();}, 2000, c);
      }
      box.innerHTML = '<div style="font-size:60px;margin-bottom:8px;filter:drop-shadow(0 0 40px #00ff6a)">💰</div>' +
        '<div style="font-size:20px;color:#00ff6a;font-weight:900">💎' + (prize||'?') + ' WON!</div>' +
        '<div style="font-size:13px;color:var(--txt2);margin-top:6px">Added to your wallet!</div>' +
        '<button onclick="this.closest(\'[style*=fixed]\').remove()" style="margin-top:16px;padding:10px 24px;background:var(--green);color:#000;border:none;border-radius:20px;font-weight:800;font-size:14px;cursor:pointer">🎉 Awesome!</button>';
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    }
  };
  document.body.appendChild(overlay);
  // Auto remove after 8s
  setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 8000);
}
function watchAd() {
  if (window.Android && window.Android.showRewardedAd) window.Android.showRewardedAd();
  else toast('Ads available only in APK version', 'inf');
}
window.onAdReward = function() { db.ref('users/' + U.uid + '/coins').transaction(function(c) { return (c || 0) + 5; }); toast('+5 Coins earned! 🪙', 'ok'); };

/* ====== AD-BASED MATCH JOIN SYSTEM ====== */
// Track ad watches per match per session
window._adWatchCount = {};
window._adMatchPending = null;

// Show ad-watch popup before joining an ad-match
function showAdJoinPopup(matchId) {
  var t = MT[matchId]; if (!t) return;
  var adsRequired = Number(t.adsRequired) || 2;
  var watched = window._adWatchCount[matchId] || 0;
  var remaining = adsRequired - watched;

  var h = '<div style="text-align:center;padding:8px 0 4px">';
  h += '<div style="font-size:36px;margin-bottom:6px">📺</div>';
  h += '<div style="font-size:17px;font-weight:800;color:var(--green);margin-bottom:4px">FREE Match — Ads Dekho, Match Khelo!</div>';
  h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:16px">Yeh match bilkul free hai. Sirf <b style="color:#fff">' + adsRequired + ' short ads</b> dekhne ke baad join kar sakte ho.</div>';

  // Progress dots
  h += '<div style="display:flex;justify-content:center;gap:10px;margin-bottom:18px">';
  for (var i = 0; i < adsRequired; i++) {
    var done = i < watched;
    h += '<div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;';
    h += done ? 'background:rgba(0,255,106,.2);border:2px solid #00ff6a;color:#00ff6a' : 'background:rgba(255,255,255,.06);border:2px dashed rgba(255,255,255,.2);color:#555';
    h += '">' + (done ? '✓' : (i + 1)) + '</div>';
  }
  h += '</div>';

  if (remaining > 0) {
    h += '<div style="font-size:12px;color:#aaa;margin-bottom:14px">Abhi <b style="color:#fff">' + remaining + ' ad' + (remaining > 1 ? 's' : '') + '</b> aur dekhni hai</div>';
    h += '<button onclick="watchAdForMatch(\'' + matchId + '\')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;font-size:15px;border:none;cursor:pointer;letter-spacing:.5px">▶ Ad Dekho (' + watched + '/' + adsRequired + ')</button>';
  } else {
    h += '<div style="font-size:13px;color:#00ff9c;font-weight:700;margin-bottom:14px">✅ Sabhi ads dekh li! Ab join kar sakte ho.</div>';
    h += '<button onclick="confirmAdMatchJoin(\'' + matchId + '\')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;font-size:15px;border:none;cursor:pointer">🎮 Match Join Karo!</button>';
  }
  h += '</div>';
  showModal('🎯 ' + (t.name || 'Match'), h);
}

// Simulate/trigger ad watch for match
function watchAdForMatch(matchId) {
  window._adMatchPending = matchId;
  var t = MT[matchId];
  var adsRequired = Number(t && t.adsRequired) || 2;

  // Try real Android rewarded ad
  if (window.Android && window.Android.showRewardedAd) {
    window.Android.showRewardedAd();
    return;
  }

  // Web fallback: simulate ad with countdown overlay
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff';
  overlay.id = 'adOverlay_' + matchId;

  var adBrands = ['🎮 Gaming Pro', '📱 App Store', '🛒 Shop Now', '🏆 Win Big'];
  var brand = adBrands[Math.floor(Math.random() * adBrands.length)];

  var sec = 5;
  overlay.innerHTML = '<div style="font-size:14px;color:#aaa;margin-bottom:8px">Advertisement</div>' +
    '<div style="font-size:28px;font-weight:900;margin-bottom:12px">' + brand + '</div>' +
    '<div style="font-size:13px;color:#aaa;margin-bottom:24px">Sponsored Content</div>' +
    '<div style="width:80px;height:80px;border-radius:50%;background:rgba(0,255,106,.1);border:3px solid #00ff9c;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#00ff9c" id="adTimer">' + sec + '</div>' +
    '<div style="font-size:11px;color:#555;margin-top:12px">Ad band nahi kar sakte</div>';
  document.body.appendChild(overlay);

  var iv = setInterval(function() {
    sec--;
    var el = document.getElementById('adTimer');
    if (el) el.textContent = sec;
    if (sec <= 0) {
      clearInterval(iv);
      overlay.remove();
      onAdRewardForMatch(matchId);
    }
  }, 1000);
}

// Called when ad is completed (real or simulated)
function onAdRewardForMatch(matchId) {
  if (!matchId) matchId = window._adMatchPending;
  if (!matchId) return;
  if (!window._adWatchCount[matchId]) window._adWatchCount[matchId] = 0;
  window._adWatchCount[matchId]++;
  var t = MT[matchId];
  var adsRequired = Number(t && t.adsRequired) || 2;
  var watched = window._adWatchCount[matchId];
  toast('Ad ' + watched + '/' + adsRequired + ' complete! 🎉', 'ok');
  // Reopen popup to show updated progress
  setTimeout(function() { showAdJoinPopup(matchId); }, 400);
}

// Override Android reward callback to handle ad-match case
window.onAdReward = function() {
  if (window._adMatchPending) {
    onAdRewardForMatch(window._adMatchPending);
    window._adMatchPending = null;
  } else {
    db.ref('users/' + U.uid + '/coins').transaction(function(c) { return (c || 0) + 5; });
    toast('+5 Coins earned! 🪙', 'ok');
  }
};

// Actually join the match after all ads watched
function confirmAdMatchJoin(matchId) {
  closeModal();
  var t = MT[matchId]; if (!t) return;
  var tp = (t.mode || t.type || 'solo').toLowerCase();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';
  // Record the join in Firebase (no fee deduction, just join)
  var jid = db.ref('joinRequests').push().key;
  var jData = {
    matchId: matchId, matchName: t.name || 'Match',
    userId: U.uid, userName: UD.displayName || UD.ign || 'Player',
    ffUid: UD.ffUid || '', ign: UD.ign || '',
    entryType: 'ad', entryFee: 0, adWatched: true,
    joinedAt: Date.now(), mode: tp, status: 'confirmed'
  };
  db.ref('joinRequests/' + jid).set(jData).then(function() {
    db.ref('matches/' + matchId + '/joinedSlots').transaction(function(s) { return (s || 0) + 1; });
    // Track in user's joinedMatches
    db.ref('users/' + U.uid + '/joinedMatches/' + matchId).set({ joinedAt: Date.now(), entryType: 'ad' });
    toast('🎮 Match Joined! Room ID milne par notification aayega.', 'ok');
    window._adWatchCount[matchId] = 0; // reset
    navTo('matches');
  }).catch(function() { toast('Join failed, retry karo', 'err'); });
}

/* ====== RANK ====== */
function calcRk(stats) {
  var wins    = Number(stats.wins    || 0);
  var kills   = Number(stats.kills   || 0);
  var matches = Number(stats.matches || 0);
  var earnings= Number(stats.earnings|| 0);
  // Win Ratio & Kill Ratio (min 1 match played to avoid division by zero)
  var winRatio  = matches > 0 ? wins / matches : 0;       // 0-1
  var killRatio = matches > 0 ? kills / matches : 0;      // kills per match

  // Base score: absolute stats
  var baseScore = (wins * 100) + (kills * 10) + earnings;

  // Ratio bonus: rewards consistent players
  var ratioBonus = 0;
  if (matches >= 5) {
    ratioBonus += winRatio  * 2000;   // 100% win rate = +2000
    ratioBonus += Math.min(killRatio * 300, 1500); // capped at 1500
  }

  var s = baseScore + ratioBonus;

  if (s >= 10000) return { badge: 'Diamond',  emoji: '💎', color: '#b964ff', bg: 'rgba(185,100,255,.12)' };
  if (s >= 5000)  return { badge: 'Platinum', emoji: '🔷', color: '#00d4ff', bg: 'rgba(0,212,255,.12)'   };
  if (s >= 2000)  return { badge: 'Gold',     emoji: '🥇', color: '#ffd700', bg: 'rgba(255,215,0,.12)'   };
  if (s >= 500)   return { badge: 'Silver',   emoji: '🥈', color: '#c0c0c0', bg: 'rgba(192,192,192,.12)' };
  return { badge: 'Bronze', emoji: '🥉', color: '#cd7f32', bg: 'rgba(205,127,50,.12)' };
}
// Expose rank score for leaderboard sorting
function calcRkScore(stats) {
  var wins=Number(stats.wins||0),kills=Number(stats.kills||0),matches=Number(stats.matches||0),earnings=Number(stats.earnings||0);
  var winRatio=matches>0?wins/matches:0, killRatio=matches>0?kills/matches:0;
  var base=(wins*100)+(kills*10)+earnings;
  var bonus=matches>=5?(winRatio*2000)+Math.min(killRatio*300,1500):0;
  return base+bonus;
}
function getPlayerBadges(st, lv) {
  var badges = [];
  var w = st.wins||0, k = st.kills||0, m = st.matches||0, e = st.earnings||0;
  if (m >= 1)   badges.push({ icon:'🎮', name:'First Blood',   desc:'Played first match',      color:'#00ff6a', bg:'rgba(0,255,106,.1)' });
  if (m >= 10)  badges.push({ icon:'⚔️', name:'Veteran',       desc:'10+ matches played',       color:'#00d4ff', bg:'rgba(0,212,255,.1)' });
  if (w >= 1)   badges.push({ icon:'🏆', name:'Champion',      desc:'Won a match',              color:'#ffd700', bg:'rgba(255,215,0,.1)' });
  if (w >= 5)   badges.push({ icon:'👑', name:'Dominator',     desc:'5+ wins',                  color:'#b964ff', bg:'rgba(185,100,255,.1)' });
  if (k >= 50)  badges.push({ icon:'💀', name:'Kill Machine',  desc:'50+ kills total',          color:'#ff2e2e', bg:'rgba(255,46,46,.1)' });
  if (k >= 100) badges.push({ icon:'☠️', name:'Headhunter',    desc:'100+ kills total',         color:'#ff6b6b', bg:'rgba(255,107,107,.1)' });
  if (e >= 100) badges.push({ icon:'💰', name:'Money Maker',   desc:'Earned 💎100+',             color:'#00ff6a', bg:'rgba(0,255,106,.1)' });
  if (e >= 500) badges.push({ icon:'💎', name:'High Roller',   desc:'Earned 💎500+',             color:'#b964ff', bg:'rgba(185,100,255,.1)' });
  if (lv >= 10) badges.push({ icon:'🔥', name:'Pro Player',    desc:'Level 10+',                color:'#ff8c00', bg:'rgba(255,140,0,.1)' });
  if (lv >= 20) badges.push({ icon:'⚡', name:'Legend',        desc:'Level 20+',                color:'#ffd700', bg:'rgba(255,215,0,.1)' });
  return badges;
}
var _rankTab = 'earnings'; // earnings | kills | season | city

function renderRank(tab) {
  if (tab) _rankTab = tab;
  var rc = $('rankContent'); if (!rc) return;

  // Season info banner
  var season = window.getCurrentSeason ? window.getCurrentSeason() : { name: 'Season', daysLeft: 0, label: '' };

  var tabBar = '<div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px">' +
    ['earnings','kills','season','city'].map(function(t) {
      var labels = { earnings: '💎 Earnings', kills: '☠ Kills', season: '🏆 ' + season.name, city: '📍 Location' };
      var active = t === _rankTab;
      return '<div onclick="renderRank(\'' + t + '\')" style="padding:7px 14px;border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap;' +
        (active ? 'background:rgba(0,255,156,.15);color:var(--green,#00ff9c);border:1px solid rgba(0,255,156,.3)' :
                  'background:var(--card2,#1a1a2e);color:var(--txt2);border:1px solid var(--border)') +
        '">' + labels[t] + '</div>';
    }).join('') +
    '</div>';

  var seasonBanner = '<div style="display:flex;justify-content:space-between;align-items:center;' +
    'background:linear-gradient(135deg,rgba(0,255,156,.08),rgba(0,238,255,.05));' +
    'border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:10px 14px;margin-bottom:12px">' +
    '<div><div style="font-size:11px;font-weight:700;color:var(--green,#00ff9c)">' + season.name + '</div>' +
    '<div style="font-size:10px;color:var(--txt2)">' + season.label + '</div></div>' +
    '<div style="text-align:right"><div style="font-size:11px;font-weight:700;color:var(--text)">' + season.daysLeft + ' days left</div>' +
    '<div style="font-size:10px;color:var(--txt2)">Season resets monthly</div></div>' +
    '</div>';

  rc.innerHTML = tabBar + seasonBanner + '<div style="text-align:center;padding:30px"><div class="sp-spinner"></div></div>';

  if (_rankTab === 'season' && window.loadSeasonLeaderboard) {
    window.loadSeasonLeaderboard(function(users, s) {
      _renderRankList(rc, users, 'earnings', tabBar, seasonBanner, true);
    });
  } else if (_rankTab === 'city') {
    // Location leaderboard with set location option
    db.ref('users').limitToLast(200).once('value', function(snap) {
      var rc2 = $('rankContent'); if (!rc2) return;
      var locMap = {};
      if (snap.exists()) snap.forEach(function(c) {
        var u = c.val(); if (!u || (!u.ign && !u.displayName)) return;
        var loc = (u.city || u.state || '').trim();
        if (!loc) return; /* skip users without location */
        if (!locMap[loc]) locMap[loc] = { loc: loc, players: 0, totalEarnings: 0, topPlayer: null, topEarnings: 0 };
        locMap[loc].players++;
        var earn = Number((u.stats||{}).earnings||0) + Number((u.realMoney||{}).winnings||0);
        locMap[loc].totalEarnings += earn;
        if (earn > locMap[loc].topEarnings) { locMap[loc].topEarnings = earn; locMap[loc].topPlayer = u.ign||u.displayName||'Player'; }
      });
      var locs = Object.values(locMap).sort(function(a,b){ return b.totalEarnings - a.totalEarnings; });
      var h = tabBar;
      /* Show set location button if user hasn't set it */
      if (!window.UD || !(window.UD.city || window.UD.state)) {
        h += '<div style="background:rgba(255,170,0,.08);border:1px solid rgba(255,170,0,.2);border-radius:12px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:12px">';
        h += '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:#ffaa00">📍 Set Your Location</div><div style="font-size:11px;color:#888;margin-top:2px">Location set karo aur apne city/state ki ranking dekho!</div></div>';
        h += '<button onclick="window._showSetLocation&&_showSetLocation()" style="padding:8px 14px;border-radius:10px;background:rgba(255,170,0,.15);border:1px solid rgba(255,170,0,.3);color:#ffaa00;font-weight:800;font-size:12px;cursor:pointer">Set</button>';
        h += '</div>';
      }
      h += '<div style="font-size:12px;color:#888;margin-bottom:12px">📍 Locations ranked by total earnings</div>';
      if (locs.length === 0) {
        h += '<div style="text-align:center;padding:40px;color:#666"><div style="font-size:40px;margin-bottom:8px">📍</div><div>No location data yet</div><div style="font-size:12px;margin-top:6px">Profile mein location set karo!</div></div>';
      } else {
        locs.forEach(function(c, i) {
          var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
          var isUser = window.UD && (window.UD.city||window.UD.state||'') === c.loc;
          h += '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;margin-bottom:8px;background:' + (isUser?'rgba(0,255,106,.07)':'rgba(255,255,255,.03)') + ';border:1px solid ' + (isUser?'rgba(0,255,106,.2)':'rgba(255,255,255,.06)') + '">';
          h += '<div style="width:36px;text-align:center;font-size:16px;font-weight:800">' + medal + '</div>';
          h += '<div style="flex:1"><div style="font-size:14px;font-weight:700">' + c.loc + '</div><div style="font-size:11px;color:#666">Top: ' + c.topPlayer + ' · ' + c.players + ' players</div></div>';
          h += '<div style="text-align:right"><div style="font-size:13px;font-weight:800;color:#00ff9c">💎' + c.totalEarnings + '</div><div style="font-size:10px;color:#666">Earned</div></div>';
          h += '</div>';
        });
      }
      rc2.innerHTML = h;
    });
  } else {
    db.ref('users').limitToLast(200).once('value', function(snap) {
      var users = [];
      if (snap.exists()) snap.forEach(function(c) {
        var u = c.val();
        if (u && (u.ign || u.displayName)) users.push(Object.assign({ _uid: c.key }, u));
      });
      var sortKey = _rankTab === 'kills' ? 'kills' : 'score';
      users.sort(function(a, b) {
        var getScore = function(u) {
          if (_rankTab === 'kills') return (u.stats||{}).kills || 0;
          // Use ratio-based rank score (same as calcRk)
          var st = u.stats || {};
          return calcRkScore(st);
        };
        return getScore(b) - getScore(a);
      });
      _renderRankList(rc, users, sortKey, tabBar, seasonBanner, false);
    });
  }
}

function _renderRankList(rc, users, sortKey, tabBar, seasonBanner, isSeason) {
  var h = tabBar + seasonBanner;
  var podCount = Math.min(users.length, 3);
  if (podCount >= 1) {
    var podOrder = podCount === 1 ? [users[0]] : podCount === 2 ? [users[1], users[0]] : [users[1], users[0], users[2]];
    var podClasses = ['p2','p1','p3'].slice(3 - podCount);
    if (podCount === 1) podClasses = ['p1'];
    else if (podCount === 2) podClasses = ['p2','p1'];
    var podMedals = podCount === 1 ? ['👑'] : podCount === 2 ? ['🥈','👑'] : ['🥈','👑','🥉'];
    var podNums = podCount === 1 ? ['1'] : podCount === 2 ? ['2','1'] : ['2','1','3'];
    h += '<div class="rank-podium">';
    for (var i = 0; i < podCount; i++) {
      var u = podOrder[i];
      var av = u.profileImage ? '<img src="' + u.profileImage + '">' : (u.ign || u.displayName || '?').charAt(0).toUpperCase();
      // Earnings: check stats.earnings, then realMoney.winnings, then totalWinnings as fallback
      var val;
      if (isSeason) {
        val = u.earnings || (u.stats||{}).earnings || 0;
      } else if (sortKey === 'earnings' || sortKey === 'score') {
        val = (u.stats||{}).earnings || Number((u.realMoney||{}).winnings) || u.totalWinnings || 0;
      } else {
        val = (u.stats||{})[sortKey] || 0;
      }
      var valLabel = sortKey === 'kills' ? val + ' kills' : '💎' + val;
      h += '<div class="pod-item ' + podClasses[i] + '">';
      if (podClasses[i] === 'p1') h += '<div class="pod-crown">👑</div>';
      h += '<div class="pod-ava">' + av + '</div>';
      h += '<div class="pod-medal">' + podMedals[i] + '</div>';
      h += '<div class="pod-name">' + (u.ign || u.displayName || 'Player') + '</div>';
      h += '<div class="pod-earn">' + valLabel + '</div>';
      h += '<div class="pod-pedestal">' + podNums[i] + '</div></div>';
    }
    h += '</div>';
  }
  for (var j = 3; j < users.length; j++) {
    var u = users[j];
    var rk = calcRk(u.stats || {});
    var av = u.profileImage ? '<img src="' + u.profileImage + '">' : (u.ign || u.displayName || '?').charAt(0).toUpperCase();
    var val;
    if (isSeason) {
      val = u.earnings || (u.stats||{}).earnings || 0;
    } else if (sortKey === 'earnings') {
      val = (u.stats||{}).earnings || Number((u.realMoney||{}).winnings) || u.totalWinnings || 0;
    } else {
      val = (u.stats||{})[sortKey] || 0;
    }
    var valStr = sortKey === 'kills' ? val + ' kills' : '💎' + val;
    var isMe = window.U && (u._uid === window.U.uid);
    h += '<div class="rank-row' + (isMe ? '" style="border:1px solid rgba(0,255,156,.3);background:rgba(0,255,156,.05)' : '') + '">';
    h += '<div class="rank-num">#' + (j + 1) + '</div>';
    h += '<div class="rank-ava">' + av + '</div>';
    h += '<div class="rank-info"><div class="rn">' + (u.ign || u.displayName || 'Player') + (isMe ? ' <span style="font-size:9px;color:var(--green)">YOU</span>' : '') + '</div>';
    var _st = u.stats || {};
    var _m = Number(_st.matches||0), _w = Number(_st.wins||0), _k = Number(_st.kills||0);
    var _wr = _m > 0 ? Math.round((_w/_m)*100) : 0;
    var _kd = _m > 0 ? (_k/_m).toFixed(1) : '0.0';
    h += '<div class="rs">K:' + _k + ' · W:' + _w + ' · <span style="color:#00ff9c">WR:' + _wr + '%</span> · <span style="color:#ff9f1c">K/M:' + _kd + '</span></div></div>';
    h += '<span class="rank-badge" style="background:' + rk.bg + ';color:' + rk.color + '">' + rk.emoji + ' ' + rk.badge + '</span>';
    h += '<div class="rank-earn">' + valStr + '</div></div>';
  }
  if (!users.length) h += '<div class="empty-state"><i class="fas fa-trophy"></i><p>No ranked players yet</p></div>';
  rc.innerHTML = h;

  // Inject chat below leaderboard
  if (window.f22PlayerChat !== undefined) {
    setTimeout(function() {
      if (window.injectLobbyChat) window.injectLobbyChat = window.injectLobbyChat;
      var lobbyChatWrap = document.getElementById('lobbyChatWrap');
      if (!lobbyChatWrap && rc) {
        var div = document.createElement('div');
        div.id = 'lobbyChatWrap';
        div.style.cssText = 'margin-top:16px';
        rc.appendChild(div);
      }
    }, 100);
  }
}

/* ====== PROFILE ====== */
function renderProfile() {
  var pc = $('profileContent'); if (!pc || !UD) return;
  var av = UD.profileImage ? '<img src="' + UD.profileImage + '">' : (UD.ign || UD.displayName || '?').charAt(0).toUpperCase();
  var st = UD.stats || {}, rk = calcRk(st);
  var lv = 1 + Math.floor((st.matches||0)/3) + Math.floor((st.wins||0)*2) + Math.floor((st.kills||0)/10) + Math.floor((st.earnings||0)/50);
  var xp = ((st.matches||0)%3)*3 + ((st.kills||0)%10);
  var maxXp = 10, xpPct = Math.min(Math.round((xp/maxXp)*100), 100);

  // Avatar ring color based on rank
  var ringColor = rk.color || 'var(--green)';
  var ringAnim = lv >= 10 ? 'animation:ringPulse 2s infinite' : '';

  /* Get display UID — show FF UID if available, otherwise show partial Firebase UID */
  var displayUid = UD.ffUid || U.uid.substring(0, 12);

  /* Stylish profile header - orange ring + neon frame like screenshots */
  var h = '<div class="prof-header" style="position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 0%,rgba(255,140,0,.07),transparent 65%);border-bottom:1px solid rgba(255,140,0,.1);padding-bottom:14px">';
  /* Settings icon */
  h += '<div onclick="showProfileSettings()" style="position:absolute;top:12px;right:14px;width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:5"><i class="fas fa-cog" style="font-size:15px;color:#888"></i></div>';
  h += '<div class="prof-ava-wrap"><div class="prof-ava" style="border:3px solid #ff8c00;box-shadow:0 0 18px rgba(255,140,0,.45),0 0 36px rgba(255,140,0,.18);' + ringAnim + '">' + av + '</div><div class="prof-edit-btn" onclick="$(\'profImgIn\').click()"><i class="fas fa-pencil-alt"></i></div><input type="file" id="profImgIn" accept="image/*" style="display:none" onchange="uploadProfImg(this)"></div>';
  h += '<div class="prof-name" style="text-align:center;width:100%;font-size:22px;font-weight:900">' + (UD.ign || UD.displayName || 'Player') + '</div>';
  h += '<div style="font-size:12px;color:#555;margin-top:3px;font-weight:600;text-align:center;letter-spacing:.5px">UID: ' + displayUid + '</div>';
  h += '</div>';
  var _pm = Number(st.matches||0), _pw = Number(st.wins||0), _pk = Number(st.kills||0);
  var _pwr = _pm > 0 ? Math.round((_pw/_pm)*100) : 0;
  var _pkd = _pm > 0 ? (_pk/_pm).toFixed(1) : '0.0';
  h += '<div class="prof-stats"><div class="ps-box psb"><div class="ps-val">' + _pm + '</div><div class="ps-lbl">Matches</div></div>';
  h += '<div class="ps-box psr"><div class="ps-val">' + _pk + '</div><div class="ps-lbl">Kills</div></div>';
  h += '<div class="ps-box psy"><div class="ps-val">💎' + (st.earnings || 0) + '</div><div class="ps-lbl">Earned</div></div></div>';
  h += '<div style="display:flex;gap:8px;margin:0 0 10px;padding:10px 12px;background:rgba(255,255,255,.03);border-radius:12px;border:1px solid rgba(255,255,255,.07)">';
  h += '<div style="flex:1;text-align:center"><div style="font-size:16px;font-weight:900;color:#00ff9c">' + _pwr + '%</div><div style="font-size:10px;color:#666;margin-top:2px">Win Rate</div></div>';
  h += '<div style="width:1px;background:rgba(255,255,255,.08)"></div>';
  h += '<div style="flex:1;text-align:center"><div style="font-size:16px;font-weight:900;color:#ff9f1c">' + _pkd + '</div><div style="font-size:10px;color:#666;margin-top:2px">K/Match</div></div>';
  h += '<div style="width:1px;background:rgba(255,255,255,.08)"></div>';
  h += '<div style="flex:1;text-align:center"><div style="font-size:16px;font-weight:900;color:' + rk.color + '">' + rk.emoji + ' ' + rk.badge + '</div><div style="font-size:10px;color:#666;margin-top:2px">Rank</div></div>';
  h += '</div>';
  h += '<div class="xp-bar-wrap"><div class="xp-bar-top"><span class="xp-level">Level ' + lv + ' — ' + rk.emoji + ' ' + rk.badge + '</span><span class="xp-text">' + xp + '/' + maxXp + ' XP</span></div>';
  h += '<div class="xp-track"><div class="xp-fill" style="width:' + xpPct + '%"></div></div></div>';

  // Collectible badges — full row button + pinned chips
  var badges = getPlayerBadges(st, lv);
  /* Get achievement levels from ui-fixes.js ACHIEVEMENTS_V2 */
  var unlocked = 0;
  if (window.ACHIEVEMENTS_V2) {
    window.ACHIEVEMENTS_V2.forEach(function(a) {
      var s2 = UD.stats || {}, lv2 = 0;
      a.levels.forEach(function(l) { if (l.check(s2, UD)) lv2 = l.level; });
      if (lv2 > 0) unlocked++;
    });
  } else {
    unlocked = badges.length;
  }
  /* Full-width Achievements button */
  h += '<button class="prof-btn" onclick="window.showAchievements&&showAchievements()" style="background:linear-gradient(135deg,rgba(255,215,0,.1),rgba(255,140,0,.06));border:1px solid rgba(255,215,0,.2);color:#ffd700;margin-bottom:6px">';
  h += '<span style="margin-right:auto"><i class="fas fa-medal" style="margin-right:8px"></i>Achievements</span>';
  h += '<span style="font-size:12px;background:rgba(255,215,0,.15);padding:2px 8px;border-radius:10px">' + unlocked + ' unlocked</span></button>';
  /* Pinned achievement chips */
  if (badges.length > 0) {
    var pinnedKey = 'profAchPinned_' + (window.U ? window.U.uid : '');
    var pinnedList = [];
    try { pinnedList = JSON.parse(localStorage.getItem(pinnedKey) || '[]'); } catch(e) {}
    var showBadges = pinnedList.length > 0
      ? badges.filter(function(b) { return pinnedList.indexOf(b.name) > -1; })
      : [badges[0]]; /* default: show first badge */
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;padding:0 2px">';
    showBadges.forEach(function(b) {
      h += '<div style="display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:' + b.bg + ';color:' + b.color + ';border:1px solid ' + b.color + '44">' + b.icon + ' ' + b.name + '</div>';
    });
    h += '</div>';
  }

  h += '<div class="prof-section"><h3><i class="fas fa-gamepad"></i> Game Info</h3>';
  h += '<div class="gi-row"><span class="gi-l">IGN</span><span class="gi-v">' + (UD.ign || '-') + '</span></div>';
  h += '<div class="gi-row"><span class="gi-l">FF UID</span><span class="gi-v">' + (UD.ffUid || '-') + '</span></div>';
  if (UD.phone) h += '<div class="gi-row"><span class="gi-l">📱 Phone</span><span class="gi-v">' + UD.phone + '</span></div>';
  h += '</div>';
  /* Show pending status with submitted details */
  if (UD.profileRequired === true || UD.profileStatus === 'pending') {
    h += '<div class="pending-box" style="flex-direction:column;align-items:flex-start">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><i class="fas fa-clock"></i> Profile update pending admin approval...</div>';
    /* Show what user submitted */
    var pendingIgn = UD.pendingIgn || UD.ign || '-';
    var pendingUid = UD.pendingUid || UD.ffUid || '-';
    h += '<div style="width:100%;padding:10px;background:rgba(0,0,0,.2);border-radius:8px;margin-top:4px">';
    h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:4px">You submitted:</div>';
    h += '<div style="font-size:13px;font-weight:700;color:var(--txt)">IGN: ' + pendingIgn + '</div>';
    h += '<div style="font-size:13px;font-weight:700;color:var(--txt);margin-top:2px">UID: ' + pendingUid + '</div>';
    h += '</div>';
    h += '<div style="font-size:10px;color:var(--txt2);margin-top:6px">Admin will verify and approve these details</div>';
    h += '</div>';
  }
  h += '<button class="prof-btn pb-orange" onclick="showProfileUpdate()" ' + (UD.profileStatus === 'pending' ? 'disabled' : '') + '><i class="fas fa-edit"></i> Request Profile Update</button>';
  // Stats Chart + Profile Completion
  if (window.renderStatsChart) h += window.renderStatsChart();
  if (window.renderProfileCompletion) h += window.renderProfileCompletion();
  if (window.renderWalletStats) h += window.renderWalletStats();
  if (window.renderNextMatchCountdown) h += window.renderNextMatchCountdown();

  // Bio — show if set
  if (UD.bio) h += '<div style="padding:10px 14px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;font-size:13px;font-style:italic;color:var(--green);margin-bottom:14px">"' + UD.bio + '"</div>';

  // Settings hint card
  h += '<div onclick="showProfileSettings()" style="display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);cursor:pointer;margin-bottom:6px;-webkit-tap-highlight-color:transparent">';
  h += '<div style="width:40px;height:40px;border-radius:12px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-cog" style="color:var(--green);font-size:18px"></i></div>';
  h += '<div style="flex:1"><div style="font-size:14px;font-weight:700;color:var(--txt)">Settings & More</div><div style="font-size:12px;color:var(--txt2);margin-top:2px">Team, Referral, Voucher, Achievements...</div></div>';
  h += '<i class="fas fa-chevron-right" style="color:var(--txt2);font-size:13px"></i>';
  h += '</div>';
  // 💡 Suggestion button
  h += '<div onclick="window.showMySuggestions&&showMySuggestions()" style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:16px;background:rgba(255,215,0,.04);border:1px solid rgba(255,215,0,.12);cursor:pointer;margin-bottom:6px;-webkit-tap-highlight-color:transparent">';
  h += '<div style="width:40px;height:40px;border-radius:12px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-lightbulb" style="color:#ffd700;font-size:18px"></i></div>';
  h += '<div style="flex:1"><div style="font-size:14px;font-weight:700;color:var(--txt)">💡 Suggest a Feature</div><div style="font-size:12px;color:var(--txt2);margin-top:2px">App mein koi kami hai? Batao — reward milega!</div></div>';
  h += '<i class="fas fa-chevron-right" style="color:var(--txt2);font-size:13px"></i></div>';
  // ✅ LEGAL: Legal footer
  if (window.mesLegalFooter) h += window.mesLegalFooter();
  pc.innerHTML = h;
}

function uploadProfImg(inp) {
  if (!inp.files || !inp.files[0]) return;
  compImg(inp.files[0], 400, 0.8, 150, function(b64) { db.ref('users/' + U.uid + '/profileImage').set(b64); toast('Photo updated!', 'ok'); });
}
function applyReferralCode() {
  var inp = document.getElementById('applyRefInput');
  var code = inp ? inp.value.trim().toUpperCase() : '';
  if (!code || code.length < 4) { toast('Valid code enter karo', 'err'); return; }
  var myCode = UD.referralCode || U.uid.substring(0, 8).toUpperCase();
  if (code === myCode) { toast('Apna code nahi laga sakte!', 'err'); return; }
  // Get admin-configured referral reward amount
  db.ref('appSettings/referralReward').once('value', function(rSnap) {
    var rewardCoins = rSnap.val() || 50; // default 50 if admin hasn't set
    db.ref('users').orderByChild('referralCode').equalTo(code).once('value', function(s) {
      if (!s.exists()) { toast('Yeh code nahi mila', 'err'); return; }
      var referrerUid = null;
      s.forEach(function(c) { referrerUid = c.key; });
      if (!referrerUid || referrerUid === U.uid) { toast('Invalid code', 'err'); return; }
      db.ref('users/' + U.uid).update({ referredBy: referrerUid, referredByCode: code });
      db.ref('users/' + referrerUid + '/referralCount').transaction(function(v) { return (v||0)+1; });
      db.ref('users/' + referrerUid + '/referralCoinsEarned').transaction(function(v) { return (v||0)+rewardCoins; });
      db.ref('users/' + referrerUid + '/coins').transaction(function(v) { return (v||0)+rewardCoins; });
      db.ref('users/' + referrerUid + '/notifications').push({
        title: '🎁 Referral Reward!',
        message: 'Tumhare code se koi join hua! +' + rewardCoins + ' coins mile!',
        timestamp: Date.now(), read: false, type: 'referral'
      });
      var rrid = db.ref('referrals').push().key;
      db.ref('referrals/' + rrid).set({
        referrerId: referrerUid, referredUid: U.uid, referredName: UD.ign || UD.displayName || '',
        code: code, reward: rewardCoins, verified: true, createdAt: Date.now()
      });
      toast('✅ Code apply hua! Tumhare dost ko 🪙' + rewardCoins + ' coins milenge!', 'ok');
      renderProfile();
    });
  });
}
function shareRef(code) {
  var url = window.location.href;
  var msg = '🎮 Join Mini eSports — India\'s Best Free Fire Tournament App! 🔥\n\n💰 Win Real Cash Prizes!\n🪙 Get FREE bonus coins on signup!\n\n👉 Use my referral code: ' + code + '\n📲 Download now:';
  if (navigator.share) {
    navigator.share({ title: 'Mini eSports - Refer & Earn', text: msg, url: url }).catch(function() {
      window.open('https://wa.me/?text=' + encodeURIComponent(msg + '\n' + url), '_blank');
    });
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(msg + '\n' + url), '_blank');
  }
}
function addTM(mode) {
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  var h = '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><i class="fas fa-user-plus"></i> Add ' + (mode === 'duo' ? 'Duo Partner' : 'Squad Member') + '</div>';
  h += '<div class="f-group"><label>Teammate FF UID</label>' +
    '<input type="text" class="f-input" id="tmUid" placeholder="Enter FF UID" oninput="tmLookup(\'uid\')">' +
    '<div id="tmUidStatus" style="font-size:11px;margin-top:4px;min-height:16px"></div></div>';
  h += '<div style="text-align:center;font-size:11px;color:var(--txt2);margin:4px 0">— ya —</div>';
  h += '<div class="f-group"><label>Teammate IGN</label>' +
    '<input type="text" class="f-input" id="tmIgn" placeholder="Enter IGN" oninput="tmLookup(\'ign\')">' +
    '<div id="tmIgnStatus" style="font-size:11px;margin-top:4px;min-height:16px"></div></div>';
  h += '<div id="tmFoundCard" style="display:none;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);border-radius:10px;padding:10px;margin:8px 0;font-size:13px"></div>';
  h += '<button class="f-btn fb-green" onclick="saveTM(\'' + mode + '\')">Add Teammate</button>';
  openModal('Add Teammate', h);
}

/* Teammate auto-lookup — FF UID se IGN auto-fill, ya IGN se UID auto-fill */
var _tmLookupTimer = null;
function tmLookup(field) {
  clearTimeout(_tmLookupTimer);
  _tmLookupTimer = setTimeout(function() {
    var uidEl = $('tmUid'), ignEl = $('tmIgn');
    var uidStatus = $('tmUidStatus'), ignStatus = $('tmIgnStatus');
    var foundCard = $('tmFoundCard');
    if (!uidEl || !ignEl) return;

    var val = field === 'uid' ? uidEl.value.trim() : ignEl.value.trim();
    if (!val || val.length < 3) return;

    if (uidStatus) uidStatus.innerHTML = field === 'uid' ? '<span style="color:var(--txt2)">Searching...</span>' : '';
    if (ignStatus) ignStatus.innerHTML = field === 'ign' ? '<span style="color:var(--txt2)">Searching...</span>' : '';

    var queryRef = field === 'uid'
      ? db.ref('users').orderByChild('ffUid').equalTo(val)
      : db.ref('users').orderByChild('ign').equalTo(val);

    queryRef.once('value', function(s) {
      if (!s.exists()) {
        if (field === 'uid' && uidStatus) uidStatus.innerHTML = '<span style="color:var(--red)">❌ UID not found</span>';
        if (field === 'ign' && ignStatus) ignStatus.innerHTML = '<span style="color:var(--red)">❌ IGN not found</span>';
        if (foundCard) foundCard.style.display = 'none';
        return;
      }
      var pData = null, pKey = null;
      s.forEach(function(c) { if (!pData) { pData = c.val(); pKey = c.key; } });
      if (!pData) return;

      // Check verification
      if (pData.profileStatus !== 'approved' && !pData.profileVerified) {
        var statusEl = field === 'uid' ? uidStatus : ignStatus;
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--orange)">⚠️ User not verified — cannot add</span>';
        if (foundCard) foundCard.style.display = 'none';
        return;
      }

      // Auto-fill the other field
      if (field === 'uid' && ignEl) {
        ignEl.value = pData.ign || pData.displayName || '';
        if (uidStatus) uidStatus.innerHTML = '<span style="color:var(--green)">✅ Found!</span>';
        if (ignStatus) ignStatus.innerHTML = '';
      } else if (field === 'ign' && uidEl) {
        uidEl.value = pData.ffUid || '';
        if (ignStatus) ignStatus.innerHTML = '<span style="color:var(--green)">✅ Found!</span>';
        if (uidStatus) uidStatus.innerHTML = '';
      }

      // Show found card
      if (foundCard) {
        var av = pData.profileImage ? '<img src="' + pData.profileImage + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover">' : '<div style="width:32px;height:32px;border-radius:50%;background:var(--card2);display:flex;align-items:center;justify-content:center;font-weight:700">' + (pData.ign||'?').charAt(0) + '</div>';
        foundCard.style.display = 'flex';
        foundCard.style.alignItems = 'center';
        foundCard.style.gap = '10px';
        foundCard.innerHTML = av + '<div><div style="font-weight:700">' + (pData.ign||'Unknown') + '</div><div style="font-size:11px;color:var(--txt2)">UID: ' + (pData.ffUid||'—') + '</div></div><span style="margin-left:auto;font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(0,255,156,.1);color:var(--green)">✅ Verified</span>';
      }
    });
  }, 500); // 500ms debounce
}

function saveTM(mode) {
  var uid = ($('tmUid') || {}).value, ign = ($('tmIgn') || {}).value;
  uid = (uid||'').trim(); ign = (ign||'').trim();
  if (!uid && !ign) { toast('FF UID ya IGN mein se koi ek daalo', 'err'); return; }
  if (!uid || uid.length < 5) { toast('Valid FF UID chahiye (min 5 digits)', 'err'); return; }
  if (!ign) ign = uid; // fallback if IGN not filled
  uid = uid.trim(); ign = ign.trim();
  // Self-check
  if (uid === (UD.ffUid || '')) { toast('Cannot add yourself!', 'err'); return; }
  db.ref('users').orderByChild('ffUid').equalTo(uid).once('value', function(s) {
    if (!s.exists()) { toast('UID "' + uid + '" not found in database!', 'err'); return; }
    var partnerData = null, partnerKey = null;
    s.forEach(function(c) { partnerData = c.val(); partnerKey = c.key; });
    if (!partnerData || !partnerKey) { toast('Error loading partner data', 'err'); return; }
    var myUid = UD.ffUid || '';
    var myName = UD.ign || UD.displayName || 'Player';
    var partnerName = partnerData.ign || partnerData.displayName || ign;
    if (mode === 'duo') {
      // TWO-WAY SYNC: Save in BOTH users' profiles (duoTeam + partnerUid)
      var myTeamData = { memberUid: uid, memberName: partnerName };
      var partnerTeamData = { memberUid: myUid, memberName: myName };
      // Save duoTeam object
      db.ref('users/' + U.uid + '/duoTeam').set(myTeamData);
      db.ref('users/' + partnerKey + '/duoTeam').set(partnerTeamData);
      // ALSO save partnerUid for quick lookup
      db.ref('users/' + U.uid + '/partnerUid').set(uid);
      db.ref('users/' + partnerKey + '/partnerUid').set(myUid);
      console.log('[Mini eSports] ✅ Duo sync (2-way): ' + myName + ' ↔ ' + partnerName);
      console.log('[Mini eSports]   users/' + U.uid + '/partnerUid = ' + uid);
      console.log('[Mini eSports]   users/' + partnerKey + '/partnerUid = ' + myUid);
    } else {
      // Check squad not full
      var myMembers = (UD.squadTeam && UD.squadTeam.members) || [];
      if (myMembers.length >= 3) { toast('Squad full! (Max 3 teammates)', 'err'); return; }
      // Check not already in squad
      var alreadyInMySquad = false;
      myMembers.forEach(function(m) { if (m.uid === uid) alreadyInMySquad = true; });
      if (alreadyInMySquad) { toast('Already in your squad!', 'inf'); return; }
      // TWO-WAY SYNC: Add to BOTH users' squads
      myMembers.push({ uid: uid, name: partnerName });
      db.ref('users/' + U.uid + '/squadTeam/members').set(myMembers);
      // Also save squad UIDs array for quick lookup
      db.ref('users/' + U.uid + '/squadUids').set(myMembers.map(function(m) { return m.uid; }));
      var partnerMembers = (partnerData.squadTeam && partnerData.squadTeam.members) || [];
      var alreadyInPartnerSquad = false;
      partnerMembers.forEach(function(m) { if (m.uid === myUid) alreadyInPartnerSquad = true; });
      if (!alreadyInPartnerSquad) {
        partnerMembers.push({ uid: myUid, name: myName });
        db.ref('users/' + partnerKey + '/squadTeam/members').set(partnerMembers);
        db.ref('users/' + partnerKey + '/squadUids').set(partnerMembers.map(function(m) { return m.uid; }));
      }
      console.log('[Mini eSports] ✅ Squad sync (2-way): ' + myName + ' ↔ ' + partnerName);
    }
    closeModal(); toast('✅ ' + partnerName + ' added as teammate! (Synced both profiles)', 'ok');
  });
}
function removeTM(mode, idx) {
  if (mode === 'duo') {
    var old = UD.duoTeam;
    // Remove from MY profile (both duoTeam + partnerUid)
    db.ref('users/' + U.uid + '/duoTeam').remove();
    db.ref('users/' + U.uid + '/partnerUid').remove();
    // TWO-WAY: Remove from PARTNER's profile too
    if (old && old.memberUid) {
      db.ref('users').orderByChild('ffuid').equalTo(old.memberUid).once('value', function(s) {
        if (s.exists()) s.forEach(function(c) {
          db.ref('users/' + c.key + '/duoTeam').remove();
          db.ref('users/' + c.key + '/partnerUid').remove();
          console.log('[Mini eSports] ✅ Duo removed from both profiles (duoTeam + partnerUid)');
        });
      });
    }
    toast('Duo partner removed (both profiles updated)', 'ok');
  } else {
    var members = (UD.squadTeam && UD.squadTeam.members) || [];
    if (idx < 0 || idx >= members.length) return;
    var removed = members[idx];
    // Remove from MY squad
    members.splice(idx, 1);
    db.ref('users/' + U.uid + '/squadTeam/members').set(members.length > 0 ? members : null);
    db.ref('users/' + U.uid + '/squadUids').set(members.length > 0 ? members.map(function(m) { return m.uid; }) : null);
    // TWO-WAY: Remove ME from PARTNER's squad
    if (removed && removed.uid) {
      db.ref('users').orderByChild('ffuid').equalTo(removed.uid).once('value', function(s) {
        if (s.exists()) s.forEach(function(c) {
          var pm = (c.val().squadTeam && c.val().squadTeam.members) || [];
          pm = pm.filter(function(m) { return m.uid !== (UD.ffUid || ''); });
          db.ref('users/' + c.key + '/squadTeam/members').set(pm.length > 0 ? pm : null);
          db.ref('users/' + c.key + '/squadUids').set(pm.length > 0 ? pm.map(function(m) { return m.uid; }) : null);
          console.log('[Mini eSports] ✅ Squad member removed from both profiles (members + UIDs)');
        });
      });
    }
    toast('Squad member removed (both profiles updated)', 'ok');
  }
}
function showProfileUpdate() {
  if (window.showProfileUpdate_v2) { window.showProfileUpdate_v2(); return; }
  var h = '<div class="f-group"><label>In-Game Name (IGN)</label><input type="text" class="f-input" id="puIgn" placeholder="Your Free Fire IGN" value="' + (UD.ign || '') + '"></div>';
  /* FF UID lock after verified */
  var ffSet = UD.ffUid && UD.ffUid.trim().length >= 5;
  var isVerified = UD.profileStatus === "approved" || UD.profileVerified;
  if (ffSet && isVerified) {
    h += '<div class="f-group"><label>Free Fire UID <span style="color:#ffd700;font-size:10px">🔒 Locked</span></label><input type="text" class="f-input" id="puUid" value="' + (UD.ffUid||'') + '" readonly style="opacity:.6;cursor:not-allowed"></div>';
    h += '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.15);border-radius:8px;padding:8px 12px;font-size:11px;color:#ffaa00;margin-bottom:10px"><i class="fas fa-lock"></i> FF UID locked after first verification. Contact admin to change.</div>';
  } else {
    h += '<div style="background:rgba(0,255,156,.05);border:1px solid rgba(0,255,156,.12);border-radius:8px;padding:8px 12px;font-size:11px;color:#00ff9c;margin-bottom:6px"><i class="fas fa-info-circle"></i> FF UID set karne ke baad change nahi hogi — sahi UID daalna!</div>';
    h += '<div class="f-group"><label>Free Fire UID (5-15 digits)</label><input type="text" class="f-input" id="puUid" placeholder="Your FF UID" value="' + (UD.ffUid || '') + '"></div>';
  }
  h += '<div class="f-group"><label>WhatsApp Number <span style="font-size:10px;color:var(--txt2)">(prizes ke liye)</span></label><input type="tel" class="f-input" id="puPhone" placeholder="10-digit number" maxlength="10" value="' + (UD.phone || '') + '"></div>';
  h += '<div class="f-group"><label>Bio <span style="font-size:10px;color:var(--txt2)">(optional)</span></label><input type="text" class="f-input" id="puBio" placeholder="About you..." maxlength="80" value="' + (UD.bio || '') + '"></div>';
  h += '<div class="f-warn"><i class="fas fa-exclamation-triangle"></i> Only real Free Fire IGN and UID allowed. Fake info = disqualified.</div>';
  h += '<button class="f-btn fb-orange" style="margin-top:14px" onclick="doProfileUpdate()">Submit for Verification</button>';
  openModal('Profile Update', h);
}
var _profileUpdateSubmitting = false;
function doProfileUpdate() {
  if (_profileUpdateSubmitting) return;
  var ign = ($('puIgn') || {}).value, uid = ($('puUid') || {}).value;
  if (!ign || !ign.trim()) { toast('Enter IGN', 'err'); return; }
  if (!uid || uid.trim().length < 5 || uid.trim().length > 15 || !/^\d+$/.test(uid.trim())) { toast('UID must be 5-15 digits', 'err'); return; }
  ign = ign.trim(); uid = uid.trim();
  _profileUpdateSubmitting = true;
  var btn = document.querySelector('.fb-orange');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  db.ref('users').orderByChild('ign').equalTo(ign).once('value', function(s) {
    var dup = false;
    if (s.exists()) s.forEach(function(c) { if (c.key !== U.uid) dup = true; });
    if (dup) { toast('IGN already taken! Koi aur player yeh naam use kar raha hai.', 'err'); _profileUpdateSubmitting = false; if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; } return; }

    /* ── FF UID uniqueness check ── */
    db.ref('users').orderByChild('ffUid').equalTo(uid).once('value', function(ffSnap) {
      if (ffSnap.exists()) {
        var ffDup = false;
        ffSnap.forEach(function(c) { if (c.key !== U.uid) ffDup = true; });
        if (ffDup) { toast('⚠️ Yeh FF UID pehle se kisi aur account pe register hai! Apna sahi UID daalo.', 'err'); _profileUpdateSubmitting = false; if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; } return; }
      }

      /* ── Phone uniqueness check ── */
      var phone = (($('puPhone') || {}).value || '').replace(/\D/g, '').trim();
      if (phone && phone.length >= 10) {
        db.ref('users').orderByChild('phone').equalTo(phone).once('value', function(phSnap) {
          if (phSnap.exists()) {
            var phDup = false;
            phSnap.forEach(function(c) { if (c.key !== U.uid) phDup = true; });
            if (phDup) { toast('⚠️ Yeh phone number pehle se kisi aur account pe registered hai!', 'err'); _profileUpdateSubmitting = false; if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; } return; }
          }
          _doSubmitProfileRequest(ign, uid, phone, btn);
        });
      } else {
        _doSubmitProfileRequest(ign, uid, phone, btn);
      }
    });
  }, function() {
    _profileUpdateSubmitting = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
    toast('Network error. Try again.', 'err');
  });
}
function _doSubmitProfileRequest(ign, uid, phone, btn) {
    var isVerified = (UD.profileStatus === 'approved');
    var reqType = isVerified ? 'update' : 'verification';

    /* phone already passed as param */
    var requestData = {
      /* User identity */
      uid: U.uid,
      name: UD.displayName || '',
      userName: UD.ign || UD.displayName || '',
      displayName: UD.displayName || '',
      userEmail: UD.email || '',
      
      /* Requested new values (EXPLICIT fields for Admin) */
      requestedIgn: ign,
      requestedUid: uid,
      
      /* Also save as ign/ffuid for backward compatibility */
      ign: ign,
      ffUid: uid,
      
      /* Phone number */
      phone: phone,
      
      /* Old values for comparison */
      oldIgn: UD.ign || '',
      oldUid: UD.ffUid || '',
      
      /* Request metadata */
      type: reqType,
      status: 'pending',
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    
    /* Save to correct path based on ban status and profile verification */
    var _isBanned = UD.isBanned || UD.blocked;
    var _savePath = (_isBanned || UD.profileVerified) ? 'profileUpdates' : 'profileRequests';
    db.ref(_savePath + '/' + U.uid).set(Object.assign(requestData, { 
      isBannedUser: _isBanned || false,
      requestCount: (UD.profileRequestCount || 0) + 1  // track how many times user has requested
    }));
    
    /* Also update user's profile with requested values (for display while pending) */
    var bio = (($('puBio') || {}).value || '').trim().substring(0, 80);
    var userUpdate = { profileStatus: 'pending', profileRequired: true, pendingIgn: ign, pendingUid: uid, profileRequestCount: (UD.profileRequestCount || 0) + 1 };
    if (phone && phone.length >= 10) userUpdate.phone = phone;
    if (bio) userUpdate.bio = bio;
    db.ref('users/' + U.uid).update(userUpdate);
    _profileUpdateSubmitting = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
    closeModal();
    toast('Profile sent for verification! ✅', 'ok');
}
function redeemVoucher() {
  var code = ($('voucherIn') || {}).value;
  if (!code || !code.trim()) { toast('Enter voucher code', 'err'); return; }
  code = code.trim().toUpperCase();
  db.ref('vouchers/' + code).once('value', function(s) {
    if (!s.exists()) { toast('Invalid voucher code', 'err'); return; }
    var v = s.val();
    if (v.status !== 'active') { toast('Voucher expired', 'err'); return; }
    if (v.usedBy && v.usedBy[U.uid]) { toast('Already redeemed!', 'inf'); return; }
    if (v.maxUses && (v.usedCount || 0) >= v.maxUses) { toast('Voucher limit reached', 'err'); return; }
    var rt = v.rewardType || 'coins', ra = Number(v.rewardAmount) || 0;
    if (rt === 'coins') db.ref('users/' + U.uid + '/coins').transaction(function(c) { return (c || 0) + ra; });
    else db.ref('users/' + U.uid + '/realMoney/bonus').transaction(function(b) { return (b || 0) + ra; });
    db.ref('vouchers/' + code + '/usedBy/' + U.uid).set(true);
    db.ref('vouchers/' + code + '/usedCount').transaction(function(c) { return (c || 0) + 1; });
    toast('Voucher redeemed! +' + (rt === 'coins' ? '🪙 ' : '💎') + ra, 'ok');
  });
}
function showSupportForm() {
  var h = '<div class="f-group"><label>Issue Type</label><select class="f-input" id="supType"><option value="payment">Payment Issue</option><option value="match">Match Issue</option><option value="account">Account Issue</option><option value="bug">Bug Report</option><option value="other">Other</option></select></div>';
  h += '<div class="f-group"><label>Describe your issue</label><textarea class="f-input" id="supMsg" placeholder="Explain your problem in detail..."></textarea></div>';
  h += '<button class="f-btn fb-green" onclick="submitSupport()">Submit Ticket</button>';
  openModal('Support Ticket', h);
}
function submitSupport() {
  var type = ($('supType') || {}).value, msg = ($('supMsg') || {}).value;
  if (!msg || !msg.trim()) { toast('Describe your issue', 'err'); return; }
  var id = db.ref('supportRequests').push().key;
  db.ref('supportRequests/' + id).set({ requestId: id, userId: U.uid, userName: UD.ign || UD.displayName || '', displayName: UD.displayName || '', userEmail: UD.email || '', userIGN: UD.ign || '', userFFUID: UD.ffUid || '', type: type, message: msg.trim(), status: 'open', createdAt: firebase.database.ServerValue.TIMESTAMP });
  closeModal(); toast('Ticket submitted!', 'ok');
}
function showRules() {
  var rules = ['Use only your registered IGN and UID. Mismatch = disqualification.', 'No teaming with enemies. Fair play only.', 'Join the room on time. Late = no refund.', 'Screenshots/proof may be required for disputes.', 'Admin decisions are final in all matters.', 'No abusive language in chat or support.', 'Multiple accounts will result in permanent ban.'];
  var h = '';
  rules.forEach(function(r, i) { h += '<div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--border)"><div style="width:24px;height:24px;border-radius:8px;background:rgba(0,255,106,.1);color:var(--green);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (i + 1) + '</div><div style="font-size:13px;line-height:1.5;color:var(--txt2)">' + r + '</div></div>'; });
  openModal('Rules & Fair Play', h);
}

/* ====== CHAT (STANDARDIZED - support/ path only) ====== */
/* BUG FIX #4: Use ONLY support/{uid} path for consistency with Admin panel */
var _chatListenerActive = false;
var _chatOnlineListenerActive = false;
function startChat() {
  if (!U) return;
  /* Sync user identity */
  var userInfo = {
    userId: U.uid, uid: U.uid,
    userName: UD ? (UD.ign || UD.displayName || '') : '',
    displayName: UD ? (UD.displayName || '') : '',
    userEmail: UD ? (UD.email || '') : '',
    userIGN: UD ? (UD.ign || '') : '',
    userFFUID: UD ? (UD.ffUid || '') : '',
    profileImage: UD ? (UD.profileImage || '') : ''
  };
  db.ref('support/' + U.uid + '/info').update(userInfo);

  /* FIX: Only attach listeners ONCE — prevent double messages */
  if (!_chatOnlineListenerActive) {
    _chatOnlineListenerActive = true;
    db.ref('appSettings/supportOnline').on('value', function(s) {
      var el = $('chatSt');
      if (el) {
        if (s.val()) { el.textContent = 'Online'; el.style.color = 'var(--green)'; }
        else { el.textContent = 'Away'; el.style.color = 'var(--txt2)'; }
      }
    });
  }
  if (!_chatListenerActive) {
    _chatListenerActive = true;
    db.ref('support/' + U.uid + '/messages').orderByChild('createdAt').on('value', function(s) {
      renderChatMsgs(s);
    });
  } else {
    /* Already listening — just re-render from existing data */
    db.ref('support/' + U.uid + '/messages').orderByChild('createdAt').once('value', function(s) {
      renderChatMsgs(s);
    });
  }
}

function renderChatMsgs(s) {
  var cm = $('chatMsgs'); if (!cm) return;
  var msgs = []; if (s.exists()) s.forEach(function(c) { msgs.push(c.val()); });
  if (!msgs.length) {
    cm.innerHTML = '<div style="text-align:center;padding:50px 20px;color:var(--txt2)"><div style="font-size:40px;margin-bottom:8px;opacity:.2">💬</div><p style="font-size:13px">Koi message nahi — say hi!</p></div>';
    return;
  }
  var h = '', ld = '';
  msgs.forEach(function(m) {
    var isAdmin = m.senderId === 'admin' || m.senderRole === 'admin';
    var ts = new Date(m.createdAt || m.timestamp || Date.now());
    var ds = ts.toLocaleDateString('en-IN', {day:'numeric',month:'short'});
    var tm = ts.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    if (ds !== ld) {
      ld = ds;
      h += '<div style="text-align:center;margin:12px 0"><span style="font-size:10px;color:var(--txt2);background:var(--card2);padding:4px 12px;border-radius:20px;border:1px solid var(--border)">' + ds + '</span></div>';
    }
    if (isAdmin) {
      h += '<div style="display:flex;justify-content:flex-start;margin:3px 0 8px">' +
           '<div style="max-width:78%;background:var(--card2);border:1px solid var(--border);border-radius:4px 16px 16px 16px;padding:10px 14px;font-size:13px;line-height:1.5">' +
           '<div style="font-size:10px;color:var(--primary);margin-bottom:4px;font-weight:700;display:flex;align-items:center;gap:4px"><span>🛡️</span> Admin</div>' +
           '<div style="color:var(--txt)">' + (m.text || m.message || '') + '</div>' +
           '<div style="font-size:10px;color:var(--txt2);margin-top:5px;text-align:right">' + tm + '</div>' +
           '</div></div>';
    } else {
      h += '<div style="display:flex;justify-content:flex-end;margin:3px 0 8px">' +
           '<div style="max-width:78%;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);border-radius:16px 4px 16px 16px;padding:10px 14px;font-size:13px;line-height:1.5">' +
           '<div style="color:var(--txt)">' + (m.text || m.message || '') + '</div>' +
           '<div style="font-size:10px;color:var(--txt2);margin-top:5px;text-align:right">' + tm + ' <span style="color:var(--green)">✓✓</span></div>' +
           '</div></div>';
    }
  });
  cm.innerHTML = h;
  cm.scrollTop = cm.scrollHeight;
}

function sendChat() {
  var inp = $('chatIn'); if (!inp) return;
  var msg = inp.value.trim(); if (!msg) return; inp.value = '';

  var msgData = {
    senderId: U.uid,
    senderUid: U.uid,
    senderName: UD ? (UD.ign || UD.displayName || '') : '',
    senderDisplayName: UD ? (UD.displayName || '') : '',
    senderEmail: UD ? (UD.email || '') : '',
    senderRole: 'user',
    text: msg,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  };

  /* BUG FIX #4: Save ONLY to support/ path — Admin's primary path */
  var id = db.ref('support/' + U.uid + '/messages').push().key;
  db.ref('support/' + U.uid + '/messages/' + id).set(msgData);

  /* Update chat info for admin panel to show latest message */
  var infoUpdate = {
    lastMessage: msg,
    lastMessageTime: firebase.database.ServerValue.TIMESTAMP,
    unreadByAdmin: true
  };
  db.ref('support/' + U.uid + '/info').update(infoUpdate);
}

/* ====== NOTIFICATIONS ====== */
function toggleAchievements() {
  var ac = document.getElementById('achContent');
  var ch = document.getElementById('achChevron');
  if (!ac) return;
  var isOpen = ac.style.display !== 'none';
  ac.style.display = isOpen ? 'none' : 'block';
  if (ch) ch.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function renderNotifs() {
  var nl = $('notifList'); if (!nl) return;
  if (!NOTIFS.length) { nl.innerHTML = '<div class="empty-state"><i class="fas fa-bell"></i><p>No notifications</p></div>'; return; }
  // Mark ALL as read when panel opens
  if (U && UD) {
    var toMark = {};
    NOTIFS.forEach(function(n) {
      if (!n._key) return;
      n._localRead = true;
      _READ_KEYS[n._key] = true;
      toMark[n._key] = true;
    });
    if (!UD.readNotifications) UD.readNotifications = {};
    Object.assign(UD.readNotifications, toMark);
    if (Object.keys(toMark).length) {
      db.ref('users/' + U.uid + '/readNotifications').update(toMark);
      // ✅ FIX: localStorage mein bhi save karo
      try {
        var _lsAll = JSON.parse(localStorage.getItem('_mes_read_' + U.uid) || '{}');
        Object.assign(_lsAll, toMark);
        localStorage.setItem('_mes_read_' + U.uid, JSON.stringify(_lsAll));
      } catch(e) {}
    }
    setTimeout(updateBell, 100);
  }
  var rd = (UD && UD.readNotifications) || {}, h = '';
  // Clear All button at top
  h += '<div style="display:flex;justify-content:flex-end;margin-bottom:10px">';
  h += '<button onclick="clearAllNotifs()" style="background:rgba(255,50,50,.12);border:1px solid rgba(255,50,50,.25);color:#ff5555;font-size:11px;font-weight:700;padding:6px 14px;border-radius:10px;cursor:pointer"><i class="fas fa-trash"></i> Clear All</button>';
  h += '</div>';
  // Filter out system-type notifications that shouldn't be shown in list
  var HIDDEN_TYPES = ['back_online', 'online', 'profile_approved', 'profile_update_approved', 'system'];
  var visibleNotifs = NOTIFS.filter(function(n) { return HIDDEN_TYPES.indexOf(n.type) === -1; });
  if (!visibleNotifs.length) { h += '<div class="empty-state"><i class="fas fa-bell"></i><p>No notifications</p></div>'; }
  visibleNotifs.forEach(function(n) {
    var unread = false; // All shown as read since we just marked them
    var ic = 'ny'; // default yellow
    if (n.type === 'room_released') ic = 'ng';
    else if (n.type === 'new_match' || n.type === 'match_starting') ic = 'nb';
    else if (n.type === 'chat_reply') ic = 'np';
    else if (n.type === 'wallet_approved' || n.type === 'withdraw_done') ic = 'ng';
    else if (n.type === 'wallet_rejected' || n.type === 'withdraw_rejected') ic = 'nr';
    else if (n.type === 'match_completed' || n.type === 'result') ic = 'ng';
    h += '<div class="notif-card' + (unread ? ' unread' : '') + '" style="position:relative" onclick="openNotif(\'' + n._key + '\')">';
    h += '<div class="notif-icon ' + ic + '"><i class="fas ' + (n.faIcon || 'fa-bell') + '"></i></div>';
    h += '<div class="notif-body"><div class="notif-title">' + (n.title || 'Notification') + '</div>';
    h += '<div class="notif-msg">' + (n.message || '') + '</div>';
    h += '<div class="notif-time">' + timeAgo(n.createdAt) + '</div>';
    if (n.matchName) h += '<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;background:rgba(185,100,255,.1);color:var(--purple);margin-top:4px">' + n.matchName + '</span>';
    h += '</div>';
    // Delete button right side
    h += '<button onclick="event.stopPropagation();deleteNotif(\'' + n._key + '\',\'' + (n._srcUser ? 'user' : 'global') + '\')" style="position:absolute;top:10px;right:10px;background:rgba(255,50,50,.12);border:1px solid rgba(255,50,50,.2);color:#ff5555;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-times"></i></button>';
    h += '</div>';
  });
  nl.innerHTML = h;
}
function deleteNotif(key, src) {
  // Remove from local NOTIFS
  NOTIFS = NOTIFS.filter(function(n) { return n._key !== key; });
  _READ_KEYS[key] = true;
  if (src === 'user' && U) {
    db.ref('users/' + U.uid + '/notifications/' + key).remove();
    db.ref('users/' + U.uid + '/readNotifications/' + key).remove();
  }
  updateBell();
  renderNotifs();
}
function clearAllNotifs() {
  if (!U) return;
  var userKeys = [], readUpdates = {};
  NOTIFS.forEach(function(n) {
    if (n._srcUser && n._key) userKeys.push(n._key);
    if (n._key) readUpdates[n._key] = null; // delete from readNotifications too
  });
  // Delete each user notification
  var delPromises = userKeys.map(function(k) { return db.ref('users/' + U.uid + '/notifications/' + k).remove(); });
  Promise.all(delPromises);
  NOTIFS = [];
  _READ_KEYS = {};
  if (UD) UD.readNotifications = {};
  updateBell();
  renderNotifs();
}
function openNotif(key) {
  db.ref('users/' + U.uid + '/readNotifications/' + key).set(true);
  // Mark locally and in persistent set
  _READ_KEYS[key] = true;
  NOTIFS.forEach(function(n) { if (n._key === key) n._localRead = true; });
  if (!UD.readNotifications) UD.readNotifications = {};
  UD.readNotifications[key] = true;
  // ✅ FIX: localStorage mein bhi save karo taaki badge baar baar na aaye
  try {
    var _lsRead = JSON.parse(localStorage.getItem('_mes_read_' + U.uid) || '{}');
    _lsRead[key] = true;
    localStorage.setItem('_mes_read_' + U.uid, JSON.stringify(_lsRead));
  } catch(e) {}
  updateBell();
  var n = null; NOTIFS.forEach(function(x) { if (x._key === key) n = x; }); if (!n) return;
  var h = '<div style="text-align:center;font-size:36px;margin-bottom:12px"><i class="fas ' + (n.faIcon || 'fa-bell') + '"></i></div>';
  h += '<div style="font-size:16px;font-weight:700;text-align:center;margin-bottom:4px">' + (n.title || 'Notification') + '</div>';
  h += '<div style="font-size:13px;color:var(--txt2);text-align:center;margin-bottom:14px">' + timeAgo(n.createdAt) + '</div>';
  h += '<div style="font-size:14px;line-height:1.6;color:var(--txt)">' + (n.message || '') + '</div>';
  if (n.matchId && n.type === 'room_released') {
    var t = MT[n.matchId];
    if (t && t.roomId && t.roomPassword && hasJ(n.matchId)) {
      h += '<div class="room-box rb-green" style="margin-top:14px"><div style="font-size:11px;color:var(--txt2);text-transform:uppercase;margin-bottom:4px">Room ID</div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:20px;font-weight:900">' + t.roomId + '</span><button onclick="copyTxt(\'' + t.roomId + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div>';
      h += '<div style="font-size:11px;color:var(--txt2);text-transform:uppercase;margin-top:8px;margin-bottom:4px">Password</div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:20px;font-weight:900">' + t.roomPassword + '</span><button onclick="copyTxt(\'' + t.roomPassword + '\')" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div></div>';
    }
  }
  openModal('Notification', h);
}
/* ========================================
   COIN SHOP — Manual UPI flow
   ======================================== */
function showCoinShop() {
  var modal = document.getElementById('coinShopModal');
  if (modal) modal.style.display = 'flex';
}
function closeCoinShop() {
  var modal = document.getElementById('coinShopModal');
  if (modal) modal.style.display = 'none';
}
function buyCoinPkg(price, coins, pkg) {
  if (isVO()) { toast('Profile complete karo pehle!', 'err'); return; }
  var upi = ''; // Will be loaded from settings
  var msg = document.getElementById('coinShopMsg');

  // Get UPI from Firebase settings
  db.ref('appSettings/payment/upiId').once('value', function(s) {
    var upiId = s.val() || 'pay@upi';
    var payeeName = 'Mini eSports';
    var note = 'CoinPkg-' + pkg + '-' + U.uid.substring(0,8);

    // Show UPI payment instructions
    if (msg) {
      msg.style.display = 'block';
      msg.style.background = 'rgba(0,255,156,.08)';
      msg.style.border = '1px solid rgba(0,255,156,.2)';
      msg.style.color = 'var(--green)';
      msg.innerHTML = '1️⃣ UPI pe ₹' + price + ' bhejo: <strong>' + upiId + '</strong><br>' +
        '2️⃣ Screenshot wallet mein "Add Money" se submit karo<br>' +
        '3️⃣ Note mein likhna: <strong>' + note + '</strong><br>' +
        '<small style="color:var(--txt2)">1-2 ghante mein ' + coins + ' coins milenge 🪙</small>';
    }

    // Save pending coin request to Firebase for admin
    db.ref('coinRequests').push({
      userId: U.uid,
      ign: (UD && UD.ign) || '',
      package: pkg,
      price: price,
      coins: coins,
      status: 'pending',
      createdAt: Date.now(),
      note: note
    });

    toast('UPI details copy karo aur payment karo! 🪙', 'ok');
  });
}

/* ====== ANTI-SPAM HOOK ALIASES ======
   Anti-spam features hook into these window.* names.
   Mapping them to actual app functions.
*/
window.doJoin = window.doJoin || doJoin;
window.submitWithdrawal = window.submitWithdrawal || submitWd;
window.submitCoinRequest = window.submitCoinRequest || buyCoinPkg;
window.sendChatMessage = window.sendChatMessage || sendChat;
window.submitResult = window.submitResult || function(matchId, data) {
  // Called when result screenshot is submitted
  if (data && data.screenshotUrl) {
    wfScreenshot = data.screenshotUrl;
  }
};
