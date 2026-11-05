/* ====== LOOT CRATE ANIMATION ====== */
function showLootCrate(prize) {
  /* Remove any existing loot overlay to prevent stacking */
  var existing = document.getElementById('_lootOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = '_lootOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.85);backdrop-filter:blur(4px)';
  overlay.innerHTML = '<div id="_lootBox" style="text-align:center;animation:lootDrop .6s cubic-bezier(.175,.885,.32,1.275)">' +
    '<div style="font-size:80px;margin-bottom:8px;filter:drop-shadow(0 0 30px #ffd700)">📦</div>' +
    '<div style="font-size:16px;color:#ffd700;font-weight:800;margin-bottom:4px">PRIZE BOX DROPPED!</div>' +
    '<div id="_lootOpen" style="font-size:48px;cursor:pointer;animation:spin .3s ease" onclick="this.parentElement.parentElement._burst()">🎁</div>' +
    '<div style="font-size:13px;color:var(--txt2);margin-top:8px">Tap to open!</div>' +
  '</div>';
  // Add burst animation
  var style = document.createElement('style');
  style.textContent = '@keyframes lootDrop{from{transform:translateY(-200px) scale(.3);opacity:0}to{transform:none;opacity:1}}@keyframes spin{from{transform:rotate(-20deg)}to{transform:rotate(20deg)}}@keyframes confettiFall{from{transform:translateY(-20px) rotate(0);opacity:1}to{transform:translateY(100vh) rotate(720deg);opacity:0}}';
  document.head.appendChild(style);
  overlay._burst = function() {
    var box = document.getElementById('_lootBox');
    if (box) {
      // Burst with coins
      var coins = ['💰','💵','🪙','💸','⭐','✨'];
      for (var i = 0; i < 20; i++) {
        var c = document.createElement('div');
        c.textContent = coins[Math.floor(Math.random()*coins.length)];
        c.style.cssText = 'position:fixed;font-size:24px;left:'+(Math.random()*100)+'vw;top:30vh;animation:confettiFall '+(1+Math.random())+'s ease forwards;z-index:100000;animation-delay:'+(Math.random()*.5)+'s';
        document.body.appendChild(c);
        setTimeout(function(el){el.remove();}, 2000, c);
      }
      box.innerHTML = '<div style="font-size:60px;margin-bottom:8px;filter:drop-shadow(0 0 40px #00ff6a)">💰</div>' +
        '<div style="font-size:20px;color:#00ff6a;font-weight:900">💎' + (prize||'?') + ' WON!</div>' +
        '<div style="font-size:13px;color:var(--txt2);margin-top:6px">Added to your wallet!</div>' +
        '<button onclick="this.closest(\'[style*=fixed]\').remove()" style="margin-top:16px;padding:10px 24px;background:var(--green);color:#000;border:none;border-radius:20px;font-weight:800;font-size:14px;cursor:pointer">🎉 Awesome!</button>';
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    }
  };
  document.body.appendChild(overlay);
  // Auto remove after 8s
  setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 8000);
}
function watchAd() {
  if (window.AdManager) {
    window.AdManager.showRewardedAd(
      window.onAdReward,
      function() { toast('Ad load nahi hua, dobara try karo.', 'err'); },
      'watchAd'
    );
  } else if (window.Android && window.Android.showRewardedAd) {
    window.Android.showRewardedAd();
  } else {
    toast('Ads available only in APK version', 'inf');
  }
}
window.onAdReward = function() {
  /* Guard: if ad-match pending, route to match reward handler */
  if (window._adMatchPending) {
    onAdRewardForMatch(window._adMatchPending);
    window._adMatchPending = null;
    return;
  }
  /* ✅ SECURITY FIX (2026-09-08): "server-authoritative wallet RPC"
     audit — this was completely unlimited: window.onAdReward is
     globally callable, adCoins was a client-read config value, and
     there was NO daily-limit enforcement anywhere for this specific
     flow (unlike watch-earn, which at least had a client-side daily
     cap) — a user could call this directly from devtools as many
     times as they wanted with zero ad ever shown. Replaced with
     claim_ad_reward() — a dedicated RPC that computes the coin amount
     from server config, rate-limits rapid repeat calls, and enforces
     the real daily limit against actual logged rows. */
  if (window._supa && window.U) {
    window._supa.rpc('claim_ad_reward')
      .then(function(res) {
        var d = res && res.data;
        if (!d || !d.success) {
          if (d && d.error) toast(d.error, 'inf');
          return;
        }
        if (window.UD) { window.UD.coins = (window.UD.coins || 0) + d.coinsEarned; if (window.updateHdr) window.updateHdr(); }
        if (window.toast) window.toast('+' + d.coinsEarned + ' Coins earned! 🪙', 'ok');
      }, function() { toast('Reward claim failed', 'err'); });
  }
};

/* ====== AD-BASED MATCH JOIN SYSTEM ====== */
// Track ad watches per match per session
window._adWatchCount = {};
window._adMatchPending = null;

// Show ad-watch popup before joining an ad-match
function showAdJoinPopup(matchId) {
  var t = MT[matchId]; if (!t) return;
  var adsRequired = Number(t.adsRequired) || 2;
  var watched = window._adWatchCount[matchId] || 0;
  var remaining = adsRequired - watched;

  var h = '<div style="text-align:center;padding:8px 0 4px">';
  h += '<div style="font-size:36px;margin-bottom:6px">📺</div>';
  h += '<div style="font-size:17px;font-weight:800;color:var(--green);margin-bottom:4px">FREE Match — Ads Dekho, Match Khelo!</div>';
  h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:16px">Yeh match bilkul free hai. Sirf <b style="color:#fff">' + adsRequired + ' short ads</b> dekhne ke baad join kar sakte ho.</div>';

  // Progress dots
  h += '<div style="display:flex;justify-content:center;gap:10px;margin-bottom:18px">';
  for (var i = 0; i < adsRequired; i++) {
    var done = i < watched;
    h += '<div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;';
    h += done ? 'background:rgba(0,255,106,.2);border:2px solid #00ff6a;color:#00ff6a' : 'background:rgba(255,255,255,.06);border:2px dashed rgba(255,255,255,.2);color:#555';
    h += '">' + (done ? '✓' : (i + 1)) + '</div>';
  }
  h += '</div>';

  if (remaining > 0) {
    h += '<div style="font-size:12px;color:#aaa;margin-bottom:14px">Abhi <b style="color:#fff">' + remaining + ' ad' + (remaining > 1 ? 's' : '') + '</b> aur dekhni hai</div>';
    h += '<button onclick="watchAdForMatch(\'' + matchId + '\')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;font-size:15px;border:none;cursor:pointer;letter-spacing:.5px">▶ Ad Dekho (' + watched + '/' + adsRequired + ')</button>';
  } else {
    h += '<div style="font-size:13px;color:#00ff9c;font-weight:700;margin-bottom:14px">✅ Sabhi ads dekh li! Ab join kar sakte ho.</div>';
    h += '<button onclick="confirmAdMatchJoin(\'' + matchId + '\')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;font-size:15px;border:none;cursor:pointer">🎮 Match Join Karo!</button>';
  }
  h += '</div>';
  showModal('🎯 ' + (t.name || 'Match'), h);
}

// Simulate/trigger ad watch for match
function watchAdForMatch(matchId) {
  window._adMatchPending = matchId;
  // Use AdManager (handles real AdMob + web fallback)
  if (window.AdManager) {
    window.AdManager.showRewardedAd(
      function() { onAdRewardForMatch(matchId); },
      function() { toast('Ad load nahi hua, dobara try karo.', 'err'); },
      'adMatch_' + matchId
    );
    return;
  }
  // Legacy Android bridge
  if (window.Android && window.Android.showRewardedAd) {
    window.Android.showRewardedAd();
    return;
  }
  // Pure web fallback countdown
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff';
  overlay.id = 'adOverlay_' + matchId;
  var adBrands = ['🎮 Gaming Pro', '📱 App Store', '🛒 Shop Now', '🏆 Win Big'];
  var brand = adBrands[Math.floor(Math.random() * adBrands.length)];
  var sec = 5;
  overlay.innerHTML = '<div style="font-size:10px;color:#555;position:absolute;top:14px;left:16px;letter-spacing:1px">ADVERTISEMENT</div>' +
    '<div style="font-size:28px;font-weight:900;margin-bottom:12px">' + brand + '</div>' +
    '<div style="font-size:13px;color:#888;margin-bottom:24px">Reward ke liye poori ad dekho</div>' +
    '<div style="width:80px;height:80px;border-radius:50%;background:rgba(0,255,106,.1);border:3px solid #00ff9c;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#00ff9c" id="adTimer">' + sec + '</div>' +
    '<div style="font-size:11px;color:#555;margin-top:12px">Ad band nahi kar sakte</div>';
  document.body.appendChild(overlay);
  var iv = setInterval(function() {
    sec--;
    var el = document.getElementById('adTimer');
    if (el) el.textContent = sec;
    if (sec <= 0) { clearInterval(iv); overlay.remove(); onAdRewardForMatch(matchId); }
  }, 1000);
}

// Called when ad is completed (real or simulated)
function onAdRewardForMatch(matchId) {
  if (!matchId) matchId = window._adMatchPending;
  if (!matchId) return;
  if (!window._adWatchCount[matchId]) window._adWatchCount[matchId] = 0;
  window._adWatchCount[matchId]++;
  var t = MT[matchId];
  var adsRequired = Number(t && t.adsRequired) || 2;
  var watched = window._adWatchCount[matchId];
  toast('Ad ' + watched + '/' + adsRequired + ' complete! 🎉', 'ok');
  // Reopen popup to show updated progress
  setTimeout(function() { showAdJoinPopup(matchId); }, 400);
}

/* onAdReward is fully defined above (handles both ad-match and regular ad rewards) */
/* window._adMatchPending set by watchAdForMatch() before triggering AdMob */

/* ✅ FIX: Ad match join now goes through Supabase join_requests (was Firebase-only, broke My Matches + room reveal) */
function confirmAdMatchJoin(matchId) {
  closeModal();
  var t = MT[matchId]; if (!t) return;
  var tp = (t.mode || t.type || 'solo').toLowerCase();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';

  if (!window._supa || !window.U) { toast('Service unavailable. Try again.', 'err'); return; }

  /* ══ R6 FIX ══
     Pehle yahan DIRECT join_requests INSERT hota tha — capacity/filled_slots
     ka koi server check nahi (ad match oversubscribe ho sakta tha, slot
     accounting bilkul skip). Ab FREE/AD join bhi single authority =
     validate_and_join_match RPC (match lock + capacity + duplicate + slot
     increment sab server-side atomic). RPC fail = join fail safely —
     koi direct client join-row नहीं। */
  window._supa.rpc('validate_and_join_match', {
    p_uid:       window.U.uid,
    p_match_id:  matchId,
    p_entry_fee: 0,
    p_currency:  'coins',
    p_join_data: { mode: tp, ign: (window.UD && window.UD.ign) || '' }
  }).then(function(r) {
    if (r && r.error) { toast('Join failed: ' + (r.error.message || ''), 'err'); return; }
    if (r && r.data && r.data.ok === false) { toast('❌ ' + (r.data.error || 'Join failed'), 'err'); return; }

    /* ad-watched marker — own-row non-financial update (display/tracking only) */
    if (window._supa) {
      window._supa.from('join_requests').update({ ad_watched: true })
        .eq('match_id', matchId).eq('user_id', window.U.uid).then(null, function() {});
    }
    /* Update local MT + JR cache */
    if (window.MT && window.MT[matchId]) {
      window.MT[matchId].joinedSlots = (window.MT[matchId].joinedSlots || 0) + 1;
      window.MT[matchId].filledSlots = window.MT[matchId].joinedSlots;
    }
    if (!window.JR) window.JR = {};
    var _jid = 'ad_' + matchId + '_' + Date.now();
    window.JR[_jid] = { matchId: matchId, userId: window.U.uid, status: 'joined', entryType: 'ad', createdAt: Date.now() };
    window._adWatchCount[matchId] = 0; /* reset ad count */
    toast('🎮 Match Joined! Room ID milne par notification aayega.', 'ok');
    if (window.renderMM) setTimeout(window.renderMM, 400);
    navTo('matches');
  }).catch(function(e) {
    toast('Join failed — retry karo', 'err');
    console.error('[AdJoin]', e);
  });
}

/* ====== RANK ====== */
function calcRkScore(stats) {
  var wins=Number(stats.wins||0), kills=Number(stats.kills||0),
      matches=Number(stats.matches||0), streak=Number(stats.winStreak||0);
  return wins*40 + kills*2 + matches*1 + streak*10;
}
function calcRk(stats) {
  var s = calcRkScore(stats);
  if (s >= 5000) return { badge: 'Grandmaster', emoji: '🌟', color: '#ff4500', bg: 'rgba(255,69,0,.15)',     pts: s };
  if (s >= 3500) return { badge: 'Heroic',      emoji: '⚔️',  color: '#ff1493', bg: 'rgba(255,20,147,.12)',  pts: s };
  if (s >= 2000) return { badge: 'Legend',      emoji: '👑', color: '#b964ff', bg: 'rgba(185,100,255,.15)', pts: s };
  if (s >= 1501) return { badge: 'Diamond',     emoji: '💎', color: '#00d4ff', bg: 'rgba(0,212,255,.15)',   pts: s };
  if (s >= 1001) return { badge: 'Platinum',    emoji: '🔷', color: '#e0e0ff', bg: 'rgba(180,180,255,.13)', pts: s };
  if (s >= 601)  return { badge: 'Gold',        emoji: '🥇', color: '#ffd700', bg: 'rgba(255,215,0,.14)',   pts: s };
  if (s >= 301)  return { badge: 'Silver',      emoji: '🥈', color: '#c0c0c0', bg: 'rgba(192,192,192,.13)', pts: s };
  return           { badge: 'Bronze',       emoji: '🏅', color: '#cd7f32', bg: 'rgba(205,127,50,.13)',  pts: s };
}
function getPlayerBadges(st, lv) {
  var badges = [];
  var w = st.wins||0, k = st.kills||0, m = st.matches||0, streak = st.winStreak||0;
  var rk = calcRk(st);
  // Each badge: icon, name, desc, color, bg, glow, anim
  if (m >= 1)    badges.push({ icon:'🎮', name:'First Match',   desc:'First match played',    color:'#00ff6a', bg:'rgba(0,255,106,.12)',   glow:'0 0 12px rgba(0,255,106,.5)',   anim:'' });
  if (m >= 10)   badges.push({ icon:'⚔️',  name:'Veteran',      desc:'10+ matches',           color:'#00d4ff', bg:'rgba(0,212,255,.12)',   glow:'0 0 12px rgba(0,212,255,.5)',   anim:'' });
  if (m >= 50)   badges.push({ icon:'🎯', name:'Sharpshooter', desc:'50+ matches played',    color:'#ff9f1c', bg:'rgba(255,159,28,.12)',  glow:'0 0 12px rgba(255,159,28,.5)',  anim:'' });
  if (w >= 1)    badges.push({ icon:'🏆', name:'Champion',     desc:'First win!',            color:'#ffd700', bg:'rgba(255,215,0,.14)',   glow:'0 0 14px rgba(255,215,0,.6)',   anim:'badge-pulse' });
  if (w >= 5)    badges.push({ icon:'👑', name:'Dominator',    desc:'5+ wins',               color:'#b964ff', bg:'rgba(185,100,255,.14)', glow:'0 0 14px rgba(185,100,255,.6)', anim:'badge-pulse' });
  if (w >= 20)   badges.push({ icon:'⚡', name:'Unstoppable',  desc:'20+ wins',              color:'#ff4500', bg:'rgba(255,69,0,.14)',    glow:'0 0 14px rgba(255,69,0,.6)',    anim:'badge-glow' });
  if (k >= 10)   badges.push({ icon:'🔪', name:'Blade',        desc:'10+ kills',             color:'#ff6b6b', bg:'rgba(255,107,107,.12)', glow:'0 0 10px rgba(255,107,107,.4)', anim:'' });
  if (k >= 50)   badges.push({ icon:'💀', name:'Kill Machine', desc:'50+ kills',             color:'#ff2e2e', bg:'rgba(255,46,46,.14)',   glow:'0 0 14px rgba(255,46,46,.6)',   anim:'badge-pulse' });
  if (k >= 100)  badges.push({ icon:'☠️',  name:'Headhunter',  desc:'100+ kills',            color:'#ff0000', bg:'rgba(255,0,0,.15)',     glow:'0 0 16px rgba(255,0,0,.7)',     anim:'badge-glow' });
  if (streak>=3) badges.push({ icon:'🔥', name:'On Fire',      desc:'3+ win streak',         color:'#ff8c00', bg:'rgba(255,140,0,.14)',   glow:'0 0 14px rgba(255,140,0,.6)',   anim:'badge-fire' });
  if (streak>=5) badges.push({ icon:'🌋', name:'Volcano',      desc:'5+ win streak',         color:'#ff4500', bg:'rgba(255,69,0,.15)',    glow:'0 0 16px rgba(255,69,0,.7)',    anim:'badge-fire' });
  if (lv >= 10)  badges.push({ icon:'💫', name:'Pro Player',   desc:'Level 10',              color:'#00ff9c', bg:'rgba(0,255,156,.12)',   glow:'0 0 12px rgba(0,255,156,.5)',   anim:'' });
  if (lv >= 20)  badges.push({ icon:'🌟', name:'Elite',        desc:'Level 20',              color:'#ffd700', bg:'rgba(255,215,0,.14)',   glow:'0 0 14px rgba(255,215,0,.6)',   anim:'badge-pulse' });
  // Top 3 special badges set by admin
  if (st._top1)  badges.push({ icon:'👑', name:'#1 Champion',  desc:'Season #1',             color:'#ffd700', bg:'rgba(255,215,0,.2)',    glow:'0 0 20px rgba(255,215,0,.8)',   anim:'badge-glow' });
  if (st._top2)  badges.push({ icon:'🥈', name:'#2 Runner',    desc:'Season #2',             color:'#c0c0c0', bg:'rgba(192,192,192,.18)', glow:'0 0 16px rgba(200,200,200,.7)', anim:'badge-pulse' });
  if (st._top3)  badges.push({ icon:'🥉', name:'#3 Bronze',    desc:'Season #3',             color:'#cd7f32', bg:'rgba(205,127,50,.18)',  glow:'0 0 14px rgba(205,127,50,.6)',  anim:'' });
  return badges;
}
var _rankTab = 'kills'; // kills | wins | rankpoints

/* ====================================================================
   D69 (2026-11-06): RANK ARENA — owner ke selected screenshot (portrait
   "RANK LEADERBOARD / Top Competitors" mock) ka poori mehnat se banaya
   inline replica. Sab CSS + SVG inline (koi external asset/file nahi)
   taki APK offline-mode aur har preview me pixel-same dikhe.
   Cheezein jo replica me hain: purple arena + light beams + ceiling
   lamps, dono side hanging banners (PLAY/COMPETE/CLIMB/REPEAT &
   SMALL/GAMES/BIG/CHAMPIONS), cursive script lines, gold trophy +
   laurels, chamfered plaque, 2-1-3 podium (crown+wreath ring p1,
   ribbon-medals p2/p3), metallic pedestals (p1 par laurel-wreath
   number), crowd silhouettes + phone-lights, smoke, floor glow aur
   MINI ESPORTS footer branding. Data asli rehta hai (ign, kills/wins/
   pts, tier badge, avatar) — sirf shakal screenshot jaisi.
   ==================================================================== */
var _rkCssDone = false;
var RK_CSS = [
  '.rkArena{position:relative;border:2px solid rgba(232,197,101,.55);border-radius:18px;overflow:hidden;text-align:center;padding:12px 8px 8px;margin:0 0 12px;background:radial-gradient(120% 55% at 50% 0%,rgba(126,46,200,.38),transparent 62%),radial-gradient(90% 40% at 50% 100%,rgba(255,190,60,.10),transparent 65%),linear-gradient(180deg,#170a28 0%,#241143 34%,#1c0c34 62%,#0a0416 100%);box-shadow:inset 0 0 60px rgba(90,30,160,.35),0 6px 24px rgba(0,0,0,.6)}',
  '.rkArena *{box-sizing:border-box}',
  '.rkBeams{position:absolute;inset:0;pointer-events:none;background:conic-gradient(from 180deg at 50% -12%,transparent 41%,rgba(255,214,110,.24) 44%,transparent 47%,rgba(190,120,255,.26) 50%,transparent 53%,rgba(255,214,110,.19) 56%,transparent 59%)}',
  '.rkLampL,.rkLampR{position:absolute;top:6px;width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 14px 6px rgba(255,240,200,.7)}',
  '.rkLampL{left:12%}.rkLampR{right:12%}',
  '.rkBannerL{position:absolute;top:34px;left:3%;width:44px;z-index:1}',
  '.rkBannerR{position:absolute;top:34px;right:3%;width:44px;z-index:1}',
  '.rkScript{position:absolute;top:30%;width:19%;z-index:1;font-family:"Segoe Script","Brush Script MT","Lucida Handwriting",cursive;color:#d8b45a;font-size:10.5px;line-height:1.3;text-shadow:0 0 12px rgba(216,180,90,.55);font-weight:700}',
  '.rkScriptL{left:2.5%;transform:rotate(-8deg)}',
  '.rkScriptR{right:2.5%;transform:rotate(8deg)}',
  '.rkTrophy{position:relative;z-index:2;margin:6px auto 0;width:132px;line-height:0}',
  '.rkPlaque{position:relative;z-index:2;width:72%;max-width:330px;margin:2px auto 0;background:linear-gradient(180deg,#f4d788,#c9a24a);clip-path:polygon(4% 0,96% 0,100% 28%,100% 72%,96% 100%,4% 100%,0 72%,0 28%);padding:2px}',
  '.rkPlaqueIn{background:linear-gradient(180deg,#2a1348,#150a26);clip-path:polygon(4% 0,96% 0,100% 28%,100% 72%,96% 100%,4% 100%,0 72%,0 28%);padding:8px 6px 7px}',
  '.rkTitle{font-size:20px;font-weight:900;letter-spacing:1.5px;background:linear-gradient(180deg,#ffefad,#e8b13f 55%,#a86e1f);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 5px rgba(0,0,0,.8));white-space:nowrap}',
  '.rkSub{color:#efe8fb;font-size:9.5px;letter-spacing:2.5px;margin-top:3px;font-weight:600}',
  '.rkCrowdGlow{position:absolute;bottom:28px;left:0;right:0;height:90px;z-index:0;background:radial-gradient(60% 100% at 50% 100%,rgba(150,80,255,.28),transparent 70%)}',
  '.rkCrowdSvg{position:absolute;left:0;right:0;bottom:46px;width:100%;height:34px;z-index:0;opacity:1}',
  '.rkSmoke{position:absolute;bottom:34px;width:40%;height:70px;filter:blur(8px);background:radial-gradient(ellipse at center,rgba(200,160,255,.32),transparent 70%);z-index:0}',
  '.rkSmokeL{left:-6%}.rkSmokeR{right:-6%}',
  '.rkPod{position:relative;z-index:2;display:flex;align-items:flex-end;justify-content:center;gap:8px;margin-top:18px;padding:0 6px}',
  '.rkCol{flex:1;max-width:112px;display:flex;flex-direction:column;align-items:center;min-width:0}',
  '.rkCrownSvg{width:34px;margin-bottom:2px;filter:drop-shadow(0 2px 6px rgba(255,80,80,.45))}',
  '.rkRingWrap{position:relative;display:inline-block}',
  '.rkRing{border-radius:50%;border:4px solid #ffd700;background:#0b0b0f;color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:28px;width:84px;height:84px;box-shadow:0 0 22px rgba(255,215,0,.5),inset 0 0 10px rgba(0,0,0,.8)}',
  '.rkRing img{width:100%;height:100%;object-fit:cover;border-radius:50%}',
  '.rkCol.p2 .rkRing{width:56px;height:56px;border-color:#d9d9e3;box-shadow:0 0 16px rgba(217,217,227,.45);font-size:20px}',
  '.rkCol.p3 .rkRing{width:56px;height:56px;border-color:#cd7f32;box-shadow:0 0 16px rgba(205,127,50,.5);font-size:20px}',
  '.rkLau{position:absolute;top:2px;width:16px;height:56px}',
  '.rkLau.L{left:-15px}.rkLau.R{right:-15px;transform:scaleX(-1)}',
  '.rkMedalSvg{width:26px;margin-top:4px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}',
  '.rkName{margin-top:5px;font-size:12px;font-weight:800;color:#fff;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 3px #000}',
  '.rkVal{font-size:11px;font-weight:800;margin-top:1px;text-shadow:0 1px 3px #000}',
  '.rkCol.p1 .rkVal{color:#ffd700}.rkCol.p2 .rkVal{color:#e8e8f2}.rkCol.p3 .rkVal{color:#f2e3d2}',
  '.rkTier{margin-top:4px;font-size:9px;font-weight:800;color:#ffd700;background:rgba(64,38,6,.8);border:1px solid rgba(255,215,0,.55);border-radius:11px;padding:2px 9px;display:inline-flex;gap:4px;align-items:center}',
  '.rkPed{width:88%;position:relative;margin-top:9px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900}',
  '.rkPed::before{content:"";position:absolute;top:-7px;left:0;right:0;height:14px;border-radius:50%;background:inherit;filter:brightness(1.25)}',
  '.rkCol.p1 .rkPed{height:100px;background:linear-gradient(90deg,#6b4d00,#ffd700 30%,#fff2b0 50%,#ffd700 70%,#6b4d00);font-size:32px;color:#fff8d0;text-shadow:0 0 10px rgba(255,200,0,.8)}',
  '.rkCol.p2 .rkPed{height:62px;background:linear-gradient(90deg,#43434e,#c9c9d4 30%,#f2f2f8 50%,#c9c9d4 70%,#43434e);font-size:24px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.5)}',
  '.rkCol.p3 .rkPed{height:54px;background:linear-gradient(90deg,#4a2a10,#cd7f32 30%,#f0b070 50%,#cd7f32 70%,#4a2a10);font-size:24px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.5)}',
  '.rkPedW{display:flex;align-items:center;gap:1px}',
  '.rkLauS{width:12px;height:38px;opacity:.9}',
  '.rkLauS.R{transform:scaleX(-1)}',
  '.rkFloorGlow{position:relative;z-index:1;height:20px;margin-top:-4px;background:radial-gradient(60% 100% at 50% 0%,rgba(255,215,0,.16),transparent 70%)}',
  '.rkFoot{position:relative;z-index:2;margin-top:8px;line-height:1.2}',
  '.rkFootCrown{width:16px;margin:0 auto 2px;display:block}',
  '.rkFootName{letter-spacing:5px;font-size:11px;color:#d8b45a;font-weight:700}',
  '.rkFootTag{letter-spacing:3px;font-size:8px;color:#96703d;margin-top:3px;font-weight:600}',
  '.rkEmpty{color:#b9a0e0;font-size:12px;padding:26px 0 34px;font-weight:700}',
  '.rkLau svg,.rkLauS svg{width:100%;height:100%;display:block}',
  '.rkLauS{display:block}',
  '.rkBannerL svg,.rkBannerR svg{width:100%;height:auto;display:block}'
].join('');
function _rkCss() {
  if (_rkCssDone || document.getElementById('rkArenaCss')) { _rkCssDone = true; return; }
  var st = document.createElement('style');
  st.id = 'rkArenaCss';
  st.textContent = RK_CSS;
  document.head.appendChild(st);
  _rkCssDone = true;
}
var RK_DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
  '<linearGradient id="rkGld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset=".5" stop-color="#ffd700"/><stop offset="1" stop-color="#b8860b"/></linearGradient>' +
  '<linearGradient id="rkSil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f2f8"/><stop offset=".55" stop-color="#9a9aa8"/><stop offset="1" stop-color="#6e6e80"/></linearGradient>' +
  '<linearGradient id="rkBrz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0b070"/><stop offset=".55" stop-color="#cd7f32"/><stop offset="1" stop-color="#8a4f1d"/></linearGradient>' +
  '<linearGradient id="rkBan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#45196e"/><stop offset="1" stop-color="#2a0f4a"/></linearGradient>' +
  '</defs></svg>';
function _rkLaurel(color) {
  var leaves = [[6,50,-38],[4,40,-30],[4.5,30,-20],[6.5,20,-10],[10,11,0],[14,5,12]].map(function (l) {
    return '<ellipse cx="' + l[0] + '" cy="' + l[1] + '" rx="4.6" ry="2.2" transform="rotate(' + l[2] + ' ' + l[0] + ' ' + l[1] + ')" fill="' + color + '"/>';
  }).join('');
  return '<svg viewBox="0 0 18 60" xmlns="http://www.w3.org/2000/svg"><path d="M14 58 Q3 40 7 20 Q9 9 15 2" fill="none" stroke="' + color + '" stroke-width="2.2"/>' + leaves + '</svg>';
}
function _rkCrownSvg(cls) {
  return '<svg class="' + (cls || '') + '" viewBox="0 0 40 26" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M3 21 L1 7 L11 13 L20 2 L29 13 L39 7 L37 21 Z" fill="url(#rkGld)" stroke="#8a5a00" stroke-width="1"/>' +
    '<circle cx="1" cy="7" r="1.7" fill="#ffe9a3"/><circle cx="20" cy="2" r="1.7" fill="#ffe9a3"/><circle cx="39" cy="7" r="1.7" fill="#ffe9a3"/>' +
    '<circle cx="20" cy="13" r="2.6" fill="#e23b3b"/><circle cx="10" cy="16" r="1.6" fill="#7b2ff7"/><circle cx="30" cy="16" r="1.6" fill="#7b2ff7"/>' +
    '<rect x="3" y="19.5" width="34" height="4" rx="2" fill="url(#rkGld)" stroke="#8a5a00" stroke-width=".6"/></svg>';
}
function _rkMedalSvg(num, metal) {
  var grad = metal === 's' ? 'url(#rkSil)' : 'url(#rkBrz)';
  var ink = metal === 's' ? '#2b2b33' : '#4a2a10';
  return '<svg class="rkMedalSvg" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">' +
    '<polygon points="10,0 16,0 17,13 12,13" fill="#3f74e0"/><polygon points="24,0 18,0 17,13 22,13" fill="#2b57b0"/>' +
    '<circle cx="17" cy="26" r="11" fill="' + grad + '" stroke="rgba(0,0,0,.35)" stroke-width="1"/>' +
    '<circle cx="17" cy="26" r="7.6" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1"/>' +
    '<text x="17" y="30.5" text-anchor="middle" font-size="12" font-weight="900" fill="' + ink + '" font-family="Arial,sans-serif">' + num + '</text></svg>';
}
function _rkTrophySvg() {
  var leafL = [[14,58,-40],[10,48,-35],[9,38,-25],[11,28,-15],[16,18,-5],[23,10,10]].map(function (l) {
    return '<ellipse cx="' + l[0] + '" cy="' + l[1] + '" rx="5" ry="2.4" transform="rotate(' + l[2] + ' ' + l[0] + ' ' + l[1] + ')" fill="#d8b45a"/>';
  }).join('');
  return '<svg viewBox="0 0 132 74" xmlns="http://www.w3.org/2000/svg" style="width:100%">' +
    '<g><path d="M20 66 Q6 44 18 20 Q22 12 30 6" fill="none" stroke="#d8b45a" stroke-width="2.5"/>' + leafL + '</g>' +
    '<g transform="translate(132,0) scale(-1,1)"><path d="M20 66 Q6 44 18 20 Q22 12 30 6" fill="none" stroke="#d8b45a" stroke-width="2.5"/>' + leafL + '</g>' +
    '<path d="M48 22 q-12 0 -10 12 q2 10 12 10" fill="none" stroke="url(#rkGld)" stroke-width="3"/>' +
    '<path d="M84 22 q12 0 10 12 q-2 10 -12 10" fill="none" stroke="url(#rkGld)" stroke-width="3"/>' +
    '<path d="M48 16 h36 v12 q0 16 -18 18 q-18 -2 -18 -18 z" fill="url(#rkGld)" stroke="#8a5a00" stroke-width="1"/>' +
    '<polygon points="66,20 71,26 66,32 61,26" fill="#8b2ff7" stroke="#e8c565" stroke-width="1"/>' +
    '<rect x="62" y="46" width="8" height="8" fill="url(#rkGld)"/>' +
    '<rect x="54" y="54" width="24" height="6" rx="2" fill="url(#rkGld)" stroke="#8a5a00" stroke-width=".6"/>' +
    '<rect x="50" y="60" width="32" height="6" rx="2" fill="#b8860b"/>' +
    '</svg>';
}
function _rkBannerSvg(side) {
  var words = side === 'L' ? ['PLAY', 'COMPETE', 'CLIMB', 'REPEAT'] : ['SMALL', 'GAMES', 'BIG', 'CHAMPIONS'];
  var txt = words.map(function (w, i) {
    return '<text x="26" y="' + (30 + i * 17) + '" text-anchor="middle" font-size="7.5" font-weight="800" letter-spacing="1" fill="#e8c565" font-family="Arial,sans-serif">' + w + '</text>';
  }).join('');
  return '<svg class="rkBanner' + side + '" viewBox="0 0 52 168" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M1 1 h50 v138 l-25 27 l-25 -27 z" fill="url(#rkBan)" stroke="#c9a24a" stroke-width="2"/>' +
    '<path d="M6 6 h40 v130 l-20 21 l-20 -21 z" fill="none" stroke="rgba(232,197,101,.35)" stroke-width="1"/>' +
    txt +
    '<path d="M18 122 l-2 -9 l7 5 l3 -8 l3 8 l7 -5 l-2 9 z" fill="#e8c565"/>' +
    '</svg>';
}
function _rkCrowdSvg() {
  var d = 'M0 34 L0 24';
  for (var x = 0; x < 360; x += 24) d += ' Q' + (x + 12) + ' 10 ' + (x + 24) + ' 24';
  d += ' L360 34 Z';
  var dots = [[40,20,'#ffd700'],[118,15,'#fff'],[208,21,'#ffd700'],[298,17,'#fff'],[340,22,'#ffd700']].map(function (c) {
    return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="1.2" fill="' + c[2] + '" opacity=".55"/>';
  }).join('');
  return '<svg class="rkCrowdSvg" viewBox="0 0 360 34" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="' + d + '" fill="#140a26"/>' + dots + '</svg>';
}
function _arenaCard(users, sortKey) {
  _rkCss();
  var h = '<div class="rkArena">' + RK_DEFS +
    '<div class="rkBeams"></div><div class="rkLampL"></div><div class="rkLampR"></div>' +
    _rkBannerSvg('L') + _rkBannerSvg('R') +
    '<div class="rkScript rkScriptL">Legends<br>Play<br>Here</div>' +
    '<div class="rkScript rkScriptR">Gamet<br>Beyond<br>Limits</div>' +
    '<div class="rkTrophy">' + _rkTrophySvg() + '</div>' +
    '<div class="rkPlaque"><div class="rkPlaqueIn"><div class="rkTitle">RANK LEADERBOARD</div>' +
    '<div class="rkSub">&mdash;&nbsp; Top Competitors &nbsp;&mdash;</div></div></div>' +
    '<div class="rkCrowdGlow"></div>' + _rkCrowdSvg() + '<div class="rkSmoke rkSmokeL"></div><div class="rkSmoke rkSmokeR"></div>' +
    '<div class="rkPod">';
  var top = (users || []).slice(0, 3);
  if (!top.length) {
    h += '<div class="rkEmpty">🏆 No ranked players yet</div>';
  } else {
    /* podium order: 2nd | 1st | 3rd (screenshot jaisa) */
    var slots = [];
    if (top[1]) slots.push({ u: top[1], cls: 'p2', num: 2 });
    slots.push({ u: top[0], cls: 'p1', num: 1 });
    if (top[2]) slots.push({ u: top[2], cls: 'p3', num: 3 });
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i], u = s.u;
      var isDel = (u.ign || u.displayName || '') === '[deleted]';
      var av = isDel ? '<i class="fas fa-user" style="opacity:.4;font-size:22px;line-height:1"></i>'
        : (u.profileImage ? '<img src="' + u.profileImage + '" alt="">' : (u.ign || u.displayName || '?').charAt(0).toUpperCase());
      var val = _rankVal(u, sortKey);
      var valLabel = _rankValStr(val, sortKey);
      var rk = calcRk(u.stats || {});
      h += '<div class="rkCol ' + s.cls + '">';
      if (s.cls === 'p1') h += _rkCrownSvg('rkCrownSvg');
      h += '<div class="rkRingWrap">';
      if (s.cls === 'p1') h += '<span class="rkLau L">' + _rkLaurel('#e8c565') + '</span><span class="rkLau R">' + _rkLaurel('#e8c565') + '</span>';
      h += '<div class="rkRing">' + av + '</div></div>';
      if (s.cls !== 'p1') h += _rkMedalSvg(s.num, s.cls === 'p2' ? 's' : 'b');
      var _podRib = '';
      try { if (window.premiumRibbonFor && Number(u.premiumLevel || 0) > 0) _podRib = window.premiumRibbonFor(u.premiumLevel, u.premiumExpires, 12); } catch (e) {}
      h += '<div class="rkName">' + (window.escHtml ? window.escHtml(u.ign || u.displayName || 'Player') : (u.ign || u.displayName || 'Player')) + _podRib + '</div>';
      h += '<div class="rkVal">' + valLabel + '</div>';
      h += '<div class="rkTier">' + rk.emoji + ' ' + rk.badge + '</div>';
      h += '<div class="rkPed">';
      if (s.cls === 'p1') h += '<span class="rkPedW"><span class="rkLauS">' + _rkLaurel('#fff2b0') + '</span>' + s.num + '<span class="rkLauS R">' + _rkLaurel('#fff2b0') + '</span></span>';
      else h += s.num;
      h += '</div></div>';
    }
  }
  h += '</div><div class="rkFloorGlow"></div>' +
    '<div class="rkFoot">' + _rkCrownSvg('rkFootCrown') +
    '<div class="rkFootName">MINI ESPORTS</div>' +
    '<div class="rkFootTag">PLAY &bull; COMPETE &bull; BELONG</div></div>' +
    '</div>';
  return h;
}

/* ✅ D70: chrome (formula banner + tabs + season + tools) ek global parts
   function me — fixes-v7.js ka cached renderer bhi yahi chrome + arena use
   kare, taaki live par kabhi purana podium wapas na dikhe. */
function _rankChromeParts() {
  // Season info banner
  var season = window.getCurrentSeason ? window.getCurrentSeason() : { name: 'Season', daysLeft: 0, label: '' };

  /* How Rank Works + formula banner */
  var _tiers = [
    {b:'Bronze',e:'🏅',pts:'0'},    {b:'Silver',e:'🥈',pts:'301'},  {b:'Gold',e:'🥇',pts:'601'},
    {b:'Platinum',e:'🔷',pts:'1001'},{b:'Diamond',e:'💎',pts:'1501'},{b:'Legend',e:'👑',pts:'2000'},
    {b:'Heroic',e:'⚔️',pts:'3500'},  {b:'Grandmaster',e:'🌟',pts:'5000'}
  ];
  var tierHtml = _tiers.map(function(t){
    return '<div style="text-align:center;flex:1;min-width:36px"><div style="font-size:16px">'+t.e+'</div><div style="font-size:8px;color:#888;margin-top:1px">'+t.pts+'</div></div>';
  }).join('');
  var rankHeader = '<div class="rank-formula-banner" onclick="window.showHowRankWorks&&showHowRankWorks()">' +
    '<div style="font-size:10px;color:#888;margin-bottom:6px">📊 Rank = Wins×40 + Kills×2 + Matches×1 + Streak×10</div>' +
    '<div style="display:flex;gap:2px;align-items:center">' + tierHtml + '</div>' +
    '<div style="font-size:9px;color:#555;margin-top:4px;text-align:right">→ Tap for details</div>' +
    '</div>';

  var tabBar = rankHeader + '<div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px">' +
    ['kills','wins','rankpoints'].map(function(t) {
      var labels = { kills: '☠️ Kills', wins: '🏆 Wins', rankpoints: '💎 Rank Points' };
      var active = t === _rankTab;
      return '<div onclick="renderRank(\'' + t + '\')" style="flex:1;padding:9px 6px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;transition:all .2s;white-space:nowrap;text-align:center;' +
        (active ? 'background:linear-gradient(135deg,rgba(255,215,0,.16),rgba(123,47,247,.12));color:#ffd700;border:1.5px solid rgba(255,215,0,.45);box-shadow:0 0 12px rgba(255,215,0,.22)' :
                  'background:rgba(43,16,80,.35);color:#9a7dbd;border:1px solid rgba(185,100,255,.18)') +
        '">' + labels[t] + '</div>';
    }).join('') +
    '</div>';

  var seasonBanner = '<div style="display:flex;justify-content:space-between;align-items:center;' +
    'background:linear-gradient(135deg,rgba(185,100,255,.09),rgba(0,212,255,.06));' +
    'border:1px solid rgba(185,100,255,.2);border-radius:14px;padding:12px 16px;margin-bottom:12px;cursor:pointer" onclick="window.showHowRankWorks&&showHowRankWorks()">' +
    '<div><div style="font-size:13px;font-weight:900;color:#b964ff">' + season.name + '</div>' +
    '<div style="font-size:10px;color:#666;margin-top:1px">Resets monthly</div></div>' +
    '<div style="text-align:right">' +
    '<div style="font-size:16px;font-weight:900;color:#00d4ff">' + season.daysLeft + '</div>' +
    '<div style="font-size:10px;color:#666">din baaki</div></div>' +
    '</div>';

  /* ✅ B28 (2026-10-07): Clan War / City Championship / Mentor Hub — teeno
     screens (features/clan-war.js, city-championship.js, mentor.js) pehle
     panel me KAHIN se khulte hi nahi the (koi button inhe call hi nahi
     karta tha — users ke liye ye features pahunch se bahar the). Ab yahan
     Rank tab par teen saaf tool buttons hain. Handlers wahi purane
     (showClanWar / showCityChampionship / showMentorHub) — inka apna
     UI/logic wahi rehta hai. */
  var rankTools = '<div style="display:flex;gap:8px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px">' +
    [['⚔️','Clan War','showClanWar','rgba(255,107,107,.1)','rgba(255,107,107,.3)','#ff6b6b'],
     ['🏙️','City Champ','showCityChampionship','rgba(255,170,0,.1)','rgba(255,170,0,.3)','#ffaa00'],
     ['👨‍🏫','Mentor Hub','showMentorHub','rgba(255,215,0,.1)','rgba(255,215,0,.3)','#ffd700']].map(function(t){
      return '<button onclick="window.' + t[2] + '&&window.' + t[2] + '()" style="flex:1;min-width:96px;padding:10px 8px;border-radius:12px;background:' + t[3] + ';border:1px solid ' + t[4] + ';color:' + t[5] + ';font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">' + t[0] + ' ' + t[1] + '</button>';
    }).join('') +
    '</div>';

  return { tabBar: tabBar, seasonTools: seasonBanner + rankTools };
}

function renderRank(tab) {
  if (tab) _rankTab = tab;
  var rc = $('rankContent'); if (!rc) return;
  var _cp = _rankChromeParts();
  var tabBar = _cp.tabBar;
  var seasonBanner = _cp.seasonTools;
  rc.innerHTML = _arenaCard([], _rankTab) + tabBar + seasonBanner + '<div style="text-align:center;padding:30px"><div class="sp-spinner"></div></div>';

  if (!window._supa) { _renderRankList(rc, [], _rankTab, tabBar, seasonBanner, false); return; }
  window._supa.from('leaderboard').select('*').limit(300)
    .then(function(r) {
      var users = (r.data || []).map(function(u) {
        return { _uid: u.id, ign: u.ign||'Player', profileImage: u.avatar_url||'', rankPoints: u.rank_points||0, winStreak: 0, stats: { matches: u.total_matches||0, wins: u.total_wins||0, kills: u.total_kills||0 }, /* ✅ 2026-10-12: premium ribbon IGN ke aage — leaderboard row me public premium status aata hai (migration 20261012) */premiumLevel: Number(u.premium_level||0), premiumExpires: u.premium_expires ? new Date(u.premium_expires).getTime() : 0 };
      });
      var sortKey = _rankTab;
      users.sort(function(a, b) {
        var getVal = function(u) {
          var st = u.stats || {};
          if (_rankTab === 'kills') return Number(st.kills || 0);
          if (_rankTab === 'wins')  return Number(st.wins  || 0);
          return (Number(st.wins||0)*40) + (Number(st.kills||0)*2) + (Number(st.matches||0));
        };
        return getVal(b) - getVal(a);
      });
        _renderRankList(rc, users, sortKey, tabBar, seasonBanner, false);
    }).catch(function() { _renderRankList(rc, [], _rankTab, tabBar, seasonBanner, false); });
}

function _rankVal(u, sortKey) {
  var st = u.stats || {};
  if (sortKey === 'kills') return Number(st.kills || 0);
  if (sortKey === 'wins')  return Number(st.wins  || 0);
  return Number(st.wins||0)*40 + Number(st.kills||0)*2 + Number(st.matches||0) + Number(st.winStreak||u.winStreak||0)*10;
}
function _rankValStr(val, sortKey) {
  if (sortKey === 'kills') return val + ' kills';
  if (sortKey === 'wins')  return val + ' wins';
  return '🏆 ' + val + ' pts';
}
function _renderRankList(rc, users, sortKey, tabBar, seasonBanner, isSeason) {
  /* ✅ D69 (2026-11-06): podium ab RANK ARENA replica (_arenaCard) ke
     andar aata hai — owner ke selected screenshot jaisi poori screen.
     Purana .rank-podium block hataya; data/logic wahi purana. */
  var h = _arenaCard(users, sortKey) + tabBar + seasonBanner;
  for (var j = 3; j < users.length; j++) {
    var u = users[j];
    var rk = calcRk(u.stats || {});
    var _isDelR = (u.ign || u.displayName || '') === '[deleted]';
    var av = _isDelR ? '<i class="fas fa-user" style="opacity:.4;font-size:16px;line-height:1"></i>' : (u.profileImage ? '<img src="' + u.profileImage + '">' : (u.ign || u.displayName || '?').charAt(0).toUpperCase());
    var _stR = u.stats || {};
    var val;
    if (sortKey === 'kills') {
      val = Number(_stR.kills || 0);
    } else if (sortKey === 'wins') {
      val = Number(_stR.wins || 0);
    } else {
      var _wR = Number(_stR.wins||0), _kR = Number(_stR.kills||0),
          _mR = Number(_stR.matches||0), _skR = Number(_stR.winStreak||u.winStreak||0);
      val = _wR*40 + _kR*2 + _mR + _skR*10;
    }
    var valStr = sortKey === 'kills' ? val + ' kills' : sortKey === 'wins' ? val + ' wins' : '🏆 ' + val + ' pts';
    var isMe = window.U && (u._uid === window.U.uid);
    var _top10title = j < 7 ? ['','🔱 Warlord','⚔️ Slayer','💫 Elite','🎯 Sniper','🔥 Blaze','🌟 Star','🎖️ Knight'][j+1] || '' : '';
    /* ✅ 2026-10-12: row par data-uid — E2E (aur debugging) ke liye pakka hook,
       waise hi jaise admin panel ki Joined Players table ki rows par hai. */
    h += '<div class="rank-row" data-uid="' + (u._uid || '') + '"' + (isMe ? ' style="border:1px solid rgba(0,255,156,.3);background:rgba(0,255,156,.05)"' : '') + '>';
    h += '<div class="rank-num" style="color:' + (j===3?'#ffd700':j===4?'#c0c0c0':j===5?'#cd7f32':'var(--txt2)') + ';font-weight:' + (j<6?'900':'700') + '">#' + (j + 1) + '</div>';
    h += '<div class="rank-ava">' + av + '</div>';
    /* ✅ 2026-10-12: premium ribbon — IGN ke aage (sab players ko dikhta hai;
       expire ho chuka premium = koi ribbon nahi, "jhoota dava nahi"). */
    var _premRibbon = '';
    try {
      if (window.premiumRibbonFor && Number(u.premiumLevel||0) > 0) {
        _premRibbon = premiumRibbonFor(u.premiumLevel, u.premiumExpires, 15);
      } else if (isMe && window.premiumRibbonHtml) {
        _premRibbon = premiumRibbonHtml(15);   /* apni row: UD se live */
      }
    } catch (e) {}
    h += '<div class="rank-info"><div class="rn">' + (window.escHtml?window.escHtml(u.ign||u.displayName||'Player'):(u.ign||u.displayName||'Player')) + _premRibbon + (isMe ? ' <span style="font-size:9px;color:var(--green)">YOU</span>' : '');
    if (_top10title) h += ' <span style="font-size:9px;padding:1px 6px;border-radius:8px;background:rgba(255,215,0,.12);color:#ffd700;font-weight:800">' + _top10title + '</span>';
    h += '</div>';
    var _st = u.stats || {};
    var _m = Number(_st.matches||0), _w = Number(_st.wins||0), _k = Number(_st.kills||0);
    var _wr = _m > 0 ? Math.round((_w/_m)*100) : 0;
    var _kd = _m > 0 ? (_k/_m).toFixed(1) : '0.0';
    h += '<div class="rs">K:' + _k + ' · W:' + _w + ' · <span style="color:#00ff9c">WR:' + _wr + '%</span> · <span style="color:#ff9f1c">K/M:' + _kd + '</span></div></div>';
    /* ✅ 2026-10-12: leaderboard row par asli rank badge IMAGE (jo kalayein
       assets/img/ranks me padi thi) — colour-pill ke saath. rankBadgeImg
       RP-based hai aur fail-safe (na mile to emoji waisa hi). */
    h += '<span class="rank-badge" style="background:' + rk.bg + ';color:' + rk.color + ';box-shadow:0 0 8px ' + rk.color + '44;display:inline-flex;align-items:center;gap:4px">' +
         (window.rankBadgeImg ? '<img src="' + window.rankBadgeImg(rk.pts) + '?v=20261106e" alt="" style="width:16px;height:16px;object-fit:contain" onerror="this.style.display=\'none\'">' : '') +
         rk.emoji + ' ' + rk.badge + '</span>';
    h += '<div class="rank-earn" style="color:' + (sortKey==='kills'?'#ff6b6b':sortKey==='wins'?'#ffd700':'#00d4ff') + '">' + valStr + '</div></div>';
  }
  if (!users.length) h += '<div class="empty-state"><i class="fas fa-trophy"></i><p>No ranked players yet</p></div>';
  /* ✅ D70: Referral Leaderboard button (fixes-v7 wale renderer se port —
     feature kahin gayab na ho) */
  h += '<div style="margin-top:12px"><button onclick="window.showReferralLeaderboard&&showReferralLeaderboard()" ' +
       'style="width:100%;padding:11px;border-radius:12px;background:linear-gradient(135deg,rgba(185,100,255,.1),rgba(121,40,202,.05));color:#b964ff;border:1px solid rgba(185,100,255,.2);font-weight:700;font-size:13px;cursor:pointer">🎖️ Referral Leaderboard</button></div>';
  rc.innerHTML = h;

  // Inject chat below leaderboard
  if (window.f22PlayerChat !== undefined) {
    setTimeout(function() {
      if (window.injectLobbyChat) window.injectLobbyChat = window.injectLobbyChat;
      var lobbyChatWrap = document.getElementById('lobbyChatWrap');
      if (!lobbyChatWrap && rc) {
        var div = document.createElement('div');
        div.id = 'lobbyChatWrap';
        div.style.cssText = 'margin-top:16px';
        rc.appendChild(div);
      }
    }, 100);
  }
}

/* ====== PROFILE ====== */


/* ====== MATCH RESULT DETAIL (from match-result-detail.js) ====== */
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

    /* Fetch result from Supabase */
    if (window._supa) {
      window._supa.from('join_requests').select('*').eq('match_id', matchId).eq('user_id', U.uid).single()
        .then(function(resp) {
          if (resp.data && resp.data.placement) {
            renderResultPage(page, { rank: resp.data.placement, kills: resp.data.kills||0, winnings: resp.data.prize_earned||0, userId: U.uid, matchId: matchId }, t, matchId);
          } else { page.innerHTML = _noResultHTML(); }
        }).catch(function() { page.innerHTML = _noResultHTML(); });
    } else { page.innerHTML = _noResultHTML(); }
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
      '\n🔥 Play skill-based tournaments on Mini eSports — 🪙 coins + 💎 diamonds jito!\n' + window.location.origin;

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


/* ====== RANK SEASON SYSTEM (from rank-system.js) ====== */
/* ================================================================
   MINI eSPORTS — RANK SYSTEM v2.0
   - Kills / Wins / Rank Points leaderboards
   - Weekly reset (Monday)
   - Season reset (monthly)
   - Top 3 special badge
   - Top 10 special title
   ================================================================ */
(function() {
'use strict';



/* ── Weekly leaderboard (Monday reset) ── */
function getWeekKey() {
  var now = new Date();
  var day = now.getDay(); // 0=Sun, 1=Mon
  var monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return monday.getFullYear() + '_W' + String(monday.getMonth()+1).padStart(2,'0') + String(monday.getDate()).padStart(2,'0');
}
window.getWeekKey = getWeekKey;

/* ── Load season leaderboard from Firebase ── */
window.loadSeasonLeaderboard = function(cb) {
  var s = window.getCurrentSeason ? window.getCurrentSeason() : {};
  if (!window._supa) { cb([], s); return; }
  /* Load from Supabase leaderboard view */
  window._supa.from('leaderboard').select('*').limit(200)
    .then(function(r) {
      var users = (r.data || []).map(function(u) {
        return { _uid: u.id, ign: u.ign || 'Player', kills: u.total_kills || 0, wins: u.total_wins || 0, matches: u.total_matches || 0, profileImage: u.avatar_url || '', rankPoints: u.rank_points || 0, stats: { kills: u.total_kills || 0, wins: u.total_wins || 0, matches: u.total_matches || 0 }, premiumLevel: Number(u.premium_level||0), premiumExpires: u.premium_expires ? new Date(u.premium_expires).getTime() : 0 };
      });
      users.sort(function(a,b) { return (window.calcRkScore ? window.calcRkScore(b.stats||{}) - window.calcRkScore(a.stats||{}) : b.rankPoints - a.rankPoints); });
      cb(users, s);
    }).catch(function() { cb([], s); });
};

/* ── After match result: update season & weekly stats ── */
window.updateSeasonStats = function(uid, statsUpdate) {
  if (!uid || !statsUpdate) return;
  var wins   = statsUpdate.wins    || 0;
  var kills  = statsUpdate.kills   || 0;
  var matches= statsUpdate.matches || 0;

  /* Supabase stats update */
  if (window._supa) {
    if (wins    > 0) window._supa.rpc('increment_balance', { p_uid: uid, p_col: 'total_wins',    p_amount: wins    }).then(null, function(){});
    if (kills   > 0) window._supa.rpc('increment_balance', { p_uid: uid, p_col: 'total_kills',   p_amount: kills   }).then(null, function(){});
    if (matches > 0) window._supa.rpc('increment_balance', { p_uid: uid, p_col: 'total_matches', p_amount: matches }).then(null, function(){});

    var pts = window.calcRkScore ? window.calcRkScore(statsUpdate) : 0;
    if (pts > 0) {
      /* Get old rank_points for mentor reward check (Bug #13) */
      var oldRp = (window.UD && uid === (window.U && window.U.uid))
                  ? (Number(window.UD.rank_points || window.UD.rankPoints) || 0)
                  : 0;
      window._supa.rpc('increment_rank_points', { p_uid: uid, p_points: pts })
        .then(function() {
          /* Bug #13 Fix: Call mentor reward when rank tier changes */
          if (window.checkMentorReward && oldRp > 0) {
            window.checkMentorReward(oldRp, oldRp + pts);
          }
          /* Update local UD cache */
          if (window.UD && uid === (window.U && window.U.uid)) {
            window.UD.rank_points = oldRp + pts;
            window.UD.rankPoints  = oldRp + pts;
          }
        }).catch(function(){});
    }

    /* Bug #10 Fix: City Championship score update */
    if ((wins > 0 || kills > 0) && window.updateCityChampScore) {
      window.updateCityChampScore(wins > 0, kills);
    }

    /* Bug #11 Fix: Clan War score update */
    if ((wins > 0 || kills > 0) && window.updateClanWarScore) {
      /* Only update if user has a clan */
      var userClanId = window.UD && window.UD.clanId;
      if (userClanId) window.updateClanWarScore(wins > 0, kills);
    }

    /* Bug #12 Fix: Duel record — call if there is an accepted duel for this user */
    /* Note: duelId must be passed in statsUpdate for duel tracking */
    if (statsUpdate.duelId && statsUpdate.duelResult && window.updateDuelRecord) {
      window.updateDuelRecord(statsUpdate.duelId, statsUpdate.duelResult);
    }

    /* Battle Pass XP on match/win */
    if (window.awardPassXP && uid) {
      var bpXP = (wins > 0 ? 50 : 0) + (kills > 0 ? kills * 2 : 0) + (matches > 0 ? 10 : 0);
      if (bpXP > 0) window.awardPassXP(uid, bpXP);
    }
  }
  return; /* Supabase handles all — legacy Firebase code below never reached */
  var s = window.getCurrentSeason ? window.getCurrentSeason() : {};
  var wk = getWeekKey();
  /* Season stats */
  if (!window.db) return; /* Skip if db not available */
  var sRef = window.db.ref('seasonStats/' + s.monthKey + '/' + uid);
  sRef.once('value', function(snap) {
    var existing = snap.val() || {};
    var merged = {
      ign: statsUpdate.ign || existing.ign || '',
      displayName: statsUpdate.displayName || existing.displayName || '',
      profileImage: statsUpdate.profileImage || existing.profileImage || '',
      stats: {
        wins:    (existing.stats && existing.stats.wins    || 0) + (statsUpdate.wins    || 0),
        kills:   (existing.stats && existing.stats.kills   || 0) + (statsUpdate.kills   || 0),
        matches: (existing.stats && existing.stats.matches || 0) + (statsUpdate.matches || 0)
      }
    };
    var pts = window.calcRkScore ? window.calcRkScore(merged.stats) : 0;
    merged.rankPoints = pts;
    sRef.set(merged);
  });
  /* Weekly stats */
  var wRef = window.db ? window.db.ref('weeklyStats/' + wk + '/' + uid) : { transaction: function(){}, set: function(){} };
  wRef.once('value', function(snap) {
    var ew = snap.val() || {};
    wRef.set({
      ign: statsUpdate.ign || ew.ign || '',
      kills:   (ew.kills   || 0) + (statsUpdate.kills   || 0),
      wins:    (ew.wins    || 0) + (statsUpdate.wins    || 0),
      matches: (ew.matches || 0) + (statsUpdate.matches || 0)
    });
  });
};

/* ── Auto-assign top3 badge on season end / leaderboard view ── */
window.assignTop3Badges = function(users) {
  if (!window.db || !users || users.length < 1) return;
  users.slice(0, 3).forEach(function(u, i) {
    if (!u._uid) return;
    var key = i === 0 ? '_top1' : i === 1 ? '_top2' : '_top3';
    /* Stats via Supabase */
    if (window._supa && u._uid) { var _c = key==='wins'?'total_wins':key==='kills'?'total_kills':'total_matches'; window._supa.rpc('increment_balance',{p_uid:u._uid,p_col:_c,p_amount:1}).then(null, function(){}); }
  });
};

/* ── Expose rank point formula for display ── */
window.RANK_FORMULA = 'Wins×40 + Kills×2 + Matches×1 + WinStreak×10';

/* ── Rank tier definitions ── */
window.RANK_TIERS = [
  { name: 'Bronze',   min: 0,    max: 300,  emoji: '🏅', color: '#cd7f32', bg: 'rgba(205,127,50,.13)'  },
  { name: 'Silver',   min: 301,  max: 600,  emoji: '🥈', color: '#c0c0c0', bg: 'rgba(192,192,192,.13)' },
  { name: 'Gold',     min: 601,  max: 1000, emoji: '🥇', color: '#ffd700', bg: 'rgba(255,215,0,.14)'   },
  { name: 'Platinum', min: 1001, max: 1500, emoji: '🔷', color: '#e0e0ff', bg: 'rgba(180,180,255,.13)' },
  { name: 'Diamond',  min: 1501, max: 2000, emoji: '💎', color: '#00d4ff', bg: 'rgba(0,212,255,.15)'   },
  { name: 'Legend',   min: 2001, max: 9999, emoji: '👑', color: '#b964ff', bg: 'rgba(185,100,255,.15)' }
];

/* ── How Rank Works modal ── */
window.showHowRankWorks = function() {
  var h = '';
  h += '<div style="text-align:center;padding:6px 0 14px">';
  h += '<div style="font-size:13px;font-weight:700;color:#ffd700;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:10px;padding:8px 12px;margin-bottom:14px">';
  h += '📊 ' + window.RANK_FORMULA;
  h += '</div>';
  h += '</div>';
  /* Tier ladder */
  h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">';
  window.RANK_TIERS.forEach(function(t) {
    h += '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:' + t.bg + ';border:1px solid ' + t.color + '44">';
    h += '<div style="font-size:22px">' + t.emoji + '</div>';
    h += '<div style="flex:1"><div style="font-size:13px;font-weight:800;color:' + t.color + '">' + t.name + '</div>';
    h += '<div style="font-size:11px;color:#666">' + (t.min === 0 ? '0' : t.min) + ' – ' + (t.max >= 9999 ? '∞' : t.max) + ' points</div></div>';
    h += '</div>';
  });
  h += '</div>';
  h += '<div style="font-size:11px;color:#555;text-align:center;line-height:1.6">🗓 Weekly reset every Monday<br>📅 Season reset every 1st of month<br>🏆 Top 3 get special badges · Top 10 get titles</div>';
  if (window.openModal) openModal('🏆 How Rank Works', h);
};

console.log('[Mini eSports] ✅ Rank System v2.0 loaded');
})();
