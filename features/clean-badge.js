/* ================================================================
   CLEAN PLAYER BADGE v2.0 — 100% Supabase (users table)
   Uses users.clean_matches, users.has_clean_badge columns
================================================================ */
(function(){ 'use strict';
function _s(){ return window._supa; }
function _uid(){ return window.U&&window.U.uid; }
var THRESHOLD=30;


function _showBadgeAwarded(){
  var h='<div style="text-align:center;padding:16px 0"><div style="font-size:64px;margin-bottom:10px">✅</div>';
  h+='<div style="font-size:22px;font-weight:900;color:var(--green)">Clean Player Badge!</div>';
  h+='<div style="font-size:13px;color:var(--txt2);margin-top:6px;line-height:1.6">Tumne '+THRESHOLD+' matches bina kisi report ke complete kiye!</div></div>';
  h+='<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);border-radius:14px;padding:14px;margin-bottom:14px"><div style="display:flex;align-items:center;gap:10px"><div style="font-size:28px">✅</div><div><div style="font-size:14px;font-weight:800;color:var(--green)">Verified Clean Player</div><div style="font-size:12px;color:var(--txt2)">Fair play · No rage quit · No reports</div></div></div></div>';
  h+='<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:13px;border-radius:13px;border:none;background:var(--green);color:#000;font-size:14px;font-weight:900;cursor:pointer">🎉 Awesome!</button>';
  if(window.openModal)openModal('🎉 Badge Earned!',h);
  if(window.logActivity)logActivity('win','✅ Clean Player Badge earn kiya!');
}


})();
