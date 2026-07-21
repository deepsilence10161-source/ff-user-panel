/* ================================================================
   BUNDLE OFFERS + ANNUAL PLANS + EXPIRY REMINDERS
   - Silver + Battle Pass = ₹79 (save ₹19)
   - Gold + Battle Pass   = ₹129 (save ₹19)
   - Annual Silver  = ₹399/year  (₹33/month, save ₹189)
   - Annual Gold    = ₹799/year  (₹67/month, save ₹389)
   - Expiry reminders: 3 days, 1 day before
================================================================ */
(function(){
'use strict';

/* ── Bundle Offers ── */
var BUNDLES = [
  {
    id: 'silver_bp',
    label: 'Silver + Battle Pass',
    icon: '🥈🎫',
    price: 79,
    originalPrice: 98, /* 49 + 49 */
    save: 19,
    color: '#e0e0e0',
    includes: ['Premium Silver (1 mahina)', 'Season Battle Pass', '5 GD bonus', 'No Ads']
  },
  {
    id: 'gold_bp',
    label: 'Gold + Battle Pass',
    icon: '🥇🎫',
    price: 129,
    originalPrice: 148, /* 99 + 49 */
    save: 19,
    color: '#ffd700',
    best: true,
    includes: ['Premium Gold (1 mahina)', 'Season Battle Pass', '15 GD bonus', 'No Ads', 'Private Match Host']
  }
];

var ANNUAL_PLANS = [
  {
    tier: 1,
    label: 'Silver Annual',
    icon: '🥈',
    price: 399,
    monthly: 33,
    save: 189,
    originalYearly: 588, /* 49 × 12 */
    color: '#e0e0e0'
  },
  {
    tier: 2,
    label: 'Gold Annual',
    icon: '🥇',
    price: 799,
    monthly: 67,
    save: 389,
    originalYearly: 1188, /* 99 × 12 */
    color: '#ffd700',
    best: true
  }
];

/* ── Show Bundle Offers Modal ── */
window.showBundleOffers = function() {
  window.checkPolicyThenRun(function() {
    var h = '';
    h += '<div style="text-align:center;padding:4px 0 14px">';
    h += '<div style="font-size:28px;margin-bottom:6px">🔥</div>';
    h += '<div style="font-size:17px;font-weight:900;color:#fff">Best Value Bundles</div>';
    h += '<div style="font-size:11px;color:#888;margin-top:3px">Premium + Battle Pass saath mein → extra save!</div>';
    h += '</div>';

    BUNDLES.forEach(function(b) {
      h += '<div style="position:relative;margin-bottom:14px">';
      if (b.best) h += '<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);z-index:2;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:9px;font-weight:900;padding:3px 16px;border-radius:20px;white-space:nowrap">⭐ BEST VALUE</div>';
      h += '<div style="background:rgba(' + (b.best?'255,215,0':'255,255,255') + ',.05);border:1.5px solid rgba(' + (b.best?'255,215,0':'255,255,255') + ',.2);border-radius:16px;padding:' + (b.best?'20px 16px 16px':'16px') + '">';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
      h += '<div><div style="font-size:15px;font-weight:900;color:' + b.color + '">' + b.icon + ' ' + b.label + '</div>';
      h += '<div style="font-size:10px;color:#888;margin-top:2px">1 mahina combo</div></div>';
      h += '<div style="text-align:right"><div style="font-size:10px;color:#666;text-decoration:line-through">₹' + b.originalPrice + '</div>';
      h += '<div style="font-size:24px;font-weight:900;color:' + b.color + '">₹' + b.price + '</div>';
      h += '<div style="font-size:10px;color:#00ff9c;font-weight:700">Save ₹' + b.save + '!</div></div></div>';
      h += '<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">';
      b.includes.forEach(function(i) {
        h += '<div style="font-size:11px;color:#ccc;display:flex;align-items:center;gap:6px"><span style="color:' + b.color + '">✓</span>' + i + '</div>';
      });
      h += '</div>';
      h += '<button onclick="window.buyBundle(\'' + b.id + '\')" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,' + b.color + ',#333);color:' + (b.tier===1?'#000':'#fff') + ';font-size:13px;font-weight:900;cursor:pointer">Bundle Kharido — ₹' + b.price + ' →</button>';
      h += '</div></div>';
    });

    h += '<div style="text-align:center;margin:14px 0 8px"><div style="font-size:11px;color:#555;font-weight:700;letter-spacing:.5px">ANNUAL PLANS (SAVE MORE)</div></div>';

    ANNUAL_PLANS.forEach(function(p) {
      h += '<div style="background:rgba(' + (p.best?'255,215,0':'255,255,255') + ',.04);border:1px solid rgba(' + (p.best?'255,215,0':'255,255,255') + ',.15);border-radius:14px;padding:14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">';
      h += '<div><div style="font-size:14px;font-weight:900;color:' + p.color + '">' + p.icon + ' ' + p.label + '</div>';
      h += '<div style="font-size:10px;color:#888;margin-top:2px">₹' + p.monthly + '/month • Save ₹' + p.save + '</div>';
      h += '<div style="font-size:10px;color:#00ff9c;margin-top:1px">vs ₹' + p.originalYearly + ' monthly</div></div>';
      h += '<button onclick="window.buyAnnualPlan(' + p.tier + ',' + p.price + ')" style="padding:10px 16px;border-radius:11px;border:none;background:linear-gradient(135deg,' + p.color + ',#333);color:' + (p.tier===1?'#000':'#fff') + ';font-size:12px;font-weight:900;cursor:pointer">₹' + p.price + '/yr</button>';
      h += '</div>';
    });

    if (window.openModal) openModal('🔥 Bundle Offers', h);
  });
};

/* ── Buy Bundle ── */
window.buyBundle = function(bundleId) {
  var b = BUNDLES.filter(function(x){ return x.id === bundleId; })[0];
  if (!b) return;
  _showBundlePayment(b);
};

function _showBundlePayment(b) {
  var h = '<div style="text-align:center;padding:6px 0 14px">';
  h += '<div style="font-size:32px;margin-bottom:6px">' + b.icon + '</div>';
  h += '<div style="font-size:16px;font-weight:900;color:' + b.color + '">' + b.label + '</div>';
  h += '<div style="font-size:28px;font-weight:900;color:#fff;margin:8px 0">₹' + b.price + ' <span style="font-size:12px;color:#666;text-decoration:line-through">₹' + b.originalPrice + '</span></div>';
  h += '<div style="font-size:12px;color:#00ff9c;font-weight:700">Save ₹' + b.save + '! 🎉</div></div>';
  h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:13px;padding:13px;margin-bottom:14px">';
  ['UPI: <strong style="color:#ffd700">miniesports@upi</strong> par ₹' + b.price + ' bhejo', 'Screenshot lo', '1-2 ghante mein dono activate honge'].forEach(function(s,i){
    h += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;font-size:12px;color:#ccc"><div style="min-width:22px;height:22px;border-radius:50%;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.3);color:#ffd700;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center">' + (i+1) + '</div>' + s + '</div>';
  });
  h += '</div>';
  h += '<div id="_bndlSsArea" onclick="document.getElementById(\'_bndlSsIn\').click()" style="border:2px dashed rgba(255,215,0,.2);border-radius:13px;padding:18px;text-align:center;cursor:pointer;background:rgba(255,215,0,.02);margin-bottom:12px"><i class="fas fa-camera" style="font-size:22px;color:#ffd70055;display:block;margin-bottom:6px"></i><div style="font-size:12px;color:#666">Screenshot upload karo</div><input type="file" id="_bndlSsIn" accept="image/*" style="display:none" onchange="window._bndlHandleSs(this)"></div>';
  h += '<img id="_bndlSsPreview" style="display:none;width:100%;border-radius:10px;margin-bottom:12px;max-height:160px;object-fit:cover">';
  h += '<button onclick="window._submitBundle(\'' + b.id + '\',' + b.price + ')" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,' + b.color + ',#ff8c00);color:#000;font-size:14px;font-weight:900;cursor:pointer">💳 Bundle Request Submit</button>';
  if (window.openModal) openModal('💳 ' + b.label, h);

  var _ss = '';
  window._bndlHandleSs = function(inp) {
    if (!inp.files || !inp.files[0]) return;
    var r = new FileReader();
    r.onload = function(e) {
      _ss = e.target.result;
      var prev = document.getElementById('_bndlSsPreview'), area = document.getElementById('_bndlSsArea');
      if (prev) { prev.src = _ss; prev.style.display = 'block'; }
      if (area) area.innerHTML = '<i class="fas fa-check-circle" style="color:#00ff9c;font-size:20px;display:block;margin-bottom:4px"></i><div style="font-size:11px;color:#00ff9c">Ready ✅</div>';
    };
    r.readAsDataURL(inp.files[0]);
  };

  window._submitBundle = function(bundleId, price) {
    if (!_ss) { if(window.toast)toast('Screenshot upload karo!','err'); return; }
    if (!window.U || !window._supa) return;
    /* ✅ Audit Fix: 'bundle_requests' table never existed — every submission
       failed silently AFTER the user had already sent real UPI money.
       Routed through the existing premium_requests queue instead (same
       table admin already reviews for Silver/Gold/Annual), tagged so the
       admin can tell it's a bundle and grant the Battle Pass part too. */
    window._supa.from('premium_requests').insert({
      user_id: window.U.uid,
      user_name: (window.UD && window.UD.ign) || '',
      tier: (bundleId === 'gold_bp') ? 2 : 1,
      price: price,
      screenshot_url: _ss,
      status: 'pending',
      plan_type: 'bundle',
      bundle_id: bundleId
    }).then(function() {
      if(window.toast)toast('✅ Bundle request submit! 1-2 ghante mein active.','ok');
      if(window.closeModal) closeModal();
    }).catch(function() {
      if(window.toast)toast('Submit failed, retry karo','err');
    });
  };
}

/* ── Buy Annual Plan ── */
window.buyAnnualPlan = function(tier, price) {
  var p = ANNUAL_PLANS.filter(function(x){ return x.tier === tier; })[0];
  if (!p) return;
  window.checkPolicyThenRun(function() {
    var h = '<div style="text-align:center;padding:6px 0 14px">';
    h += '<div style="font-size:32px">' + p.icon + '</div>';
    h += '<div style="font-size:16px;font-weight:900;color:' + p.color + ';margin-top:6px">' + p.label + '</div>';
    h += '<div style="font-size:28px;font-weight:900;color:#fff;margin:8px 0">₹' + price + '<span style="font-size:12px;color:#888">/year</span></div>';
    h += '<div style="font-size:12px;color:#00ff9c;font-weight:700">Save ₹' + p.save + ' vs monthly! 🎉</div></div>';
    h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:13px;padding:13px;margin-bottom:14px">';
    ['UPI: <strong style="color:#ffd700">miniesports@upi</strong> par ₹' + price + ' bhejo', 'Screenshot lo', '24 ghante mein 12-month activate hoga'].forEach(function(s,i){
      h += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;font-size:12px;color:#ccc"><div style="min-width:22px;height:22px;border-radius:50%;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.3);color:#ffd700;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center">' + (i+1) + '</div>' + s + '</div>';
    });
    h += '</div>';
    h += '<div id="_annSsArea" onclick="document.getElementById(\'_annSsIn\').click()" style="border:2px dashed rgba(255,215,0,.2);border-radius:13px;padding:18px;text-align:center;cursor:pointer;background:rgba(255,215,0,.02);margin-bottom:12px"><i class="fas fa-camera" style="font-size:22px;color:#ffd70055;display:block;margin-bottom:6px"></i><div style="font-size:12px;color:#666">Screenshot upload karo</div><input type="file" id="_annSsIn" accept="image/*" style="display:none" onchange="window._annHandleSs(this)"></div>';
    h += '<img id="_annSsPreview" style="display:none;width:100%;border-radius:10px;margin-bottom:12px;max-height:160px;object-fit:cover">';
    h += '<button onclick="window._submitAnnual(' + tier + ',' + price + ')" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,' + p.color + ',#ff8c00);color:#000;font-size:14px;font-weight:900;cursor:pointer">💳 Annual Plan Request Submit</button>';
    if (window.openModal) openModal('💳 ' + p.label, h);

    var _ss = '';
    window._annHandleSs = function(inp) {
      if (!inp.files || !inp.files[0]) return;
      var r = new FileReader(); r.onload = function(e) { _ss = e.target.result; var prev = document.getElementById('_annSsPreview'), area = document.getElementById('_annSsArea'); if(prev){prev.src=_ss;prev.style.display='block';} if(area)area.innerHTML='<i class="fas fa-check-circle" style="color:#00ff9c;font-size:20px;display:block;margin-bottom:4px"></i><div style="font-size:11px;color:#00ff9c">Ready ✅</div>'; }; r.readAsDataURL(inp.files[0]);
    };
    window._submitAnnual = function(tier, price) {
      if (!_ss) { if(window.toast)toast('Screenshot upload karo!','err'); return; }
      if (!window.U || !window._supa) return;
      window._supa.from('premium_requests').insert({ user_id: window.U.uid, user_name: (window.UD&&window.UD.ign)||'', tier: tier, price: price, screenshot_url: _ss, status: 'pending', plan_type: 'annual' }).then(function(){ if(window.toast)toast('✅ Annual plan request submit! 24 ghante mein active.','ok'); if(window.closeModal)closeModal(); }).catch(function(){ if(window.toast)toast('Submit failed, retry karo','err'); });
    };
  });
};

/* ── Expiry Reminders ── */
function checkExpiryReminders() {
  var ud = window.UD;
  if (!ud || !ud.premium || !ud.premium.active) return;
  var expiresAt = ud.premium.expiresAt;
  if (!expiresAt) return;
  var now = Date.now();
  var msLeft = expiresAt - now;
  var daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  var uid = window.U && window.U.uid;
  if (!uid) return;

  var remKey = '_mes_prem_rem_' + uid + '_' + Math.floor(expiresAt / 86400000);

  if (daysLeft <= 3 && daysLeft > 0) {
    if (!localStorage.getItem(remKey + '_3')) {
      localStorage.setItem(remKey + '_3', '1');
      setTimeout(function() {
        if (window.toast) toast('⏰ Premium ' + daysLeft + ' din mein expire! Renew karo.', 'inf');
        setTimeout(function() { _showRenewalModal(daysLeft); }, 3000);
      }, 5000);
    }
  } else if (daysLeft <= 0) {
    if (!localStorage.getItem(remKey + '_exp')) {
      localStorage.setItem(remKey + '_exp', '1');
      setTimeout(function() { _showRenewalModal(0); }, 3000);
    }
  }
}

function _showRenewalModal(daysLeft) {
  var tier = window.getUserPremiumTier ? window.getUserPremiumTier() : 1;
  var prices = [0, 49, 99, 199];
  var names  = ['', 'Silver', 'Gold', 'Diamond'];
  var price  = prices[tier] || 49;
  var name   = names[tier]  || 'Silver';
  var h = '<div style="text-align:center;padding:6px 0 14px">';
  h += '<div style="font-size:38px;margin-bottom:8px">' + (daysLeft <= 0 ? '😢' : '⏰') + '</div>';
  h += '<div style="font-size:17px;font-weight:900;color:#ffd700;margin-bottom:6px">' + (daysLeft <= 0 ? 'Premium Expire Ho Gaya!' : name + ' Premium ' + daysLeft + ' Din Mein Expire Hoga') + '</div>';
  h += '<div style="font-size:12px;color:#888;margin-bottom:16px">' + (daysLeft <= 0 ? 'Ads wapas aa jayenge — renew karo!' : 'Renew karo taaki benefits jaari rahen') + '</div>';
  h += '<button onclick="if(window.buyPremium)buyPremium(' + tier + ',' + price + ');if(window.closeModal)closeModal()" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:8px">🔄 Renew ' + name + ' — ₹' + price + '/month</button>';
  h += '<button onclick="if(window.showBundleOffers)showBundleOffers();if(window.closeModal)closeModal()" style="width:100%;padding:11px;border-radius:13px;border:none;background:rgba(255,255,255,.06);color:#888;font-size:12px;cursor:pointer">Bundle offers dekho (save more)</button>';
  h += '</div>';
  if (window.openModal) openModal('⏰ Premium Renewal', h);
}

/* ── Init ── */
function initBundles() {
  if (!window.U || !window.UD) { setTimeout(initBundles, 1500); return; }
  checkExpiryReminders();
  /* Check every hour */
  setInterval(checkExpiryReminders, 60 * 60 * 1000);

  /* Inject "Bundle Offers" button in Premium modal footer */
  var _origRender = window.showPremiumUpgrade;
  console.log('[Mini eSports] Bundle Offers + Annual Plans v1.0 ✅');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(initBundles, 3000); });
} else {
  setTimeout(initBundles, 3000);
}

})();
