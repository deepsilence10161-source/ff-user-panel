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
  var isCoin = entryTypeRaw === 'coin';
  var isSkyDia = entryTypeRaw === 'paid' || entryTypeRaw === 'diamond' || entryTypeRaw === 'sky';
  var fee = Number(t.entryFee) || 0;
  var bal = isCoin ? (UD.coins || 0) : isSkyDia ? (Number((UD.realMoney||{}).deposited)||0) : 0;
  var enough = fee === 0 || bal >= fee;
  var slotsNeeded = tp === 'duo' ? 2 : tp === 'squad' ? 4 : 1;
  /* Prize info based on match type */
  // Correct 3-currency model: Ad→Coins, Coin→SkyDia, Paid→GreenDia
  var prizeLabel = isCoin ? '💎 Sky Diamonds' : isSkyDia ? '<img src="js/green-diamond.png" style="width:13px;height:13px;vertical-align:middle"> Green Diamond (rank/badge)' : '🪙 Coins';
  var feeLabel = isCoin ? '🪙 ' + fee + ' Coins' : isSkyDia ? '💎 ' + fee + ' Sky Diamonds' : 'FREE';
  var balLabel = isCoin ? '🪙 ' + bal + ' Coins' : isSkyDia ? '💎 ' + bal + ' Sky Diamonds' : '';
  var h = '<div class="confirm-info">';
  h += '<div class="ci-row"><span class="cl">Match</span><span class="cv">' + (t.name || 'Match') + '</span></div>';
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
  _findUserByFF(uid, function(foundKey, found) {
    if (found && foundKey) {
      st.innerHTML = '<span class="pf-ok">✓ Found</span>';
      if (nm) nm.textContent = found.ign || found.displayName || 'Player';
      partnerCache[n] = found;
      partnerCache[n]._fbUid = foundKey;
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
      createdAt: Date.now()
    });
    if (isCoin) {
      db.ref('users/' + U.uid + '/coins').transaction(function(c) { return Math.max((c || 0) - _captainFee, 0); });
      db.ref('users/' + U.uid + '/coinHistory').push({ amount: -_captainFee, reason: 'Match Entry: ' + (t.name || 'Match') + (_feeType==='captain_pays'&&tp!=='solo'?' (Full team)':''), timestamp: Date.now() });
      /* ✅ Sync coins to Supabase */
      if (window.DB && window._supaReady) {
        window._supa.rpc('decrement_balance', { p_uid: U.uid, p_col: 'coins', p_amount: _captainFee }).catch(function(){});
        window._supa.from('wallet_transactions').insert({
          user_id: U.uid, currency: 'coins', txn_type: 'debit',
          amount: _captainFee, reason: 'match_entry', note: 'Match Entry: ' + (t.name || 'Match')
        }).catch(function(){});
      }
      UD.coins = Math.max((UD.coins || 0) - _captainFee, 0);
    }
    else deductMoney(_captainFee, 'Match Entry: ' + (t.name || 'Match') + (_feeType==='captain_pays'&&tp!=='solo'?' (Full team)':''));

    // ── MATCH COMMISSION — 15% to creator if match has creatorUid ──
    var _isSkyDiaPaid = (t.entryType||'').toString().toLowerCase() === 'paid';
    if (_isSkyDiaPaid && _captainFee > 0 && t.creatorUid) {
      var _commRate = (window.CFG && window.CFG.commission) || 0.15;
      var _commission = Math.floor(_captainFee * _commRate);
      if (_commission > 0) {
        db.ref('creatorStats/' + t.creatorUid + '/totalSales').transaction(function(v){ return (v||0)+1; });
        db.ref('creatorStats/' + t.creatorUid + '/totalCommission').transaction(function(v){ return (v||0)+_commission; });
        db.ref('creatorStats/' + t.creatorUid + '/pendingPayout').transaction(function(v){ return (v||0)+_commission; });
        db.ref('creatorStats/' + t.creatorUid + '/matchEarnings/' + id).transaction(function(v){ return (v||0)+_commission; });
        db.ref('users/' + t.creatorUid + '/notifications').push({
          type: 'match_commission',
          title: '🔵 Commission Mili!',
          message: '💎' + _captainFee + ' entry fee → Tumhara 15% commission: 💎' + _commission + ' (match: ' + (t.name||'Match') + ')',
          read: false, timestamp: Date.now()
        });
      }
    }

    db.ref('users/' + U.uid + '/stats/matches').transaction(function(m) { return (m || 0) + 1; });
    /* ✅ Sync stats to Supabase */
    if (window.DB && window._supaReady) {
      window._supa.rpc('increment_balance', { p_uid: U.uid, p_col: 'total_matches', p_amount: 1 }).catch(function(){});
    }
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
        createdAt: Date.now()
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
        matchId: id, read: false, createdAt: Date.now()
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
        _findUserByFF(_ffUid, function(fbKey) {
          if (true) {
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
  var newDep = dep;
  if (dep >= left) { newDep = dep - left; db.ref('users/' + U.uid + '/realMoney/deposited').set(newDep); left = 0; }
  else { left -= dep; newDep = 0; db.ref('users/' + U.uid + '/realMoney/deposited').set(0);
    if (win >= left) { db.ref('users/' + U.uid + '/realMoney/winnings').set(win - left); left = 0; }
    else { left -= win; db.ref('users/' + U.uid + '/realMoney/winnings').set(0);
      db.ref('users/' + U.uid + '/realMoney/bonus').set(Math.max(bon - left, 0)); left = 0; }
  }
  /* ✅ Sync to Supabase — sky_diamonds is source of truth */
  if (window.DB && window._supaReady) {
    var newSkyDia = Math.max((UD.skyDiamonds || 0) - amt, 0);
    window._supa.rpc('decrement_balance', { p_uid: U.uid, p_col: 'sky_diamonds', p_amount: amt }).catch(function(){});
    /* Log transaction in Supabase */
    window._supa.from('wallet_transactions').insert({
      user_id: U.uid, currency: 'sky_diamonds', txn_type: 'debit',
      amount: amt, reason: 'match_entry', note: reason || 'Entry Fee'
    }).catch(function(){});
    UD.skyDiamonds = newSkyDia;
    UD.realMoney = UD.realMoney || {};
    UD.realMoney.deposited = newSkyDia;
  }
  /* Update local UD immediately for UI consistency */
  if (UD.realMoney) UD.realMoney.deposited = Math.max((UD.realMoney.deposited || 0) - amt, 0);
  // Record in wallet transaction history
  db.ref('users/' + U.uid + '/transactions').push({
    type: 'debit', amount: -amt,
    description: reason || 'Entry Fee',
    timestamp: Date.now(), read: false
  });
  // TDS TRACKING
  if (amt > 0) { db.ref('users/' + U.uid + '/tds/entryFeesPaid').transaction(function(v) { return (v||0)+amt; }); }
}

