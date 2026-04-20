/* =============================================
   FEATURE 20: Match Invite Card — REDESIGNED
   Ultra stylish FF-style card with canvas
   ============================================= */
(function() {
  'use strict';

  function drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function generateShareCard(match) {
    var canvas = document.createElement('canvas');
    var W = 900, H = 520;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    /* ── BACKGROUND ── */
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0,   '#030810');
    bg.addColorStop(0.5, '#060f1a');
    bg.addColorStop(1,   '#030810');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* ── MESH GLOW: multiple radial glows ── */
    var glows = [
      { x: 0,   y: 0,   r: 350, c: 'rgba(0,255,156,0.10)' },
      { x: W,   y: H,   r: 350, c: 'rgba(0,212,255,0.08)' },
      { x: W/2, y: H/2, r: 200, c: 'rgba(0,255,156,0.04)' }
    ];
    glows.forEach(function(g) {
      var gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      gr.addColorStop(0, g.c);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    });

    /* ── GRID LINES (subtle) ── */
    ctx.strokeStyle = 'rgba(0,255,156,0.04)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 60) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (var gy = 0; gy < H; gy += 60) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    /* ── DIAGONAL ACCENT STRIPE ── */
    ctx.save();
    var stripe = ctx.createLinearGradient(0, 0, 900, 0);
    stripe.addColorStop(0, 'rgba(0,255,156,0)');
    stripe.addColorStop(0.5, 'rgba(0,255,156,0.06)');
    stripe.addColorStop(1, 'rgba(0,255,156,0)');
    ctx.fillStyle = stripe;
    ctx.beginPath();
    ctx.moveTo(0, 180); ctx.lineTo(W, 60); ctx.lineTo(W, 120); ctx.lineTo(0, 240);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    /* ── OUTER BORDER (neon green) ── */
    ctx.save();
    drawRoundRect(ctx, 8, 8, W - 16, H - 16, 22);
    ctx.strokeStyle = 'rgba(0,255,156,0.45)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ff9c';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();

    /* ── INNER BORDER (faint) ── */
    ctx.save();
    drawRoundRect(ctx, 14, 14, W - 28, H - 28, 18);
    ctx.strokeStyle = 'rgba(0,255,156,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    /* ── TOP LEFT: LOGO + BRAND ── */
    // Fire icon circle
    ctx.save();
    var logoGr = ctx.createRadialGradient(54, 52, 0, 54, 52, 28);
    logoGr.addColorStop(0, 'rgba(0,255,156,0.25)');
    logoGr.addColorStop(1, 'rgba(0,255,156,0.05)');
    ctx.fillStyle = logoGr;
    ctx.beginPath(); ctx.arc(54, 52, 28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,156,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#00ff9c';
    ctx.font = 'bold 26px Arial';
    ctx.shadowColor = '#00ff9c'; ctx.shadowBlur = 8;
    ctx.fillText('🔥', 40, 64);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ff9c';
    ctx.font = 'bold 17px Arial';
    ctx.letterSpacing = '3px';
    ctx.fillText('MINI eSPORTS', 92, 48);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px Arial';
    ctx.fillText('FREE FIRE TOURNAMENT', 92, 66);

    /* ── TOP RIGHT: TOURNAMENT INVITE BADGE ── */
    ctx.save();
    drawRoundRect(ctx, W - 220, 20, 200, 52, 12);
    var badgeGr = ctx.createLinearGradient(W - 220, 20, W - 20, 72);
    badgeGr.addColorStop(0, 'rgba(0,255,156,0.15)');
    badgeGr.addColorStop(1, 'rgba(0,212,255,0.10)');
    ctx.fillStyle = badgeGr;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,156,0.3)';
    ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#00ff9c';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ TOURNAMENT INVITE', W - 120, 42);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Arial';
    ctx.fillText('Join & Win Real Cash!', W - 120, 60);
    ctx.textAlign = 'left';

    /* ── DIVIDER LINE ── */
    var divGr = ctx.createLinearGradient(40, 90, W - 40, 90);
    divGr.addColorStop(0, 'rgba(0,255,156,0)');
    divGr.addColorStop(0.5, 'rgba(0,255,156,0.6)');
    divGr.addColorStop(1, 'rgba(0,255,156,0)');
    ctx.fillStyle = divGr;
    ctx.fillRect(40, 90, W - 80, 1.5);

    /* ── MATCH NAME (huge) ── */
    var name = (match.name || 'Epic Match').toUpperCase();
    if (name.length > 22) name = name.substring(0, 22) + '…';
    ctx.save();
    ctx.shadowColor = '#00ff9c'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px Arial';
    ctx.fillText(name, 40, 172);
    ctx.restore();

    /* ── MODE TAG ── */
    var mode = (match.mode || match.type || 'SOLO').toUpperCase();
    var modeColors = { SOLO: ['#00ff9c','#006640'], DUO: ['#00d4ff','#005580'], SQUAD: ['#aa55ff','#440080'] };
    var mc = modeColors[mode] || ['#00ff9c','#006640'];
    ctx.save();
    drawRoundRect(ctx, 40, 185, mode.length * 13 + 24, 32, 8);
    var modeGr = ctx.createLinearGradient(40, 185, 40, 217);
    modeGr.addColorStop(0, mc[0]);
    modeGr.addColorStop(1, mc[1]);
    ctx.fillStyle = modeGr;
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('⚡ ' + mode, 52, 206);
    ctx.restore();

    /* ── MAP TAG ── */
    if (match.map) {
      var mapW = (match.map.length) * 10 + 30;
      var modeTagW = mode.length * 13 + 24 + 10;
      ctx.save();
      drawRoundRect(ctx, 40 + modeTagW, 185, mapW, 32, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '13px Arial';
      ctx.fillText('🗺️ ' + match.map.charAt(0).toUpperCase() + match.map.slice(1), 50 + modeTagW, 206);
      ctx.restore();
    }

    /* ── STATS CARDS ROW ── */
    var cards = [];
    var et = (match.entryType || '').toLowerCase();
    var entryLabel = et === 'coin' ? '🪙 ' + (match.entryFee || 0) + ' Coins' : '₹' + (match.entryFee || 0);
    var slotsUsed = match.joinedCount || 0;
    var slotsMax  = match.maxSlots || 0;

    cards.push({ label: 'ENTRY FEE', value: entryLabel, icon: '💰', color: '#00d4ff' });
    if (match.firstPrize || match.prize1st) {
      cards.push({ label: '1ST PRIZE', value: '₹' + (match.firstPrize || match.prize1st || 0), icon: '🥇', color: '#ffd700' });
    }
    if (match.secondPrize || match.prize2nd) {
      cards.push({ label: '2ND PRIZE', value: '₹' + (match.secondPrize || match.prize2nd || 0), icon: '🥈', color: '#c0c0c0' });
    }
    if (match.thirdPrize || match.prize3rd) {
      cards.push({ label: '3RD PRIZE', value: '₹' + (match.thirdPrize || match.prize3rd || 0), icon: '🥉', color: '#cd7f32' });
    }
    if (!cards[1]) {
      cards.push({ label: 'SLOTS', value: slotsUsed + '/' + slotsMax, icon: '👥', color: '#aa55ff' });
    }

    var cardCount = Math.min(cards.length, 4);
    var cardW = Math.floor((W - 80 - (cardCount - 1) * 14) / cardCount);
    var cardY = 238;

    cards.slice(0, cardCount).forEach(function(card, i) {
      var cx = 40 + i * (cardW + 14);
      ctx.save();
      drawRoundRect(ctx, cx, cardY, cardW, 90, 12);
      var cGr = ctx.createLinearGradient(cx, cardY, cx, cardY + 90);
      cGr.addColorStop(0, 'rgba(255,255,255,0.06)');
      cGr.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = cGr;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1; ctx.stroke();
      // Top accent bar
      drawRoundRect(ctx, cx, cardY, cardW, 3, 2);
      ctx.fillStyle = card.color;
      ctx.shadowColor = card.color; ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = 'bold 10px Arial';
      ctx.fillText(card.label, cx + 14, cardY + 24);
      // Value
      ctx.fillStyle = card.color;
      ctx.font = 'bold 22px Arial';
      ctx.shadowColor = card.color; ctx.shadowBlur = 6;
      ctx.fillText(card.value, cx + 14, cardY + 66);
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    /* ── MATCH TIME ── */
    var matchTimeStr = '—';
    if (match.matchTime) {
      var d = new Date(Number(match.matchTime));
      matchTimeStr = d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '13px Arial';
    ctx.fillText('⏰ ' + matchTimeStr, 40, 360);

    /* ── DIVIDER 2 ── */
    var div2Gr = ctx.createLinearGradient(40, 378, W - 40, 378);
    div2Gr.addColorStop(0, 'rgba(0,255,156,0)');
    div2Gr.addColorStop(0.5, 'rgba(0,255,156,0.3)');
    div2Gr.addColorStop(1, 'rgba(0,255,156,0)');
    ctx.fillStyle = div2Gr;
    ctx.fillRect(40, 378, W - 80, 1);

    /* ── PLAYER SECTION ── */
    var playerName = (window.UD && (window.UD.ign || window.UD.displayName)) || 'Player';
    var playerFF = (window.UD && window.UD.ffUid) || '';

    // Avatar circle
    ctx.save();
    var avGr = ctx.createRadialGradient(74, 430, 0, 74, 430, 32);
    avGr.addColorStop(0, 'rgba(0,255,156,0.3)');
    avGr.addColorStop(1, 'rgba(0,255,156,0.05)');
    ctx.fillStyle = avGr;
    ctx.beginPath(); ctx.arc(74, 430, 32, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#00ff9c';
    ctx.shadowColor = '#00ff9c'; ctx.shadowBlur = 12;
    ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0;
    // Avatar letter
    ctx.fillStyle = '#00ff9c';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(playerName.charAt(0).toUpperCase(), 74, 440);
    ctx.textAlign = 'left';
    ctx.restore();

    // Player name
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px Arial';
    ctx.fillText('INVITED BY', 116, 418);
    ctx.fillStyle = '#00ff9c';
    ctx.font = 'bold 22px Arial';
    ctx.shadowColor = '#00ff9c'; ctx.shadowBlur = 6;
    ctx.fillText(playerName, 116, 444);
    ctx.shadowBlur = 0;
    if (playerFF) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '11px Arial';
      ctx.fillText('FF: ' + playerFF, 116, 460);
    }

    /* ── JOIN NOW CTA (right side) ── */
    ctx.save();
    var ctaX = W - 260, ctaY = 395, ctaW = 220, ctaH = 72;
    drawRoundRect(ctx, ctaX, ctaY, ctaW, ctaH, 14);
    var ctaGr = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY + ctaH);
    ctaGr.addColorStop(0, '#00ff9c');
    ctaGr.addColorStop(1, '#00cc7a');
    ctx.fillStyle = ctaGr;
    ctx.shadowColor = '#00ff9c'; ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ JOIN NOW', ctaX + ctaW / 2, ctaY + 32);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('mini-esports.app', ctaX + ctaW / 2, ctaY + 54);
    ctx.textAlign = 'left';
    ctx.restore();

    /* ── CORNER DECORATIONS ── */
    [[14,14],[W-14,14],[14,H-14],[W-14,H-14]].forEach(function(pt, i) {
      var rot = [0, Math.PI/2, -Math.PI/2, Math.PI][i];
      ctx.save();
      ctx.translate(pt[0], pt[1]);
      ctx.rotate(rot);
      ctx.strokeStyle = 'rgba(0,255,156,0.6)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, 0); ctx.lineTo(16, 0); ctx.stroke();
      ctx.restore();
    });

    return canvas.toDataURL('image/jpeg', 0.93);
  }

  function shareMatch(matchId) {
    var match = window.MT && window.MT[matchId];
    if (!match) { if (window.toast) window.toast('Match data nahi mila', 'err'); return; }

    var imgData = generateShareCard(match);

    var h = '<div style="padding:0">';
    h += '<img src="' + imgData + '" style="width:100%;border-radius:14px;margin-bottom:14px;box-shadow:0 8px 32px rgba(0,255,156,0.2)">';
    h += '<div style="font-size:12px;color:var(--txt2);text-align:center;margin-bottom:12px">Yeh card share karo aur dosto ko bulao! 🔥</div>';
    h += '<a href="' + imgData + '" download="mini-esports-invite.jpg" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,rgba(0,255,156,.15),rgba(0,212,255,.08));color:#00d4ff;border:1px solid rgba(0,212,255,.25);font-weight:700;font-size:13px;text-decoration:none;margin-bottom:10px;box-sizing:border-box"><i class="fas fa-download"></i> Download Card</a>';

    var et = (match.entryType || '').toLowerCase();
    var entryTxt = et === 'coin' ? '🪙 ' + (match.entryFee||0) + ' Coins' : '₹' + (match.entryFee||0);
    var msg = '🔥 *Mini eSports Tournament Invite!*\n\n'
      + '🎮 *' + (match.name||'Match') + '*\n'
      + '💰 Entry: ' + entryTxt + '\n'
      + '🥇 1st Prize: ₹' + (match.firstPrize||match.prize1st||0) + '\n'
      + '⚡ Mode: ' + (match.mode||match.type||'SOLO').toUpperCase() + '\n\n'
      + 'Join karo: ' + window.location.href;

    h += '<a href="https://wa.me/?text=' + encodeURIComponent(msg) + '" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:700;font-size:13px;text-decoration:none;box-sizing:border-box"><i class="fab fa-whatsapp"></i> Share on WhatsApp</a>';
    h += '</div>';

    if (window.openModal) window.openModal('📤 Match Invite Card', h);
  }

  // Override shareMatch
  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.MT !== undefined) {
      clearInterval(_check);
      window.shareMatch = shareMatch;
    }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f20ShareCard = { generate: generateShareCard, share: shareMatch };
})();
