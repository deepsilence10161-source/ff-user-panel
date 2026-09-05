/* ====== REFUND SYSTEM ====== */
function checkRefunds() {
  for (var k in JR) {
    var jr = JR[k]; if (jr.refunded) continue;
    /* ✅ Bug 8 Fix: Only refund entries that belong to current user */
    if (!jr.userId || jr.userId !== (window.U && window.U.uid)) continue;
    var t = MT[jr.matchId]; if (!t) continue;
    var st = (t.status || '').toString().toLowerCase().trim();
    if (st === 'cancelled' || st === 'canceled') {
      var fee = Number(jr.entryFee) || 0; if (fee <= 0) continue;
      var _isCoin = jr.entryType === 'coin';
      /* ✅ SINGLE refund — Supabase RPC only (no db.ref to avoid double-hit via bridge) */
      if (window._supa && U) {
        var _refCol = _isCoin ? 'coins' : 'sky_diamonds';
        var _jrKey = k; /* capture for closure */
        var _jrFee = fee;
        var _jrCoin = _isCoin;
        window._supa.rpc('increment_balance', { p_uid: U.uid, p_col: _refCol, p_amount: _jrFee })
          .then(function(res) {
            if (!res || !res.data || res.data.success === false) return;
            /* Mark refunded AFTER RPC confirms success */
            window._supa.from('join_requests').update({ status: 'refunded' }).eq('id', _jrKey).then(null, function(){});
            window._supa.from('wallet_transactions').insert({
              user_id: U.uid, currency: _refCol, txn_type: 'credit',
              amount: _jrFee, reason: 'match_refund', ref_id: jr.matchId
            }).then(null, function(){});
            /* Update local UD ONLY after RPC confirms — prevents out-of-sync */
            if (window.UD) {
              if (_jrCoin) { window.UD.coins = (window.UD.coins || 0) + _jrFee; }
              else { window.UD.sky_diamonds = (window.UD.sky_diamonds || 0) + _jrFee; }
              if (window.updateHdr) window.updateHdr();
            }
            JR[_jrKey].refunded = true;
            toast('💎 ' + _jrFee + ' refund mila cancelled match ka!', 'ok');
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
              /* Verified — show room */
              _showRPWithTimeCheck(t, forceShow, mid);
            }
          }).catch(function() {});
      }
      return; /* Do not reveal room until verified */
    }
  }
  _showRPWithTimeCheck(t, forceShow, mid);
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
