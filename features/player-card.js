/* ================================================================
   MINI eSPORTS — STYLISH PLAYER CARD v1.0
   Beautiful shareable card with stats
   Uses Canvas API for image generation
================================================================ */
(function(){
'use strict';

/* ── Generate card HTML preview ── */
window.showPlayerCard = function(targetUid){
  var uid = targetUid || (window.U && window.U.uid);
  if(!uid){ toast('Login karo','err'); return; }
  openModal('🃏 Player Card','<div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading...</div>');
  /* Load from Supabase */
  if(window._supa){
    window._supa.from('users').select('id,ign,ff_uid,avatar_url,rank_points,rank_tier,total_wins,total_kills,total_matches,city,clan_id').eq('id',uid).single()
    .then(function(r){ _renderPlayerCard(r.data||{}); })
    .catch(function(){ _renderPlayerCard(window.UD||{}); });
  } else {
    _renderPlayerCard(window.UD||{});
  }
};

function _renderPlayerCard(data){
  var mb=document.getElementById('modalB'); if(!mb) return;
  var ign     = data.ign||data.displayName||'Player';
  var ffUid   = data.ff_uid||data.ffUid||'—';
  var rp      = data.rank_points||data.rankPoints||0;
  var wins    = data.total_wins||0;
  var kills   = data.total_kills||0;
  var matches = data.total_matches||0;
  var city    = data.city||'India';
  var wr      = matches>0 ? Math.round(wins/matches*100) : 0;
  var kd      = matches>0 ? (kills/matches).toFixed(1) : '0.0';
  var ri      = _pcRankInfo(rp);
  /* streak */
  var streak  = (window.UD&&data.id===(window.U&&window.U.uid)&&window.UD._winStreak)||0;
  var streakBadge = streak>=7?'💀 Unstoppable':streak>=5?'⚡ On Fire':streak>=3?'🔥 Hot Streak':'';
  /* Build the visual card */
  var h='<div id="playerCardWrap">';
  /* Card visual */
  h+='<div id="playerCardVisual" style="background:linear-gradient(135deg,#0a0a1a 0%,#12122a 40%,#0f1f2e 100%);border-radius:20px;padding:0;overflow:hidden;position:relative;margin-bottom:14px;border:2px solid '+ri.color+'44">';
  /* Top glow */
  h+='<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,'+ri.color+',transparent)"></div>';
  /* BG blobs */
  h+='<div style="position:absolute;top:-40px;right:-40px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,'+ri.color+'22,transparent 70%);pointer-events:none"></div>';
  h+='<div style="position:absolute;bottom:-30px;left:-30px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(0,212,255,.15),transparent 70%);pointer-events:none"></div>';
  /* Header bar */
  h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px;position:relative">';
  h+='<div style="font-size:10px;font-weight:900;letter-spacing:3px;color:'+ri.color+';opacity:.8">MINI ESPORTS</div>';
  h+='<div style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:'+ri.color+'22;border:1px solid '+ri.color+'44">';
  h+='<span style="font-size:14px">'+ri.emoji+'</span>';
  h+='<span style="font-size:11px;font-weight:800;color:'+ri.color+'">'+ri.badge+'</span>';
  h+='</div></div>';
  /* Avatar + main info */
  h+='<div style="display:flex;align-items:center;gap:14px;padding:4px 16px 14px;position:relative">';
  /* Avatar */
  var avStyle='width:72px;height:72px;border-radius:18px;border:2.5px solid '+ri.color+';flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;background:'+ri.bg+';color:'+ri.color;
  var avContent=(data.avatar_url||data.profileImage)?'<img src="'+(data.avatar_url||data.profileImage)+'" style="width:100%;height:100%;object-fit:cover">':'<span style="font-size:28px">'+ign.charAt(0).toUpperCase()+'</span>';
  h+='<div style="'+avStyle+'">'+avContent+'</div>';
  /* Name + FF UID */
  h+='<div style="flex:1;min-width:0">';
  h+='<div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ign+'</div>';
  h+='<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:3px">FF UID: <span style="color:rgba(255,255,255,.8)">'+ffUid+'</span></div>';
  h+='<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:2px">📍 '+city+'</div>';
  if(streakBadge) h+='<div style="margin-top:5px;display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;background:rgba(255,165,0,.15);border:1px solid rgba(255,165,0,.3);font-size:11px;font-weight:800;color:#ffa500">'+streakBadge+'</div>';
  h+='</div></div>';
  /* Stats row */
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1px;background:rgba(255,255,255,.05);border-top:1px solid '+ri.color+'22;position:relative">';
  [['⚔️',matches,'Matches'],['🏆',wins,'Wins'],['💀',kills,'Kills'],['📊',wr+'%','Win Rate']].forEach(function(s,i){
    h+='<div style="text-align:center;padding:12px 6px;background:#0a0a1a'+(i%2===1?'':'')+'relative">';
    h+='<div style="font-size:12px;margin-bottom:3px">'+s[0]+'</div>';
    h+='<div style="font-size:17px;font-weight:900;color:'+ri.color+'">'+s[1]+'</div>';
    h+='<div style="font-size:9px;color:rgba(255,255,255,.4);font-weight:700;text-transform:uppercase;letter-spacing:.5px">'+s[2]+'</div>';
    h+='</div>';
  });
  h+='</div>';
  /* RP bar */
  h+='<div style="padding:12px 16px 14px;position:relative">';
  var nextTier=_pcNextTier(rp);
  var pct=Math.min(100,nextTier.pct);
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">';
  h+='<span style="font-size:10px;color:rgba(255,255,255,.5);font-weight:700">'+rp+' RP</span>';
  h+='<span style="font-size:10px;color:'+ri.color+';font-weight:700">'+nextTier.label+'</span>';
  h+='</div>';
  h+='<div style="height:4px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">';
  h+='<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,'+ri.color+',#00d4ff);border-radius:4px;transition:width .6s ease"></div>';
  h+='</div></div>';
  h+='</div>'; /* /playerCardVisual */
  /* Share buttons */
  h+='<button onclick="window.sharePlayerCard()" style="width:100%;padding:13px;border-radius:13px;border:none;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px"><i class="fab fa-whatsapp"></i> WhatsApp pe Share Karo</button>';
  h+='<button onclick="window.sharePlayerCardGeneric()" style="width:100%;padding:12px;border-radius:13px;border:1px solid var(--border);background:transparent;color:var(--txt);font-size:13px;font-weight:700;cursor:pointer"><i class="fas fa-share-alt"></i> Kisi bhi app se share karo</button>';
  h+='<p style="text-align:center;font-size:11px;color:var(--txt2);margin-top:8px">💡 Screenshot leke bhi share kar sakte ho!</p>';
  h+='</div>';
  mb.innerHTML=h;
}

window.sharePlayerCard = function(){
  if(!window.UD) return;
  var ign=window.UD.ign||window.UD.displayName||'Player';
  var rp=window.UD.rank_points||0;
  var ri=_pcRankInfo(rp);
  var wins=window.UD.total_wins||0;
  var kills=window.UD.total_kills||0;
  var msg='🎮 '+ign+' | Mini eSports\n'+ri.emoji+' '+ri.badge+' ('+rp+' RP)\n🏆 '+wins+' Wins | 💀 '+kills+' Kills\n👉 Mini eSports pe aao aur mujhse takrao!\n#MinieSports #FreeFire';
  var url='https://wa.me/?text='+encodeURIComponent(msg);
  window.open(url,'_blank');
  toast('🎉 Share kiya!','ok');
};

window.sharePlayerCardGeneric=function(){
  if(!window.UD) return;
  var ign=window.UD.ign||window.UD.displayName||'Player';
  var rp=window.UD.rank_points||0;
  var ri=_pcRankInfo(rp);
  var msg='🎮 '+ign+' | Mini eSports | '+ri.emoji+' '+ri.badge+' ('+rp+' RP) | 🏆 '+(window.UD.total_wins||0)+' Wins | 💀 '+(window.UD.total_kills||0)+' Kills';
  if(navigator.share){
    navigator.share({title:'My Mini eSports Card',text:msg}).catch(function(err){
      if(err&&err.name!=='AbortError'){ _fallbackCopy(msg); }
    });
  } else { _fallbackCopy(msg); }
}
function _fallbackCopy(txt){
  if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(function(){ if(window.toast)toast('Copy ho gaya! 📋','ok'); }).catch(function(){ _execCopy(txt); }); }
  else { _execCopy(txt); }
}
function _execCopy(txt){
  try{ var t=document.createElement('textarea'); t.value=txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); if(window.toast)toast('Copy ho gaya! 📋','ok'); }
  catch(e){ if(window.toast)toast('Share ya copy nahi hua','err'); }

};

/* ── Auto-show after result ── */
window.showAutoResultCard = function(matchName, rankPos, kills, matchId){
  if(!window.UD||!window.U) return;
  var ign = window.UD.ign||window.UD.displayName||'Player';
  var rp  = window.UD.rank_points||0;
  var ri  = _pcRankInfo(rp);
  var rankEmoji = rankPos===1?'🥇':rankPos===2?'🥈':rankPos===3?'🥉':'#'+rankPos;
  var isWin = rankPos<=3;
  /* Update streak */
  if(window.updateWinStreak) updateWinStreak(isWin);
  /* Log activity */
  if(window.logActivity) logActivity(isWin?'win':'kill','Match '+matchName+': Rank '+rankPos+', '+kills+' kills');
  var h='<div>';
  /* Result card visual */
  h+='<div style="background:linear-gradient(135deg,#0a0a1a,#12122a,#0f1f2e);border-radius:20px;padding:20px;margin-bottom:14px;position:relative;overflow:hidden;border:2px solid '+(isWin?ri.color:'rgba(255,255,255,.1)')+'">';
  h+='<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,'+(isWin?ri.color:'rgba(255,255,255,.2)')+',transparent)"></div>';
  h+='<div style="text-align:center">';
  h+='<div style="font-size:60px;margin-bottom:6px;filter:drop-shadow(0 0 20px '+(isWin?ri.color+'88':'rgba(255,255,255,.2)')+')">'+rankEmoji+'</div>';
  h+='<div style="font-size:22px;font-weight:900;color:#fff">'+ign+'</div>';
  h+='<div style="font-size:12px;color:rgba(255,255,255,.5);margin:4px 0 14px">'+matchName+'</div>';
  h+='<div style="display:flex;justify-content:center;gap:24px;margin-bottom:12px">';
  h+='<div style="text-align:center"><div style="font-size:24px;font-weight:900;color:'+(isWin?ri.color:'#fff')+'">#'+rankPos+'</div><div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px">Rank</div></div>';
  h+='<div style="width:1px;background:rgba(255,255,255,.08)"></div>';
  h+='<div style="text-align:center"><div style="font-size:24px;font-weight:900;color:#ff6b6b">'+kills+'</div><div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px">Kills</div></div>';
  h+='<div style="width:1px;background:rgba(255,255,255,.08)"></div>';
  h+='<div style="text-align:center"><div style="font-size:14px;font-weight:900;color:'+ri.color+'">'+ri.emoji+' '+ri.badge+'</div><div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px">Rank Tier</div></div>';
  h+='</div>';
  h+='<div style="font-size:10px;color:rgba(0,255,156,.5);font-weight:700;letter-spacing:2px">MINI ESPORTS</div>';
  h+='</div></div>';
  /* Share buttons */
  var shareMsg = rankEmoji+' '+ign+' ne "'+matchName+'" mein #'+rankPos+' rank liya!\n💀 '+kills+' kills | '+ri.emoji+' '+ri.badge+'\n🎮 Mini eSports pe aao!\n#MinieSports #FreeFire';
  h+='<button onclick="window.open(\'https://wa.me/?text=\'+encodeURIComponent(\''+shareMsg.replace(/'/g,"\\'")+'\')+\',\'_blank\')" style="width:100%;padding:13px;border-radius:13px;border:none;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px"><i class="fab fa-whatsapp"></i> WhatsApp Share</button>';
  h+='<button onclick="window.showPlayerCard()" style="width:100%;padding:12px;border-radius:13px;border:1px solid var(--border);background:transparent;color:var(--txt);font-size:13px;font-weight:700;cursor:pointer">🃏 Full Player Card Dekho</button>';
  h+='</div>';
  openModal(isWin?'🎉 Result!':'😤 Better Luck',h);
  /* Bug #16 Fix: Removed duplicate coin award — admin-awarded prize is the only source.
     Giving coins here again caused double-crediting on result view. */
};

/* ── Helpers ── */
function _pcRankInfo(pts){
  if(pts>=1501) return {badge:'Diamond',emoji:'💎',color:'#00d4ff',bg:'rgba(0,212,255,.15)'};
  if(pts>=601)  return {badge:'Gold',   emoji:'🥇',color:'#ffd700',bg:'rgba(255,215,0,.14)'};
  if(pts>=301)  return {badge:'Silver', emoji:'🥈',color:'#c0c0c0',bg:'rgba(192,192,192,.12)'};
  return                {badge:'Bronze',emoji:'🏅',color:'#cd7f32',bg:'rgba(205,127,50,.12)'};
}
function _pcNextTier(pts){
  var tiers=[{min:0,max:300,next:'Silver',top:300},{min:301,max:600,next:'Gold',top:600},{min:601,max:1000,next:'Platinum',top:1000},{min:1001,max:1500,next:'Diamond',top:1500},{min:1501,max:9999,next:'Legend',top:2000}];
  for(var i=0;i<tiers.length;i++){
    var t=tiers[i];
    if(pts>=t.min&&pts<=t.max){
      var pct=Math.round((pts-t.min)/(t.top-t.min)*100);
      return {label:pts>=t.top?'MAX':'→ '+t.next+' ('+t.top+')',pct:pct};
    }
  }
  return {label:'Legend',pct:100};
}

/* ── Inject pill ── */
var _pci=0,_pct=setInterval(function(){
  _pci++; if(_pci>60){ clearInterval(_pct); return; }
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_pcPill')) return;
  clearInterval(_pct);
  var pill=document.createElement('div');
  pill.id='_pcPill'; pill.className='special-pill';
  pill.style.cssText='background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.25);color:#ffd700';
  pill.innerHTML='<i class="fas fa-id-card" style="font-size:11px"></i> My Card';
  pill.onclick=function(){ if(window.showPlayerCard) showPlayerCard(); };
  row.appendChild(pill);
},400);

})();
