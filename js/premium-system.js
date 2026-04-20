/* ================================================================
   MINI eSPORTS — PREMIUM SYSTEM v2.0
   Tier 1 ₹49 / Tier 2 ₹99 / Tier 3 ₹199
   ================================================================ */
(function() {
'use strict';

/* ── Premium tiers config ── */
var TIERS = [
  {
    tier: 1, price: 49, label: 'Tier 1', color: '#ffd700',
    glow: 'rgba(255,215,0,.6)', bg: 'rgba(255,215,0,.07)',
    border: 'rgba(255,215,0,.35)',
    perks: ['No Ads', 'Premium Badge', 'Green name in chat']
  },
  {
    tier: 2, price: 99, label: 'Tier 2', color: '#00d4ff',
    glow: 'rgba(0,212,255,.6)', bg: 'rgba(0,212,255,.07)',
    border: 'rgba(0,212,255,.35)',
    perks: ['Everything Tier 1', 'Create private matches', 'Early access (15 min pehle)']
  },
  {
    tier: 3, price: 199, label: 'Tier 3', color: '#b964ff',
    glow: 'rgba(185,100,255,.6)', bg: 'rgba(185,100,255,.07)',
    border: 'rgba(185,100,255,.35)',
    perks: ['Everything Tier 2', 'Advanced stats graph', 'Custom profile theme', 'Priority support']
  }
];

/* ── Show premium upgrade modal ── */
window.showPremiumUpgrade = function(fromTier) {
  var userTier = (window.UD && window.UD.premium && window.UD.premium.tier) || 0;
  var h = '';

  /* Hero header */
  h += '<div style="text-align:center;padding:8px 0 16px;position:relative;overflow:hidden">';
  h += '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(255,215,0,.12),transparent 65%);pointer-events:none"></div>';
  h += '<div style="font-size:28px;margin-bottom:4px;animation:premFloat 3s ease-in-out infinite">👑</div>';
  h += '<div style="font-size:20px;font-weight:900;background:linear-gradient(135deg,#ffd700,#ff8c00,#b964ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Go Premium</div>';
  h += '<div style="font-size:12px;color:#888;margin-top:3px">Exclusive features unlock karo</div>';
  h += '</div>';

  /* Tier cards */
  TIERS.forEach(function(t) {
    var isActive = userTier === t.tier;
    var isBest = t.tier === 2;
    h += '<div style="position:relative;margin-bottom:12px">';
    if (isBest) h += '<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);z-index:2;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:9px;font-weight:900;padding:3px 14px;border-radius:20px;letter-spacing:.8px;white-space:nowrap">⭐ MOST POPULAR</div>';
    h += '<div style="background:' + t.bg + ';border:' + (isActive?'2px':'1.5px') + ' solid ' + (isActive?t.color:t.border) + ';border-radius:16px;padding:' + (isBest?'18px 16px 14px':'14px 16px') + ';box-shadow:' + (isBest?'0 0 20px '+t.glow+',0 4px 24px rgba(0,0,0,.4)':'0 0 12px rgba(0,0,0,.3)') + '">';
    /* Header row */
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    h += '<div>';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<div style="width:32px;height:32px;border-radius:10px;background:' + t.color + '22;border:1px solid ' + t.color + '66;display:flex;align-items:center;justify-content:center;font-size:16px">👑</div>';
    h += '<div>';
    h += '<div style="font-size:15px;font-weight:900;color:' + t.color + '">Premium ' + t.label + '</div>';
    if (isActive) h += '<div style="font-size:10px;background:' + t.color + '22;color:' + t.color + ';padding:2px 7px;border-radius:8px;font-weight:800;display:inline-block;margin-top:2px">✅ Active</div>';
    h += '</div></div></div>';
    h += '<div style="text-align:right">';
    h += '<div style="font-size:22px;font-weight:900;color:' + t.color + '">₹' + t.price + '</div>';
    h += '<div style="font-size:10px;color:#666">/month</div>';
    h += '</div></div>';
    /* Perks */
    h += '<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">';
    t.perks.forEach(function(p) {
      h += '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#ddd">';
      h += '<div style="width:18px;height:18px;border-radius:50%;background:' + t.color + '22;border:1px solid ' + t.color + '55;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:' + t.color + '">✓</div>';
      h += p + '</div>';
    });
    h += '</div>';
    /* Buy button */
    if (!isActive) {
      h += '<button onclick="window.buyPremium(' + t.tier + ',' + t.price + ')" style="width:100%;padding:11px;border-radius:12px;border:none;background:linear-gradient(135deg,' + t.color + ',' + t.color.replace('ff','cc') + ');color:' + (t.tier===1?'#000':'#fff') + ';font-size:13px;font-weight:900;cursor:pointer;letter-spacing:.3px;box-shadow:0 4px 16px ' + t.glow + '">Upgrade to Tier ' + t.tier + ' →</button>';
    } else {
      h += '<div style="text-align:center;font-size:12px;color:' + t.color + ';font-weight:700;padding:8px;background:' + t.color + '11;border-radius:10px">✅ Aapka current plan</div>';
    }
    h += '</div></div>';
  });

  /* Footer note */
  h += '<div style="text-align:center;font-size:11px;color:#555;padding:8px 0;line-height:1.5">No gambling · No hidden fees · Just better gaming<br>UPI payment karo, screenshot admin ko bhejo</div>';

  if (window.openModal) openModal('👑 Premium Plans', h);
};

/* ── Buy premium handler ── */
window.buyPremium = function(tier, price) {
  var h = '';
  var t = TIERS[tier - 1];
  h += '<div style="text-align:center;padding:8px 0 16px">';
  h += '<div style="font-size:36px;margin-bottom:8px;animation:premFloat 2s ease-in-out infinite">💳</div>';
  h += '<div style="font-size:16px;font-weight:900;color:' + t.color + '">Premium Tier ' + tier + '</div>';
  h += '<div style="font-size:28px;font-weight:900;margin:6px 0;color:#fff">₹' + price + '<span style="font-size:13px;color:#888">/month</span></div>';
  h += '</div>';
  h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px;margin-bottom:14px">';
  h += '<div style="font-size:12px;font-weight:700;color:#aaa;margin-bottom:10px">Payment Steps:</div>';
  ['UPI ID pe ₹' + price + ' bhejo: <b style="color:#ffd700">miniesports@upi</b>', 'Screenshot lo', 'Neeche upload karo — 1-2 ghante mein activate hoga'].forEach(function(s, i) {
    h += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;font-size:12px;color:#ccc">';
    h += '<div style="width:20px;height:20px;border-radius:50%;background:rgba(255,215,0,.15);border:1px solid rgba(255,215,0,.3);color:#ffd700;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (i+1) + '</div>';
    h += s + '</div>';
  });
  h += '</div>';
  h += '<div class="f-group"><label>Payment Screenshot</label>';
  h += '<div id="_premSsArea" onclick="document.getElementById(\'_premSsIn\').click()" style="border:2px dashed rgba(255,215,0,.2);border-radius:12px;padding:18px;text-align:center;cursor:pointer;background:rgba(255,215,0,.03)">';
  h += '<i class="fas fa-camera" style="font-size:28px;color:#ffd70055;display:block;margin-bottom:8px"></i>';
  h += '<div style="font-size:12px;color:#666">Tap to upload screenshot</div>';
  h += '<input type="file" id="_premSsIn" accept="image/*" style="display:none" onchange="window._premHandleSs(this)"></div>';
  h += '<img id="_premSsPreview" style="display:none;width:100%;border-radius:10px;margin-top:8px"></div>';
  h += '<button onclick="window._submitPremium(' + tier + ',' + price + ')" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,' + t.color + ',#ff8c00);color:#000;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 4px 18px rgba(255,215,0,.4);margin-top:4px">Submit Payment Request 💳</button>';

  if (window.openModal) openModal('💳 Buy Premium Tier ' + tier, h);

  var _ss = '';
  window._premHandleSs = function(inp) {
    if (!inp.files || !inp.files[0]) return;
    var r = new FileReader();
    r.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var cv = document.createElement('canvas');
        var mw = 800, w = img.width, hh = img.height;
        if (w > mw) { hh = hh*(mw/w); w = mw; }
        cv.width = w; cv.height = hh;
        cv.getContext('2d').drawImage(img,0,0,w,hh);
        _ss = cv.toDataURL('image/jpeg',0.72);
        var prev = document.getElementById('_premSsPreview');
        var area = document.getElementById('_premSsArea');
        if (prev) { prev.src = _ss; prev.style.display = 'block'; }
        if (area) area.innerHTML = '<i class="fas fa-check-circle" style="color:#00ff9c;font-size:22px;display:block;margin-bottom:4px"></i><div style="font-size:11px;color:#00ff9c">Screenshot ready ✅</div><input type="file" id="_premSsIn" accept="image/*" style="display:none" onchange="window._premHandleSs(this)">';
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(inp.files[0]);
  };
  window._submitPremium = function(tier, price) {
    if (!_ss) { if (window.toast) toast('Screenshot upload karo!', 'err'); return; }
    if (!window.U || !window.UD || !window.db) return;
    var id = window.db.ref('premiumRequests').push().key;
    window.db.ref('premiumRequests/' + id).set({
      uid: window.U.uid, userName: window.UD.ign || window.UD.displayName || '',
      email: window.UD.email || '', tier: tier, price: price,
      screenshotBase64: _ss, status: 'pending', createdAt: Date.now()
    });
    window.db.ref('users/' + window.U.uid + '/notifications').push({
      title: '💳 Premium Request Received',
      message: 'Tier ' + tier + ' (₹' + price + ') request mila! 1-2 ghante mein activate hoga.',
      timestamp: Date.now(), read: false, type: 'premium'
    });
    if (window.toast) toast('✅ Request submit! 1-2 ghante mein activate hoga.', 'ok');
    if (window.closeModal) closeModal();
  };
};

/* ── Inject Premium button into profile settings ── */
var _tryInject = 0;
var _injectIv = setInterval(function() {
  _tryInject++;
  if (_tryInject > 40) { clearInterval(_injectIv); return; }
  if (!window.showProfileSettings) return;
  clearInterval(_injectIv);
  var _orig = window.showProfileSettings;
  window.showProfileSettings = function() {
    _orig.apply(this, arguments);
    /* Inject premium button at top of panel after short delay */
    setTimeout(function() {
      var panel = document.querySelector('#profSettingsSheet > div:last-child');
      if (!panel) return;
      var ud = window.UD || {};
      var curTier = (ud.premium && ud.premium.tier) || 0;
      var premDiv = document.createElement('div');
      premDiv.style.cssText = 'padding:0 16px 12px';
      var btnBg = curTier ? 'linear-gradient(135deg,rgba(185,100,255,.15),rgba(0,212,255,.1))' : 'linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,140,0,.08))';
      var btnColor = curTier ? '#b964ff' : '#ffd700';
      var btnBorder = curTier ? 'rgba(185,100,255,.4)' : 'rgba(255,215,0,.4)';
      var btnLabel = curTier ? '👑 Premium Tier ' + curTier + ' Active' : '👑 Go Premium';
      premDiv.innerHTML = '<button onclick="window.showPremiumUpgrade();setTimeout(function(){window.closeProfileSettings&&closeProfileSettings();},200)" style="width:100%;padding:13px;border-radius:14px;border:1.5px solid ' + btnBorder + ';background:' + btnBg + ';color:' + btnColor + ';font-size:14px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">' + btnLabel + ' <span style="font-size:11px;opacity:.7">→</span></button>';
      panel.insertBefore(premDiv, panel.firstChild);
    }, 100);
  };
  console.log('[Premium] Settings hook injected ✅');
}, 300);

/* ── Apply premium perks on load ── */
function applyPremiumPerks() {
  if (!window.UD) { setTimeout(applyPremiumPerks, 800); return; }
  var ud = window.UD;
  var tier = (ud.premium && ud.premium.tier) || 0;
  if (!tier) return;
  /* No-ads: hide ad containers */
  if (tier >= 1) {
    var style = document.getElementById('_premNoAdsStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = '_premNoAdsStyle';
      style.textContent = '.ad-banner,.ad-container,[id*="ad-"],[class*="adslot"]{display:none!important}';
      document.head.appendChild(style);
    }
  }
}

/* ── CSS animation for floating ── */
var premStyle = document.createElement('style');
premStyle.textContent = '@keyframes premFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}} @keyframes badgePulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.03);opacity:.9}} @keyframes badgeGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.3)}} @keyframes badgeFire{0%,100%{transform:scale(1) rotate(-1deg)}50%{transform:scale(1.04) rotate(1deg)}} @keyframes podCrown{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-4px) rotate(5deg)}}';
document.head.appendChild(premStyle);

/* Init */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyPremiumPerks);
} else {
  applyPremiumPerks();
}

console.log('[Mini eSports] ✅ Premium System v2.0 loaded');
})();
