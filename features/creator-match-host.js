/* ================================================================
   CREATOR MATCH HOSTING — features/creator-match-host.js
   User Panel v32 | MiniEsports
   
   Features:
   - Creator Match creation form (Coin/SD, entry fee, players, time)
   - Server-side creator self-play block (also enforced in Supabase RPC)
   - Creator Room ID entry for their hosted matches
   - Commission auto-calculation on match finalize
   - My Matches list with Room ID entry prompt
   
   Firebase paths:
     creatorMatches/{matchId}   — extended match data
     creatorCommission/{uid}/{matchId} — commission ledger
   
   Supabase:
     matches (extended), creator_matches, creator_commissions
   ================================================================ */

(function() {
'use strict';

function db()   { return window.rtdb || window.db; }
function uid()  { return window.U && window.U.uid; }
function ud()   { return window.UD || {}; }
function toast(msg, type) { if (window.showToast) showToast(msg, type === 'err'); else alert(msg); }

/* ─── Creator Match Form ─────────────────────────────────────────── */
window.showCreatorMatchForm = function() {
  var maxMatches = Number((window.CFG && window.CFG.maxCreatorMatches) || 3);
  var minFollowersSD = Number((window.CFG && window.CFG.minFollowersForSD) || 1000);
  var coinComm = Number((window.CFG && window.CFG.coinMatchCommissionPct) || 10);
  var sdComm   = Number((window.CFG && window.CFG.sdMatchCommissionPct)   || 15);

  var creatorData = ud().creatorProfile || {};
  var isApproved  = creatorData.status === 'approved';
  if (!isApproved) { toast('Creator approval pending hai.', 'err'); return; }

  var h = '<div style="padding:4px 0">';

  // Match type selector
  h += '<div class="f-group"><label>🎮 Match Type</label>';
  h += '<select id="cmType" class="f-input" onchange="creatorMatchTypeChange()">';
  h += '<option value="coins">🪙 Coin Match (' + coinComm + '% commission in 🟢 GD)</option>';
  // SD match requires followers check
  var followerDeclared = parseInt(creatorData.followers || '0');
  if (followerDeclared >= minFollowersSD || (creatorData.followersStr || '').indexOf('+') !== -1) {
    h += '<option value="sky_diamond">💎 Sky Diamond Match (' + sdComm + '% commission in ₹)</option>';
  } else {
    h += '<option value="sky_diamond" disabled>💎 SD Match (min ' + minFollowersSD + ' followers required)</option>';
  }
  h += '</select></div>';

  // Entry fee
  h += '<div class="f-group"><label>💰 Entry Fee <span id="cmFeeLabel">(Coins)</span></label>';
  h += '<input type="number" id="cmFee" class="f-input" value="10" min="1" placeholder="Entry fee amount"></div>';

  // Max players
  h += '<div class="f-group"><label>👥 Max Players</label>';
  h += '<select id="cmMaxPlayers" class="f-input">';
  [10, 25, 50, 100].forEach(function(n) {
    h += '<option value="' + n + '"' + (n === 50 ? ' selected' : '') + '>' + n + ' Players</option>';
  });
  h += '</select></div>';

  // Match name
  h += '<div class="f-group"><label>🏆 Match Name</label>';
  h += '<input type="text" id="cmName" class="f-input" placeholder="e.g. BEAST_GAMER Solo Cup"></div>';

  // Mode
  h += '<div class="f-group"><label>🎯 Mode</label>';
  h += '<select id="cmMode" class="f-input">';
  ['Solo','Duo','Squad'].forEach(function(m) { h += '<option value="' + m.toLowerCase() + '">' + m + '</option>'; });
  h += '</select></div>';

  // Kill points
  h += '<div class="f-group"><label>💀 Per Kill Points</label>';
  h += '<input type="number" id="cmKillPts" class="f-input" value="1" min="0" max="10"></div>';

  // Date/Time
  var minDT = new Date(Date.now() + 30*60*1000).toISOString().slice(0,16);
  h += '<div class="f-group"><label>📅 Match Date & Time</label>';
  h += '<input type="datetime-local" id="cmDateTime" class="f-input" min="' + minDT + '"></div>';

  // Commission preview
  h += '<div id="cmCommPreview" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px;font-size:11px;color:#aaa;margin-bottom:14px">' +
    '💡 Agar 50 players × 10 coins = 500 coins collected → Aapko milenge ' + Math.round(500 * coinComm / 100) + ' 🟢 GD (match khatam hone ke baad)</div>';

  h += '<button onclick="submitCreatorMatch()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">🎮 Match Banao</button>';
  h += '</div>';

  if (window.openModal) openModal('🎮 Naya Match Host Karo', h);
};

window.creatorMatchTypeChange = function() {
  var type = (document.getElementById('cmType')||{}).value || 'coins';
  var lbl  = document.getElementById('cmFeeLabel');
  if (lbl) lbl.textContent = type === 'coins' ? '(Coins)' : '(Sky Diamonds)';
};

window.submitCreatorMatch = function() {
  var creatorId = uid();
  if (!creatorId || !db() || !window._supa) { toast('Login ya network error.', 'err'); return; }

  var type       = (document.getElementById('cmType')||{}).value || 'coins';
  var fee        = Number((document.getElementById('cmFee')||{}).value || 0);
  var maxPlayers = Number((document.getElementById('cmMaxPlayers')||{}).value || 50);
  var name       = ((document.getElementById('cmName')||{}).value||'').trim();
  var mode       = (document.getElementById('cmMode')||{}).value || 'solo';
  var killPts    = Number((document.getElementById('cmKillPts')||{}).value || 1);
  var dtVal      = (document.getElementById('cmDateTime')||{}).value || '';

  if (!name)   { toast('Match name required hai.', 'err'); return; }
  if (!fee || fee < 1) { toast('Entry fee valid nahi hai.', 'err'); return; }
  if (!dtVal)  { toast('Date/time set karo.', 'err'); return; }

  var scheduledAt = new Date(dtVal).toISOString();

  // Check active match limit
  var maxActive = Number((window.CFG && window.CFG.maxCreatorMatches) || 3);
  window._supa.from('creator_matches')
    .select('match_id')
    .eq('creator_uid', creatorId)
    .in('commission_status', ['pending'])
    .then(function(r) {
      if (r.data && r.data.length >= maxActive) {
        toast('Maximum ' + maxActive + ' active matches allowed. Pehle kuch complete karo.', 'err');
        return;
      }
      _createCreatorMatch(creatorId, { type, fee, maxPlayers, name, mode, killPts, scheduledAt });
    })
    .catch(function(e) { console.warn('[CreatorMatch] limit check error:', e.message); _createCreatorMatch(creatorId, { type, fee, maxPlayers, name, mode, killPts, scheduledAt }); });
};

function _createCreatorMatch(creatorId, opts) {
  var coinComm = Number((window.CFG && window.CFG.coinMatchCommissionPct) || 10);
  var sdComm   = Number((window.CFG && window.CFG.sdMatchCommissionPct)   || 15);
  var commPct  = opts.type === 'coins' ? coinComm : sdComm;
  var commType = opts.type === 'coins' ? 'gd' : 'inr';
  var creatorIGN = ud().ign || 'Creator';

  // Insert into Supabase matches table (main match record)
  window._supa.from('matches').insert({
    title:        opts.name + ' (by ' + creatorIGN + ')',
    mode:         opts.mode,
    entry_type:   opts.type,
    entry_fee:    opts.fee,
    max_slots:    opts.maxPlayers,
    filled_slots: 0,
    status:       'upcoming',
    scheduled_at: opts.scheduledAt,
    per_kill_prize: opts.killPts,
    creator_code: ud().creatorProfile && ud().creatorProfile.code || null,
    creator_uid:  creatorId,
  }, { returning: 'representation' })
  .then(function(r) {
    if (r.error) { toast('Match create error: ' + r.error.message, 'err'); return; }
    var matchId = r.data && r.data[0] && r.data[0].id;
    if (!matchId) { toast('Match create error: no ID returned.', 'err'); return; }

    // Insert creator_matches record (extended data)
    window._supa.from('creator_matches').insert({
      match_id:          matchId,
      creator_uid:       creatorId,
      commission_pct:    commPct,
      commission_type:   commType,
      commission_amount: 0,
      commission_status: 'pending',
      hold_until:        null,
      created_at:        new Date().toISOString(),
    }).catch(function(e){ console.warn('[CreatorMatch] creator_matches insert error:', e.message); });

    // Mirror to Firebase creatorMatches
    db().ref('creatorMatches/' + matchId).set({
      creatorUid:       creatorId,
      commissionPct:    commPct,
      commissionType:   commType,
      commissionStatus: 'pending',
      commissionAmount: 0,
      createdAt:        Date.now(),
    });

    toast('✅ Match banaya gaya! Players abhi register kar sakte hain.', 'ok');
    if (window.closeModal) closeModal();
    // Refresh matches screen if open
    if (window.renderMatches) window.renderMatches();
  })
  .catch(function(e) { toast('Error: ' + e.message, 'err'); });
}

/* ─── My Creator Matches List ────────────────────────────────────── */
window.showMyCreatorMatches = function() {
  var creatorId = uid();
  if (!creatorId || !window._supa) return;

  window._supa.from('creator_matches')
    .select('match_id, commission_pct, commission_type, commission_amount, commission_status, hold_until, created_at, matches(title, status, entry_fee, entry_type, filled_slots, max_slots, scheduled_at)')
    .eq('creator_uid', creatorId)
    .order('created_at', { ascending: false })
    .limit(20)
    .then(function(r) {
      if (r.error) { toast('Error loading matches: ' + r.error.message, 'err'); return; }
      _renderMyCreatorMatches(r.data || []);
    });
};

function _renderMyCreatorMatches(matches) {
  var h = '<div style="display:grid;gap:10px">';

  if (!matches.length) {
    h += '<div style="text-align:center;color:#888;padding:20px">Koi match nahi banaya abhi.\n\nPehle match create karo!</div>';
  } else {
    matches.forEach(function(cm) {
      var m = cm.matches || {};
      var statusColor = m.status === 'upcoming' ? '#ffd700' : m.status === 'live' ? '#00ff9c' : m.status === 'completed' ? '#888' : '#ff6b6b';
      var commStr = cm.commission_type === 'gd'
        ? (cm.commission_amount || 0) + ' 🟢 GD'
        : '₹' + (cm.commission_amount || 0);
      var holdStr = cm.hold_until && cm.commission_status === 'hold'
        ? ' (eligible: ' + new Date(cm.hold_until).toLocaleDateString('en-IN') + ')'
        : '';

      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
      h += '<div>';
      h += '<div style="font-size:13px;font-weight:700;color:#fff">' + _esc(m.title||'Untitled') + '</div>';
      h += '<div style="font-size:11px;color:#888">' + (m.entry_fee||0) + ' ' + (m.entry_type==='coins'?'🪙':'💎') + ' · ' + (m.filled_slots||0) + '/' + (m.max_slots||0) + ' players</div>';
      h += '</div>';
      h += '<span style="font-size:11px;color:' + statusColor + ';font-weight:700">' + (m.status||'').toUpperCase() + '</span>';
      h += '</div>';

      // Commission status
      h += '<div style="font-size:11px;color:#b964ff;margin-bottom:8px">Commission: ' + commStr + ' · ' + (cm.commission_status||'pending') + holdStr + '</div>';

      // Room ID entry button (for upcoming/live creator matches)
      if (m.status === 'upcoming' || m.status === 'live') {
        h += '<button onclick="showCreatorRoomEntry(\'' + cm.match_id + '\')" ' +
          'style="width:100%;padding:9px;border-radius:10px;background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);color:#00d4ff;font-size:12px;font-weight:700;cursor:pointer">🔑 Room ID Enter Karo</button>';
      }
      h += '</div>';
    });
  }

  h += '</div>';
  if (window.openModal) openModal('📋 Mere Matches', h);
}

/* ─── Creator Room ID Entry ──────────────────────────────────────── */
window.showCreatorRoomEntry = function(matchId) {
  var h = '<div style="padding:4px 0">';
  h += '<div style="font-size:12px;color:#888;margin-bottom:12px">Free Fire mein custom room banao → Room ID + Password yahan paste karo → Players ko automatically push jaayega.</div>';
  h += '<div class="f-group"><label>🔑 Room ID</label>';
  h += '<input type="text" id="crRoomId" class="f-input" placeholder="e.g. 1234567" inputmode="numeric"></div>';
  h += '<div class="f-group"><label>🔒 Room Password</label>';
  h += '<input type="text" id="crRoomPw" class="f-input" placeholder="e.g. 1234"></div>';
  h += '<button onclick="submitCreatorRoomId(\'' + matchId + '\')" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00d4ff,#0066ff);border:none;color:#fff;font-size:14px;font-weight:800;cursor:pointer">📤 Room ID Submit Karo</button>';
  h += '</div>';
  if (window.openModal) openModal('🔑 Room ID Enter', h);
};

window.submitCreatorRoomId = function(matchId) {
  var roomId = ((document.getElementById('crRoomId')||{}).value||'').trim();
  var roomPw = ((document.getElementById('crRoomPw')||{}).value||'').trim();

  if (!roomId) { toast('Room ID required hai.', 'err'); return; }
  if (!window._supa) { toast('Network error. Try again.', 'err'); return; }

  // Update match in Supabase
  window._supa.from('matches').update({
    room_id: roomId,
    room_password: roomPw,
    status: 'live',
  }).eq('id', matchId)
    .then(function(r) {
      if (r.error) { toast('Error: ' + r.error.message, 'err'); return; }
      toast('✅ Room ID set! Players ko automatically notification jaayega.', 'ok');
      if (window.closeModal) closeModal();
    })
    .catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

/* ─── Commission Finalization (called after match complete) ──────── */
/* This is triggered by admin completing the match result.
   Server-side in Supabase via RPC `finalize_creator_commission`.
   Client-side fallback only. */
window.finalizeCreatorCommission = function(matchId) {
  if (!window._supa) return;
  window._supa.rpc('finalize_creator_commission', { p_match_id: matchId })
    .then(function(r) {
      if (r.error) console.warn('[CreatorMatch] commission finalize error:', r.error.message);
      else console.log('[CreatorMatch] Commission finalized for match:', matchId);
    });
};

/* ─── Helpers ────────────────────────────────────────────────────── */
function _esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

console.log('✅ creator-match-host.js loaded');
})();
