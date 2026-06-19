/* ================================================================
   CLEAN PLAYER BADGE v2.0 — 100% Supabase (users table)
   Uses users.clean_matches, users.has_clean_badge columns
================================================================ */
(function(){ 'use strict';
function _s(){ return window._supa; }
function _uid(){ return window.U&&window.U.uid; }
var THRESHOLD=30;

window.updateCleanRecord=function(completed,wasReported){
  if(!_s()||!_uid())return;
  var ud=window.UD||{};
  var cur=Number(ud.clean_matches||0);
  var hasBadge=!!(ud.has_clean_badge);
  if(wasReported){
    _s().from('users').update({clean_matches:0,has_clean_badge:false,clean_badge_revoked_at:new Date().toISOString()}).eq('id',_uid())
    .then(function(){ if(window.UD){window.UD.clean_matches=0;window.UD.has_clean_badge=false;} }).catch(function(){});
  } else if(completed){
    var newCount=cur+1;
    var newBadge=newCount>=THRESHOLD?true:hasBadge;
    _s().from('users').update({clean_matches:newCount,has_clean_badge:newBadge}).eq('id',_uid())
    .then(function(){
      if(window.UD){window.UD.clean_matches=newCount;window.UD.has_clean_badge=newBadge;}
      if(newBadge&&!hasBadge)_showBadgeAwarded();
    }).catch(function(){});
  }
};

function _showBadgeAwarded(){
  var h='<div style="text-align:center;padding:16px 0"><div style="font-size:64px;margin-bottom:10px">✅</div>';
  h+='<div style="font-size:22px;font-weight:900;color:var(--green)">Clean Player Badge!</div>';
  h+='<div style="font-size:13px;color:var(--txt2);margin-top:6px;line-height:1.6">Tumne '+THRESHOLD+' matches bina kisi report ke complete kiye!</div></div>';
  h+='<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);border-radius:14px;padding:14px;margin-bottom:14px"><div style="display:flex;align-items:center;gap:10px"><div style="font-size:28px">✅</div><div><div style="font-size:14px;font-weight:800;color:var(--green)">Verified Clean Player</div><div style="font-size:12px;color:var(--txt2)">Fair play · No rage quit · No reports</div></div></div></div>';
  h+='<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:13px;border-radius:13px;border:none;background:var(--green);color:#000;font-size:14px;font-weight:900;cursor:pointer">🎉 Awesome!</button>';
  if(window.openModal)openModal('🎉 Badge Earned!',h);
  if(window.logActivity)logActivity('win','✅ Clean Player Badge earn kiya!');
}

window.showCleanBadgeStatus=function(){
  if(!_uid()){if(window.toast)toast('Login karo','err');return;}
  var ud=window.UD||{};
  var count=Number(ud.clean_matches||0);
  var hasBadge=!!(ud.has_clean_badge);
  var pct=Math.min(100,Math.round(count/THRESHOLD*100));
  var h='<div style="text-align:center;padding:12px 0 18px">';
  h+=hasBadge?'<div style="font-size:52px;margin-bottom:8px">✅</div><div style="font-size:20px;font-weight:900;color:var(--green)">Verified Clean Player</div>':'<div style="font-size:52px;margin-bottom:8px;opacity:.4">🔒</div><div style="font-size:18px;font-weight:900;color:var(--txt)">Clean Player Badge</div><div style="font-size:12px;color:var(--txt2);margin-top:4px">Fair play prove karo!</div>';
  h+='</div>';
  if(!hasBadge){
    h+='<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;color:var(--txt2)">Progress</span><span style="font-size:12px;font-weight:800;color:var(--green)">'+count+'/'+THRESHOLD+'</span></div>';
    h+='<div style="height:8px;background:rgba(255,255,255,.08);border-radius:8px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,var(--green),#00d4ff);border-radius:8px"></div></div>';
    h+='<div style="font-size:11px;color:var(--txt2);margin-top:5px;text-align:center">'+(THRESHOLD-count)+' aur clean matches!</div></div>';
  }
  [['🎮','Match Complete Karo','Quit mat karo — poora match khelo'],['🚫','No Reports','Koi abuse ya cheat ki report nahi'],['⚠️','No Warnings','Admin se koi warning nahi']].forEach(function(r){
    h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;background:var(--card);border:1px solid '+(hasBadge?'rgba(0,255,156,.25)':'var(--border)')+';margin-bottom:7px"><span style="font-size:18px">'+r[0]+'</span><div style="flex:1"><div style="font-size:12px;font-weight:700">'+r[1]+'</div><div style="font-size:11px;color:var(--txt2)">'+r[2]+'</div></div><span>'+(hasBadge?'✅':'⏳')+'</span></div>';
  });
  if(window.openModal)openModal('✅ Clean Player Badge',h);
};

window.getCleanBadgeHTML=function(){
  var ud=window.UD||{};
  if(!ud.has_clean_badge)return'';
  return'<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.3);font-size:11px;font-weight:700;color:var(--green)">✅ Clean Player</span>';
};
})();
