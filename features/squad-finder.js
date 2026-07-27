/* ================================================================
   SQUAD FINDER v2.0 — 100% Supabase
   Table: squad_finder (uid, ign, rank_pts, rank_tier, mode, role, lang, note, active, expires_at)
================================================================ */
(function(){ 'use strict';

function _supa(){ return window._supa; }
function _uid(){ return window.U && window.U.uid; }
function _ud(){ return window.UD || {}; }
function _toast(m,t){ if(window.toast) toast(m,t); }
/* BUG #27 FIX (2026-07): same fix as mentor.js/friends.js — derives from the canonical
   rank system instead of its own separate simplified 4-tier logic. */
function _tier(p){ var t=(window.getRankTier?window.getRankTier(p):null); return t?t.name:'Bronze'; }
function _rankInfo(p){ var t=(window.getRankTier?window.getRankTier(p):{emoji:'🏅',color:'#cd7f32',bg:'rgba(205,127,50,.12)'}); return {e:t.emoji,c:t.color,bg:t.bg}; }
function _ago(ts){ var d=Date.now()-new Date(ts).getTime(),m=Math.floor(d/60000); if(m<1)return'Just now'; if(m<60)return m+'m ago'; return Math.floor(m/60)+'h ago'; }

window.showSquadFinder=function(){
  if(!_uid()||!_ud().ign){ _toast('Pehle login karo!','err'); return; }
  var h='<div style="display:flex;gap:8px;margin-bottom:12px">';
  h+='<button id="sfTabBrowse" onclick="sfTab(0)" style="flex:1;padding:10px;border-radius:12px;border:none;background:var(--green);color:#000;font-size:13px;font-weight:800;cursor:pointer">🔍 Players Dhundho</button>';
  h+='<button id="sfTabPost" onclick="sfTab(1)" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid var(--border);background:transparent;color:var(--txt);font-size:13px;font-weight:700;cursor:pointer">📢 LFS Post Karo</button>';
  h+='</div><div id="sfContent"></div>';
  openModal('🎮 Squad Finder',h);
  sfTab(0);
};

window.sfTab=function(idx){
  ['sfTabBrowse','sfTabPost'].forEach(function(id,i){
    var b=document.getElementById(id); if(!b)return;
    b.style.background=i===idx?'var(--green)':'transparent';
    b.style.color=i===idx?'#000':'var(--txt)';
    b.style.border=i===idx?'none':'1.5px solid var(--border)';
  });
  var c=document.getElementById('sfContent'); if(!c)return;
  idx===0?_sfBrowse(c):_sfPostForm(c);
};

var _sfMode='all',_sfRank='all';
function _sfBrowse(c){
  var h='<div style="margin-bottom:10px">';
  h+='<div style="font-size:11px;color:var(--txt2);font-weight:700;margin-bottom:6px">Mode</div><div style="display:flex;gap:6px;flex-wrap:wrap">';
  ['all','Solo','Duo','Squad'].forEach(function(m){ var a=_sfMode===m; h+='<button onclick="_sfMode=\''+m+'\';_sfRefreshBrowse()" style="padding:5px 12px;border-radius:20px;border:none;font-size:11px;font-weight:700;cursor:pointer;background:'+(a?'var(--green)':'rgba(255,255,255,.08)')+';color:'+(a?'#000':'var(--txt)')+'">'+( m==='all'?'All':m)+'</button>'; });
  h+='</div><div style="font-size:11px;color:var(--txt2);font-weight:700;margin:8px 0 6px">Rank</div><div style="display:flex;gap:6px;flex-wrap:wrap">';
  [{v:'all',l:'All'},{v:'Bronze',l:'🏅 Bronze'},{v:'Silver',l:'🥈 Silver'},{v:'Gold',l:'🥇 Gold'},{v:'Diamond',l:'💎 Diamond'}].forEach(function(r){ var a=_sfRank===r.v; h+='<button onclick="_sfRank=\''+r.v+'\';_sfRefreshBrowse()" style="padding:5px 11px;border-radius:20px;border:none;font-size:11px;font-weight:700;cursor:pointer;background:'+(a?'var(--primary)':'rgba(255,255,255,.08)')+';color:'+(a?'#000':'var(--txt)')+'">'+r.l+'</button>'; });
  h+='</div></div><div id="sfPlayerList"><div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div></div>';
  c.innerHTML=h; _sfRefreshBrowse();
}

window._sfRefreshBrowse=function(){
  var pl=document.getElementById('sfPlayerList'); if(!pl)return;
  if(!_supa()){ pl.innerHTML='<div style="text-align:center;padding:20px;color:#ff6b6b">Service unavailable</div>'; return; }
  pl.innerHTML='<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
  var q=_supa().from('squad_finder').select('*').eq('is_active',true).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(50);
  if(_sfMode!=='all') q=q.eq('mode',_sfMode);
  if(_sfRank!=='all') q=q.eq('rank_tier',_sfRank);
  q.then(function(r){
    var list=(r.data||[]).filter(function(d){ return d.uid!==_uid(); });
    if(!list.length){ pl.innerHTML='<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:30px;opacity:.3">🎮</div><p style="font-size:13px">Koi player nahi mila<br><small>Filters change karo ya khud post karo</small></p></div>'; return; }
    var h='<div style="display:flex;flex-direction:column;gap:8px">';
    list.forEach(function(d){
      var ri=_rankInfo(d.rank_pts||0);
      h+='<div style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:13px;background:var(--card);border:1px solid var(--border)">';
      h+='<div style="width:44px;height:44px;border-radius:50%;background:'+ri.bg+';border:2px solid '+ri.c+';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">'+ri.e+'</div>';
      h+='<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:800">'+(d.ign||'Player')+'</div>';
      h+='<div style="font-size:11px;color:var(--txt2)">'+(d.rank_tier||'Bronze')+' · '+(d.mode||'Any')+(d.role?' · '+d.role:'')+'</div>';
      if(d.note)h+='<div style="font-size:11px;color:var(--txt2);font-style:italic">"'+d.note.substring(0,50)+'"</div>';
      h+='<div style="font-size:10px;color:var(--txt2)">'+_ago(d.created_at)+'</div></div>';
      h+='<button onclick="window.sfSendRequest(\''+d.user_id+'\',\''+(d.ign||'Player').replace(/'/g,"\\'")+'\',this)" style="padding:8px 12px;border-radius:10px;border:1.5px solid rgba(0,255,156,.4);background:rgba(0,255,156,.08);color:var(--green);font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0">Invite</button>';
      h+='</div>';
    });
    h+='</div>'; pl.innerHTML=h;
  }).catch(function(){ pl.innerHTML='<div style="text-align:center;padding:20px;color:#ff6b6b">Error loading players</div>'; });
};

function _sfPostForm(c){
  var ud=_ud(),rp=ud.rank_points||0,ri=_rankInfo(rp);
  var MODES=['Solo','Duo','Squad'],ROLES=['Fragger','Support','IGL','Entry','Sniper'],LANGS=['Hindi','English','Hinglish','Tamil','Telugu'];
  var h='<div>';
  h+='<div style="margin-bottom:12px"><div style="font-size:12px;color:var(--txt2);font-weight:700;margin-bottom:7px">Game Mode</div><div style="display:flex;gap:8px">';
  MODES.forEach(function(m){ h+='<button onclick="_sfSelMode(this,\''+m+'\')" class="_sfModeBtn" style="flex:1;padding:9px;border-radius:11px;border:1.5px solid var(--border);background:transparent;color:var(--txt);font-size:12px;font-weight:700;cursor:pointer">'+m+'</button>'; });
  h+='</div></div>';
  h+='<div style="margin-bottom:12px"><div style="font-size:12px;color:var(--txt2);font-weight:700;margin-bottom:7px">Role</div><div style="display:flex;gap:6px;flex-wrap:wrap">';
  ROLES.forEach(function(r){ h+='<button onclick="_sfSelRole(this,\''+r+'\')" class="_sfRoleBtn" style="padding:6px 12px;border-radius:20px;border:1.5px solid var(--border);background:transparent;color:var(--txt);font-size:11px;font-weight:700;cursor:pointer">'+r+'</button>'; });
  h+='</div></div>';
  h+='<div style="margin-bottom:12px"><div style="font-size:12px;color:var(--txt2);font-weight:700;margin-bottom:7px">Language</div><div style="display:flex;gap:6px;flex-wrap:wrap">';
  LANGS.forEach(function(l){ h+='<button onclick="_sfSelLang(this,\''+l+'\')" class="_sfLangBtn" style="padding:6px 12px;border-radius:20px;border:1.5px solid var(--border);background:transparent;color:var(--txt);font-size:11px;font-weight:700;cursor:pointer">'+l+'</button>'; });
  h+='</div></div>';
  h+='<div style="margin-bottom:14px"><div style="font-size:12px;color:var(--txt2);font-weight:700;margin-bottom:7px">Short Note (optional)</div><input id="sfNoteInput" type="text" maxlength="60" placeholder="e.g. No mic, serious only..." style="width:100%;padding:11px 14px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;box-sizing:border-box"></div>';
  h+='<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;background:'+ri.bg+';border:1px solid '+ri.c+'44;margin-bottom:14px"><span style="font-size:18px">'+ri.e+'</span><span style="font-size:13px;font-weight:800;color:'+ri.c+'">'+(ri.e.includes('💎')?'Diamond':ri.e.includes('🥇')?'Gold':ri.e.includes('🥈')?'Silver':'Bronze')+'</span><span style="margin-left:auto;font-size:10px;color:var(--txt2)">Auto-added</span></div>';
  h+='<button onclick="window.sfSubmitPost()" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,var(--green),#00d4ff);color:#000;font-size:14px;font-weight:900;cursor:pointer">📢 Post LFS</button>';
  h+='<p style="font-size:11px;color:var(--txt2);text-align:center;margin-top:8px">Post 3 ghante tak live rahega</p></div>';
  c.innerHTML=h;
}

window._sfSelMode=function(btn,val){ document.querySelectorAll('._sfModeBtn').forEach(function(b){b.style.background='transparent';b.style.color='var(--txt)';b.dataset.sel='';});btn.style.background='var(--green)';btn.style.color='#000';btn.dataset.sel=val; };
window._sfSelRole=function(btn,val){ document.querySelectorAll('._sfRoleBtn').forEach(function(b){b.style.background='transparent';b.style.color='var(--txt)';b.style.borderColor='var(--border)';b.dataset.sel='';});btn.style.background='rgba(0,212,255,.15)';btn.style.color='#00d4ff';btn.style.borderColor='#00d4ff';btn.dataset.sel=val; };
window._sfSelLang=function(btn,val){ document.querySelectorAll('._sfLangBtn').forEach(function(b){b.style.background='transparent';b.style.color='var(--txt)';b.style.borderColor='var(--border)';b.dataset.sel='';});btn.style.background='rgba(185,100,255,.15)';btn.style.color='#b964ff';btn.style.borderColor='#b964ff';btn.dataset.sel=val; };

window.sfSubmitPost=function(){
  if(!_supa()||!_uid()||!_ud().ign){ _toast('Login karo','err'); return; }
  var modeSel=document.querySelector('._sfModeBtn[data-sel]:not([data-sel=""])');
  var roleSel=document.querySelector('._sfRoleBtn[data-sel]:not([data-sel=""])');
  var langSel=document.querySelector('._sfLangBtn[data-sel]:not([data-sel=""])');
  var note=(document.getElementById('sfNoteInput')||{}).value||'';
  /* ✅ BUG FIX (2026-07-17): was a direct upsert() sending client-held
     rank_pts/rank_tier — an earlier audit pass had deliberately kept these
     two columns OUT of the client grant ("must be server-derived, never
     self-declared") specifically to stop a player posting a fake/inflated
     rank, but this call site was never updated to respect that, so it
     would have needed the grant reopened (defeating the point) to work at
     all. post_squad_finder_listing reads the caller's real rank straight
     from `users` server-side and ignores whatever rank data (if any) the
     client sends — ign/role/lang/note are still plain client input since
     there's no integrity reason to distrust those. */
  _supa().rpc('post_squad_finder_listing',{
    p_mode:modeSel?modeSel.dataset.sel:'Any',
    p_playstyle:null,
    p_note:note.trim(),
    p_role:roleSel?roleSel.dataset.sel:'',
    p_lang:langSel?langSel.dataset.sel:''
  })
  .then(function(res){
    if(res&&res.error){ _toast('Error: '+res.error.message,'err'); return; }
    if(res&&res.data&&res.data.ok===false){ _toast(res.data.error||'Error','err'); return; }
    _toast('✅ LFS Post ho gayi!','ok'); if(window.closeModal)closeModal();
  })
  .catch(function(e){ _toast('Error: '+(e.message||'Try again'),'err'); });
};

window.sfSendRequest=function(toUid,toIgn,btn){
  if(!_supa()||!_uid()){ _toast('Login karo','err'); return; }
  if(btn){ btn.disabled=true; btn.textContent='Sending...'; }
  var myIgn=_ud().ign||_ud().displayName||'Player';
  _supa().from('notifications').insert({ user_id:toUid,type:'squad_request',title:'🎮 Squad Request!',body:myIgn+' ne tumhe squad mein invite kiya!',ref_id:_uid(),is_read:false })
  .then(function(){ _toast('✅ Request bhej di '+toIgn+' ko!','ok'); if(btn){btn.textContent='✅ Sent';} })
  .catch(function(){ if(btn){btn.disabled=false;btn.textContent='Invite';} _toast('Error','err'); });
};

// Pill injection
var _i=0,_t=setInterval(function(){
  _i++;if(_i>60){clearInterval(_t);return;}
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_sfPill')){if(row)clearInterval(_t);return;}
  clearInterval(_t);
  var p=document.createElement('div');p.id='_sfPill';p.className='special-pill';
  p.style.cssText='background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);color:#00d4ff';
  p.innerHTML='<i class="fas fa-users" style="font-size:12px"></i> Squad Finder';
  p.onclick=function(){if(window.showSquadFinder)showSquadFinder();};
  row.appendChild(p);
},400);
})();
