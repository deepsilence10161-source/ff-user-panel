/* ================================================================
   SEASONAL LEAGUE SYSTEM — seasonal-league.js
   
   Firebase:
   appSettings/currentSeason: { id, name, startDate, endDate, active }
   seasons/{seasonId}/rankings/{uid}: { rank, kills, wins, matches }
   users/{uid}/seasonHistory: [ { seasonId, rank, badge } ]
   ================================================================ */

(function() {
'use strict';

var _season = null;

/* ── Load Current Season ── */
window.loadCurrentSeason = function() {
  if (!window._supa) { setTimeout(window.loadCurrentSeason, 800); return; }
  /* App configuration lives in app_settings. The old `config` table does
     not exist in production and caused a 404 on every page load. */
  /* ✅ B18 (2026-10-07): user ko sirf `currentSeason` par nahi chhodna —
     admin ki Seasonal League settings (live_config.seasonName /
     seasonEndDate / seasonActive) hamesha se isi jagah likhi jaati thin,
     par ye screen unhe padhti hi nahi thi (2026-09-08 wali purani row se
     user ko jhoothi "30 din baaki" dikhti rehti thi). Ab dono ek hi sach:
     currentSeason pehle, aur agar wo khaali/adhooora ho to live_config
     (admin Settings) — aur endDate na mile to admin ke seasonEndDate /
     seasonEndDays se banti hai. */
  window._supa.from('app_settings')
    .select('key,value')
    .in('key', ['currentSeason', 'live_config'])
    .then(function(r) {
      var rows = (r && r.data) || [];
      var cur = null, cfg = null;
      rows.forEach(function (x) { if (x.key === 'currentSeason') cur = x.value; else if (x.key === 'live_config') cfg = x.value; });
      var s = (cur && typeof cur === 'object') ? Object.assign({}, cur) : {};
      if (cfg && typeof cfg === 'object') {
        if (!s.name)   s.name   = cfg.seasonName;
        if (s.active === undefined || s.active === null) s.active = (Number(cfg.seasonActive) !== 0);
        if (!s.endDate) s.endDate = cfg.seasonEndDate || (cfg.seasonEndDays ? (Date.now() + Number(cfg.seasonEndDays) * 86400000) : null);
      }
      if (!s.name) s.name = 'Season 1';
      if (s.active === undefined || s.active === null) s.active = true;
      _season = s;
      window._currentSeason = _season;
      if (window.updateSeasonDisplay) window.updateSeasonDisplay(_season);
    })
    .catch(function() {
      /* Fallback: default season */
      _season = { name: 'Season 1', endDate: null };
      window._currentSeason = _season;
    });
};

window.getCurrentSeason = function() {
  if (!_season) return { name: 'Season 1', daysLeft: 0, label: '', active: false };
  var now = Date.now();
  /* endDate can be ISO string (from Supabase) or timestamp or null */
  var endRaw = _season.endDate || _season.end_date || null;
  var end = endRaw ? (typeof endRaw === 'string' ? new Date(endRaw).getTime() : Number(endRaw)) : 0;
  /* ✅ B18: pehle tareekh na hone par chup-chaap "aaj se 30 din" maan liya
     jaata tha — user ko jhoothi 30-din wali deadline dikhti thi jo kabhi
     badalti nahi thi. Ab sach: tareekh na ho to koi jhoothi deadline nahi. */
  if (!end || isNaN(end)) end = 0;
  /* ✅ B18: din CALENDAR-din me (admin ka hint bhi wahi ginta hai) — warna
     ek hi tareekh admin ko 45 aur user ko 46 dikhati thi. */
  var daysLeft = 0;
  if (end) {
    var _t0 = new Date(now); _t0.setHours(0, 0, 0, 0);
    var _t1 = new Date(end); _t1.setHours(0, 0, 0, 0);
    daysLeft = Math.max(0, Math.round((_t1.getTime() - _t0.getTime()) / 86400000));
  }
  return {
    id:       _season.id || 'S1',
    name:     _season.name || (window.CFG && window.CFG.seasonName) || 'Season 1',
    daysLeft: daysLeft,
    endDate:  end,
    active:   !!_season.active,
    label:    daysLeft > 0 ? daysLeft + ' din baaki' : 'Ended',
    hasEnd:   !!end,
    /* ✅ B18: monthly storage key (seasonStats/<monthKey> / weekly buckets)
       wahi ek jagah se — display admin ki settings se, key monthly bucket se */
    monthKey: (window.getMonthlySeasonMeta ? window.getMonthlySeasonMeta().monthKey : (window.getWeekKey ? '' : ''))
  };
};

/* ── Season Rank Display (profile/rank screen) ── */
window.showSeasonInfo = function() {
  var s = window.getCurrentSeason();
  var h = '<div style="text-align:center;padding:8px 0">';
  h += '<div style="font-size:13px;font-weight:900;color:#ffd700;margin-bottom:4px">' + s.name + '</div>';

  if (s.active) {
    var pct = Math.max(0, Math.min(100, 100 - (s.daysLeft / 90 * 100)));
    h += '<div style="background:rgba(255,255,255,.06);border-radius:10px;height:6px;margin:8px 0"><div style="width:' + pct + '%;height:6px;background:linear-gradient(90deg,#00ff9c,#ffd700);border-radius:10px;transition:width .5s"></div></div>';
    h += '<div style="font-size:12px;color:var(--txt2)">' + s.daysLeft + ' din baaki</div>';
  }

  // Season prizes
  h += '<div style="margin-top:14px;background:rgba(0,0,0,.2);border-radius:12px;padding:12px">';
  h += '<div style="font-size:11px;font-weight:800;color:#fff;margin-bottom:8px">🏆 Season End Rewards</div>';
  var prizes = [
    { pos: '#1 Champion',    reward: '🌟 Grandmaster Badge + 500🪙' },
    { pos: '#2–#5',          reward: '👑 Legend Badge + 200🪙' },
    { pos: '#6–#20',         reward: '💎 Diamond Badge + 100🪙' },
    { pos: '#21–#100',       reward: '🥇 Gold Badge + 50🪙' },
  ];
  prizes.forEach(function(p) {
    h += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px"><span style="color:#888">' + p.pos + '</span><span style="color:#ffd700">' + p.reward + '</span></div>';
  });
  h += '</div>';

  // My season stats
  if (window.U && window.UD) {
    h += '<div style="margin-top:12px">';
    h += '<div style="font-size:11px;font-weight:800;color:#00d4ff;margin-bottom:8px">📊 Tumhara Is Season Ka Stats</div>';
    var st = (window.UD && window.UD.stats) || {};
    var rk = window.calcRk ? window.calcRk(st) : { badge: 'Bronze', emoji: '🏅', pts: 0 };
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">';
    [
      { l: 'Rank', v: rk.emoji + ' ' + rk.badge },
      { l: 'Points', v: rk.pts },
      { l: 'Wins', v: st.wins || 0 },
    ].forEach(function(i) {
      h += '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:8px;text-align:center"><div style="font-size:15px;font-weight:900;color:#fff">' + i.v + '</div><div style="font-size:10px;color:#666">' + i.l + '</div></div>';
    });
    h += '</div></div>';
  }

  h += '</div>';
  if (window.openModal) openModal('🏆 ' + s.name, h);
};

/* ── Season History (profile pe) ── */
window.showSeasonHistory = function() {
  if (!window.U) { toast('Login karo pehle', 'err'); return; }
  /* R28b FIX (2026-09-22): ye function renderSeasonHistory(hist) bulata
     tha, jo #seasonHistList element dhunda karta tha — par koi modal
     khula hi nahi jata tha, isliye wo element kabhi exist hi nahi karta,
     aur button dabane par KABHI KUCH DIKHTA HI NAHI THA (renderSeasonHistory
     silently return ho jata tha). Ab modal pehle khulta hai (spinner +
     #seasonHistList ke saath), data aane par renderSeasonHistory use
     bhar deta hai — showMatchHistory jaisa hi existing pattern. */
  var h = '<div id="seasonHistList" style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  if (window.openModal) openModal('🏆 Season History', h);
  /* Load season history from Supabase */
  if (window._supa) {
    window._supa.from('seasonal_league_history').select('*').eq('user_id', window.U.uid).order('created_at', { ascending: false })
      .then(function(r) {
        var hist = (r.data || []).map(function(s) { return { seasonName: s.season_name, seasonNum: s.season_num, finalTier: s.final_tier, points: s.points, badge: s.badge, reward: s.reward, emoji: s.emoji }; });
        if (window.renderSeasonHistory) renderSeasonHistory(hist);
      }).catch(function(){ if (window.renderSeasonHistory) renderSeasonHistory([]); });
    return;
  }
  /* Fallback: empty history if Supabase not ready */
  if (window.renderSeasonHistory) renderSeasonHistory([]);
};

/* ══════════════════════════════════════════════════════════════════
   3.8 SEASON ENERGY (2026-10-13) — home par season countdown + apni
   position + Top-3 ka near-miss.
   ──────────────────────────────────────────────────────────────────
   KYUN: season sirf "X din baaki" nahi hona chahiye — player ko ye bhi
   dikhna chahiye ki WO kahan khada hai aur kitna door hai ("tum #7 par
   ho · Top-3 se 2 kills door"). Yahi near-miss khelte rehne ki wajah
   banta hai (aur season pass kharidne ki).
   IZAT ka niyam: jo naapa nahi ja sakta wo NAHI likhte —
     • endDate nahi → strip hi nahi (jhooti deadline kabhi nahi)
     • season khatam (0 din) → strip nahi
     • apni row leaderboard me nahi mili → sirf countdown dikhega,
       position/near-miss nahi (jhooti rank kabhi nahi)
   Metric: leaderboard ka default tab KILLS hai — wahi use hota hai,
   taaki home aur rank screen ek hi baat bolein.
   ══════════════════════════════════════════════════════════════════ */
var _ssRows = null, _ssAt = 0;
var _SS_CACHE_MS = 5 * 60 * 1000;

function _ssLoad(cb) {
  if (!window._supa) { cb(null); return; }
  if (_ssRows && (Date.now() - _ssAt) < _SS_CACHE_MS) { cb(_ssRows); return; }
  window._supa.from('leaderboard').select('id,total_kills,total_wins,rank_points').limit(300)
    .then(function (r) {
      _ssRows = (r && r.data) || null;
      _ssAt = Date.now();
      cb(_ssRows);
    })
    .catch(function () { cb(null); });
}

/* saare numbers yahin bante hain — test bhi isi ko bulata hai */
window.seasonStripNumbers = function (rows, myUid) {
  var s = window.getCurrentSeason ? window.getCurrentSeason() : null;
  if (!s || !s.hasEnd || !s.active || s.daysLeft <= 0) return null;
  var out = { name: s.name, daysLeft: s.daysLeft, pos: 0, gap: 0, metric: 'kills', total: 0 };
  if (!rows || !rows.length) return out;
  var sorted = rows.slice().sort(function (a, b) { return Number(b.total_kills || 0) - Number(a.total_kills || 0); });
  out.total = sorted.length;
  var myIdx = -1;
  for (var i = 0; i < sorted.length; i++) { if (sorted[i].id === myUid) { myIdx = i; break; } }
  if (myIdx < 0) return out;              /* ranked nahi — sirf countdown */
  if (myIdx < 3) { out.pos = myIdx + 1; return out; }   /* pehle se Top-3 me */
  var third = Number(sorted[2].total_kills || 0);
  out.pos = myIdx + 1;
  out.gap = Math.max(1, third - Number(sorted[myIdx].total_kills || 0) + 1); /* Top-3 me aane ke liye kam se kam kitne kills chahiye */
  return out;
};

/* Test hook (read-only vyavhaar): rows cache seedha set karo — E2E page
   asli strip HTML ko asli numbers ke saath render kar sake (koi mock
   function nahi, sirf cache bhar rahe hain jo DB se bharta hai). */
window.__SS_SET_ROWS = function (rows) { _ssRows = rows || null; _ssAt = Date.now(); };

window.renderSeasonCountdownStrip = function () {
  try {
    var n = window.seasonStripNumbers(_ssRows, (window.U && window.U.uid) || '');
    if (!n) return '';
    var bits = ['⏳ <b style="color:#ffd700">' + n.name + '</b> — <b>' + n.daysLeft + '</b> din baaki'];
    if (n.pos && n.pos <= 3) bits.push('tum #' + n.pos + ' par ho (Top-3 me!) 🏅');
    else if (n.pos && n.gap > 0) bits.push('tum #' + n.pos + ' par ho · Top-3 se <b>' + n.gap + '</b> kills door');
    var h = '<div id="seasonCountdownStrip" data-days-left="' + n.daysLeft + '" data-pos="' + (n.pos || 0) + '" data-gap="' + (n.gap || 0) + '" ' +
      'onclick="if(window.renderRank)renderRank();else if(window.navTo)navTo(\'rank\')" ' +
      'style="display:flex;align-items:center;gap:8px;margin:8px 0;padding:9px 11px;border-radius:12px;cursor:pointer;' +
      'background:linear-gradient(135deg,rgba(0,255,156,.08),rgba(255,215,0,.06));border:1px solid rgba(0,255,156,.22)">' +
      '<div style="flex:1;min-width:0;font-size:11px;color:#ddd;line-height:1.5">' + bits.join(' · ') + '</div>' +
      '<div style="font-size:10px;font-weight:900;color:#00ff9c;white-space:nowrap">Rank dekho ›</div></div>';
    /* position async aati hai (leaderboard fetch) — strip turant, number baad me */
    _ssLoad(function (rows) {
      try {
        var el = document.getElementById('seasonCountdownStrip');
        if (!el) return;
        var n2 = window.seasonStripNumbers(rows, (window.U && window.U.uid) || '');
        if (!n2) { el.remove(); return; }
        el.setAttribute('data-pos', String(n2.pos || 0));
        el.setAttribute('data-gap', String(n2.gap || 0));
        var b2 = ['⏳ <b style="color:#ffd700">' + n2.name + '</b> — <b>' + n2.daysLeft + '</b> din baaki'];
        if (n2.pos && n2.pos <= 3) b2.push('tum #' + n2.pos + ' par ho (Top-3 me!) 🏅');
        else if (n2.pos && n2.gap > 0) b2.push('tum #' + n2.pos + ' par ho · Top-3 se <b>' + n2.gap + '</b> kills door');
        var txt = el.querySelector('div');
        if (txt) txt.innerHTML = b2.join(' · ');
      } catch (e) {}
    });
    return h;
  } catch (e) { return ''; }
};

/* ── Auto-load ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { setTimeout(window.loadCurrentSeason, 1500); });
} else {
  setTimeout(window.loadCurrentSeason, 1500);
}

})();
