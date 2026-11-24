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
  /* ✅ D103 z22: frame PNG me baked English stat-labels; Hindi variant swap */
  function frameAsset() {
    try { if ((window._lang || localStorage.getItem('appLang') || 'hi') === 'hi') return 'assets/profile/card_frame_hi.png'; } catch (e) {}
    return FRAME;
  }
  var SCENE = 'assets/profile/card_scene.jpg';
  /* avatar circle (ring ka inner hole) — 1323×1189 space me */
  var AV = { cx: 661, cy: 296, r: 158 };
  /* label table: cx,cy = centre (px @1323×1189), fs = font-size px, f = font style */
  var LBL = {
    name: { cx: 634, cy: 597, fs: 62, f: 'impact', col: '#ffffff' },
    uid:  { cx: 646, cy: 712, fs: 37, f: 'bold',   col: '#ffffff' },
    lv:   { cx: 230, cy: 848, fs: 44, f: 'bold',   col: '#ffffff' },
    tier: { cx: 648, cy: 849, fs: 44, f: 'impact', col: '#ffd75e' },
    title:{ cx: 664, cy: 528, fs: 44, f: 'impact', col: '#ffd75e' }, /* ✅ D101: plate CENTER (pixel-probe 664) — pehle 722 tha → title right-shift dikhta tha */
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
  /* ✅ D80 (06 Nov 2026, owner: "gallery se settings khuli, gear se kuch nahi"):
     frame PNG ke visible icons grid-map se measure kiye gaye aur hotspots
     UNKE exactly neeche rakhe gaye (pehle ye do top hotspots ~8% left the —
     image icon settings-hotspot par aur gear dead-zone me tha):
       image-icon square  x 76-83%,  y 7-15%   => btn0
       gear square        x 85.5-93.5%, y 7-15% => btn1
       pencil circle      centre 59.5%, 35.5%  => btn2
       copy purple square centre 65%, 62.5%    => btn3 */
  var BTNS = [
    { x: 1006, y: 80, w: 96, h: 100, act: function () { if (window.showAssetGallery) window.showAssetGallery(); else if (window.toast) toast('Collection yahan khulegi', 'ok'); } },
    { x: 1136, y: 80, w: 96, h: 100, act: function () { if (window.showProfileSettings) window.showProfileSettings(); else if (window.toast) toast('Profile settings jald aa rahi hain', 'ok'); } },
    { x: 739, y: 374, w: 96, h: 96, act: function () { if (window.toast) toast('Name/UID edit: profile section me', 'ok'); } },
    /* ✅ D70: copy-icon hotspot — art me baked icon tha par click par kuch
       nahi hota tha (owner complaint). Ab UID copy hoti hai. */
    { x: 812, y: 695, w: 96, h: 96, act: function () {
        var d = (wrap && wrap._pc2d) || window._pc2ProfData || {};
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

  /* ✅ D96 (2026-11-09, owner live report): "banner border line se bahar ja
     raha hai" — purana code user ka custom banner POORI card par full-bleed
     background lagata tha, jabki frame PNG transparent hai → banner frame
     ki border-line ke BAHAR ke margins me bhi dikhta tha (red TQ-Kings
     banner wale card me saaf dikha). Ab custom banner SIRF frame ki inner
     window me clip hota hai (window rect frame PNG ke opaque border-line
     runs se pngjs se measure kiya gaya: 1086×976 asset me left line x≈29-35,
     right x≈1050-1056, top y≈32-37, bottom y≈938-943 → % insets neeche).
     Default scene (bina banner) pehle jaisa full-bleed hi rehta hai
     (owner-approved replica look). */
  var BWIN = { l: 3.25, r: 3.35, t: 3.85, b: 3.95 }; /* % insets — frame line ke andar */
  /* ✅ D102 (owner: "profile card me 🥇 chipka hua"): card_frame.png ke tier-pill
     ke andar BAKED blue-ribbon medal icon tha (emoji-jaisa art; pixel-probe
     frame-px x390-444, y656-732). D100-F3b title-cover wala hi tarika: dark
     cover patch + upar dynamic ASLI rank asset (tier ke hisaab se). */
  var TIERCV = { l: 35.3, t: 66.9, w: 5.9, h: 8.5 };
  function _tierAsset(t) {
    t = String(t || '').toLowerCase();
    var f = t.indexOf('silver') === 0 ? 'silver' : t.indexOf('gold') === 0 ? 'gold'
          : t.indexOf('platinum') === 0 ? 'platinum' : t.indexOf('diamond') === 0 ? 'diamond'
          : t.indexOf('legend') === 0 ? 'legend' : 'bronze';
    return 'assets/img/ranks/' + f + '.png';
  }

  function html(d) {
    var t = texts(d);
    var pct = Math.max(0, Math.min(100, (d.xp || 0) / Math.max(1, d.xpNeed || 10) * 100));
    /* LAYER 1 — background: bina banner = default scene art full-bleed;
       banner wale card me margins clean dark rehte hain (D96) */
    var bg = d.banner ? '' : SCENE + '?v=' + STAMP;
    var h = '<div class="pc2wrap" data-pc2="1" style="position:relative;width:100%;aspect-ratio:' + W + '/' + H + ';' + (bg ? 'background:url(\'' + bg + '\') center/cover no-repeat;' : '') + 'border-radius:14px;overflow:hidden;background-color:#0a0e2e">';
    /* LAYER 1b — ✅ D96: asli banner SIRF frame-window ke andar */
    if (d.banner) {
      h += '<div data-pc2win="1" style="position:absolute;z-index:0;left:' + BWIN.l + '%;right:' + BWIN.r + '%;top:' + BWIN.t + '%;bottom:' + BWIN.b + '%;background:url(\'' + escUrl(d.banner) + '\') center/cover no-repeat;border-radius:10px;box-shadow:inset 0 0 40px rgba(0,0,0,.55)"></div>';
    }
    /* LAYER 2 — asli profile photo (circular), ring ke hole me */
    if (d.photo) {
      h += '<img data-pc2av="1" src="' + escUrl(d.photo) + '" alt="" style="position:absolute;z-index:1;left:' + ((AV.cx - AV.r) / W * 100).toFixed(2) + '%;top:' + ((AV.cy - AV.r) / H * 100).toFixed(2) + '%;width:' + (AV.r * 2 / W * 100).toFixed(2) + '%;height:' + (AV.r * 2 / H * 100).toFixed(2) + '%;border-radius:50%;object-fit:cover;object-position:center 20%">';
    }
    /* LAYER 3 — transparent frame PNG (ring/crown/plates/stats bar…) */
    h += '<img data-pc2frame="1" src="' + frameAsset() + '?v=' + STAMP + '" alt="" style="position:absolute;z-index:2;left:0;top:0;width:100%;height:100%;pointer-events:none">';
    /* ✅ D100-F3b (owner: "⚡ symbols card par chipke bina data ke nahi"):
       frame PNG ke title-plate inner zone me BAKED ⚡🎯 decor pixels the
       (pixel-probe: 407 bright px). Ye data nahi, art tha — par owner order
       clean title hai. Isliye plate-inner par dark cover patch (z=frame ke
       baad, text se pehle) — baked decor chhupta hai, dynamic CLEAN title
       text (LAYER 4) upar dikhta hai. Title khali ho to plate bilkul saaf.
       Gold chevron border zone ke BAHAR hai — replica look intact. */
    h += '<div data-pc2tcover="1" style="position:absolute;z-index:2;left:33.4%;top:41.6%;width:33.2%;height:5.1%;background:#191108;border-radius:4px;pointer-events:none"></div>';
    /* ✅ D102: baked medal-emoji cover + dynamic tier asset (HTML render) */
    h += '<div data-pc2tiercover="1" style="position:absolute;z-index:2;left:' + TIERCV.l + '%;top:' + TIERCV.t + '%;width:' + TIERCV.w + '%;height:' + TIERCV.h + '%;background:#241600;border-radius:6px;pointer-events:none"></div>';
    h += '<img data-pc2tiericon="1" src="' + _tierAsset(d.tier) + '?v=' + STAMP + '" alt="" style="position:absolute;z-index:3;left:' + (TIERCV.l + 0.5) + '%;top:' + (TIERCV.t + 0.6) + '%;width:' + (TIERCV.w - 1.0) + '%;height:' + (TIERCV.h - 1.2) + '%;object-fit:contain;pointer-events:none">';
    /* LAYER 3.5 — D82+D96: premium tag + VIP chip + earned badges mini-row
       (medal-row ke neeche dark strip me, right-aligned).
       ✅ D96 (owner: "premium sahi se show hi nahi ho raha — wo premium
       user ki nishani aur izzat hai"): purani row patli (4.4%) + fixed 9px
       font + overflow:hidden thi → chips katte/ghuste the. Ab: poori strip
       (frame-window ke andar), font card-size ke saath scale hota hai
       (scaleWrap data-pc2chips), premium chip SOLID GOLD gradient pill
       (glow ke saath) — kabhi nahi katta, koi overlap nahi. */
    var _chips = '';
    /* ✅ D103 (owner: "premium badge aur tag perfectly show hona chahiye,
       position perfectly set kar"): chip ab TIER ke hisaab se rang (Silver=
       steel, Gold=gold, Diamond=ice-blue) + ASLI transparent tier icon —
       pehle har tier par ek jaisa GOLD pill + sirf text tha (icon <img>
       strip kar diya jata tha), aur public player-card prem HTML bhejta tha
       jo esc() hoke literal "<img …>" text ban jata tha. premHtml trusted hai
       (sirf premTierIcon/premTierName se banta hai); fallback esc(d.prem). */
    var _pl = Number(d.premLevel) || 0;
    var _premInner = d.premHtml ? String(d.premHtml) : (d.prem ? esc(d.prem) : '');
    if (_premInner) {
      var _pg = _pl >= 3 ? 'linear-gradient(135deg,#9ff1ff,#4f7bff)' : _pl === 1 ? 'linear-gradient(135deg,#f5f8ff,#a9b8cc)' : 'linear-gradient(135deg,#ffd75e,#ff9c00)';
      var _ptx = _pl >= 3 ? '#08243c' : _pl === 1 ? '#232833' : '#2b1a00';
      var _pgl = _pl >= 3 ? 'rgba(120,200,255,.6)' : _pl === 1 ? 'rgba(220,230,255,.5)' : 'rgba(255,190,0,.55)';
      _chips += '<span style="display:inline-flex;align-items:center;gap:.4em;padding:.34em 1em;border-radius:999px;font-size:.82em;font-weight:900;letter-spacing:.4px;background:' + _pg + ';color:' + _ptx + ';white-space:nowrap;box-shadow:0 0 12px ' + _pgl + ',0 1px 3px rgba(0,0,0,.5)">' + _premInner + '</span>';
    }
    /* ✅ D103: ⭐ emoji ki jagah ASLI crown asset (D100: emoji nahi jab asli
       asset available ho) */
    if (d.vip) _chips += '<span style="display:inline-flex;align-items:center;gap:.35em;padding:.3em .9em;border-radius:999px;font-size:.78em;font-weight:900;background:rgba(255,215,0,.14);border:1px solid rgba(255,215,0,.6);color:#ffd700;white-space:nowrap"><img src="assets/img/icons/crown.png?v=' + STAMP + '" alt="" style="height:1.15em;width:1.15em;object-fit:contain"> VIP</span>';
    (d.badges || []).forEach(function (bi) {
      _chips += '<img src="' + escUrl(bi) + '" alt="" style="height:1.7em;aspect-ratio:1;object-fit:contain;border-radius:.4em">';
    });
    if (_chips) {
      h += '<div data-pc2chips="1" style="position:absolute;z-index:3;left:3.6%;right:3.4%;top:75.2%;height:6.2%;display:flex;align-items:center;justify-content:flex-end;gap:.4em;font-size:30px">' + _chips + '</div>';
    }
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
    /* ✅ D96: chips row ka font bhi card-size ke saath scale — taaki premium
       chip kabhi na kate (fixed 9px wala purana bug) */
    wrap.querySelectorAll('[data-pc2chips]').forEach(function (el) {
      el.style.fontSize = (30 * s).toFixed(2) + 'px';
    });
  }
  /* ✅ D79 (06 Nov 2026, owner dobara complaint): button actions ab CORE me
     hardcoded + click-time late-bound — kisi handlers array / load-order /
     purane cache se mapping toot hi nahi sakti. own=1 par pencil photo
     upload; doosre user ke card par pencil = guidance toast. */
  function runAct(i, wrap) {
    var own = wrap && wrap.getAttribute('data-pc2own') === '1';
    var pub = wrap && wrap.getAttribute('data-pc2pub') === '1';
    try {
      /* ✅ D83: doosre user ke card par gallery/gear = own-only sections;
         frame art me baked icons hide nahi ho sakte, isliye pencil-jaisa
         guidance toast (D79 precedent) — dead tap nahi, galat action nahi. */
      if (pub && (i === 0 || i === 1)) {
        if (window.toast) toast('Ye section sirf apni profile card par hota hai', 'inf');
        return;
      }
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
        var d = (wrap && wrap._pc2d) || window._pc2ProfData || {};
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
      wrap._pc2d = d; /* ✅ D83: UID copy har mounted card ka APNA uid kare */
      if (opts && opts.own) wrap.setAttribute('data-pc2own', '1');
      /* ✅ D83 (owner: searched user ka card bhi wahi replica): doosre user
         ke card par OWN-action buttons (gallery/gear) gumrah karenge —
         public mount par wo hide; pencil = guidance toast (pehle se). */
      if (opts && opts.public) wrap.setAttribute('data-pc2pub', '1');
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
    var bgImg = (imgs && imgs.scene) || null;
    if (bgImg && !d.banner) _cover(ctx, bgImg, cw, ch); /* banner wale card me margins dark (HTML jaisa) */
    /* ✅ D96: share-image me bhi banner SIRF frame-window ke andar
       (HTML render jaisa hi — warna share card me banner bahar dikhta) */
    if (d.banner && imgs && imgs.banner) {
      var wx = BWIN.l / 100 * cw, wy = BWIN.t / 100 * ch;
      var ww = cw - wx - (BWIN.r / 100 * cw), wh = ch - wy - (BWIN.b / 100 * ch);
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(wx, wy, ww, wh, 10 * s); else ctx.rect(wx, wy, ww, wh);
      ctx.clip();
      var bi = imgs.banner, ir0 = bi.width / bi.height, cr0 = ww / wh;
      var sw0, sh0, sx0, sy0;
      if (ir0 > cr0) { sh0 = bi.height; sw0 = sh0 * cr0; sx0 = (bi.width - sw0) / 2; sy0 = 0; }
      else { sw0 = bi.width; sh0 = sw0 / cr0; sx0 = 0; sy0 = (bi.height - sh0) / 2; }
      ctx.drawImage(bi, sx0, sy0, sw0, sh0, wx, wy, ww, wh);
      ctx.restore();
    }
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
    /* ✅ D102: baked medal-emoji cover + dynamic tier asset (share canvas bhi identical) */
    ctx.fillStyle = '#241600';
    ctx.fillRect(TIERCV.l / 100 * cw, TIERCV.t / 100 * ch, TIERCV.w / 100 * cw, TIERCV.h / 100 * ch);
    if (imgs && imgs.tier) ctx.drawImage(imgs.tier, (TIERCV.l + 0.5) / 100 * cw, (TIERCV.t + 0.6) / 100 * ch, (TIERCV.w - 1.0) / 100 * cw, (TIERCV.h - 1.2) / 100 * ch);
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
    var out = { frame: null, scene: null, photo: null, banner: null, tier: null };
    var pend = 3 + (d && d.photo ? 1 : 0) + (d && d.banner ? 1 : 0);
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
    load(frameAsset() + '?v=' + STAMP, 'frame');
    load(SCENE + '?v=' + STAMP, 'scene');
    load(_tierAsset(d && d.tier) + '?v=' + STAMP, 'tier');
    if (d && d.photo) load(d.photo, 'photo');
    if (d && d.banner) load(d.banner, 'banner');
  }
  /* purana naam backward-compat ke liye (ab loadImgs hi use karo) */
  function loadImg(cb) { loadImgs(null, function (o) { cb(o.frame); }); }
  window.PCARD2 = { W: W, H: H, BASE: FRAME, FRAME: FRAME, SCENE: SCENE, AV: AV, html: html, mount: mount, draw: draw, loadImg: loadImg, loadImgs: loadImgs, scaleWrap: scaleWrap };
  console.log('[Mini eSports] ✅ Profile Card v2 core loaded (exact-replica, dynamic photo/banner layers)');
})();
