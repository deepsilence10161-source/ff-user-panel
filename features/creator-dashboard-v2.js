/* ═══════════════════════════════════════════════════════════════════════════
   CREATOR DASHBOARD v2 — D103 (16-Nov-2026)
   High-advanced, beautiful, smart: real-time wallet (Locked/Available/Paid/
   Reversed), rating-tier badge, 30-din earnings chart, stream breakdown,
   referred-users ledger (masked), hosted matches, mentor saanjh, payouts,
   aur promo KIT (code + QR + halal-disclosure share text).
   Ye file premium-creator.js ke BAAD load hoti hai aur purane dashboard
   functions ko override karti hai. Data 100% server-authoritative
   (creator_wallet view + creator_commissions rows) — client kuch compute
   nahi karta, sirf dikhata hai.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var S = function () { return window._supa; };
  var ME = function () { return window.U && window.U.uid; };
  var esc = function (s) { return window.escHtml ? window.escHtml(s) : String(s == null ? '' : s); };
  var mask = function (ign) { ign = ign || 'user'; return esc(ign.slice(0, 2)) + '***'; };
  var inr = function (n) { return '₹' + Number(n || 0).toFixed(2); };
  var GOLD = '#ffd700', CYAN = '#00d4ff', GREEN = '#00ff9c', RED = '#ff6b6b', AMBER = '#ffb347';
  var STATE_COL = { locked: AMBER, available: GREEN, paid: CYAN, reversed: RED };
  var STREAM_COL = { host: GOLD, referral: CYAN, ads: '#b388ff', mentor: GREEN };
  var _refreshTimer = null;

  function card(inner, glow) {
    return '<div style="background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:14px;' + (glow ? 'box-shadow:0 6px 24px ' + glow + ';border-color:' + glow.replace(')', ',.35)').replace('rgb', 'rgba') + ';' : '') + '">' + inner + '</div>';
  }
  function chip(txt, col) {
    return '<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:9.5px;font-weight:900;letter-spacing:.4px;background:' + col + '22;color:' + col + ';border:1px solid ' + col + '55">' + txt + '</span>';
  }
  function stars(r) {
    r = Number(r || 0); var out = '';
    for (var i = 1; i <= 5; i++) out += '<span style="color:' + (i <= Math.round(r) ? GOLD : 'rgba(255,255,255,.18)') + ';font-size:12px">★</span>';
    return out + ' <b style="color:' + GOLD + ';font-size:11px">' + (r ? r.toFixed(1) : '—') + '</b>';
  }
  function tierOf(hostPct, refCnt) {
    if (hostPct >= 25) return { n: 'T3 PARTNER', c: GOLD };
    if (hostPct >= 20) return { n: 'T2 BUILDER', c: CYAN };
    return { n: 'T1 STARTER', c: GREEN };
  }

  function barChart(rows) {
    /* 30-din daily earning bars (SVG, koi library nahi) */
    var days = [], i, d, map = {};
    for (i = 29; i >= 0; i--) { d = new Date(Date.now() - i * 864e5); var k = d.toISOString().slice(0, 10); map[k] = 0; days.push(k); }
    (rows || []).forEach(function (r) { var k = (r.created_at || '').slice(0, 10); if (map[k] != null && r.wallet_state !== 'reversed') map[k] += Number(r.amount || 0); });
    var max = Math.max.apply(null, days.map(function (k) { return map[k]; }).concat([1]));
    var w = 320, h = 74, bw = (w - 30) / 30;
    var bars = '';
    for (i = 0; i < 30; i++) {
      var kk = days[i], vv = map[kk], bhh = Math.round((vv / max) * (h - 18)); if (vv > 0 && bhh < 2) bhh = 2;
      bars += '<rect x="' + (4 + i * bw) + '" y="' + (h - 14 - bhh) + '" width="' + Math.max(2, bw - 2.5) + '" height="' + bhh + '" rx="2" fill="url(#gE)" opacity="' + (vv > 0 ? 1 : .18) + '"/>';
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:' + h + 'px"><defs><linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + GOLD + '"/><stop offset="1" stop-color="' + CYAN + '"/></linearGradient></defs>' + bars + '<text x="4" y="9" fill="rgba(255,255,255,.5)" font-size="8.5">pichhle 30 din · max ' + inr(max) + '</text></svg>';
  }

  function fetchAll(uid, cb) {
    var s = S(); var out = {};
    if (!s) return cb(null);
    Promise.all([
      s.from('users').select('ign,creator_code,creator_rating,creator_rating_count,is_creator,creator_suspended_until,creator_suspended_permanently,premium_level').eq('id', uid).maybeSingle(),
      s.from('creator_wallet').select('*').eq('creator_uid', uid).maybeSingle(),
      s.from('creator_commissions').select('*').eq('creator_uid', uid).order('created_at', { ascending: false }).limit(60),
      s.from('creator_matches').select('*').eq('creator_uid', uid).order('created_at', { ascending: false }).limit(20),
      s.from('creator_payouts').select('*').eq('uid', uid).order('created_at', { ascending: false }).limit(10),
      s.from('creator_applications').select('status,channel_url,auto_score,auto_decision').eq('user_id', uid).order('created_at', { ascending: false }).limit(1),
      s.rpc('creator_referred_users')   /* D103: masked list via security-definer RPC (users RLS own/admin only) */
    ]).then(function (r) {
      /* BUGFIX (16-Nov): r[i] supabase RESPONSE object hota hai ({data,error}),
         raw data nahi. Pehle r[2] (response) par .slice() chalta tha → TypeError
         → catch → "Service unavailable". Ab .data use hota hai. */
      for (var i = 0; i < r.length; i++) if (r[i] && r[i].error) console.warn('[cdV2] query' + i + ':', r[i].error.message);
      out.me = r[0].data; out.wallet = r[1].data; out.rows = r[2].data || []; out.matches = r[3].data || []; out.payouts = r[4].data || []; out.app = (r[5].data || [])[0]; out.refs = r[6].data || [];
      cb(out);
    }).catch(function (e) { console.warn('[cdV2] fetchAll fail:', e && e.message); cb(null); });
  }

  function render(uid) {
    var box = document.getElementById('cdV2Body'); if (!box) return;
    box.innerHTML = '<div style="text-align:center;padding:26px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
    fetchAll(uid, function (D) {
      if (!D) { box.innerHTML = '<p style="color:' + RED + ';text-align:center">Service unavailable</p>'; return; }
      var me = D.me || {}, w = D.wallet || { locked: 0, available: 0, paid: 0, reversed: 0 };
      var hostPct = 15, refPct = 10;
      var rc = Number(me.creator_rating_count || 0), rr = Number(me.creator_rating || 0);
      if (rc >= 5) hostPct = rr >= 4.5 ? 25 : rr >= 4 ? 20 : rr >= 3.5 ? 15 : 10;
      var refCnt = (D.refs || []).length; refPct = refCnt >= 150 ? 15 : refCnt >= 50 ? 12 : 10;
      var tier = tierOf(hostPct, refCnt);
      var suspended = me.creator_suspended_permanently || (me.creator_suspended_until && new Date(me.creator_suspended_until) > new Date());

      /* stream breakdown */
      var sums = {}; (D.rows || []).forEach(function (r) { if (r.wallet_state === 'reversed') return; sums[r.stream] = (sums[r.stream] || 0) + Number(r.amount || 0); });
      var tot = Object.keys(sums).reduce(function (a, k) { return a + sums[k]; }, 0) || 1;
      var breakHtml = Object.keys(STREAM_COL).map(function (k) {
        var v = sums[k] || 0, pc = Math.round(v / tot * 100);
        return '<div style="margin-bottom:7px"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--txt2);margin-bottom:3px"><span>' + k.toUpperCase() + '</span><b style="color:' + STREAM_COL[k] + '">' + inr(v) + ' (' + pc + '%)</b></div><div style="height:6px;border-radius:99px;background:rgba(255,255,255,.07)"><div style="height:6px;border-radius:99px;width:' + pc + '%;background:' + STREAM_COL[k] + '"></div></div></div>';
      }).join('');

      var rowsHtml = (D.rows || []).slice(0, 25).map(function (r) {
        var st = r.wallet_state || 'locked';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border:1px solid rgba(255,255,255,.07);border-radius:12px;margin-bottom:6px;background:rgba(255,255,255,.03)">' +
          '<div><div style="font-size:11px;font-weight:800;color:var(--txt)">' + esc(r.reason || r.stream) + '</div>' +
          '<div style="font-size:9.5px;color:var(--txt2)">' + (r.created_at || '').slice(5, 16).replace('T', ' ') + ' · ' + esc(r.stream || '') + ' · rate ' + (r.rate_pct || '—') + '%</div></div>' +
          '<div style="text-align:right"><div style="font-size:12px;font-weight:900;color:' + STATE_COL[st] + '">' + inr(r.amount) + '</div>' + chip(st.toUpperCase(), STATE_COL[st]) + '</div></div>';
      }).join('') || '<p style="color:var(--txt2);font-size:11px;text-align:center;padding:14px">Abhi koi commission nahi — kit se code share karo!</p>';

      var refsHtml = (D.refs || []).slice(0, 12).map(function (u) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 10px;border:1px solid rgba(255,255,255,.06);border-radius:11px;margin-bottom:5px;font-size:11px"><span style="font-weight:800">' + mask(u.ign) + '</span><span style="color:var(--txt2)">' + (u.created_at || '').slice(0, 10) + ' · ' + (Number(u.premium_level || 0) > 0 ? chip('PREMIUM ' + u.premium_level, GOLD) : chip('FREE', 'rgba(255,255,255,.4)')) + '</span></div>';
      }).join('') || '<p style="color:var(--txt2);font-size:11px;text-align:center;padding:12px">Abhi koi referred user nahi.</p>';

      var matchHtml = (D.matches || []).slice(0, 10).map(function (m) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 10px;border:1px solid rgba(255,255,255,.06);border-radius:11px;margin-bottom:5px;font-size:11px"><span style="font-weight:800;color:' + GOLD + '">🎮 ' + esc(String(m.match_id || '').slice(-6)) + '</span><span>' + chip((m.commission_pct || 15) + '%', GOLD) + ' ' + inr(m.commission_amount) + ' ' + chip(String(m.commission_status || 'pending'), CYAN) + '</span></div>';
      }).join('') || '<p style="color:var(--txt2);font-size:11px;text-align:center;padding:12px">Koi hosted match nahi.</p>';

      var payHtml = (D.payouts || []).map(function (p) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 10px;border:1px solid rgba(255,255,255,.06);border-radius:11px;margin-bottom:5px;font-size:11px"><span>' + (p.created_at || '').slice(0, 10) + '</span><span style="font-weight:900;color:' + (p.status === 'paid' ? CYAN : AMBER) + '">' + inr(p.amount) + ' · ' + String(p.status || '').toUpperCase() + '</span></div>';
      }).join('') || '<p style="color:var(--txt2);font-size:11px;text-align:center;padding:12px">Koi payout request nahi.</p>';

      var link = 'https://deepsilence10161-source.github.io/ff-user-panel/?ref=' + encodeURIComponent(me.creator_code || '');
      var shareTxt = encodeURIComponent('Mini eSports join karo! Mera creator code: ' + (me.creator_code || '') + ' — main is app par matches host karta hoon; mere code se mujhe commission milta hai (disclosure). Download: ' + link);

      box.innerHTML =
        /* HEADER */
        '<div style="border-radius:18px;padding:16px;background:linear-gradient(135deg,rgba(255,215,0,.14),rgba(0,212,255,.10));border:1px solid rgba(255,215,0,.25);margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div><div style="font-size:16px;font-weight:900;color:var(--txt)">' + esc(me.ign || 'Creator') + ' ' + (suspended ? chip('SUSPENDED', RED) : chip('ACTIVE CREATOR', GREEN)) + '</div>' +
        '<div style="margin-top:4px">' + stars(rc > 0 ? me.creator_rating : null) + ' <span style="color:var(--txt2);font-size:10px">(' + (rc > 0 ? rc + ' ratings' : 'naya — koi rating nahi') + '</span></div></div>' +
        '<div style="text-align:right">' + chip(tier.n, tier.c) + '<div style="font-size:9.5px;color:var(--txt2);margin-top:4px">host ' + hostPct + '% · referral ' + refPct + '%</div></div></div>' +
        '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">' + chip('CODE: ' + (me.creator_code || '—'), GOLD) + chip('REF USERS: ' + refCnt, CYAN) + chip('MATCHES: ' + (D.matches || []).length, GREEN) + '</div></div>' +
        /* WALLET */
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">' +
        [['🔒 LOCKED', w.locked, AMBER, w.locked_rows], ['✅ AVAILABLE', w.available, GREEN, w.available_rows], ['💸 PAID', w.paid, CYAN, null], ['↩️ REVERSED', w.reversed, RED, null]].map(function (c) {
          return '<div style="background:rgba(255,255,255,.045);border:1px solid ' + c[2] + '44;border-radius:14px;padding:11px"><div style="font-size:9.5px;font-weight:900;color:' + c[2] + ';letter-spacing:.5px">' + c[0] + '</div><div style="font-size:17px;font-weight:900;color:var(--txt);margin-top:3px">' + inr(c[1]) + '</div>' + (c[3] != null ? '<div style="font-size:9px;color:var(--txt2)">' + c[3] + ' rows</div>' : '') + '</div>';
        }).join('') + '</div>' +
        /* CHART + BREAKDOWN */
        card('<div style="font-size:10px;font-weight:900;color:var(--txt2);letter-spacing:.5px;margin-bottom:6px">📈 EARNINGS — 30 DIN</div>' + barChart(D.rows) + '<div style="margin-top:10px">' + breakHtml + '</div>') +
        /* TABS CONTENT (stacked sections, mobile-first) */
        '<div style="margin-top:12px">' +
        card('<div style="font-size:10px;font-weight:900;color:var(--txt2);letter-spacing:.5px;margin-bottom:8px">🧾 COMMISSION ROWS (real-time wallet)</div>' + rowsHtml) +
        '<div style="height:8px"></div>' +
        card('<div style="font-size:10px;font-weight:900;color:var(--txt2);letter-spacing:.5px;margin-bottom:8px">👥 MERE REFERRED USERS (' + refCnt + ')</div>' + refsHtml) +
        '<div style="height:8px"></div>' +
        card('<div style="font-size:10px;font-weight:900;color:var(--txt2);letter-spacing:.5px;margin-bottom:8px">🎮 MERE HOSTED MATCHES</div>' + matchHtml) +
        '<div style="height:8px"></div>' +
        card('<div style="font-size:10px;font-weight:900;color:var(--txt2);letter-spacing:.5px;margin-bottom:8px">💸 PAYOUTS</div>' + payHtml +
          '<button onclick="window.cdV2Payout()" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,' + GREEN + ',#00cc7a);color:#000;font-size:12.5px;font-weight:900">💸 Payout Request karo (≥₹500 available)</button>') +
        '<div style="height:8px"></div>' +
        card('<div style="font-size:10px;font-weight:900;color:var(--txt2);letter-spacing:.5px;margin-bottom:8px">🎁 PROMO KIT</div>' +
          '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=88x88&data=' + encodeURIComponent(link) + '" onerror="this.style.display=\'none\'" style="width:88px;height:88px;border-radius:10px;border:1px solid rgba(255,255,255,.15)"/>' +
          '<div style="flex:1"><div style="font-size:10.5px;color:var(--txt2);line-height:1.5">Code share karo; user signup par code daale ⇒ uski har real-money activity par tumhari commission wallet me turant LOCKED hoti hai.</div>' +
          '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button onclick="window.cdV2Copy(\'' + esc(me.creator_code || '') + '\')" style="padding:7px 10px;border-radius:9px;border:1px solid ' + GOLD + '66;background:' + GOLD + '18;color:' + GOLD + ';font-size:10px;font-weight:900">COPY CODE</button>' +
          '<button onclick="window.cdV2Copy(\'' + esc(link) + '\')" style="padding:7px 10px;border-radius:9px;border:1px solid ' + CYAN + '66;background:' + CYAN + '18;color:' + CYAN + ';font-size:10px;font-weight:900">COPY LINK</button>' +
          '<a href="https://wa.me/?text=' + shareTxt + '" target="_blank" style="padding:7px 10px;border-radius:9px;border:1px solid ' + GREEN + '66;background:' + GREEN + '18;color:' + GREEN + ';font-size:10px;font-weight:900;text-decoration:none">WHATSAPP SHARE</a></div></div></div>' +
          '<div style="font-size:9.5px;color:var(--txt2);line-height:1.6;border-top:1px solid rgba(255,255,255,.08);padding-top:8px">⚖️ <b>Disclosure zaroori:</b> promote karte waqt batayo ki "mere code se mujhe commission milta hai". Rates: host 15/20/25% (rating tier), referral 10/12/15%, mentor 20%, ads per-watch. Hold 7–30 din; refund par reversal. Koi retroactive change nahi.</div>') +
        '</div>' +
        '<div style="text-align:center;font-size:9px;color:var(--txt2);margin-top:10px">auto-refresh 60s · last update ' + new Date().toLocaleTimeString() + '</div>';
    });
  }

  window.showCreatorDashboard = function () {
    var uid = ME(); if (!uid) { if (window.toast) toast('Login karo', 'err'); return; }
    openModal(' Creator Studio', '<div id="cdV2Body"></div>');
    render(uid);
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = setInterval(function () { if (document.getElementById('cdV2Body')) render(uid); else clearInterval(_refreshTimer); }, 60000);
  };
  window.showCreatorEarnings = window.showCreatorDashboard;
  window.cdV2Copy = function (t) { try { navigator.clipboard.writeText(t); if (window.toast) toast('Copy ho gaya ✅', 'ok'); } catch (e) { if (window.toast) toast('Copy fail', 'err'); } };
  window.cdV2Payout = function () {
    if (!window._supa) return;
    var uid = ME();
    window._supa.rpc('claim_match_commission_payout').then(function (res) {
      var d = res && res.data; var ok = res && !res.error && d && d.ok !== false;
      if (window.toast) toast(ok ? ('Payout request ho gayi: ' + inr(d && d.amount)) : ('Payout fail: ' + ((d && d.msg) || (res && res.error && res.error.message) || 'unknown')), ok ? 'ok' : 'err');
      render(uid);
    });
  };
})();
