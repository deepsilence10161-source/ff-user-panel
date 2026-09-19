/* ================================================================
   CREATOR MATCH HOSTING — features/creator-match-host.js
   Full rewrite (2026-08).

   WHY THIS EXISTS: without this, a creator's only role was "bring
   players", while Admin still had to create every match, set every
   room, and judge every result — all the actual work, none of it
   creator-side. That's backwards for a program meant to reduce
   Admin's workload. This lets an approved creator run their own
   small-stakes matches end-to-end.

   SECURITY MODEL (important — read before modifying):
   matches/join_requests RLS only allows admin writes — a creator's
   browser has ZERO direct INSERT/UPDATE access to those tables, by
   database policy, not just by this file's choices. Every action
   here goes through a SECURITY DEFINER RPC (creator_create_match /
   creator_set_room / creator_publish_result) that independently
   re-verifies: caller is an approved creator, caller owns this exact
   match, and hard limits (entry fee <= Rs 50, <=100 slots, <=3 open
   matches at once). A creator can NEVER credit real-money prizes
   directly - creator_publish_result only stages claimed kills/
   placement and flips the match to 'pending_review'; an admin still
   does the actual payout, because a host judging their own contest's
   payout is a conflict of interest no amount of client code should
   be trusted to self-police. A creator is also DB-blocked from
   joining their own hosted match (self-play block, enforced in
   validate_and_join_match).
   ================================================================ */

(function() {
'use strict';

function uid()  { return window.U && window.U.uid; }
function ud()   { return window.UD || {}; }
function toast(msg, type) { if (window.toast) window.toast(msg, type); }

/* --- Creator Match Form --- */
window.showCreatorMatchForm = function() {
  if (!ud().isCreator && !ud().is_creator) { toast('Sirf approved creators match host kar sakte hain', 'err'); return; }

  var h = '<div style="padding:4px 0">';
  h += '<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);border-radius:12px;padding:10px 12px;margin-bottom:14px;font-size:11px;color:#00ff9c;line-height:1.6">ℹ️ Chhote-stakes matches — max ₹50 entry, 100 players, 3 active matches ek waqt mein. Result submit karne ke baad Admin final payout verify karega.</div>';

  h += '<div class="f-group"><label>🏆 Match Name</label>';
  h += '<input type="text" id="cmName" class="f-input" placeholder="e.g. BEAST_GAMER Solo Cup" maxlength="60"></div>';

  h += '<div class="f-group"><label>🎮 Match Type</label>';
  h += '<select id="cmType" class="f-input">';
  h += '<option value="coins">🪙 Coin Match</option>';
  h += '<option value="sky_diamond">💎 Sky Diamond Match</option>';
  h += '</select></div>';

  h += '<div class="f-group"><label>💰 Entry Fee (max 50)</label>';
  h += '<input type="number" id="cmFee" class="f-input" value="10" min="1" max="50"></div>';

  h += '<div class="f-group"><label>👥 Max Players</label>';
  h += '<select id="cmMaxPlayers" class="f-input">';
  [10, 25, 50, 100].forEach(function(n) {
    h += '<option value="' + n + '"' + (n === 25 ? ' selected' : '') + '>' + n + ' Players</option>';
  });
  h += '</select></div>';

  h += '<div class="f-group"><label>🎯 Mode</label>';
  h += '<select id="cmMode" class="f-input">';
  ['Solo','Duo','Squad'].forEach(function(m) { h += '<option value="' + m.toLowerCase() + '">' + m + '</option>'; });
  h += '</select></div>';

  h += '<div class="f-group"><label>💀 Per Kill Points</label>';
  h += '<input type="number" id="cmKillPts" class="f-input" value="1" min="0" max="10"></div>';

  /* ✅ BUG FIX (2026-08-24): "Admin panel me jo fields match banane ke
     liye hain (1st/2nd/3rd prize) vo creator ke liye bhi ho" — added
     the same 3 prize fields admin's own match form has. Capped
     server-side (creator_create_match RPC) at max_slots × entry_fee so
     a creator can never promise a payout their own match can't cover. */
  h += '<div style="background:rgba(255,215,0,.05);border:1px solid rgba(255,215,0,.15);border-radius:12px;padding:10px 12px;margin:4px 0 10px;font-size:10px;color:#ffd700">🏆 Prize pool tumhare match ke max collection (players × entry fee) se zyada nahi ho sakta</div>';
  h += '<div class="f-group"><label>🥇 1st Prize</label>';
  h += '<input type="number" id="cmPrize1" class="f-input" value="0" min="0"></div>';
  h += '<div class="f-group"><label>🥈 2nd Prize</label>';
  h += '<input type="number" id="cmPrize2" class="f-input" value="0" min="0"></div>';
  h += '<div class="f-group"><label>🥉 3rd Prize</label>';
  h += '<input type="number" id="cmPrize3" class="f-input" value="0" min="0"></div>';

  var minDT = new Date(Date.now() + 30*60*1000).toISOString().slice(0,16);
  h += '<div class="f-group"><label>📅 Match Date & Time (min 20 min baad)</label>';
  h += '<input type="datetime-local" id="cmDateTime" class="f-input" min="' + minDT + '"></div>';

  h += '<button onclick="submitCreatorMatch()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">🎮 Match Banao</button>';
  h += '</div>';

  if (window.openModal) openModal('🎮 Naya Match Host Karo', h);
};

window.submitCreatorMatch = function() {
  if (!uid() || !window._supa) { toast('Login ya network error', 'err'); return; }

  var name       = ((document.getElementById('cmName')||{}).value||'').trim();
  var type       = (document.getElementById('cmType')||{}).value || 'coins';
  var fee        = Number((document.getElementById('cmFee')||{}).value || 0);
  var maxPlayers = Number((document.getElementById('cmMaxPlayers')||{}).value || 25);
  var mode       = (document.getElementById('cmMode')||{}).value || 'solo';
  var killPts    = Number((document.getElementById('cmKillPts')||{}).value || 1);
  var prize1     = Number((document.getElementById('cmPrize1')||{}).value || 0);
  var prize2     = Number((document.getElementById('cmPrize2')||{}).value || 0);
  var prize3     = Number((document.getElementById('cmPrize3')||{}).value || 0);
  var dtVal      = (document.getElementById('cmDateTime')||{}).value || '';

  if (!name || name.length < 3) { toast('Match name kam se kam 3 characters ka ho', 'err'); return; }
  if (!fee || fee < 1 || fee > 50) { toast('Entry fee 1-50 ke beech ho', 'err'); return; }
  if (!dtVal) { toast('Date/time set karo', 'err'); return; }
  if (prize1 < 0 || prize2 < 0 || prize3 < 0) { toast('Prize amount negative nahi ho sakta', 'err'); return; }
  if ((prize1 + prize2 + prize3) > (maxPlayers * fee)) { toast('Prize pool match ke max collection se zyada hai — kam karo', 'err'); return; }

  var scheduledAt = new Date(dtVal).toISOString();

  window._supa.rpc('creator_create_match', {
    p_title: name, p_mode: mode, p_entry_type: type, p_entry_fee: fee,
    p_max_slots: maxPlayers, p_per_kill_prize: killPts, p_scheduled_at: scheduledAt,
    p_first_prize: prize1, p_second_prize: prize2, p_third_prize: prize3
  }).then(function(r) {
    /* ✅ BUG FIX (2026-08-25): "Match create nahi ho paya" appearing even
       though the RPC itself is verified working correctly (tested live
       via direct SQL simulation — succeeds every time with these exact
       params). Root cause: this only ever read r.data and checked
       d.success — it never checked r.error at all. Supabase JS v2's
       .rpc() call RESOLVES (doesn't reject) even on a genuine PostgREST/
       auth error; it fulfills with {data:null, error:{...}} in that
       case. So any real server-side error (expired Firebase→Supabase
       JWT bridge token, transient RLS hiccup, schema cache miss, etc.)
       landed here with d = null, silently fell through to the generic
       fallback message, and the actual error (r.error.message /
       r.error.code) that would have explained exactly what went wrong
       was thrown away instead of shown or logged. Now: check r.error
       first and surface it distinctly, log full details either way so
       the browser console tells the real story next time, and only
       fall back to the generic message when the RPC truly ran but
       returned a d.success=false with an error code we haven't mapped. */
    if (r && r.error) {
      console.error('[submitCreatorMatch] RPC error:', r.error);
      var authHint = /jwt|JWT|auth/i.test(r.error.message || '') ? ' (login session expired ho gaya — app dobara kholo)' : '';
      toast('❌ ' + (r.error.message || 'Server error') + authHint, 'err');
      return;
    }
    var d = r.data;
    if (!d || !d.success) {
      console.warn('[submitCreatorMatch] RPC returned unsuccessful result:', d);
      var errMap = {
        not_a_creator: 'Tum approved creator nahi ho',
        premium_required: 'Match host karne ke liye active Premium chahiye',
        creator_suspended: 'Tumhari hosting suspend hai',
        entry_fee_out_of_range: 'Entry fee 1-' + (d&&d.max||50) + ' ke beech honi chahiye',
        invalid_slot_count: 'Players 2-' + (d&&d.max||100) + ' ke beech ho',
        schedule_too_soon: 'Match kam se kam 20 min baad schedule karo',
        invalid_title: 'Match name sahi se likho',
        prize_exceeds_pool: 'Total prize match ke max collection (₹/coins ' + (d&&d.max||0) + ') se zyada hai',
        invalid_prize: 'Prize amount sahi se bharo',
        too_many_open_matches: 'Max ' + (d&&d.max||3) + ' active matches allowed — pehle koi complete karo'
      };
      toast(errMap[d && d.error] || ('Match create nahi ho paya' + (d && d.error ? (' (' + d.error + ')') : '')), 'err');
      return;
    }
    toast('✅ Match banaya gaya! Players abhi register kar sakte hain.', 'ok');
    if (window.closeModal) closeModal();
    if (window.renderHome) renderHome();
  }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

/* --- My Creator Matches List --- */
window.showMyCreatorMatches = function() {
  if (!uid() || !window._supa) return;

  var h = '<div id="_myCmBody" style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  if (window.openModal) openModal('📋 Mere Matches', h);

  window._supa.from('matches')
    .select('id,title,status,entry_fee,entry_type,filled_slots,max_slots,scheduled_at,room_id')
    .eq('creator_uid', uid())
    .order('created_at', { ascending: false })
    .limit(20)
    .then(function(r) {
      var body = document.getElementById('_myCmBody');
      if (!body) return;
      var matches = r.data || [];
      if (!matches.length) { body.innerHTML = '<div style="padding:10px;font-size:13px">Koi match nahi banaya abhi — pehle ek banao!</div>'; return; }

      var bh = '<div style="display:grid;gap:10px;text-align:left">';
      matches.forEach(function(m) {
        var statusColor = m.status === 'upcoming' ? '#ffd700' : m.status === 'live' ? '#00ff9c' : m.status === 'pending_review' ? '#00d4ff' : m.status === 'completed' ? '#888' : '#ff6b6b';
        var statusLabel = m.status === 'pending_review' ? 'ADMIN REVIEW' : (m.status||'').toUpperCase();
        bh += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px">';
        bh += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
        bh += '<div><div style="font-size:13px;font-weight:700;color:#fff">' + _esc(m.title||'Untitled') + '</div>';
        bh += '<div style="font-size:11px;color:#888">' + (m.entry_fee||0) + ' ' + (m.entry_type==='coins'?'🪙':'💎') + ' · ' + (m.filled_slots||0) + '/' + (m.max_slots||0) + ' players</div></div>';
        bh += '<span style="font-size:10px;color:' + statusColor + ';font-weight:700">' + statusLabel + '</span>';
        bh += '</div>';
        if (m.status === 'upcoming' && !m.room_id) {
          bh += '<button onclick="showCreatorRoomEntry(\'' + m.id + '\')" style="width:100%;padding:9px;border-radius:10px;background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);color:#00d4ff;font-size:12px;font-weight:700;cursor:pointer">🔑 Room ID Enter Karo</button>';
        } else if (m.status === 'live') {
          bh += '<button onclick="showCreatorResultForm(\'' + m.id + '\')" style="width:100%;padding:9px;border-radius:10px;background:rgba(0,255,156,.08);border:1px solid rgba(0,255,156,.2);color:#00ff9c;font-size:12px;font-weight:700;cursor:pointer">🏆 Result Submit Karo</button>';
        } else if (m.status === 'pending_review') {
          bh += '<div style="font-size:11px;color:#00d4ff">Admin result verify kar raha hai — payout jald hoga</div>';
        }
        bh += '</div>';
      });
      bh += '</div>';
      body.innerHTML = bh;
    });
};

/* --- Creator Room ID Entry --- */
window.showCreatorRoomEntry = function(matchId) {
  var h = '<div style="padding:4px 0">';
  h += '<div style="font-size:12px;color:#888;margin-bottom:12px">Free Fire mein custom room banao → Room ID + Password yahan daalo → Match LIVE ho jayega, players ko dikhega.</div>';
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
  if (!roomId || roomId.length < 3) { toast('Valid Room ID daalo', 'err'); return; }
  if (!window._supa) { toast('Network error', 'err'); return; }

  window._supa.rpc('creator_set_room', { p_match_id: matchId, p_room_id: roomId, p_room_password: roomPw })
    .then(function(r) {
      var d = r.data;
      if (!d || !d.success) {
        var errMap = { not_your_match: 'Ye tumhara match nahi hai', match_not_active: 'Match active nahi hai', invalid_room_id: 'Room ID sahi nahi hai' };
        toast(errMap[d && d.error] || 'Room ID save nahi hua', 'err');
        return;
      }
      toast('✅ Room ID set! Match ab LIVE hai.', 'ok');
      if (window.closeModal) closeModal();
    }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

/* --- Creator Result Submission (stages for admin review only) --- */
window.showCreatorResultForm = function(matchId) {
  if (!window._supa) return;
  var h = '<div id="_crResultBody" style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading players...</div>';
  if (window.openModal) openModal('🏆 Match Result', h);

  window._supa.from('join_requests').select('id,user_ign,ign_at_join').eq('match_id', matchId).in('status', ['pending','joined','approved'])
    .then(function(r) {
      var body = document.getElementById('_crResultBody');
      if (!body) return;
      var players = r.data || [];
      if (!players.length) { body.innerHTML = '<div style="padding:10px;font-size:13px">Koi player nahi mila</div>'; return; }

      var bh = '<div style="font-size:11px;color:#888;margin-bottom:12px;text-align:left">Har player ke kills aur placement daalo. Submit karne ke baad Admin verify karega aur prize payout karega.</div>';
      bh += '<div style="display:grid;gap:8px;text-align:left">';
      players.forEach(function(p) {
        bh += '<div style="display:flex;gap:8px;align-items:center;background:rgba(255,255,255,.03);padding:8px;border-radius:10px">';
        bh += '<div style="flex:1;font-size:12px;font-weight:700">' + _esc(p.user_ign||p.ign_at_join||'Player') + '</div>';
        bh += '<input type="number" min="0" placeholder="Kills" data-jr="' + p.id + '" class="_crKills" style="width:60px;padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:12px">';
        bh += '<input type="number" min="1" placeholder="Rank" data-jr="' + p.id + '" class="_crPlacement" style="width:60px;padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:12px">';
        bh += '</div>';
      });
      bh += '</div>';
      bh += '<button onclick="submitCreatorResult(\'' + matchId + '\')" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer;margin-top:14px">📤 Result Submit Karo</button>';
      body.innerHTML = bh;
    });
};

window.submitCreatorResult = function(matchId) {
  var killInputs = document.querySelectorAll('._crKills');
  var results = [];
  killInputs.forEach(function(inp) {
    var jrId = inp.dataset.jr;
    var placementInp = document.querySelector('._crPlacement[data-jr="' + jrId + '"]');
    results.push({
      join_request_id: jrId,
      kills: Number(inp.value || 0),
      placement: Number((placementInp && placementInp.value) || 0)
    });
  });
  if (!window._supa) { toast('Network error', 'err'); return; }

  window._supa.rpc('creator_publish_result', { p_match_id: matchId, p_results: results })
    .then(function(r) {
      var d = r.data;
      if (!d || !d.success) {
        var errMap = { not_your_match: 'Ye tumhara match nahi hai', match_not_live: 'Match live nahi hai' };
        toast(errMap[d && d.error] || 'Result submit nahi hua', 'err');
        return;
      }
      toast('✅ Result submit ho gaya! Admin review ke baad payout hoga.', 'ok');
      if (window.closeModal) closeModal();
    }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

window.rateCreatorMatch = function(matchId, creatorUid) {
  var h = '<div style="text-align:center;padding:10px 0">';
  h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:14px">Is match ka experience kaisa raha?</div>';
  h += '<div id="_starRow" style="display:flex;justify-content:center;gap:8px;margin-bottom:16px;font-size:32px">';
  for (var i = 1; i <= 5; i++) {
    h += '<span data-star="' + i + '" onclick="window._selectStar(' + i + ')" style="cursor:pointer;color:#333">★</span>';
  }
  h += '</div>';
  h += '<textarea id="_ratingReason" class="f-input" placeholder="Koi feedback? (optional)" style="min-height:60px;margin-bottom:14px"></textarea>';
  h += '<button onclick="window._submitRating(\'' + matchId + '\')" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);border:none;color:#000;font-weight:800;cursor:pointer">Submit Rating</button>';
  h += '</div>';
  window._selectedStars = 0;
  if (window.openModal) openModal('⭐ Rate This Match', h);
};
window._selectStar = function(n) {
  window._selectedStars = n;
  document.querySelectorAll('#_starRow span').forEach(function(s) {
    s.style.color = Number(s.dataset.star) <= n ? '#ffd700' : '#333';
  });
};
window._submitRating = function(matchId) {
  if (!window._selectedStars) { toast('Stars select karo', 'err'); return; }
  var reason = ((document.getElementById('_ratingReason')||{}).value||'').trim();
  if (!window._supa) return;
  window._supa.rpc('rate_creator_match', { p_match_id: matchId, p_stars: window._selectedStars, p_reason: reason })
    .then(function(r) {
      if (r.data && r.data.success) { toast('✅ Rating submit ho gayi!', 'ok'); if (window.closeModal) closeModal(); }
      else { toast((r.data && r.data.error) || 'Rating submit nahi hui', 'err'); }
    });
};

/* ─── Public Creator Profile (follow + rating + their matches) ──── */
window.showCreatorProfile = function(creatorUid) {
  if (!window._supa) return;
  var h = '<div id="_credProfBody" style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  if (window.openModal) openModal('🎮 Creator Profile', h);

  Promise.all([
    window._supa.from('users').select('ign,avatar_url,creator_rating,creator_rating_count,creator_code').eq('id', creatorUid).single(),
    window._supa.from('creator_stats').select('total_matches').eq('user_id', creatorUid).maybeSingle(),
    uid() ? window._supa.from('creator_follows').select('id').eq('creator_uid', creatorUid).eq('follower_uid', uid()).maybeSingle() : Promise.resolve({data:null})
  ]).then(function(results) {
    var c = (results[0] && results[0].data) || {};
    var stats = (results[1] && results[1].data) || {};
    var isFollowing = !!(results[2] && results[2].data);
    var body = document.getElementById('_credProfBody');
    if (!body) return;

    var stars = '';
    var rating = Number(c.creator_rating || 5);
    for (var i = 1; i <= 5; i++) stars += (i <= Math.round(rating) ? '★' : '☆');

    var bh = '<div style="text-align:center;padding-bottom:14px">';
    bh += '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#00ff9c,#00d4ff);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#000;margin:0 auto 10px">' + (c.ign||'C').charAt(0).toUpperCase() + '</div>';
    bh += '<div style="font-size:16px;font-weight:800">' + _escCP(c.ign||'Creator') + '</div>';
    bh += '<div style="font-size:16px;color:#ffd700;margin:4px 0">' + stars + ' <span style="font-size:12px;color:#888">(' + (c.creator_rating_count||0) + ' ratings)</span></div>';
    bh += '<div style="font-size:11px;color:#888">' + (stats.total_matches||0) + ' referred matches played · Code: ' + (c.creator_code||'—') + '</div>';
    bh += '</div>';

    bh += '<button id="_followBtn" onclick="window._toggleFollowCreator(\'' + creatorUid + '\')" style="width:100%;padding:12px;border-radius:12px;font-weight:800;cursor:pointer;border:none;' +
      (isFollowing ? 'background:rgba(255,255,255,.08);color:#aaa' : 'background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000') + '">' +
      (isFollowing ? '✓ Following — notifications ON' : '+ Follow (naye match ka notification pao)') + '</button>';
    bh += '<div style="font-size:10px;color:#666;text-align:center;margin-top:8px">Sirf followers ko naye match ka notification jaata hai — sabko nahi</div>';

    body.innerHTML = bh;
  });
};

window._toggleFollowCreator = function(creatorUid) {
  if (!uid() || !window._supa) { toast('Login karo pehle', 'err'); return; }
  var btn = document.getElementById('_followBtn');
  var isFollowing = btn && btn.textContent.indexOf('Following') !== -1;

  var op = isFollowing
    ? window._supa.from('creator_follows').delete().eq('creator_uid', creatorUid).eq('follower_uid', uid())
    : window._supa.from('creator_follows').insert({ creator_uid: creatorUid, follower_uid: uid() });

  op.then(function(r) {
    if (r.error) { toast('Error: ' + r.error.message, 'err'); return; }
    if (btn) {
      if (isFollowing) {
        btn.textContent = '+ Follow (naye match ka notification pao)';
        btn.style.background = 'linear-gradient(135deg,#00ff9c,#00cc7a)'; btn.style.color = '#000';
        toast('Unfollowed', 'inf');
      } else {
        btn.textContent = '✓ Following — notifications ON';
        btn.style.background = 'rgba(255,255,255,.08)'; btn.style.color = '#aaa';
        toast('✅ Following! Naye match pe notification milega', 'ok');
      }
    }
  });
};

function _escCP(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function _esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

console.log('creator-match-host.js (secure RPC version) loaded');
})();
