/* ══════════════════════════════════════════════════════════════════
   PROFILE CARD v2 (D36, 04 Nov 2026) — owner ki di hui design ka
   100% exact replica.  D77 (06 Nov 2026, owner complaint "profile
   photo/banner update nahi hoti"): ab koi bhi dynamic cheez art me
   BAKED nahi — card 4 layers se banta hai:
     1) BACKGROUND  = user ka banner (banner_url); na ho to default
                      scene art (card_scene.jpg)
     2) AVATAR      = user ki asli photo (avatar_url) circular clip me;
                      na ho to ring ka khali center dikhta hai
     3) FRAME       = card_frame.png (transparent PNG — ring, crown,
                      wreaths, shield, pencil, plates, wings, hexagon,
                      medal, XP bar, stats bar, border glow, buttons)
     4) TEXT/BAR    = dynamic labels (name, UID, Lv, tier, XP, pts,
                      5 stats) — same coordinate table (1323×1189),
                      HTML modal aur share-canvas dono pixel-identical.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var W = 1323, H = 1189;
  var STAMP = '20261106b';
  var FRAME = 'assets/profile/card_frame.png';
  var SCENE = 'assets/profile/card_scene.jpg';
  /* avatar circle (ring ka inner hole) — 1323×1189 space me */
  var AV = { cx: 661, cy: 296, r: 158 };
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
    { x: 1034, y: 74, w: 96, h: 96, act: function () { if (window.showProfileSettings) window.showProfileSettings(); else if (window.toast) toast('Profile settings jald aa rahi hain', 'ok'); } },
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
  function escUrl(u) { return String(u).replace(/"/g, '%22').replace(/'/g, '%27'); }

  /* data: {name,uid,level,xp,xpNeed,pts,tier,title,stats:[m,k,w,km,wr],
            photo: avatar_url, banner: banner_url} */
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
    /* LAYER 1 — background: asli banner, warna default scene art */
    var bg = d.banner ? escUrl(d.banner) : SCENE + '?v=' + STAMP;
    var h = '<div class="pc2wrap" data-pc2="1" style="position:relative;width:100%;aspect-ratio:' + W + '/' + H + ';background:url(\'' + bg + '\') center/cover no-repeat;border-radius:14px;overflow:hidden;background-color:#0a0e2e">';
    /* LAYER 2 — asli profile photo (circular), ring ke hole me */
    if (d.photo) {
      h += '<img data-pc2av="1" src="' + escUrl(d.photo) + '" alt="" style="position:absolute;z-index:1;left:' + ((AV.cx - AV.r) / W * 100).toFixed(2) + '%;top:' + ((AV.cy - AV.r) / H * 100).toFixed(2) + '%;width:' + (AV.r * 2 / W * 100).toFixed(2) + '%;height:' + (AV.r * 2 / H * 100).toFixed(2) + '%;border-radius:50%;object-fit:cover;object-position:center 20%">';
    }
    /* LAYER 3 — transparent frame PNG (ring/crown/plates/stats bar…) */
    h += '<img data-pc2frame="1" src="' + FRAME + '?v=' + STAMP + '" alt="" style="position:absolute;z-index:2;left:0;top:0;width:100%;height:100%;pointer-events:none">';
    /* LAYER 4 — dynamic text + XP bar + click hotspots */
    Object.keys(LBL).forEach(function (k) {
      var l = LBL[k];
      var skew = l.f === 'impact' ? ' skewX(-8deg);' : '';
      var shadow = k === 'name' ? 'text-shadow:0 2px 8px rgba(0,0,0,.75);' : (k === 'tier' ? 'text-shadow:0 2px 4px rgba(60,30,0,.8);' : 'text-shadow:0 1px 4px rgba(0,0,0,.7);');
      h += '<span data-pc2lbl="' + k + '" style="position:absolute;z-index:3;left:' + (l.cx / W * 100).toFixed(3) + '%;top:' + (l.cy / H * 100).toFixed(3) + '%;transform:translate(-50%,-50%)' + skew + ';' + shadow + 'color:' + l.col + ';white-space:nowrap;font-size:' + l.fs + 'px" data-fs="' + l.fs + '">' + esc(t[k]) + '</span>';
    });
    if (pct > 0) {
      h += '<div style="position:absolute;z-index:3;left:' + (BAR.x / W * 100).toFixed(2) + '%;top:' + (BAR.y / H * 100).toFixed(2) + '%;height:' + (BAR.h / H * 100).toFixed(2) + '%;width:' + (BAR.w * pct / 100 / W * 100).toFixed(2) + '%;background:linear-gradient(90deg,#00ff9c,#a4ff4d);border-radius:4px;box-shadow:0 0 10px rgba(0,255,150,.8)"></div>';
    }
    BTNS.forEach(function (b, i) {
      h += '<button data-pc2btn="' + i + '" aria-label="card action" style="position:absolute;z-index:4;left:' + (b.x / W * 100).toFixed(2) + '%;top:' + (b.y / W * 0 + b.y / H * 100).toFixed(2) + '%;width:' + (b.w / W * 100).toFixed(2) + '%;height:' + (b.h / H * 100).toFixed(2) + '%;background:transparent;border:0;cursor:pointer;border-radius:12px"></button>';
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
  /* ✅ D79 (06 Nov 2026, owner dobara complaint): button actions ab CORE me
     hardcoded + click-time late-bound — kisi handlers array / load-order /
     purane cache se mapping toot hi nahi sakti. own=1 par pencil photo
     upload; doosre user ke card par pencil = guidance toast. */
  function runAct(i, wrap) {
    var own = wrap && wrap.getAttribute('data-pc2own') === '1';
    try {
      if (i === 0) {
        if (window.showAssetGallery) window.showAssetGallery();
        else if (window.toast) toast('Collection load nahi hui — app refresh karo', 'err');
      } else if (i === 1) {
        if (window.showProfileSettings) {
          /* gear = hamesha FRESH sheet (toggle-close se "khulti hi nahi"
             wala bug namumkin) */
          var ex = document.getElementById('profSettingsSheet');
          if (ex && window.closeProfileSettings) window.closeProfileSettings();
          window.showProfileSettings();
        } else if (window.toast) toast('Settings load nahi hui — app refresh karo', 'err');
      } else if (i === 2) {
        if (own) {
          var pi = document.getElementById('profImgIn');
          if (pi) pi.click();
          else if (window.showProfileSettings) window.showProfileSettings();
        } else if (window.toast) toast('Apni profile par photo edit karo', 'inf');
      } else if (i === 3) {
        var d = window._pc2ProfData || {};
        var u = d.uid != null ? String(d.uid) : '';
        if (!u) { if (window.toast) toast('UID nahi mili', 'inf'); return; }
        if (window.copyTxt) window.copyTxt(u);
        else if (navigator.clipboard) navigator.clipboard.writeText(u).then(function(){ if (window.toast) toast('UID copy ho gayi', 'ok'); });
      }
    } catch (e) {
      if (window.toast) toast('Action fail: ' + (e && e.message ? e.message : 'retry'), 'err');
    }
  }
  function bind(wrap, handlers) {
    scaleWrap(wrap);
    wrap.querySelectorAll('[data-pc2btn]').forEach(function (el) {
      el.addEventListener('click', function () {
        runAct(Number(el.getAttribute('data-pc2btn')), wrap);
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
  function mount(container, d, handlers, opts) {
    container.innerHTML = html(d);
    var wrap = container.querySelector('[data-pc2]');
    if (wrap) {
      if (opts && opts.own) wrap.setAttribute('data-pc2own', '1');
      bind(wrap, handlers);
    }
    return wrap;
  }

  /* ── canvas (share image) — same 4 layers, same table ── */
  function _cover(ctx, img, cw, ch) {
    var ir = img.width / img.height, cr = cw / ch;
    var sw, sh, sx, sy;
    if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  }
  function draw(ctx, d, cw, imgs) {
    var s = cw / W, ch = Math.round(cw * H / W);
    ctx.clearRect(0, 0, cw, ch);
    /* LAYER 1 */
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.clip();
    ctx.fillStyle = '#0a0e2e'; ctx.fillRect(0, 0, cw, ch);
    var bgImg = (imgs && (imgs.banner || imgs.scene)) || null;
    if (bgImg) _cover(ctx, bgImg, cw, ch);
    /* LAYER 2 — photo circular clip (box me cover-crop) */
    if (imgs && imgs.photo) {
      var bx = (AV.cx - AV.r) * s, by = (AV.cy - AV.r) * s, bw = AV.r * 2 * s;
      ctx.save();
      ctx.beginPath();
      ctx.arc(AV.cx * s, AV.cy * s, AV.r * s, 0, Math.PI * 2);
      ctx.clip();
      var p = imgs.photo, ir = p.width / p.height;
      var sw2, sh2, sx2, sy2;
      if (ir > 1) { sh2 = p.height; sw2 = sh2; sx2 = (p.width - sw2) / 2; sy2 = 0; }
      else { sw2 = p.width; sh2 = sw2; sx2 = 0; sy2 = (p.height - sh2) / 2; }
      ctx.drawImage(p, sx2, sy2, sw2, sh2, bx, by, bw, bw);
      ctx.restore();
    }
    ctx.restore();
    /* LAYER 3 — frame */
    if (imgs && imgs.frame) ctx.drawImage(imgs.frame, 0, 0, cw, ch);
    /* LAYER 4 — text */
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
  /* share-flow helper: frame+scene hamesha, photo/banner data se */
  function loadImgs(d, cb) {
    var out = { frame: null, scene: null, photo: null, banner: null };
    var pend = 2 + (d && d.photo ? 1 : 0) + (d && d.banner ? 1 : 0);
    function done() { pend--; if (pend <= 0) cb(out); }
    function load(src, key) {
      var im = new Image();
      /* crossOrigin sirf http(s) par (canvas share ke liye); file:// preview
         me CORS block hota hai — wahan bina crossOrigin load karo. */
      if (/^https?:/.test(location.protocol)) im.crossOrigin = 'anonymous';
      im.onload = function () { out[key] = im; done(); };
      im.onerror = function () { done(); };
      im.src = src;
    }
    load(FRAME + '?v=' + STAMP, 'frame');
    load(SCENE + '?v=' + STAMP, 'scene');
    if (d && d.photo) load(d.photo, 'photo');
    if (d && d.banner) load(d.banner, 'banner');
  }
  /* purana naam backward-compat ke liye (ab loadImgs hi use karo) */
  function loadImg(cb) { loadImgs(null, function (o) { cb(o.frame); }); }
  window.PCARD2 = { W: W, H: H, BASE: FRAME, FRAME: FRAME, SCENE: SCENE, AV: AV, html: html, mount: mount, draw: draw, loadImg: loadImg, loadImgs: loadImgs, scaleWrap: scaleWrap };
  console.log('[Mini eSports] ✅ Profile Card v2 core loaded (exact-replica, dynamic photo/banner layers)');
})();
