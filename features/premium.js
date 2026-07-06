/* ================================================================
   MINI eSPORTS — PREMIUM SYSTEM v3.0
   Tier 1  ₹49/month  Silver  — No Ads + Badge + Green Name + 5 GD
   Tier 2  ₹99/month  Gold    — T1 + Private Match + 15 GD
   Tier 3  ₹199/month Diamond — T2 + Early Access + Theme + 35 GD
   POLICY: No real-money prize, no withdrawal from gaming wallet
================================================================ */
(function(){
'use strict';
var GDI=function(s){return '<img src="js/green-diamond.png" style="width:'+(s||14)+'px;height:'+(s||14)+'px;vertical-align:middle;object-fit:contain">';};
var TIERS=[
  {tier:1,price:49,label:'Silver',icon:'🥈',color:'#e0e0e0',glow:'rgba(224,224,224,.5)',bg:'rgba(224,224,224,.06)',border:'rgba(224,224,224,.25)',gdBonus:5,
   perks:[{i:'🚫',t:'No Ads — match join karte waqt koi ad nahi'},{i:'🥈',t:'Premium Silver Badge — profile par dikh'},{i:'💬',t:'Green Name — lobby chat mein naam hari rang ka'},{i:'GD',t:'5 Green Diamonds har mahine (rank/badges ke liye)'}]},
  {tier:2,price:99,label:'Gold',icon:'🥇',color:'#ffd700',glow:'rgba(255,215,0,.55)',bg:'rgba(255,215,0,.07)',border:'rgba(255,215,0,.3)',gdBonus:15,best:true,
   perks:[{i:'✅',t:'Silver ke saare features shaamil'},{i:'🏠',t:'Private Match Host — doston ke saath custom room banao'},{i:'GD',t:'15 Green Diamonds har mahine'}]},
  {tier:3,price:199,label:'Diamond',icon:'💎',color:'#b964ff',glow:'rgba(185,100,255,.55)',bg:'rgba(185,100,255,.07)',border:'rgba(185,100,255,.3)',gdBonus:35,
   perks:[{i:'✅',t:'Gold ke saare features shaamil'},{i:'⏰',t:'Early Match Access — 15 min pehle dekho'},{i:'🎨',t:'Custom Profile Theme — animated border + glow'},{i:'⚡',t:'Priority Customer Support'},{i:'GD',t:'35 Green Diamonds har mahine'}]}
];
window.PREMIUM_TIERS=TIERS;

window.getUserPremiumTier=function(){
  var ud=window.UD; if(!ud||!ud.premium) return 0;
  var p=ud.premium; if(!p.active) return 0;
  if(p.expiresAt&&((window.serverNow&&typeof window.serverNow==="function")?window.serverNow():Date.now())>p.expiresAt /* Bug H-2 Fix */) return 0;
  return p.tier||0;
};

/* No-Withdrawal policy gate */
window.showWithdrawalPolicy=function(onAccept){
  var h='<div style="text-align:center;padding:8px 0 14px"><div style="font-size:40px;margin-bottom:8px">📋</div>';
  h+='<div style="font-size:17px;font-weight:900;color:#fff;margin-bottom:4px">Kharidne se pehle padho</div>';
  h+='<div style="font-size:12px;color:#888">Mini eSports — Withdrawal Policy</div></div>';
  var pts=[
    {i:'❌',c:'#ff5555',t:'Coins, Sky Diamonds, Green Diamonds — <strong>kabhi paise mein nahi badalte</strong>.'},
    {i:'❌',c:'#ff5555',t:'Match jeetne par <strong>koi real-money prize nahi</strong> milta.'},
    {i:'❌',c:'#ff5555',t:'Premium fees <strong>non-refundable</strong> hain.'},
    {i:'✅',c:'#00ff9c',t:'<strong>Referral commission</strong> sirf withdraw hoti hai (Premium users ke liye).'},
    {i:'✅',c:'#00ff9c',t:'Yeh ek <strong>skill-based gaming platform</strong> hai — gambling nahi.'}
  ];
  h+='<div style="display:flex;flex-direction:column;gap:9px;margin-bottom:18px">';
  pts.forEach(function(p){h+='<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)"><div style="font-size:16px;flex-shrink:0">'+p.i+'</div><div style="font-size:12px;color:#ccc;line-height:1.6">'+p.t+'</div></div>';});
  h+='</div>';
  h+='<div id="_policyCheck" onclick="window._togP()" style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1.5px solid rgba(255,215,0,.25);background:rgba(255,215,0,.05);cursor:pointer;margin-bottom:14px">';
  h+='<div id="_pBox" style="width:20px;height:20px;border-radius:6px;border:1.5px solid rgba(255,215,0,.5);background:transparent;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s"></div>';
  h+='<div style="font-size:12px;color:#ddd;line-height:1.5">Maine yeh policy <strong style="color:#ffd700">samjh li</strong> — mujhe pata hai koi withdrawal nahi hoga.</div></div>';
  h+='<button id="_pBtn" onclick="window._confP()" disabled style="width:100%;padding:14px;border-radius:13px;border:none;background:rgba(255,255,255,.08);color:#666;font-size:14px;font-weight:900;cursor:not-allowed;transition:all .3s">Aage Badho →</button>';
  var _acc=false;
  window._togP=function(){_acc=!_acc;var b=document.getElementById('_pBox'),btn=document.getElementById('_pBtn'),row=document.getElementById('_policyCheck');if(b){b.innerHTML=_acc?'<span style="color:#ffd700;font-size:13px">✓</span>':'';b.style.background=_acc?'rgba(255,215,0,.2)':'transparent';}if(row)row.style.borderColor=_acc?'rgba(255,215,0,.6)':'rgba(255,215,0,.25)';if(btn){btn.disabled=!_acc;btn.style.background=_acc?'linear-gradient(135deg,#ffd700,#ff8c00)':'rgba(255,255,255,.08)';btn.style.color=_acc?'#000':'#666';btn.style.cursor=_acc?'pointer':'not-allowed';}};
  window._confP=function(){if(!_acc)return;if(window.U)localStorage.setItem('_mes_policy_'+window.U.uid,'1');if(window.closeModal)closeModal();setTimeout(function(){if(onAccept)onAccept();},250);};
  if(window.openModal)openModal('📋 Withdrawal Policy',h);
};
window.checkPolicyThenRun=function(fn){if(!window.U)return;if(localStorage.getItem('_mes_policy_'+window.U.uid)==='1'){fn();return;}window.showWithdrawalPolicy(fn);};
window.showPremiumUpgrade=function(){window.checkPolicyThenRun(_renderPremModal);};

function _renderPremModal(){
  var uT=window.getUserPremiumTier(),h='';
  h+='<div style="text-align:center;padding:6px 0 18px;position:relative;overflow:hidden">';
  h+='<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(185,100,255,.12),transparent 65%);pointer-events:none"></div>';
  h+='<div style="font-size:32px;margin-bottom:6px;animation:premFloat 3s ease-in-out infinite">👑</div>';
  h+='<div style="font-size:21px;font-weight:900;background:linear-gradient(135deg,#ffd700,#b964ff,#00d4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Premium Club</div>';
  h+='<div style="font-size:12px;color:#777;margin-top:4px">Alag gaming experience — bina gambling ke</div></div>';
  TIERS.forEach(function(t){
    var isA=uT===t.tier,iBest=t.best;
    h+='<div style="position:relative;margin-bottom:14px">';
    if(iBest)h+='<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);z-index:2;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#000;font-size:9px;font-weight:900;padding:3px 16px;border-radius:20px;letter-spacing:.8px;white-space:nowrap;box-shadow:0 2px 10px rgba(255,215,0,.4)">⭐ SABSE POPULAR</div>';
    h+='<div class="'+(iBest?'prem-tier-shine':'')+'" style="background:'+t.bg+';border:'+(isA?'2px':'1.5px')+' solid '+(isA?t.color:t.border)+';border-radius:18px;padding:'+(iBest?'26px 16px 16px':'16px')+';box-shadow:'+(iBest?'0 0 24px '+t.glow+',0 6px 28px rgba(0,0,0,.5)':'0 0 12px rgba(0,0,0,.3)')+';">';
    h+='<div class="prem-tier-crown" style="filter:drop-shadow(0 0 8px '+t.color+')">👑</div>';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    h+='<div style="display:flex;align-items:center;gap:10px"><div style="width:40px;height:40px;border-radius:12px;background:'+t.color+'18;border:1.5px solid '+t.color+'55;display:flex;align-items:center;justify-content:center;font-size:20px">'+t.icon+'</div>';
    h+='<div><div style="font-size:16px;font-weight:900;color:'+t.color+'">Premium '+t.label+'</div>';
    if(isA)h+='<div style="font-size:10px;background:'+t.color+'22;color:'+t.color+';padding:2px 8px;border-radius:8px;font-weight:800;display:inline-flex;margin-top:3px">✅ Active Plan</div>';
    else h+='<div style="font-size:10px;color:#888;margin-top:2px">Monthly subscription</div>';
    h+='</div></div><div style="text-align:right"><div style="font-size:26px;font-weight:900;color:'+t.color+'">₹'+t.price+'</div><div style="font-size:10px;color:#666">/mahina</div></div></div>';
    /* Perks */
    h+='<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:12px">';
    t.perks.forEach(function(p){h+='<div style="display:flex;align-items:flex-start;gap:9px"><div style="width:22px;height:22px;border-radius:7px;background:'+t.color+'15;border:1px solid '+t.color+'40;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px">'+(p.i==='GD'?GDI(12):p.i)+'</div><div style="font-size:12px;color:#ddd;line-height:1.55;margin-top:3px">'+p.t+'</div></div>';});
    h+='</div>';
    /* GD bonus pill */
    h+='<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:11px;background:rgba(0,255,100,.05);border:1px solid rgba(0,255,100,.15);margin-bottom:13px">'+GDI(16)+' <span style="font-size:12px;color:#00ff64;font-weight:700">'+t.gdBonus+' Green Diamonds / mahine bonus</span></div>';
    /* CTA */
    if(!isA)h+='<button onclick="window.buyPremium('+t.tier+','+t.price+')" style="width:100%;padding:13px;border-radius:13px;border:none;background:linear-gradient(135deg,'+t.color+',#333);color:'+(t.tier===1?'#000':'#fff')+';font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 4px 18px '+t.glow+';letter-spacing:.3px">Upgrade to '+t.label+' →</button>';
    else h+='<div style="text-align:center;font-size:12px;color:'+t.color+';font-weight:700;padding:10px;background:'+t.color+'10;border-radius:11px">✅ Yeh tumhara current plan hai</div>';
    h+='</div></div>';
  });
  h+='<div style="text-align:center;margin-top:6px"><div style="font-size:11px;color:#444;line-height:1.7">Koi gambling nahi · Koi hidden charges nahi<br>UPI se payment karo → screenshot bhejo → 1-2 ghante mein active</div></div>';
  h+='<div style="display:flex;gap:8px;margin-top:12px">';
  h+='<button onclick="if(window.closeModal)closeModal();setTimeout(function(){if(window.showBundleOffers)window.showBundleOffers();},300)" style="flex:1;padding:11px;border-radius:12px;border:1px solid rgba(255,100,0,.35);background:rgba(255,100,0,.07);color:#ff8c00;font-size:12px;font-weight:900;cursor:pointer">🔥 Bundle Offers</button>';
  /* BUG FIX (2026-07): this only checked "does the user have an active
     tier right now" — it never checked whether the trial itself was
     already claimed, so the button kept showing even after someone used
     their one-time trial (they'd only find out it was already used when
     they tapped it and got an error toast). Now also hides once claimed. */
  if(!uT && !(window.isTrialUsed && window.isTrialUsed()))h+='<button onclick="if(window.startFreeTrial)window.startFreeTrial()" style="flex:1;padding:11px;border-radius:12px;border:1px solid rgba(224,224,224,.2);background:rgba(224,224,224,.05);color:#e0e0e0;font-size:12px;font-weight:900;cursor:pointer">🎁 7-Din FREE Trial</button>';
  h+='</div>';
  if(window.openModal)openModal('👑 Premium Club',h);
}

window.buyPremium=function(tier,price){
  var t=TIERS[tier-1]; if(!t) return;
  var h='<div style="text-align:center;padding:6px 0 16px"><div style="font-size:34px;margin-bottom:6px;animation:premFloat 2s ease-in-out infinite">'+t.icon+'</div>';
  h+='<div style="font-size:16px;font-weight:900;color:'+t.color+'">Premium '+t.label+'</div>';
  h+='<div style="font-size:30px;font-weight:900;margin:6px 0;color:#fff">₹'+price+'<span style="font-size:13px;color:#888">/mahina</span></div></div>';
  /* What you get */
  h+='<div style="background:rgba(0,255,100,.05);border:1px solid rgba(0,255,100,.15);border-radius:13px;padding:12px;margin-bottom:14px">';
  h+='<div style="font-size:11px;font-weight:700;color:#00ff64;margin-bottom:8px;letter-spacing:.4px">TUMHE KYA MILEGA:</div>';
  t.perks.forEach(function(p){h+='<div style="display:flex;align-items:center;gap:7px;font-size:11.5px;color:#ccc;margin-bottom:5px"><span>'+(p.i==='GD'?GDI(13):p.i)+'</span><span>'+p.t+'</span></div>';});
  h+='</div>';
  /* Payment steps */
  h+='<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:13px;padding:13px;margin-bottom:14px">';
  h+='<div style="font-size:11px;font-weight:700;color:#888;margin-bottom:10px;letter-spacing:.5px">PAYMENT STEPS:</div>';
  [
    'UPI ID: <strong style="color:#ffd700;font-size:13px">miniesports@upi</strong> par ₹'+price+' bhejo',
    'Payment ka screenshot lo',
    'Neeche upload karo — <strong style="color:#00ff9c">1-2 ghante mein activate hoga</strong>'
  ].forEach(function(s,i){h+='<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:9px;font-size:12px;color:#ccc"><div style="min-width:22px;height:22px;border-radius:50%;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.3);color:#ffd700;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center">'+(i+1)+'</div>'+s+'</div>';});
  h+='</div>';
  /* Screenshot upload */
  h+='<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:#aaa;margin-bottom:8px">Payment Screenshot *</div>';
  h+='<div id="_premSsArea" onclick="document.getElementById(\'_premSsIn\').click()" style="border:2px dashed rgba(255,215,0,.2);border-radius:13px;padding:20px;text-align:center;cursor:pointer;background:rgba(255,215,0,.03)">';
  h+='<i class="fas fa-camera" style="font-size:28px;color:#ffd70055;display:block;margin-bottom:8px"></i><div style="font-size:12px;color:#666">Screenshot upload karo</div>';
  h+='<input type="file" id="_premSsIn" accept="image/*" style="display:none" onchange="window._premHandleSs(this)"></div>';
  h+='<img id="_premSsPreview" style="display:none;width:100%;border-radius:10px;margin-top:8px;max-height:180px;object-fit:cover"></div>';
  h+='<div style="padding:10px 12px;border-radius:11px;background:rgba(255,85,85,.07);border:1px solid rgba(255,85,85,.15);font-size:11px;color:#ff9999;margin-bottom:12px">⚠️ Premium fees non-refundable hain. Coins/Diamonds withdraw nahi hote.</div>';
  h+='<button onclick="window._submitPremium('+tier+','+price+')" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,'+t.color+',#ff8c00);color:#000;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 4px 18px rgba(255,215,0,.35)">💳 Payment Request Submit Karo</button>';
  if(window.openModal)openModal('💳 Buy Premium '+t.label,h);
  var _ss='';
  window._premHandleSs=function(inp){if(!inp.files||!inp.files[0])return;var r=new FileReader();r.onload=function(e){var img=new Image();img.onload=function(){var cv=document.createElement('canvas'),mw=800,w=img.width,hh=img.height;if(w>mw){hh=Math.round(hh*(mw/w));w=mw;}cv.width=w;cv.height=hh;cv.getContext('2d').drawImage(img,0,0,w,hh);_ss=cv.toDataURL('image/jpeg',.72);var prev=document.getElementById('_premSsPreview'),area=document.getElementById('_premSsArea');if(prev){prev.src=_ss;prev.style.display='block';}if(area)area.innerHTML='<i class="fas fa-check-circle" style="color:#00ff9c;font-size:22px;display:block;margin-bottom:4px"></i><div style="font-size:11px;color:#00ff9c">Screenshot ready ✅</div><input type="file" id="_premSsIn" accept="image/*" style="display:none" onchange="window._premHandleSs(this)">';};img.src=e.target.result;};r.readAsDataURL(inp.files[0]);};
  window._submitPremium = function(tier, price) {
  if (!_ss) { if (window.toast) toast('Screenshot upload karo!', 'err'); return; }
  if (!window.U || !window.UD) return;
  if (!window._supa) { if (window.toast) toast('Service unavailable', 'err'); return; }
  var tierLabel = TIERS[tier-1] ? TIERS[tier-1].label : ('Tier ' + tier);
  /* ✅ Supabase premium_requests table */
  window._supa.from('premium_requests').insert({
    user_id:         window.U.uid,
    user_name:       window.UD.ign || window.UD.displayName || '',
    tier:            tier,
    price:           price,
    screenshot_url:  _ss,
    status:          'pending'
  }).then(function(r) {
    if (r.error && r.error.message) {
      if (window.toast) toast('Submit error: ' + r.error.message, 'err'); return;
    }
    /* Notify user via Supabase notifications */
    window._supa.from('notifications').insert({
      user_id: window.U.uid,
      type:    'premium',
      title:   '💳 Premium Request Received!',
      body:    'Premium ' + tierLabel + ' (₹' + price + ') request mila! 1-2 ghante mein activate hoga.'
    }).catch(function(){});
    if (window.toast) toast('✅ Request submit! 1-2 ghante mein active.', 'ok');
    if (window.closeModal) closeModal();
  }).catch(function(e) {
    if (window.toast) toast('Submit failed — retry karo', 'err');
  });
};
};

function applyPremiumPerks(){
  if(!window.UD){setTimeout(applyPremiumPerks,800);return;}
  var tier=window.getUserPremiumTier(); if(!tier) return;
  if(!document.getElementById('_premNoAdsStyle')){var s=document.createElement('style');s.id='_premNoAdsStyle';s.textContent='.ad-banner,.ad-container,[id*="ad-"],[class*="adslot"]{display:none!important}';document.head.appendChild(s);}
  if(tier===3&&!document.getElementById('_premT3Style')){var s3=document.createElement('style');s3.id='_premT3Style';s3.textContent='.prof-ava{border-color:#b964ff!important;box-shadow:0 0 0 3px #b964ff33,0 0 20px #b964ff55!important;animation:t3glow 2s ease-in-out infinite!important}@keyframes t3glow{0%,100%{box-shadow:0 0 0 3px #b964ff33,0 0 20px #b964ff55}50%{box-shadow:0 0 0 3px #b964ff66,0 0 36px #b964ffaa}}';document.head.appendChild(s3);}
}

var _injN=0,_injT=setInterval(function(){_injN++;if(_injN>50){clearInterval(_injT);return;}if(!window.showProfileSettings||window._premInjV3)return;clearInterval(_injT);window._premInjV3=true;var _o=window.showProfileSettings;window.showProfileSettings=function(){_o.apply(this,arguments);setTimeout(function(){var pn=document.querySelector('#profSettingsSheet > div:last-child');if(!pn||pn.querySelector('#_premBtnV3'))return;var tier=window.getUserPremiumTier(),td=tier?TIERS[tier-1]:null,bc=td?td.color:'#ffd700',bg=td?'linear-gradient(135deg,'+td.bg+',rgba(255,255,255,.03))':'linear-gradient(135deg,rgba(255,215,0,.1),rgba(255,140,0,.06))',bb=td?td.border:'rgba(255,215,0,.35)',bl=td?(td.icon+' Premium '+td.label+' Active'):'👑 Go Premium';var div=document.createElement('div');div.style.cssText='padding:0 16px 12px';div.innerHTML='<button id="_premBtnV3" onclick="window.showPremiumUpgrade();setTimeout(function(){window.closeProfileSettings&&closeProfileSettings();},200)" style="width:100%;padding:14px;border-radius:14px;border:1.5px solid '+bb+';background:'+bg+';color:'+bc+';font-size:14px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 0 16px rgba(255,215,0,.1)">'+bl+' <span style="font-size:12px;opacity:.6">→</span></button>';pn.insertBefore(div,pn.firstChild);},120);};},300);

var _ps=document.createElement('style');_ps.textContent='@keyframes premFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}';document.head.appendChild(_ps);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyPremiumPerks);else applyPremiumPerks();
console.log('[Mini eSports] Premium System v3.0 ✅');
})();
