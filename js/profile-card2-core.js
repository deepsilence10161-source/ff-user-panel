/* ══════════════════════════════════════════════════════════════════
   PROFILE CARD v2 (D36, 04 Nov 2026) — owner ki di hui design ka
   100% exact replica. Base art = assets/profile/card_base.jpg (owner
   image se text-regions inpaint karke banaya gaya pure decoration);
   dynamic text (name, UID, Lv, tier, XP, pts, 5 stats) isi coordinate
   space (1323×1189) me render hota hai — HTML modal aur share-canvas
   dono me SAME table use hoti hai, isliye dono pixel-identical.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var W = 1323, H = 1189;
  var BASE = 'assets/profile/card_base.jpg';
  /* label table: cx,cy = centre (px @1323×1189), fs = font-size px, f = font style */
  var LBL = {
    name: { cx: 634, cy: 597, fs: 62, f: 'impact', col: '#ffffff' },
    uid:  { cx: 646, cy: 712, fs: 37, f: 'bold',   col: '#ffffff' },
    lv:   { cx: 230, cy: 848, fs: 44, f: 'bold',   col: '#ffffff' },
    tier: { cx: 648, cy: 849, fs: 44, f: 'impact', col: '#ffd75e' },
    title:{ cx: 722, cy: 530, fs: 44, f: 'impact', col: '#ffd75e' },
    xp:   { cx: 1050, cy: 810, fs: 29, f: 'bold',  col: '#ffffff' },
    s1:   { cx: 240,  cy: 998, fs: 42, f: 'bold',  col: '#ffffff' },
    s2:   { cx: 474,  cy: 998, fs: 42, f: 'bold',  col: '#ffffff' },
    s3:   { cx: 687,  cy: 998, fs: 42, f: 'bold',  col: '#ffffff' },
    s4:   { cx: 917,  cy: 998, fs: 42, f: 'bold',  col: '#ffffff' },
    s5:   { cx: 1147, cy: 998, fs: 42, f: 'bold',  col: '#ffffff' }
  };
  var BAR = { x: 743, y: 856, w: 308, h: 22 };
  /* max text widths (px @1323 space) — lambe naam/UID auto-shrink hote hain */
  var ALLOW = { name: 292, uid: 262, xp: 315, tier: 190, title: 300, lv: 100, s1: 90, s2: 90, s3: 90, s4: 90, s5: 90 };
  var BTNS = [
    { x: 898, y: 74, w: 96, h: 96, act: function () { if (window.showAssetGallery) window.showAssetGallery(); else if (window.toast) toast('Collection yahan khulegi', 'ok'); } },
    { x: 1034, y: 74, w: 96, h: 96, act: function () { if (window.toast) toast('Profile settings jald aa rahi hain', 'ok'); } },
    { x: 740, y: 369, w: 72, h: 72, act: function () { if (window.toast) toast('Name/UID edit: profile section me', 'ok'); } },
    /* ✅ D70: copy-icon hotspot — art me baked icon tha par click par kuch
       nahi hota tha (owner complaint). Ab UID copy hoti hai. */
    { x: 818, y: 674, w: 96, h: 96, act: function () {
        var d = window._pc2ProfData || {};
        var u = d.uid != null ? String(d.uid) : '';
        if (!u) { if (window.toast) toast('UID nahi mili', 'inf'); return; }
        if (window.copyTxt) window.copyTxt(u);
        else if (navigator.clipboard) navigator.clipboard.writeText(u).then(function(){ if (window.toast) toast('UID copy ho gayi', 'ok'); });
      } }
  ];
  function fontCss(l, s) {
    if (l.f === 'impact') return 'font-family:Impact,"Arial Black",Franklin Gothic Bold,sans-serif;font-style:italic;font-weight:900;letter-spacing:.5px;font-size:' + (l.fs * s).toFixed(1) + 'px';
    return 'font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:' + (l.fs * s).toFixed(1) + 'px';
  }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* data: {name,uid,level,xp,xpNeed,pts,tier,stats:[m,k,w,km,wr]} */
  function texts(d) {
    return {
      name: d.name || 'Player',
      uid: 'UID : ' + (d.uid || '—'),
      lv: 'Lv ' + (d.level == null ? 1 : d.level),
      tier: d.tier || 'Bronze',
      title: d.title || '',
      xp: (d.xp || 0) + ' / ' + (d.xpNeed || 10) + ' XP  •  ' + (d.pts || 0) + ' pts',
      s1: String(d.stats ? d.stats[0] : 0),
      s2: String(d.stats ? d.stats[1] : 0),
      s3: String(d.stats ? d.stats[2] : 0),
      s4: String(d.stats ? d.stats[3] : '0.0'),
      s5: String(d.stats ? d.stats[4] : '0%')
    };
  }

  function html(d) {
    var t = texts(d);
    var pct = Math.max(0, Math.min(100, (d.xp || 0) / Math.max(1, d.xpNeed || 10) * 100));
    var h = '<div class="pc2wrap" data-pc2="1" style="position:relative;width:100%;aspect-ratio:' + W + '/' + H + ';background:url(\'' + BASE + '?v=20261106e\') center/100% 100% no-repeat;border-radius:14px;overflow:hidden">';
    Object.keys(LBL).forEach(function (k) {
      var l = LBL[k];
      var skew = l.f === 'impact' ? ' skewX(-8deg);' : '';
      var shadow = k === 'name' ? 'text-shadow:0 2px 8px rgba(0,0,0,.75);' : (k === 'tier' ? 'text-shadow:0 2px 4px rgba(60,30,0,.8);' : 'text-shadow:0 1px 4px rgba(0,0,0,.7);');
      h += '<span data-pc2lbl="' + k + '" style="position:absolute;left:' + (l.cx / W * 100).toFixed(3) + '%;top:' + (l.cy / H * 100).toFixed(3) + '%;transform:translate(-50%,-50%)' + skew + ';' + shadow + 'color:' + l.col + ';white-space:nowrap;font-size:' + l.fs + 'px" data-fs="' + l.fs + '">' + esc(t[k]) + '</span>';
    });
    if (pct > 0) {
      h += '<div style="position:absolute;left:' + (BAR.x / W * 100).toFixed(2) + '%;top:' + (BAR.y / H * 100).toFixed(2) + '%;height:' + (BAR.h / H * 100).toFixed(2) + '%;width:' + (BAR.w * pct / 100 / W * 100).toFixed(2) + '%;background:linear-gradient(90deg,#00ff9c,#a4ff4d);border-radius:4px;box-shadow:0 0 10px rgba(0,255,150,.8)"></div>';
    }
    BTNS.forEach(function (b, i) {
      h += '<button data-pc2btn="' + i + '" aria-label="card action" style="position:absolute;left:' + (b.x / W * 100).toFixed(2) + '%;top:' + (b.y / H * 100).toFixed(2) + '%;width:' + (b.w / W * 100).toFixed(2) + '%;height:' + (b.h / H * 100).toFixed(2) + '%;background:transparent;border:0;cursor:pointer;border-radius:12px"></button>';
    });
    h += '</div>';
    return h;
  }

  function scaleWrap(wrap) {
    var w = wrap.clientWidth || 360;
    var s = w / W;
    wrap.querySelectorAll('[data-pc2lbl]').forEach(function (el) {
      var k = el.getAttribute('data-pc2lbl');
      el.style.fontSize = (Number(el.getAttribute('data-fs')) * s).toFixed(2) + 'px';
      var allowed = (ALLOW[k] || 9999) * s;
      var sw = el.scrollWidth;
      if (sw > allowed && sw > 0) el.style.fontSize = (parseFloat(el.style.fontSize) * allowed / sw).toFixed(2) + 'px';
    });
  }
  function bind(wrap, handlers) {
    scaleWrap(wrap);
    var acts = handlers || BTNS;
    wrap.querySelectorAll('[data-pc2btn]').forEach(function (el) {
      el.addEventListener('click', function () {
        var i = Number(el.getAttribute('data-pc2btn'));
        try { (acts[i] || BTNS[i]).act ? (acts[i] || BTNS[i]).act() : (acts[i] || BTNS[i])(); } catch (e) {}
      });
    });
    if (!window.__pc2Resize) {
      window.__pc2Resize = true;
      window.addEventListener('resize', function () {
        document.querySelectorAll('[data-pc2]').forEach(scaleWrap);
      });
    }
  }
  /* render into container (modal body etc.); handlers = optional [fn,fn,fn]
     jo default button-actions (gallery/gear/pencil) override karte hain */
  function mount(container, d, handlers) {
    container.innerHTML = html(d);
    var wrap = container.querySelector('[data-pc2]');
    if (wrap) bind(wrap, handlers);
    return wrap;
  }

  /* canvas draw (share image) — same table */
  function draw(ctx, d, cw, img) {
    var s = cw / W, ch = Math.round(cw * H / W);
    ctx.clearRect(0, 0, cw, ch);
    if (img) ctx.drawImage(img, 0, 0, cw, ch);
    var t = texts(d);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    Object.keys(LBL).forEach(function (k) {
      var l = LBL[k];
      ctx.save();
      ctx.translate(l.cx * s, l.cy * s);
      var fs = l.fs * s;
      if (l.f === 'impact') { ctx.transform(1, 0, -0.14, 1, 0, 0); ctx.font = '900 ' + fs.toFixed(1) + 'px Impact,"Arial Black",sans-serif'; }
      else ctx.font = '800 ' + fs.toFixed(1) + 'px Arial,sans-serif';
      var allowed = (ALLOW[k] || 9999) * s;
      var tw = ctx.measureText(t[k]).width;
      if (tw > allowed && tw > 0) { fs = fs * allowed / tw; ctx.font = (l.f === 'impact' ? '900 ' : '800 ') + fs.toFixed(1) + 'px ' + (l.f === 'impact' ? 'Impact,"Arial Black",sans-serif' : 'Arial,sans-serif'); }
      if (k === 'name') { ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 8 * s; ctx.shadowOffsetY = 2 * s; }
      if (k === 'tier') { ctx.lineWidth = 5 * s; ctx.strokeStyle = 'rgba(60,30,0,.85)'; ctx.strokeText(t[k], 0, 0); }
      ctx.fillStyle = l.col;
      ctx.fillText(t[k], 0, 0);
      ctx.restore();
    });
    var pct = Math.max(0, Math.min(100, (d.xp || 0) / Math.max(1, d.xpNeed || 10) * 100));
    if (pct > 0) {
      var g = ctx.createLinearGradient(BAR.x * s, 0, (BAR.x + BAR.w) * s, 0);
      g.addColorStop(0, '#00ff9c'); g.addColorStop(1, '#a4ff4d');
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(0,255,150,.8)'; ctx.shadowBlur = 10 * s;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(BAR.x * s, BAR.y * s, BAR.w * s * pct / 100, BAR.h * s, 4 * s); else ctx.rect(BAR.x * s, BAR.y * s, BAR.w * s * pct / 100, BAR.h * s);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    return ch;
  }
  function loadImg(cb) {
    var im = new Image();
    im.onload = function () { cb(im); };
    im.onerror = function () { cb(null); };
    im.src = BASE + '?v=20261106e';
  }
  window.PCARD2 = { W: W, H: H, BASE: BASE, html: html, mount: mount, draw: draw, loadImg: loadImg, scaleWrap: scaleWrap };
  console.log('[Mini eSports] ✅ Profile Card v2 core loaded (exact-replica)');
})();
