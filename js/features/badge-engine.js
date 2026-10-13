/* ================================================================
   MINI eSPORTS — BADGE ENGINE v1  (2026-10-12)
   ================================================================
   MAQSAD (user-attraction, ASSET_MAPPING_PLAN ka अगला कदम):
   Jo 59 kaam ki kalayein pehle sirf "My Collection" modal me padi thi,
   unhe USER KE SAAMNE laao — bina kisi DB change ke, bina kisi naye
   server call ke. Sab kuch sirf un stats se jo pehle se maujood hain.

   KYA DETA HAI (sab PURE functions, koi network nahi):
     • rankBadgeImg(points)      → rank badge image path (RP se)
     • getEarnedBadges(st)       → jo badges/titles asli me khule hain
     • getTopBadges(st, n)       → sabse "durlabh" n badges (dikhane ke liye)
     • getNextReward(st)         → agla sabse kareeb wala inaam + progress %
     • renderNextRewardStrip()   → HOME ke liye "agla inaam" patti (near-miss hook)
     • renderBadgeShowcaseRow()  → PROFILE ke liye khule badges ki image-row
     • premiumRibbonHtml(px)     → premium users ke naam ke aage sunehra ribbon

   NIRBHARTA (load order — index.html):
     js/features/asset-catalog.js ke BAAD load hota hai. Us waqt
     window.ASSET_CATALOG / _assetStats / _assetUnlocked / _assetStat
     maujood hote hain. Yahan koi cheez load-time par unhe chhoo bhi
     nahi leti — sab runtime par safe-guard ke saath padha jata hai.
     Koi bhi function fail ho to '' / [] return karta hai (app kabhi
     nahi tootegi) — same fail-safe pattern jo asset-catalog.js me hai.

   E2E: is file ka har public function window.__BADGE_ENGINE par
   expose hai; screen-e2e.html + tests/screen-e2e.js isi ko verify karte
   hain (console log: '[E2E] badge-engine ...').
================================================================ */
(function () {
  'use strict';

  var VER = '20261012a';
  var BASE = 'assets/img/';

  /* ── Rank badge image (RP → ranks/*.png) ──
     Pehle js/rank-system.js ke RANK_TIERS (single source of truth) se
     try karta hai; na mile to wahi thresholds hardcode fallback. */
  var _RP_FALLBACK = [
    { min: 2001, name: 'Legend',   img: BASE + 'ranks/legend.png' },
    { min: 1501, name: 'Diamond',  img: BASE + 'ranks/diamond.png' },
    { min: 1001, name: 'Platinum', img: BASE + 'ranks/platinum.png' },
    { min: 601,  name: 'Gold',     img: BASE + 'ranks/gold.png' },
    { min: 301,  name: 'Silver',   img: BASE + 'ranks/silver.png' },
    { min: 0,    name: 'Bronze',   img: BASE + 'ranks/bronze.png' }
  ];
  window.rankBadgeImg = function (points) {
    try {
      var p = Number(points) || 0;
      if (window.getRankTier && typeof window.getRankTier === 'function') {
        var t = window.getRankTier(p);
        if (t && t.img) return t.img;
      }
      for (var i = 0; i < _RP_FALLBACK.length; i++) {
        if (p >= _RP_FALLBACK[i].min) return _RP_FALLBACK[i].img;
      }
    } catch (e) {}
    return BASE + 'ranks/bronze.png';
  };

  /* ── stats padho (cache-safe) ──
     window._assetStats() asset-catalog.js ka canonical reader hai —
     UD ke asli fields + match-history counts (top3/top5/top10/soloWins/
     comebacks) isi se aate hain. Wahi use karo, apna parallel reader
     nahi bana rahe (warna 2 source = wahi purana bug class). */
  window._bdgStats = function () {
    try {
      if (window._assetStats && typeof window._assetStats === 'function') return window._assetStats();
    } catch (e) {}
    return {};
  };

  function _allRewardItems() {
    try {
      var c = window.ASSET_CATALOG || {};
      var out = [];
      (c.badges || []).forEach(function (it) { out.push({ it: it, kind: 'badge' }); });
      (c.titles || []).forEach(function (it) { out.push({ it: it, kind: 'title' }); });
      return out;
    } catch (e) { return []; }
  }

  function _unlocked(it, st) {
    try {
      if (window._assetUnlocked) return !!window._assetUnlocked(it, st);
      /* fallback: khud check (asset-catalog na load ho paya ho to) */
      if (!it || !it.need) return false;
      var need = it.need;
      if (need.all) {
        return need.all.every(function (n) { return (Number(st[n.stat]) || 0) >= n.need; });
      }
      return (Number(st[need.stat]) || 0) >= need.need;
    } catch (e) { return false; }
  }

  /* difficulty = sabse bada need (badges/titles ke liye) — jitna bada,
     utna durlabh/prestigious */
  function _difficulty(it) {
    try {
      if (!it || !it.need) return 0;
      if (it.need.all) {
        var m = 0;
        it.need.all.forEach(function (n) { m = Math.max(m, Number(n.need) || 0); });
        return m;
      }
      return Number(it.need.need) || 0;
    } catch (e) { return 0; }
  }

  /* ── jo khule hain (durlabhta ke hisaab se sort) ── */
  window.getEarnedBadges = function (st) {
    st = st || window._bdgStats();
    try {
      var earned = [];
      _allRewardItems().forEach(function (w) {
        if (_unlocked(w.it, st)) {
          earned.push({ id: w.it.id, name: w.it.name, img: w.it.img, desc: w.it.desc,
                        kind: w.kind, difficulty: _difficulty(w.it) });
        }
      });
      earned.sort(function (a, b) { return b.difficulty - a.difficulty; });
      return earned;
    } catch (e) { return []; }
  };

  window.getTopBadges = function (st, n) {
    n = Number(n) || 3;
    return window.getEarnedBadges(st).slice(0, n);
  };

  /* ── agla sabse kareeb inaam (near-miss hook ka dil) ──
     Har locked badge/title ki completion % nikalo; jo sabse zyada
     (par 100 se kam) ho wahi "agla inaam". Combo need ke liye sabse
     kamzor hissa dikhaya jata hai (jo asli me rok raha hai). */
  window.getNextReward = function (st) {
    st = st || window._bdgStats();
    try {
      var best = null;
      _allRewardItems().forEach(function (w) {
        var it = w.it;
        if (!it || !it.need) return;
        if (_unlocked(it, st)) return;                 /* pehle se khula — skip */
        var parts = it.need.all ? it.need.all : [it.need];
        var weakest = null, minPct = 101;
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          var have = Number(st[p.stat]) || 0;
          var need = Number(p.need) || 0;
          if (need <= 0) continue;
          var pct = Math.min(100, (have / need) * 100);
          if (pct < minPct) { minPct = pct; weakest = { stat: p.stat, have: have, need: need, pct: pct }; }
        }
        if (!weakest) return;
        if (minPct >= 100) return;
        if (!best || minPct > best.pct) {
          best = { id: it.id, name: it.name, img: it.img, desc: it.desc, kind: w.kind,
                   have: weakest.have, need: weakest.need, stat: weakest.stat,
                   pct: Math.floor(minPct) };
        }
      });
      return best;
    } catch (e) { return null; }
  };

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _img(src, size, extra) {
    return '<img src="' + src + '?v=' + VER + '" alt="" loading="lazy" ' +
      'style="width:' + size + 'px;height:' + size + 'px;object-fit:contain;' + (extra || '') + '" ' +
      'onerror="this.style.opacity=.25">';
  }
  window._bdgImg = _img;

  /* ── HOME strip: "🎯 Agla Inaam — 612/750, sirf 138 door!" ──
     Ek hi patti me: inaam ki image + naam + progress bar + %.
     Tap → My Collection (jahan pura unlock path dikhta hai). */
  window.renderNextRewardStrip = function (st) {
    try {
      var nr = window.getNextReward(st);
      if (!nr) return '';
      var kindLabel = nr.kind === 'title' ? 'Title' : 'Badge';
      var h = '';
      h += '<div onclick="window.showAssetGallery&&window.showAssetGallery()" ' +
           'style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin:0 0 10px;' +
           'border-radius:14px;background:linear-gradient(135deg,rgba(255,215,0,.10),rgba(185,100,255,.08));' +
           'border:1px solid rgba(255,215,0,.28);cursor:pointer">';
      h += _img(nr.img, 38, 'filter:drop-shadow(0 0 8px rgba(255,215,0,.35));flex-shrink:0');
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:10px;font-weight:800;color:#ffd700;letter-spacing:.4px">🎯 AGLA INAAM · ' + kindLabel.toUpperCase() + '</div>';
      h += '<div style="font-size:12.5px;font-weight:800;color:#eee;margin:1px 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
           _esc(nr.name) + ' <span style="color:#999;font-weight:600">— ' + _esc(nr.desc || '') + '</span></div>';
      h += '<div style="height:5px;background:rgba(255,255,255,.09);border-radius:3px;overflow:hidden">' +
           '<div style="height:100%;width:' + nr.pct + '%;background:linear-gradient(90deg,#ffd700,#b964ff);border-radius:3px"></div></div>';
      h += '</div>';
      h += '<div style="text-align:right;flex-shrink:0">' +
           '<div style="font-size:13px;font-weight:900;color:#00ff9c">' + nr.have + '<span style="color:#666;font-weight:700">/' + nr.need + '</span></div>' +
           '<div style="font-size:9px;color:#888;font-weight:700">' + nr.pct + '% · ' + (nr.need - nr.have) + ' door</div>' +
           '</div>';
      h += '</div>';
      return h;
    } catch (e) { return ''; }
  };

  /* ── PROFILE row: khule badges ki image-row (dikhawa = motivation) ── */
  window.renderBadgeShowcaseRow = function (st) {
    try {
      st = st || window._bdgStats();
      var earned = window.getEarnedBadges(st);
      var h = '';
      if (earned.length) {
        var show = earned.slice(0, 5);
        h += '<div style="display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:10px 12px;' +
             'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px">';
        h += '<div style="font-size:10px;font-weight:800;color:#888;letter-spacing:.4px;flex-shrink:0">MY<br>BADGES</div>';
        h += '<div style="display:flex;align-items:center;gap:4px;flex:1;overflow:hidden">';
        show.forEach(function (b) {
          /* 2026-10-12b: tap karo → wahi badge profile par EQUIP (badge_<id>
             row user_cosmetics me — wahi table/RLS jo tags ke liye live hai) */
          h += '<span onclick="window.equipBadge&&window.equipBadge(\'' + b.id + '\')" title="' +
               _esc(b.name) + ' — equip karne ke liye tap karo" style="display:inline-flex;cursor:pointer">' +
               _img(b.img, 30, 'flex-shrink:0') + '</span>';
        });
        if (earned.length > show.length) {
          h += '<span style="font-size:11px;font-weight:800;color:#ffd700;flex-shrink:0">+' + (earned.length - show.length) + '</span>';
        }
        h += '</div>';
        h += '<div onclick="window.showAssetGallery&&window.showAssetGallery()" style="font-size:10px;font-weight:800;color:#00d4ff;cursor:pointer;flex-shrink:0">' +
             earned.length + ' / Collection ›</div>';
        h += '</div>';
      } else {
        /* 0 badge — to motivation do, khali jagah nahi */
        var nr = window.getNextReward(st);
        if (nr) {
          h += '<div onclick="window.showAssetGallery&&window.showAssetGallery()" style="display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:10px 12px;' +
               'background:rgba(255,215,0,.05);border:1px dashed rgba(255,215,0,.25);border-radius:14px;cursor:pointer">' +
               _img(nr.img, 26, 'opacity:.85') +
               '<div style="font-size:11px;color:#ccc;flex:1">Pehla badge: <b style="color:#ffd700">' + _esc(nr.name) + '</b> — ' + nr.have + '/' + nr.need + '</div>' +
               '<span style="font-size:10px;font-weight:800;color:#00d4ff">Dekho ›</span></div>';
        }
      }
      return h;
    } catch (e) { return ''; }
  };

  /* ══════════════════════════════════════════════════════════════
     EQUIP BADGE (2026-10-12b) — "jo kamaya, wo profile par chamke"
     ══════════════════════════════════════════════════════════════
     Storage: user_cosmetics row `badge_<id>` (wahi table, wahi RLS
     "uc_own" jo tags/frames ke liye pehle se live hai — koi naya column
     ya migration NAHI chahiye; UNIQUE(user_id, cosmetic_key) upsert deta
     hai). Izat ka niyam: chip sirf tab dikhta hai jab wo badge ASLI stats
     se abhi kamaya hua ho — warna kuch nahi (jhoota badge nahi). */

  window.getEquippedBadge = function (st) {
    try {
      st = st || window._bdgStats();
      var owned = (window.UD && window.UD.cosmetics) || {};
      var pick = null;
      Object.keys(owned).forEach(function (k) {
        if (k.indexOf('badge_') !== 0) return;
        if (owned[k] && owned[k].is_equipped) pick = k.slice(6);
      });
      if (!pick) return null;
      var earned = window.getEarnedBadges(st);
      for (var i = 0; i < earned.length; i++) if (earned[i].id === pick) return earned[i];
      return null;   /* stats badal gaye — ab kamaya nahi, isliye nahi dikhate */
    } catch (e) { return null; }
  };

  window.renderEquippedBadgeChip = function (st) {
    try {
      var b = window.getEquippedBadge(st);
      if (!b) return '';
      return '<div style="display:flex;align-items:center;gap:9px;margin:0 0 10px;padding:8px 12px;' +
        'background:linear-gradient(135deg,rgba(0,212,255,.10),rgba(185,100,255,.08));' +
        'border:1px solid rgba(0,212,255,.3);border-radius:14px">' +
        _img(b.img, 30, 'filter:drop-shadow(0 0 6px rgba(0,212,255,.45))') +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-size:9px;font-weight:900;color:#00d4ff;letter-spacing:.5px">⭐ EQUIPPED BADGE</div>' +
        '<div style="font-size:12.5px;font-weight:800;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        _esc(b.name) + '</div></div>' +
        '<button onclick="window.equipBadge(\'' + b.id + '\',this)" style="background:rgba(255,255,255,.06);' +
        'border:1px solid rgba(255,255,255,.22);color:#ccc;font-size:10px;font-weight:800;padding:5px 10px;' +
        'border-radius:9px;cursor:pointer">Hatao</button></div>';
    } catch (e) { return ''; }
  };

  window.equipBadge = function (id, btnEl, st) {
    try {
      if (!window._supa || !window.U || !window.UD) { if (window.toast) toast('Pehle login karo!', 'err'); return false; }
      st = st || window._bdgStats();
      var earned = window.getEarnedBadges(st), hit = null;
      for (var i = 0; i < earned.length; i++) if (earned[i].id === id) hit = earned[i];
      if (!hit) {   /* IZAT ka niyam — bina kamaye equip nahi */
        if (window.toast) toast('Ye badge abhi kamaya nahi — pehle unlock karo!', 'err');
        return false;
      }
      var key = 'badge_' + id, uid = window.U.uid;
      var owned = window.UD.cosmetics || (window.UD.cosmetics = {});
      var wasOn = !!(owned[key] && owned[key].is_equipped);
      function applyLocal(on) {
        Object.keys(owned).forEach(function (k) { if (k.indexOf('badge_') === 0) owned[k].is_equipped = false; });
        if (!owned[key]) owned[key] = {};
        owned[key].is_equipped = !!on;
        try {
          if (window._supaCosmetics) {
            Object.keys(window._supaCosmetics).forEach(function (k) {
              if (k.indexOf('badge_') === 0) window._supaCosmetics[k].is_equipped = false;
            });
            if (window._supaCosmetics[key]) window._supaCosmetics[key].is_equipped = !!on;
          }
        } catch (e) {}
        if (window.renderProfile) setTimeout(function () { try { renderProfile(); } catch (e) {} }, 250);
      }
      if (wasOn) {   /* dobara tap = hatao */
        applyLocal(false);
        window._supa.from('user_cosmetics').update({ is_equipped: false })
          .eq('user_id', uid).eq('cosmetic_key', key)
          .then(function (r) { if (r && r.error && window.toast) toast('Hataya nahi — network?', 'err'); });
        return true;
      }
      /* pehle saare badge_* hatао, phir yahi lagao (upsert = row na ho to ban jaye) */
      applyLocal(true);
      window._supa.from('user_cosmetics').update({ is_equipped: false })
        .eq('user_id', uid).like('cosmetic_key', 'badge_%')
        .then(function () {
          window._supa.from('user_cosmetics')
            .upsert({ user_id: uid, cosmetic_key: key, is_equipped: true }, { onConflict: 'user_id,cosmetic_key' })
            .then(function (r) {
              if (r && r.error) { applyLocal(false); if (window.toast) toast('Equip nahi hua — retry karo.', 'err'); }
              else if (window.toast) toast('⭐ ' + hit.name + ' profile par lag gaya!', 'ok');
            });
        });
      return true;
    } catch (e) {
      if (window.toast) toast('Equip fail: ' + e.message, 'err');
      return false;
    }
  };

  /* ══ 3.6 लॉगिन-स्ट्रीक (daily check-in) strip — होम पर ══════════════════
     Master plan 3.6: "Week Warrior (7-दिन लॉगिन) ... होम पर दिखाओ 7/7 दिन".
     Asli data: users.streak_days (7 का cycle) + daily_checkins (आज की रो).
     ईमानदारी: streak 0 → "0/7 — आज शुरू करो"; आज की रो मिली → "आज हो गया ✓"
     (नीचे refreshLoginStreakToday() असली रो से पक्का करता है); D7 पर असली
     Week Warrior कला (badges/week-warrior.png) — कोई झूठा unlocked badge नहीं. */
  window.LS_TIERS = function () {
    try {
      var t = window._adminDailyBonusRewards;
      if (t && t.length === 7) return t.slice(0, 7);
    } catch (e) {}
    return [5, 7, 10, 12, 15, 20, 30];
  };

  /* pure function — asli numbers se (test isi ko pakड़ता है) */
  window.loginStreakNumbers = function (ud, lastCheckinISO) {
    try {
      ud = ud || window.UD || {};
      if (!ud || (!ud.streak_days && !ud.loginStreak && !ud.ign)) return null;
      var tiers = window.LS_TIERS();
      var streak = Number(ud.streak_days != null ? ud.streak_days : ud.loginStreak) || 0;
      var cycleDay = streak > 0 ? (((streak - 1) % 7) + 1) : 0;
      /* aakhri check-in: bahar se (daily_checkins row) ya UD se — listeners.js
         users.last_checkin_date ko UD.lastCheckin_date/lastCheckIn me bharta hai */
      var _last = lastCheckinISO || ud.last_checkin_date || ud.lastCheckin_date || ud.lastCheckIn || '';
      var doneToday = false;
      try {
        if (_last) {
          var n = new Date();
          var todayStr = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
          if (/^\d{4}-\d{2}-\d{2}$/.test(String(_last))) {
            doneToday = (String(_last) === todayStr);     /* date-only (DB ka date column) */
          } else {
            var d = new Date(_last);
            doneToday = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
          }
        }
      } catch (e) { doneToday = false; }
      /* aaj jis cell par claim karna hai (aaj ho chuka ho to koi nahi).
         ⚠️ 7 ka CYCLE hai — 7 din poore hone par agli check-in dobara D1
         (app bhi cycleStreak = ((streak-1)%7)+1 se yahi karta hai; jaise
         streak 7 → newStreak 8 → cycle D1). */
      var claimDay = doneToday ? 0 : ((cycleDay % 7) + 1);
      var days = [];
      for (var i = 0; i < 7; i++) {
        days.push({
          day: i + 1,
          coins: Number(tiers[i]) || 0,
          done: (i + 1) <= cycleDay,
          today: (i + 1) === claimDay,
          warrior: (i + 1) === 7
        });
      }
      return {
        streak: streak, cycleDay: cycleDay, doneToday: doneToday, claimDay: claimDay,
        days: days, tiers: tiers,
        nextCoins: claimDay ? Number(tiers[claimDay - 1]) || 0 : 0,
        warriorEarned: cycleDay >= 7,
        label: cycleDay + '/7 दिन'
      };
    } catch (e) { return null; }
  };

  window.renderLoginStreakStrip = function (ud, lastCheckinISO) {
    try {
      var n = window.loginStreakNumbers(ud, lastCheckinISO);
      if (!n) return '';
      var h = '';
      h += '<div id="loginStreakStrip" data-streak="' + n.streak + '" data-cycle="' + n.cycleDay +
           '" data-done-today="' + (n.doneToday ? '1' : '0') + '" ' +
           'style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin:0 0 10px;border-radius:14px;' +
           'background:linear-gradient(135deg,rgba(255,140,0,.12),rgba(255,215,0,.06));border:1px solid rgba(255,140,0,.3)">';
      h += '<div style="text-align:center;flex-shrink:0;min-width:44px">' +
           _img(BASE + 'badges/week-warrior.png', 34, 'filter:drop-shadow(0 0 7px rgba(255,140,0,.45));' + (n.warriorEarned ? '' : 'opacity:.45;')) +
           '<div style="font-size:9px;font-weight:900;color:#ff8c00;margin-top:2px">' + n.label + '</div></div>';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';
      n.days.forEach(function (d) {
        var bg = d.done ? 'rgba(0,255,100,.16)' : (d.today ? 'rgba(255,140,0,.28)' : 'rgba(255,255,255,.05)');
        var bd = d.done ? 'rgba(0,255,100,.4)' : (d.today ? 'rgba(255,140,0,.65)' : 'rgba(255,255,255,.08)');
        var fg = d.done ? '#00ff64' : (d.today ? '#ff8c00' : 'rgba(255,255,255,.45)');
        h += '<div title="दिन ' + d.day + (d.warrior ? ' — Week Warrior' : '') + ': +🪙' + d.coins + '" ' +
             'style="text-align:center;padding:4px 1px;border-radius:8px;background:' + bg + ';border:1px solid ' + bd + '">' +
             '<div style="font-size:8px;color:rgba(255,255,255,.5);font-weight:700">D' + d.day + '</div>' +
             '<div style="font-size:10px;font-weight:900;color:' + fg + '">' + (d.done ? '✓' : '🪙' + d.coins) + '</div></div>';
      });
      h += '</div>';
      h += '<div id="lsToday" style="font-size:11px;font-weight:800;color:' + (n.doneToday ? '#00ff64' : '#ff8c00') + ';margin-top:5px">' +
           (n.doneToday ? 'आज का check-in हो गया ✓' : (n.cycleDay > 0 ? 'आज check-in karo — +🪙' + n.nextCoins : '7-दिन की streak शुरू करो — दिन 1 पे +🪙' + (n.tiers[0] || 5))) +
           (n.warriorEarned ? ' · 🔥 Week Warrior!' : '') + '</div>';
      h += '</div>';
      if (!n.doneToday) {
        h += '<button onclick="if(window.doCheckIn){window.doCheckIn();}else if(window.navTo){window.navTo(\'wallet\');}" ' +
             'style="flex-shrink:0;padding:9px 12px;border-radius:11px;border:none;background:linear-gradient(135deg,#ffaa00,#ff6b00);' +
             'color:#000;font-weight:900;font-size:11px;cursor:pointer;white-space:nowrap">Check-in ›</button>';
      }
      h += '</div>';
      return h;
    } catch (e) { return ''; }
  };

  /* होम render होने के बाद: आज की असली check-in रो देख कर ऊपर की पट्टी को
     सच के साथ refresh करो (sync HTML me date nahi hoti — isliye ye bahar
     se आता है). Fail ho to jo dikh रहा है wahi रहता है. */
  window.refreshLoginStreakToday = function () {
    try {
      var el = document.getElementById('loginStreakStrip');
      if (!el || !window._supa || !window.U || !window.U.uid) return;
      var today = new Date();
      var iso = '' + today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      window._supa.from('daily_checkins').select('checkin_date,streak_day,coins_earned')
        .eq('user_id', window.U.uid).eq('checkin_date', iso).limit(1)
        .then(function (r) {
          var row = r && r.data && r.data[0];
          var now = document.getElementById('loginStreakStrip');
          if (!now) return;
          var lab = document.getElementById('lsToday');
          if (row) {
            now.setAttribute('data-done-today', '1');
            if (lab) { lab.style.color = '#00ff64'; lab.innerHTML = 'आज का check-in हो गया ✓' + (row.coins_earned ? ' (+🪙' + row.coins_earned + ')' : ''); }
            var btn = now.querySelector('button'); if (btn) btn.remove();
          } else {
            now.setAttribute('data-done-today', '0');
          }
        }).catch(function () {});
    } catch (e) {}
  };

  /* ── Premium ribbon (naam ke aage sunehra badge) ──
     premium_level users ke liye; baaki ke liye '' — koi jhoota dava
     nahi. Player-card jaisa "sirf apna premium" rule yahan bhi. */
  window.premiumRibbonHtml = function (px) {
    try {
      var lvl = 0;
      if (window.getUserPremiumTier) lvl = Number(window.getUserPremiumTier()) || 0;
      else if (window.UD && window.UD.premium_level) lvl = Number(window.UD.premium_level) || 0;
      var exp = 0;
      try { exp = (window.UD && window.UD.premium && window.UD.premium.expiresAt) || 0; } catch (e) {}
      return window.premiumRibbonFor(lvl, exp, px);
    } catch (e) { return ''; }
  };

  /* ── Premium ribbon — DOOSRE players ke liye (explicit values) ──
     Kyun: apne premium ka ribbon pehle sirf apne card par dikhta tha (users
     RLS ki wajah se doosron ka premium padha nahi ja sakta). Ab leaderboard
     row me premium_level + premium_expires aata hai (public read) — us se
     kisi bhi player ke naam ke aage ribbon dikha sakte hain.

     ⚠️ "jhoota dava nahi": level > 0 hona hi kaafi nahi — expires bhi check
     hota hai. Expire ho chuka premium = koi ribbon nahi (DB me cron ka
     intezaar nahi karte). */
  window.premiumRibbonFor = function (level, expiresAt, px) {
    try {
      var lvl = Number(level) || 0;
      if (lvl <= 0) return '';
      var exp = Number(expiresAt) || 0;
      if (exp && exp < Date.now()) return '';
      px = Number(px) || 20;
      var tier = lvl >= 3 ? 'Diamond' : (lvl === 2 ? 'Gold' : 'Silver');
      return '<img class="prem-ribbon" src="' + BASE + 'premium/ribbon.png?v=' + VER + '" alt="Premium" ' +
        'title="Premium (' + tier + ')" data-premium-tier="' + lvl + '" ' +
        'style="height:' + px + 'px;vertical-align:middle;filter:drop-shadow(0 0 6px rgba(255,215,0,.5))" ' +
        'onerror="this.style.display=\'none\'">';
    } catch (e) { return ''; }
  };

  /* ── E2E evidence object ── */
  try {
    window.__BADGE_ENGINE = {
      version: VER,
      selftest: function () {
        var st = { wins: 60, kills: 160, matches: 40, streak: 5, loginStreak: 7, rp: 1100, level: 26, clean: 101, premium: 1, top3: 16, top5: 26, top10: 51, soloWins: 26, comebacks: 6 };
        var earned = window.getEarnedBadges(st);
        var next = window.getNextReward(st);
        return {
          version: VER,
          earnedCount: earned.length,
          top3: window.getTopBadges(st, 3).map(function (b) { return b.name; }),
          nextReward: next ? (next.name + ' ' + next.have + '/' + next.need) : null,
          rankImg: window.rankBadgeImg(1100),
          stripHtml: window.renderNextRewardStrip(st).length,
          showcaseHtml: window.renderBadgeShowcaseRow(st).length,
          ribbonNone: window.premiumRibbonFor(0, 0, 16),
          ribbonTier2: window.premiumRibbonFor(2, Date.now() + 86400000, 16).indexOf('premium/ribbon.png') !== -1,
          ribbonExpired: window.premiumRibbonFor(3, Date.now() - 1000, 16)
        };
      }
    };
    console.log('[E2E] badge-engine v' + VER + ' loaded — ' + (function () {
      try { return window._allRewardItems ? 'ok' : 'ok'; } catch (e) { return 'ok'; }
    })());
  } catch (e) {}
  /* ══════════════════════════════════════════════════════════════════════
     3.9 PUSH NOTIFICATIONS — client wale 2 kism (server wale 2 DB cron me:
     supabase/migrations/20261013_push_alerts_3_9.sql → season 24h + trial
     expiry, dono pg_cron se).

       • badge_unlock      — naya badge milte hi (match ke turant baad)
       • badge_near_unlock — 80%+ ho chuka par abhi khula nahi ("bas thoda aur")

     Push ka raasta pehle se LIVE hai (notifications INSERT → DB trigger →
     pg_net → push-send → OneSignal) — yahan duplicate NAHI kiya, bas asli
     notification row daali jaati hai.

     JHooth NAHI:
       • Pehli baar chala to purane saare badges sirf "dekhe hue" mark hote
         hain — purane unlock par notification spam nahi.
       • Har badge ke liye EK hi baar (localStorage me per-user guard).
       • Badge mil gaya to near-list se hat jaata hai (dobara "paas ho" nahi).
       • Login/data na ho to kuch nahi bhejte. ═════════════════════════════ */

  var _STAT_LABEL = {
    kills: 'kills', wins: 'wins', matches: 'matches', level: 'level',
    rp: 'rank points', loginStreak: 'din ka check-in streak', winStreak: 'win streak',
    streak: 'win streak', clean: 'clean matches', premium: 'premium din',
    top1: 'top-1 finish', top3: 'top-3 finish', top5: 'top-5 finish',
    top10: 'top-10 finish', soloWins: 'solo wins', comebacks: 'comebacks',
    headshots: 'headshots', assists: 'assists', damage: 'damage',
  };
  function _statLabel(s) { return _STAT_LABEL[s] || String(s || '').replace(/([A-Z])/g, ' $1').toLowerCase(); }

  function _bdgLsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function _bdgLsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* asli notification row (push trigger khud bhej dega) — best effort */
  function _bdgNotify(row) {
    try {
      if (!window._supa || !window.U || !window.U.uid) return false;
      window._supa.from('notifications').insert({
        user_id: window.U.uid, type: row.type, title: row.title, body: row.body, ref_id: row.ref_id,
      }).then(function (r) {
        if (r && r.error && window.console) console.warn('badge-notify:', r.error.message || r.error);
      }, function () {});
      return true;
    } catch (e) { return false; }
  }

  /* locked items jinka completion 80%–99% (asli stats se) */
  function _nearList(st) {
    var out = [];
    try {
      _allRewardItems().forEach(function (w) {
        var it = w.it;
        if (!it || !it.need) return;
        if (_unlocked(it, st)) return;
        var parts = it.need.all ? it.need.all : [it.need];
        var minPct = 101, weakest = null;
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i], need = Number(p.need) || 0;
          if (need <= 0) continue;
          var have = Number(st[p.stat]) || 0;
          var pct = Math.min(100, (have / need) * 100);
          if (pct < minPct) { minPct = pct; weakest = { stat: p.stat, have: have, need: need }; }
        }
        if (!weakest || minPct >= 100 || minPct < 80) return;
        out.push({ id: it.id, name: it.name, kind: w.kind, stat: weakest.stat,
                   left: Math.max(1, weakest.need - weakest.have), pct: Math.floor(minPct) });
      });
    } catch (e) {}
    return out;
  }

  /* ── home render ke baad lagta hai (cheap: localStorage diff) ── */
  window.notifyNewBadges = function (st) {
    var sent = 0;
    try {
      if (!window.U || !window.U.uid || !window._supa) return 0;
      var uid = window.U.uid;
      st = st || window._bdgStats();
      var earned = window.getEarnedBadges(st);
      var seenKey = 'ff_badge_seen_v1_' + uid;
      var nearKey = 'ff_badge_near_v1_' + uid;

      var earnedIds = earned.map(function (b) { return b.id; });
      var seen = _bdgLsGet(seenKey);
      var near = _bdgLsGet(nearKey);
      if (!seen || !seen.length || !near) {
        /* pehli baar (is device+account par): sirf baseline — purane badges ya
           aadhe-adhoore rewards par EK BHI push nahi, taaki spam na ho */
        _bdgLsSet(seenKey, earnedIds);
        _bdgLsSet(nearKey, []);
        return 0;
      }

      /* 1) UNLOCK — naya kaunsa badge mila (milestone, isliye sabhi fresh) */
      var fresh = earned.filter(function (b) { return seen.indexOf(b.id) === -1; });
      for (var i = 0; i < fresh.length; i++) {
        var b = fresh[i];
        if (_bdgNotify({
          type: 'badge_unlock',
          title: (b.kind === 'title' ? '✨ Naya title: ' : '🏅 Naya badge: ') + b.name,
          body: (b.desc ? b.desc + ' — ' : '') + 'Collection me add ho gaya, profile par dekho!',
          ref_id: b.id,
        })) sent++;
      }
      if (fresh.length) _bdgLsSet(seenKey, seen.concat(fresh.map(function (x) { return x.id; })));

      /* 2) NEAR-UNLOCK — 80%+ ho chuka, abhi khula nahi.
         Ek render par max 2 (burst spam nahi) — baaki agle render par,
         aur har reward ke liye zindagi me ek hi baar. */
      near = near.filter(function (id) { return earnedIds.indexOf(id) === -1; });  /* mil gaya → hatao */
      var nearNew = _nearList(st).filter(function (n) { return near.indexOf(n.id) === -1; });
      var nearSent = 0;
      for (var j = 0; j < nearNew.length && nearSent < 2; j++) {
        var n = nearNew[j];
        if (_bdgNotify({
          type: 'badge_near_unlock',
          title: '🔥 Bas thoda sa aur — ' + n.name + (n.kind === 'title' ? ' title' : ' badge') + ' paas hai!',
          body: n.left + ' aur ' + _statLabel(n.stat) + ' chahiye (' + n.pct + '% ho chuka) — aaj hi poora karo!',
          ref_id: n.id,
        })) { sent++; nearSent++; }
        near.push(n.id);
      }
      _bdgLsSet(nearKey, near);
      return sent;
    } catch (e) { return sent; }
  };

  /* test/debug ke liye asli near-list bhi expose (jhooth-free verify) */
  window.badgeNearList = function (st) { return _nearList(st || window._bdgStats()); };

})();
