/* ================================================================
   MINI eSPORTS — fixes-v9.js
   1. Wallet loading guarantee
   2. Profile avatar background color picker
   3. Replace 💚 emoji with real green diamond image in DOM
   4. Rank - no earning/city tab
   ================================================================ */
(function(){
'use strict';

var GD_SRC = 'js/green-diamond.png';
var GD = '<img src="' + GD_SRC + '" style="width:14px;height:14px;vertical-align:middle;object-fit:contain;display:inline-block">';
var GD_LG = '<img src="' + GD_SRC + '" style="width:20px;height:20px;vertical-align:middle;object-fit:contain;display:inline-block">';
window.GD_ICON = GD;
window.GD_ICON_LG = GD_LG;
window.fmtGD = function(v){ return GD + ' <span style="color:#00ff64;font-weight:800">' + (Number(v)||0) + '</span>'; };

var GREEN_DIAMOND_EMOJI = '\uD83D\uDCAA'.charAt(0) === '\uD83D' ? null : null; // not used
// Use unicode codepoint to avoid the emoji being replaced at build time
var GD_EMOJI_CP = '\u{1F49A}'; // 💚

function wait(fn, cb, ms){
  var e=0, t=setInterval(function(){
    e+=150;
    if(fn()){ clearInterval(t); cb(); }
    else if(e>=(ms||12000)) clearInterval(t);
  }, 150);
}

/* ============================================================
   1. WALLET LOADING — Triple guarantee
   ============================================================ */
wait(function(){ return typeof window.navTo==='function' && !window._v9wWrap; }, function(){
  window._v9wWrap = true;
  var _o = window.navTo;
  window.navTo = function(s){
    try{ _o.call(this, s); } catch(e){}
    if(s === 'wallet'){
      [80, 300, 700].forEach(function(d){
        setTimeout(function(){
          var wm = document.getElementById('walletMain');
          var wf = document.getElementById('walletFlow');
          if(!wm) return;
          if(wm.style.display === 'none') wm.style.display = '';
          if(wf && wf.style.display !== 'none') wf.style.display = 'none';
          try{ if(window.renderWallet) renderWallet(); } catch(e){}
        }, d);
      });
    }
  };
});

/* ============================================================
   2. AVATAR BACKGROUND COLOR PICKER
   ============================================================ */
var BG_COLORS = [
  {l:'\u2B1B Default Dark', v:'#0d0d1a'},
  {l:'\uD83D\uDD35 Blue',    v:'linear-gradient(135deg,#001a4d,#003399)'},
  {l:'\uD83D\uDFE3 Purple',  v:'linear-gradient(135deg,#1a0033,#4d0099)'},
  {l:'\uD83D\uDFE2 Green',   v:'linear-gradient(135deg,#001a0d,#004d26)'},
  {l:'\uD83D\uDD34 Red',     v:'linear-gradient(135deg,#1a0000,#4d0000)'},
  {l:'\uD83D\uDFE0 Orange',  v:'linear-gradient(135deg,#1a0d00,#4d2600)'},
  {l:'\u26AB Black',         v:'#000000'},
  {l:'\uD83C\uDF0C Galaxy',  v:'linear-gradient(135deg,#060616,#12023a)'},
  {l:'\uD83C\uDF0A Ocean',   v:'linear-gradient(135deg,#001933,#003366)'},
  {l:'\uD83D\uDD25 Fire',    v:'linear-gradient(135deg,#1a0000,#660000)'},
  {l:'\uD83D\uDC8E Diamond', v:'linear-gradient(135deg,#001a33,#004466)'},
  {l:'\uD83C\uDF38 Pink',    v:'linear-gradient(135deg,#1a0014,#4d003d)'},
];

window.showAvatarBgPicker = function(){
  var ex = document.getElementById('_avaBgSheet');
  if(ex){ ex.remove(); return; }
  var cur = (window.UD && window.UD.avatarBgColor) || '#0d0d1a';
  var sh = document.createElement('div');
  sh.id = '_avaBgSheet';
  sh.style.cssText = 'position:fixed;inset:0;z-index:9600;display:flex;flex-direction:column;justify-content:flex-end';
  var ov = document.createElement('div');
  ov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(5px)';
  ov.onclick = function(){ sh.remove(); };
  var pn = document.createElement('div');
  pn.style.cssText = 'position:relative;background:#111;border-radius:24px 24px 0 0;padding:20px 16px 36px;max-height:75vh;overflow-y:auto';
  var h = '<div style="display:flex;justify-content:center;padding:0 0 14px"><div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.15)"></div></div>';
  h += '<div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:16px">\uD83C\uDFA8 Profile Icon Background</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  BG_COLORS.forEach(function(c){
    var active = cur === c.v;
    h += '<div onclick="window._pickAvatarBg(\'' + c.v.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')" style="padding:14px 12px;border-radius:14px;background:' + c.v + ';border:' + (active?'2px solid #00ff9c':'1px solid rgba(255,255,255,.12)') + ';cursor:pointer;display:flex;align-items:center;justify-content:space-between;min-height:52px">';
    h += '<span style="font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.9)">' + c.l + '</span>';
    if(active) h += '<span style="color:#00ff9c;font-size:18px">\u2713</span>';
    h += '</div>';
  });
  h += '</div>';
  pn.innerHTML = h;
  sh.appendChild(ov);
  sh.appendChild(pn);
  document.body.appendChild(sh);
};

window._pickAvatarBg = function(val){
  if(!window.U) return;
  /* Bug High #10 Fix: Dual-write to Firebase + Supabase for cross-device persistence. */
  function _afterSave() {
    if(window.UD) window.UD.avatarBgColor = val;
    var sh = document.getElementById('_avaBgSheet');
    if(sh) sh.remove();
    try{ if(window.renderProfile) renderProfile(); } catch(e){}
    if(window.toast) toast('Profile background updated! \u2705', 'ok');
  }
  if(window.db) {
    window.db.ref('users/' + window.U.uid + '/avatarBgColor').set(val, function(){ _afterSave(); });
  } else { _afterSave(); }
  // Supabase — cross-device sync
  if(window._supa) {
    window._supa.from('users').update({ avatar_bg_color: val }).eq('id', window.U.uid)  /* Bug C-5 Fix: correct column name */
      .catch(function(e){ console.warn('[AvatarBg] Supabase save failed:', e.message); });
  }
};

/* Wrap renderProfile to apply bg color + add picker button */
wait(function(){ return typeof window.renderProfile==='function' && !window._v9rpWrap; }, function(){
  window._v9rpWrap = true;
  var _o = window.renderProfile;
  window.renderProfile = function(){
    _o.apply(this, arguments);
    setTimeout(function(){
      var pc = document.getElementById('profileContent'); if(!pc) return;
      var ava = pc.querySelector('.prof-ava');
      if(ava && window.UD && window.UD.avatarBgColor){
        ava.style.background = window.UD.avatarBgColor;
      }
      var wrap = pc.querySelector('.prof-ava-wrap');
      if(wrap && !wrap.querySelector('#_avaBgBtn')){
        var btn = document.createElement('div');
        btn.id = '_avaBgBtn';
        btn.title = 'Change background';
        btn.style.cssText = 'position:absolute;bottom:-8px;right:-8px;width:22px;height:22px;border-radius:50%;' +
          'background:linear-gradient(135deg,#b964ff,#00d4ff);border:2px solid #050507;' +
          'display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:5;font-size:10px;flex-shrink:0';
        btn.innerHTML = '\uD83C\uDFA8';
        btn.onclick = function(e){ e.stopPropagation(); window.showAvatarBgPicker(); };
        wrap.style.position = 'relative';
        wrap.appendChild(btn);
      }
    }, 80);
  };
});

/* ============================================================
   3. REPLACE 💚 EMOJI with real green diamond image in DOM
   NOTE: We search for the literal emoji codepoint U+1F49A
   ============================================================ */
var GD_EMOJI = String.fromCodePoint(0x1F49A); // 💚

function replaceGDInNode(node){
  if(!node) return;
  if(node.nodeType === 3){ // text node
    if(node.textContent.indexOf(GD_EMOJI) !== -1){
      var sp = document.createElement('span');
      sp.innerHTML = node.textContent.split(GD_EMOJI).join(GD);
      node.parentNode.replaceChild(sp, node);
    }
    return;
  }
  if(node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'IMG') return;
  Array.prototype.slice.call(node.childNodes).forEach(replaceGDInNode);
}

function replaceGDInScreens(){
  ['homeList','mmList','specialList','profileContent','rankContent',
   'walletMain','notifList','modalB'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) replaceGDInNode(el);
  });
}

/* Run on every navigation */
wait(function(){ return typeof window.navTo==='function' && !window._v9gdWrap; }, function(){
  window._v9gdWrap = true;
  var _o = window.navTo;
  window.navTo = function(s){
    try{ _o.call(this, s); } catch(e){}
    setTimeout(replaceGDInScreens, 250);
  };
});

/* Run on modal open */
wait(function(){ return typeof window.openModal==='function' && !window._v9omWrap; }, function(){
  window._v9omWrap = true;
  var _o = window.openModal;
  window.openModal = function(t, b){
    if(typeof b === 'string') b = b.split(GD_EMOJI).join(GD);
    return _o.call(this, t, b);
  };
});

/* Run after render functions */
['renderHome','renderMM','renderSpecial','renderRank','renderProfile','renderWallet','renderNotifs'].forEach(function(fn){
  wait(function(){ return typeof window[fn]==='function' && !window['_v9_'+fn]; }, function(){
    window['_v9_'+fn] = true;
    var _o = window[fn];
    window[fn] = function(){
      _o.apply(this, arguments);
      setTimeout(replaceGDInScreens, 150);
    };
  });
});

/* ============================================================
   4. RANK — block city/earning tab
   ============================================================ */
wait(function(){ return typeof window.renderRank==='function' && !window._v9rkWrap; }, function(){
  window._v9rkWrap = true;
  var _o = window.renderRank;
  window.renderRank = function(tab){
    if(tab === 'city' || tab === 'earning' || tab === 'earnings') tab = 'rankpoints';
    _o.call(this, tab);
  };
});

/* ============================================================
   5. MATCH CARD — replace emoji in built HTML
   ============================================================ */
wait(function(){ return typeof window.buildMatchCard==='function' && !window._v9mcWrap; }, function(){
  window._v9mcWrap = true;
  var _o = window.buildMatchCard;
  window.buildMatchCard = function(t){
    var html = _o.apply(this, arguments);
    if(typeof html === 'string') html = html.split(GD_EMOJI).join(GD);
    return html;
  };
});

/* ============================================================
   6. UPDATE greenDiaCount in wallet with image
   ============================================================ */
wait(function(){ return typeof window.renderWallet==='function' && !window._v9walletGD; }, function(){
  window._v9walletGD = true;
  var _o = window.renderWallet;
  window.renderWallet = function(){
    _o.apply(this, arguments);
    setTimeout(function(){
      var gdc = document.getElementById('greenDiaCount');
      if(gdc && window.UD){
        var gd = Math.max(Number(window.UD.greenDiamonds)||0, 0);
        gdc.innerHTML = GD_LG + ' <span style="font-size:18px;font-weight:900;color:#00ff64">' + gd + '</span>';
      }
    }, 80);
  };
});

console.log('[v9] fixes-v9.js loaded \u2705');
})();
