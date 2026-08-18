/* ================================================================
   MINI eSPORTS — BUGFIX v30 FINAL
   Must load LAST in index.html (after bugfixes-v29-final.js)

   WHAT THIS FIXES (verified against actual v29 code):
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [CRITICAL] Bug #1  — Clan system 100% Supabase rewrite
                        getUserClan, createClan, joinClan, leaveClan,
                        disbandClan, kickMember, leaderboard, chat,
                        updateClanScore — all Firebase removed
   [CRITICAL] Bug #36 — Admin role checks: getPendingJoinRequests,
                        getCreatorApplications, setCreatorStatus
                        now validate is_admin before returning data
   [CRITICAL] Bug #1a — getUserClan signature mismatch (patch in
                        fixes-v29-all-bugs.js changes (cb)→(uid,cb)
                        but all callers still use (cb) only)
   [HIGH]     Bug #34 — cJoin re-validates slots from Supabase on
                        click — not just render-time check
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ALREADY FIXED in v29 (do NOT re-patch):
   XSS (escHtml) ✅  Battle pass server validation ✅
   Referral upsert ✅  Score hooks (city/clan/duel/mentor) ✅
   Token refresh resubscribe ✅  Offline queue logout ✅
   Team join data (teamMembers/slotNumber/captainUid) ✅
   Kill proof validation ✅  Room password copy ✅
   Offline queue match status ✅  Firebase auth ↔ Supabase sync ✅
================================================================ */

(function () {
  'use strict';

  /* ─── Utilities ─── */
  function _s()  { return window._supa; }
  function _uid(){ return window.U && window.U.uid; }
  function _t(m, type) { if (window.toast) window.toast(m, type || 'inf'); }
  function _ign(){ return (window.UD && (window.UD.ign || window.UD.displayName)) || 'Player'; }

  /* waitFor: poll until condition is true, then run callback */
  function waitFor(cond, cb, ms, limit) {
    var elapsed = 0, iv = ms || 150, max = limit || 15000;
    var t = setInterval(function() {
      elapsed += iv;
      if (cond()) { clearInterval(t); try { cb(); } catch(e){ console.error('[V30]', e); } }
      else if (elapsed >= max) clearInterval(t);
    }, iv);
  }

  /* Generate 8-char alphanumeric invite code */
  function _genCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, '0');
  }

  var MAX_MEMBERS = 10;

  /* ════════════════════════════════════════════════════════
     BUG #1 — CLAN SYSTEM: 100% SUPABASE
     Rule: Firebase = ONLY analytics + crashlytics + support
     chat + Google login. Clans → Supabase only.
  ════════════════════════════════════════════════════════ */

  waitFor(
    function() { return window._supa && window.getUserClan !== undefined; },
    function() {

    /* ──────────────────────────────────────────────────────
       BUG #1a — getUserClan: Fix signature mismatch
       Old signature in clan.js:  getUserClan(cb)
       Broken patch in v29:        getUserClan(uid, cb)
       New fix: handles BOTH calling styles
    ────────────────────────────────────────────────────── */
    window.getUserClan = function(uidOrCallback, maybeCb) {
      var uid, cb;

      /* Detect calling style */
      if (typeof uidOrCallback === 'function') {
        /* Old style: getUserClan(callback) */
        uid = _uid();
        cb  = uidOrCallback;
      } else {
        /* New style: getUserClan(uid, callback) */
        uid = uidOrCallback;
        cb  = maybeCb;
      }

      if (!uid || !_s()) { if (cb) cb(null); return; }

      /* 1. Get user's clan_id from Supabase users table */
      _s().from('user_public_profiles').select('clan_id').eq('id', uid).maybeSingle() /* BUG #38 FIX */
        .then(function(r) {
          var clanId = r.data && r.data.clan_id;
          if (!clanId) { cb(null); return; }

          /* 2. Fetch clan + members in parallel */
          Promise.all([
            _s().from('clans')
              .select('*')
              .eq('id', clanId)
              .maybeSingle(),
            _s().from('clan_members')
              .select('user_id, role, joined_at')
              .eq('clan_id', clanId)
          ])
          .then(function(results) {
            var clan    = results[0].data;
            var members = results[1].data || [];
            if (!clan) { cb(null); return; }

            var memberIds = members.map(function(m) { return m.user_id; });
            if (!memberIds.length) {
              cb(_buildClan(clan, {}, []));
              return;
            }

            /* 3. Fetch member profiles */
            _s().from('user_public_profiles') /* BUG #38 FIX */
              .select('id, ign, avatar_url, rank_points')
              .in('id', memberIds)
              .then(function(ur) {
                var uMap = {};
                (ur.data || []).forEach(function(u) { uMap[u.id] = u; });
                cb(_buildClan(clan, uMap, members));
              })
              .catch(function() { cb(_buildClan(clan, {}, members)); });
          })
          .catch(function(e) {
            console.warn('[V30 #1] getUserClan:', e.message);
            cb(null);
          });
        })
        .catch(function() { cb(null); });
    };

    /* Build Firebase-compatible clan object from Supabase data */
    function _buildClan(clan, uMap, members) {
      var membersObj = {};
      members.forEach(function(m) {
        var u = uMap[m.user_id] || {};
        membersObj[m.user_id] = {
          uid:        m.user_id,
          ign:        u.ign || 'Player',
          avatar:     u.avatar_url || '',
          role:       m.role || 'member',
          rankPoints: u.rank_points || 0,
          joinedAt:   m.joined_at,
          gd:         0
        };
      });
      var code = clan.join_code
        || (clan.id || '').replace(/-/g,'').substr(0,8).toUpperCase();
      return {
        _id:         clan.id,
        id:          clan.id,
        name:        clan.name         || '',
        tag:         clan.tag          || '',
        emblem:      clan.emblem       || clan.badge || '🏰',
        badge:       clan.emblem       || clan.badge || '🏰',
        leader:      clan.leader_uid    || '',
        memberCount: clan.total_members || Object.keys(membersObj).length,
        weeklyScore: clan.weekly_score  || 0,
        totalWins:   clan.total_wins    || 0,
        totalKills:  clan.total_kills   || 0,
        weeklyRank:  0,
        join_code:   code,
        members:     membersObj
      };
    }

    console.log('[V30 #1a] getUserClan Supabase patch ✅');

    /* ──────────────────────────────────────────────────────
       CREATE CLAN — Supabase only
    ────────────────────────────────────────────────────── */
    window._doCreateClan = function() {
      if (!_s() || !_uid()) return;
      var name = ((document.getElementById('_cName') || {}).value || '').trim();
      var tag  = ((document.getElementById('_cTag')  || {}).value || '').toUpperCase().trim();
      if (!name) { _t('Clan ka naam daalo!', 'err'); return; }
      if (!tag || tag.length < 2) { _t('Tag 2-4 chars ka hona chahiye!', 'err'); return; }

      /* Read selected emblem from UI */
      var selEmb = '🏰';
      document.querySelectorAll('[id^="_emb_"]').forEach(function(el) {
        if (el.style.background && el.style.background.indexOf('rgba(255,215,0') !== -1) {
          selEmb = el.textContent.trim() || selEmb;
        }
      });

      /* Check user not already in a clan */
      var myOldClan = window.UD && (window.UD.clanId || window.UD.clan_id);
      if (myOldClan) { _t('Pehle apna current clan chhodo!', 'err'); return; }

      var uid  = _uid();
      var code = _genCode();

      _s().from('clans').insert({
        name:          name,
        tag:           tag.substr(0, 4),
        emblem:        selEmb,
        badge:         selEmb,
        leader_uid:    uid,
        total_members: 1,
        weekly_score:  0,
        total_wins:    0,
        total_kills:   0,
        is_private:    false,
        join_code:     code
      }).select().single()
        .then(function(r) {
          if (r.error) { _t('Error: ' + r.error.message, 'err'); return; }
          var clanId = r.data.id;

          /* Add creator as leader in clan_members */
          return _s().from('clan_members').insert({
            clan_id: clanId, user_id: uid, role: 'leader'
          }).then(function() {
            /* Update user's clan_id in Supabase */
            return _s().from('users').update({ clan_id: clanId }).eq('id', uid);
          }).then(function() {
            /* Update local cache — set both naming conventions */
            if (window.UD) { window.UD.clanId = clanId; window.UD.clan_id = clanId; }
            _t('✅ Clan "' + name + '" ban gaya! Code: ' + code, 'ok');
            if (window.closeModal) closeModal();
          });
        })
        .catch(function(e) { _t('Clan create error: ' + (e.message || 'retry karo'), 'err'); });
    };

    console.log('[V30 #1] _doCreateClan Supabase patch ✅');

    /* ──────────────────────────────────────────────────────
       JOIN CLAN — Supabase only (by clan ID or join_code)
    ────────────────────────────────────────────────────── */
    window.joinClan = function(clanIdOrCode) {
      if (!_s() || !_uid()) return;
      if (!clanIdOrCode) { _t('Clan ID ya code daalo!', 'err'); return; }

      var myOldClan = window.UD && (window.UD.clanId || window.UD.clan_id);
      if (myOldClan) { _t('Pehle apna current clan chhodo!', 'err'); return; }

      var uid  = _uid();
      var code = clanIdOrCode.toString().trim().toUpperCase();

      /* Determine lookup strategy */
      var isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(clanIdOrCode);
      var query;
      if (isUuid) {
        query = _s().from('clans')
          .select('id, name, total_members, emblem, badge')
          .eq('id', clanIdOrCode)
          .maybeSingle();
      } else {
        /* join_code lookup */
        query = _s().from('clans')
          .select('id, name, total_members, emblem, badge')
          .eq('join_code', code)
          .maybeSingle();
      }

      query.then(function(r) {
        if (!r.data) { _t('Clan nahi mila! Code dobara check karo.', 'err'); return; }
        var clan = r.data;
        if ((clan.total_members || 0) >= MAX_MEMBERS) {
          _t('Clan full hai! (' + clan.total_members + '/' + MAX_MEMBERS + ')', 'err');
          return;
        }

        /* Try atomic RPC first */
        _s().rpc('join_clan', {
          p_user_id:     uid,
          p_clan_id:     clan.id,
          p_ign:         _ign(),
          p_max_members: MAX_MEMBERS
        })
        .then(function(rpcRes) {
          var res = rpcRes.data;
          if (res && res.success === false) {
            var msg = res.error === 'clan_full'      ? 'Clan full ho gaya!'
                    : res.error === 'already_in_clan' ? 'Pehle current clan chhodo!'
                    : 'Join error: ' + (res.error || 'unknown');
            _t(msg, 'err'); return;
          }
          _afterJoin(clan);
        })
        .catch(function() {
          /* RPC not yet deployed — fallback to direct insert */
          _joinDirect(uid, clan);
        });
      })
      .catch(function() { _t('Service unavailable, retry karo', 'err'); });
    };

    function _afterJoin(clan) {
      if (window.UD) { window.UD.clanId = clan.id; window.UD.clan_id = clan.id; }
      var em = clan.emblem || clan.badge || '🏰';
      _t('✅ ' + em + ' "' + (clan.name || 'Clan') + '" join kar liya!', 'ok');
      if (window.closeModal) closeModal();
    }

    function _joinDirect(uid, clan) {
      _s().from('clan_members')
        .insert({ clan_id: clan.id, user_id: uid, role: 'member' })
        .then(function() {
          return _s().from('clans')
            .update({ total_members: (clan.total_members || 0) + 1 })
            .eq('id', clan.id);
        })
        .then(function() {
          return _s().from('users').update({ clan_id: clan.id }).eq('id', uid);
        })
        .then(function() { _afterJoin(clan); })
        .catch(function(e) { _t('Join error: ' + (e.message || 'retry karo'), 'err'); });
    }

    /* _doJoinByCode: uses join_code column (not UUID prefix) */
    window._doJoinByCode = function() {
      var code = ((document.getElementById('_cCode') || {}).value || '')
        .toUpperCase().trim().substr(0, 8);
      if (!code || code.length < 6) { _t('Valid code daalo! (6-8 chars)', 'err'); return; }
      window.joinClan(code);
    };

    console.log('[V30 #1] joinClan + _doJoinByCode Supabase patch ✅');

    /* ──────────────────────────────────────────────────────
       LEAVE CLAN — Supabase only (atomic RPC with fallback)
    ────────────────────────────────────────────────────── */
    window.leaveClan = function(clanId) {
      if (!_s() || !_uid()) return;
      if (!confirm('Kya aap sach mein clan chhodni chahte ho? Yeh action undo nahi ho sakta.')) return;
      var uid = _uid();

      _s().rpc('leave_clan', { p_user_id: uid, p_clan_id: clanId })
        .then(function() { _afterLeave(); })
        .catch(function() {
          /* RPC fallback */
          _s().from('clan_members').delete()
            .eq('clan_id', clanId).eq('user_id', uid)
            .then(function() {
              return _s().from('users').update({ clan_id: null }).eq('id', uid);
            })
            .then(function() { _afterLeave(); })
            .catch(function(e) { _t('Leave error: ' + (e.message || 'retry karo'), 'err'); });
        });

      function _afterLeave() {
        if (window.UD) {
          delete window.UD.clanId;
          delete window.UD.clan_id;
          window.UD.clanId   = null;
          window.UD.clan_id  = null;
        }
        _t('Clan chhod diya!', 'ok');
        if (window.closeModal) closeModal();
      }
    };

    /* ──────────────────────────────────────────────────────
       DISBAND CLAN — Supabase only
    ────────────────────────────────────────────────────── */
    window.disbandClan = function(clanId) {
      if (!_s() || !_uid()) return;
      if (!confirm('DISBAND CLAN? Yeh clan aur sare members permanently remove honge!')) return;
      var uid = _uid();

      /* Step 1: clear all users' clan_id */
      _s().from('users').update({ clan_id: null }).eq('clan_id', clanId)
        .then(function() {
          /* Step 2: delete all members */
          return _s().from('clan_members').delete().eq('clan_id', clanId);
        })
        .then(function() {
          /* Step 3: delete clan (leader check) */
          return _s().from('clans').delete().eq('id', clanId).eq('leader_uid', uid);
        })
        .then(function() {
          if (window.UD) {
            delete window.UD.clanId;
            delete window.UD.clan_id;
            window.UD.clanId   = null;
            window.UD.clan_id  = null;
          }
          _t('Clan disband kar diya!', 'ok');
          if (window.closeModal) closeModal();
        })
        .catch(function(e) { _t('Disband error: ' + (e.message || 'retry karo'), 'err'); });
    };

    /* ──────────────────────────────────────────────────────
       KICK MEMBER — Supabase only
    ────────────────────────────────────────────────────── */
    window.kickClanMember = function(clanId, memberUid) {
      if (!_s() || !_uid()) return;

      _s().from('clan_members').delete()
        .eq('clan_id', clanId).eq('user_id', memberUid)
        .then(function() {
          return _s().from('users').update({ clan_id: null })
            .eq('id', memberUid);
        })
        .then(function() {
          /* Decrement member count */
          return _s().from('clans')
            .select('total_members')
            .eq('id', clanId)
            .single();
        })
        .then(function(r) {
          var cur = (r.data && r.data.total_members) || 1;
          return _s().from('clans')
            .update({ total_members: Math.max(0, cur - 1) })
            .eq('id', clanId);
        })
        .then(function() {
          _t('Member kick kar diya!', 'ok');
          if (window.closeModal) closeModal();
          setTimeout(function() { if (window.showClanHome) showClanHome(); }, 300);
        })
        .catch(function(e) { _t('Kick error: ' + (e.message || 'retry karo'), 'err'); });
    };

    console.log('[V30 #1] leaveClan / disbandClan / kickClanMember Supabase ✅');

    /* ──────────────────────────────────────────────────────
       CLAN LEADERBOARD — Supabase only
    ────────────────────────────────────────────────────── */
    window.showClanLeaderboardFull = function() {
      if (!_s()) { _t('Service unavailable', 'err'); return; }
      var GDI = window.GDI || function(s) {
        return '<img src="js/green-diamond.png" style="width:'+(s||14)+'px;height:'+(s||14)+'px;vertical-align:middle">';
      };

      _s().from('clans')
        .select('id, name, emblem, badge, tag, weekly_score, total_wins, total_members')
        .order('weekly_score', { ascending: false })
        .limit(20)
        .then(function(r) {
          var clans   = r.data || [];
          var myClanId = (window.UD && (window.UD.clanId || window.UD.clan_id)) || '';
          var rewards  = [500, 300, 200, 0, 0, 0, 0, 0, 0, 50];

          var h = '<div style="font-size:11px;color:#666;margin-bottom:10px">Weekly rewards: Top 3 clans ko Green Diamonds (Monday reset)</div>';

          if (!clans.length) {
            h += '<div style="text-align:center;padding:24px;color:#666">Abhi koi clan nahi hai!</div>';
          } else {
            clans.forEach(function(clan, idx) {
              var rank  = idx + 1;
              var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
              var myC   = clan.id === myClanId;
              var rew   = rewards[Math.min(9, idx)] || 0;
              var em    = clan.emblem || clan.badge || '🏰';
              var mc    = clan.total_members || 0;
              var bg    = myC ? '.07' : rank <= 3 ? '.06' : '.04';
              var bdr   = myC ? '.15' : rank <= 3 ? '.1' : '.06';

              h += '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:13px;background:rgba(255,255,255,' + bg + ');border:1px solid rgba(255,255,255,' + bdr + ');margin-bottom:8px">';
              h += '<div style="font-size:22px;width:32px;text-align:center">' + medal + '</div>';
              h += '<div style="font-size:24px">' + em + '</div>';
              h += '<div style="flex:1">';
              h += '<div style="font-size:14px;font-weight:800;color:#fff">' + (clan.name || 'Clan') + (myC ? ' (Aapka)' : '') + '</div>';
              h += '<div style="font-size:10px;color:#888">' + mc + ' members &bull; ' + GDI(11) + ' ' + (clan.weekly_score || 0) + ' pts</div>';
              h += '</div>';
              if (rew) {
                h += '<div style="text-align:right">';
                h += '<div style="font-size:12px;font-weight:800;color:#00ff64">' + GDI(13) + ' ' + rew + '</div>';
                h += '<div style="font-size:9px;color:#555">weekly</div>';
                h += '</div>';
              }
              h += '</div>';
            });
          }

          if (window.openModal) openModal('🏆 Clan Leaderboard', h);
        })
        .catch(function() { _t('Leaderboard load nahi hua', 'err'); });
    };

    console.log('[V30 #1] showClanLeaderboardFull Supabase ✅');

    /* ──────────────────────────────────────────────────────
       CLAN CHAT — Supabase Realtime (not Firebase clanChats/)
    ────────────────────────────────────────────────────── */
    window.showClanChat = function(clanId) {
      if (!_s() || !_uid()) return;
      var uid  = _uid();
      var ign  = _ign();
      var _ch  = null;   /* Realtime channel reference */

      /* Build chat UI */
      var h = '<div id="_clanChatMsgs" style="height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 0;margin-bottom:12px"></div>';
      h += '<div style="display:flex;gap:8px">';
      h += '<input id="_ccInput" type="text" maxlength="100" placeholder="Message likho..."';
      h += ' style="flex:1;padding:10px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;font-size:13px"';
      h += ' onkeydown="if(event.key===\'Enter\')window._sendClanMsg(\''+clanId+'\')">';
      h += '<button onclick="window._sendClanMsg(\''+clanId+'\')" style="padding:10px 16px;border-radius:11px;border:none;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#000;font-weight:900;cursor:pointer;font-size:13px">Send</button>';
      h += '</div>';

      if (window.openModal) openModal('💬 Clan Chat', h);

      /* Load last 50 messages */
      _s().from('clan_messages')
        .select('id, sender_id, sender_ign, message, created_at')
        .eq('clan_id', clanId)
        .order('created_at', { ascending: true })
        .limit(50)
        .then(function(r) {
          var el = document.getElementById('_clanChatMsgs');
          if (!el) return;
          (r.data || []).forEach(function(m) { _appendMsg(m, el, uid); });
          el.scrollTop = el.scrollHeight;
        });

      /* Supabase Realtime subscription — listen for new messages */
      try {
        _ch = _s().channel('clan_chat_' + clanId)
          .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'clan_messages',
            filter: 'clan_id=eq.' + clanId
          }, function(payload) {
            var el = document.getElementById('_clanChatMsgs');
            if (!el) { if (_ch) { try { _ch.unsubscribe(); } catch(e){} } return; }
            _appendMsg(payload.new, el, uid);
            el.scrollTop = el.scrollHeight;
          })
          .subscribe(function(status) {
            if (status === 'CHANNEL_ERROR') {
              console.warn('[V30] Clan chat realtime failed — using polling fallback');
              _startChatPoll(clanId, uid);
            }
          });
      } catch(e) {
        console.warn('[V30] Realtime subscribe error:', e.message);
        _startChatPoll(clanId, uid);
      }

      /* Intercept closeModal to unsubscribe */
      var _prevClose = window.closeModal;
      window.closeModal = function() {
        if (_ch) { try { _ch.unsubscribe(); } catch(e){} _ch = null; }
        window.closeModal = _prevClose;
        if (_prevClose) _prevClose();
      };

      /* Send message */
      window._sendClanMsg = function(cid) {
        var inp = document.getElementById('_ccInput');
        if (!inp || !inp.value.trim()) return;
        var msg = inp.value.trim().substr(0, 100);
        inp.value = '';
        _s().from('clan_messages').insert({
          clan_id:    cid,
          sender_id:  uid,
          sender_ign: ign,
          message:    msg
        }).then(null, function() { _t('Message send nahi hua', 'err'); });
      };
    };

    /* Polling fallback for Realtime failures */
    var _chatPollLast = null;
    function _startChatPoll(clanId, uid) {
      var piv = setInterval(function() {
        var el = document.getElementById('_clanChatMsgs');
        if (!el) { clearInterval(piv); return; }
        var q = _s().from('clan_messages')
          .select('id, sender_id, sender_ign, message, created_at')
          .eq('clan_id', clanId)
          .order('created_at', { ascending: true })
          .limit(50);
        if (_chatPollLast) q = q.gt('created_at', _chatPollLast);
        q.then(function(r) {
          (r.data || []).forEach(function(m) {
            _appendMsg(m, el, uid);
            _chatPollLast = m.created_at;
          });
          if (r.data && r.data.length) el.scrollTop = el.scrollHeight;
        });
      }, 4000);
    }

    /* Append a message bubble (safe — escapes user content) */
    function _appendMsg(m, el, myUid) {
      if (!el || !m) return;
      var isMe = m.sender_id === myUid;
      var safe = function(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      };
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;flex-direction:' + (isMe ? 'row-reverse' : 'row') + ';gap:6px;align-items:flex-end';
      div.innerHTML =
        '<div style="max-width:75%;padding:8px 12px;border-radius:' +
        (isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px') +
        ';background:' + (isMe ? 'rgba(0,212,255,.15)' : 'rgba(255,255,255,.07)') +
        ';border:1px solid ' + (isMe ? 'rgba(0,212,255,.25)' : 'rgba(255,255,255,.1)') + '">' +
        '<div style="font-size:10px;color:' + (isMe ? '#00d4ff' : '#888') + ';margin-bottom:3px;font-weight:700">' +
        (isMe ? 'You' : safe(m.sender_ign || 'Player')) + '</div>' +
        '<div style="font-size:12px;color:#ddd">' + safe(m.message) + '</div>' +
        '</div>';
      el.appendChild(div);
    }

    console.log('[V30 #1] showClanChat Supabase Realtime ✅');

    /* ──────────────────────────────────────────────────────
       UPDATE CLAN SCORE — Supabase atomic RPC
    ────────────────────────────────────────────────────── */
    window.updateClanScore = function(uid, kills, wins) {
      if (!_s() || !window.UD) return;
      var clanId = window.UD.clanId || window.UD.clan_id;
      if (!clanId) return;
      var score = (kills || 0) * 1 + (wins ? 1 : 0) * 5;

      _s().rpc('increment_clan_score', {
        p_clan_id: clanId,
        p_score:   score,
        p_wins:    wins  ? 1 : 0,
        p_kills:   kills || 0
      }).catch(function() {
        /* RPC fallback — read-modify-write */
        _s().from('clans')
          .select('weekly_score, total_wins, total_kills')
          .eq('id', clanId).single()
          .then(function(r) {
            if (!r.data) return;
            _s().from('clans').update({
              weekly_score: (r.data.weekly_score || 0) + score,
              total_wins:   (r.data.total_wins   || 0) + (wins  ? 1 : 0),
              total_kills:  (r.data.total_kills  || 0) + (kills || 0)
            }).eq('id', clanId).then(null, function(){});
          });
      });
    };

    console.log('[V30 #1] updateClanScore Supabase ✅');

    /* ──────────────────────────────────────────────────────
       Also update showJoinClanByCode invite display
       Use join_code instead of UUID prefix
    ────────────────────────────────────────────────────── */
    var _origShowJoinByCode = window.showJoinClanByCode;
    window.showJoinClanByCode = function() {
      var h = '<div style="font-size:13px;color:#aaa;margin-bottom:12px">Dost ne invite code diya hoga — woh daalo:</div>';
      h += '<input id="_cCode" type="text" maxlength="8" placeholder="8-char code (e.g. AB12CD34)"';
      h += ' style="width:100%;padding:12px;border-radius:12px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;font-size:16px;letter-spacing:2px;text-align:center;box-sizing:border-box;text-transform:uppercase;margin-bottom:16px">';
      h += '<button onclick="window._doJoinByCode()" style="width:100%;padding:14px;border-radius:13px;border:1.5px solid rgba(0,212,255,.3);background:rgba(0,212,255,.07);color:#00d4ff;font-size:14px;font-weight:900;cursor:pointer">Join Karo →</button>';
      if (window.openModal) openModal('🔑 Code se Join', h);
    };

    /* Also patch invite code display in _showMyClan (shows join_code not UUID prefix) */
    var _origShowClanHome = window.showClanHome;
    window.showClanHome = function() {
      if (!window.U || !window.UD) {
        _t('Pehle login karo!', 'err'); return;
      }
      window.getUserClan(function(clan) {
        if (clan) {
          /* Inject correct join_code into clan object for display */
          if (!clan.join_code) {
            clan.join_code = (clan.id || '').replace(/-/g, '').substr(0, 8).toUpperCase();
          }
          /* Patch the invite code display in the existing UI by modifying
             the rendered HTML after the original function renders */
          _origShowClanHome && _origShowClanHome();
          /* Actually, _origShowClanHome calls getUserClan(cb) which we now control,
             so it will correctly get the Supabase data. But it still shows
             (clan._id||'').substring(0,8) for the invite code. Intercept openModal. */
          var _prevOpen = window.openModal;
          window.openModal = function(title, html) {
            /* Replace the UUID-based invite code with join_code */
            if (clan.join_code && html && html.indexOf('Clan Invite Code') !== -1) {
              /* The invite code div shows first 8 chars of _id */
              var oldCode = (clan._id || '').substr(0, 8).toUpperCase();
              if (oldCode && clan.join_code !== oldCode) {
                html = html.replace(oldCode, clan.join_code);
              }
            }
            window.openModal = _prevOpen;
            if (_prevOpen) _prevOpen(title, html);
          };
        } else {
          _origShowClanHome && _origShowClanHome();
        }
      });
    };

    console.log('[V30 #1] showClanHome join_code display patch ✅');

  });  /* end waitFor clan */


  /* ════════════════════════════════════════════════════════
     BUG #36 — ADMIN ROLE CHECKS
     getPendingJoinRequests, getCreatorApplications,
     setCreatorStatus — add is_admin validation
  ════════════════════════════════════════════════════════ */

  waitFor(
    function() { return window.DB && window.DB.admin; },
    function() {

    async function _checkAdmin() {
      if (!_s() || !_uid()) return false;
      try {
        var r = await _s().from('users')
          .select('is_admin')
          .eq('id', _uid())
          .maybeSingle();
        return !!(r.data && r.data.is_admin);
      } catch(e) { return false; }
    }

    /* Patch getPendingJoinRequests */
    var _orig_GPJR = window.DB.admin.getPendingJoinRequests;
    window.DB.admin.getPendingJoinRequests = async function() {
      if (!(await _checkAdmin())) {
        console.warn('[V30 #36] getPendingJoinRequests: access denied (not admin)');
        return [];
      }
      return _orig_GPJR ? _orig_GPJR.apply(window.DB.admin, arguments) : [];
    };

    /* Patch getCreatorApplications */
    var _orig_GCA = window.DB.admin.getCreatorApplications;
    window.DB.admin.getCreatorApplications = async function() {
      if (!(await _checkAdmin())) {
        console.warn('[V30 #36] getCreatorApplications: access denied (not admin)');
        return [];
      }
      return _orig_GCA ? _orig_GCA.apply(window.DB.admin, arguments) : [];
    };

    /* Patch setCreatorStatus */
    var _orig_SCS = window.DB.admin.setCreatorStatus;
    window.DB.admin.setCreatorStatus = async function(appId, status, note) {
      if (!(await _checkAdmin())) {
        console.warn('[V30 #36] setCreatorStatus: access denied (not admin)');
        return null;
      }
      return _orig_SCS ? _orig_SCS.apply(window.DB.admin, arguments) : null;
    };

    console.log('[V30 #36] Admin role checks: getPendingJoinRequests / getCreatorApplications / setCreatorStatus ✅');

  });  /* end waitFor admin */


  /* ════════════════════════════════════════════════════════
     BUG #34 — cJoin: Re-validate slots from Supabase on click
     Problem: slots checked at render time only.
     If match fills between render and click → error UX.
  ════════════════════════════════════════════════════════ */

  waitFor(
    function() { return window.cJoin !== undefined; },
    function() {

    var _origCJoin = window.cJoin;

    window.cJoin = function(matchId) {
      if (!_s() || !matchId) {
        /* No Supabase available — proceed with original (will fail server-side if full) */
        _origCJoin(matchId);
        return;
      }

      /* Re-check from Supabase before proceeding */
      _s().from('matches')
        .select('status, max_slots, filled_slots')
        .eq('id', matchId)
        .single()
        .then(function(r) {
          if (!r.data) {
            _t('Match nahi mila!', 'err');
            return;
          }
          var m      = r.data;
          var status = (m.status || '').toLowerCase();

          /* Check match status */
          if (status === 'cancelled') {
            _t('Match cancel ho gaya!', 'err');
            return;
          }
          if (status === 'completed') {
            _t('Match khatam ho gaya!', 'err');
            return;
          }
          if (status === 'live') {
            /* Live matches: check if match has actually started (past matchTime) */
            /* This is handled inside _origCJoin — allow through */
          }

          /* Check slots */
          var filled = Number(m.filled_slots) || 0;
          var max    = Number(m.max_slots)    || 100;
          if (filled >= max) {
            _t('Match full ho gaya! (' + filled + '/' + max + ')', 'err');
            /* Disable the button in UI */
            try {
              var btns = document.querySelectorAll(
                'button[onclick*="cJoin(\'' + matchId + '\'"],' +
                'button[onclick*="cJoin(\''+matchId+'\')"]'
              );
              btns.forEach(function(b) {
                b.disabled = true;
                b.textContent = 'Full';
                b.style.cssText += ';opacity:.5;cursor:not-allowed';
              });
            } catch(e) {}
            return;
          }

          /* All checks passed — proceed */
          _origCJoin(matchId);
        })
        .catch(function() {
          /* Supabase unreachable — proceed anyway (server RPC will handle validation) */
          _origCJoin(matchId);
        });
    };

  console.log('[V30 #34] cJoin Supabase re-validate slots on click ✅');

  });  /* end waitFor cJoin */


  /* ════════════════════════════════════════════════════════
     BUG #11 — Avatar bg color: read from Supabase after save
     fixes-v9.js writes to both Firebase + Supabase.
     Fix: After save, re-fetch user from Supabase to update UD.
  ════════════════════════════════════════════════════════ */

  waitFor(
    function() { return window._supa && window.showAvatarBgPicker !== undefined; },
    function() {
      var _origPicker = window.showAvatarBgPicker;
      window.showAvatarBgPicker = function() {
        /* Load current bg from Supabase users (canonical source) */
        if (window._supa && window.U) {
          window._supa.from('users').select('avatar_bg_color').eq('id', window.U.uid).maybeSingle()
            .then(function(r) {
              if (r.data && r.data.avatar_bg_color) {
                if (window.UD) window.UD.avatarBgColor = r.data.avatar_bg_color;
              }
            }).catch(function(){});
        }
        if (_origPicker) _origPicker();
      };
      console.log('[V30 #11] Avatar bg color reads from Supabase ✅');
    }
  );  /* end waitFor showAvatarBgPicker */


  /* ════════════════════════════════════════════════════════
     SUMMARY
  ════════════════════════════════════════════════════════ */
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  MiniESports BUGFIX v30 FINAL loaded                 ║');
  console.log('║  Bug #1   : Clan 100% Supabase ✅                    ║');
  console.log('║  Bug #1a  : getUserClan signature fixed ✅           ║');
  console.log('║  Bug #7   : Clan Chat Supabase Realtime ✅           ║');
  console.log('║  Bug #11  : Avatar bg Supabase sync ✅               ║');
  console.log('║  Bug #36  : Admin role checks ✅                     ║');
  console.log('║  Bug #34  : cJoin re-validates on click ✅           ║');
  console.log('╚══════════════════════════════════════════════════════╝');

})();
