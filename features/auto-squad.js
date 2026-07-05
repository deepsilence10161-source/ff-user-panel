/* ================================================================
   AUTO SQUAD / DUO MATCHING — auto-squad.js
   v31 REWRITE — 100% Supabase (Firebase RTDB removed)

   Table: auto_squad_queue (see MIGRATION_V31.sql)
   Uses: DB.autoSquad.joinQueue / getWaiting / leaveQueue / poll

   Flow:
   1. Solo player → joinAutoQueue → upsert into auto_squad_queue
   2. Poll every 8s → checkAndFormTeam RPC/logic
   3. Team formed → notify all via Supabase notifications table
   4. Members shown team card — captain proceeds to join match
================================================================ */

(function () {
  'use strict';

  function _s()  { return window._supa; }
  function _u()  { return window.U; }
  function _ud() { return window.UD; }
  function _t(m, type) { if (window.toast) window.toast(m, type || 'inf'); }
  function _uid(){ return _u() && _u().uid; }

  /* ── Show Auto-Squad Join Option ── */
  window.showAutoSquadJoin = function (matchId, mode) {
    var needed    = (mode === 'duo') ? 2 : 4;
    var modeLabel = mode === 'duo' ? 'Duo' : 'Squad';

    var h = '<div style="text-align:center;padding:8px 0">';
    h += '<div style="font-size:36px;margin-bottom:10px">👥</div>';
    h += '<div style="font-size:16px;font-weight:900;margin-bottom:6px">Auto ' + modeLabel + ' Matching</div>';
    h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px;line-height:1.7">';
    h += 'Akele ho? Koi baat nahi!<br>';
    h += '<strong style="color:var(--green)">' + (needed - 1) + ' aur ' + (mode === 'duo' ? 'player' : 'players') + '</strong> dhundh ke tumhari team ban jaayegi.';
    h += '</div>';

    h += '<div id="autoQueueStatus" style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:12px;margin-bottom:14px">';
    h += '<div style="font-size:11px;color:var(--txt2)">Queue mein abhi</div>';
    h += '<div style="font-size:24px;font-weight:900;color:var(--green)" id="autoQueueCount">…</div>';
    h += '<div style="font-size:11px;color:var(--txt2)">/' + needed + ' players</div>';
    h += '</div>';

    h += '<div style="background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:10px;margin-bottom:14px;font-size:11px;color:var(--txt2);line-height:1.7">';
    h += '📋 Rules:<br>';
    h += '• Rank-based pairing — same rank ke log milenge<br>';
    h += '• Team ban jaane pe notification aayegi<br>';
    h += '• Captain auto-select hoga (highest rank)<br>';
    h += '• ' + (mode === 'duo' ? 'Dono' : 'Sabhi ' + needed) + ' players ki entry fee lagegi';
    h += '</div>';

    h += '<button onclick="joinAutoQueue(\'' + matchId + '\',\'' + mode + '\',' + needed + ')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer"><i class="fas fa-users"></i> Queue Join Karo</button>';
    h += '</div>';

    if (window.openModal) openModal('👥 Auto ' + modeLabel + ' Match', h);
    _loadQueueCount(matchId, needed);
  };

  /* ── Load queue count (Supabase) ── */
  function _loadQueueCount(matchId, needed) {
    if (!_s()) return;
    _s().from('auto_squad_queue')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', matchId)
      .eq('status', 'waiting')
      .then(function (r) {
        var count = r.count || 0;
        var el = document.getElementById('autoQueueCount');
        if (el) {
          el.textContent = count;
          el.style.color = count >= needed ? '#ffd700' : 'var(--green)';
        }
      }).catch(function () {});
  }

  /* ── Join Queue ── */
  window.joinAutoQueue = function (matchId, mode, needed) {
    if (!_uid() || !_ud()) { _t('Login karo pehle', 'err'); return; }
    var t = window.MT && window.MT[matchId];
    if (!t) { _t('Match nahi mila', 'err'); return; }
    if (!_s()) { _t('Connection error', 'err'); return; }

    var myRank = window.calcRk ? window.calcRk((_ud().stats || {})) : { badge: 'Bronze', pts: 0 };

    /* Upsert into auto_squad_queue (idempotent) */
    _s().from('auto_squad_queue')
      .upsert({
        match_id:   matchId,
        user_id:    _uid(),
        mode:       mode,
        ign:        _ud().ign || _ud().displayName || 'Player',
        rank_tier:  myRank.badge || 'Bronze',
        rank_pts:   myRank.pts  || 0,
        status:     'waiting'
      }, { onConflict: 'match_id,user_id' })
      .select()
      .single()
      .then(function (r) {
        if (r.error) { _t('Queue join error: ' + (r.error.message || ''), 'err'); return; }
        _t('✅ Queue mein aa gaye! Team banne ka wait karo 🎮', 'ok');
        if (window.closeModal) closeModal();

        /* Try to form team immediately */
        _tryFormTeam(matchId, mode, needed, t);
        /* Show live banner */
        _showQueueBanner(matchId, mode, needed);
      }).catch(function (e) {
        _t('Queue join failed', 'err');
        console.error('[AutoSquad] joinQueue error:', e);
      });
  };

  /* ── Try form team ── */
  function _tryFormTeam(matchId, mode, needed, matchData) {
    if (!_s()) return;

    _s().from('auto_squad_queue')
      .select('*, user:users(ign, avatar_url, rank_tier, rank_points)')
      .eq('match_id', matchId)
      .eq('status', 'waiting')
      .order('rank_pts', { ascending: false })
      .then(function (r) {
        var players = r.data || [];
        if (players.length < needed) return; /* Not enough yet */

        /* Take first `needed` (already sorted by rank_pts desc) */
        var team    = players.slice(0, needed);
        var captain = team[0];

        /* Mark all as 'matched' atomically */
        var teamId  = 'team_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        var uids    = team.map(function (p) { return p.user_id; });

        _s().from('auto_squad_queue')
          .update({ status: 'matched', team_id: teamId })
          .in('user_id', uids)
          .eq('match_id', matchId)
          .then(function () {
            /* Notify each team member via Supabase notifications */
            var memberNames = team.map(function (p) {
              return (p.user && p.user.ign) || p.ign || 'Player';
            }).join(', ');

            var insertNotifs = uids.map(function (uid) {
              return {
                user_id: uid,
                type:    'team_formed',
                title:   '🎉 Tumhari Team Bani!',
                body:    mode.toUpperCase() + ' match ke liye team ready! Members: ' + memberNames +
                         '. Captain: ' + ((captain.user && captain.user.ign) || captain.ign || 'Player'),
                ref_id:  matchId
              };
            });

            if (_s()) {
              _s().from('notifications').insert(insertNotifs).catch(function () {});
            }

            /* Show team card to current user if they're in this team */
            if (uids.indexOf(_uid()) !== -1) {
              _t('🎉 Team ban gayi! Captain match join karega.', 'ok');
              _showTeamFormedCard(team, captain, matchId, mode, matchData);
            }
          }).catch(function (e) {
            console.warn('[AutoSquad] matchUpdate error:', e);
          });
      }).catch(function (e) {
        console.warn('[AutoSquad] tryFormTeam error:', e);
      });
  }

  /* ── Team formed card ── */
  function _showTeamFormedCard(team, captain, matchId, mode, matchData) {
    var isCap = captain.user_id === _uid();
    var h = '<div style="text-align:center;padding:8px 0">';
    h += '<div style="font-size:40px;margin-bottom:8px">🎉</div>';
    h += '<div style="font-size:16px;font-weight:900;color:#00ff9c;margin-bottom:4px">Team Ban Gayi!</div>';
    h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:14px">Tumhara ' + mode.toUpperCase() + ' team ready hai</div>';

    h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">';
    team.forEach(function (p) {
      var pIgn   = (p.user && p.user.ign) || p.ign || 'Player';
      var pIsCap = p.user_id === captain.user_id;
      var isMe   = p.user_id === _uid();
      h += '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:rgba(255,255,255,' + (isMe ? '.07' : '.04') + ');border:1px solid rgba(255,255,255,' + (isMe ? '.12' : '.07') + ')">';
      h += '<div style="width:34px;height:34px;border-radius:50%;background:rgba(0,255,156,.12);display:flex;align-items:center;justify-content:center;font-weight:700;color:#00ff9c">' + pIgn.charAt(0).toUpperCase() + '</div>';
      h += '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + pIgn + (isMe ? ' (You)' : '') + '</div>';
      h += '<div style="font-size:10px;color:#888">' + (p.rank_tier || 'Bronze') + '</div></div>';
      if (pIsCap) h += '<div style="font-size:10px;background:rgba(255,215,0,.15);color:#ffd700;padding:3px 8px;border-radius:6px;font-weight:700">👑 Captain</div>';
      h += '</div>';
    });
    h += '</div>';

    if (isCap) {
      h += '<div style="font-size:12px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:10px;padding:10px;margin-bottom:12px;color:#00ff9c">';
      h += '👑 Tum Captain ho! Match join karo sabke liye.';
      h += '</div>';
      h += '<button onclick="cJoin(\'' + matchId + '\');closeModal()" style="width:100%;padding:13px;border-radius:13px;background:linear-gradient(135deg,#ffd700,#ff8c00);border:none;color:#000;font-size:14px;font-weight:900;cursor:pointer">🎮 Match Join Karo (Captain)</button>';
    } else {
      h += '<div style="font-size:12px;background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.15);border-radius:10px;padding:10px;margin-bottom:12px;color:#00d4ff">';
      h += '⏳ Captain match join kar raha hai — wait karo notification ke liye.';
      h += '</div>';
    }

    h += '</div>';
    if (window.openModal) openModal('🎉 Team Ready!', h);
  }

  /* ── Queue waiting banner ── */
  var _queuePollTimers = {};
  function _showQueueBanner(matchId, mode, needed) {
    var existing = document.getElementById('autoQueueBanner_' + matchId);
    if (existing) return;

    var card = document.querySelector('[data-match-id="' + matchId + '"]');
    if (!card) return;

    var banner = document.createElement('div');
    banner.id  = 'autoQueueBanner_' + matchId;
    banner.style.cssText = 'background:linear-gradient(135deg,rgba(0,255,156,.08),rgba(0,212,255,.05));border:1px solid rgba(0,255,156,.2);border-radius:12px;padding:10px 14px;margin-top:8px;display:flex;align-items:center;justify-content:space-between';

    function _updateBanner() {
      if (!_s() || !_uid()) return;
      _s().from('auto_squad_queue')
        .select('status')
        .eq('match_id', matchId)
        .eq('user_id', _uid())
        .maybeSingle()
        .then(function (r) {
          if (!r.data) { /* Not in queue anymore */
            banner.remove();
            if (_queuePollTimers[matchId]) {
              clearInterval(_queuePollTimers[matchId]);
              delete _queuePollTimers[matchId];
            }
            return;
          }

          if (r.data.status === 'matched') {
            banner.innerHTML = '<div style="font-size:12px"><span style="color:#ffd700;font-weight:700">🎉 Team ban gayi!</span><br><span style="font-size:10px;color:var(--txt2)">Check notifications</span></div>';
            return;
          }

          /* Still waiting — show count */
          _s().from('auto_squad_queue')
            .select('id', { count: 'exact', head: true })
            .eq('match_id', matchId)
            .eq('status', 'waiting')
            .then(function (cr) {
              var count = cr.count || 0;
              banner.innerHTML =
                '<div style="font-size:12px"><span style="color:var(--green);font-weight:700">⏳ Queue: ' + count + '/' + needed + '</span><br>' +
                '<span style="font-size:10px;color:var(--txt2)">Team banne ka wait karo…</span></div>' +
                '<button onclick="leaveAutoQueue(\'' + matchId + '\')" style="padding:5px 10px;border-radius:8px;background:rgba(255,60,60,.1);border:1px solid rgba(255,60,60,.2);color:#ff6b6b;font-size:11px;cursor:pointer">Leave</button>';

              /* Also try forming team */
              _tryFormTeam(matchId, mode, needed, window.MT && window.MT[matchId]);
            }).catch(function () {});
        }).catch(function () {});
    }

    card.parentNode.insertBefore(banner, card.nextSibling);
    _updateBanner();
    if (_queuePollTimers[matchId]) clearInterval(_queuePollTimers[matchId]);
    _queuePollTimers[matchId] = setInterval(_updateBanner, 8000);
  }

  /* ── Leave Queue ── */
  window.leaveAutoQueue = function (matchId) {
    if (!_uid() || !_s()) return;
    _s().from('auto_squad_queue')
      .delete()
      .eq('match_id', matchId)
      .eq('user_id', _uid())
      .then(function () {
        var banner = document.getElementById('autoQueueBanner_' + matchId);
        if (banner) banner.remove();
        if (_queuePollTimers[matchId]) {
          clearInterval(_queuePollTimers[matchId]);
          delete _queuePollTimers[matchId];
        }
        _t('Queue se nikal gaye', 'inf');
      }).catch(function (e) {
        console.warn('[AutoSquad] leaveQueue error:', e);
      });
  };

  /* ── Get auto-team for a match (used by join.js) ── */
  window.getAutoTeam = function (matchId, callback) {
    if (!_uid() || !_s()) { callback(null); return; }
    _s().from('auto_squad_queue')
      .select('*, team_members:auto_squad_queue!team_id(user_id, ign, rank_tier)')
      .eq('match_id', matchId)
      .eq('user_id', _uid())
      .maybeSingle()
      .then(function (r) {
        callback(r.data || null);
      }).catch(function () { callback(null); });
  };

  /* ── Admin: View Auto Queue ── */
  window.loadAutoQueueAdmin = function (matchId, containerId) {
    var cont = document.getElementById(containerId);
    if (!cont || !_s()) return;

    _s().from('auto_squad_queue')
      .select('*, user:users(ign, rank_tier)')
      .eq('match_id', matchId)
      .eq('status', 'waiting')
      .order('joined_at', { ascending: true })
      .then(function (r) {
        var players = r.data || [];
        if (!players.length) {
          cont.innerHTML = '<div style="color:#666;font-size:12px;padding:8px">Queue khali hai</div>';
          return;
        }
        var html = '<div style="font-size:11px;color:#888;margin-bottom:6px">Auto Queue (' + players.length + ' waiting)</div>';
        players.forEach(function (p) {
          var pIgn = (p.user && p.user.ign) || p.ign || 'Unknown';
          html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">';
          html += '<span style="font-size:12px;font-weight:700">' + pIgn + '</span>';
          html += '<span style="font-size:10px;color:#888">' + ((p.user && p.user.rank_tier) || p.rank_tier || '') + '</span>';
          html += '<button onclick="removeFromAutoQueue(\'' + matchId + '\',\'' + p.user_id + '\')" style="margin-left:auto;padding:2px 8px;border-radius:6px;background:rgba(255,60,60,.1);border:1px solid rgba(255,60,60,.2);color:#ff6b6b;font-size:10px;cursor:pointer">Remove</button>';
          html += '</div>';
        });
        cont.innerHTML = html;
      }).catch(function () {
        cont.innerHTML = '<div style="color:#ff6b6b;font-size:12px;padding:8px">Load error</div>';
      });
  };

  window.removeFromAutoQueue = function (matchId, uid) {
    if (!_s()) return;
    _s().from('auto_squad_queue')
      .delete()
      .eq('match_id', matchId)
      .eq('user_id', uid)
      .then(function () { _t('Player removed from queue', 'ok'); })
      .catch(function (e) { console.warn('[AutoSquad] remove error:', e); });
  };

})();
