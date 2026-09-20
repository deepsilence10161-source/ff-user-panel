/* ====== REFUND SYSTEM ====== */
function checkRefunds() {
  for (var k in JR) {
    var jr = JR[k]; if (jr.refunded) continue;
    /* ✅ Bug 8 Fix: Only refund entries that belong to current user */
    if (!jr.userId || jr.userId !== (window.U && window.U.uid)) continue;
    var t = MT[jr.matchId]; if (!t) continue;
    var st = (t.status || '').toString().toLowerCase().trim();
    if (st === 'cancelled' || st === 'canceled') {
      /* ✅ SECURITY FIX (2026-09-08): "server-authoritative wallet
         RPC" audit found this called increment_balance() directly
         with a client-computed fee (jr.entryFee, read from this
         browser's own in-memory JR object) — a tampered JR value in
         devtools could refund any amount. Replaced with
         claim_match_refund(joinId) — the server re-derives the fee
         from the join_requests row's own entry_fee_paid column
         (written once, at join time, by validate_and_join_match) and
         re-verifies the match is genuinely cancelled — the client
         supplies only the join id, no amount at all. */
      if (window._supa && U) {
        var _jrKey = k; /* capture for closure */
        window._supa.rpc('claim_match_refund', { p_join_id: _jrKey })
          .then(function(res) {
            var d = res && res.data;
            if (!d || !d.success) return;
            /* Update local UD ONLY after RPC confirms — prevents out-of-sync */
            if (window.UD) {
              if (d.currency === 'coins') { window.UD.coins = (window.UD.coins || 0) + d.refunded; }
              else { window.UD.sky_diamonds = (window.UD.sky_diamonds || 0) + d.refunded; }
              if (window.updateHdr) window.updateHdr();
            }
            JR[_jrKey].refunded = true;
            toast('💎 ' + d.refunded + ' refund mila cancelled match ka!', 'ok');
          })
          .catch(function(){});
      }
    }
  }
}

/* ====== ROOM POPUP ====== */
/* Room ID sirf 15 min pehle se dikhao, join karte hi nahi */
function showRP(t, forceShow) {
  if (!t || !t.roomId || !t.roomPassword) return;
  /* ✅ SECURITY FIX: Only show room to users who have joined this match */
  var mid = t.id || t.matchId || t.key || '';
  if (!forceShow && mid && window.U) {
    /* First check local JR cache (fast) */
    var isJoined = false;
    for (var _k in window.JR) {
      var _jr = window.JR[_k];
      if ((_jr.matchId === mid) && (_jr.userId === window.U.uid) &&
          (_jr.status === 'approved' || _jr.status === 'joined' || _jr.status === 'pending')) {
        isJoined = true; break;
      }
    }
    if (!isJoined) {
      /* JR cache may not be loaded yet — query Supabase directly as fallback */
      if (window._supa) {
        window._supa.from('join_requests')
          .select('status')
          .eq('match_id', mid)
          .eq('user_id', window.U.uid)
          .in('status', ['pending', 'approved', 'joined'])
          .maybeSingle()
          .then(function(r) {
            if (r.data) {
              /* Verified — ab creds RPC se fetch karke show */
              _fetchRoomAndShow(t, mid, forceShow);
            }
          }).catch(function() {});
      }
      return; /* Do not reveal room until verified */
    }
  }
  /* ✅ SECURITY FIX (2026-09-20 R3): creds ab get_room_credentials() RPC se
     aate hain — server khud verify karta hai ki (a) user joined hai aur
     (b) room release-window khul chuka hai. MT ab room creds rakhta hi nahi. */
  _fetchRoomAndShow(t, mid, forceShow);
}

function _fetchRoomAndShow(t, mid, forceShow) {
  if (!window._supa) return;
  window._supa.rpc('get_room_credentials', { p_match_id: mid })
    .then(function(res) {
      var d = res && res.data;
      if (d && d.success) {
        t.roomId = d.room_id; t.roomPassword = d.room_password; /* memory-only */
        _showRPWithTimeCheck(t, forceShow, mid);
      } else if (d && d.error === 'not_released_yet') {
        toast('🔑 Room abhi release nahi hua — match start se ~5 min pehle khulega', 'warn');
      } else if (d && d.error === 'not_joined') {
        toast('Pehle is match mein join karo', 'err');
      } else if (d && d.error === 'room_not_set') {
        toast('Host ne abhi room details nahi daale', 'warn');
      }
    }).catch(function(){});
}

function _showRPWithTimeCheck(t, forceShow, mid) {
  var mt = Number(t.matchTime) || 0;
  // ✅ Bug 7 Fix: Use serverNow() for timezone-safe comparison
  var now = (window.serverNow && typeof window.serverNow === 'function') ? window.serverNow() : Date.now();
  var diff = mt - now; // positive = future, negative = past
  // 15 min = 900000ms. Only show if within 15 min window or already started (up to 2 hrs after)
  if (!forceShow && mt > 0 && diff > 900000) {
    // Match 15+ min dur hai, abhi nahi dikhao
    return;
  }
  if (!forceShow && mid && U) {
    /* ✅ localStorage only — no Firebase needed for popup tracking */
    var _lsRoomKey = '_mes_room_' + U.uid + '_' + mid;
    if (localStorage.getItem(_lsRoomKey)) return; /* Already shown */
    try { localStorage.setItem(_lsRoomKey, '1'); } catch(e) {}
    _doShowRP(t);
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

  h += '<div class="rp-box"><div class="rp-label">Room ID</div><div class="rp-value"><span>' + (window.escHtml?window.escHtml(t.roomId||''):(t.roomId||'')) + '</span><button class="rp-copy" onclick="copyTxt(\'' + (window.escHtml?window.escHtml(t.roomId||''):(t.roomId||'')) + '\')"><i class="fas fa-copy"></i></button></div></div>';
  h += '<div class="rp-box"><div class="rp-label">Password</div><div class="rp-value"><span>' + (window.escHtml?window.escHtml(t.roomPassword||''):(t.roomPassword||'')) + '</span><button class="rp-copy" onclick="copyTxt(\'' + (window.escHtml?window.escHtml(t.roomPassword||''):(t.roomPassword||'')) + '\')"><i class="fas fa-copy"></i></button></div></div>';
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
  if (!window._supa || !window._supaReady) { btn.disabled = false; toast('Service unavailable', 'err'); return; }
  window._supa.from('join_requests')
    .update({ in_room: true, in_room_at: new Date().toISOString() })
    .eq('id', jKey)
    .then(function() {
      btn.outerHTML = '<div class="inroom-confirmed"><i class="fas fa-check-circle"></i> You confirmed entering the room!</div>';
      toast('✅ Room entry confirmed! Admin will see you.', 'ok');
    }).catch(function(e) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-gamepad"></i> I\'m In Room ✅';
      toast('Error: ' + (e.message || ''), 'err');
    });
}

/* ====== WALLET ====== */
