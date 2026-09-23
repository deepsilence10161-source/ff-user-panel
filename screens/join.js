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
    var rankOrder = { 'Bronze':1, 'Silver':2, 'Gold':3, 'Platinum':4, 'Diamond':5, 'Heroic':6, 'Legend':7, 'Grandmaster':8 };
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
  var entryTypeRaw = (t.entryType || '').toString().toLowerCase();
  var isCoin   = entryTypeRaw === 'coin' || entryTypeRaw === 'coins';
  var isSkyDia = entryTypeRaw === 'paid' || entryTypeRaw === 'sky' || entryTypeRaw === 'skydiamond' || entryTypeRaw === 'sd';
  var isAd     = entryTypeRaw === 'ad'   || entryTypeRaw === 'ads' || entryTypeRaw === 'adwatch';
  var fee      = Number(t.entryFee) || 0;
  var isFree   = entryTypeRaw === 'free' || (!isCoin && !isSkyDia && !isAd && fee === 0);
  /* ✅ BUG FIX: was using UD.realMoney.deposited (Firebase/old) — now uses UD.skyDiamonds (Supabase) */
  var bal = isCoin ? (UD.coins || 0) : isSkyDia ? (UD.skyDiamonds || 0) : 0;
  var enough = fee === 0 || bal >= fee;
  var slotsNeeded = tp === 'duo' ? 2 : tp === 'squad' ? 4 : 1;
  /* Prize info based on match type */
  // Correct 3-currency model: Ad→Coins, Coin→SkyDia, Paid→GreenDia
  /* ✅ FIX: Coin match prize = Coins (was wrongly showing Sky Diamonds) */
  var prizeLabel = isFree ? '🆓 Free entry — small coin reward'
    : isAd   ? '📺 Watch ads to join'
    : isCoin ? '🪙 Coins — Top 3 jeetenge'
    : isSkyDia ? '<img src="js/green-diamond.png" style="width:13px;height:13px;vertical-align:middle;object-fit:contain"> Green Diamond — Top 3 jeetenge'
    : '🪙 Coins';
  var feeLabel = isCoin ? '🪙 ' + fee + ' Coins' : isSkyDia ? '💎 ' + fee + ' Sky Diamonds' : 'FREE';
  var balLabel = isCoin ? '🪙 ' + bal + ' Coins' : isSkyDia ? '💎 ' + bal + ' Sky Diamonds' : '';
  var h = '<div class="confirm-info">';
  h += '<div class="ci-row"><span class="cl">Match</span><span class="cv">' + (window.escHtml?window.escHtml(t.name||'Match'):(t.name||'Match')) + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Mode</span><span class="cv">' + tp.toUpperCase() + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Entry Fee</span><span class="cv">' + feeLabel + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Slots Needed</span><span class="cv">' + slotsNeeded + '</span></div>';
  if (balLabel) h += '<div class="ci-row"><span class="cl">Your Balance</span><span class="cv" style="color:' + (enough ? 'var(--green)' : 'var(--red)') + '">' + balLabel + '</span></div>';
  h += '<div class="ci-row"><span class="cl">Winner Gets</span><span class="cv" style="color:#00ff9c">' + prizeLabel + '</span></div>';
  h += '</div>';
  /* Withdrawal info */
  h += '<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.18);border-radius:10px;padding:9px 12px;margin-bottom:10px;font-size:11px;color:#00d4ff;line-height:1.5">';
  h += '💡 Green Diamonds sirf rank aur badges ke liye hain — withdraw nahi hota. Sky Diamonds se paid matches khelo.';
  h += '</div>';
  if (UD.ign && UD.ffUid) h += '<div class="ci-locked"><i class="fas fa-lock"></i> Playing as: <strong>' + (window.escHtml?window.escHtml(UD.ign):UD.ign) + '</strong> (UID: ' + UD.ffUid + ')</div>';

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
  _findUserByFF(uid, function(foundKey, found) {
    if (found && foundKey) {
      st.innerHTML = '<span class="pf-ok">✓ Found</span>';
      if (nm) nm.textContent = found.ign || found.displayName || 'Player';
      partnerCache[n] = found;
      partnerCache[n]._fbUid = foundKey;
    } else { st.innerHTML = '<span class="pf-err">✗ Not found</span>'; if (nm) nm.textContent = ''; delete partnerCache[n]; }
  });
}

/* ── Bug 10 Fix: Global join processing flag — prevents rapid double-clicks ── */
var _joinInFlight = false;
window._jifTimer = null;

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

/* Bug #18 Fix: Session-level join dedup — blocks duplicate joins if lock releases early */
var _sessionJoinedMatches = {};

/* ✅ R5: server-authoritative team payload builder — captain + partners as
   SUPABASE UIDs (users.id). Server join_match_team team[0].uid === auth.uid()
   verify karta hai; partners की fee/eligibility server derive karta hai.
   Client sirf ids चुनता है, kabhi amount/currency नहीं। */
function _teamPayload(tp, cb) {
  var need = tp === 'duo' ? 1 : (tp === 'squad' ? 3 : 0);
  var team = [{ uid: U.uid, ign: (UD && UD.ign) || '' }];
  if (need === 0) { cb(team); return; }
  var parts = [];
  for (var i = 1; i <= need; i++) { if (partnerCache[i]) parts.push(partnerCache[i]); }
  if (parts.length !== need) { cb(null); return; }
  var resolved = false;
  var out = team.slice();
  var done = 0;
  function finish() {
    if (resolved) return;
    if (done === need) { resolved = true; cb(out); }
  }
  parts.forEach(function(p) {
    function pushResolved(uid) {
      if (resolved) return;
      if (!uid) { resolved = true; cb(null); return; }
      out.push({ uid: uid, ign: (p.ign || p.displayName || '') });
      done++;
      finish();
    }
    if (p._fbUid) { pushResolved(p._fbUid); }
    else if (p.ffUid) { window._findUserByFF(p.ffUid, function(k) { pushResolved(k); }); }
    else { pushResolved(null); }
  });
}

/* ✅ R5: Firebase MIRROR-only team rows (server success के बाद; admin roster/
   realtime display के लिए — कभी authority नहीं)। Supabase join_requests ही
   सच है; ये sirf दृश्य-कॉपी हैं, financial/authoritative write नहीं। */
function _mirrorTeamFirebase(id, tp, teamArr, jid, t, assignedSlots) {
  if (!teamArr || teamArr.length < 2) return;
  var _feeType = window._feeType || 'captain_pays';
  var entryType = (t.entryType || '').toString().toLowerCase();
  var isCoin = entryType === 'coin' || entryType === 'coins';
  var isSkyDia = entryType === 'paid' || entryType === 'sky' || entryType === 'skydiamond' || entryType === 'sd';
  var isAdT = entryType === 'ad' || entryType === 'ads';
  var fee = Number(t.entryFee) || 0;
  for (var i = 1; i < teamArr.length; i++) {
    var m = teamArr[i];
    var pEntryFee = (_feeType === 'each_pays') ? fee : 0;
    var pSlot = assignedSlots ? (assignedSlots[i] || assignedSlots[0]) : null;
    var pjid = db.ref('joinRequests').push().key;
    db.ref('joinRequests/' + pjid).set({
      requestId: pjid, userId: m.uid, userName: m.ign || '',
      userFFUID: m.ffUid || '', displayName: m.ign || '',
      matchId: id, matchName: t.name || '', entryFee: pEntryFee,
      entryType: isCoin ? 'coin' : isSkyDia ? 'sky_diamond' : isAdT ? 'ad' : 'free',
      mode: tp, status: 'joined', slotsBooked: 0,
      teamMembers: JSON.stringify(teamArr.map(function(x){ return { uid: x.ffUid || x.uid, name: x.ign || '' }; })),
      captainUid: U.uid, captainName: (UD && UD.ign) || '',
      slotNumber: pSlot || null, allSlots: assignedSlots || null,
      feeType: _feeType, isTeamMember: true, createdAt: Date.now()
    });
    /* Firebase-only partner notification (display) */
    var notifId = db.ref('users/' + m.uid + '/notifications').push().key;
    db.ref('users/' + m.uid + '/notifications/' + notifId).set({
      type: 'team_joined', title: '🎮 Match Joined!',
      body: (UD.ign || 'Captain') + ' ne team join kiya — "' + (t.name || 'match') + '". ' +
            ((_feeType === 'each_pays' && pEntryFee > 0) ? 'Entry fee tumhare wallet se kati gai.' : 'Captain ne fee di hai.'),
      matchId: id, read: false, createdAt: Date.now()
    });
  }
  /* captain mirror already written by caller (_joinData path) */
  void jid;

  /* saved-team persistence (next-join UX; non-financial social metadata).
     Security: display-only, bridge user-scoped, Supabase से ख़ुद भी कुछ नहीं गिराता। */
  try {
    if (tp === 'duo' && teamArr[1]) {
      localStorage.setItem('lastDuoPartner', JSON.stringify({ uid: teamArr[1].ffUid || teamArr[1].uid, name: teamArr[1].ign || '' }));
      db.ref('users/' + U.uid + '/duoTeam').set({ memberUid: teamArr[1].uid, memberFfUid: teamArr[1].ffUid || '', memberName: teamArr[1].ign || '', addedAt: Date.now() });
    }
    if (tp === 'squad') {
      var sq = teamArr.slice(1).map(function(m){ return { uid: m.uid, ffUid: m.ffUid || '', name: m.ign || '' }; });
      var saved = sq.map(function(m){ return { uid: m.ffUid || m.uid, name: m.name }; });
      localStorage.setItem('lastSquadPartners', JSON.stringify(saved));
      db.ref('users/' + U.uid + '/squadTeam').set({ members: sq, updatedAt: Date.now() });
    }
  } catch(e) {}
}

async function _doJoinCore(id, t, tp) {
  /* ✅ Bug 10 Fix: Prevent rapid double-clicks / duplicate join requests */
  if (_joinInFlight) {
    toast('⏳ Join processing... please wait', 'inf');
    return;
  }
  _joinInFlight = true;
  /* Auto-release after 8 seconds in case of error/timeout */
  /* Bug #18 Fix: 8s→30s prevents premature lock release on slow networks */
  var _jifTimer = setTimeout(function() { _joinInFlight = false; }, 30000);
  /* Also check if user already has a pending joinRequest for this match */
  var _existingJR = Object.values(JR || {}).find(function(jr) {
    return jr.matchId === id && (jr.status === 'pending' || jr.status === 'approved' || jr.status === 'joined');
  });
  if (_existingJR) {
    clearTimeout(_jifTimer); _joinInFlight = false;
    toast('✅ Aap is match mein already join ho chuke ho!', 'inf');
    return;
  }
  /* ✅ FIX: free matches (entryFee=0) must NOT be treated as coin matches */
  var _et2   = (t.entryType || '').toString().toLowerCase();
  var isCoin  = _et2 === 'coin' || _et2 === 'coins';
  var isSkyDia= _et2 === 'paid' || _et2 === 'sky' || _et2 === 'skydiamond' || _et2 === 'sd' || _et2 === 'sky_diamond';
  var isAd    = _et2 === 'ad'   || _et2 === 'ads';
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
  /* ✅ R5: PRE-BOOKING REMOVED — pehle client yahan `joinedSlots`/`filledSlots`
     Firebase transaction chala kar slots book karta tha (server fills se
     pehle hi capacity modify). Ab SINGLE authority = server: slots server
     validate_and_join_match / join_match_team ke ANDAR atomic bharte hain
     (उसी से capacity enforce hoti hai). Yahan sirf DISPLAY-ONLY slot labels
     bante hain (asali slot room/manager server ke result se). */
  var _serverFilled = Number(t.filledSlots || t.joinedSlots || 0);
  var firstSlotNum = _serverFilled + 1;
  var assignedSlots = [];
  if (tp === 'solo') {
    assignedSlots = [String(firstSlotNum)];
  } else if (tp === 'duo') {
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
    /* Bug High #7 Fix: Calculate per-player fee correctly based on selected split mode.
       captain_pays → captain pays full fee × slotsNeeded (already correct)
       each_pays    → captain pays only 1× fee; each member pays their own share
       The RPC and join_requests row now receive fee_split so the backend can
       charge each team member individually when each_pays is selected. */
    var _perPlayerFee = (_feeType === 'each_pays' && tp !== 'solo') ? fee : fee * slotsNeeded;
    // captain always pays their own share = fee; extra members pay separately
    var _captainFee = (_feeType === 'captain_pays') ? fee * slotsNeeded : fee;

    /* ✅ Bug 23 Fix: Use server-side atomic validate_and_join_match RPC
       This prevents client-side JS bypass of entry fee deduction.
       RPC handles: balance check, duplicate join check, deduction, JR creation atomically */
    var _supaCol = isCoin ? 'coins' : 'sky_diamonds';
    var _joinData = {
      requestId: jid, userName: UD.ign || '', userFFUID: UD.ffUid || '',
      /* ✅ R28m FIX (2026-09-22): server RPC validate_and_join_match
         ign_at_join = COALESCE(p_join_data->>'ign','') लिखता है — par ye
         _joinData kabhi `ign` key bhejti hi nahi thi (sirf userName), isliye
         har paid join me ign_at_join DB me KHALI reh jata tha (live proven:
         5 coin rows sab ''). Ab wahi key server chahta hai wahi bhej rahe hain. */
      ign: UD.ign || '', displayName: UD.displayName || '', userEmail: UD.email || '',
      matchName: t.name || '', mode: tp, slotsBooked: slotsNeeded,
      teamMembers: JSON.stringify(team || []), slotNumber: mySlot,
      allSlots: JSON.stringify(assignedSlots || []),
      captainUid: tp !== 'solo' ? U.uid : null,
      feeType: _feeType,          // 'captain_pays' | 'each_pays' | 'solo'
      perPlayerFee: _perPlayerFee, // Bug High #7 Fix: actual amount each player owes
      isTeamMember: false, createdAt: Date.now()
    };

    /* ✅ R5 FIX: SINGLE SERVER-AUTHORITATIVE JOIN — solo→validate_and_join_match,
       duo/squad→join_match_team. Client sirf ids/एक request bhejता है; fee,
       currency, eligibility, capacity, debit सब server atomic. NO fallback:
       RPC fail = join fail. Firebase sirf success ke baad mirror. */
    if (!window._supa || !window._supaReady) {
      clearTimeout(_jifTimer); _joinInFlight = false;
      setLoading(null, false);
      toast('❌ Service unavailable — join nahi ho paya.', 'err');
      return;
    }
    var _freeJoinData = Object.assign({
      requestId: jid, userId: U.uid, matchId: id,
      entryFee: 0, entryType: 'free', status: 'joined', createdAt: Date.now()
    }, _joinData);

    function _mirrorCaptain() {
      db.ref('joinRequests/' + jid).set(Object.assign({
        requestId: jid, userId: U.uid, matchId: id,
        entryFee: _captainFee,
        entryType: isCoin ? 'coin' : isSkyDia ? 'sky_diamond' : isAd ? 'ad' : 'free',
        status: 'joined', createdAt: Date.now()
      }, _joinData));
    }

    function _joinFailed(err) {
      clearTimeout(_jifTimer); _joinInFlight = false;
      setLoading(null, false);
      var msg = (err && err.message) || (err == null ? 'Join failed' : String(err));
      if (msg === 'Aap already join ho chuke ho') toast('✅ Aap is match mein already join ho chuke ho!', 'inf');
      else toast('❌ ' + msg, 'err');
    }

    if (tp === 'solo') {
      window._supa.rpc('validate_and_join_match', {
        p_uid: U.uid, p_match_id: id,
        p_entry_fee: _captainFee, p_currency: _supaCol,
        p_join_data: _joinData
      }).then(function(r) {
        if (r && r.error) { _joinFailed(r.error); return; }
        if (r && r.data && r.data.ok === false) { _joinFailed(r.data.error); return; }
        if (_captainFee > 0) {
          if (isCoin) UD.coins = Math.max((UD.coins||0) - _captainFee, 0);
          else { UD.skyDiamonds = Math.max((UD.skyDiamonds||0)-_captainFee,0); if(UD.realMoney) UD.realMoney.deposited = Math.max((UD.realMoney.deposited||0)-_captainFee,0); }
        }
        _mirrorCaptain();
        _afterJoinSuccess(id, t, tp, jid, assignedSlots);
      }).catch(function(e) { _joinFailed(e); });
      return;
    }

    /* duo/squad → join_match_team (server validates team, locks ALL rows,
       verifies sab ki balance, atomic debit, no partial payment) */
    _teamPayload(tp, function(teamArr) {
      if (!teamArr) {
        clearTimeout(_jifTimer); _joinInFlight = false;
        setLoading(null, false);
        toast('❌ Team members verify nahi huye — dobara check karo', 'err');
        return;
      }
      window._supa.rpc('join_match_team', {
        p_match_id: id, p_mode: tp,
        p_fee_type: (window._feeType || 'captain_pays'),
        p_team: teamArr
      }).then(function(r) {
        if (r && r.error) { _joinFailed(r.error); return; }
        if (r && r.data && r.data.ok === false) { _joinFailed(r.data.error); return; }
        var _myFee = (window._feeType === 'each_pays') ? fee : (_captainFee || fee * (tp === 'duo' ? 2 : 4));
        if (isCoin) UD.coins = Math.max((UD.coins||0) - _myFee, 0);
        else if (isSkyDia) UD.skyDiamonds = Math.max((UD.skyDiamonds||0) - _myFee, 0);
        if (UD.realMoney && isSkyDia) UD.realMoney.deposited = Math.max((UD.realMoney.deposited||0) - _myFee, 0);
        _mirrorCaptain();
        /* partner rows: Firebase mirror only (admin roster display) — Supabase
           join_requests already has authoritative rows (server ne banaye) */
        _mirrorTeamFirebase(id, tp, teamArr, jid, t, assignedSlots);
        _afterJoinSuccess(id, t, tp, jid, assignedSlots);
      }).catch(function(e) { _joinFailed(e); });
    });
    return;
}

function deductMoney(amt, reason) {
  /* ✅ R5 (2026-09-23): relinquished global legacy helper — old (pre-R5)
     गिफ्ट flows ab server RPC gift_match_entry से atomic हैं, और team
     से join अब join_match_team से server-authoritative है. Yे helper ab
     koi caller nahi rakhta (grep-verified: sirf legacy fixes-v7 gift था,
     जो R5 में inert). Purani direct client-payment logic HATA DI (double-
     debit/unsafe-path band) — ab sirf no-op placeholder, koi financial write
     nahi. */
  console.warn('[deductMoney] legacy helper (no-op) — server RPC use karo');
}

/* ── _afterJoinSuccess — called after join RPC/DB write confirmed ── */
function _afterJoinSuccess(id, t, tp, jid, assignedSlots) {
  clearTimeout(window._jifTimer);
  _joinInFlight = false;
  closeModal();
  partnerCache = {};
  toast('🎮 Joined successfully! Room ID match time pe milega.', 'ok');
  _sessionJoinedMatches[U.uid + '_' + id] = true; /* Bug #18 dedup mark — R28b: uid→U.uid ("uid is not defined" fix) */
  /* Update local JR cache immediately so hasJ() works without reload */
  if (!window.JR) window.JR = {};
  JR[jid] = { matchId: id, userId: U.uid, status: 'joined', mode: tp, createdAt: Date.now() };
  /* ✅ BUG FIX (2026-09-16): "Match join karne ke baad match section me
     show hi nahi ho raha, join button bhi joined nahi dikh raha, refresh
     karne par hi sahi dikhta hai" — JR[jid] above already makes hasJ(id)
     return true immediately, and the join count (t.joinedSlots) was also
     already bumped by the caller before _afterJoinSuccess runs — but
     nothing ever re-rendered the Home screen itself to actually reflect
     it. Only renderMM() (My Matches tab) was re-rendered, 500ms later.
     If the user was looking at Home (the normal case — that's where the
     Join button lives), the card there kept showing the stale pre-join
     state until the 15s poll/realtime event happened to land, or until
     they manually refreshed. Re-rendering both screens here — Home
     immediately (data is already correct in memory) and My Matches
     shortly after (unchanged timing/reason) — fixes this for whichever
     screen the user is actually on. curScr check avoids wastefully
     re-rendering a screen that isn't even mounted. */
  if (curScr === 'home' && window.renderHome) renderHome();
  if (window.renderSponsoredTournaments) renderSponsoredTournaments();
  /* Refresh My Matches tab */
  if (window.renderMM) setTimeout(renderMM, 500);
  /* Analytics */
  if (window.analytics && window.analytics.joinMatch) {
    analytics.joinMatch(id, t.entryFee || 0, t.entryType || 'free');
  }
  /* logActivity for activity feed */
  if (window.logActivity) logActivity('join', 'Joined match: ' + (t.name || 'Match'));
}

/* ── setLoading — show/hide loading state on join button ── */
function setLoading(btn, on) {
  var b = btn || document.getElementById('confirmJoinBtn');
  if (!b) return;
  b.disabled = on;
  b.textContent = on ? '⏳ Processing...' : 'Confirm Join';
}

