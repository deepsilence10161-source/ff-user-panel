/* ================================================================
   MINI eSPORTS — BATTLE PASS / SEASON PASS v1.0
   Free Track: Green Diamonds + Common Badges
   Premium Track ₹49/month: Exclusive Badges + Titles + Themes +
                             Animated Emojis + More Green Diamonds
   50 Tiers per Season — New season every month
================================================================ */
(function(){
'use strict';
var GDI=function(s){return '<img src="js/green-diamond.png" style="width:'+(s||14)+'px;height:'+(s||14)+'px;vertical-align:middle;object-fit:contain">';};

/* ── Season Pass config ── */
var PASS_PRICE=49;

/* 50 tiers — free and premium rewards */
var TIERS_DATA=[
  {t:1, free:{type:'gd',v:5,label:'5 '+GDI(13)}, prem:{type:'badge',v:'🎖️ Starter Badge',label:'Starter Badge'}},
  {t:2, free:{type:'gd',v:5}, prem:{type:'gd',v:10,label:'10 '+GDI(13)}},
  {t:3, free:{type:'gd',v:5}, prem:{type:'gd',v:10}},
  {t:4, free:{type:'gd',v:5}, prem:{type:'gd',v:10}},
  {t:5, free:{type:'badge',v:'🥉 Bronze Warrior',label:'Bronze Warrior Badge'}, prem:{type:'badge',v:'🌟 Chosen One',label:'Chosen One Badge'}},
  {t:6, free:{type:'gd',v:8}, prem:{type:'gd',v:15}},
  {t:7, free:{type:'gd',v:8}, prem:{type:'gd',v:15}},
  {t:8, free:{type:'gd',v:8}, prem:{type:'emoji',v:'🔥 Fire Pack',label:'Fire Emoji Pack'}},
  {t:9, free:{type:'gd',v:8}, prem:{type:'gd',v:15}},
  {t:10,free:{type:'gd',v:10,label:'10 '+GDI(13)},prem:{type:'gd',v:20,label:'20 '+GDI(13)}},
  {t:11,free:{type:'gd',v:8},prem:{type:'gd',v:15}},
  {t:12,free:{type:'gd',v:8},prem:{type:'gd',v:15}},
  {t:13,free:{type:'gd',v:8},prem:{type:'theme',v:'🔵 Blue Flame Border',label:'Blue Flame Border'}},
  {t:14,free:{type:'gd',v:8},prem:{type:'gd',v:15}},
  {t:15,free:{type:'badge',v:'🎖️ Participant',label:'Participant Badge'},prem:{type:'badge',v:'🥈 Silver Fighter',label:'Silver Fighter Badge'}},
  {t:16,free:{type:'gd',v:10},prem:{type:'gd',v:20}},
  {t:17,free:{type:'gd',v:10},prem:{type:'gd',v:20}},
  {t:18,free:{type:'gd',v:10},prem:{type:'emoji',v:'⚡ Lightning Pack',label:'Lightning Emoji Pack'}},
  {t:19,free:{type:'gd',v:10},prem:{type:'gd',v:20}},
  {t:20,free:{type:'gd',v:10},prem:{type:'gd',v:25,label:'25 '+GDI(13)}},
  {t:21,free:{type:'gd',v:10},prem:{type:'gd',v:20}},
  {t:22,free:{type:'gd',v:10},prem:{type:'gd',v:20}},
  {t:23,free:{type:'gd',v:10},prem:{type:'theme',v:'🟣 Purple Haze Border',label:'Purple Haze Border'}},
  {t:24,free:{type:'gd',v:10},prem:{type:'gd',v:20}},
  {t:25,free:{type:'gd',v:15,label:'15 '+GDI(13)},prem:{type:'badge',v:'🥇 Gold Champion',label:'Gold Champion Badge'}},
  {t:26,free:{type:'gd',v:12},prem:{type:'gd',v:25}},
  {t:27,free:{type:'gd',v:12},prem:{type:'gd',v:25}},
  {t:28,free:{type:'gd',v:12},prem:{type:'emoji',v:'👑 Crown Pack',label:'Crown Emoji Pack'}},
  {t:29,free:{type:'gd',v:12},prem:{type:'gd',v:25}},
  {t:30,free:{type:'badge',v:'💪 Grinder',label:'Grinder Badge'},prem:{type:'gd',v:30,label:'30 '+GDI(13)}},
  {t:31,free:{type:'gd',v:12},prem:{type:'gd',v:25}},
  {t:32,free:{type:'gd',v:12},prem:{type:'gd',v:25}},
  {t:33,free:{type:'gd',v:12},prem:{type:'theme',v:'🟡 Golden Frame',label:'Golden Frame Theme'}},
  {t:34,free:{type:'gd',v:12},prem:{type:'gd',v:25}},
  {t:35,free:{type:'gd',v:15},prem:{type:'emoji',v:'🌈 Neon Pack',label:'Neon Animated Emoji Pack'}},
  {t:36,free:{type:'gd',v:15},prem:{type:'gd',v:30}},
  {t:37,free:{type:'gd',v:15},prem:{type:'gd',v:30}},
  {t:38,free:{type:'gd',v:15},prem:{type:'theme',v:'🌊 Ocean Wave Border',label:'Ocean Wave Border'}},
  {t:39,free:{type:'gd',v:15},prem:{type:'gd',v:30}},
  {t:40,free:{type:'gd',v:20,label:'20 '+GDI(13)},prem:{type:'badge',v:'💎 Platinum Pro',label:'Platinum Pro Badge'}},
  {t:41,free:{type:'gd',v:15},prem:{type:'gd',v:35}},
  {t:42,free:{type:'gd',v:15},prem:{type:'gd',v:35}},
  {t:43,free:{type:'gd',v:15},prem:{type:'emoji',v:'🔴 Fire God Pack',label:'Fire God Emoji Pack'}},
  {t:44,free:{type:'gd',v:15},prem:{type:'gd',v:35}},
  {t:45,free:{type:'badge',v:'🎯 Dedicated',label:'Dedicated Badge'},prem:{type:'gd',v:40,label:'40 '+GDI(13)}},
  {t:46,free:{type:'gd',v:15},prem:{type:'gd',v:35}},
  {t:47,free:{type:'gd',v:15},prem:{type:'gd',v:35}},
  {t:48,free:{type:'gd',v:15},prem:{type:'theme',v:'🌌 Galaxy Border',label:'Galaxy Animated Border'}},
  {t:49,free:{type:'gd',v:15},prem:{type:'gd',v:35}},
  {t:50,free:{type:'gd',v:20},prem:{type:'title',v:'🏆 Season Legend',label:'Season Legend Title + 50 '+GDI(13),extraGD:50}}
];

/* Get current season ID (year_month) */
function getSeasonId(){
  var d=new Date();
  return d.getFullYear()+'_'+String(d.getMonth()+1).padStart(2,'0');
}
window.getSeasonId=getSeasonId;

/* How many tiers earned: 1 tier per 30 rank points (capped at 50) */
window.getPassTier=function(uid,cb){
  if(!window.db||!uid){cb(0,0);return;}
  var sid=getSeasonId();
  window.db.ref('battlePass/'+sid+'/'+uid).once('value',function(s){
    var d=s.val()||{tier:0,hasPremium:false,claimedFree:{},claimedPrem:{}};
    cb(d.tier||0,d.hasPremium||false,d);
  });
};

/* Award XP → tier up (called from match result) */
window.awardPassXP=function(uid,xp){
  if(!window.db||!uid) return;
  var sid=getSeasonId();
  window.db.ref('battlePass/'+sid+'/'+uid+'/xp').transaction(function(cur){
    return (Number(cur)||0)+xp;
  },function(err,committed,snap){
    if(committed&&snap){
      var totalXP=snap.val()||0;
      var newTier=Math.min(50,Math.floor(totalXP/100));
      window.db.ref('battlePass/'+sid+'/'+uid+'/tier').transaction(function(cur){
        var old=Number(cur)||0;
        if(newTier>old) return newTier;
        return old;
      });
    }
  });
};

/* Show Battle Pass UI */
window.showBattlePass=function(){
  if(!window.U||!window.UD){if(window.toast)toast('Pehle login karo!','err');return;}
  if(!window.db){if(window.toast)toast('Connection error, retry karo.','err');return;}
  var uid=window.U.uid,sid=getSeasonId();
  var d=new Date(),monthName=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  var daysLeft=new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-d.getDate();

  window.db.ref('battlePass/'+sid+'/'+uid).once('value',function(s){
    var pData=s.val()||{tier:0,hasPremium:false,claimedFree:{},claimedPrem:{}};
    var curTier=pData.tier||0;
    var hasPrem=pData.hasPremium||false;
    var claimedF=pData.claimedFree||{};
    var claimedP=pData.claimedPrem||{};
    var totalXP=pData.xp||0;
    var xpForNext=((curTier+1)*100)-totalXP;
    var xpPct=Math.min(100,Math.round((totalXP%(100)))); // progress in current tier

    var h='';
    /* Header */
    h+='<div style="position:relative;overflow:hidden;border-radius:16px;padding:16px;margin-bottom:14px;background:linear-gradient(135deg,#0d0820,#1a0d3e)">';
    h+='<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(185,100,255,.2),transparent 60%),radial-gradient(ellipse at 70% 50%,rgba(255,215,0,.1),transparent 60%);pointer-events:none"></div>';
    h+='<div style="position:relative">';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    h+='<div><div style="font-size:16px;font-weight:900;color:#fff">Season Pass</div>';
    h+='<div style="font-size:11px;color:#888">'+monthName+' Season • '+daysLeft+' din baaki</div></div>';
    if(!hasPrem){
      h+='<button onclick="window.buySeasonPass()" style="padding:8px 16px;border-radius:12px;border:none;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:12px;font-weight:900;cursor:pointer">₹'+PASS_PRICE+' Unlock 👑</button>';
    } else {
      h+='<div style="padding:6px 12px;border-radius:10px;background:rgba(185,100,255,.2);border:1px solid rgba(185,100,255,.4);font-size:11px;font-weight:800;color:#b964ff">👑 Premium Active</div>';
    }
    h+='</div>';
    /* Progress bar */
    h+='<div style="margin-bottom:6px;display:flex;justify-content:space-between;font-size:11px"><span style="color:#888">Tier '+curTier+' / 50</span><span style="color:#ffd700">'+totalXP+' XP</span></div>';
    h+='<div style="height:6px;background:rgba(255,255,255,.08);border-radius:3px"><div style="height:100%;width:'+xpPct+'%;background:linear-gradient(90deg,#b964ff,#ffd700);border-radius:3px;transition:width .5s"></div></div>';
    h+='<div style="font-size:10px;color:#666;margin-top:4px">Agla tier ke liye '+xpForNext+' XP chahiye (matches khelo → XP milta hai)</div>';
    h+='</div></div>';

    /* Tier grid */
    h+='<div style="display:flex;flex-direction:column;gap:0">';
    /* Show 10 tiers around current */
    var showFrom=Math.max(1,curTier-2),showTo=Math.min(50,showFrom+12);
    TIERS_DATA.slice(showFrom-1,showTo).forEach(function(td){
      var unlocked=curTier>=td.t;
      var dimmed=!unlocked;
      h+='<div style="display:grid;grid-template-columns:32px 1fr 1fr;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);opacity:'+(dimmed?'.45':'1')+'">';
      /* Tier number */
      h+='<div style="width:28px;height:28px;border-radius:8px;background:'+(unlocked?'rgba(255,215,0,.15)':'rgba(255,255,255,.05)')+';border:1px solid '+(unlocked?'rgba(255,215,0,.4)':'rgba(255,255,255,.1)')+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:'+(unlocked?'#ffd700':'#666')+'">'+td.t+'</div>';
      /* Free reward */
      var fc=claimedF[td.t];
      h+='<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:7px 9px">';
      h+='<div style="font-size:9px;color:#555;margin-bottom:3px;font-weight:700">FREE</div>';
      var fLabel=td.free.label||(td.free.type==='gd'?GDI(11)+' '+td.free.v:'');
      h+='<div style="font-size:11px;color:'+(unlocked?'#ddd':'#555')+';display:flex;align-items:center;gap:4px">'+fLabel+'</div>';
      if(unlocked&&!fc)h+='<button onclick="window.claimPassReward(\''+td.t+'\',\'free\')" style="margin-top:5px;font-size:9px;padding:3px 8px;border-radius:6px;border:none;background:rgba(0,255,100,.15);color:#00ff64;cursor:pointer;font-weight:700">CLAIM</button>';
      else if(fc)h+='<div style="margin-top:4px;font-size:9px;color:#00ff64;font-weight:700">✓ Claimed</div>';
      h+='</div>';
      /* Premium reward */
      var pc=claimedP[td.t];
      h+='<div style="background:'+(hasPrem?'rgba(185,100,255,.07)':'rgba(255,255,255,.03)')+';border:1px solid '+(hasPrem?'rgba(185,100,255,.2)':'rgba(255,255,255,.06)')+';border-radius:10px;padding:7px 9px">';
      h+='<div style="font-size:9px;color:'+(hasPrem?'#b964ff55':'#444')+';margin-bottom:3px;font-weight:700">PREMIUM</div>';
      var pLabel=td.prem.label||(td.prem.type==='gd'?GDI(11)+' '+td.prem.v:(td.prem.v||''));
      h+='<div style="font-size:11px;color:'+(hasPrem&&unlocked?'#ddd':'#555')+';display:flex;align-items:center;gap:4px">'+pLabel+'</div>';
      if(hasPrem&&unlocked&&!pc)h+='<button onclick="window.claimPassReward(\''+td.t+'\',\'prem\')" style="margin-top:5px;font-size:9px;padding:3px 8px;border-radius:6px;border:none;background:rgba(185,100,255,.2);color:#b964ff;cursor:pointer;font-weight:700">CLAIM</button>';
      else if(hasPrem&&pc)h+='<div style="margin-top:4px;font-size:9px;color:#b964ff;font-weight:700">✓ Claimed</div>';
      else if(!hasPrem)h+='<div style="margin-top:4px;font-size:9px;color:#444">🔒 Premium</div>';
      h+='</div>';
      h+='</div>';
    });
    h+='</div>';

    /* Show all / nav hint */
    if(showTo<50)h+='<div style="text-align:center;font-size:11px;color:#555;padding:10px 0">Aur '+( 50-showTo)+' tiers hain • Match khelo → XP kamao → Tiers unlock karo</div>';
    h+='<div style="text-align:center;font-size:11px;color:#444;padding:8px 0">Har mahine naya Season Pass aata hai — rewards badal jaate hain!</div>';

    if(window.openModal)openModal('🎫 Season Pass — '+monthName,h);
  });
};

/* Claim reward */
window.claimPassReward=function(tierNum,track){
  if(!window.U||!window.db)return;
  var uid=window.U.uid,sid=getSeasonId();
  var td=TIERS_DATA[tierNum-1]; if(!td)return;
  var reward=track==='free'?td.free:td.prem;
  var claimKey='battlePass/'+sid+'/'+uid+'/'+(track==='free'?'claimedFree':'claimedPrem')+'/'+tierNum;
  window.db.ref(claimKey).once('value',function(s){
    if(s.val())return; // already claimed
    window.db.ref(claimKey).set(true);
    if(reward.type==='gd'||reward.extraGD){
      var gdAmt=(reward.type==='gd'?reward.v:0)+(reward.extraGD||0);
      if(gdAmt>0){
        window.db.ref('users/'+uid+'/greenDiamonds').transaction(function(cur){return (Number(cur)||0)+gdAmt;});
        if(window.UD)window.UD.greenDiamonds=(Number(window.UD.greenDiamonds)||0)+gdAmt;
      }
    }
    var lbl=reward.label||reward.v||'Reward';
    if(window.toast)toast('✅ '+lbl+' claimed!','ok');
    /* Refresh pass UI */
    setTimeout(function(){window.showBattlePass();},400);
  });
};

/* Buy Season Pass */
window.buySeasonPass=function(){
  window.checkPolicyThenRun(function(){
    var h='';
    h+='<div style="text-align:center;padding:8px 0 16px"><div style="font-size:38px;margin-bottom:6px">🎫</div>';
    h+='<div style="font-size:18px;font-weight:900;color:#b964ff">Season Pass</div>';
    h+='<div style="font-size:28px;font-weight:900;color:#fff;margin:6px 0">₹'+PASS_PRICE+'<span style="font-size:13px;color:#888">/mahina</span></div></div>';
    h+='<div style="background:rgba(185,100,255,.07);border:1px solid rgba(185,100,255,.2);border-radius:13px;padding:12px;margin-bottom:14px">';
    h+='<div style="font-size:11px;font-weight:700;color:#b964ff;margin-bottom:8px">PREMIUM TRACK UNLOCKS:</div>';
    ['50 Tiers ke exclusive rewards (Badges, Titles, Themes, Emojis)','Free track se zyada Green Diamonds','Har mahine naye exclusive items','Season Legend Title (Tier 50 pe)'].forEach(function(t){h+='<div style="display:flex;align-items:center;gap:7px;font-size:11.5px;color:#ccc;margin-bottom:5px"><span style="color:#b964ff">✓</span>'+t+'</div>';});
    h+='</div>';
    h+='<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:13px;padding:13px;margin-bottom:12px">';
    ['UPI: <strong style="color:#ffd700">miniesports@upi</strong> par ₹'+PASS_PRICE+' bhejo','Screenshot lo','Neeche upload karo — 1-2 ghante mein activate hoga'].forEach(function(s,i){h+='<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;font-size:12px;color:#ccc"><div style="min-width:22px;height:22px;border-radius:50%;background:rgba(185,100,255,.12);border:1px solid rgba(185,100,255,.3);color:#b964ff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center">'+(i+1)+'</div>'+s+'</div>';});
    h+='</div>';
    h+='<div id="_spSsArea" onclick="document.getElementById(\'_spSsIn\').click()" style="border:2px dashed rgba(185,100,255,.2);border-radius:13px;padding:18px;text-align:center;cursor:pointer;background:rgba(185,100,255,.03);margin-bottom:12px"><i class="fas fa-camera" style="font-size:24px;color:#b964ff55;display:block;margin-bottom:6px"></i><div style="font-size:12px;color:#666">Screenshot upload karo</div><input type="file" id="_spSsIn" accept="image/*" style="display:none" onchange="window._spHandleSs(this)"></div>';
    h+='<img id="_spPreview" style="display:none;width:100%;border-radius:10px;margin-bottom:12px;max-height:160px;object-fit:cover">';
    h+='<button onclick="window._submitSP()" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,#b964ff,#6b2fcc);color:#fff;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 4px 18px rgba(185,100,255,.35)">🎫 Season Pass Request Submit Karo</button>';
    if(window.openModal)openModal('🎫 Buy Season Pass',h);
    var _ss='';
    window._spHandleSs=function(inp){if(!inp.files||!inp.files[0])return;var r=new FileReader();r.onload=function(e){var img=new Image();img.onload=function(){var cv=document.createElement('canvas'),mw=800,w=img.width,hh=img.height;if(w>mw){hh=Math.round(hh*(mw/w));w=mw;}cv.width=w;cv.height=hh;cv.getContext('2d').drawImage(img,0,0,w,hh);_ss=cv.toDataURL('image/jpeg',.72);var prev=document.getElementById('_spPreview'),area=document.getElementById('_spSsArea');if(prev){prev.src=_ss;prev.style.display='block';}if(area)area.innerHTML='<i class="fas fa-check-circle" style="color:#00ff9c;font-size:20px;display:block;margin-bottom:4px"></i><div style="font-size:11px;color:#00ff9c">Ready ✅</div>';};img.src=e.target.result;};r.readAsDataURL(inp.files[0]);};
    window._submitSP=function(){if(!_ss){if(window.toast)toast('Screenshot upload karo!','err');return;}if(!window.U||!window.db)return;var id=window.db.ref('seasonPassRequests').push().key;window.db.ref('seasonPassRequests/'+id).set({uid:window.U.uid,userName:(window.UD&&(window.UD.ign||window.UD.displayName))||'',price:PASS_PRICE,season:getSeasonId(),screenshotBase64:_ss,status:'pending',createdAt:Date.now()});window.db.ref('users/'+window.U.uid+'/notifications').push({title:'🎫 Season Pass Request Received!',message:'₹'+PASS_PRICE+' Season Pass request mila! 1-2 ghante mein activate hoga.',timestamp:Date.now(),createdAt:Date.now(),read:false,type:'seasonpass'});if(window.toast)toast('✅ Request submit! 1-2 ghante mein active.','ok');if(window.closeModal)closeModal();};
  });
};

console.log('[Mini eSports] Battle Pass v1.0 ✅');
})();
