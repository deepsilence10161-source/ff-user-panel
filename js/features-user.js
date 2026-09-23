/* ====================================================
   MINI ESPORTS — USER FEATURES v9
   Halal Only | Teammate Auto-Join Fixed | 50 Features
   ==================================================== */
(function () {
  'use strict';
  /* FIX: Use getter so db/auth always fresh */
  function _db() { return window.db; }
  function _auth() { return window.auth; }
  var db = { ref: function(p) { return window.db ? window.db.ref(p) : { on:function(){}, once:function(){}, set:function(){}, update:function(){}, push:function(){ return {key:null}; }, transaction:function(){} }; } };
  var auth = window.auth;
  function _$(id) { return document.getElementById(id); }
  function _toast(m, t) { if (window.toast) toast(m, t || 'ok'); else console.log(m); }
  function _getU() { return window.U; }
  function _getUD() { return window.UD; }
  function _safeUid() { var u = window.U; if (!u) { _toast('Please login first', 'err'); return null; } return u.uid; }

  /* =========================================================
     ✅ KEPT FEATURES (Halal — 22 from original)
     ========================================================= */
  /* ==== R24 RESTORE (feature-restore — NOT dead) ====
     ये सात features पहले गलत-'dead-code' मानकर हट गए थे (d3614a3),
     पर इनके बटन/कॉल आज भी UI में जिंदा हैं — वापस जोड़े गए।
     ==== */

window.showTransactionSummary = function() {
    var WH = window.WH || [];
    var deps = WH.filter(function(w){ return w.type==='deposit' && (w.status==='approved'||w.status==='done'); });
    var wds = WH.filter(function(w){ return w.type==='withdraw' && (w.status==='approved'||w.status==='done'); });
    var totalDep = deps.reduce(function(s,w){ return s+(w.amount||0); }, 0);
    var totalWd = wds.reduce(function(s,w){ return s+(w.amount||0); }, 0);
    var UD = window.UD; var win = Math.max(Number(UD && UD.sponsored_winnings) || 0, 0);
    /* R28j: pehle UD.realMoney.winnings (jise listeners.js greenDiamonds
       alias karta tha) ₹ ki tarah dikhta tha — ab sponsored_winnings se
       सच्चा withdrawable prize balance. */
    var h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    [
      { l: '💰 Total Deposited', v: '₹'+totalDep, c: 'var(--blue)' },
      { l: '🏆 Total Winnings', v: '₹'+win, c: 'var(--green)' },
      { l: '📤 Total Withdrawn', v: '₹'+totalWd, c: '#ffaa00' },
      { l: '📊 Net Position', v: '₹'+(totalDep+win-totalWd), c: (totalDep+win-totalWd >= 0 ? 'var(--green)' : '#ff6b6b') }
    ].forEach(function(item) {
      h += '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">';
      h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:6px">' + item.l + '</div>';
      h += '<div style="font-size:20px;font-weight:900;color:' + item.c + '">' + item.v + '</div></div>';
    });
    h += '</div>';
    if (window.openModal) openModal('Transaction Summary', h);
  };

window.copyMyFFUID = function() { var UD = window.UD; if (!UD || !UD.ffUid) { _toast('FF UID not set!', 'err'); return; } window.copyTxt && copyTxt(UD.ffUid); _toast('FF UID copied: ' + UD.ffUid, 'ok'); };

window.getDeviceFingerprint = function() {
    var nav = window.navigator;
    var screen = window.screen;
    var fp = [
      nav.userAgent, nav.language, nav.platform,
      screen.width + 'x' + screen.height, screen.colorDepth,
      nav.hardwareConcurrency || '', nav.deviceMemory || '',
      new Date().getTimezoneOffset()
    ].join('|');
    // Simple hash
    var hash = 0;
    for (var i = 0; i < fp.length; i++) { hash = ((hash << 5) - hash) + fp.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  };

window.registerDeviceFingerprint = function() {
    var db = window.db; var U = window.U; if (!db || !U) return;
    var fp = window.getDeviceFingerprint();
    db.ref('deviceFingerprints/' + fp).once('value', function(s) {
      var existing = s.val();
      if (existing && existing.uid !== U.uid) {
        // Another account on same device - flag it
        db.ref('users/' + U.uid + '/multiAccountFlag').set(true);
        db.ref('users/' + U.uid + '/flaggedDevice').set(fp);
      } else {
        db.ref('deviceFingerprints/' + fp).set({ uid: U.uid, lastSeen: Date.now() });
        db.ref('users/' + U.uid + '/deviceFp').set(fp);
      }
    });
  };

window.checkInstantRefunds = function() {
    var JR = window.JR || {}, MT = window.MT || {}, U = window.U;
    if (!window._supa || !U) return;
    for (var k in JR) {
      var jr = JR[k]; if (jr.refunded || jr.isTeamMember) continue;
      var t = MT[jr.matchId]; if (!t) continue;
      var st = (t.status||'').toLowerCase();
      if (st === 'cancelled' || st === 'canceled') {
        (function(joinId, matchName) {
          window._supa.rpc('claim_match_refund', { p_join_id: joinId })
            .then(function(res) {
              var d = res && res.data;
              if (!d || !d.success) return;
              if (window.UD) {
                if (d.currency === 'coins') { window.UD.coins = (window.UD.coins || 0) + d.refunded; }
                else { window.UD.sky_diamonds = (window.UD.sky_diamonds || 0) + d.refunded; }
                if (window.updateHdr) window.updateHdr();
              }
              JR[joinId].refunded = true;
              _toast('⚡ Instant Refund! 💎' + d.refunded + ' wapas mil gaya — ' + matchName + ' cancelled', 'ok');
            }, function(){});
        })(k, t.name || 'Match');
      }
    }
  };

window.showReportPlayer = function(matchId, reportedUid, reportedName) {
    var h = '<div style="padding:4px">';
    h += '<div style="font-size:13px;font-weight:700;margin-bottom:12px">👤 Reporting: ' + (reportedName||'Player') + '</div>';
    h += '<div class="f-group"><label>Report Type</label><select class="f-input" id="repType"><option value="cheating">🎮 Cheating / Hack</option><option value="abuse">🤬 Abusive Language</option><option value="afk">🚶 AFK / Not Playing</option><option value="wrong_slot">📍 Wrong Slot</option><option value="result_dispute">⚔️ Result Dispute</option><option value="other">❓ Other</option></select></div>';
    h += '<div class="f-group"><label>Description</label><textarea class="f-input" id="repDesc" placeholder="Kya hua explain karo..." rows="3"></textarea></div>';
    h += '<div class="f-group"><label>Proof Screenshot (optional)</label><input type="file" accept="image/*" id="repProofFile" class="f-input" onchange="window._repProof=null;var r=new FileReader();r.onload=function(e){window._repProof=e.target.result;};r.readAsDataURL(this.files[0])"></div>';
    h += '<button onclick="window.submitReport(\'' + matchId + '\',\'' + (reportedUid||'') + '\')" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ff4500,#ff8c00);color:#fff;border:none;font-weight:800;font-size:14px;cursor:pointer;margin-top:8px"><i class="fas fa-flag"></i> Submit Report</button>';
    h += '</div>';
    if (window.openModal) openModal('🚩 Report Player', h);
  };

window.submitReport = function(matchId, reportedUid) {
    var U = window.U; var UD = window.UD; if (!U) return;
    var type = (document.getElementById('repType')||{}).value || 'other';
    var desc = (document.getElementById('repDesc')||{}).value || '';
    if (!desc.trim()) { _toast('Description likhna zaroori hai', 'err'); return; }
    var _doInsert = function(proofUrl) {
      var payload = {
        reporter_id: U.uid, reported_id: reportedUid || null,
        match_id: matchId, type: type, description: desc.trim(),
        proof_url: proofUrl || null, status: 'open'
      };
      if (window._supa) {
        window._supa.from('reports').insert(payload)
          .then(function() { window._repProof = null; _toast('✅ Report submitted!'); if (window.closeModal) closeModal(); })
          .catch(function() { _toast('Submit nahi hua, dobara try karo', 'err'); });
      } else if (window.db) {
        db.ref('reports').push(Object.assign({ createdAt: Date.now() }, payload));
        window._repProof = null; _toast('✅ Report submitted!'); if (window.closeModal) closeModal();
      }
    };
    /* Upload proof screenshot if present */
    if (window._repProof && window.uploadToImgBBBase64) {
      uploadToImgBBBase64(window._repProof, 'report_proof_' + U.uid + '_' + Date.now(), function(err, url) {
        _doInsert(url || null);
      });
    } else {
      _doInsert(null);
    }
  };

window.shareToInstagram = function(matchId) {
    var MT = window.MT || {}; var t = MT[matchId]; if (!t) return;
    /* R28j (2026-09-22): stale host (student-4356.github.io) + false
       cash-claim copy hatao. Prize ab entryType ke hisaab se dikhta hai
       (coin → 🪙, else 💎 Sky Diamonds) — user ki policy: bina-cheez
       ka ₹ claim nahi. URL canonical window.APP_URL / current origin. */
    var isCoin = (t.entryType || '').toString().toLowerCase() === 'coin';
    var prize = Math.max(Number(t.firstPrize || t.prize1st || 0), 0);
    var prizeTxt = isCoin ? ('🪙 ' + prize + ' Coins') : ('💎 ' + prize + ' Green Diamonds');
    var feeNum = Number(t.entryFee || 0);
    var feeTxt = feeNum > 0 ? (isCoin ? ('🪙 ' + feeNum) : ('💎 ' + feeNum)) : 'FREE';
    var base = (typeof window.APP_URL === 'string' && window.APP_URL) || (window.location.origin + '/');
    var joinUrl = base + '?join=' + matchId + '&ref=' + (((window.UD && (window.UD.ffUid || window.UD.referralCode))) || '');
    var text = '🎮 ' + (t.name||'Match') + '\n' +
      '🏆 1st Prize: ' + prizeTxt + '\n' +
      '🎟 Entry: ' + feeTxt + '\n' +
      '⚔️ ' + (t.mode||'solo').toUpperCase() + ' Mode\n' +
      '🔗 ' + base + '\n' +
      '#MiniESports #FreeFire';

    if (navigator.share) {
      navigator.share({ title: t.name||'Match', text: text, url: joinUrl })
        .catch(function(){});
    } else {
      // Copy and open Instagram
      navigator.clipboard && navigator.clipboard.writeText(text).then(function() {
        _toast('Caption copied! Instagram pe paste karo 📋', 'ok');
        setTimeout(function() { window.open('instagram://story-camera', '_blank'); }, 500);
      }).catch(function() { _toast('Copy failed', 'err'); });
    }
  };

window.applyDynamicWallpaper = function() {
    var UD = window.UD; if (!UD) return;
    var rk = window.calcRk ? window.calcRk(UD.stats||{}) : { badge:'Bronze', color:'#cd7f32' };
    var body = document.body;
    var existing = document.getElementById('_dynWallpaper');
    if (existing) existing.remove();
    var style = document.createElement('style');
    style.id = '_dynWallpaper';
    var colors = {
      'Diamond': ['#b964ff','#00d4ff','#ff00ff'],
      'Platinum': ['#00d4ff','#ffffff','#00ff9c'],
      'Gold': ['#ffd700','#ff8c00','#ffaa00'],
      'Silver': ['#c0c0c0','#ffffff','#aaaaaa'],
      'Bronze': ['#cd7f32','#8b4513','#a0522d']
    };
    var c = colors[rk.badge] || colors['Bronze'];
    style.textContent = '@keyframes wallpaperShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}';
    // Apply subtle gradient animation to app background
    var bg = document.getElementById('mainContent') || body;
    // Just update CSS var for subtle effect, don't break layout
    body.style.setProperty('--dyn-glow', c[0] + '15');
    if (body.getAttribute('data-theme') !== 'light') {
      document.documentElement.style.setProperty('--bg', '#050507');
      document.getElementById('homeList') && (document.getElementById('homeList').style.background = '');
    }
    document.head.appendChild(style);
  };


  /* ─── FEATURE 1: MATCH REMINDER (Browser Notification) ─── */
  window.setMatchReminder = function (matchId, matchTime, matchName) {
    if (!('Notification' in window)) { _toast('Browser notifications support nahi karta', 'err'); return; }
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { _toast('Notification permission do', 'err'); return; }
      var ms = Number(matchTime) - Date.now() - 600000;
      if (ms < 0) { _toast('Match jaldi shuru hoga!', 'inf'); return; }
      setTimeout(function () {
        new Notification('⚡ Match shuru hone wala hai!', {
          body: matchName + ' 10 minutes mein start hoga. Room ID ready rakho!',
          icon: '/favicon.ico'
        });
      }, ms);
      _toast('⏰ Reminder set! 10 min pehle notification aayega.', 'ok');
    });
  };

  /* ─── FEATURE 2: PROFILE COMPLETION % BAR ─── */
  window.getProfileCompletion = function () {
    var UD = window.UD; if (!UD) return 0;
    var fields = [
      { k: 'ign',          w: 35, label: 'Game Name (IGN)' },
      { k: 'ffUid',        w: 35, label: 'Free Fire UID' },
      { k: 'phone',        w: 20, label: 'WhatsApp Number' },
      { k: 'profileImage', w: 10, label: 'Profile Photo' }
    ];
    var total = 0;
    fields.forEach(function (f) { if (UD[f.k]) total += f.w; });
    return Math.min(total, 100);
  };
  window.getProfileMissingFields = function () {
    var UD = window.UD; if (!UD) return [];
    var fields = [
      { k: 'ign',          label: 'Game Name (IGN)' },
      { k: 'ffUid',        label: 'Free Fire UID' },
      { k: 'phone',        label: 'WhatsApp Number' },
      { k: 'profileImage', label: 'Profile Photo' }
    ];
    return fields.filter(function(f){ return !UD[f.k]; }).map(function(f){ return f.label; });
  };
  window.renderProfileCompletion = function () {
    var pct = window.getProfileCompletion();
    var missing = window.getProfileMissingFields ? window.getProfileMissingFields() : [];
    var color = pct >= 80 ? '#00ff9c' : pct >= 50 ? '#ffd700' : '#ff6b6b';
    var h = '<div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px 16px;margin-bottom:14px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    h += '<span style="font-size:13px;font-weight:700"><i class="fas fa-id-card" style="color:' + color + '"></i> Profile ' + pct + '% Complete</span>';
    if (pct < 100) h += '<span style="font-size:11px;color:var(--txt2)">Complete karo!</span>';
    h += '</div>';
    h += '<div style="height:6px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">';
    h += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,' + color + ',#00cc7a);border-radius:4px;transition:width .5s"></div></div>';
    if (missing.length > 0) {
      h += '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">';
      missing.forEach(function(m) {
        h += '<span style="font-size:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:2px 7px;color:#666">+ ' + m + '</span>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  };

  /* ─── FEATURE 3: HOT STREAK SYSTEM ─── */
  window.getStreakInfo = function () {
    var UD = window.UD; if (!UD || !UD.stats) return null;
    var wins = UD.stats.wins || 0, matches = UD.stats.matches || 0;
    if (wins >= 5) return { emoji: '🔥', label: wins + ' Win Streak!', color: '#ff6b6b' };
    if (wins >= 3) return { emoji: '⚡', label: '3+ Wins!', color: '#ffd700' };
    if (matches >= 10) return { emoji: '💪', label: 'Veteran Player', color: '#4d96ff' };
    return null;
  };

  /* ─── FEATURE 4: MATCH WATCHLIST / BOOKMARK ─── */
  var _watchlist = JSON.parse(localStorage.getItem('matchWatchlist') || '[]');
  window.toggleWatchlist = function (matchId) {
    var idx = _watchlist.indexOf(matchId);
    if (idx >= 0) { _watchlist.splice(idx, 1); _toast('Watchlist se hataya', 'inf'); }
    else { _watchlist.push(matchId); _toast('⭐ Watchlist mein add hua!'); }
    localStorage.setItem('matchWatchlist', JSON.stringify(_watchlist));
    if (window.renderHome) renderHome();
  };
  window.isWatchlisted = function (id) { return _watchlist.indexOf(id) >= 0; };


  /* ─── FEATURE 6: PLAYER STATS MINI CHART ─── */
  window.renderStatsChart = function () {
    var UD = window.UD; if (!UD || !UD.stats) return '';
    var st = UD.stats;
    var bars = [
      { label: 'Matches', val: st.matches || 0, max: 100, color: '#4d96ff' },
      { label: 'Wins', val: st.wins || 0, max: Math.max(st.matches || 1, 1), color: '#00ff9c' },
      { label: 'Kills', val: st.kills || 0, max: 200, color: '#ff6b6b' },
      { label: 'Earned', val: st.earnings || 0, max: 5000, color: '#ffd700' }
    ];
    var h = '<div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">';
    h += '<div style="font-size:13px;font-weight:700;margin-bottom:12px"><i class="fas fa-chart-bar" style="color:#4d96ff"></i> Stats Overview</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    bars.forEach(function (b) {
      var pct = Math.min(100, b.max > 0 ? (b.val / b.max * 100) : 0);
      h += '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:var(--txt2)">' + b.label + '</span><span style="font-weight:700;color:' + b.color + '">' + b.val + '</span></div>';
      h += '<div style="height:6px;background:rgba(255,255,255,.06);border-radius:3px"><div style="height:100%;width:' + pct + '%;background:' + b.color + ';border-radius:3px"></div></div></div>';
    });
    h += '</div>';
    var wr = st.matches > 0 ? Math.round((st.wins || 0) / st.matches * 100) : 0;
    h += '<div style="margin-top:10px;padding:8px;background:rgba(0,255,106,.06);border-radius:8px;text-align:center;font-size:12px">';
    h += '<span style="color:var(--txt2)">Win Rate: </span><strong style="color:var(--green)">' + wr + '%</strong> · ';
    h += '<span style="color:var(--txt2)">Avg Kill: </span><strong style="color:#ff6b6b">' + (st.matches > 0 ? ((st.kills || 0) / st.matches).toFixed(1) : 0) + '</strong></div>';
    h += '</div>';
    return h;
  };

  /* ─── FEATURE 7: PLAYER BIO / STATUS SETTER ─── */
  window.showSetBio = function () {
    var UD = window.UD;
    var h = '<div style="padding:8px">';
    h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:12px">Apna gaming status set karo (60 chars max)</div>';
    h += '<input type="text" id="bioInput" maxlength="60" placeholder="e.g. Headshots only 🎯" value="' + (window.escHtml?window.escHtml(UD.bio||''):(UD.bio||'').replace(/"/g,'&quot;')) + '" style="width:100%;padding:12px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:14px;box-sizing:border-box">';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">';
    ['Headshots only 🎯', 'Top Fragger 💀', 'Clutch King 👑', 'Rush or Die 🔥', 'Solo Carry 💪', 'Squad Goals 🤝'].forEach(function (s) {
      h += '<div onclick="document.getElementById(\'bioInput\').value=\'' + s + '\'" style="padding:8px;border-radius:8px;background:var(--card2);border:1px solid var(--border);font-size:11px;cursor:pointer;text-align:center">' + s + '</div>';
    });
    h += '</div>';
    h += '<button onclick="window._saveBio()" style="width:100%;margin-top:14px;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer;font-size:14px">Save Bio</button>';
    h += '</div>';
    if (window.showModal) showModal('✏️ Set Bio', h);
  };
  window._saveBio = function () {
    var val = (_$('bioInput') || {}).value || '';
    var uid = _safeUid(); if (!uid) return;
    db.ref('users/' + uid + '/bio').set(val);
    _toast('✅ Bio saved!');
    if (window.closeModal) closeModal();
    setTimeout(function () { if (window.renderProfile) renderProfile(); }, 500);
  };


  window._kpData = '';
  window._uploadKP = function (input) {
    var file = input.files[0]; if (!file) return;
    /* Bug #45 Fix: Validate file type before upload — reject non-images */
    if (!file.type.startsWith('image/')) {
      if (window._toast) _toast('Sirf image files allowed hain! (' + file.type + ')', 'err');
      input.value = '';
      return;
    }
    /* Also validate file size (max 10MB) */
    if (file.size > 10 * 1024 * 1024) {
      if (window._toast) _toast('File too large! Max 10MB allowed.', 'err');
      input.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      window._kpData = e.target.result;
      var img = _$('kpPreview'); if (img) { img.src = window._kpData; img.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
  };
  window._submitKP = function (mid) {
    if (!window._kpData) { _toast('Screenshot select karo!', 'err'); return; }
    var _doSave = function(screenshotUrl) {
      var payload = { match_id: mid, user_id: window.U ? window.U.uid : null, screenshot_url: screenshotUrl, kills_claimed: 0, status: 'pending' };
      if (window._supa) {
        window._supa.from('kill_proofs').insert(payload)
          .then(function() { _toast('✅ Kill proof submitted! Admin verify karega.'); window._kpData = ''; if (window.closeModal) closeModal(); })
          .catch(function() { _toast('Submit nahi hua', 'err'); });
      } else if (window.db) {
        db.ref('killProofs/' + (window.U ? window.U.uid : 'u') + '/' + mid).set(Object.assign({ createdAt: Date.now() }, payload));
        _toast('✅ Kill proof submitted!'); window._kpData = ''; if (window.closeModal) closeModal();
      }
    };
    if (window.uploadToImgBBBase64) {
      uploadToImgBBBase64(window._kpData, 'kp_' + (window.U ? window.U.uid : '') + '_' + mid, function(err, url) { _doSave(url || window._kpData); });
    } else { _doSave(window._kpData); }
  };

  /* ─── FEATURE 10: RESULT SHARE CARD (Canvas Download) ─── */
  window.shareResultCard = function (matchName, rank, kills, prize) {
    var UD = window.UD;
    var canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 220;
    var ctx = canvas.getContext('2d');
    var grd = ctx.createLinearGradient(0, 0, 400, 220);
    grd.addColorStop(0, '#0a0a0f'); grd.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 400, 220);
    ctx.fillStyle = '#00ff9c'; ctx.font = 'bold 22px Arial';
    ctx.fillText('Mini eSports', 20, 36);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial';
    ctx.fillText(matchName || 'Tournament Result', 20, 68);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 48px Arial';
    ctx.fillText('#' + (rank || 1), 20, 140);
    ctx.fillStyle = '#aaa'; ctx.font = '14px Arial'; ctx.fillText('Rank', 20, 160);
    ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 36px Arial';
    ctx.fillText((kills || 0) + '💀', 130, 140);
    ctx.fillStyle = '#aaa'; ctx.font = '14px Arial'; ctx.fillText('Kills', 130, 160);
    ctx.fillStyle = '#00ff9c'; ctx.font = 'bold 36px Arial';
    ctx.fillText('₹' + (prize || 0), 250, 140);
    ctx.fillStyle = '#aaa'; ctx.font = '14px Arial'; ctx.fillText('Won', 250, 160);
    ctx.fillStyle = '#555'; ctx.font = '12px Arial';
    ctx.fillText((UD ? UD.ign : '') + ' | ' + ((typeof window.APP_URL === 'string' && window.APP_URL) || (window.location.origin + '/')), 20, 200);
    var url = canvas.toDataURL();
    var a = document.createElement('a'); a.href = url; a.download = 'result-card.png'; a.click();
    _toast('🖼️ Result card download ho rahi hai!');
  };

  /* ─── FEATURE 11: SEASONAL CHAMPIONSHIP STATS ─── */
  window.showSeasonStats = function () {
    var uid = _safeUid(); if (!uid) return;
    db.ref('season').once('value', function (s) {
      var season = s.val() || { name: 'Season 1', endDate: null };
      db.ref('seasonStats/' + uid).once('value', function (ss) {
        var st = ss.val() || { points: 0 };
        var h = '<div style="padding:8px;text-align:center">';
        h += '<div style="font-size:24px;font-weight:900;color:var(--primary);margin-bottom:4px">' + (season.name || 'Season 1') + '</div>';
        h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:16px">Ek season mein sabse zyada points jito!</div>';
        h += '<div style="font-size:48px;font-weight:900;color:#ffd700">' + (st.points || 0) + '</div>';
        h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">Season Points</div>';
        h += '<div style="padding:12px;background:var(--card2);border-radius:12px;font-size:13px">';
        h += '🏆 Win = +50 pts &nbsp;|&nbsp; 💀 Kill = +5 pts &nbsp;|&nbsp; 🎮 Match = +10 pts</div>';
        if (season.endDate) h += '<div style="margin-top:10px;font-size:11px;color:var(--txt2)">Season ends: ' + new Date(season.endDate).toLocaleDateString() + '</div>';
        h += '</div>';
        if (window.showModal) showModal('🏆 Season Championship', h);
      });
    });
  };

  /* ─── FEATURE 12: MATCH LIVE FEED ─── */
  window.showMatchFeed = function (matchId) {
    db.ref('matchFeed/' + matchId).limitToLast(15).once('value', function (s) {
      var events = [];
      if (s.exists()) s.forEach(function (c) { events.unshift(c.val()); });
      var h = '<div style="padding:4px 0">';
      if (!events.length) h += '<div style="text-align:center;padding:30px;color:var(--txt2)">Live feed match start hone par dikhe ga</div>';
      events.forEach(function (e) {
        var icon = e.type === 'kill' ? '💀' : e.type === 'elim' ? '🔴' : '📢';
        h += '<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border)">';
        h += '<span style="font-size:18px">' + icon + '</span>';
        h += '<div><div style="font-size:13px;font-weight:600">' + (e.text || 'Event') + '</div>';
        h += '<div style="font-size:10px;color:var(--txt2)">' + new Date(e.ts || Date.now()).toLocaleTimeString() + '</div></div>';
        h += '</div>';
      });
      h += '</div>';
      if (window.showModal) showModal('📡 Live Feed', h);
    });
  };

  /* ─── FEATURE 13: ONBOARDING TUTORIAL (First Login) ─── */
  window.checkShowTutorial = function () {
    var uid = window.U && window.U.uid;
    var key = uid ? ('tutorialSeen_' + uid) : 'tutorialSeen';
    if (localStorage.getItem(key) || localStorage.getItem('tutorialSeen')) return;
    setTimeout(function () {
      var steps = [
        { title: '👋 Welcome to Mini eSports!', body: 'India ka best Free Fire tournament platform!' },
        { title: '🎮 Matches Join Karo', body: 'Home screen pe matches dekho, entry fee bharo aur join karo.' },
        { title: '💰 Wallet', body: 'UPI se Sky Diamonds add karo aur matches khelo. Jeetne par Coins, rank aur rewards milte hain — yeh ek skill-based platform hai, real-money prize nahi.' },
        { title: '👥 Team Mode', body: 'Profile mein Duo/Squad partner set karo aur saath khelo.' },
        { title: '🏆 Rank karo!', body: 'Matches jeeto, kills lo aur leaderboard pe aao. Good luck!' }
      ];
      var cur = 0;
      function showStep() {
        var s = steps[cur];
        var h = '<div style="text-align:center;padding:10px">';
        h += '<div style="font-size:48px;margin-bottom:12px">' + s.title.split(' ')[0] + '</div>';
        h += '<div style="font-size:18px;font-weight:800;margin-bottom:8px">' + s.title.slice(s.title.indexOf(' ') + 1) + '</div>';
        h += '<div style="font-size:14px;color:var(--txt2);margin-bottom:20px">' + s.body + '</div>';
        h += '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:14px">';
        steps.forEach(function (_, i) { h += '<div style="width:8px;height:8px;border-radius:50%;background:' + (i === cur ? 'var(--primary)' : 'rgba(255,255,255,.2)') + '"></div>'; });
        h += '</div>';
        if (cur < steps.length - 1) h += '<button onclick="window._tutNext()" style="width:100%;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer">Next →</button>';
        else h += '<button onclick="window._tutDone()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,var(--primary),#00cc7a);color:#000;font-weight:800;border:none;cursor:pointer">🎮 Let\'s Play!</button>';
        h += '</div>';
        if (window.showModal) showModal('', h);
      }
      window._tutNext = function () { cur++; showStep(); };
      window._tutDone = function () {
        /* ✅ Audit Fix: reuse the SAME key computed at check-time (closure
           variable), and always also set the generic fallback key. Previously
           this recomputed the key from window.U.uid at completion time —
           if auth resolved in the gap between check and completion, the key
           used here could differ from the one checked next load, and only
           one key (not both) was ever set, so the tutorial could reappear. */
        localStorage.setItem(key, '1');
        localStorage.setItem('tutorialSeen', '1');
        if (window.closeModal) closeModal();
      };
      showStep();
    }, 1500);
  };


  /* ─── FEATURE 15: WALLET STATISTICS PANEL ─── */
  window.renderWalletStats = function () {
    var UD = window.UD; if (!UD) return '';
    var wh = window.WH || [];
    var deps = wh.filter(function (w) { return w.type === 'deposit' && (w.status === 'approved' || w.status === 'done'); });
    var wds = wh.filter(function (w) { return w.type === 'withdraw' && (w.status === 'approved' || w.status === 'done'); });
    var totalDep = deps.reduce(function (s, w) { return s + (w.amount || 0); }, 0);
    var totalWd = wds.reduce(function (s, w) { return s + (w.amount || 0); }, 0);
    /* ✅ BUG FIX (2026-08-22): "Winning box me ₹35 dikh raha hai jabki wo
       rupees nahi Green Diamond hain". Root cause: UD.realMoney.winnings
       is set in listeners.js as a plain ALIAS for UD.greenDiamonds
       (`realMoney: {..., winnings: UD.greenDiamonds, ...}`) — it was
       never real currency to begin with, it's an internal name reused
       from an earlier Firebase-only architecture. This card then
       rendered that number with a ₹ prefix, showing Green Diamonds
       (a non-withdrawable, match-win-only badge currency per the
       Green Diamond info card on the same screen) as if it were rupees.
       Fixed: this card now uses UD.sponsored_winnings — the actual
       real-money sponsor-tournament prize balance, which is already the
       field the "Sponsored Prize" withdrawal card on this same screen
       correctly formats as ₹. Same currency semantics, both places. */
    var realWinnings = Math.max(Number(UD.sponsored_winnings) || 0, 0);
    var h = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">';
    [['📥 Deposits', deps.length, 'Total: ₹' + totalDep], ['📤 Withdrawals', wds.length, 'Total: ₹' + totalWd], ['🏆 Winnings', '₹' + realWinnings, 'Earned']].forEach(function (d) {
      h += '<div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:11px;color:var(--txt2);margin-bottom:4px">' + d[0] + '</div><div style="font-size:18px;font-weight:800">' + d[1] + '</div><div style="font-size:10px;color:var(--txt2)">' + d[2] + '</div></div>';
    });
    h += '</div>';
    return h;
  };

  /* ─── FEATURE 16: PARTNER RATING SYSTEM ─── */
  window.ratePartner = function (partnerUid, matchId) {
    var h = '<div style="padding:8px;text-align:center">';
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:16px">Partner ko rate karo</div>';
    h += '<div id="starRating" style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">';
    for (var i = 1; i <= 5; i++) {
      h += '<span onclick="window._setStar(' + i + ')" style="font-size:36px;cursor:pointer" data-star="' + i + '">⭐</span>';
    }
    h += '</div>';
    h += '<textarea id="rateNote" placeholder="Optional feedback..." style="width:100%;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;resize:none;height:70px;box-sizing:border-box"></textarea>';
    h += '<button onclick="window._submitRating(\'' + partnerUid + '\',\'' + matchId + '\')" style="width:100%;margin-top:12px;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer">Submit Rating</button>';
    h += '</div>';
    window._starVal = 5;
    if (window.showModal) showModal('⭐ Rate Partner', h);
  };
  window._setStar = function (n) {
    window._starVal = n;
    document.querySelectorAll('[data-star]').forEach(function (el) { el.style.opacity = parseInt(el.dataset.star) <= n ? '1' : '0.3'; });
  };
  window._submitRating = function (uid, mid) {
    db.ref('partnerRatings/' + uid + '/' + mid).set({
      rating: window._starVal || 5, note: (_$('rateNote') || {}).value || '',
      raterUid: window.U.uid, matchId: mid, createdAt: Date.now()
    });
    db.ref('users/' + uid + '/avgRating').transaction(function (v) { return ((v || 5) * 0.8 + (window._starVal || 5) * 0.2); });
    _toast('✅ Rating submit hua!');
    if (window.closeModal) closeModal();
  };

  /* ─── FEATURE 17: PUSH NOTIFICATION ENABLE ─── */
  ;

  /* ─── FEATURE 18: ACHIEVEMENT GALLERY ─── */
  /* Bug #21 Fix: If ui-fixes.js already loaded a newer showAchievements, skip this old version.
   Order of load: features-user.js loads first → ui-fixes.js overrides properly.
   This guard prevents the reverse — if called again after ui-fixes.js is loaded. */

  /* Also expose for Profile renderAchievementsHTML */
  window.renderAchievementsHTML = function () {
    var UD = window.UD; if (!UD) return '';
    var st = UD.stats || {};
    var list = [
      { title: 'First Blood', earned: (st.wins || 0) >= 1, icon: '🩸' },
      { title: 'High Flyer', earned: (st.wins || 0) >= 5, icon: '🚀' },
      { title: 'Kill Machine', earned: (st.kills || 0) >= 50, icon: '💀' },
      { title: 'Money Maker', earned: (st.earnings || 0) >= 100, icon: '💰' },
      { title: 'Veteran', earned: (st.matches || 0) >= 25, icon: '🎖️' },
      { title: 'Influencer', earned: (UD.referralCount || 0) >= 5, icon: '🌟' },
    ];
    var earned = list.filter(function (a) { return a.earned; }).length;
    var h = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
    list.forEach(function (a) {
      h += '<div title="' + a.title + '" style="width:36px;height:36px;border-radius:10px;background:' + (a.earned ? 'rgba(0,255,156,.12)' : 'rgba(255,255,255,.04)') + ';border:1px solid ' + (a.earned ? 'rgba(0,255,156,.3)' : 'var(--border)') + ';display:flex;align-items:center;justify-content:center;font-size:18px;opacity:' + (a.earned ? '1' : '.3') + '">' + a.icon + '</div>';
    });
    h += '</div>';
    h += '<div style="font-size:11px;color:var(--green)">' + earned + '/' + list.length + ' achievements unlocked</div>';
    h += '<button onclick="window.showAchievements()" style="margin-top:8px;padding:8px 14px;border-radius:10px;background:rgba(0,255,156,.1);color:var(--green);border:1px solid rgba(0,255,156,.2);font-size:12px;font-weight:700;cursor:pointer">View All</button>';
    return h;
  };

  /* ─── FEATURE 19: SMART MATCH RECOMMENDATION ─── */
  window.getRecommendedMatch = function () {
    var UD = window.UD, MT = window.MT; if (!UD || !MT) return null;
    var dep = (UD.realMoney && UD.realMoney.deposited) ? Number(UD.realMoney.deposited) : 0;
    var budget = dep > 0 ? Math.min(dep * 0.1, 100) : 10;
    var best = null, bestScore = -1;
    var tp = UD.duoTeam ? 'duo' : 'solo';
    Object.values(MT).forEach(function (t) {
      if (!t || !t.id) return;
      if (window.hasJ && hasJ(t.id)) return;
      var fee = Number(t.entryFee) || 0;
      if (fee > budget) return;
      var slots = Number(t.joinedSlots || 0), max = Number(t.maxSlots || 1);
      if (slots >= max) return;
      var score = (t.prizePool || 0) - fee * 2 + ((slots / max) > 0.3 ? 10 : 0);
      if ((t.mode || t.type || '').toLowerCase() === tp) score += 20;
      if (score > bestScore) { bestScore = score; best = t; }
    });
    return best;
  };

  /* ─── FEATURE 20: MATCH ALERT SYSTEM ─── */
  window.setupMatchAlerts = function () {
    if (!window.MT || !window.db) return;
    Object.keys(window.MT).forEach(function (mid) {
      var t = window.MT[mid]; if (!t.matchTime) return;
      var ms = Number(t.matchTime) - Date.now() - 300000;
      if (ms > 0 && ms < 3600000) {
        setTimeout(function () {
          if (window.JR) {
            for (var k in window.JR) {
              if (window.JR[k].matchId === mid) {
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('⚡ Match Starting!', { body: (t.name || 'Your match') + ' 5 minutes mein start hoga!' });
                }
                break;
              }
            }
          }
        }, ms);
      }
    });
  };

  /* ─── FEATURE 21: PROFILE CARD GENERATOR ─── */
  window.generateProfileCard = function () {
    var UD = window.UD; if (!UD) return;
    var st = UD.stats || {};
    var canvas = document.createElement('canvas');
    canvas.width = 380; canvas.height = 200;
    var ctx = canvas.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 380, 200);
    g.addColorStop(0, '#0d0d18'); g.addColorStop(1, '#1a1040');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 380, 200);
    ctx.strokeStyle = '#00ff9c55'; ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 364, 184);
    ctx.fillStyle = '#00ff9c'; ctx.font = 'bold 14px Arial';
    ctx.fillText('MINI ESPORTS', 20, 35);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial';
    ctx.fillText(UD.ign || 'Player', 20, 70);
    ctx.fillStyle = '#aaa'; ctx.font = '12px Arial';
    ctx.fillText('FF UID: ' + (UD.ffUid || '—'), 20, 90);
    var stats = [['Matches', st.matches || 0], ['Wins', st.wins || 0], ['Kills', st.kills || 0], ['Earned', '₹' + (st.earnings || 0)]];
    stats.forEach(function (s, i) {
      var x = 20 + i * 90;
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 18px Arial';
      ctx.fillText(s[1], x, 135);
      ctx.fillStyle = '#888'; ctx.font = '11px Arial';
      ctx.fillText(s[0], x, 152);
    });
    ctx.fillStyle = '#444'; ctx.font = '10px Arial';
    ctx.fillText((typeof window.APP_URL === 'string' && window.APP_URL) || (window.location.origin + '/'), 20, 185);
    var url = canvas.toDataURL();
    var a = document.createElement('a'); a.href = url; a.download = 'player-card.png'; a.click();
    _toast('🎴 Player card downloaded!');
  };

  /* ─── FEATURE 22: MATCH COUNTDOWN TIMER (per card) ─── */
  /* NOTE: startMatchTimers is defined in js/match-timer.js — we only set it here
     if that file hasn't loaded yet (load-order safety guard) */
  if (!window.startMatchTimers) {
    window.startMatchTimers = function () {
      clearInterval(window._timerInterval);
      window._timerInterval = setInterval(function () {
        var MT = window.MT || {};
        Object.keys(MT).forEach(function (mid) {
          var t = MT[mid]; if (!t || !t.matchTime) return;
          var el = document.getElementById('timer-' + mid); if (!el) return;
          var diff = Number(t.matchTime) - Date.now();
          if (diff <= 0) { el.textContent = ''; return; }
          if (diff > 86400000) { el.textContent = ''; return; }
          var h = Math.floor(diff / 3600000);
          var m = Math.floor((diff % 3600000) / 60000);
          var s = Math.floor((diff % 60000) / 1000);
          el.textContent = '⏱ ' + (h > 0 ? h + 'h ' : '') + m + 'm ' + s + 's';
        });
      }, 1000);
    };
  }

  /* =========================================================
     🆕 NEW FEATURES (28 New — Total 50)
     ========================================================= */

  /* ─── NEW FEATURE 23: TEAMMATE AUTO-JOIN SYSTEM (FIXED & COMPLETE) ─── */
  /* When captain joins, ALL teammates automatically get:
     1. joinRequest entry (status: joined, isTeamMember: true)
     2. My Matches mein dikhe
     3. Room ID notification
     4. Stats/matches increment
     5. Admin panel mein unka entry dike
     6. Real-time notification to teammate's device
  */
  window.processTeammateJoins = function (matchId, teamMembers, captainName, matchName, isCoin, tp) {
    /* ✅ R5 (2026-09-23): CLIENT-SIDE TEAM-ROW BUILDER RETIRED — pehle ye
       Firebase-only partner joinRequests banata tha (Supabase authority se
       alag). Ab team join server join_match_team RPC se atomic banta hai
       (screens/join.js). Ye stub callers ke liye inert rakha hai — koi
       Firebase join-authority write nahi karta. */
    return;
  };

  function _createTeammateJR(pFirebaseUid, pData, matchId, matchName, isCoin, mode, allMembers, captainName, captainFirebaseUid) {
    if (!pFirebaseUid || pFirebaseUid === captainFirebaseUid) return;
    // Check if already has joinRequest for this match
    db.ref('joinRequests').orderByChild('userId').equalTo(pFirebaseUid).once('value', function (s) {
      var alreadyJoined = false;
      if (s.exists()) s.forEach(function (c) { if (c.val().matchId === matchId) alreadyJoined = true; });
      if (alreadyJoined) return;

      // Create joinRequest
      var pjid = db.ref('joinRequests').push().key;
      db.ref('joinRequests/' + pjid).set({
        requestId: pjid,
        userId: pFirebaseUid,
        userName: pData.ign || pData.displayName || '',
        userFFUID: pData.ffUid || '',
        displayName: pData.displayName || '',
        userEmail: pData.email || '',
        matchId: matchId,
        matchName: matchName || '',
        entryFee: 0,         // Teammate pays nothing
        entryType: isCoin ? 'coin' : 'money',
        mode: mode,
        status: 'joined',
        slotsBooked: 0,
        isTeamMember: true,
        captainUid: captainFirebaseUid,
        captainName: captainName || '',
        teamMembers: allMembers,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });

      // Increment stats
      db.ref('users/' + pFirebaseUid + '/stats/matches').transaction(function (m) { return (m || 0) + 1; });

      // Send notification to teammate
      var nid = db.ref('users/' + pFirebaseUid + '/notifications').push().key;
      db.ref('users/' + pFirebaseUid + '/notifications/' + nid).set({
        type: 'team_joined',
        title: '🎮 Team Match Joined!',
        body: captainName + ' ne "' + matchName + '" join kiya — tum bhi team mein automatically ho! My Matches mein dekho.',
        matchId: matchId,
        matchName: matchName,
        faIcon: 'fa-users',
        read: false,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });

      console.log('[Mini eSports] ✅ Teammate joinRequest created for: ' + (pData.ign || pFirebaseUid));
    });
  }

  /* ─── NEW FEATURE 24: MATCH HISTORY DETAILED VIEW ─── */
  window.showMatchHistory = function () {
    var uid = _safeUid(); if (!uid) return;
    db.ref('joinRequests').orderByChild('userId').equalTo(uid).once('value', function (s) {
      var history = [];
      if (s.exists()) s.forEach(function (c) {
        var d = c.val();
        var t = window.MT && window.MT[d.matchId];
        history.push({ jr: d, match: t });
      });
      history.sort(function (a, b) { return (b.jr.createdAt || 0) - (a.jr.createdAt || 0); });
      var h = '<div style="display:flex;flex-direction:column;gap:8px">';
      if (!history.length) h += '<p style="text-align:center;color:var(--txt2);padding:30px">Koi match history nahi</p>';
      history.slice(0, 20).forEach(function (item) {
        var jr = item.jr, t = item.match;
        var isWin = jr.result && jr.result.won;
        var prize = jr.result ? (jr.result.prize || 0) : 0;
        h += '<div style="padding:12px;border-radius:12px;background:var(--card2);border:1px solid var(--border)">';
        var mid = jr.matchId || '';
        var matchT = window.MT && window.MT[mid];
        var isSpecial = matchT && (matchT.isSundaySpecial || matchT.isMonthlySpecial);
        var specialBadge = isSpecial && window.f29SpecialTournament ? window.f29SpecialTournament.getSpecialBadge(matchT) : '';
        h += '<div style="display:flex;justify-content:space-between;align-items:start">';
        h += '<div style="flex:1">';
        if (specialBadge) h += '<div style="margin-bottom:4px">' + specialBadge + '</div>';
        h += '<div style="font-size:13px;font-weight:700">' + (jr.matchName || 'Match') + '</div>';
        h += '<div style="font-size:11px;color:var(--txt2)">' + (jr.mode || 'solo').toUpperCase() + ' · ' + new Date(jr.createdAt || 0).toLocaleDateString() + '</div>';
        if (jr.isTeamMember) h += '<div style="font-size:10px;color:var(--purple)"><i class="fas fa-crown"></i> ' + (jr.captainName || 'Captain') + ' ki team</div>';
        if (jr.slotNumber) h += '<div style="font-size:10px;color:var(--blue)">Slot: ' + jr.slotNumber + '</div>';
        h += '</div>';
        h += '<div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px">';
        if (prize > 0) h += '<div style="font-size:14px;font-weight:800;color:var(--green)">+💎' + prize + '</div>';
        h += '<div style="font-size:11px;color:' + (isWin ? 'var(--green)' : 'var(--txt2)') + '">' + (isWin ? '🏆 Won' : '🎮 Played') + '</div>';
        if (jr.resultStatus === 'completed' && mid) h += '<button onclick="window.showResultScreenshot&&showResultScreenshot(\'' + mid + '\',\'' + (jr.matchName||'Match') + '\')" style="padding:3px 8px;border-radius:6px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.2);color:var(--blue);font-size:9px;font-weight:700;cursor:pointer"><i class="fas fa-image"></i> Result</button>';
        if (jr.cashbackGiven) h += '<div style="font-size:9px;color:#ffd700">🪙 Cashback Received</div>';
        h += '</div></div></div>';
      });
      h += '</div>';
      if (window.showModal) showModal('📋 Match History', h);
    });
  };


  /* ─── NEW FEATURE 26: IN-APP SUPPORT TICKET TRACKER ─── */
  window.showMyTickets = function () {
    var uid = _safeUid(); if (!uid) return;
    db.ref('supportRequests').orderByChild('userId').equalTo(uid).once('value', function (s) {
      var tickets = [];
      if (s.exists()) s.forEach(function (c) { tickets.push({ id: c.key, ...c.val() }); });
      tickets.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      var h = '<div style="display:flex;flex-direction:column;gap:8px">';
      if (!tickets.length) h += '<p style="text-align:center;color:var(--txt2);padding:30px">Koi ticket submit nahi hua</p>';
      tickets.forEach(function (t) {
        var stColor = t.status === 'resolved' ? 'var(--green)' : t.status === 'open' ? '#ffaa00' : 'var(--txt2)';
        var stLabel = t.status === 'resolved' ? '✅ Resolved' : '⏳ Open';
        h += '<div style="padding:12px;border-radius:12px;background:var(--card2);border:1px solid var(--border)">';
        h += '<div style="display:flex;justify-content:space-between;align-items:start">';
        h += '<div><div style="font-size:13px;font-weight:700">' + (t.type || 'Issue') + '</div>';
        h += '<div style="font-size:12px;color:var(--txt2);margin-top:4px">' + (t.message || '').substring(0, 60) + '...</div>';
        h += '<div style="font-size:10px;color:var(--txt2);margin-top:4px">' + new Date(t.createdAt || 0).toLocaleDateString() + '</div></div>';
        h += '<span style="font-size:11px;font-weight:700;color:' + stColor + '">' + stLabel + '</span>';
        h += '</div></div>';
      });
      h += '</div>';
      if (window.showModal) showModal('🎫 My Tickets', h);
    });
  };


  /* ─── NEW FEATURE 28: LIVE ROOM ID COUNTDOWN ─── */
  window.updateRoomCountdowns = function () {
    var MT = window.MT || {}, JR = window.JR || {};
    for (var k in JR) {
      var jr = JR[k]; if (!jr.matchId) continue;
      var t = MT[jr.matchId]; if (!t || !t.matchTime) continue;
      var el = document.getElementById('room-cd-' + jr.matchId); if (!el) continue;
      var diff = Number(t.matchTime) - Date.now();
      if (t.roomStatus === 'released') {
        el.innerHTML = '<span style="color:var(--green);font-size:11px"><i class="fas fa-key"></i> Room ID Released!</span>';
      } else if (diff > 0) {
        var h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
        el.textContent = '🔑 Room ID in: ' + h + 'h ' + m + 'm';
      }
    }
  };
  setInterval(window.updateRoomCountdowns, 60000);


  /* ─── NEW FEATURE 30: PLAYER COMPARISON (vs Friend) ─── */
  window.showPlayerComparison = function () {
    var h = '<div style="padding:8px">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:12px">⚔️ Compare with Player</div>';
    h += '<input type="text" id="cmpUid" placeholder="Enter FF UID to compare" style="width:100%;padding:12px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;box-sizing:border-box;margin-bottom:10px">';
    h += '<button onclick="window._doCompare()" style="width:100%;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer">Compare</button>';
    h += '</div>';
    if (window.showModal) showModal('⚔️ Player Compare', h);
  };
  window._doCompare = function () {
    var uid = (_$('cmpUid') || {}).value; if (!uid) return;
    db.ref('users').orderByChild('ffUid').equalTo(uid.trim()).once('value', function (s) {
      if (!s.exists()) { _toast('Player nahi mila', 'err'); return; }
      var other = null; s.forEach(function (c) { other = c.val(); });
      var me = window.UD; var st1 = me.stats || {}, st2 = other.stats || {};
      var rows = [['Matches', st1.matches || 0, st2.matches || 0], ['Wins', st1.wins || 0, st2.wins || 0], ['Kills', st1.kills || 0, st2.kills || 0], ['Earnings', '₹' + (st1.earnings || 0), '₹' + (st2.earnings || 0)]];
      var h = '<div>';
      h += '<div style="display:grid;grid-template-columns:1fr 60px 1fr;gap:0;margin-bottom:14px">';
      h += '<div style="text-align:center;padding:12px;background:rgba(0,255,156,.06);border-radius:12px 0 0 12px"><div style="font-size:18px;font-weight:900;color:var(--green)">' + (window.escHtml?window.escHtml(me.ign||'You'):(me.ign||'You')) + '</div><div style="font-size:10px;color:var(--txt2)">You</div></div>';
      h += '<div style="display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;background:var(--card2)">VS</div>';
      h += '<div style="text-align:center;padding:12px;background:rgba(255,107,107,.06);border-radius:0 12px 12px 0"><div style="font-size:18px;font-weight:900;color:#ff6b6b">' + (window.escHtml?window.escHtml(other.ign||'Player'):(other.ign||'Player')) + '</div><div style="font-size:10px;color:var(--txt2)">Opponent</div></div>';
      h += '</div>';
      rows.forEach(function (r) {
        var myWin = typeof r[1] === 'number' && typeof r[2] === 'number' && r[1] > r[2];
        h += '<div style="display:grid;grid-template-columns:1fr 80px 1fr;gap:0;border-bottom:1px solid var(--border);padding:8px 0">';
        h += '<div style="text-align:center;font-size:14px;font-weight:' + (myWin ? '900' : '400') + ';color:' + (myWin ? 'var(--green)' : 'var(--txt)') + '">' + r[1] + '</div>';
        h += '<div style="text-align:center;font-size:11px;color:var(--txt2)">' + r[0] + '</div>';
        h += '<div style="text-align:center;font-size:14px;font-weight:' + (!myWin ? '900' : '400') + ';color:' + (!myWin ? '#ff6b6b' : 'var(--txt)') + '">' + r[2] + '</div>';
        h += '</div>';
      });
      h += '</div>';
      if (window.showModal) showModal('⚔️ Comparison', h);
    });
  };


  /* ─── NEW FEATURE 32: RESULT DISPUTE FORM ─── */
  var _dispScreenshotB64 = null;
  window.showResultDispute = function (matchId) {
    _dispScreenshotB64 = null;
    var h = '<div style="padding:8px">';
    h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:12px">Galat result ke against complaint submit karo</div>';
    h += '<div style="margin-bottom:10px"><label style="font-size:12px;color:var(--txt2);display:block;margin-bottom:4px">Issue Type</label>';
    h += '<select id="dispType" style="width:100%;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px">';
    h += '<option value="wrong_rank">Wrong Rank Given</option><option value="missing_kills">Kills Count Wrong</option><option value="not_credited">Prize Not Credited</option><option value="other">Other Issue</option>';
    h += '</select></div>';
    h += '<div style="margin-bottom:10px"><label style="font-size:12px;color:var(--txt2);display:block;margin-bottom:4px">Your Actual Rank</label>';
    h += '<input type="number" id="dispRank" placeholder="e.g. 1" style="width:100%;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;box-sizing:border-box"></div>';
    h += '<div style="margin-bottom:10px"><label style="font-size:12px;color:var(--txt2);display:block;margin-bottom:4px">Screenshot (optional)</label>';
    h += '<div onclick="document.getElementById(\'dispSsIn\').click()" id="dispSsBox" style="width:100%;padding:14px;border-radius:10px;background:var(--card2);border:2px dashed var(--border);color:var(--txt2);font-size:12px;text-align:center;cursor:pointer;box-sizing:border-box"><i class=\"fas fa-camera\" style=\"margin-right:6px\"></i>Tap to upload screenshot</div>';
    h += '<input type="file" id="dispSsIn" accept="image/*" style="display:none" onchange="window._dispLoadSS(this)">';
    h += '<div id="dispSsPreview" style="display:none;margin-top:6px;text-align:center"><img id="dispSsImg" style="max-width:100%;max-height:150px;border-radius:8px;border:1px solid var(--border)"></div>';
    h += '</div>';
    h += '<div style="margin-bottom:10px"><label style="font-size:12px;color:var(--txt2);display:block;margin-bottom:4px">Explanation</label>';
    h += '<textarea id="dispMsg" style="width:100%;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;resize:none;height:70px;box-sizing:border-box" placeholder="Details likhiyo..."></textarea></div>';
    h += '<button onclick="window._submitDispute(\'' + matchId + '\')" style="width:100%;padding:12px;border-radius:12px;background:#ff6b6b;color:#fff;font-weight:800;border:none;cursor:pointer"><i class=\"fas fa-paper-plane\" style=\"margin-right:6px\"></i>Submit Dispute</button>';
    h += '</div>';
    if (window.showModal) showModal('⚠️ Report Dispute', h);
  };
  window._dispLoadSS = function(inp) {
    var file = inp.files[0]; if(!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      _dispScreenshotB64 = e.target.result;
      var prev = document.getElementById('dispSsPreview'), img = document.getElementById('dispSsImg'), box = document.getElementById('dispSsBox');
      if(img) img.src = _dispScreenshotB64;
      if(prev) prev.style.display = 'block';
      if(box) box.innerHTML = '<i class="fas fa-check-circle" style="color:var(--green);margin-right:6px"></i>Screenshot added ✓';
    };
    reader.readAsDataURL(file);
  };
  window._submitDispute = function (matchId) {
    var type = (_$('dispType') || {}).value;
    var rank = (_$('dispRank') || {}).value;
    var msg = (_$('dispMsg') || {}).value;
    if (!msg || msg.trim().length < 10) { _toast('Thoda detail mein likhiyo', 'err'); return; }
    var payload = {
      match_id: matchId, user_id: window.U ? window.U.uid : null,
      type: type, claimed_rank: rank ? Number(rank) : null,
      message: msg.trim(), screenshot_url: _dispScreenshotB64 || null,
      status: 'open'
    };
    /* ✅ Save to Supabase disputes table */
    if (window._supa) {
      window._supa.from('disputes').insert(payload)
        .then(function() { _toast('✅ Dispute submitted! Admin review karega.'); if (window.closeModal) closeModal(); })
        .catch(function() {
          /* Fallback to Firebase RTDB */
          if (window.db) { var id = db.ref('disputes').push().key; db.ref('disputes/' + id).set(Object.assign({ id: id, createdAt: Date.now() }, payload)); }
          _toast('✅ Dispute submitted!'); if (window.closeModal) closeModal();
        });
    } else if (window.db) {
      var id = db.ref('disputes').push().key;
      db.ref('disputes/' + id).set(Object.assign({ id: id, createdAt: Date.now() }, payload));
      _toast('✅ Dispute submitted!'); if (window.closeModal) closeModal();
    }
    _dispScreenshotB64 = null;
  };


  /* ─── DARK MODE ONLY — Light/Neon removed ─── */
  window.toggleTheme = function () {
    // Dark mode only — no toggle
    document.body && document.body.removeAttribute('data-theme');
    localStorage.setItem('appTheme', 'dark');
    _toast('🌙 Dark mode is the only theme', 'inf');
  };
  window.setTheme = function(theme) {
    // Always dark
    document.body && document.body.removeAttribute('data-theme');
    localStorage.setItem('appTheme', 'dark');
  };
  // Force dark on load — override any saved light/neon
  (function () {
    localStorage.setItem('appTheme', 'dark');
    document.body && document.body.removeAttribute('data-theme');
  })();

  /* ─── NEW FEATURE 34: REFERRAL TRACKER CARD ─── */
  window.showReferralStats = function () {
    var UD = window.UD; if (!UD) return;
    var refs = window.REFS || [];
    var h = '<div style="padding:8px">';
    h += '<div style="text-align:center;padding:14px;background:linear-gradient(135deg,rgba(185,100,255,.12),rgba(0,255,156,.06));border-radius:14px;margin-bottom:14px">';
    h += '<div style="font-size:36px;font-weight:900;color:var(--primary)">' + (UD.referralCount || 0) + '</div>';
    h += '<div style="font-size:13px;color:var(--txt2)">Friends Referred</div>';
    h += '<div style="font-size:20px;font-weight:700;color:#ffd700;margin-top:4px">🪙 ' + (UD.referralCoinsEarned || 0) + '</div>';
    h += '<div style="font-size:11px;color:var(--txt2)">Coins Earned</div></div>';
    if (refs.length > 0) {
      h += '<div style="font-size:13px;font-weight:700;margin-bottom:8px">Recent Referrals:</div>';
      refs.slice(0, 5).forEach(function (r) {
        h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:var(--card2);border:1px solid var(--border);margin-bottom:6px">';
        h += '<div style="width:32px;height:32px;border-radius:10px;background:rgba(0,255,156,.1);display:flex;align-items:center;justify-content:center;font-size:14px">👤</div>';
        h += '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + (r.referredName || 'User') + '</div>';
        h += '<div style="font-size:10px;color:var(--txt2)">' + new Date(r.createdAt || 0).toLocaleDateString() + '</div></div>';
        h += '<div style="font-size:13px;font-weight:700;color:#ffd700">+🪙10</div></div>';
      });
    } else {
      h += '<div style="text-align:center;padding:20px;color:var(--txt2)">Abhi tak koi referral nahi. Dosto ko invite karo!</div>';
    }
    h += '</div>';
    if (window.showModal) showModal('🎁 Referral Stats', h);
  };

  /* ─── NEW FEATURE 35: OFFLINE MODE INDICATOR ─── */
  window._isOnline = true;
  window.addEventListener('online', function () {
    window._isOnline = true;
    _toast('✅ Back online!', 'ok');
    var bar = document.getElementById('offlineBar');
    if (bar) bar.style.display = 'none';
  });
  window.addEventListener('offline', function () {
    window._isOnline = false;
    _toast('📶 Offline — check internet', 'err');
    var bar = document.getElementById('offlineBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'offlineBar';
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:8px;background:#ff6b6b;color:#fff;font-size:12px;font-weight:700;text-align:center;z-index:9999';
      bar.textContent = '📶 You are offline. Some features may not work.';
      document.body && document.body.appendChild(bar);
    } else { bar.style.display = 'block'; }
  });

  /* ─── NEW FEATURE 36: MATCH FEEDBACK (Post-match survey) ─── */
  window.showMatchFeedback = function (matchId) {
    var h = '<div style="padding:8px;text-align:center">';
    h += '<div style="font-size:24px;margin-bottom:8px">🎮</div>';
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:4px">Match kaisa tha?</div>';
    h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:16px">Feedback se platform improve hoga</div>';
    h += '<div style="display:flex;gap:10px;justify-content:center;margin-bottom:16px">';
    ['😍', '😊', '😐', '😕', '😠'].forEach(function (e, i) {
      h += '<span onclick="window._setFeedback(' + (5 - i) + ',this)" style="font-size:32px;cursor:pointer;opacity:.5;transition:.2s" class="fb-emoji">' + e + '</span>';
    });
    h += '</div>';
    h += '<textarea id="fbText" placeholder="Kuch aur share karna chahte ho?" style="width:100%;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:12px;resize:none;height:60px;box-sizing:border-box"></textarea>';
    h += '<button onclick="window._submitFeedback(\'' + matchId + '\')" style="width:100%;margin-top:10px;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer">Submit</button>';
    h += '</div>';
    window._fbRating = 3;
    if (window.showModal) showModal('⭐ Match Feedback', h);
  };
  window._setFeedback = function (rating, el) {
    window._fbRating = rating;
    document.querySelectorAll('.fb-emoji').forEach(function (e) { e.style.opacity = '0.4'; e.style.transform = 'scale(1)'; });
    el.style.opacity = '1'; el.style.transform = 'scale(1.3)';
  };
  window._submitFeedback = function (matchId) {
    var text = (_$('fbText') || {}).value || '';
    if (!window.U) return;
    if (window._supa) {
      window._supa.from('match_feedback').upsert({
        match_id: matchId, user_id: window.U.uid,
        rating: window._fbRating || 3, feedback: text
      }, { onConflict: 'user_id,match_id' })
        .then(function() { _toast('✅ Feedback diya! Shukriya 🙏'); if (window.closeModal) closeModal(); })
        .catch(function() { _toast('Submit nahi hua', 'err'); });
    } else if (window.db) {
      db.ref('matchFeedback/' + matchId + '/' + window.U.uid).set({ rating: window._fbRating, text: text, userId: window.U.uid, createdAt: Date.now() });
      _toast('✅ Feedback diya! Shukriya 🙏'); if (window.closeModal) closeModal();
    }
  };

  /* ─── NEW FEATURE 37: MATCH TYPE FILTER (Quick Filter Chips) ─── */
  window.renderFilterChips = function () {
    var modes = ['all', 'solo', 'duo', 'squad'];
    var h = '<div style="display:flex;gap:8px;overflow-x:auto;padding:0 0 8px;scrollbar-width:none">';
    modes.forEach(function (m) {
      var active = (window._modeFilter || 'all') === m;
      h += '<button onclick="window.setModeFilter(\'' + m + '\')" style="padding:6px 14px;border-radius:20px;border:1px solid ' + (active ? 'var(--primary)' : 'var(--border)') + ';background:' + (active ? 'rgba(0,255,156,.12)' : 'transparent') + ';color:' + (active ? 'var(--primary)' : 'var(--txt2)') + ';font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">' + m.toUpperCase() + '</button>';
    });
    // Calendar button + the showMatchCalendar feature it opened were both removed per user request
    h += '<button onclick="window.showSmartPrizeCalc&&showSmartPrizeCalc()" style="padding:6px 12px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--txt2);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">🧮 Calculator</button>';
    h += '</div>';
    return h;
  };
  window.setModeFilter = function (mode) {
    window._modeFilter = mode;
    if (window.renderHome) renderHome();
  };

  window.showProfileViews = function () {
    var uid = _safeUid(); if (!uid) return;
    db.ref('profileViews/' + uid).once('value', function (s) {
      var count = s.exists() ? Object.keys(s.val()).length : 0;
      var h = '<div style="text-align:center;padding:20px">';
      h += '<div style="font-size:48px;font-weight:900;color:var(--primary)">' + count + '</div>';
      h += '<div style="font-size:14px;color:var(--txt2)">Players ne tumhara profile dekha</div>';
      h += '</div>';
      if (window.showModal) showModal('👀 Profile Views', h);
    });
  };

  /* ─── NEW FEATURE 40: SOUND TOGGLE ─── */
  window._soundOn = localStorage.getItem('soundPref') !== 'off';
  window.toggleSound = function () {
    window._soundOn = !window._soundOn;
    localStorage.setItem('soundPref', window._soundOn ? 'on' : 'off');
    _toast(window._soundOn ? '🔊 Sound on' : '🔇 Sound off', 'inf');
  };
  window.playSound = function (type) {
    if (!window._soundOn) return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = type === 'join' ? 880 : type === 'win' ? 1047 : type === 'notif' ? 660 : 440;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch (e) { /* Ignore sound errors */ }
  };

  /* ─── NEW FEATURE 41: HAPTIC FEEDBACK ─── */
  window.haptic = function (pattern) {
    if (!navigator.vibrate) return;
    if (pattern === 'success') navigator.vibrate([50, 30, 80]);
    else if (pattern === 'error') navigator.vibrate([100, 50, 100, 50, 100]);
    else if (pattern === 'notif') navigator.vibrate([30, 20, 30]);
    else navigator.vibrate(50);
  };


  /* ─── NEW FEATURE 43: LANGUAGE PREFERENCE ─── */
  window._lang = localStorage.getItem('appLang') || 'hi';
  window.setLanguage = function (lang) {
    window._lang = lang;
    localStorage.setItem('appLang', lang);
    _toast(lang === 'hi' ? '✅ Hindi set' : '✅ English set', 'ok');
  };


  /* ─── NEW FEATURE 45: MATCH INTEREST / GOING SYSTEM ─── */
  window.toggleInterest = function (matchId) {
    var uid = _safeUid(); if (!uid) return;
    db.ref('matchInterest/' + matchId + '/' + uid).once('value', function (s) {
      if (s.exists()) {
        db.ref('matchInterest/' + matchId + '/' + uid).remove();
        _toast('👋 Interest removed', 'inf');
      } else {
        db.ref('matchInterest/' + matchId + '/' + uid).set({ name: window.UD.ign || '', ts: Date.now() });
        _toast('⚡ Interest noted! Admin ko pata chalega.', 'ok');
      }
    });
  };

  /* ─── NEW FEATURE 46: TOTAL WINNINGS MILESTONE ─── */
  window.checkMilestone = function () { /* milestone toasts removed */ };

  /* ─── NEW FEATURE 47: MATCH CHAT (In-Match Banter) ─── */
  window.showMatchChat = function (matchId) {
    var h = '<div style="display:flex;flex-direction:column;height:300px">';
    h += '<div id="matchChatMsgs" style="flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px"></div>';
    h += '<div style="display:flex;gap:8px;padding:8px;border-top:1px solid var(--border)">';
    h += '<input type="text" id="matchChatIn" placeholder="Type message..." style="flex:1;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px">';
    h += '<button onclick="window._sendMatchChat(\'' + matchId + '\')" style="padding:10px 16px;border-radius:10px;background:var(--primary);color:#000;font-weight:700;border:none;cursor:pointer"><i class="fas fa-paper-plane"></i></button>';
    h += '</div></div>';
    if (window.showModal) showModal('💬 Match Chat', h);
    // Load messages
    db.ref('matchChat/' + matchId).limitToLast(20).on('value', function (s) {
      var el = _$('matchChatMsgs'); if (!el) return;
      var msgs = []; if (s.exists()) s.forEach(function (c) { msgs.push(c.val()); });
      el.innerHTML = msgs.map(function (m) {
        var isMe = m.uid === window.U.uid;
        return '<div style="display:flex;justify-content:' + (isMe ? 'flex-end' : 'flex-start') + '">' +
          '<div style="max-width:70%;padding:6px 10px;border-radius:10px;background:' + (isMe ? 'rgba(0,255,156,.15)' : 'var(--card2)') + ';font-size:12px">' +
          '<div style="font-size:10px;color:var(--txt2);margin-bottom:2px">' + (m.name || 'Player') + '</div>' +
          '<div>' + (m.text || '') + '</div></div></div>';
      }).join('');
      el.scrollTop = el.scrollHeight;
    });
  };
  window._sendMatchChat = function (matchId) {
    var inp = _$('matchChatIn'); if (!inp || !inp.value.trim()) return;
    db.ref('matchChat/' + matchId).push({
      uid: window.U.uid, name: window.UD.ign || 'Player',
      text: inp.value.trim(), ts: Date.now()
    });
    inp.value = '';
  };


  /* ─── NEW FEATURE 49: DYNAMIC BANNER MESSAGES ─── */
  window.loadDynamicBanner = function () {
    db.ref('appSettings/banner').on('value', function (s) {
      var el = document.getElementById('dynamicBanner');
      if (!el) return;
      if (s.exists() && s.val()) {
        var val = s.val();
        el.style.display = 'block';
        el.textContent = typeof val === 'string' ? val : (val.text || '');
        el.style.background = (val.color || 'rgba(0,255,156,.1)');
        el.style.color = (val.textColor || 'var(--green)');
      } else { el.style.display = 'none'; }
    });
  };

  /* ─── NEW FEATURE 50: SESSION STATS TRACKER ─── */
  window._sessionStart = Date.now();
  window._sessionMatches = 0;

  /* =========================================================
     AUTO INIT
     ========================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (window.checkShowTutorial) checkShowTutorial();
      if (window.setupMatchAlerts) setupMatchAlerts();
      if (window.loadDynamicBanner) loadDynamicBanner();
      /* Bug 68 Fix: startMatchTimers call removed — match-timer.js wraps renderHome() */
    }, 2000);
  });

  console.log('[Mini eSports] ✅ 50 User Features v9 loaded (Halal Only)');

  /* =========================================================
     🆕 NEW 100 FEATURES (51-150) — Halal Only
     ========================================================= */

  /* ─── FEATURE 51: QUICK RESULT SHARE (Match completed card) ─── */
  window.quickShareResult = function (matchId) {
    var JR = window.JR || {};
    for (var k in JR) {
      if (JR[k].matchId === matchId && JR[k].result) {
        var r = JR[k].result;
        window.shareResultCard && shareResultCard(window.MT && window.MT[matchId] && window.MT[matchId].name || 'Match', r.rank, r.kills, r.prize);
        return;
      }
    }
    _toast('Koi result nahi mila abhi', 'inf');
  };



  /* ─── FEATURE 54: PLAYER BADGE DISPLAY ─── */
  window.getPlayerBadge = function () {
    var UD = window.UD; if (!UD || !UD.stats) return '';
    var st = UD.stats;
    var wins = st.wins || 0, matches = st.matches || 0, kills = st.kills || 0;
    if (wins >= 50) return { label: 'Legend', color: '#ff6b6b', icon: '🏆' };
    if (wins >= 20) return { label: 'Elite', color: '#ffd700', icon: '💎' };
    if (wins >= 10) return { label: 'Pro', color: '#b964ff', icon: '⭐' };
    if (wins >= 5) return { label: 'Rising', color: '#4d96ff', icon: '🚀' };
    if (matches >= 5) return { label: 'Active', color: '#00ff9c', icon: '🎮' };
    return { label: 'Rookie', color: 'var(--txt2)', icon: '🌱' };
  };


  /* ─── FEATURE 56: NOTIFICATION BADGE COUNT ───
     🔴 AUDIT FIX (v32.8.4): removed — this used a Firebase-style
     orderByChild/equalTo query against users/{uid}/notifications that
     core/db-bridge.js has no handler for (silent no-op), and it was
     redundant with + fighting over the same #bellDot element as the
     correct, reactively-triggered updateBell() in core/header.js,
     which already computes unread count from the real NOTIFS array
     loaded from Supabase. */

  /* ─── FEATURE 57: MATCH RESULT HISTORY CARD (My Matches) ─── */
  window.renderResultCard = function (jr) {
    if (!jr || !jr.result) return '';
    var r = jr.result;
    return '<div style="margin-top:8px;padding:8px 12px;background:linear-gradient(135deg,rgba(255,215,0,.08),rgba(255,215,0,.02));border:1px solid rgba(255,215,0,.2);border-radius:10px;display:flex;gap:12px;align-items:center">' +
      '<div style="text-align:center"><div style="font-size:22px;font-weight:900;color:#ffd700">#' + (r.rank || '-') + '</div><div style="font-size:10px;color:var(--txt2)">Rank</div></div>' +
      '<div style="text-align:center"><div style="font-size:22px;font-weight:900;color:#ff6b6b">' + (r.kills || 0) + '💀</div><div style="font-size:10px;color:var(--txt2)">Kills</div></div>' +
      (r.prize > 0 ? '<div style="text-align:center"><div style="font-size:18px;font-weight:900;color:var(--green)">₹' + r.prize + '</div><div style="font-size:10px;color:var(--txt2)">Won</div></div>' : '') +
      '<button onclick="window.quickShareResult&&quickShareResult(\'' + (jr.matchId||'') + '\')" style="margin-left:auto;padding:6px 12px;border-radius:8px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);color:var(--green);font-size:11px;font-weight:700;cursor:pointer"><i class="fas fa-share"></i></button>' +
      '</div>';
  };




  /* ─── FEATURE 61: COIN BALANCE HISTORY ─── */
  window.showCoinHistory = function () {
    if (!window.U || !window.db) return;
    db.ref('users/' + window.U.uid + '/coinHistory').limitToLast(20).once('value', function (s) {
      var items = [];
      if (s.exists()) s.forEach(function (c) { items.unshift(c.val()); });
      var h = '<div style="display:flex;flex-direction:column;gap:6px">';
      if (!items.length) h += '<p style="text-align:center;color:var(--txt2);padding:30px">Koi coin history nahi</p>';
      items.forEach(function (i) {
        var isEarn = i.amount > 0;
        h += '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border)">';
        h += '<span style="font-size:20px">' + (isEarn ? '🪙' : '💸') + '</span>';
        h += '<div style="flex:1"><div style="font-size:12px;font-weight:600">' + (i.reason||'Transaction') + '</div>';
        h += '<div style="font-size:10px;color:var(--txt2)">' + new Date(i.ts||0).toLocaleDateString() + '</div></div>';
        h += '<div style="font-size:14px;font-weight:700;color:' + (isEarn ? 'var(--green)' : '#ff6b6b') + '">' + (isEarn ? '+' : '') + i.amount + ' 🪙</div></div>';
      });
      h += '</div>';
      if (window.showModal) showModal('🪙 Coin History', h);
    });
  };


  /* ─── FEATURE 63: QUICK TEAM INVITE SHARE ─── */
  window.shareTeamInvite = function () {
    var UD = window.UD; if (!UD) return;
    var code = UD.referralCode || (window.U && window.U.uid.substring(0, 8).toUpperCase()) || '';
    var msg = '🎮 Aye bhai! Mini eSports pe mere squad mein join ho jao! ' +
      '\n👤 Captain: ' + (UD.ign || 'Player') +
      '\n🔥 FF UID: ' + (UD.ffUid || 'N/A') +
      '\n🎁 Referral Code: ' + code +
      '\n📱 ' + ((typeof window.APP_URL === 'string' && window.APP_URL) || (window.location.origin + '/'));
    if (navigator.share) navigator.share({ text: msg });
    else if (window.copyTxt) { copyTxt(msg); _toast('Team invite copied!'); }
  };

  /* ─── FEATURE 64: ACTIVE MATCH PULSE INDICATOR ─── */
  window.updateActivePulse = function () {
    var MT = window.MT || {}, JR = window.JR || {};
    var hasLive = false;
    for (var k in JR) {
      var jr = JR[k];
      if (!jr.matchId) continue;
      var t = MT[jr.matchId];
      if (t && (t.status === 'live' || (t.matchTime && Math.abs(Number(t.matchTime) - Date.now()) < 1800000))) {
        hasLive = true; break;
      }
    }
    var nav = document.querySelector('[data-nav="matches"]');
    if (nav) {
      if (hasLive) nav.innerHTML = '<i class="fas fa-gamepad" style="color:#ff6b6b"></i><span>My Matches</span><span style="width:6px;height:6px;border-radius:50%;background:#ff6b6b;display:inline-block;margin-left:2px;animation:pulse 1s infinite"></span>';
    }
  };
  setInterval(window.updateActivePulse, 60000);


  /* ─── FEATURE 66: IN-APP TICKER UPDATE ─── */
  window.updateTicker = function () {
    var el = document.getElementById('tickerTxt'); if (!el) return;
    db.ref('appSettings/ticker').on('value', function (s) {
      if (s.exists() && s.val()) {
        var txt = s.val();
        /* ✅ Bug 19 Fix: Duplicate text so short ticker always scrolls
           If text is short (< 80 chars), repeat it so animation always runs */
        var repeated = txt;
        var repeatCount = Math.ceil(160 / Math.max(txt.length, 1));
        if (repeatCount > 1) {
          var sep = '   •   ';
          repeated = Array(Math.min(repeatCount, 6)).fill(txt).join(sep) + sep;
        }
        el.textContent = repeated;
      }
    });
  };
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () { if (window.updateTicker) updateTicker(); }, 3000);
  });




  /* ─── FEATURE 70: KEYBOARD SHORTCUTS ─── */
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'h' || e.key === 'H') { if (window.navTo) navTo('home'); }
    if (e.key === 'p' || e.key === 'P') { if (window.navTo) navTo('profile'); }
    if (e.key === 'w' || e.key === 'W') { if (window.navTo) navTo('wallet'); }
    if (e.key === 'Escape') { if (window.closeModal) closeModal(); }
    if (e.key === 'r' || e.key === 'R') { if (window.renderHome) renderHome(); }
  });

  /* ─── FEATURE 71: LEADERBOARD RANK DISPLAY ─── */
  window.getLeaderboardRank = function (cb) {
    if (!window.U || !db) return;
    var uid = _safeUid(); if (!uid) return;
    db.ref('users').orderByChild('stats/earnings').once('value', function (s) {
      var users = [];
      if (s.exists()) s.forEach(function (c) { users.push({ uid: c.key, earnings: (c.val().stats || {}).earnings || 0 }); });
      users.sort(function (a, b) { return b.earnings - a.earnings; });
      var rank = users.findIndex(function (u) { return u.uid === uid; }) + 1;
      if (cb) cb(rank || users.length + 1, users.length);
    });
  };
  window.showMyRank = function () {
    window.getLeaderboardRank(function (rank, total) {
      _toast('🏆 Global Rank: #' + rank + ' out of ' + total + ' players!', 'inf');
    });
  };


  /* ─── FEATURE 73: AUTO REFRESH WHEN BACK ONLINE ─── */
  window.addEventListener('online', function () {
    setTimeout(function () {
      if (window.renderHome) renderHome();
      if (window.renderMM) renderMM();
    }, 1000);
  });



  /* ─── FEATURE 76: SWIPE GESTURE SUPPORT ─── */
  (function () {
    var startX = 0;
    document.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; });
    document.addEventListener('touchend', function (e) {
      var diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 100) {
        var navItems = ['home', 'special', 'matches', 'wallet', 'rank', 'profile'];
        var activeNav = document.querySelector('.nav-item.active');
        if (!activeNav) return;
        var curIdx = navItems.indexOf(activeNav.dataset.nav || '');
        if (curIdx < 0) return;
        if (diff > 0 && curIdx < navItems.length - 1) { if (window.navTo) navTo(navItems[curIdx + 1]); }
        else if (diff < 0 && curIdx > 0) { if (window.navTo) navTo(navItems[curIdx - 1]); }
      }
    });
  })();

  /* ─── FEATURE 77: APP VERSION CHECKER ─── */
  window.checkAppVersion = function () {
    db.ref('appSettings/minVersion').once('value', function (s) {
      if (!s.exists()) return;
      var minVer = s.val();
      var curVer = '9.0'; // Current version
      if (minVer && minVer > curVer) {
        _toast('🆕 New app update available! Refresh karo.', 'inf');
      }
    });
  };
  setTimeout(function () { if (window.checkAppVersion) checkAppVersion(); }, 5000);

  /* ─── FEATURE 78: MAINTENANCE MODE CHECK ─── */
  /* ✅ BUG FIX (2026-09-17): applyMaintState pulled out of checkMaintenance
     and exposed as window.applyMaintState — matching js/preview-mode.js's
     identical fix, same root cause. See core/listeners.js's
     _bootAppSettings() for the full explanation: this file's own realtime
     channel (previously created inside checkMaintenance, now removed
     below) lived outside the app's central channel lifecycle and was
     silently orphaned every time window._supa got recreated on a Firebase
     token refresh (login, and roughly hourly thereafter) — exactly
     matching "works after refresh, not while already open". The realtime
     subscription now lives in core/listeners.js's _bootAppSettings(),
     which calls this function directly by name. */
  function applyMaintState(isMaint) {
    var overlay = document.getElementById('maintOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'maintOverlay';
      overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:#050507;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px';
      overlay.innerHTML = '<div style="font-size:60px;margin-bottom:20px">⚙️</div><div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:10px">Maintenance Mode</div><div style="font-size:14px;color:#7a7a8e;line-height:1.6">Hum kuch improvements kar rahe hain.<br>Thodi der baad try karo. 🙏</div>';
      document.body.appendChild(overlay);
    }
    var main = document.getElementById('mainContent');
    var nav = document.getElementById('bottomNav');
    if (isMaint) {
      overlay.style.display = 'flex';
      if (main) main.style.pointerEvents = 'none';
      if (nav) nav.style.display = 'none';
    } else {
      overlay.style.display = 'none';
      if (main) main.style.pointerEvents = '';
      if (nav && window.U) nav.style.display = '';
    }
  }
  window.applyMaintState = applyMaintState;

  window.checkMaintenance = function () {
    /* ✅ MIGRATED (2026-08-18): Maintenance Mode moved from Firebase RTDB
       (appSettings/maintenance) to Supabase app_settings — same pattern
       as preview_mode already used. This removes the dependency on
       Firebase Console rules deployment, which could never be
       confirmed/fixed from a coding session alone (see
       DEVELOPER_GUIDE.md Section 34.11 for the full trace of why the
       Firebase-based version was suspected broken). Uses Supabase
       Realtime (postgres_changes, via core/listeners.js's
       _bootAppSettings — see applyMaintState above) for the live-toggle
       behavior the old Firebase .on('value') listener provided. */
    if (!window._supa) {
      console.error('[checkMaintenance] window._supa not available — cannot check maintenance mode');
      return;
    }

    /* Initial read — the realtime subscription (core/listeners.js
       _bootAppSettings) only fires on future changes, so this one-time
       read is still needed to pick up whatever state maintenance is
       ALREADY in at the moment this user opens the app. */
    window._supa.from('app_settings').select('value').eq('key','maintenance').maybeSingle()
      .then(function (res) {
        if (res.error) {
          console.error('[checkMaintenance] app_settings read failed:', res.error.message);
          return;
        }
        applyMaintState(!!(res.data && res.data.value && res.data.value.active === true));
      });

    /* ✅ Safety-net poll — unaffected by the channel-lifecycle bug above
       (a plain one-shot .then() read can't go stale the way a channel
       subscription can), kept as defense in depth regardless of whether
       the realtime channel is healthy. */
    if (!window._maintModePollTimer) {
      window._maintModePollTimer = setInterval(function () {
        window._supa.from('app_settings').select('value').eq('key','maintenance').maybeSingle()
          .then(function (res) {
            if (!res.error) applyMaintState(!!(res.data && res.data.value && res.data.value.active === true));
          });
      }, 25000);
    }
  };
  setTimeout(function () { if (window.checkMaintenance) checkMaintenance(); }, 2000);



  /* ─── FEATURE 80: HAPTIC ON JOIN ─── */
  var _origNavTo = window.navTo;
  window.navTo = function (scr) {
    if (window.haptic) haptic();
    if (_origNavTo) _origNavTo(scr);
  };

  window._searchMatches = function () {
    var q = (document.getElementById('mSearchIn') || {}).value || ''; q = q.toLowerCase();
    var res = document.getElementById('mSearchRes'); if (!res) return;
    if (q.length < 2) { res.innerHTML = '<p style="color:var(--txt2);text-align:center;padding:20px">2+ characters type karo</p>'; return; }
    var MT = window.MT || {};
    var found = Object.values(MT).filter(function (t) { return t && t.name && t.name.toLowerCase().includes(q); });
    var h = '<div style="display:flex;flex-direction:column;gap:6px">';
    if (!found.length) h += '<p style="color:var(--txt2);text-align:center;padding:20px">Koi match nahi mila</p>';
    found.slice(0, 10).forEach(function (t) {
      h += '<div onclick="closeModal();showDet(\'' + t.id + '\')" style="padding:10px 12px;border-radius:10px;background:var(--card2);border:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center">';
      h += '<div><div style="font-size:13px;font-weight:700">' + t.name + '</div><div style="font-size:11px;color:var(--txt2)">' + (t.mode||'solo').toUpperCase() + ' · 💎' + (t.entryFee||0) + '</div></div>';
      h += '<i class="fas fa-chevron-right" style="color:var(--txt2)"></i></div>';
    });
    h += '</div>';
    res.innerHTML = h;
  };

  /* ─── FEATURE 82: NIGHT MODE AUTO ─── */
  window.autoNightMode = function () {
    var hr = new Date().getHours();
    var isNight = hr >= 21 || hr < 6;
    var saved = localStorage.getItem('appTheme');
    if (!saved) {
      document.body && document.body.setAttribute('data-theme', isNight ? 'dark' : 'light');
    }
  };
  window.autoNightMode();


  /* ─── FEATURE 84: QUICK SUPPORT CHAT ─── */
  window.sendQuickSupport = function (issue) {
    if (!window.U || !db) return;
    var uid = _safeUid(); if (!uid) return;
    var id = db.ref('supportRequests').push().key;
    db.ref('supportRequests/' + id).set({
      id: id, userId: uid, userName: window.UD && window.UD.ign || '',
      userEmail: window.UD && window.UD.email || '',
      type: issue, message: issue, status: 'open', createdAt: Date.now()
    });
    _toast('✅ Support request sent! Admin se chat karo.', 'ok');
  };

  /* ─── FEATURE 85: MATCH PARTICIPATION CERTIFICATE ─── */
  window.generateCertificate = function (matchName, rank, date) {
    var UD = window.UD; if (!UD) return;
    var canvas = document.createElement('canvas');
    canvas.width = 500; canvas.height = 300;
    var ctx = canvas.getContext('2d');
    // Background
    var g = ctx.createLinearGradient(0, 0, 500, 300);
    g.addColorStop(0, '#0a0f1a'); g.addColorStop(1, '#1a0f2e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 500, 300);
    // Border
    ctx.strokeStyle = '#ffd70066'; ctx.lineWidth = 3; ctx.strokeRect(10, 10, 480, 280);
    // Title
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText('MINI eSPORTS — CERTIFICATE', 250, 50);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px Arial';
    ctx.fillText('This certifies that', 250, 90);
    ctx.fillStyle = '#00ff9c'; ctx.font = 'bold 24px Arial';
    ctx.fillText(UD.ign || 'Player', 250, 130);
    ctx.fillStyle = '#ffffff'; ctx.font = '14px Arial';
    ctx.fillText('participated in ' + (matchName || 'Tournament'), 250, 165);
    ctx.fillText('Rank #' + (rank || '-') + ' · ' + (date || new Date().toLocaleDateString()), 250, 195);
    ctx.fillStyle = '#ffd700'; ctx.font = '12px Arial';
    ctx.fillText((typeof window.APP_URL === 'string' && window.APP_URL) || (window.location.origin + '/'), 250, 275);
    var url = canvas.toDataURL();
    var a = document.createElement('a'); a.href = url; a.download = 'certificate.png'; a.click();
    _toast('🏅 Certificate downloaded!');
  };



  /* ─── FEATURE 88: WIN PROBABILITY DISPLAY ─── */
  window.getWinProbability = function (t) {
    if (!t || !t.maxSlots) return null;
    var slots = Number(t.maxSlots);
    var mode = (t.mode || t.type || 'solo').toLowerCase();
    var baseChance = mode === 'solo' ? 1 / slots : mode === 'duo' ? 2 / slots : 4 / slots;
    var pct = Math.min(Math.round(baseChance * 100), 100);
    return pct;
  };

  /* ─── FEATURE 89: STREAK BONUS NOTIFICATION ─── */
  window.checkStreakBonus = function () {
    var UD = window.UD; if (!UD) return;
    var streak = UD.loginStreak || 0;
    var milestones = [3, 7, 14, 30];
    /* BUG FIX (2026-07-30): this had no "already shown" guard at all — it's called from
       core/listeners.js's _applyUser() on EVERY profile refresh (initial load, after
       check-in, periodic poll), so as long as loginStreak stayed at a milestone value
       (all day, until the next check-in), the same toast re-fired on every single
       refresh — this is the exact "3 duplicate toasts stacked" bug reported live.
       Now only shows once per streak value per browser session. */
    if (streak === window._lastStreakToastShown) return;
    if (milestones.indexOf(streak) >= 0) {
      window._lastStreakToastShown = streak;
      _toast('🎉 ' + streak + ' Day Streak Bonus! Extra 🪙 coins earned!', 'ok');
    }
  };

  /* ─── FEATURE 90: IN-APP RULES SUMMARY ─── */
  window.showQuickRules = function () {
    var rules = [
      { icon: '🎮', title: 'Fair Play', desc: 'Registered IGN & UID se hi khelo. Mismatch = disqualification.' },
      { icon: '💰', title: 'Entry Fee', desc: 'Entry fee non-refundable hai (cancelled match ke siwa).' },
      { icon: '💀', title: 'Kill Proof', desc: 'Kill count dispute ke liye screenshot upload karo.' },
      { icon: '🏆', title: 'Results', desc: 'Admin 30 min mein result publish karega.' },
      { icon: '📤', title: 'Withdrawal', desc: 'Min ₹50. Winnings wallet mein credited hote hain.' },
      { icon: '🚫', title: 'Cheating', desc: 'Hack/cheat = permanent ban aur prize forfeit.' },
    ];
    var h = '<div style="display:flex;flex-direction:column;gap:8px">';
    rules.forEach(function (r) {
      h += '<div style="display:flex;gap:10px;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border)">';
      h += '<span style="font-size:20px">' + r.icon + '</span>';
      h += '<div><div style="font-size:13px;font-weight:700">' + r.title + '</div><div style="font-size:11px;color:var(--txt2)">' + r.desc + '</div></div></div>';
    });
    h += '</div>';
    if (window.showModal) showModal('📋 Quick Rules', h);
  };


  /* ─── FEATURE 92: MATCH HISTORY EXPORT ─── */
  window.exportMatchHistory = function () {
    var uid = window.U && window.U.uid; if (!uid) return;
    db.ref('joinRequests').orderByChild('userId').equalTo(uid).once('value', function (s) {
      var rows = [['Match Name', 'Mode', 'Entry Fee', 'Status', 'Result', 'Date']];
      if (s.exists()) s.forEach(function (c) {
        var d = c.val();
        rows.push([
          d.matchName || 'Unknown', d.mode || 'solo', d.entryFee || 0, d.status || '-',
          d.result ? 'Rank #' + d.result.rank + ' | ₹' + d.result.prize : 'No result',
          new Date(d.createdAt || 0).toLocaleDateString()
        ]);
      });
      var csv = rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'match-history.csv'; a.click();
      _toast('📊 Match history exported!');
    });
  };


  /* ─── FEATURE 94: QUICK JOIN HISTORY ─── */
  window.showRecentJoins = function () {
    var history = JSON.parse(localStorage.getItem('recentJoins') || '[]');
    var h = '<div style="display:flex;flex-direction:column;gap:6px">';
    if (!history.length) h += '<p style="text-align:center;color:var(--txt2);padding:30px">No recent joins</p>';
    history.slice(0, 10).forEach(function (item) {
      h += '<div style="padding:10px 12px;border-radius:10px;background:var(--card2);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">';
      h += '<div><div style="font-size:13px;font-weight:600">' + (item.name||'Match') + '</div><div style="font-size:10px;color:var(--txt2)">' + new Date(item.ts||0).toLocaleDateString() + '</div></div>';
      h += '<div style="font-size:11px;color:var(--green)">Joined ✅</div></div>';
    });
    h += '</div>';
    if (window.showModal) showModal('🕐 Recent Joins', h);
  };


  /* ─── FEATURE 96: SHARE MATCH ON WHATSAPP ─── */
  window.shareMatchWhatsApp = function (matchId) {
    var t = window.MT && window.MT[matchId]; if (!t) return;
    /* R28j (2026-09-22): false ₹-claim + fake domain (mini-esports.app)
       hatao. Prize/entry ab entryType ke hisaab se (coin 🪙 / Sky 💎),
       URL canonical APP_URL / current origin. */
    var isCoin = (t.entryType || '').toString().toLowerCase() === 'coin';
    var prize = Math.max(Number(t.firstPrize || t.prize1st || t.prizePool || 0), 0);
    var fee = Number(t.entryFee || 0);
    var prizeTxt = isCoin ? ('🪙 ' + prize + ' Coins') : ('💎 ' + prize + ' Green Diamonds');
    var feeTxt = fee > 0 ? (isCoin ? ('🪙 ' + fee) : ('💎 ' + fee)) : 'FREE';
    var base = (typeof window.APP_URL === 'string' && window.APP_URL) || (window.location.origin + '/');
    var msg = '🎮 Join ' + t.name + ' on Mini eSports!\n🏆 Prize: ' + prizeTxt + '\n🎟 Entry: ' + feeTxt + '\n⏰ ' + (t.matchTime ? new Date(Number(t.matchTime)).toLocaleString() : '') + '\n📱 ' + base;
    window.openWhatsApp(msg);
  };



  /* ─── FEATURE 99: RECENT WINNERS FEED ─── */
  window.showRecentWinners = function () {
    db.ref('matchResults').limitToLast(5).once('value', function (s) {
      var winners = [];
      if (s.exists()) s.forEach(function (matchNode) {
        matchNode.forEach(function (c) {
          var r = c.val();
          if (r.rank === 1 && r.prize > 0) winners.push(r);
        });
      });
      var h = '<div style="display:flex;flex-direction:column;gap:8px">';
      if (!winners.length) h += '<p style="text-align:center;color:var(--txt2);padding:30px">Koi recent winners nahi</p>';
      winners.forEach(function (w) {
        h += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2)">';
        h += '<span style="font-size:20px">🥇</span>';
        h += '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + (w.playerName||'Player') + '</div><div style="font-size:10px;color:var(--txt2)">Won 💎' + w.prize + '</div></div>';
        h += '<div style="font-size:14px;font-weight:700;color:#ffd700">₹' + w.prize + '</div></div>';
      });
      h += '</div>';
      if (window.showModal) showModal('🏆 Recent Winners', h);
    });
  };


  /* ─── FEATURE 103: DAILY CHECK-IN BUTTON ─── */
  function _checkInDateToday() {
    return new Date().toISOString().slice(0, 10);
  }
  window.updateDailyCheckInButton = function () {
    var claimed = !!(window.UD && window.UD.lastCheckIn === _checkInDateToday());
    document.querySelectorAll('[data-daily-checkin]').forEach(function(btn) {
      btn.disabled = claimed;
      btn.setAttribute('aria-disabled', claimed ? 'true' : 'false');
      btn.innerHTML = claimed
        ? '<i class="fas fa-check-circle"></i> Checked In Today'
        : '<i class="fas fa-calendar-check"></i> Daily Check-In (+🪙5)';
      btn.style.opacity = claimed ? '0.65' : '1';
      btn.style.cursor = claimed ? 'default' : 'pointer';
    });
  };
  window.doCheckIn = function () {
    if (window.UD && window.UD.lastCheckIn === _checkInDateToday()) {
      window.updateDailyCheckInButton();
      _toast('✅ Aaj already check-in kar chuke ho!', 'inf');
      return;
    }
    /* ✅ FIX (live-testing, 401 on Daily Check-In click): window._supa
       exists from page-load as an ANON client (see supabase-init-early
       equivalent in core/db.js) — it only becomes authenticated after
       syncFirebaseToken() runs and sets window._supaReady. Checking only
       `!window._supa` let this fire against the anon client during the
       login window, which process_daily_checkin (an authenticated-only
       RPC) correctly rejects with 401. Same root cause class as the
       Admin Panel's matches/commissions race fixed earlier this audit —
       wait for _supaReady too. */
    if (!window.U || !window._supa || !window._supaReady) return;
    var uid = _safeUid(); if (!uid) return;
    var btn = document.getElementById('checkInBtn');
    if (btn) btn.disabled = true;

    /* BUG #31/#44 FIX (2026-07): consolidated with fixes-v7.js's _checkStreakFixed to use
       the same atomic RPC and the same admin-configurable cycling-tier reward structure
       (window._adminDailyBonusRewards), instead of this file's own separate, simpler
       "5 coins + every-7-days-50-bonus" calculation — eliminates the previous
       three-separate-writes race condition entirely (see process_daily_checkin). */
    var tierRewards = window._adminDailyBonusRewards || [5,7,10,12,15,20,30];
    window._supa.rpc('process_daily_checkin', { p_tier_rewards: tierRewards, p_milestone_bonus: (window._adminDay30Bonus || 100), p_milestone_days: 30 }) /* BUG #39 FIX */
      .then(function(r) {
        if (r.error || (r.data && r.data.success === false)) {
          if (r.data && r.data.error === 'already_checked_in') {
            _toast('✅ Aaj already check-in kar chuke ho!', 'inf');
          } else {
            var msg = (r.data && r.data.error) || (r.error && r.error.message) || 'retry karo';
            _toast('Check-in failed: ' + msg, 'err');
          }
          if (btn) btn.disabled = false;
          return;
        }
        var totalReward = r.data.total;
        var newStreak = r.data.streak;
        if (window.UD) {
          window.UD.coins = (Number(window.UD.coins) || 0) + totalReward;
          window.UD.streak_days = newStreak;
          window.UD.lastCheckIn = _checkInDateToday();
        }
        if (window.updateHdr) updateHdr();
        if (window.renderWallet) renderWallet();
        window.updateDailyCheckInButton();
        _toast(r.data.milestone_bonus > 0
          ? '🎉 Check-in complete! +🪙' + totalReward + ' Coins (' + newStreak + '-day milestone bonus!) 🔥'
          : '🎉 Check-in complete! +🪙' + totalReward + ' Coins earned!', 'ok');
        if (window.haptic) haptic('success');
        if (window.f06Streak && window.f06Streak.show) setTimeout(function(){ window.f06Streak.show(((newStreak-1)%tierRewards.length)+1, r.data.reward); }, 1500);
        if (btn) btn.disabled = false;
      })
      .catch(function(e) {
        console.error('[doCheckIn] failed:', e && e.message);
        _toast('Check-in failed: ' + (e && e.message ? e.message : 'retry karo'), 'err');
        if (btn) btn.disabled = false;
      });
  };




  /* ─── FEATURE 107: MATCH REMINDERS LIST ─── */
  window._reminders = JSON.parse(localStorage.getItem('matchReminders') || '[]');


  /* ─── FEATURE 109: MATCH ENTRY FEE CALCULATOR ─── */
  window.calcEntryFee = function (fee, isCoin) {
    var UD = window.UD; if (!UD) return { canJoin: false, balance: 0 };
    var balance = isCoin ? (UD.coins || 0) : ((UD.realMoney || {}).deposited || 0) + ((UD.realMoney || {}).winnings || 0) + ((UD.realMoney || {}).bonus || 0);
    return { canJoin: balance >= fee, balance: balance, shortfall: Math.max(fee - balance, 0) };
  };



  /* ═══════════════════════════════════════════════
     NEW 100 SMART FEATURES (111-210) — v11
     All three files: HTML + app.js + features-user.js
     FF UID shown everywhere user is mentioned
  ═══════════════════════════════════════════════ */


  /* ─── FEATURE 112: SHARE FF UID ─── */
  window.shareFFUID = function() {
    var UD = window.UD; if (!UD || !UD.ffUid) return;
    var text = '🎮 My Free Fire Profile:\n👤 IGN: ' + (UD.ign||'Player') + '\n🆔 FF UID: ' + UD.ffUid + '\n\nJoin me on Mini eSports! 🔥';
    if (navigator.share) navigator.share({title: 'My FF Profile', text: text}).catch(function(){});
    else { window.copyTxt && copyTxt(text); _toast('UID copied to clipboard!', 'ok'); }
  };

  /* ─── FEATURE 113: FF UID QR CODE (text-based) ─── */
  window.showQRCode = function() {
    var UD = window.UD; if (!UD || !UD.ffUid) return;
    var h = '<div style="text-align:center;padding:20px">';
    h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:12px">Share your FF UID</div>';
    h += '<div style="font-family:monospace;font-size:24px;font-weight:900;color:var(--green);letter-spacing:3px;padding:20px;background:rgba(0,255,156,.06);border:2px solid rgba(0,255,156,.2);border-radius:14px;margin-bottom:12px">' + UD.ffUid + '</div>';
    h += '<div style="font-size:18px;font-weight:800;margin-bottom:8px">' + (window.escHtml?window.escHtml(UD.ign||'Player'):(UD.ign||'Player')) + '</div>';
    h += '<button onclick="window.copyMyFFUID&&copyMyFFUID()" style="width:100%;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer;font-size:14px"><i class="fas fa-copy"></i> Copy UID</button>';
    h += '</div>';
    if (window.openModal) openModal('Your FF UID', h);
  };






  window._doLookup = function() {
    var inp = document.getElementById('lookupUID');
    var uid = inp ? inp.value.trim() : '';
    if (!uid || uid.length < 4) { _toast('Valid UID enter karo', 'err'); return; }
    var res = document.getElementById('lookupResult');
    if (res) res.innerHTML = '<div style="text-align:center;color:var(--txt2);padding:12px"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    var db = window.db;
    if (!db) return;
    db.ref('users').orderByChild('ffUid').equalTo(uid).once('value', function(s) {
      if (!res) return;
      if (!s.exists()) { res.innerHTML = '<div style="text-align:center;color:#ff6b6b;padding:12px"><i class="fas fa-times-circle"></i> No player found with this UID</div>'; return; }
      var p = null; s.forEach(function(c) { p = c.val(); });
      var st = (p.stats||{}), wr = st.matches ? Math.round((st.wins||0)/st.matches*100) : 0;
      res.innerHTML = '<div style="padding:12px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;text-align:center">' +
        '<div style="font-size:20px;font-weight:900;margin-bottom:4px">' + (p.ign||p.displayName||'Player') + '</div>' +
        '<div style="font-size:13px;font-weight:700;color:var(--green);font-family:monospace;margin-bottom:10px">FF UID: ' + uid + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">' +
        '<div style="background:var(--card);border-radius:8px;padding:8px"><div style="font-size:10px;color:var(--txt2)">Matches</div><div style="font-weight:700">' + (st.matches||0) + '</div></div>' +
        '<div style="background:var(--card);border-radius:8px;padding:8px"><div style="font-size:10px;color:var(--txt2)">Wins</div><div style="font-weight:700">' + (st.wins||0) + '</div></div>' +
        '<div style="background:var(--card);border-radius:8px;padding:8px"><div style="font-size:10px;color:var(--txt2)">Win%</div><div style="font-weight:700">' + wr + '%</div></div>' +
        '</div></div>';
    });
  };








  /* ─── FEATURE 127: LIVE MATCH COUNTDOWN WIDGET ─── */
  window.renderNextMatchCountdown = function() {
    var JR = window.JR || {}, MT = window.MT || {};
    var upcoming = [];
    for (var k in JR) {
      var jr = JR[k], t = MT[jr.matchId];
      if (t && t.matchTime && Number(t.matchTime) > Date.now()) upcoming.push({ jr: jr, t: t });
    }
    if (!upcoming.length) return '';
    upcoming.sort(function(a,b) { return Number(a.t.matchTime) - Number(b.t.matchTime); });
    var next = upcoming[0];
    var diff = Number(next.t.matchTime) - Date.now();
    var h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
    var html = '<div style="background:linear-gradient(135deg,rgba(255,107,107,.08),rgba(255,170,0,.06));border:1px solid rgba(255,170,0,.2);border-radius:14px;padding:12px 16px;margin-bottom:12px">';
    html += '<div style="font-size:11px;color:var(--txt2);margin-bottom:4px"><i class="fas fa-clock"></i> Next Match Starting In</div>';
    html += '<div style="font-size:20px;font-weight:900;color:#ffaa00">' + (h > 0 ? h + 'h ' : '') + m + 'm</div>';
    html += '<div style="font-size:13px;font-weight:700;margin-top:2px">' + (next.t.name||'Match') + '</div>';
    html += '</div>';
    return html;
  };


  window._calcPrize = function() {
    /* Bug Fix: Validate non-negative values — negative inputs gave negative prize pool */
    var players = Math.max(1, Math.min(10000, parseInt((document.getElementById('calcPlayers')||{}).value||100) || 1));
    var fee = Math.max(0, Math.min(100000, parseInt((document.getElementById('calcFee')||{}).value||10) || 0));
    var total = players * fee;
    var p1 = Math.round(total * 0.50), p2 = Math.round(total * 0.30), p3 = Math.round(total * 0.20);
    var res = document.getElementById('calcResult');
    if (res) res.innerHTML = '<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:14px">' +
      '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px">Prize Distribution</div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)"><span>Total Pool</span><span style="font-weight:800;color:var(--yellow)">₹'+total+'</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)"><span>🥇 1st (50%)</span><span style="font-weight:700;color:var(--green)">₹'+p1+'</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)"><span>🥈 2nd (30%)</span><span style="font-weight:700">₹'+p2+'</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0"><span>🥉 3rd (20%)</span><span style="font-weight:700">₹'+p3+'</span></div>' +
      '</div>';
  };


  /* ─── FEATURE 131: MATCH PERFORMANCE TRACKER ─── */
  window.showPerformanceTracker = function() {
    var UD = window.UD; if (!UD) return;
    var st = UD.stats || {};
    var wr = st.matches ? (st.wins/st.matches*100).toFixed(1) : '0.0';
    var kpg = st.matches ? (st.kills/st.matches).toFixed(1) : '0.0';
    var epg = st.matches ? ((st.earnings||0)/st.matches).toFixed(1) : '0.0';
    var h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">';
    [
      { label: 'Win Rate', value: wr + '%', icon: '🏆', color: 'var(--green)' },
      { label: 'Kills/Match', value: kpg, icon: '💀', color: '#ff6b6b' },
      { label: 'Earn/Match', value: '💎'+epg, icon: '💰', color: 'var(--yellow)' },
      { label: 'Total Matches', value: st.matches||0, icon: '🎮', color: 'var(--blue)' }
    ].forEach(function(item) {
      h += '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">';
      h += '<div style="font-size:24px;margin-bottom:4px">' + item.icon + '</div>';
      h += '<div style="font-size:22px;font-weight:900;color:' + item.color + '">' + item.value + '</div>';
      h += '<div style="font-size:11px;color:var(--txt2);margin-top:2px">' + item.label + '</div>';
      h += '</div>';
    });
    h += '</div>';
    var level = (st.matches||0) >= 50 ? 'Legend' : (st.matches||0) >= 20 ? 'Pro' : (st.matches||0) >= 5 ? 'Regular' : 'Beginner';
    h += '<div style="text-align:center;padding:10px;background:rgba(185,100,255,.06);border:1px solid rgba(185,100,255,.15);border-radius:10px"><span style="font-size:13px;color:var(--purple);font-weight:700">Player Level: ' + level + ' 🎯</span></div>';
    if (window.openModal) openModal('Performance Stats', h);
  };



  /* ─── GLASSMORPHISM UI TOGGLE ─── */
  window.toggleGlassmorphism = function() {
    var body = document.body;
    var isGlass = body.getAttribute('data-glass') === '1';
    body.setAttribute('data-glass', isGlass ? '0' : '1');
    localStorage.setItem('glassUI', isGlass ? '0' : '1');
    if (!isGlass) {
      // Apply glassmorphism to cards
      var s = document.getElementById('_glassStyle') || document.createElement('style');
      s.id = '_glassStyle';
      s.textContent = '.m-card,.mm-card,.card,.modal-box{background:rgba(17,17,24,.7)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;border:1px solid rgba(255,255,255,.08)!important}';
      document.head.appendChild(s);
      _toast('✨ Glassmorphism UI on!', 'ok');
    } else {
      var s2 = document.getElementById('_glassStyle');
      if (s2) s2.remove();
      _toast('Glassmorphism off', 'inf');
    }
  };
  // Auto-apply if saved
  (function() {
    if (localStorage.getItem('glassUI') === '1') {
      setTimeout(function() { window.toggleGlassmorphism && window.toggleGlassmorphism(); }, 500);
    }
  })();

  /* Register device fingerprint on load */
  setTimeout(function() { window.registerDeviceFingerprint && window.registerDeviceFingerprint(); }, 2000);
  /* Run instant refund check periodically */
  setInterval(function() { window.checkInstantRefunds && window.checkInstantRefunds(); }, 30000);
  /* Apply dynamic wallpaper when user data loads */
  document.addEventListener('userDataLoaded', function() { window.applyDynamicWallpaper && window.applyDynamicWallpaper(); });

  console.log('[Mini eSports] ✅ 210 User Features v11 loaded! FF UID shown everywhere.');
})();
