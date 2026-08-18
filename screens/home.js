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
    if (!window._supa) { renderSearchResults([], q); return; }
    window._supa.from('user_public_profiles') /* BUG #38 FIX */
      .select('id,ign,ff_uid,avatar_url,profile_status,city,total_matches,total_wins,total_kills')
      .or('ign.ilike.%' + q + '%,ff_uid.ilike.%' + q + '%')
      .eq('is_banned', false).limit(10)
      .then(function(r) {
        var results = (r.data || []).map(function(u) {
          return { uid: u.id, u: { ign: u.ign||'', displayName: u.ign||'', ffUid: u.ff_uid||'', profileImage: u.avatar_url||'', profileStatus: u.profile_status||'', city: u.city||'', stats: { matches: u.total_matches||0, wins: u.total_wins||0, kills: u.total_kills||0 } } };
        });
        renderSearchResults(results, q);
      }).catch(function() { renderSearchResults([], q); });
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
    h += '<div style="font-size:14px;font-weight:800;color:var(--txt)">' + (window.escHtml?window.escHtml(u.ign||u.displayName||'Player'):(u.ign||u.displayName||'Player')) + (isSelf ? ' <span style="font-size:10px;color:var(--green)">(You)</span>' : '') + '</div>';
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
  if (!window._supa) { toast('Service unavailable', 'err'); return; }
  window._supa.from('user_public_profiles').select('id,ign,ff_uid,avatar_url,bio,total_matches,total_wins,total_kills').eq('id', uid).single() /* BUG #38 FIX */
    .then(function(r) {
      if (!r.data) { toast('Player nahi mila', 'err'); return; }
      var u = r.data;
      u.ign = u.ign || ''; u.ffUid = u.ff_uid || ''; u.profileImage = u.avatar_url || '';
      var st = { matches: u.total_matches||0, wins: u.total_wins||0, kills: u.total_kills||0, earnings: 0 };
      var av = u.profileImage
        ? '<img src="' + u.profileImage + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'
        : '<span style="font-size:32px;font-weight:700">' + (u.ign || '?').charAt(0).toUpperCase() + '</span>';
      var h = '<div style="text-align:center;padding-bottom:12px">';
      h += '<div style="width:80px;height:80px;border-radius:50%;background:rgba(0,255,156,.1);border:3px solid rgba(0,255,156,.3);display:flex;align-items:center;justify-content:center;margin:0 auto 10px">' + av + '</div>';
      h += '<div style="font-size:20px;font-weight:900">' + (window.escHtml?window.escHtml(u.ign||'Player'):(u.ign||'Player')) + '</div>';
      h += '<div style="font-size:12px;color:var(--txt2);margin-top:2px">FF UID: <strong style="color:var(--green)">' + (u.ffUid || '—') + '</strong></div>';
      if (u.bio) h += '<div style="font-size:12px;color:var(--txt2);margin-top:6px;font-style:italic">"' + (window.escHtml?window.escHtml(u.bio):u.bio) + '"</div>';
      h += '</div>';
      h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
      [['🎮', st.matches, 'Matches'], ['🏆', st.wins, 'Wins'], ['💀', st.kills, 'Kills']].forEach(function(d) {
        h += '<div style="text-align:center;padding:10px;background:var(--card2);border-radius:10px;border:1px solid var(--border)">';
        h += '<div style="font-size:18px">' + d[0] + '</div><div style="font-size:16px;font-weight:800">' + d[1] + '</div>';
        h += '<div style="font-size:10px;color:var(--txt2)">' + d[2] + '</div></div>';
      });
      h += '</div>';
      var wr = st.matches > 0 ? Math.round(st.wins / st.matches * 100) : 0;
      h += '<div style="padding:10px;background:rgba(0,255,156,.06);border-radius:10px;text-align:center;font-size:12px;border:1px solid rgba(0,255,156,.12)">';
      h += 'Win Rate: <strong style="color:var(--green)">' + wr + '%</strong>';
      h += '</div>';
      openModal('👤 ' + (u.ign || 'Player'), h);
    }).catch(function() { toast('Player nahi mila', 'err'); });
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
  h += '<div class="mc-top" style="' + (isHot?'padding-top:22px':'') + '"><div class="mc-head"><span class="mc-name" style="font-size:16px;font-weight:800;letter-spacing:-.2px">' + (window.escHtml ? window.escHtml(t.name || 'Match') : (t.name || 'Match')) + '</span><div class="mc-badges"><span class="badge ' + bc + '" style="background:' + modeClr + '22;color:' + modeClr + ';border:1px solid ' + modeClr + '55;font-weight:800">' + tp.toUpperCase() + '</span>';
  if (isCoin) h += '<span class="badge badge-coin">COIN</span>';
  if (isAd) h += '<span class="badge" style="background:rgba(255,159,28,.15);color:#ff9f1c;border:1px solid rgba(255,159,28,.3);font-weight:800">📺 AD FREE</span>';
  if (t.minRank) { var _rEmoji={'Bronze':'🥉','Silver':'🥈','Gold':'🥇','Platinum':'🔷','Diamond':'💎'}; h += '<span class="badge" style="background:rgba(255,215,0,.1);color:#ffd700;border:1px solid rgba(255,215,0,.25);font-weight:800">' + (_rEmoji[t.minRank]||'🏅') + ' ' + t.minRank + '+</span>'; }
  if (es === 'live') h += '<span class="badge badge-live" style="animation:hotPulse 1.5s infinite">🔴 LIVE</span>';
  h += '</div></div>';
  if (t.creatorUid) h += '<div onclick="event.stopPropagation();if(window.showCreatorProfile)showCreatorProfile(\'' + t.creatorUid + '\')" style="display:inline-flex;align-items:center;gap:4px;margin:4px 0;padding:3px 9px;border-radius:20px;background:rgba(0,255,156,.08);border:1px solid rgba(0,255,156,.2);font-size:10px;font-weight:700;color:#00ff9c;cursor:pointer">🎮 Creator Hosted</div>';
  if (es === 'live') {
    var matchStarted = t.matchTime && (window.serverNow?window.serverNow():Date.now()) >= Number(t.matchTime);
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
      /* M8 Fix: Skip boxes where prize is 0 or null — prevents showing "💎0" */
      if (!p.val || p.val <= 0) return;
      h += '<div class="mc-prize-box ' + p.cls + '">';
      h += '<div class="mc-prize-icon">' + p.icon + '</div>';
      h += '<div class="mc-prize-rank">' + p.rank + '</div>';
      /* Prize symbol based on prizeType: coin matches → 🪙, SD/paid matches → 💎 (GD) */
        var _prSym = (t.prizeType === 'coin' || t.entryType === 'coin') ? '🪙' :
                     (t.prizeType === 'sky_diamond') ? '🔷' : '💎';
        h += '<div class="mc-prize-amt">' + _prSym + p.val + '</div>';
      h += '</div>';
    });
    h += '</div>';
  }

  /* BOTTOM 3-COL ROW: Entry Fee 30% | Per Kill 30% | Time 40% — NO prize pool box */
  var perKillVal = Number(t.perKillPrize || t.perKill) || 0;
  var perKillHTML = perKillVal
    ? '<span class="kill-val"><i class="fas fa-skull" style="font-size:11px;margin-right:2px"></i>' + ((t.prizeType==='coin'||t.entryType==='coin')?'🪙':'💎') + perKillVal + '/Kill</span>'
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
  var matchActuallyStarted = t.matchTime && (window.serverNow?window.serverNow():Date.now()) >= Number(t.matchTime);

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
  try {
  var l = $('homeList'); if (!l) return;
  var f = [];
  for (var id in MT) {
    var t = MT[id];
    if (!t.maxSlots || t.maxSlots <= 0) continue;
    var es = effSt(t);
    if (es === 'cancelled') continue;
    /* Keep result-published matches visible in completed tab */
    if (es !== hSF) continue;
    /* ✅ Bug 5 Fix: isSpecial is never set as boolean; use specialType string check */
    if (t.specialType && t.specialType !== 'normal' && t.specialType !== '') continue;
    var tEntry = (t.entryType || '').toString().toLowerCase().trim();
    var wantCat = hCF.toString().toLowerCase().trim();
    var catMatch = false;
    if (wantCat === 'all') catMatch = true;
    else if (wantCat === 'coin') catMatch = (tEntry === 'coin' || Number(t.entryFee) === 0);
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
  // Trust badges row — removed per request (2026-07)
  // Feature 37: Mode Filter Chips
  if (window.renderFilterChips) topHtml += renderFilterChips();
  // Recommended widget removed

  var _newHTML = topHtml + (f.length ? f.map(mcHTML).join('') : '<div class="empty-state"><i class="fas fa-trophy"></i><p>No ' + hCF + ' matches ' + hSF + '</p></div>');
  /* ✅ FIX (live-testing, User Desktop click failure on match-card badges
     e.g. "Solo"): renderHome() fires on every realtime match update (see
     core/listeners.js) and always did a full l.innerHTML replace, even
     when the rendered content was byte-identical to what's already
     there (e.g. an update to a DIFFERENT match, or a heartbeat/no-op
     event). That constant full-DOM-replace meant any element the user
     (or a test) was mid-click on could go stale ("Element is not
     attached to the DOM") purely from bad luck in timing — same root
     cause class as the "Recently Won" banner crash fixed earlier
     (BUG L-5, insertBefore). Skipping the replace when content is
     unchanged removes the vast majority of these no-op replaces without
     needing a full virtual-DOM diff rewrite. */
  if (l.innerHTML !== _newHTML) {
    l.innerHTML = _newHTML;
  }
  /* Bug 24/68 Fix: match-timer.js wraps renderHome with debounced timer start.
     Direct call removed — match-timer.js handles this via its renderHome wrapper. */
  /* Promotional banners removed */
  // Feature 20: session match counter
  if (window._sessionMatches !== undefined) window._sessionMatches++;
  } catch(e) {
    console.error('[renderHome]', e);
    var _l = document.getElementById('homeList');
    if (_l) _l.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle" style="color:#ff6b6b"></i><p>Screen error. <a onclick="location.reload()" style="color:#00d4ff;cursor:pointer">Refresh</a></p></div>';
  }
}

/* ====== RENDER SPECIAL ====== */
function renderSP() {
  var l = $('specialList'); if (!l) return;
  var f = [];
  for (var id in MT) {
    var t = MT[id];
    /* ✅ Bug 5 Fix: check specialType string, not isSpecial boolean */
    var _st = (t.specialType || t.matchType || '').toString().toLowerCase();
    var _isSpecial = t.isSpecial === true || (_st && _st !== 'normal' && _st !== '');
    if (!_isSpecial) continue;
    /* sunday_special OR weekly maps to spType='weekly', monthly_special maps to 'monthly' */
    var st = (t.specialType || t.matchType || 'weekly').toString().toLowerCase();
    var mappedType = (st === 'sunday_special' || st === 'weekly') ? 'weekly' : 'monthly';
    if (mappedType !== spType) continue; f.push(t);
  }
  f.sort(function(a, b) { return (Number(a.matchTime) || 0) - (Number(b.matchTime) || 0); });
  var label = spType === 'weekly' ? 'Sunday Special' : 'Monthly Special';
  var _spHTML = f.length ? f.map(mcHTML).join('') : '<div class="empty-state"><i class="fas fa-crown"></i><p>No ' + label + ' matches</p></div>';
  /* ✅ FIX (live-testing): same content-diff guard as renderHome/renderMM */
  if (l.innerHTML !== _spHTML) l.innerHTML = _spHTML;
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
  list.forEach(function(t) { var mt = Number(t.matchTime); if (mt && mt > (window.serverNow?window.serverNow():Date.now()) && (!next || mt < next)) next = mt; });
  if (!next) { $('cdD').textContent = '00'; $('cdH').textContent = '00'; $('cdM').textContent = '00'; $('cdS').textContent = '00'; return; }
  function tick() {
    var diff = next - (window.serverNow?window.serverNow():Date.now());
    if (diff <= 0) { $('cdD').textContent = '00'; $('cdH').textContent = '00'; $('cdM').textContent = '00'; $('cdS').textContent = '00'; clearInterval(cdInt); return; }
    $('cdD').textContent = String(Math.floor(diff / 86400000)).padStart(2, '0');
    $('cdH').textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
    $('cdM').textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    $('cdS').textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  }
  tick(); cdInt = setInterval(tick, 1000);
}
