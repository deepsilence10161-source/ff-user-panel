/* FEATURE 35: Smart Join Confirmation Modal
   Beautiful confirm before join — shows match, fee, team. No accidental joins. */
(function(){
'use strict';
function show(id,onConfirm){
  var t=window.MT&&window.MT[id]; if(!t||!window.UD||!window.openModal){ if(onConfirm)onConfirm(); return; }
  var mode=(t.mode||'solo').toLowerCase();
  var isCoin=(t.entryType||'').toLowerCase()==='coin';
  var fee=Number(t.entryFee)||0;
  var UD=window.UD;
  var team='';
  if(mode==='duo'&&UD.duoTeam&&UD.duoTeam.memberUid)
    team='<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.15);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px"><i class="fas fa-user-friends" style="color:var(--blue,#00d4ff);margin-right:6px"></i>With: <strong>'+(UD.duoTeam.memberName||'Partner')+'</strong></div>';
  else if(mode==='squad'){
    var sq=(UD.squadTeam&&UD.squadTeam.members)||[];
    if(sq.length) team='<div style="background:rgba(185,100,255,.06);border:1px solid rgba(185,100,255,.15);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px"><i class="fas fa-users" style="color:var(--purple,#b964ff);margin-right:6px"></i>Squad: You + '+sq.slice(0,3).map(function(m){return m.name||'?';}).join(', ')+'</div>';
  }
  var h='<div>'
    +'<div style="text-align:center;padding:14px;background:rgba(0,255,156,.05);border-radius:14px;margin-bottom:14px">'
    +'<div style="font-size:11px;color:var(--txt2);margin-bottom:4px">'+mode.toUpperCase()+(t.map?' · '+t.map:'')+'</div>'
    +'<div style="font-size:18px;font-weight:800">'+t.name+'</div>'
    +'<div style="font-size:13px;color:var(--txt2);margin-top:4px">Entry: <strong style="color:'+(isCoin?'#ffd700':'var(--primary,#00ff9c)')+'">'+( isCoin?'🪙 '+fee+' Coins':'₹'+fee)+'</strong></div>'
    +'<div style="font-size:11px;color:var(--txt2);margin-top:2px">Prize: <strong>₹'+(t.prizePool||0)+'</strong></div></div>'
    +team
    +'<div style="font-size:11px;color:var(--txt2);text-align:center;margin-bottom:14px">Entry fee non-refundable after joining</div>'
    +'<button onclick="window._f35cb()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:900;border:none;cursor:pointer;font-size:14px;margin-bottom:8px">⚡ Confirm Join</button>'
    +'<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:10px;border-radius:12px;background:transparent;border:1px solid var(--border);color:var(--txt2);font-size:13px;cursor:pointer">Cancel</button></div>';
  window._f35cb=function(){ if(window.closeModal)closeModal(); if(onConfirm)onConfirm(); };
  window.openModal('🎮 Join Match?',h);
}
window.f35Confirm={show:show}; window.showJoinConfirm=show;
})();
