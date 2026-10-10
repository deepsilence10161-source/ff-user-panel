/* ================================================================
   ASSET CATALOG — js/features/asset-catalog.js  (v1 · 2026-10-10)
   ================================================================
   59 real art assets (Drive → assets/img/) ka SINGLE SOURCE OF TRUTH.
   Har item: id, kind, name, img, desc, unlock condition (code-verified
   stats). Koi duplicate NAHI — har concept ki ek hi image.

   Kinds: rank(6) · premium(3) · title(17) · badge(23) · special(3)
          cosmetic(1) · icon(6)

   Systems (sab code me asli hain):
     rank    → js/rank-system.js (RANK_TIERS, rank_points)
     premium → features/premium.js (premium_level 1/2/3)
     title   → features/match-history.js showPlayerTitles
     badge   → ye gallery (window.showAssetGallery)
     special → top3 (assignTop3Badges) / season league / clan war
     cosmetic→ features/growth.js user_cosmetics (frame_glow)
   ================================================================ */
(function () {
  'use strict';

  var BASE = 'assets/img/';
  var VER = '20261010a';

  /* ── PURE: stat name → value (fail-safe 0) ── */
  window._assetStat = function (st, name) {
    st = st || {};
    var map = {
      wins: st.wins, kills: st.kills, matches: st.matches,
      streak: st.streak, loginStreak: st.loginStreak, rp: st.rp,
      level: st.level, clean: st.clean,
      top1: st.top1, top3: st.top3, top5: st.top5, top10: st.top10,
      soloWins: st.soloWins, comebacks: st.comebacks, premium: st.premium
    };
    return Number(map[name] || 0);
  };

  /* ── PURE: unlock check — {stat,need} ya {all:[...]} (fail-safe locked) ── */
  window._assetUnlocked = function (item, st) {
    try {
      if (!item || !item.need) return false;
      if (item.need.all) {
        return item.need.all.every(function (n) {
          return window._assetStat(st, n.stat) >= n.need;
        });
      }
      return window._assetStat(st, item.need.stat) >= item.need.need;
    } catch (e) { return false; }
  };

  /* ── PURE: progress text "7/10" ── */
  window._assetProgress = function (item, st) {
    try {
      if (!item || !item.need) return '';
      var n = item.need.all ? item.need.all[0] : item.need;
      return window._assetStat(st, n.stat) + '/' + n.need;
    } catch (e) { return ''; }
  };

  /* ================================================================
     CATALOG — 59 items
     ================================================================ */
  window.ASSET_CATALOG = {
    version: VER,
    ranks: [
      { id: 'rank_bronze', name: 'Bronze', img: BASE + 'ranks/bronze.png', desc: 'RP 0–300', need: { stat: 'rp', need: 0 } },
      { id: 'rank_silver', name: 'Silver', img: BASE + 'ranks/silver.png', desc: 'RP 301–600', need: { stat: 'rp', need: 301 } },
      { id: 'rank_gold', name: 'Gold', img: BASE + 'ranks/gold.png', desc: 'RP 601–1000', need: { stat: 'rp', need: 601 } },
      { id: 'rank_platinum', name: 'Platinum', img: BASE + 'ranks/platinum.png', desc: 'RP 1001–1500', need: { stat: 'rp', need: 1001 } },
      { id: 'rank_diamond', name: 'Diamond', img: BASE + 'ranks/diamond.png', desc: 'RP 1501–2000', need: { stat: 'rp', need: 1501 } },
      { id: 'rank_legend', name: 'Legend', img: BASE + 'ranks/legend.png', desc: 'RP 2001+', need: { stat: 'rp', need: 2001 } }
    ],
    premium: [
      { id: 'prem_silver', name: 'Premium Silver', img: BASE + 'premium/silver.png', desc: '₹49/month — No Ads, Badge, Photo/Banner', need: { stat: 'premium', need: 1 } },
      { id: 'prem_gold', name: 'Premium Gold', img: BASE + 'premium/gold.png', desc: '₹99/month — + Creator, Live Stream', need: { stat: 'premium', need: 2 } },
      { id: 'prem_diamond', name: 'Premium Diamond', img: BASE + 'premium/diamond.png', desc: '₹199/month — + Custom Theme', need: { stat: 'premium', need: 3 } }
    ],
    titles: [
      { id: 'title_veteran', name: 'Veteran', img: BASE + 'titles/veteran.png', desc: '10+ wins', need: { stat: 'wins', need: 10 } },
      { id: 'title_mvp_rival', name: 'Champion', img: BASE + 'titles/champion.png', desc: '50+ wins', need: { stat: 'wins', need: 50 } },
      { id: 'title_arena_king', name: 'Arena King', img: BASE + 'titles/arena-king.png', desc: '50+ podium finishes (Top-3)', need: { stat: 'top3', need: 50 } },
      { id: 'title_immortal', name: 'Immortal', img: BASE + 'titles/immortal.png', desc: '200+ wins + 100 clean matches', need: { all: [{ stat: 'wins', need: 200 }, { stat: 'clean', need: 100 }] } },
      { id: 'title_mythic', name: 'Mythic', img: BASE + 'titles/mythic.png', desc: '300+ wins', need: { stat: 'wins', need: 300 } },
      { id: 'title_shadow_hunter', name: 'Shadow Hunter', img: BASE + 'titles/shadow-hunter.png', desc: '250+ kills', need: { stat: 'kills', need: 250 } },
      { id: 'title_death_bringer', name: 'Death Bringer', img: BASE + 'titles/death-bringer.png', desc: '500+ kills', need: { stat: 'kills', need: 500 } },
      { id: 'title_titan', name: 'Titan', img: BASE + 'titles/titan.png', desc: '1000+ kills', need: { stat: 'kills', need: 1000 } },
      { id: 'title_reaper', name: 'Reaper', img: BASE + 'titles/reaper.png', desc: '1500+ kills', need: { stat: 'kills', need: 1500 } },
      { id: 'title_destroyer', name: 'Destroyer', img: BASE + 'titles/destroyer.png', desc: '2000+ kills', need: { stat: 'kills', need: 2000 } },
      { id: 'title_supreme', name: 'Supreme', img: BASE + 'titles/supreme.png', desc: '2500+ Rank Points', need: { stat: 'rp', need: 2500 } },
      { id: 'title_apex', name: 'Apex', img: BASE + 'titles/apex.png', desc: '5000+ Rank Points', need: { stat: 'rp', need: 5000 } },
      { id: 'title_cosmic', name: 'Cosmic', img: BASE + 'titles/cosmic.png', desc: 'Level 50+', need: { stat: 'level', need: 50 } },
      { id: 'title_infinity', name: 'Infinity', img: BASE + 'titles/infinity.png', desc: '1000+ matches', need: { stat: 'matches', need: 1000 } },
      { id: 'title_lone_wolf', name: 'Lone Wolf', img: BASE + 'titles/lone-wolf.png', desc: '25+ Solo wins', need: { stat: 'soloWins', need: 25 } },
      { id: 'title_phoenix', name: 'Phoenix', img: BASE + 'titles/phoenix.png', desc: '10+ comeback wins', need: { stat: 'comebacks', need: 10 } },
      { id: 'title_unstoppable', name: 'Unstoppable', img: BASE + 'titles/unstoppable.png', desc: '7+ consecutive wins', need: { stat: 'streak', need: 7 } }
    ],
    badges: [
      { id: 'badge_hunter', name: 'Hunter', img: BASE + 'badges/hunter.png', desc: '100+ kills', need: { stat: 'kills', need: 100 } },
      { id: 'badge_kill_machine', name: 'Kill Machine', img: BASE + 'badges/kill-machine.png', desc: '750+ kills', need: { stat: 'kills', need: 750 } },
      { id: 'badge_predator', name: 'Predator', img: BASE + 'badges/predator.png', desc: '150+ kills + 30 Top-10', need: { all: [{ stat: 'kills', need: 150 }, { stat: 'top10', need: 30 }] } },
      { id: 'badge_god_of_war', name: 'God of War', img: BASE + 'badges/god-of-war.png', desc: '500+ kills + 50 wins', need: { all: [{ stat: 'kills', need: 500 }, { stat: 'wins', need: 50 }] } },
      { id: 'badge_mvp', name: 'MVP', img: BASE + 'badges/mvp.png', desc: '30+ match wins', need: { stat: 'wins', need: 30 } },
      { id: 'badge_elite_fighter', name: 'Elite Fighter', img: BASE + 'badges/elite-fighter.png', desc: '75+ wins', need: { stat: 'wins', need: 75 } },
      { id: 'badge_king_of_arena', name: 'King of Arena', img: BASE + 'badges/king-of-arena.png', desc: '125+ wins', need: { stat: 'wins', need: 125 } },
      { id: 'badge_royal_legend', name: 'Royal Legend', img: BASE + 'badges/royal-legend.png', desc: '150+ wins', need: { stat: 'wins', need: 150 } },
      { id: 'badge_eternal_champion', name: 'Eternal Champion', img: BASE + 'badges/eternal-champion.png', desc: '500+ wins', need: { stat: 'wins', need: 500 } },
      { id: 'badge_the_conqueror', name: 'The Conqueror', img: BASE + 'badges/the-conqueror.png', desc: '250+ wins', need: { stat: 'wins', need: 250 } },
      { id: 'badge_top10', name: 'Top 10', img: BASE + 'badges/top-10.png', desc: '50+ बार Top-10', need: { stat: 'top10', need: 50 } },
      { id: 'badge_top5', name: 'Top 5', img: BASE + 'badges/top-5.png', desc: '25+ बार Top-5', need: { stat: 'top5', need: 25 } },
      { id: 'badge_podium_master', name: 'Podium Master', img: BASE + 'badges/podium-master.png', desc: '15+ बार Top-3', need: { stat: 'top3', need: 15 } },
      { id: 'badge_one_man_army', name: 'One Man Army', img: BASE + 'badges/one-man-army.png', desc: '50+ Solo wins', need: { stat: 'soloWins', need: 50 } },
      { id: 'badge_win_streak', name: 'Win Streak', img: BASE + 'badges/win-streak.png', desc: '5+ consecutive wins', need: { stat: 'streak', need: 5 } },
      { id: 'badge_week_warrior', name: 'Week Warrior', img: BASE + 'badges/week-warrior.png', desc: '7-day login streak', need: { stat: 'loginStreak', need: 7 } },
      { id: 'badge_grinder', name: 'Grinder', img: BASE + 'badges/grinder.png', desc: '250+ matches', need: { stat: 'matches', need: 250 } },
      { id: 'badge_survivor', name: 'Survivor', img: BASE + 'badges/survivor.png', desc: '100+ clean matches (no reports)', need: { stat: 'clean', need: 100 } },
      { id: 'badge_rising_star', name: 'Rising Star', img: BASE + 'badges/rising-star.png', desc: 'Level 25+', need: { stat: 'level', need: 25 } },
      { id: 'badge_legend_born', name: 'Legend Born', img: BASE + 'badges/legend-born.png', desc: 'Legend tier पहुँचो (2001 RP)', need: { stat: 'rp', need: 2001 } },
      { id: 'badge_rank_climber', name: 'Rank Climber', img: BASE + 'badges/rank-climber.png', desc: '1000+ Rank Points', need: { stat: 'rp', need: 1000 } },
      { id: 'badge_legend_winner', name: 'Legend Winner', img: BASE + 'badges/legend-winner.png', desc: 'Legend tier + 50 wins', need: { all: [{ stat: 'rp', need: 2001 }, { stat: 'wins', need: 50 }] } },
      { id: 'badge_comeback_king', name: 'Comeback King', img: BASE + 'badges/comeback-king.png', desc: '5+ comeback wins', need: { stat: 'comebacks', need: 5 } }
    ],
    special: [
      { id: 'sp_top3_champion', name: 'Top-3 Champion', img: BASE + 'special/top3-champion.png', desc: 'Leaderboard Top-3 special badge (assignTop3Badges)', need: { stat: 'top3', need: 1 } },
      { id: 'sp_season_champion', name: 'Season Champion', img: BASE + 'special/season-champion.png', desc: 'Season League winner (seasonal_league_history)', need: { stat: 'top1', need: 1 } },
      { id: 'sp_clan_war_champion', name: 'Clan War Champion', img: BASE + 'special/clan-war-champion.png', desc: 'Clan War winner badge', need: null }
    ],
    cosmetic: [
      { id: 'frame_glow', name: 'Royal Glow Frame', img: BASE + 'frames/glow.png', desc: 'Profile avatar glow frame (cosmetics store — frame type)', need: null }
    ],
    icons: [
      { id: 'icon_crown', name: 'Crown', img: BASE + 'icons/crown.png', desc: 'UI icon — Legend/king', need: null },
      { id: 'icon_trophy', name: 'Trophy', img: BASE + 'icons/trophy.png', desc: 'UI icon — Winner', need: null },
      { id: 'icon_coin', name: 'Coin', img: BASE + 'icons/coin.png', desc: 'Currency icon', need: null },
      { id: 'icon_diamond', name: 'Diamond', img: BASE + 'icons/diamond.png', desc: 'Green/Sky Diamond icon', need: null },
      { id: 'icon_fire', name: 'Fire', img: BASE + 'icons/fire.png', desc: 'On Fire / emoji-pack icon', need: null },
      { id: 'icon_xp', name: 'XP', img: BASE + 'icons/xp.png', desc: 'Level/XP icon', need: null }
    ]
  };

  /* ── PURE: flat list (59) ── */
  window._assetAll = function () {
    var c = window.ASSET_CATALOG;
    return [].concat(c.ranks, c.premium, c.titles, c.badges, c.special, c.cosmetic, c.icons);
  };

  /* ================================================================
     STATS — UD se + match-history se (top3/top5/top10/soloWins/comebacks)
     ================================================================ */
  window._assetStatsCached = null;
  window._assetStats = function () {
    var ud = window.UD || {};
    var st = {
      wins: Number(ud.total_wins || 0), kills: Number(ud.total_kills || 0),
      matches: Number(ud.total_matches || 0), streak: Number(ud.win_streak || 0),
      loginStreak: Number(ud.streak_days || 0), rp: Number(ud.rank_points || ud.rankPoints || 0),
      level: Number(ud.level || 0), clean: Number(ud.clean_matches || 0),
      premium: Number(ud.premium_level || 0),
      top1: 0, top3: 0, top5: 0, top10: 0, soloWins: 0, comebacks: 0
    };
    if (window._assetStatsCached) {
      Object.keys(window._assetStatsCached).forEach(function (k) { st[k] = window._assetStatsCached[k]; });
    }
    return st;
  };

  /* Match-history se placement counts — lazy, cached (10 min) */
  window._assetLoadMatchStats = function (cb) {
    try {
      var raw = localStorage.getItem('assetMatchStats');
      if (raw) {
        var j = JSON.parse(raw);
        if (j && j.at && (Date.now() - j.at) < 600000) {
          window._assetStatsCached = j.counts;
          if (cb) cb(j.counts);
          return;
        }
      }
    } catch (e) {}
    if (!window._supa || !window.U || !window.U.uid) { if (cb) cb(null); return; }
    window._supa.from('joined_players')
      .select('placement,kills,created_at,match:matches(mode)')
      .eq('user_id', window.U.uid)
      .order('created_at', { ascending: true })
      .limit(500)
      .then(function (r) {
        var rows = (r && r.data) || [];
        var c = { top1: 0, top3: 0, top5: 0, top10: 0, soloWins: 0, comebacks: 0 };
        var prevBad = 0;
        rows.forEach(function (m) {
          var p = Number(m.placement || 0);
          if (p <= 0) return;
          if (p === 1) {
            c.top1++;
            if (prevBad >= 3) c.comebacks++;
            if (m.match && m.match.mode === 'solo') c.soloWins++;
          } else {
            if (p > 3) prevBad++; else prevBad = 0;
          }
          if (p <= 3) c.top3++;
          if (p <= 5) c.top5++;
          if (p <= 10) c.top10++;
        });
        window._assetStatsCached = c;
        try { localStorage.setItem('assetMatchStats', JSON.stringify({ at: Date.now(), counts: c })); } catch (e) {}
        if (cb) cb(c);
      }, function () { if (cb) cb(null); });
  };

  /* ================================================================
     GALLERY — user-facing Collection + E2E ka showcase dono
     ================================================================ */
  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.showAssetGallery = function () {
    if (!window.openModal) return;
    var st = window._assetStats();
    function section(title, items, kindLabel) {
      var h = '<div style="margin:14px 0 8px;font-size:13px;font-weight:800;color:#ffd700">' + title +
        ' <span style="font-size:10px;color:#666">(' + items.length + ')</span></div>';
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:10px">';
      items.forEach(function (it) {
        var un = it.need ? window._assetUnlocked(it, st) : true;
        h += '<div style="text-align:center;background:' + (un ? 'rgba(0,255,156,.05)' : 'rgba(255,255,255,.02)') +
          ';border:1px solid ' + (un ? 'rgba(0,255,156,.25)' : 'rgba(255,255,255,.06)') +
          ';border-radius:12px;padding:10px 6px;opacity:' + (un ? '1' : '.5') + '">' +
          '<img src="' + it.img + '?v=' + VER + '" alt="' + _esc(it.name) + '" loading="lazy" ' +
          'style="width:64px;height:64px;object-fit:contain;' + (un ? '' : 'filter:grayscale(.9)') + '"' +
          ' onerror="this.style.opacity=.25">' +
          '<div style="font-size:10px;font-weight:700;color:#eee;margin-top:6px;line-height:1.3">' + _esc(it.name) + '</div>' +
          '<div style="font-size:8.5px;color:#888;line-height:1.4;margin-top:2px">' + _esc(it.desc || '') + '</div>' +
          (it.need ? '<div style="font-size:9px;font-weight:800;margin-top:3px;color:' + (un ? '#00ff9c' : '#888') + '">' +
            (un ? '✅ UNLOCKED' : '🔒 ' + _esc(window._assetProgress(it, st))) + '</div>' : '') +
          '</div>';
      });
      return h + '</div>';
    }
    var h = '<div style="max-height:65vh;overflow-y:auto">';
    h += '<div style="font-size:11px;color:#888;text-align:center;margin-bottom:6px">Collection v' + VER + ' — ' +
      window._assetAll().length + ' items · stats: W' + st.wins + ' K' + st.kills + ' M' + st.matches + ' RP' + st.rp + '</div>';
    h += section('🏆 Rank Badges', window.ASSET_CATALOG.ranks, 'rank');
    h += section('💎 Premium Badges', window.ASSET_CATALOG.premium, 'premium');
    h += section('🎖️ Titles', window.ASSET_CATALOG.titles, 'title');
    h += section('🏅 Achievement Badges', window.ASSET_CATALOG.badges, 'badge');
    h += section('👑 Special', window.ASSET_CATALOG.special, 'special');
    h += section('🖼️ Cosmetics', window.ASSET_CATALOG.cosmetic, 'cosmetic');
    h += section('🎨 Icons', window.ASSET_CATALOG.icons, 'icon');
    h += '</div>';
    openModal('🏆 My Collection', h);
  };

  /* ================================================================
     E2E VERIFIER — har image live load → result
     ?assetVerify=1 par auto-run; logcat me console.error se bhi.
     ================================================================ */
  window.verifyAllAssets = function (cb) {
    var items = window._assetAll();
    var result = { total: items.length, ok: 0, fail: [], done: 0 };
    items.forEach(function (it) {
      var img = new Image();
      function fin(okFlag) {
        result.done++;
        if (okFlag) result.ok++; else result.fail.push(it.id);
        if (result.done === result.total) {
          result.pass = result.fail.length === 0;
          window.__ASSET_E2E__ = result;
          var line = 'ASSET-E2E-RESULT: ' + result.ok + '/' + result.total +
            (result.pass ? ' OK' : ' FAIL(' + result.fail.join(',') + ')');
          try { console.error(line); } catch (e) {}
          var el = document.getElementById('assetE2EResult');
          if (el) {
            el.textContent = line;
            el.style.cssText = 'font-size:18px;font-weight:900;padding:20px;text-align:center;color:' +
              (result.pass ? '#00ff9c' : '#ff6b6b');
          }
          if (cb) cb(result);
        }
      }
      img.onload = function () { fin(img.naturalWidth > 0); };
      img.onerror = function () { fin(false); };
      img.src = it.img + '?v=' + VER;
    });
    if (!items.length && cb) cb({ total: 0, ok: 0, fail: [], pass: false });
  };

  /* Auto mode */
  function _boot() {
    try {
      if (/[?&]assetVerify=1/.test(window.location.search || '')) {
        document.addEventListener('DOMContentLoaded', function () {
          var d = document.createElement('div');
          d.id = 'assetE2EResult';
          d.textContent = 'ASSET-E2E RUNNING...';
          d.style.cssText = 'font-size:18px;font-weight:900;padding:20px;text-align:center;color:#ffd700';
          (document.body || document.documentElement).appendChild(d);
          window._assetLoadMatchStats(function () { window.verifyAllAssets(); });
        });
      }
    } catch (e) {}
  }
  _boot();

  console.log('✅ asset-catalog.js v' + VER + ' — ' + window._assetAll().length + ' items');
})();
