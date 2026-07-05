/* ====================================================================
   MATCH RESULT — FULL SCREEN PAGE  (screenshots jaisa)
   - Modal nahi — dedicated fullscreen slide-in screen
   - Screenshot 3 jaisa: Player card with rank, kills, winnings
   - Share Card button
   - Back button se wapas My Matches
   ==================================================================== */
(function () {
  'use strict';

  /* ── Helper: rank medal ── */
  function rankMedal(r) {
    r = Number(r);
    if (r === 1) return '🥇';
    if (r === 2) return '🥈';
    if (r === 3) return '🥉';
    return '#' + (r || '?');
  }

  /* ── Show fullscreen result page ── */
  window.showResultPage = function (matchId) {
    var t = window.MT && window.MT[matchId];
    var db = window.db; var U = window.U; var UD = window.UD;
    if (!db || !U) return;

    /* Remove existing */
    var old = document.getElementById('_resultPage');
    if (old) old.remove();

    /* Create overlay */
    var page = document.createElement('div');
    page.id = '_resultPage';
    page.style.cssText = [
      'position:fixed;inset:0;z-index:99970;',
      'background:#050507;overflow-y:auto;',
      'animation:resultPageIn .3s ease'
    ].join('');

    page.innerHTML = '<div style="text-align:center;padding:80px 20px;color:#555;font-size:14px"><i class="fas fa-spinner fa-spin"></i> Loading result...</div>';

    if (!document.getElementById('_resultPageStyle')) {
      var st = document.createElement('style');
      st.id = '_resultPageStyle';
      st.textContent = '@keyframes resultPageIn{from{transform:translateX(100%)}to{transform:translateX(0)}}';
      document.head.appendChild(st);
    }

    document.body.appendChild(page);
    history.pushState(null, null, null);

    /* Back button closes page */
    window.addEventListener('popstate', function _popH() {
      window.removeEventListener('popstate', _popH);
      var p = document.getElementById('_resultPage');
      if (p) p.remove();
    });

    /* Fetch result data */
    db.ref('matches/' + matchId + '/results/' + U.uid).once('value', function (s) {
      var r = s.exists() ? s.val() : null;
      if (!r) {
        /* fallback */
        db.ref('results').orderByChild('userId').equalTo(U.uid).once('value', function (rs) {
          var found = null;
          if (rs.exists()) rs.forEach(function (c) { var v = c.val(); if (v.matchId === matchId) found = v; });
          if (found) { renderResultPage(page, found, t, matchId); }
          else { page.innerHTML = _noResultHTML(); }
        });
        return;
      }
      renderResultPage(page, r, t, matchId);
    });
  };

  /* Keep backward compat */
  window.showResultDetail = window.showResultPage;

  /* ── Render full page HTML ── */
  function renderResultPage(page, r, t, matchId) {
    var UD = window.UD || {};
    var totalWin = Number(r.totalWinning) || (Number(r.winnings || 0) + Number(r.killPrize || 0));
    var rank     = Number(r.rank) || 0;
    var kills    = Number(r.kills) || 0;
    var matchName = (t && t.name) || r.matchName || 'Match';
    var mode      = ((t && (t.mode || t.type)) || r.mode || 'solo').toLowerCase();
    var isTeam    = (mode === 'duo' || mode === 'squad');
    var won       = rank === 1;
    var playerName = UD.ign || UD.displayName || 'Player';
    var ffUid      = UD.ffUid || UD.uid || '';
    var tier       = _getTier(UD.stats || {});

    /* Rank card colors */
    var rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#00d4ff';

    var h = '';

    /* ── Top bar ── */
    h += '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.06)">';
    h += '<button onclick="history.back()" style="background:rgba(255,255,255,.07);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center"><i class="fas fa-arrow-left"></i></button>';
    h += '<div style="flex:1;font-size:15px;font-weight:800;color:#fff">Match Result</div>';
    h += '</div>';

    /* ── Hero card — screenshot 3 jaisa ── */
    h += '<div style="margin:16px;border-radius:20px;overflow:hidden;position:relative">';

    /* Background image overlay */
    h += '<div style="background:linear-gradient(180deg,#0d0d2e 0%,#1a0a2e 50%,#0a1a1a 100%);padding:24px 20px 20px;position:relative">';

    /* Glow effects */
    h += '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(185,100,255,.2) 0%,transparent 60%),radial-gradient(ellipse at 50% 100%,rgba(0,212,255,.15) 0%,transparent 60%);pointer-events:none"></div>';

    /* Border frame */
    h += '<div style="position:absolute;inset:0;border:2px solid rgba(185,100,255,.3);border-radius:20px;pointer-events:none"></div>';

    /* Avatar */
    h += '<div style="text-align:center;margin-bottom:14px;position:relative;z-index:1">';
    var avatarSrc = UD.profileImage || UD.photoURL || '';
    if (avatarSrc) {
      h += '<img src="' + avatarSrc + '" style="width:72px;height:72px;border-radius:50%;border:3px solid ' + rankColor + ';object-fit:cover;box-shadow:0 0 20px ' + rankColor + '55">';
    } else {
      var initLetter = (playerName.charAt(0) || 'P').toUpperCase();
      h += '<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#b964ff);border:3px solid ' + rankColor + ';display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;margin:0 auto;box-shadow:0 0 20px ' + rankColor + '55">' + initLetter + '</div>';
    }
    h += '</div>';

    /* Player name + title */
    h += '<div style="text-align:center;margin-bottom:6px;position:relative;z-index:1">';
    h += '<div style="font-size:22px;font-weight:900;color:#fff">' + playerName + '</div>';
    h += '<div style="font-size:12px;color:#888;margin-top:2px">FE UID: ' + ffUid + '</div>';
    h += '</div>';

    /* Tier badge */
    h += '<div style="text-align:center;margin-bottom:16px;position:relative;z-index:1">';
    h += '<span style="display:inline-block;padding:4px 16px;border-radius:20px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);font-size:12px;font-weight:700;color:#ffd700">' + tier + '</span>';
    h += '</div>';

    /* Stats row */
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;position:relative;z-index:1">';
    /* Matches */
    h += '<div style="background:rgba(0,100,200,.25);border:1px solid rgba(0,150,255,.3);border-radius:12px;padding:12px 8px;text-align:center">';
    h += '<div style="font-size:22px;font-weight:900;color:#fff">' + ((UD.stats && UD.stats.matches) || 0) + '</div>';
    h += '<div style="font-size:10px;color:#888;margin-top:3px">Matches</div>';
    h += '</div>';
    /* Wins */
    h += '<div style="background:rgba(0,180,80,.2);border:1px solid rgba(0,220,100,.3);border-radius:12px;padding:12px 8px;text-align:center">';
    h += '<div style="font-size:22px;font-weight:900;color:#00ff9c">' + rank + '</div>';
    h += '<div style="font-size:10px;color:#888;margin-top:3px">Rank</div>';
    h += '</div>';
    /* Kills */
    h += '<div style="background:rgba(200,0,60,.2);border:1px solid rgba(255,60,60,.3);border-radius:12px;padding:12px 8px;text-align:center">';
    h += '<div style="font-size:22px;font-weight:900;color:#ff6b6b">' + kills + '</div>';
    h += '<div style="font-size:10px;color:#888;margin-top:3px">Kills</div>';
    h += '</div>';
    h += '</div>';

    /* Win rate */
    var wr = 0;
    if (UD.stats && UD.stats.matches > 0) wr = Math.round((UD.stats.wins / UD.stats.matches) * 100);
    h += '<div style="text-align:center;font-size:13px;font-weight:700;color:#888;margin-bottom:8px;position:relative;z-index:1">';
    h += 'Win Rate: <span style="color:' + (wr >= 30 ? '#00ff9c' : '#ffd700') + '">' + wr + '%</span>';
    h += '</div>';

    /* Prize earned */
    if (totalWin > 0) {
      h += '<div style="background:linear-gradient(135deg,rgba(0,255,156,.12),rgba(0,212,255,.06));border:1px solid rgba(0,255,156,.25);border-radius:14px;padding:12px;text-align:center;margin-bottom:12px;position:relative;z-index:1">';
      h += '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Prize Won</div>';
      h += '<div style="font-size:28px;font-weight:900;background:linear-gradient(135deg,#00ff9c,#00d4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent">💎 ' + totalWin + '</div>';
      h += '</div>';
    }

    /* Match info */
    h += '<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:10px 14px;position:relative;z-index:1;margin-bottom:4px">';
    h += '<div style="font-size:12px;color:#888;margin-bottom:4px">' + matchName + '</div>';
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
    h += '<span style="font-size:11px;color:#ccc">🏆 Rank: <b style="color:' + rankColor + '">' + rankMedal(rank) + '</b></span>';
    h += '<span style="font-size:11px;color:#ccc">💀 Kills: <b style="color:#ff6b6b">' + kills + '</b></span>';
    if (r.killPrize > 0) h += '<span style="font-size:11px;color:#ccc">🔫 Kill Prize: <b style="color:#ffd700">💎' + r.killPrize + '</b></span>';
    h += '</div>';
    h += '</div>';

    h += '</div>'; /* bg */
    h += '</div>'; /* card */

    /* ── Share Card button ── */
    h += '<div style="padding:0 16px 16px;display:flex;flex-direction:column;gap:10px">';
    h += '<button onclick="window._shareResultCard&&window._shareResultCard(\'' + matchId + '\')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00d4ff);border:none;color:#000;font-weight:900;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-share-alt"></i> Share Card</button>';
    h += '</div>';

    page.innerHTML = h;
  }

  /* ── Share result card ── */
  window._shareResultCard = function (matchId) {
    var r = window._lastResultData;
    var t = window.MT && window.MT[matchId];
    var UD = window.UD || {};
    if (!r) { if (window.toast) window.toast('Result data nahi mila', 'err'); return; }

    var text = '🎮 Mini eSports — Match Result!\n\n' +
      '🏆 ' + (t ? t.name : 'Match') + '\n' +
      '📊 Rank: ' + rankMedal(r.rank) + '\n' +
      '💀 Kills: ' + (r.kills || 0) + '\n' +
      (r.totalWinning > 0 ? '💰 Won: 💎' + r.totalWinning + '\n' : '') +
      '\n🔥 Play on Mini eSports and win real cash!\n' + window.location.origin;

    if (navigator.share) {
      navigator.share({ title: 'My Match Result', text: text }).catch(function () {
        if (window.copyTxt) window.copyTxt(text);
        if (window.toast) window.toast('Result copied!', 'ok');
      });
    } else {
      if (window.copyTxt) window.copyTxt(text);
      if (window.toast) window.toast('Result copied!', 'ok');
    }
  };

  function _getTier(stats) {
    var m  = Number(stats.matches) || 0;
    var w  = Number(stats.wins)    || 0;
    var wr = m > 0 ? (w / m) * 100 : 0;
    if (m >= 100 && wr >= 50) return '👑 Legend';
    if (m >= 50  && wr >= 35) return '🥇 Gold';
    if (m >= 20  && wr >= 20) return '🥈 Silver';
    if (m >= 5)               return '🥉 Bronze';
    return '🎮 Rookie';
  }

  function _noResultHTML() {
    return '<div style="text-align:center;padding:60px 20px">' +
      '<div style="font-size:48px;margin-bottom:16px">⏳</div>' +
      '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px">Result abhi publish nahi hua</div>' +
      '<div style="font-size:13px;color:#888">Admin result publish karne ke baad yahan dikhega</div>' +
      '<button onclick="history.back()" style="margin-top:20px;padding:12px 28px;border-radius:12px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);color:#00ff9c;font-weight:700;cursor:pointer">← Wapas Jao</button>' +
      '</div>';
  }

  console.log('[Mini eSports] ✅ Match Result Page loaded — fullscreen, no modal');
})();
