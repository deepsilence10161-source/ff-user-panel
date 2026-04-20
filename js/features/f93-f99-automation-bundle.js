/* ================================================================
   USER FEATURES BUNDLE f93–f99
   f93: Low Balance Warning before match join
   f94: Win Rate Trend auto-message
   f95: Referral Milestone Popup  
   f96: Personalized Homepage (favorite match type auto-top)
   f97: Dynamic Avatar Frame (rank-based)
   f98: Account Health Score widget
   f99: One-Tap Rejoin (last match type auto-select)
   ================================================================ */

/* ─────────────────────────────────────────────────────────────
   f93: LOW BALANCE WARNING
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  window.f93_checkBeforeJoin = function (entryFee) {
    if (!window.UD) return true; // allow if unknown
    var fee     = Number(entryFee) || 0;
    var coins   = Number(window.UD.coins) || 0;
    var money   = (window.getMoneyBal ? window.getMoneyBal() : 0);

    if (fee <= 0) return true;

    // Warn if after joining they'll have < 20% of current balance
    var willHaveCoins = coins - fee;
    if (willHaveCoins < 0) {
      if (window.toast) window.toast('⚠️ Balance kam hai! Entry fee: ' + fee + ' coins, Aapke paas: ' + coins, 'err');
      return false;
    }
    if (willHaveCoins < (coins * 0.2) && coins > 50) {
      // Soft warning — let them join but warn
      if (window.toast) window.toast('💡 Join ke baad sirf ' + willHaveCoins + ' coins bachenge', 'warn');
    }
    return true;
  };

  // Patch joinMatch to call check
  function hookJoin() {
    if (!window.joinMatch || window._f93Hooked) return;
    window._f93Hooked = true;
    var _orig = window.joinMatch;
    window.joinMatch = function (matchId, matchData) {
      var fee = (matchData && matchData.entryFee) || 0;
      if (!window.f93_checkBeforeJoin(fee)) return;
      return _orig.apply(this, arguments);
    };
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.joinMatch) { clearInterval(_iv); hookJoin(); }
    if (_t > 50) clearInterval(_iv);
  }, 300);

  console.log('[f93] ✅ Low Balance Warning loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f94: WIN RATE TREND MESSAGE
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function calcWRTrend() {
    var db = window.db; var U = window.U;
    if (!db || !U) return;

    var week1Start = Date.now() - 14 * 86400000;
    var week2Start = Date.now() - 7  * 86400000;

    db.ref('matchResults').orderByChild('uid').equalTo(U.uid).once('value', function (snap) {
      var w1m = 0, w1w = 0, w2m = 0, w2w = 0;
      if (snap.exists()) {
        snap.forEach(function (c) {
          var d = c.val();
          if (!d.timestamp) return;
          if (d.timestamp >= week1Start && d.timestamp < week2Start) {
            w1m++; if (d.rank === 1 || d.rank === '1') w1w++;
          } else if (d.timestamp >= week2Start) {
            w2m++; if (d.rank === 1 || d.rank === '1') w2w++;
          }
        });
      }

      if (w1m < 2 || w2m < 2) return; // not enough data

      var wr1 = w1m > 0 ? Math.round((w1w / w1m) * 100) : 0;
      var wr2 = w2m > 0 ? Math.round((w2w / w2m) * 100) : 0;
      var diff = wr2 - wr1;

      if (Math.abs(diff) < 5) return; // too small to notify

      var msg, type;
      if (diff > 0) {
        msg = '📈 Is week win rate ' + diff + '% improve hua! (' + wr1 + '% → ' + wr2 + '%) Keep it up! 🔥';
        type = 'ok';
      } else {
        msg = '📉 Win rate ' + Math.abs(diff) + '% gira (' + wr1 + '% → ' + wr2 + '%). Thoda practice karo!';
        type = 'warn';
      }
      if (window.toast) window.toast(msg, type);
    });
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.U && window.db) {
      clearInterval(_iv);
      // Show once per day
      var key = 'f94_' + new Date().toISOString().slice(0,10);
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        setTimeout(calcWRTrend, 3000);
      }
    }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f94] ✅ Win Rate Trend loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f95: REFERRAL MILESTONE POPUP
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var MILESTONES = [1, 3, 5, 10, 20, 50];

  function checkReferralMilestone() {
    var UD = window.UD; var db = window.db; var U = window.U;
    if (!UD || !db || !U) return;

    var count    = Number(UD.referralCount) || 0;
    var achieved = UD.refMilestonesShown   || {};

    MILESTONES.forEach(function (m) {
      if (count >= m && !achieved[m]) {
        // Mark
        var upd = {}; upd['refMilestonesShown/' + m] = true;
        db.ref('users/' + U.uid).update(upd);

        // Show popup
        showReferralMilestone(m, count);
      }
    });
  }

  function showReferralMilestone(milestone, total) {
    var old = document.getElementById('_f95Popup');
    if (old) old.remove();

    var el = document.createElement('div');
    el.id = '_f95Popup';
    el.style.cssText = [
      'position:fixed;inset:0;z-index:99997;background:rgba(0,0,0,.7);',
      'display:flex;align-items:center;justify-content:center;',
      'backdrop-filter:blur(4px)'
    ].join('');

    el.innerHTML =
      '<div style="background:linear-gradient(135deg,#1a1a30,#0f0f1e);border:2px solid rgba(170,85,255,.4);border-radius:24px;padding:28px 24px;text-align:center;max-width:300px;width:90%;animation:f95pop .4s ease">' +
        '<style>@keyframes f95pop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}</style>' +
        '<div style="font-size:52px;margin-bottom:10px">🎉</div>' +
        '<div style="font-size:18px;font-weight:900;color:#fff;margin-bottom:6px">' + milestone + ' Friends Referred!</div>' +
        '<div style="font-size:13px;color:#888;margin-bottom:16px">Dosto ne tumhara code use kiya — milestone unlock!</div>' +
        '<div style="background:rgba(170,85,255,.1);border:1px solid rgba(170,85,255,.25);border-radius:14px;padding:12px;margin-bottom:16px">' +
          '<div style="font-size:11px;color:#888">Total Referrals</div>' +
          '<div style="font-size:28px;font-weight:900;color:#b964ff">' + total + '</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'_f95Popup\').remove()" ' +
          'style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#b964ff,#7c3aed);border:none;color:#fff;font-weight:900;font-size:14px;cursor:pointer">🔥 Share More!</button>' +
      '</div>';

    el.addEventListener('click', function (e) { if (e.target === el) el.remove(); });
    document.body.appendChild(el);
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.U && window.db) { clearInterval(_iv); setTimeout(checkReferralMilestone, 2500); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f95] ✅ Referral Milestone Popup loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f96: PERSONALIZED HOMEPAGE
   Shows user's favorite match mode at the top
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function getFavoriteMode(callback) {
    var db = window.db; var U = window.U;
    if (!db || !U) { callback(null); return; }
    db.ref('joinedMatches/' + U.uid).once('value', function (snap) {
      var counts = {};
      if (snap.exists()) {
        snap.forEach(function (c) {
          var mode = (c.val().mode || 'solo').toLowerCase();
          counts[mode] = (counts[mode] || 0) + 1;
        });
      }
      var fav = null, max = 0;
      Object.keys(counts).forEach(function (k) { if (counts[k] > max) { max = counts[k]; fav = k; } });
      callback(fav);
    });
  }

  window.f96_applyPersonalization = function () {
    getFavoriteMode(function (fav) {
      if (!fav) return;
      // Set active filter to favorite mode
      var filterBtns = document.querySelectorAll('[data-mode],[data-filter],.mode-filter,.c-pill');
      filterBtns.forEach(function (btn) {
        var mode = (btn.getAttribute('data-mode') || btn.getAttribute('data-filter') || btn.textContent || '').toLowerCase();
        if (mode.includes(fav)) {
          btn.click();
          if (window.toast) window.toast('🎯 Tumhara favorite mode: ' + fav.toUpperCase() + ' set kiya', 'ok');
        }
      });
    });
  };

  // Apply on home tab load
  document.addEventListener('click', function (e) {
    var tab = e.target && e.target.closest('[data-nav="home"]');
    if (tab) setTimeout(window.f96_applyPersonalization, 600);
  });

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.U) { clearInterval(_iv); setTimeout(window.f96_applyPersonalization, 2200); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f96] ✅ Personalized Homepage loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f97: DYNAMIC AVATAR FRAME (rank-based border change)
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var FRAMES = [
    { minMatches: 100, minWR: 50, color: '#ff4444', label: 'Legend', glow: '0 0 12px rgba(255,68,68,.6)' },
    { minMatches: 50,  minWR: 35, color: '#ffd700', label: 'Gold',   glow: '0 0 10px rgba(255,215,0,.5)' },
    { minMatches: 20,  minWR: 20, color: '#00d4ff', label: 'Silver', glow: '0 0 8px rgba(0,212,255,.4)' },
    { minMatches: 5,   minWR: 0,  color: '#00ff9c', label: 'Bronze', glow: '0 0 6px rgba(0,255,156,.3)' },
    { minMatches: 0,   minWR: 0,  color: '#555',    label: 'Rookie', glow: 'none' }
  ];

  function getFrame(stats) {
    var matches = Number(stats.matches) || 0;
    var wins    = Number(stats.wins)    || 0;
    var wr      = matches > 0 ? (wins / matches) * 100 : 0;
    for (var i = 0; i < FRAMES.length; i++) {
      var f = FRAMES[i];
      if (matches >= f.minMatches && wr >= f.minWR) return f;
    }
    return FRAMES[FRAMES.length - 1];
  }

  function applyFrame() {
    if (!window.UD) return;
    var frame = getFrame(window.UD.stats || {});
    var avatarEls = document.querySelectorAll('.avatar-img,.profile-avatar,.user-avatar,#headerAvatar img,.hdr-avatar');
    avatarEls.forEach(function (img) {
      img.style.border    = '3px solid ' + frame.color;
      img.style.boxShadow = frame.glow;
      img.style.borderRadius = '50%';
      img.title = frame.label + ' Player';
    });
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD) { clearInterval(_iv); setTimeout(applyFrame, 1000); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  // Re-apply on profile tab
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest('[data-nav="profile"]')) setTimeout(applyFrame, 500);
  });

  console.log('[f97] ✅ Dynamic Avatar Frame loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f98: ACCOUNT HEALTH SCORE
   KYC, profile, activity, security combined score
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  window.f98_getHealthScore = function () {
    var UD = window.UD;
    if (!UD) return { score: 0, items: [] };

    var items = [];
    var score = 0;

    // Profile complete
    if (UD.ign && UD.ign.length > 2) { score += 20; items.push({ label: 'IGN set', ok: true }); }
    else items.push({ label: 'IGN set karo', ok: false });

    if (UD.profileImage || UD.photoURL) { score += 15; items.push({ label: 'Profile photo', ok: true }); }
    else items.push({ label: 'Profile photo add karo', ok: false });

    // KYC
    if (UD.profileStatus === 'approved') { score += 25; items.push({ label: 'Profile approved', ok: true }); }
    else if (UD.profileStatus === 'pending') { score += 10; items.push({ label: 'Profile approval pending', ok: null }); }
    else items.push({ label: 'Profile approval request karo', ok: false });

    // Activity
    var matches = (UD.stats && Number(UD.stats.matches)) || 0;
    if (matches >= 10) { score += 20; items.push({ label: '10+ matches played', ok: true }); }
    else items.push({ label: matches + '/10 matches played', ok: false });

    // Referral
    if ((UD.referralCount || 0) > 0) { score += 10; items.push({ label: 'Friends referred', ok: true }); }
    else items.push({ label: 'Refer a friend', ok: false });

    // Phone linked
    if (UD.phone) { score += 10; items.push({ label: 'Phone linked', ok: true }); }
    else items.push({ label: 'Phone number add karo', ok: false });

    return { score: Math.min(100, score), items: items };
  };

  window.f98_renderHealthCard = function (containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var result = window.f98_getHealthScore();
    var score  = result.score;
    var color  = score >= 80 ? '#00ff9c' : score >= 50 ? '#ffd700' : '#ff6b6b';
    var label  = score >= 80 ? 'Excellent' : score >= 50 ? 'Good' : 'Needs Work';

    var itemsHtml = result.items.map(function (item) {
      var ic = item.ok === true ? '✅' : item.ok === null ? '⏳' : '❌';
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)">' +
        '<span style="font-size:14px">' + ic + '</span>' +
        '<span style="font-size:12px;color:' + (item.ok ? '#ccc' : '#888') + '">' + item.label + '</span>' +
      '</div>';
    }).join('');

    el.innerHTML =
      '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px;margin:10px 0">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
          '<div style="width:52px;height:52px;border-radius:50%;border:3px solid ' + color + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
            '<span style="font-size:16px;font-weight:900;color:' + color + '">' + score + '</span>' +
          '</div>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:800;color:#fff">Account Health</div>' +
            '<div style="font-size:11px;color:' + color + '">' + label + '</div>' +
          '</div>' +
        '</div>' +
        itemsHtml +
      '</div>';
  };

  function tryInject() {
    var profileEl = document.getElementById('profileScreen') || document.querySelector('.profile-content');
    if (profileEl && !document.getElementById('f98HealthCard')) {
      var div = document.createElement('div');
      div.id = 'f98HealthCard';
      profileEl.appendChild(div);
    }
    if (document.getElementById('f98HealthCard') && window.UD) window.f98_renderHealthCard('f98HealthCard');
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD) { clearInterval(_iv); setTimeout(tryInject, 1500); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f98] ✅ Account Health Score loaded');
})();


/* ─────────────────────────────────────────────────────────────
   f99: ONE-TAP REJOIN (last match type auto-select on home)
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var KEY = '_f99LastMatch';

  // Save last joined match info
  window.f99_saveLastMatch = function (matchData) {
    if (!matchData) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({
        mode:     matchData.mode     || 'solo',
        entryFee: matchData.entryFee || 0,
        name:     matchData.name     || '',
        savedAt:  Date.now()
      }));
    } catch (e) {}
  };

  // Hook into joinMatch to save
  function hookJoin() {
    if (!window.joinMatch || window._f99Hooked) return;
    window._f99Hooked = true;
    var _orig = window.joinMatch;
    window.joinMatch = function (matchId, matchData) {
      window.f99_saveLastMatch(matchData);
      return _orig.apply(this, arguments);
    };
  }

  // Show quick rejoin bar on home
  function showRejoinBar() {
    var data;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!data) return;

    // Expire after 12 hours
    if (Date.now() - data.savedAt > 12 * 3600000) return;

    if (document.getElementById('_f99RejoinBar')) return;

    var bar = document.createElement('div');
    bar.id = '_f99RejoinBar';
    bar.style.cssText = [
      'background:linear-gradient(135deg,rgba(0,255,156,.06),rgba(0,212,255,.04));',
      'border:1px solid rgba(0,255,156,.15);border-radius:14px;',
      'padding:10px 14px;margin:10px 16px;',
      'display:flex;align-items:center;gap:10px'
    ].join('');

    bar.innerHTML =
      '<div style="font-size:20px">⚡</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:12px;font-weight:700;color:#fff">Quick Rejoin</div>' +
        '<div style="font-size:11px;color:#888">' + (data.name || data.mode.toUpperCase()) + ' · ₹' + data.entryFee + '</div>' +
      '</div>' +
      '<button onclick="window.f99_quickRejoin()" style="padding:8px 14px;border-radius:10px;background:rgba(0,255,156,.15);border:1px solid rgba(0,255,156,.25);color:#00ff9c;font-weight:800;font-size:12px;cursor:pointer">Join Again</button>' +
      '<div onclick="document.getElementById(\'_f99RejoinBar\').remove()" style="color:#444;cursor:pointer;padding:4px">✕</div>';

    var matchList = document.querySelector('.matches-list') || document.getElementById('homeScreen');
    if (matchList) matchList.insertBefore(bar, matchList.firstChild);
  }

  window.f99_quickRejoin = function () {
    var data;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!data) return;

    // Click the matching filter
    var filterBtns = document.querySelectorAll('[data-mode],[data-filter],.mode-filter,.c-pill');
    filterBtns.forEach(function (btn) {
      var mode = (btn.getAttribute('data-mode') || btn.getAttribute('data-filter') || btn.textContent || '').toLowerCase();
      if (mode.includes(data.mode.toLowerCase())) btn.click();
    });
    if (window.toast) window.toast('⚡ ' + data.mode.toUpperCase() + ' matches filter kiya', 'ok');
  };

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.joinMatch) { clearInterval(_iv); hookJoin(); }
    if (_t > 50) clearInterval(_iv);
  }, 300);

  var _t2 = 0;
  var _iv2 = setInterval(function () {
    _t2++;
    if (window.UD && document.getElementById('homeScreen')) { clearInterval(_iv2); setTimeout(showRejoinBar, 1800); }
    if (_t2 > 40) clearInterval(_iv2);
  }, 400);

  console.log('[f99] ✅ One-Tap Rejoin loaded');
})();
