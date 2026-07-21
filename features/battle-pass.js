/* ================================================================
   MINI eSPORTS — BATTLE PASS / SEASON PASS v1.1
   BUG 65 FIX: Fully migrated from Firebase RTDB → Supabase.
   RTDB had no battle_pass path filled → entire feature was empty.

   Free Track: Green Diamonds + Common Badges
   Premium Track ₹49/month: Exclusive Badges + Titles + Themes +
                             Animated Emojis + More Green Diamonds
   50 Tiers per Season — New season every month
================================================================ */
(function(){
'use strict';
var GDI=function(s){return '<img src="js/green-diamond.png" style="width:'+(s||14)+'px;height:'+(s||14)+'px;vertical-align:middle;object-fit:contain">';};

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

/* Get current season ID as text '2026_06'
   Bug 32 Fix: uses server time, not client clock */
function getSeasonId(){
  var now=(window.serverNow&&typeof window.serverNow==='function')?window.serverNow():Date.now();
  var d=new Date(now);
  return d.getFullYear()+'_'+String(d.getMonth()+1).padStart(2,'0');
}
window.getSeasonId=getSeasonId;

/* ── Helper: get or create progress row from Supabase (Bug 65 Fix) ── */
function _getBPProgress(uid, cb) {
  if (!window._supa || !uid) { cb(null); return; }
  var sid = getSeasonId();
  window._supa.from('battle_pass_progress')
    .select('*')
    .eq('user_id', uid)
    .eq('season_key', sid)
    .maybeSingle()
    .then(function(r) {
      if (r.data) { cb(r.data); return; }
      /* Row doesn't exist yet — create it */
      window._supa.from('battle_pass_progress').insert({
        user_id: uid,
        season_key: sid,
        current_xp: 0,
        current_tier: 0,
        has_premium: false,
        claimed_free: {},
        claimed_prem: {}
      }).select('*').single().then(function(r2) {
        cb(r2.data || {user_id:uid,season_key:sid,current_xp:0,current_tier:0,has_premium:false,claimed_free:{},claimed_prem:{}});
      }).catch(function(e) {
        console.warn('[BattlePass] Insert failed:', e.message);
        cb({user_id:uid,season_key:sid,current_xp:0,current_tier:0,has_premium:false,claimed_free:{},claimed_prem:{}});
      });
    }).catch(function(e) {
      console.warn('[BattlePass] Fetch failed:', e.message);
      cb({user_id:uid,season_key:sid,current_xp:0,current_tier:0,has_premium:false,claimed_free:{},claimed_prem:{}});
    });
}

/* ── Get current pass tier ── */
window.getPassTier=function(uid,cb){
  _getBPProgress(uid, function(d){
    if(!d){cb(0,false,null);return;}
    cb(d.current_tier||0, d.has_premium||false, d);
  });
};

/* ── Award XP → tier up (called from match result) ── */
/* Bug #15 Fix: XP update queue — prevents race condition from concurrent updates */
var _bpXPQueue = {}, _bpXPTimers = {};
window.awardPassXP=function(uid,xp){
  if(!window._supa||!uid||!xp||xp<=0)return;
  /* Accumulate XP in queue, flush after 500ms debounce */
  _bpXPQueue[uid] = (_bpXPQueue[uid]||0) + xp;
  clearTimeout(_bpXPTimers[uid]);
  _bpXPTimers[uid] = setTimeout(function() {
    var totalXP = _bpXPQueue[uid] || 0;
    _bpXPQueue[uid] = 0;
    if (totalXP <= 0) return;
    var sid = getSeasonId();
    /* Try RPC first (atomic — no race condition) */
    window._supa.rpc('award_battle_pass_xp', { p_uid: uid, p_season: sid, p_xp: totalXP })
      .then(function(r) {
        /* ✅ BUG FIX (2026-07-17): award_battle_pass_xp returns ok:false
           with a 200-level response (not a thrown Postgres error) for
           validation failures like negative XP — only genuine RPC-call
           failures (network, auth token issues) land in .catch() below.
           Previously this branch logged success unconditionally without
           checking r.data.ok, so a rejected call would have silently
           looked successful in the console with no XP actually awarded. */
        if (r && r.data && r.data.ok === false) {
          console.warn('[BattlePass] XP award rejected:', r.data.error);
          return;
        }
        console.log('[BattlePass] XP awarded via RPC:', totalXP);
      })
      .catch(function() {
        /* RPC not available — use careful read-modify-write with retry guard */
        if (window._bpUpdateInProgress && window._bpUpdateInProgress[uid]) return;
        if (!window._bpUpdateInProgress) window._bpUpdateInProgress = {};
        window._bpUpdateInProgress[uid] = true;
        _getBPProgress(uid, function(d) {
          window._bpUpdateInProgress[uid] = false;
          if (!d) return;
          var newXP = (d.current_xp || 0) + totalXP;
          var newTier = Math.min(50, Math.floor(newXP / 100));
          var update = { current_xp: newXP, updated_at: new Date().toISOString() };
          if (newTier > (d.current_tier || 0)) update.current_tier = newTier;
          window._supa.from('battle_pass_progress')
            .update(update)
            .eq('user_id', uid).eq('season_key', sid)
            .catch(function(e){ console.warn('[BattlePass] XP update failed:', e.message); });
        });
      });
  }, 500);
};

/* ── Show Battle Pass UI ── */
window.showBattlePass=function(){
  if(!window.U||!window.UD){if(window.toast)toast('Pehle login karo!','err');return;}
  if(!window._supa){if(window.toast)toast('Connection error, retry karo.','err');return;}
  var uid=window.U.uid;
  var now=(window.serverNow&&typeof window.serverNow==='function')?new Date(window.serverNow()):new Date();
  var monthName=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()];
  var daysLeft=new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate();

  _getBPProgress(uid, function(pData) {
    var curTier  = pData.current_tier  || 0;
    var hasPrem  = pData.has_premium   || false;
    var claimedF = pData.claimed_free  || {};
    var claimedP = pData.claimed_prem  || {};
    var totalXP  = pData.current_xp    || 0;
    var xpForNext = ((curTier+1)*100) - totalXP;
    var xpPct = Math.min(100, totalXP % 100);

    var h='';
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
    h+='<div style="margin-bottom:6px;display:flex;justify-content:space-between;font-size:11px"><span style="color:#888">Tier '+curTier+' / 50</span><span style="color:#ffd700">'+totalXP+' XP</span></div>';
    h+='<div style="height:6px;background:rgba(255,255,255,.08);border-radius:3px"><div style="height:100%;width:'+xpPct+'%;background:linear-gradient(90deg,#b964ff,#ffd700);border-radius:3px;transition:width .5s"></div></div>';
    h+='<div style="font-size:10px;color:#666;margin-top:4px">Agla tier ke liye '+xpForNext+' XP chahiye</div>';
    h+='</div></div>';

    /* Tier grid */
    h+='<div style="display:flex;flex-direction:column;gap:0">';
    var showFrom=Math.max(1,curTier-2),showTo=Math.min(50,showFrom+12);
    TIERS_DATA.slice(showFrom-1,showTo).forEach(function(td){
      var unlocked=curTier>=td.t;
      h+='<div style="display:grid;grid-template-columns:32px 1fr 1fr;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);opacity:'+(unlocked?'1':'.45')+'\">';
      h+='<div style="width:28px;height:28px;border-radius:8px;background:'+(unlocked?'rgba(255,215,0,.15)':'rgba(255,255,255,.05)')+';border:1px solid '+(unlocked?'rgba(255,215,0,.4)':'rgba(255,255,255,.1)')+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:'+(unlocked?'#ffd700':'#666')+'">'+td.t+'</div>';
      /* Free track */
      var fc=claimedF[String(td.t)];
      h+='<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:7px 9px">';
      h+='<div style="font-size:9px;color:#555;margin-bottom:3px;font-weight:700">FREE</div>';
      var fLabel=td.free.label||(td.free.type==='gd'?GDI(11)+' '+td.free.v:'');
      h+='<div style="font-size:11px;color:'+(unlocked?'#ddd':'#555')+';display:flex;align-items:center;gap:4px">'+fLabel+'</div>';
      if(unlocked&&!fc) h+='<button onclick="window.claimPassReward(\''+td.t+'\',\'free\')" style="margin-top:5px;font-size:9px;padding:3px 8px;border-radius:6px;border:none;background:rgba(0,255,100,.15);color:#00ff64;cursor:pointer;font-weight:700">CLAIM</button>';
      else if(fc)        h+='<div style="margin-top:4px;font-size:9px;color:#00ff64;font-weight:700">✓ Claimed</div>';
      h+='</div>';
      /* Premium track */
      var pc=claimedP[String(td.t)];
      h+='<div style="background:'+(hasPrem?'rgba(185,100,255,.07)':'rgba(255,255,255,.03)')+';border:1px solid '+(hasPrem?'rgba(185,100,255,.2)':'rgba(255,255,255,.06)')+';border-radius:10px;padding:7px 9px">';
      h+='<div style="font-size:9px;color:'+(hasPrem?'#b964ff55':'#444')+';margin-bottom:3px;font-weight:700">PREMIUM</div>';
      var pLabel=td.prem.label||(td.prem.type==='gd'?GDI(11)+' '+td.prem.v:(td.prem.v||''));
      h+='<div style="font-size:11px;color:'+(hasPrem&&unlocked?'#ddd':'#555')+';display:flex;align-items:center;gap:4px">'+pLabel+'</div>';
      if(hasPrem&&unlocked&&!pc) h+='<button onclick="window.claimPassReward(\''+td.t+'\',\'prem\')" style="margin-top:5px;font-size:9px;padding:3px 8px;border-radius:6px;border:none;background:rgba(185,100,255,.2);color:#b964ff;cursor:pointer;font-weight:700">CLAIM</button>';
      else if(hasPrem&&pc)       h+='<div style="margin-top:4px;font-size:9px;color:#b964ff;font-weight:700">✓ Claimed</div>';
      else if(!hasPrem)          h+='<div style="margin-top:4px;font-size:9px;color:#444">🔒 Premium</div>';
      h+='</div>';
      h+='</div>';
    });
    h+='</div>';
    if(showTo<50) h+='<div style="text-align:center;font-size:11px;color:#555;padding:10px 0">Aur '+(50-showTo)+' tiers hain • Match khelo → XP kamao</div>';
    h+='<div style="text-align:center;font-size:11px;color:#444;padding:8px 0">Har mahine naya Season Pass aata hai!</div>';

    if(window.openModal) openModal('🎫 Season Pass — '+monthName, h);
  });
};

/* ── Claim reward (BUG #31/#44 FIX 2026-07: single atomic RPC, closes the TOCTOU gap
   between the read and the write that the previous "in-progress" memory flag only
   partially guarded against — e.g. two browser tabs) ── */
var _bpClaimInProgress = {};
window.claimPassReward=function(tierNum,track){
  if(!window.U||!window._supa)return;
  var uid=window.U.uid, sid=getSeasonId();
  var td=TIERS_DATA[tierNum-1]; if(!td)return;
  var reward=track==='free'?td.free:td.prem;
  var claimKey = uid+'_'+tierNum+'_'+track;
  if (_bpClaimInProgress[claimKey]) { if(window.toast)toast('Claim processing...','inf'); return; }
  _bpClaimInProgress[claimKey] = true;
  var gdAmt = (reward.type==='gd' ? reward.v : 0) + (reward.extraGD || 0);
  window._supa.rpc('claim_battle_pass_tier', { p_season: sid, p_tier: tierNum, p_track: track, p_gd_reward: gdAmt })
    .then(function(r) {
      _bpClaimInProgress[claimKey] = false;
      if (r.error || (r.data && r.data.success === false)) {
        var msg = (r.data && r.data.error) || (r.error && r.error.message) || 'Claim failed, retry karo.';
        if (window.toast) toast(msg, 'err');
        return;
      }
      /* ✅ BUG FIX (2026-07-17): claim_battle_pass_tier RPC already credits
         green_diamonds AND inserts the wallet_transactions ledger row
         atomically, server-side — this client-side block used to insert a
         SECOND wallet_transactions row for the same claim (a duplicate
         ledger entry, same class of bug as the earlier-fixed BUG #26/#35
         double-credit issues) and manually bump window.UD.greenDiamonds
         on top of the server-side credit. Removed the duplicate write;
         UD.green_diamonds gets refreshed from the server on next sync
         instead of being locally guessed at here.
         (Note: window.UD.greenDiamonds — camelCase — was also never the
         real field name; the actual column/field is green_diamonds.) */
      var lbl=reward.label||reward.v||'Reward';
      if(window.toast)toast('✅ '+lbl+' claimed!','ok');
      setTimeout(function(){ window.showBattlePass(); }, 400);
    })
    .catch(function(e){ _bpClaimInProgress[claimKey]=false; if(window.toast)toast('Claim failed, retry karo.','err'); console.error('[BattlePass] Claim error:',e.message); });
};

/* ── Buy Season Pass (Bug 65 Fix: _submitSP now writes to Supabase) ── */
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
    if(window.openModal) openModal('🎫 Buy Season Pass',h);

    var _ss='';
    window._spHandleSs=function(inp){
      if(!inp.files||!inp.files[0])return;
      /* Bug 65 Fix: Use ImgBB for screenshot instead of storing base64 in RTDB */
      if (window.uploadToImgBB) {
        window.uploadToImgBB(inp, 'season_pass_'+Date.now(), function(err, url) {
          if (err) {
            /* Fallback: base64 preview only (no storage) */
            var r=new FileReader();
            r.onload=function(e){ _ss=e.target.result; _spShowPreview(_ss); };
            r.readAsDataURL(inp.files[0]);
            return;
          }
          _ss = url;
          _spShowPreview(url);
        });
      } else {
        var r=new FileReader();
        r.onload=function(e){_ss=e.target.result;_spShowPreview(_ss);};
        r.readAsDataURL(inp.files[0]);
      }
    };

    function _spShowPreview(src) {
      var prev=document.getElementById('_spPreview'),area=document.getElementById('_spSsArea');
      if(prev){prev.src=src;prev.style.display='block';}
      if(area)area.innerHTML='<i class="fas fa-check-circle" style="color:#00ff9c;font-size:20px;display:block;margin-bottom:4px"></i><div style="font-size:11px;color:#00ff9c">Ready ✅</div>';
    }

    /* Bug 65 Fix: Submit to Supabase season_pass_requests instead of RTDB */
    window._submitSP=function(){
      if(!_ss){if(window.toast)toast('Screenshot upload karo!','err');return;}
      if(!window.U||!window._supa){if(window.toast)toast('Login karo pehle','err');return;}
      var uid=window.U.uid;
      var ign=(window.UD&&(window.UD.ign||window.UD.displayName))||'';
      window._supa.from('season_pass_requests').insert({
        user_id: uid,
        ign: ign,
        season_key: getSeasonId(),
        price: PASS_PRICE,
        payment_screenshot: _ss,
        status: 'pending'
      }).then(function(){
        /* Notify via Supabase notifications table */
        window._supa.from('notifications').insert({
          user_id: uid,
          type: 'premium',
          title: '🎫 Season Pass Request Received!',
          body: '₹'+PASS_PRICE+' Season Pass request mila! 1-2 ghante mein activate hoga.',
          is_read: false
        }).catch(function(){});
        if(window.toast)toast('✅ Request submit! 1-2 ghante mein active.','ok');
        if(window.closeModal)closeModal();
      }).catch(function(e){
        console.error('[BattlePass] Submit error:',e.message);
        if(window.toast)toast('Submit failed, retry karo.','err');
      });
    };
  });
};

console.log('[Mini eSports] ✅ Battle Pass v1.1 loaded (Bug 65 Fixed: RTDB → Supabase)');
})();
