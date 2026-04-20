/* ================================================================
   USER FEATURES BUNDLE f100–f109
   f100: Achievement Celebration (confetti animation on unlock)
   f101: Smart Search (match name, prize, mode in one field)
   f102: Haptic Feedback on important actions
   f103: Earnings Forecast card
   f104: Rival Auto-Suggest (close rank players)
   f105: Friend Activity Feed
   f106: Rank Change Alert
   f107: Streak Protection Alert
   f108: Auto Withdrawal Suggestion (when winnings >= ₹100)
   f109: Team Chemistry Score
   ================================================================ */

/* ─────────────────────────────────────────────────────────────
   f100: ACHIEVEMENT CELEBRATION — Confetti + sound on unlock
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  window.f100_celebrate = function (title, subtitle) {
    var canvas = document.getElementById('_f100Canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = '_f100Canvas';
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99996';
      document.body.appendChild(canvas);
    }

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    var ctx = canvas.getContext('2d');
    var pieces = [];
    var colors = ['#00ff9c','#ffd700','#ff6b6b','#00d4ff','#b964ff','#ff8c00'];

    for (var i = 0; i < 80; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 8,
        w: Math.random() * 10 + 5,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1
      });
    }

    var frame = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(function (p) {
        p.x  += p.vx; p.y += p.vy; p.rot += p.vr;
        p.vy += 0.08;
        if (frame > 60) p.alpha -= 0.015;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      });
      frame++;
      if (frame < 120) requestAnimationFrame(draw);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }
    draw();

    // Toast
    if (window.toast) window.toast('🎉 ' + (title || 'Achievement Unlock!'), 'ok');

    // Vibrate
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  // Hook into achievements system if exists
  if (window.f23_unlockAchievement) {
    var _orig = window.f23_unlockAchievement;
    window.f23_unlockAchievement = function (id, title) {
      window.f100_celebrate(title || id);
      return _orig.apply(this, arguments);
    };
  }

  console.log('[f100] ✅ Achievement Celebration loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f101: SMART SEARCH
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  window.f101_smartSearch = function (query) {
    query = (query || '').trim().toLowerCase();
    if (!query) { window.f101_clearSearch(); return; }

    var matchCards = document.querySelectorAll('.match-card,[data-match-id],.tournament-card');
    var found = 0;

    matchCards.forEach(function (card) {
      var text = card.textContent.toLowerCase();
      var visible = text.includes(query);
      card.style.display = visible ? '' : 'none';
      if (visible) found++;
    });

    // Show count
    var countEl = document.getElementById('_f101Count');
    if (!countEl) {
      countEl = document.createElement('div');
      countEl.id = '_f101Count';
      countEl.style.cssText = 'font-size:11px;color:#888;text-align:center;padding:4px;';
      var searchBar = document.getElementById('_f101SearchBar');
      if (searchBar) searchBar.parentNode.insertBefore(countEl, searchBar.nextSibling);
    }
    countEl.textContent = found + ' result' + (found !== 1 ? 's' : '') + ' for "' + query + '"';
  };

  window.f101_clearSearch = function () {
    document.querySelectorAll('.match-card,[data-match-id],.tournament-card').forEach(function (c) { c.style.display = ''; });
    var el = document.getElementById('_f101Count');
    if (el) el.textContent = '';
  };

  function injectSearchBar() {
    if (document.getElementById('_f101SearchBar')) return;
    var header = document.getElementById('header') || document.querySelector('.screen-header');
    if (!header) return;

    var bar = document.createElement('div');
    bar.id = '_f101SearchBar';
    bar.style.cssText = 'padding:0 16px 10px;';
    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 14px">' +
        '<span style="color:#555;font-size:14px">🔍</span>' +
        '<input id="_f101Input" type="text" placeholder="Search matches, mode, prize..." ' +
          'style="flex:1;background:none;border:none;outline:none;color:#fff;font-size:13px" ' +
          'oninput="window.f101_smartSearch(this.value)">' +
        '<span id="_f101ClearBtn" onclick="document.getElementById(\'_f101Input\').value=\'\';window.f101_clearSearch()" ' +
          'style="color:#444;cursor:pointer;font-size:16px;display:none">✕</span>' +
      '</div>';

    // Show/hide clear btn
    bar.addEventListener('input', function (e) {
      var cl = document.getElementById('_f101ClearBtn');
      if (cl) cl.style.display = e.target.value ? 'block' : 'none';
    });

    var homeScreen = document.getElementById('homeScreen');
    if (homeScreen) homeScreen.insertBefore(bar, homeScreen.firstChild);
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD) { clearInterval(_iv); setTimeout(injectSearchBar, 1500); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f101] ✅ Smart Search loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f102: HAPTIC FEEDBACK
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  window.f102_haptic = function (pattern) {
    if (!navigator.vibrate) return;
    pattern = pattern || [30];
    navigator.vibrate(pattern);
  };

  // Attach to key actions via event delegation
  document.addEventListener('click', function (e) {
    if (!navigator.vibrate) return;
    var target = e.target;
    if (!target) return;

    // Match join button
    if (target.closest('.join-btn') || (target.closest('button') && target.textContent.toLowerCase().includes('join'))) {
      navigator.vibrate([50]);
      return;
    }
    // Nav tabs
    if (target.closest('.nav-item')) {
      navigator.vibrate([15]);
      return;
    }
    // Copy / share
    if (target.textContent.toLowerCase().includes('copy') || target.closest('.copy-btn')) {
      navigator.vibrate([20, 10, 20]);
      return;
    }
  });

  console.log('[f102] ✅ Haptic Feedback loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f103: EARNINGS FORECAST CARD
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  window.f103_renderForecast = function (containerId) {
    var UD = window.UD;
    if (!UD) return;
    var el = document.getElementById(containerId);
    if (!el) return;

    var stats    = UD.stats || {};
    var matches  = Number(stats.matches)  || 0;
    var earnings = Number(stats.earnings) || 0;

    if (matches < 3) {
      el.innerHTML = '<div style="font-size:11px;color:#555;text-align:center;padding:10px">Play 3+ matches to see earnings forecast</div>';
      return;
    }

    var avgPerMatch = earnings / matches;
    var weeklyEst   = Math.round(avgPerMatch * 14); // assume ~2 matches/day, 7 days
    var monthlyEst  = Math.round(avgPerMatch * 60);

    el.innerHTML =
      '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,215,0,.12);border-radius:16px;padding:14px;margin:10px 0">' +
        '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:10px">📊 Earnings Forecast</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px;text-align:center">' +
            '<div style="font-size:10px;color:#888;margin-bottom:4px">Weekly (est.)</div>' +
            '<div style="font-size:18px;font-weight:900;color:#ffd700">₹' + weeklyEst + '</div>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px;text-align:center">' +
            '<div style="font-size:10px;color:#888;margin-bottom:4px">Monthly (est.)</div>' +
            '<div style="font-size:18px;font-weight:900;color:#00ff9c">₹' + monthlyEst + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:10px;color:#444;margin-top:8px;text-align:center">Based on your ₹' + earnings + ' earned in ' + matches + ' matches</div>' +
      '</div>';
  };

  function tryInject() {
    var profileEl = document.getElementById('profileScreen') || document.querySelector('.profile-content');
    if (profileEl && !document.getElementById('f103ForecastCard')) {
      var div = document.createElement('div');
      div.id = 'f103ForecastCard';
      profileEl.appendChild(div);
    }
    if (document.getElementById('f103ForecastCard') && window.UD) window.f103_renderForecast('f103ForecastCard');
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD) { clearInterval(_iv); setTimeout(tryInject, 2000); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f103] ✅ Earnings Forecast loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f104: RIVAL AUTO-SUGGEST
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  window.f104_findRivals = function (containerId) {
    var db = window.db; var UD = window.UD; var U = window.U;
    if (!db || !UD || !U) return;
    var el = document.getElementById(containerId);
    if (!el) return;

    var myMatches = Number((UD.stats || {}).matches) || 0;
    var myWins    = Number((UD.stats || {}).wins)    || 0;
    var myWR      = myMatches > 0 ? (myWins / myMatches) * 100 : 0;

    // Find users with similar stats
    db.ref('users').orderByChild('stats/matches').startAt(Math.max(0, myMatches - 10)).endAt(myMatches + 10).limitToFirst(10).once('value', function (snap) {
      var rivals = [];
      if (snap.exists()) {
        snap.forEach(function (c) {
          if (c.key === U.uid) return;
          var u = c.val();
          var uM  = Number((u.stats || {}).matches) || 0;
          var uW  = Number((u.stats || {}).wins)    || 0;
          var uWR = uM > 0 ? (uW / uM) * 100 : 0;
          if (Math.abs(uWR - myWR) < 15) rivals.push({ name: u.ign || u.displayName || 'Player', matches: uM, wr: Math.round(uWR) });
        });
      }

      if (!rivals.length) { el.innerHTML = ''; return; }
      rivals = rivals.slice(0, 3);

      var cards = rivals.map(function (r) {
        return '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px;display:flex;align-items:center;gap:8px">' +
          '<div style="font-size:22px">⚔️</div>' +
          '<div style="flex:1">' +
            '<div style="font-size:12px;font-weight:700;color:#fff">' + r.name + '</div>' +
            '<div style="font-size:10px;color:#888">' + r.matches + ' matches · ' + r.wr + '% WR</div>' +
          '</div>' +
          '<span style="font-size:10px;color:#ff6b6b;font-weight:700">RIVAL</span>' +
        '</div>';
      }).join('');

      el.innerHTML =
        '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,107,107,.15);border-radius:16px;padding:14px;margin:10px 0">' +
          '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:8px">⚔️ Your Rivals</div>' +
          '<div style="display:flex;flex-direction:column;gap:6px">' + cards + '</div>' +
        '</div>';
    });
  };

  function tryInject() {
    var profileEl = document.getElementById('profileScreen') || document.querySelector('.profile-content');
    if (profileEl && !document.getElementById('f104RivalsCard')) {
      var div = document.createElement('div');
      div.id = 'f104RivalsCard';
      profileEl.appendChild(div);
    }
    if (document.getElementById('f104RivalsCard') && window.UD) window.f104_findRivals('f104RivalsCard');
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.db) { clearInterval(_iv); setTimeout(tryInject, 2400); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f104] ✅ Rival Auto-Suggest loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f105: FRIEND ACTIVITY FEED (referral network wins)
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function loadFriendActivity() {
    var db = window.db; var UD = window.UD; var U = window.U;
    if (!db || !UD || !U) return;

    // Get users referred by current user
    db.ref('referrals').orderByChild('referrerId').equalTo(U.uid).limitToLast(10).once('value', function (snap) {
      if (!snap.exists()) return;

      var friendIds = [];
      snap.forEach(function (c) {
        var rid = c.val().referredId;
        if (rid && !friendIds.includes(rid)) friendIds.push(rid);
      });

      if (!friendIds.length) return;

      // Get recent wins from friends
      var since = Date.now() - 24 * 3600000; // last 24h
      var activities = [];
      var pending = friendIds.length;

      friendIds.forEach(function (fid) {
        db.ref('matchResults').orderByChild('uid').equalTo(fid).limitToLast(3).once('value', function (rs) {
          if (rs.exists()) {
            rs.forEach(function (c) {
              var d = c.val();
              if (d.timestamp >= since && (d.rank === 1 || d.rank === '1') && d.prize > 0) {
                activities.push({ name: d.playerName || 'Your friend', prize: d.prize, time: d.timestamp });
              }
            });
          }
          pending--;
          if (pending === 0 && activities.length > 0) showFriendFeed(activities);
        });
      });
    });
  }

  function showFriendFeed(activities) {
    activities.sort(function (a, b) { return b.time - a.time; });
    activities = activities.slice(0, 3);

    activities.forEach(function (act, i) {
      setTimeout(function () {
        var old = document.getElementById('_f105Feed' + i);
        if (old) old.remove();
        var el = document.createElement('div');
        el.id = '_f105Feed' + i;
        el.style.cssText = [
          'position:fixed;bottom:' + (90 + i * 58) + 'px;right:16px;',
          'background:#111118;border:1px solid rgba(255,215,0,.25);border-radius:14px;',
          'padding:10px 14px;max-width:250px;',
          'animation:f105In .3s ease;z-index:99990;',
          'box-shadow:0 4px 16px rgba(0,0,0,.5)'
        ].join('');
        el.innerHTML =
          '<style>@keyframes f105In{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}</style>' +
          '<div style="font-size:12px;color:#fff"><b style="color:#ffd700">' + act.name + '</b> won <b style="color:#00ff9c">₹' + act.prize + '</b>! 🎉</div>';
        document.body.appendChild(el);
        setTimeout(function () { if (el.parentNode) { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(function(){if(el.parentNode)el.remove();},300); } }, 4000);
      }, i * 1200);
    });
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.U && window.db) { clearInterval(_iv); setTimeout(loadFriendActivity, 3000); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f105] ✅ Friend Activity Feed loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f106: RANK CHANGE ALERT
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var _lastRank = null;

  function checkRankChange() {
    var db = window.db; var U = window.U;
    if (!db || !U) return;

    db.ref('leaderboard').orderByChild('coins').limitToLast(100).once('value', function (snap) {
      if (!snap.exists()) return;
      var entries = [];
      snap.forEach(function (c) { entries.push({ uid: c.key, coins: c.val().coins || 0 }); });
      entries.sort(function (a, b) { return b.coins - a.coins; });
      var myRank = -1;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].uid === U.uid) { myRank = i + 1; break; }
      }
      if (myRank === -1) return;

      var stored = parseInt(localStorage.getItem('_f106rank')) || 0;
      if (stored && stored !== myRank) {
        var diff = stored - myRank;
        var msg, type;
        if (diff > 0) {
          msg = '📈 Rank ' + diff + ' upar gaya! Ab #' + myRank + ' ho!';
          type = 'ok';
        } else {
          msg = '📉 Rank ' + Math.abs(diff) + ' neeche gaya. Ab #' + myRank;
          type = 'warn';
        }
        if (window.toast) window.toast(msg, type);
        if (navigator.vibrate && diff > 0) navigator.vibrate([50, 30, 50]);
      }
      localStorage.setItem('_f106rank', myRank);
    });
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.U && window.db) { clearInterval(_iv); setTimeout(checkRankChange, 4000); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f106] ✅ Rank Change Alert loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f107: STREAK PROTECTION ALERT
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function checkStreak() {
    var UD = window.UD;
    if (!UD) return;

    var streak = (UD.loginStreak || UD.streak || {});
    var days   = Number(streak.count || streak.days || streak.current) || 0;
    if (days < 2) return; // no streak worth protecting

    // Check if they played today
    var lastMatch = Number(UD.lastMatchAt) || 0;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    if (lastMatch >= today.getTime()) return; // already played today

    // Check time — if evening (after 6pm), warn
    var hour = new Date().getHours();
    if (hour < 18) return; // too early to warn

    var warnKey = '_f107warn_' + new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(warnKey)) return;
    localStorage.setItem(warnKey, '1');

    if (window.toast) window.toast('⚠️ ' + days + '-day streak toot jayega! Aaj ek match khelo 🎮', 'warn');
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD) { clearInterval(_iv); setTimeout(checkStreak, 3500); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f107] ✅ Streak Protection Alert loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f108: AUTO WITHDRAWAL SUGGESTION
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var MIN_AMOUNT = 100;

  function checkWithdrawalSuggestion() {
    var UD = window.UD;
    if (!UD) return;

    var money = window.getMoneyBal ? window.getMoneyBal() : (UD.realMoney && (Number(UD.realMoney.winnings) || 0));
    if (money < MIN_AMOUNT) return;

    var key = '_f108suggest_' + new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');

    // Show suggestion toast after 5s
    setTimeout(function () {
      var old = document.getElementById('_f108Suggest');
      if (old) return;

      var el = document.createElement('div');
      el.id = '_f108Suggest';
      el.style.cssText = [
        'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);',
        'background:linear-gradient(135deg,#111118,#1a2010);',
        'border:1px solid rgba(0,255,156,.3);border-radius:16px;',
        'padding:12px 16px;z-index:99995;display:flex;align-items:center;gap:10px;',
        'box-shadow:0 8px 24px rgba(0,0,0,.6);max-width:320px;width:90%;',
        'animation:f108In .3s ease'
      ].join('');

      el.innerHTML =
        '<style>@keyframes f108In{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}</style>' +
        '<div style="font-size:24px">💰</div>' +
        '<div style="flex:1">' +
          '<div style="font-size:12px;font-weight:800;color:#fff">₹' + Math.floor(money) + ' withdraw karo?</div>' +
          '<div style="font-size:11px;color:#888">Aapka winning balance kaafi ho gaya hai</div>' +
        '</div>' +
        '<button onclick="window.showWithdrawScreen&&showWithdrawScreen();document.getElementById(\'_f108Suggest\').remove();" ' +
          'style="padding:8px 12px;border-radius:10px;background:rgba(0,255,156,.15);border:1px solid rgba(0,255,156,.25);color:#00ff9c;font-weight:800;font-size:11px;cursor:pointer;white-space:nowrap">Withdraw</button>' +
        '<div onclick="document.getElementById(\'_f108Suggest\').remove()" style="color:#444;cursor:pointer;padding:4px;font-size:16px">✕</div>';

      document.body.appendChild(el);
      setTimeout(function () { if (el.parentNode) { el.style.transition='opacity .3s'; el.style.opacity='0'; setTimeout(function(){if(el.parentNode)el.remove();},300); } }, 8000);
    }, 5000);
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD) { clearInterval(_iv); checkWithdrawalSuggestion(); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f108] ✅ Auto Withdrawal Suggestion loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f109: TEAM CHEMISTRY SCORE
   How well you play with duo/squad partners
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  window.f109_renderChemistryCard = function (containerId) {
    var db = window.db; var U = window.U;
    if (!db || !U) return;
    var el = document.getElementById(containerId);
    if (!el) return;

    // Get joined matches to find teammates
    db.ref('joinedMatches/' + U.uid).orderByChild('mode').equalTo('duo').limitToLast(20).once('value', function (snap) {
      var partnerWins = {};
      var partnerGames = {};

      if (snap.exists()) {
        snap.forEach(function (c) {
          var d = c.val();
          if (!d.teamPartner) return;
          var p = d.teamPartner;
          partnerGames[p] = (partnerGames[p] || 0) + 1;
          if (d.won) partnerWins[p] = (partnerWins[p] || 0) + 1;
        });
      }

      var partners = Object.keys(partnerGames).map(function (p) {
        var games = partnerGames[p];
        var wins  = partnerWins[p] || 0;
        var score = Math.round((wins / games) * 100);
        return { name: p, games: games, wins: wins, score: score };
      });

      if (!partners.length) { el.innerHTML = ''; return; }
      partners.sort(function (a, b) { return b.score - a.score; });
      partners = partners.slice(0, 3);

      var rows = partners.map(function (p) {
        var color = p.score >= 60 ? '#00ff9c' : p.score >= 30 ? '#ffd700' : '#ff6b6b';
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">' +
          '<div style="font-size:18px">👥</div>' +
          '<div style="flex:1">' +
            '<div style="font-size:12px;font-weight:700;color:#fff">' + p.name + '</div>' +
            '<div style="font-size:10px;color:#888">' + p.games + ' games together · ' + p.wins + ' wins</div>' +
          '</div>' +
          '<div style="font-size:14px;font-weight:900;color:' + color + '">' + p.score + '%</div>' +
        '</div>';
      }).join('');

      el.innerHTML =
        '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px;margin:10px 0">' +
          '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:8px">👥 Team Chemistry</div>' +
          rows +
        '</div>';
    });
  };

  function tryInject() {
    var profileEl = document.getElementById('profileScreen') || document.querySelector('.profile-content');
    if (profileEl && !document.getElementById('f109ChemCard')) {
      var div = document.createElement('div');
      div.id = 'f109ChemCard';
      profileEl.appendChild(div);
    }
    if (document.getElementById('f109ChemCard') && window.db) window.f109_renderChemistryCard('f109ChemCard');
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.db) { clearInterval(_iv); setTimeout(tryInject, 2600); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f109] ✅ Team Chemistry Score loaded');
})();
