/* FEATURE 39: Auto Team Readiness Check
   Duo/Squad join se pehle check kare team complete hai ya nahi. Soft warning. */
(function(){
'use strict';
function check(mode,cb){
  mode=(mode||'solo').toLowerCase();
  if(mode==='solo'){ cb(true); return; }
  if(!window.UD){ cb(true); return; }
  var UD=window.UD;
  if(mode==='duo'){
    if(UD.duoTeam&&UD.duoTeam.memberUid){ cb(true); return; }
    warn('duo',1); cb(false); return;
  }
  var sq=(UD.squadTeam&&UD.squadTeam.members)||[];
  if(sq.length>=3){ cb(true); return; }
  warn('squad',3-sq.length); cb(false);
}
function warn(mode,needed){
  if(!window.openModal) return;
  var h='<div style="text-align:center;padding:8px">'
    +'<div style="font-size:48px;margin-bottom:8px">'+(mode==='duo'?'👥':'👪')+'</div>'
    +'<div style="font-size:16px;font-weight:800;margin-bottom:6px">Team Incomplete!</div>'
    +'<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">'+(mode==='duo'?'Partner add karo Profile > My Team mein':''+needed+' aur member chahiye. Profile > My Team mein add karo')+'</div>'
    +'<button onclick="if(window.navTo)navTo(\'profile\');if(window.closeModal)closeModal()" style="width:100%;padding:12px;border-radius:12px;background:var(--primary,#00ff9c);color:#000;font-weight:800;border:none;cursor:pointer;margin-bottom:8px">👥 Team Setup Karo</button>'
    +'<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:10px;border-radius:12px;background:transparent;border:1px solid var(--border);color:var(--txt2);font-size:13px;cursor:pointer">Cancel</button></div>';
  window.openModal('⚠️ Team Incomplete',h);
}
window.f39Team={check:check,warn:warn};
})();
