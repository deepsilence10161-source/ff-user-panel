/* ================================================================
   MINI eSPORTS — UI FIXES MASTER FILE
   Fixes: Header, Diamond, Rank, Achievements+Levels, Legal,
          Special Tab, Weekly Challenge remove, Rival, Profile,
          Calculator remove, TDS text, Rewards Coming Soon,
          3D Card remove, Stat Card, Match Card, Ticker animation
   ================================================================ */
(function () {
'use strict';

/* ══════════════════════════════════════════════
   1. HEADER FIX
   🔥 Mini
   eSports   (fire icon top-left, name stacked)
   Online count moved left, search+bell adjusted
══════════════════════════════════════════════ */
function fixHeader() {
  var hdrLeft = document.querySelector('.hdr-left');
  if (!hdrLeft || hdrLeft.dataset.fixed) return;
  hdrLeft.dataset.fixed = '1';
  hdrLeft.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:6px">' +
      '<i class="fas fa-fire" style="color:#ff2e2e;font-size:20px;filter:drop-shadow(0 0 8px rgba(255,46,46,.8));margin-top:2px;animation:firePulse 1.5s ease-in-out infinite"></i>' +
      '<div style="line-height:1.15">' +
        '<div style="font-size:17px;font-weight:900;background:linear-gradient(135deg,#00ff6a,#ffd700);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Mini</div>' +
        '<div style="font-size:13px;font-weight:800;color:#aaa;margin-top:-2px">eSports</div>' +
      '</div>' +
    '</div>';

  /* Add firePulse animation */
  if (!document.getElementById('_fpStyle')) {
    var s = document.createElement('style');
    s.id = '_fpStyle';
    s.textContent = '@keyframes firePulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 6px rgba(255,46,46,.7))}50%{transform:scale(1.15);filter:drop-shadow(0 0 12px rgba(255,100,0,.9))}}';
    document.head.appendChild(s);
  }
}

/* ══════════════════════════════════════════════
   2. DIAMOND SPARKLE ANIMATION
   💎 mein chamak add karo
══════════════════════════════════════════════ */
function addDiamondSparkle() {
  if (document.getElementById('_diaStyle')) return;
  var s = document.createElement('style');
  s.id = '_diaStyle';
  s.textContent = [
    '@keyframes diaShine{0%{filter:drop-shadow(0 0 3px rgba(0,212,255,.4)) brightness(1)}',
    '25%{filter:drop-shadow(0 0 8px rgba(0,212,255,.9)) brightness(1.3)}',
    '50%{filter:drop-shadow(0 0 16px rgba(185,100,255,.8)) brightness(1.5) saturate(1.4)}',
    '75%{filter:drop-shadow(0 0 8px rgba(0,255,156,.7)) brightness(1.3)}',
    '100%{filter:drop-shadow(0 0 3px rgba(0,212,255,.4)) brightness(1)}}',
    '@keyframes diaFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-2px) scale(1.05)}}',
    '.chip-money span:first-child{animation:diaShine 2.5s ease-in-out infinite,diaFloat 3s ease-in-out infinite;display:inline-block}',
    '.hdr-chip.chip-money{background:linear-gradient(135deg,rgba(0,212,255,.15),rgba(185,100,255,.1));border:1px solid rgba(0,212,255,.25)}'
  ].join('');
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════
   3. RANK PAGE ANIMATIONS
   Beautiful enter animations, particles, glow
══════════════════════════════════════════════ */
function addRankAnimations() {
  if (document.getElementById('_rankAnim')) return;
  var s = document.createElement('style');
  s.id = '_rankAnim';
  s.textContent = [
    /* Pod items slide-in from bottom */
    '@keyframes podRise{from{opacity:0;transform:translateY(40px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '@keyframes podRise2{from{opacity:0;transform:translateY(60px) scale(.85)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '@keyframes rankRowIn{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}',
    /* Gold sparkle */
    '@keyframes goldSpin{0%{box-shadow:0 0 24px rgba(255,215,0,.8),0 0 48px rgba(255,180,0,.4)}',
    '33%{box-shadow:0 0 30px rgba(255,215,0,1),0 0 60px rgba(255,200,0,.6),0 0 90px rgba(255,150,0,.3)}',
    '66%{box-shadow:0 0 24px rgba(255,180,0,.9),0 0 48px rgba(255,215,0,.5)}',
    '100%{box-shadow:0 0 24px rgba(255,215,0,.8),0 0 48px rgba(255,180,0,.4)}}',
    '.pod-item.p1{animation:podRise .6s cubic-bezier(.34,1.56,.64,1) .1s both}',
    '.pod-item.p2{animation:podRise2 .6s cubic-bezier(.34,1.56,.64,1) .25s both}',
    '.pod-item.p3{animation:podRise2 .6s cubic-bezier(.34,1.56,.64,1) .35s both}',
    '.pod-item.p1 .pod-ava{animation:goldSpin 3s ease-in-out infinite!important}',
    '.rank-row{animation:rankRowIn .4s ease both}',
    /* Stagger rank rows */
    '.rank-row:nth-child(1){animation-delay:.05s}',
    '.rank-row:nth-child(2){animation-delay:.1s}',
    '.rank-row:nth-child(3){animation-delay:.15s}',
    '.rank-row:nth-child(4){animation-delay:.2s}',
    '.rank-row:nth-child(5){animation-delay:.25s}',
    '.rank-row:nth-child(6){animation-delay:.3s}',
    '.rank-row:nth-child(n+7){animation-delay:.35s}',
    /* Podium glow bg */
    '.rank-podium{background:radial-gradient(ellipse at 50% 110%,rgba(255,215,0,.12) 0%,rgba(185,100,255,.04) 40%,transparent 70%)!important}'
  ].join('');
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════
   4. TICKER ANIMATION (stylish gradient scroll)
══════════════════════════════════════════════ */
function styleTickerText() {
  var ticker = document.querySelector('.ticker-txt');
  if (!ticker || ticker.dataset.styled) return;
  ticker.dataset.styled = '1';
  ticker.style.cssText += ';background:linear-gradient(90deg,#00ff9c,#00d4ff,#b964ff,#ffd700,#00ff9c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700;font-size:13px';
}

/* ══════════════════════════════════════════════
   5. HOME PAGE GAP — reduce between tabs and match list
══════════════════════════════════════════════ */
function fixHomeGap() {
  if (!document.getElementById('_gapStyle')) {
    var s = document.createElement('style');
    s.id = '_gapStyle';
    s.textContent = '.c-pills{margin-bottom:4px!important}.s-tabs{margin-bottom:4px!important}.s-tab{margin-bottom:0!important}';
    document.head.appendChild(s);
  }
}

/* ══════════════════════════════════════════════
   6. LEGAL BUTTONS FIX
   Delay badha do 500ms — sheet animation ke baad modal khule
══════════════════════════════════════════════ */
function fixLegalButtons() {
  /* Override closeProfileSettings to use longer delay for legal */
  var _origClose = window.closeProfileSettings;
  if (!window.closeProfileSettings || window._legalFixed) return;
  window._legalFixed = true;

  /* Patch: legal buttons direct call karo bina close delay ke */
  window._openLegal = function(fn) {
    /* Close sheet first */
    var s = document.getElementById('profSettingsSheet');
    if (s) {
      s.style.opacity = '0';
      s.style.transform = 'translateY(20px)';
      s.style.transition = 'all .2s';
      setTimeout(function() {
        if (s.parentNode) s.remove();
        setTimeout(function() {
          try { eval(fn); } catch(e) { /* try direct call */
            if (fn.indexOf('mesShowTerms') > -1 && window.mesShowTerms) window.mesShowTerms();
            else if (fn.indexOf('mesShowPrivacy') > -1 && window.mesShowPrivacy) window.mesShowPrivacy();
            else if (fn.indexOf('mesTDSSummary') > -1 && window.mesTDSSummary) window.mesTDSSummary();
            else if (fn.indexOf('mesShowKYC') > -1 && window.mesShowKYC) window.mesShowKYC();
            else if (fn.indexOf('mesRG') > -1 && window.mesRG) window.mesRG();
            else if (fn.indexOf('mesDispute') > -1 && window.mesDispute) window.mesDispute();
          }
        }, 100);
      }, 200);
    } else {
      try { eval(fn); } catch(e) {}
    }
  };
}

/* ══════════════════════════════════════════════
   7. WEEKLY CHALLENGE → ACHIEVEMENT (Profile)
   f07 Weekly Challenge button hatao,
   Achievement section upar lao
══════════════════════════════════════════════ */
function fixWeeklyChallengeToAchievement() {
  /* Remove f07 weekly challenge button from profile */
  var obs = new MutationObserver(function() {
    var wBtn = document.querySelector('.f07-weekly-btn');
    if (wBtn) wBtn.remove();

    /* Achievement section ko profile mein properly place karo */
    var achBtn = document.querySelector('.prof-btn:not(.f07-weekly-btn)');
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

/* ══════════════════════════════════════════════
   8. CALCULATOR BUTTON HATAO (filter chips se)
══════════════════════════════════════════════ */
function removeCalculatorBtn() {
  var obs2 = new MutationObserver(function() {
    document.querySelectorAll('button').forEach(function(btn) {
      if (btn.textContent && btn.textContent.trim() === '🧮 Calculator') {
        btn.remove();
      }
    });
  });
  obs2.observe(document.body, { childList: true, subtree: true });
}

/* ══════════════════════════════════════════════
   9. TDS TEXT HATAO (wallet mein)
   "TDS OFF/ON" text aur "100 💎 = ₹100" line
══════════════════════════════════════════════ */
function hideTDSTextInWallet() {
  var obs3 = new MutationObserver(function() {
    /* Diamond conversion card mein sirf withdrawal button aur amount dikhao */
    var card = document.getElementById('_diamondConvCard');
    if (card) {
      /* TDS OFF/ON badge hatao */
      var badge = card.querySelector('[style*="TDS"]');
      if (badge) badge.style.display = 'none';
      /* "100 💎 = ₹100" line hatao */
      card.querySelectorAll('div').forEach(function(d) {
        if (d.textContent && (d.textContent.indexOf('100 💎') > -1 || d.textContent.indexOf('Koi TDS') > -1)) {
          d.style.display = 'none';
        }
      });
    }
  });
  obs3.observe(document.body, { childList: true, subtree: true });
}

/* ══════════════════════════════════════════════
   10. 3D PLAYER CARD BUTTON HATAO
══════════════════════════════════════════════ */
function remove3DCardButton() {
  /* Settings sheet se hatao */
  var _origShowSettings = window.showProfileSettings;
  if (!_origShowSettings || window._3dRemoved) return;
  window._3dRemoved = true;
  window.showProfileSettings = function() {
    _origShowSettings.apply(this, arguments);
    setTimeout(function() {
      var sheet = document.getElementById('profSettingsSheet');
      if (!sheet) return;
      sheet.querySelectorAll('div[onclick]').forEach(function(d) {
        if (d.textContent && (d.textContent.indexOf('3D Player Card') > -1 || d.textContent.indexOf('3D Card') > -1)) {
          d.remove();
        }
      });
    }, 100);
  };
}

/* ══════════════════════════════════════════════
   11. REWARDS STORE — Coming Soon badges
══════════════════════════════════════════════ */
function patchRewardsStore() {
  var _origStore = window.showRewardsStore;
  if (!_origStore || window._rewardPatched) return;
  window._rewardPatched = true;
  window.showRewardsStore = function() {
    _origStore.apply(this, arguments);
    setTimeout(function() {
      /* Find all redeem buttons and replace with Coming Soon */
      var modal = document.getElementById('modalB');
      if (!modal) return;
      modal.querySelectorAll('button').forEach(function(btn) {
        if (btn.textContent && (btn.textContent.indexOf('Redeem') > -1 || btn.textContent.indexOf('Buy') > -1 || btn.textContent.indexOf('Need more') > -1)) {
          btn.disabled = true;
          btn.style.background = 'rgba(255,255,255,.04)';
          btn.style.color = '#555';
          btn.style.border = '1px solid rgba(255,255,255,.06)';
          btn.textContent = '🔜 Coming Soon';
        }
      });
      /* Add banner at top */
      var existing = modal.querySelector('._comingSoonBanner');
      if (!existing) {
        var banner = document.createElement('div');
        banner.className = '_comingSoonBanner';
        banner.style.cssText = 'background:rgba(255,170,0,.08);border:1px solid rgba(255,170,0,.2);border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#ffaa00;text-align:center';
        banner.innerHTML = '🚧 Rewards Store launching soon! Items available after official app launch.';
        modal.insertBefore(banner, modal.firstChild);
      }
    }, 200);
  };
}

/* ══════════════════════════════════════════════
   12. RIVAL SET OPTION ADD
   showRivalCard mein set rival option add karo
══════════════════════════════════════════════ */
function patchRivalCard() {
  var _origRival = window.showRivalCard;
  if (window._rivalPatched) return;
  window._rivalPatched = true;

  window.showRivalCard = function() {
    if (!window.UD || !window.U || !window.db) return;

    var UD = window.UD;
    var rival = UD.rival;

    if (!rival) {
      /* No rival set — show search UI */
      var h = '<div style="text-align:center;padding:16px 0 20px">';
      h += '<div style="font-size:48px;margin-bottom:10px">🎯</div>';
      h += '<div style="font-size:16px;font-weight:800;color:#ff4444;margin-bottom:6px">Set Your Rival</div>';
      h += '<div style="font-size:12px;color:#888;line-height:1.6;margin-bottom:20px">Kisi player ko rival set karo — har match mein unhe beat karne ki koshish karo!</div>';
      h += '</div>';
      h += '<div style="margin-bottom:14px">';
      h += '<label style="font-size:11px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Search by IGN</label>';
      h += '<div style="display:flex;gap:8px">';
      h += '<input id="_rivalSearch" type="text" placeholder="Enter player IGN..." style="flex:1;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;font-size:14px;outline:none">';
      h += '<button onclick="window._searchRival()" style="padding:12px 16px;border-radius:12px;background:linear-gradient(135deg,#ff4444,#cc0000);border:none;color:#fff;font-weight:800;font-size:13px;cursor:pointer">Search</button>';
      h += '</div></div>';
      h += '<div id="_rivalResults" style="min-height:40px"></div>';
      if (window.openModal) openModal('🎯 My Rival', h);
      return;
    }

    /* Has rival — show comparison */
    if (_origRival) {
      _origRival.apply(this, arguments);
    } else {
      window.db.ref('users/' + rival.uid).once('value', function(s) {
        if (!s.exists()) return;
        var rd = s.val();
        var myStats = (UD.stats || {});
        var theirStats = (rd.stats || {});
        var h = '<div style="text-align:center;padding:8px 0 14px">';
        h += '<div style="font-size:28px;margin-bottom:6px">🎯</div>';
        h += '<div style="font-size:16px;font-weight:800;color:#ff4444;margin-bottom:4px">Your Rival</div>';
        h += '<div style="font-size:13px;color:#aaa">' + (rd.ign || rd.displayName || 'Player') + '</div>';
        h += '</div>';
        var stats = [{label:'Matches',me:myStats.matches||0,them:theirStats.matches||0},{label:'Kills',me:myStats.kills||0,them:theirStats.kills||0},{label:'Wins',me:myStats.wins||0,them:theirStats.wins||0},{label:'Earned',me:myStats.earnings||0,them:theirStats.earnings||0}];
        h += '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin-bottom:14px">';
        stats.forEach(function(cs) {
          var myWin = cs.me >= cs.them;
          h += '<div style="text-align:right"><div style="font-size:16px;font-weight:900;color:' + (myWin?'#00ff9c':'#fff') + '">' + cs.me + '</div><div style="font-size:10px;color:#666">You</div></div>';
          h += '<div style="text-align:center;font-size:10px;color:#666;align-self:center;padding-top:6px">' + cs.label + '</div>';
          h += '<div style="text-align:left"><div style="font-size:16px;font-weight:900;color:' + (!myWin?'#ff4444':'#fff') + '">' + cs.them + '</div><div style="font-size:10px;color:#666">Rival</div></div>';
        });
        h += '</div>';
        h += '<button onclick="window.db.ref(\'users/\'+window.U.uid+\'/rival\').remove();if(window.closeModal)closeModal();if(window.toast)toast(\'Rival removed\',\'ok\')" style="width:100%;padding:10px;border-radius:10px;background:rgba(255,68,68,.1);border:1px solid rgba(255,68,68,.2);color:#ff4444;font-weight:700;cursor:pointer;margin-bottom:8px">Remove Rival</button>';
        h += '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:10px;border-radius:10px;background:rgba(255,255,255,.06);border:none;color:#aaa;cursor:pointer">Close</button>';
        if (window.openModal) openModal('🎯 Rival Stats', h);
      });
    }
  };

  /* Search rival function */
  window._searchRival = function() {
    var q = (document.getElementById('_rivalSearch') || {}).value;
    if (!q || !q.trim()) return;
    q = q.trim();
    var res = document.getElementById('_rivalResults');
    if (res) res.innerHTML = '<div style="text-align:center;padding:12px;color:#888;font-size:12px"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    window.db.ref('users').orderByChild('ign').equalTo(q).once('value', function(s) {
      var results = [];
      if (s.exists()) s.forEach(function(c) {
        if (c.key !== window.U.uid) results.push({ uid: c.key, data: c.val() });
      });
      if (!results.length) {
        /* Try displayName */
        window.db.ref('users').orderByChild('displayName').equalTo(q).once('value', function(s2) {
          var r2 = [];
          if (s2.exists()) s2.forEach(function(c) { if (c.key !== window.U.uid) r2.push({ uid: c.key, data: c.val() }); });
          renderRivalResults(r2);
        });
        return;
      }
      renderRivalResults(results);
    });
  };

  function renderRivalResults(results) {
    var res = document.getElementById('_rivalResults');
    if (!res) return;
    if (!results.length) {
      res.innerHTML = '<div style="text-align:center;padding:16px;color:#666;font-size:13px">No player found with this IGN</div>';
      return;
    }
    var h = '';
    results.slice(0, 5).forEach(function(r) {
      var d = r.data;
      var st = d.stats || {};
      h += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;margin-bottom:8px">';
      h += '<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,68,68,.15);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#ff4444">' + (d.ign||d.displayName||'?').charAt(0).toUpperCase() + '</div>';
      h += '<div style="flex:1"><div style="font-size:14px;font-weight:700">' + (d.ign||d.displayName||'Player') + '</div>';
      h += '<div style="font-size:11px;color:#666">M:' + (st.matches||0) + ' · K:' + (st.kills||0) + ' · W:' + (st.wins||0) + '</div></div>';
      h += '<button onclick="window._setRivalById(\'' + r.uid + '\',\'' + (d.ign||d.displayName||'Player') + '\')" style="padding:8px 14px;border-radius:10px;background:linear-gradient(135deg,#ff4444,#cc0000);border:none;color:#fff;font-weight:800;font-size:12px;cursor:pointer">Set Rival</button>';
      h += '</div>';
    });
    res.innerHTML = h;
  }

  window._setRivalById = function(uid, name) {
    if (!window.U || !window.db) return;
    window.db.ref('users/' + window.U.uid + '/rival').set({ uid: uid, name: name, setAt: Date.now() });
    if (window.toast) toast('🎯 Rival set: ' + name, 'ok');
    if (window.closeModal) closeModal();
  };
}

/* ══════════════════════════════════════════════
   13. ACHIEVEMENT SYSTEM WITH LEVELS (v2)
   Merged showAchievements with levels
══════════════════════════════════════════════ */
var ACHIEVEMENTS_V2 = [
  {
    id: 'first_blood', icon: '🩸', title: 'First Blood',
    levels: [
      { level: 1, desc: 'Play 1 match', check: function(s){ return (s.matches||0)>=1; } },
      { level: 2, desc: 'Play 5 matches', check: function(s){ return (s.matches||0)>=5; } },
      { level: 3, desc: 'Play 10 matches', check: function(s){ return (s.matches||0)>=10; } }
    ]
  },
  {
    id: 'winner', icon: '🏆', title: 'Champion',
    levels: [
      { level: 1, desc: 'Win 1 match', check: function(s){ return (s.wins||0)>=1; } },
      { level: 2, desc: 'Win 5 matches', check: function(s){ return (s.wins||0)>=5; } },
      { level: 3, desc: 'Win 15 matches', check: function(s){ return (s.wins||0)>=15; } }
    ]
  },
  {
    id: 'kill_machine', icon: '💀', title: 'Kill Machine',
    levels: [
      { level: 1, desc: '10 total kills', check: function(s){ return (s.kills||0)>=10; } },
      { level: 2, desc: '50 total kills', check: function(s){ return (s.kills||0)>=50; } },
      { level: 3, desc: '100 total kills', check: function(s){ return (s.kills||0)>=100; } }
    ]
  },
  {
    id: 'earner', icon: '💎', title: 'Diamond Earner',
    levels: [
      { level: 1, desc: 'Earn 💎50', check: function(s){ return (s.earnings||0)>=50; } },
      { level: 2, desc: 'Earn 💎200', check: function(s){ return (s.earnings||0)>=200; } },
      { level: 3, desc: 'Earn 💎500', check: function(s){ return (s.earnings||0)>=500; } }
    ]
  },
  {
    id: 'veteran', icon: '🎖️', title: 'Veteran',
    levels: [
      { level: 1, desc: '25 matches', check: function(s){ return (s.matches||0)>=25; } },
      { level: 2, desc: '50 matches', check: function(s){ return (s.matches||0)>=50; } },
      { level: 3, desc: '100 matches', check: function(s){ return (s.matches||0)>=100; } }
    ]
  },
  {
    id: 'referrer', icon: '🤝', title: 'Influencer',
    levels: [
      { level: 1, desc: 'Refer 1 friend', check: function(s,ud){ return (ud.referralCount||0)>=1; } },
      { level: 2, desc: 'Refer 5 friends', check: function(s,ud){ return (ud.referralCount||0)>=5; } },
      { level: 3, desc: 'Refer 10 friends', check: function(s,ud){ return (ud.referralCount||0)>=10; } }
    ]
  },
  {
    id: 'streak', icon: '🔥', title: 'On Fire',
    levels: [
      { level: 1, desc: '3 day streak', check: function(s,ud){ return (ud.loginStreak||0)>=3; } },
      { level: 2, desc: '7 day streak', check: function(s,ud){ return (ud.loginStreak||0)>=7; } },
      { level: 3, desc: '30 day streak', check: function(s,ud){ return (ud.loginStreak||0)>=30; } }
    ]
  },
  {
    id: 'depositor', icon: '💰', title: 'High Roller',
    levels: [
      { level: 1, desc: 'Add 💎100', check: function(s,ud){ return ((ud.realMoney||{}).deposited||0)>=100; } },
      { level: 2, desc: 'Add 💎300', check: function(s,ud){ return ((ud.realMoney||{}).deposited||0)>=300; } },
      { level: 3, desc: 'Add 💎500', check: function(s,ud){ return ((ud.realMoney||{}).deposited||0)>=500; } }
    ]
  }
];

function getAchLevel(ach) {
  var UD = window.UD; if (!UD) return 0;
  var st = UD.stats || {};
  var curLevel = 0;
  ach.levels.forEach(function(l) {
    if (l.check(st, UD)) curLevel = l.level;
  });
  return curLevel;
}

window.showAchievements = function() {
  var UD = window.UD; if (!UD) return;
  var unlocked = 0;
  ACHIEVEMENTS_V2.forEach(function(a) { if (getAchLevel(a) > 0) unlocked++; });

  var h = '<div style="text-align:center;margin-bottom:16px">';
  h += '<div style="font-size:28px;font-weight:900;background:linear-gradient(135deg,#ffd700,#ff8c00);-webkit-background-clip:text;-webkit-text-fill-color:transparent">' + unlocked + '/' + ACHIEVEMENTS_V2.length + '</div>';
  h += '<div style="font-size:12px;color:#888">Achievements Unlocked</div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';

  ACHIEVEMENTS_V2.forEach(function(ach) {
    var curLv = getAchLevel(ach);
    var maxLv = ach.levels.length;
    var unlk = curLv > 0;
    var nextLv = ach.levels[curLv] || null;

    h += '<div style="padding:12px;border-radius:14px;background:' + (unlk?'rgba(255,215,0,.07)':'rgba(255,255,255,.03)') + ';border:1px solid ' + (unlk?'rgba(255,215,0,.2)':'rgba(255,255,255,.06)') + ';position:relative;overflow:hidden">';

    /* Level stars */
    if (unlk) {
      h += '<div style="position:absolute;top:8px;right:8px;display:flex;gap:2px">';
      for (var i = 1; i <= maxLv; i++) {
        h += '<div style="width:8px;height:8px;border-radius:50%;background:' + (i<=curLv?'#ffd700':'rgba(255,255,255,.1)') + ';box-shadow:' + (i<=curLv?'0 0 4px rgba(255,215,0,.6)':'none') + '"></div>';
      }
      h += '</div>';
    }

    h += '<div style="font-size:26px;margin-bottom:6px">' + ach.icon + '</div>';
    h += '<div style="font-size:12px;font-weight:800;color:' + (unlk?'#ffd700':'#aaa') + '">' + ach.title + '</div>';

    if (unlk) {
      h += '<div style="font-size:10px;color:#00ff9c;margin-top:2px;font-weight:700">Level ' + curLv + ' ✅</div>';
      if (nextLv) {
        h += '<div style="font-size:9px;color:#666;margin-top:3px">Next: ' + nextLv.desc + '</div>';
      } else {
        h += '<div style="font-size:9px;color:#ffd700;margin-top:3px">Max Level!</div>';
      }
    } else {
      h += '<div style="font-size:9px;color:#555;margin-top:3px">' + ach.levels[0].desc + '</div>';
      h += '<div style="font-size:9px;color:#444;margin-top:2px">🔒 Locked</div>';
    }
    h += '</div>';
  });

  h += '</div>';
  if (window.openModal) openModal('🏅 Achievements', h);
  else if (window.showModal) showModal('🏅 Achievements', h);
};

/* Also update profile achievements display */
window.renderAchievementsHTML = function() {
  var UD = window.UD; if (!UD) return '';
  var unlocked = 0;
  ACHIEVEMENTS_V2.forEach(function(a) { if (getAchLevel(a) > 0) unlocked++; });
  var h = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
  ACHIEVEMENTS_V2.forEach(function(a) {
    var lv = getAchLevel(a);
    var unlk = lv > 0;
    h += '<div title="' + a.title + ' Lv.' + lv + '" style="width:36px;height:36px;border-radius:10px;background:' + (unlk?'rgba(255,215,0,.12)':'rgba(255,255,255,.04)') + ';border:1px solid ' + (unlk?'rgba(255,215,0,.3)':'var(--border)') + ';display:flex;align-items:center;justify-content:center;font-size:18px;opacity:' + (unlk?'1':'.3') + ';position:relative">' + a.icon;
    if (lv > 0) h += '<div style="position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#ffd700,#ff8c00);display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900;color:#000">' + lv + '</div>';
    h += '</div>';
  });
  h += '</div>';
  h += '<div style="font-size:11px;color:#00ff9c">' + unlocked + '/' + ACHIEVEMENTS_V2.length + ' achievements unlocked</div>';
  h += '<button onclick="window.showAchievements&&showAchievements()" style="margin-top:8px;padding:8px 14px;border-radius:10px;background:rgba(255,215,0,.1);color:#ffd700;border:1px solid rgba(255,215,0,.2);font-size:12px;font-weight:700;cursor:pointer">View All Achievements</button>';
  return h;
};

/* ══════════════════════════════════════════════
   14. STAT CARD BEAUTIFY
══════════════════════════════════════════════ */
window.generateStatCard = function() {
  var UD = window.UD; var U = window.U;
  if (!UD || !U) return;
  var stats = UD.stats || {};
  var winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
  var kpm = stats.matches > 0 ? ((stats.kills||0)/stats.matches).toFixed(1) : '0';

  var h = '<div style="background:linear-gradient(135deg,#050507,#0a0a14);border:1px solid rgba(0,255,156,.2);border-radius:18px;padding:20px;position:relative;overflow:hidden">';
  /* Glow effects */
  h += '<div style="position:absolute;top:-40px;right:-40px;width:120px;height:120px;background:rgba(0,255,156,.06);border-radius:50%;filter:blur(20px)"></div>';
  h += '<div style="position:absolute;bottom:-40px;left:-40px;width:100px;height:100px;background:rgba(185,100,255,.06);border-radius:50%;filter:blur(20px)"></div>';
  /* Header */
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
  h += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:16px">🎮</span><span style="font-size:13px;font-weight:900;background:linear-gradient(135deg,#00ff9c,#00d4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Mini eSports</span></div>';
  h += '<div style="font-size:9px;color:#333">student-4356.github.io</div>';
  h += '</div>';
  /* Player name */
  h += '<div style="margin-bottom:14px">';
  h += '<div style="font-size:22px;font-weight:900;color:#fff">' + (UD.ign || UD.displayName || 'Player') + '</div>';
  h += '<div style="font-size:11px;color:#555;margin-top:2px">FF UID: ' + (UD.ffUid || '—') + '</div>';
  h += '</div>';
  /* Stats grid */
  var items = [
    {l:'Matches',v:stats.matches||0,c:'#00d4ff'},{l:'Wins',v:stats.wins||0,c:'#00ff9c'},
    {l:'Win Rate',v:winRate+'%',c:'#ffd700'},{l:'Kills',v:stats.kills||0,c:'#ff4444'},
    {l:'Earned',v:'💎'+(stats.earnings||0),c:'#b964ff'},{l:'K/Match',v:kpm,c:'#ffaa00'}
  ];
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">';
  items.forEach(function(item) {
    h += '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:8px;text-align:center">';
    h += '<div style="font-size:16px;font-weight:900;color:' + item.c + '">' + item.v + '</div>';
    h += '<div style="font-size:9px;color:#555;margin-top:2px">' + item.l + '</div>';
    h += '</div>';
  });
  h += '</div>';
  /* Watermark */
  h += '<div style="text-align:center;font-size:10px;font-weight:800;background:linear-gradient(90deg,#00ff9c,#b964ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;opacity:.4">MINI eSPORTS</div>';
  h += '</div>';

  h += '<div style="font-size:11px;color:#555;text-align:center;margin-top:8px">Long press image to save</div>';
  h += '<button onclick="window._shareStatCard&&_shareStatCard()" style="width:100%;margin-top:10px;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00d4ff);border:none;color:#000;font-weight:900;font-size:14px;cursor:pointer"><i class="fas fa-share-alt" style="margin-right:8px"></i>Share Stat Card</button>';

  if (window.openModal) openModal('📊 Your Stat Card', h);
};

window._shareStatCard = function() {
  var UD = window.UD; if (!UD) return;
  var stats = UD.stats || {};
  var msg = '🎮 Mini eSports — My Stats!\n\n' +
    '👤 ' + (UD.ign||UD.displayName||'Player') + '\n' +
    '🎯 Matches: ' + (stats.matches||0) + '\n' +
    '🏆 Wins: ' + (stats.wins||0) + '\n' +
    '💀 Kills: ' + (stats.kills||0) + '\n' +
    '💎 Earned: ' + (stats.earnings||0) + '\n\n' +
    '📲 Play on Mini eSports: ' + window.location.origin + '/FF-User-Panel/';
  if (navigator.share) navigator.share({ title: 'My Stats', text: msg }).catch(function(){});
  else if (navigator.clipboard) navigator.clipboard.writeText(msg);
};

/* ══════════════════════════════════════════════
   15. PREVIEW SCREEN — Fix share button onclick
   (uses window._pvShare which includes referral code)
══════════════════════════════════════════════ */
function fixPreviewShareButton() {
  var obs4 = new MutationObserver(function() {
    var pvOverlay = document.getElementById('_previewOverlay');
    if (!pvOverlay) return;
    var shareDiv = document.getElementById('_pvShareBtn');
    if (shareDiv) {
      shareDiv.style.cursor = 'pointer';
    }
  });
  obs4.observe(document.body, { childList: true, subtree: true });
}

/* ══════════════════════════════════════════════
   16. SPECIAL TAB: Weekly → Sunday Special fix
   spType 'weekly' = sunday_special in admin
══════════════════════════════════════════════ */
function fixSpecialTabLabels() {
  /* Fix toggle button text */
  var obs5 = new MutationObserver(function() {
    document.querySelectorAll('.sp-tog-btn').forEach(function(btn) {
      if (btn.textContent === 'Weekly' && !btn.dataset.relabeled) {
        btn.textContent = 'Sunday Special';
        btn.dataset.relabeled = '1';
      }
    });
  });
  obs5.observe(document.body, { childList: true, subtree: true });
  /* Do once immediately */
  setTimeout(function() {
    document.querySelectorAll('.sp-tog-btn').forEach(function(btn) {
      if (btn.textContent === 'Weekly' && !btn.dataset.relabeled) {
        btn.textContent = 'Sunday Special';
        btn.dataset.relabeled = '1';
      }
    });
  }, 500);
}

/* ══════════════════════════════════════════════
   17. MATCH INVITE CARD BEAUTIFY
══════════════════════════════════════════════ */
function beautifyMatchCard() {
  if (!document.getElementById('_matchCardStyle')) {
    var s = document.createElement('style');
    s.id = '_matchCardStyle';
    s.textContent = [
      '@keyframes cardGlow{0%,100%{box-shadow:0 8px 32px rgba(0,0,0,.5)}50%{box-shadow:0 12px 40px rgba(0,255,156,.08),0 0 0 1px rgba(0,255,156,.05)}}',
      '.m-card{animation:cardGlow 4s ease-in-out infinite!important;transition:transform .2s,box-shadow .2s!important}',
      '.m-card:active{transform:scale(.98)!important}'
    ].join('');
    document.head.appendChild(s);
  }
}

/* ══════════════════════════════════════════════
   18. PLAYER CARD ANIMATION
══════════════════════════════════════════════ */
function beautifyPlayerCard() {
  var _origCard = window.generateAdvancedPlayerCard;
  if (!_origCard || window._cardPatched) return;
  window._cardPatched = true;

  window.generateAdvancedPlayerCard = function() {
    var UD = window.UD; if (!UD) return;
    var st = UD.stats || {};
    var rk = window.calcRk ? window.calcRk(st) : { badge: 'Player', emoji: '🎮', color: '#00ff9c' };
    var av = UD.profileImage
      ? '<img src="' + UD.profileImage + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
      : '<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#00ff9c,#00d4ff);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#000">' + (UD.ign||UD.displayName||'P').charAt(0).toUpperCase() + '</div>';

    var h = '<div style="position:relative;overflow:hidden">';
    /* Animated background */
    h += '<div id="_pcAnimBg" style="background:linear-gradient(135deg,#050507,#0d0b16,#050507);border:1px solid rgba(0,255,156,.15);border-radius:20px;padding:20px;text-align:center;position:relative;overflow:hidden">';
    h += '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 0%,rgba(0,255,156,.08),transparent 60%);pointer-events:none"></div>';
    /* Avatar */
    h += '<div style="width:80px;height:80px;border-radius:50%;margin:0 auto 12px;border:3px solid ' + (rk.color||'#00ff9c') + ';box-shadow:0 0 20px ' + (rk.color||'#00ff9c') + '66,0 0 40px ' + (rk.color||'#00ff9c') + '22;animation:goldSpin 3s ease-in-out infinite;position:relative">' + av + '</div>';
    /* Name */
    h += '<div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:4px">' + (UD.ign || UD.displayName || 'Player') + '</div>';
    h += '<div style="font-size:11px;color:#555;margin-bottom:12px">FF UID: ' + (UD.ffUid || '—') + '</div>';
    /* Rank badge */
    h += '<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:5px 14px;margin-bottom:16px">';
    h += '<span style="font-size:18px">' + rk.emoji + '</span><span style="font-size:12px;font-weight:700;color:' + (rk.color||'#00ff9c') + '">' + rk.badge + '</span></div>';
    /* Stats */
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">';
    [{l:'Matches',v:st.matches||0,c:'#00d4ff'},{l:'Wins',v:st.wins||0,c:'#00ff9c'},{l:'Kills',v:st.kills||0,c:'#ff4444'}].forEach(function(x){
      h += '<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:10px">';
      h += '<div style="font-size:22px;font-weight:900;color:' + x.c + '">' + x.v + '</div>';
      h += '<div style="font-size:9px;color:#555;margin-top:2px">' + x.l + '</div></div>';
    });
    h += '</div>';
    /* Win rate */
    var wr = st.matches > 0 ? Math.round((st.wins/st.matches)*100) : 0;
    h += '<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:10px;padding:8px;margin-bottom:0">Win Rate: <strong style="color:#00ff9c">' + wr + '%</strong></div>';
    h += '</div></div>';
    h += '<button onclick="window.generateProfileCard&&generateProfileCard()" style="width:100%;margin-top:12px;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00d4ff);border:none;color:#000;font-weight:900;font-size:14px;cursor:pointer"><i class="fas fa-share-alt" style="margin-right:8px"></i>Share Card</button>';

    if (window.openModal) openModal('My Player Card', h);
  };
}

/* ══════════════════════════════════════════════
   19. FF UID LOCK after first set
══════════════════════════════════════════════ */
function lockFFUIDAfterSet() {
  var _origShowProfileUpdate = window.showProfileUpdate;
  if (!_origShowProfileUpdate || window._ffLocked) return;
  window._ffLocked = true;
  window.showProfileUpdate = function() {
    var UD = window.UD; if (!UD) { _origShowProfileUpdate(); return; }
    var ffSet = UD.ffUid && UD.ffUid.trim().length >= 5;
    var isVerified = UD.profileStatus === 'approved' || UD.profileVerified;

    /* If FF UID already set and verified — lock it */
    var h = '<div class="f-group"><label>In-Game Name (IGN)</label><input type="text" class="f-input" id="puIgn" placeholder="Your Free Fire IGN" value="' + (UD.ign || '') + '"></div>';
    if (ffSet && isVerified) {
      h += '<div class="f-group"><label>Free Fire UID <span style="color:#ffd700;font-size:10px">🔒 Locked after first verification</span></label>';
      h += '<input type="text" class="f-input" id="puUid" value="' + (UD.ffUid || '') + '" readonly style="opacity:.6;cursor:not-allowed"></div>';
      h += '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.15);border-radius:10px;padding:10px;font-size:11px;color:#ffaa00;margin-bottom:10px"><i class="fas fa-lock"></i> FF UID ek baar set hone ke baad change nahi hogi. Agar issue hai to admin se contact karo.</div>';
    } else if (!ffSet) {
      h += '<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:10px;padding:10px;font-size:11px;color:#00ff9c;margin-bottom:6px"><i class="fas fa-info-circle"></i> FF UID ek baar set hone ke baad change nahi kar sakte — sahi UID daalna!</div>';
      h += '<div class="f-group"><label>Free Fire UID (5-15 digits)</label><input type="text" class="f-input" id="puUid" placeholder="Your FF UID" value="' + (UD.ffUid || '') + '"></div>';
    } else {
      h += '<div class="f-group"><label>Free Fire UID (5-15 digits)</label><input type="text" class="f-input" id="puUid" placeholder="Your FF UID" value="' + (UD.ffUid || '') + '"></div>';
    }
    h += '<div class="f-group"><label>WhatsApp Number <span style="font-size:10px;color:var(--txt2)">(prizes ke liye)</span></label><input type="tel" class="f-input" id="puPhone" placeholder="10-digit number" maxlength="10" value="' + (UD.phone || '') + '"></div>';
    h += '<div class="f-warn"><i class="fas fa-exclamation-triangle"></i> Only real Free Fire IGN and UID allowed. Fake info = disqualified.</div>';
    h += '<button class="f-btn fb-orange" style="margin-top:14px" onclick="doProfileUpdate()">Submit for Verification</button>';
    if (window.openModal) openModal('Profile Update', h);
  };
}

/* ══════════════════════════════════════════════
   INIT — Run all fixes
══════════════════════════════════════════════ */
function runAll() {
  fixHeader();
  addDiamondSparkle();
  addRankAnimations();
  styleTickerText();
  fixHomeGap();
  fixLegalButtons();
  fixWeeklyChallengeToAchievement();
  removeCalculatorBtn();
  hideTDSTextInWallet();
  remove3DCardButton();
  patchRewardsStore();
  patchRivalCard();
  fixPreviewShareButton();
  fixSpecialTabLabels();
  beautifyMatchCard();
  beautifyPlayerCard();
  lockFFUIDAfterSet();
}

/* Wait for DOM + Firebase */
var _initTry = 0;
var _initIv = setInterval(function() {
  _initTry++;
  if (document.body && window.db && window.U) {
    clearInterval(_initIv);
    runAll();
    /* Re-run header on navTo */
    var _ov = window.navTo;
    if (_ov) window.navTo = function(s) {
      _ov.apply(this, arguments);
      setTimeout(fixHeader, 100);
      setTimeout(styleTickerText, 200);
      setTimeout(fixSpecialTabLabels, 300);
    };
  }
  if (_initTry > 30) { clearInterval(_initIv); runAll(); }
}, 300);

console.log('[Mini eSports] ✅ UI Fixes Master loaded');
})();
