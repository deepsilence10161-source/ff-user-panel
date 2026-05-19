/* ================================================================
   MINI eSPORTS — CLAN / GUILD SYSTEM v1.0
   · Create clan (Premium users) — max 10 members
   · Join any clan (free)
   · Weekly leaderboard: kills×1 + wins×5 + matches×2
   · Top 3 clans get Green Diamond rewards + Badges
   · Clan chat (separate from match chat)
================================================================ */
(function(){
'use strict';
var GDI=function(s){return '<img src="js/green-diamond.png" style="width:'+(s||14)+'px;height:'+(s||14)+'px;vertical-align:middle;object-fit:contain">';};

var MAX_MEMBERS=10;

/* ── Firebase paths: clans/{clanId}, users/{uid}/clanId ── */

/* Helper: get user's clan */
window.getUserClan=function(cb){
  if(!window.U||!window.db){cb(null);return;}
  var clanId=(window.UD&&window.UD.clanId)||null;
  if(!clanId){cb(null);return;}
  window.db.ref('clans/'+clanId).once('value',function(s){cb(s.exists()?Object.assign({_id:s.key},s.val()):null);});
};

/* ── Show Clan Home ── */
window.showClanHome=function(){
  if(!window.U||!window.UD){if(window.toast)toast('Pehle login karo!','err');return;}
  window.getUserClan(function(clan){
    if(clan) _showMyClan(clan);
    else _showClanBrowse();
  });
};

/* My Clan view */
function _showMyClan(clan){
  var isLeader=clan.leader===window.U.uid;
  var members=clan.members?Object.keys(clan.members):[],mCount=members.length;
  var h='';
  /* Clan banner */
  h+='<div style="text-align:center;padding:14px 0;background:linear-gradient(135deg,rgba(255,215,0,.08),rgba(185,100,255,.08));border-radius:14px;margin-bottom:14px;position:relative">';
  h+='<div style="font-size:36px;margin-bottom:4px">'+(clan.emblem||'🏰')+'</div>';
  h+='<div style="font-size:20px;font-weight:900;color:#ffd700">'+(clan.name||'My Clan')+'</div>';
  h+='<div style="font-size:12px;color:#888;margin-top:3px">'+mCount+'/'+MAX_MEMBERS+' members</div>';
  if(clan.tag)h+='<div style="margin-top:6px;display:inline-block;padding:3px 12px;border-radius:8px;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.25);font-size:11px;font-weight:700;color:#ffd700">['+clan.tag+']</div>';
  h+='</div>';
  /* Stats */
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">';
  [{l:'Score',v:clan.weeklyScore||0,c:'#ffd700'},{l:'Wins',v:clan.totalWins||0,c:'#00ff9c'},{l:'Kills',v:clan.totalKills||0,c:'#ff6b6b'}].forEach(function(s){
    h+='<div style="text-align:center;padding:10px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)"><div style="font-size:18px;font-weight:900;color:'+s.c+'">'+s.v+'</div><div style="font-size:10px;color:#666;margin-top:2px">'+s.l+'</div></div>';
  });
  h+='</div>';
  /* Weekly rank */
  if(clan.weeklyRank&&clan.weeklyRank<=10){
    h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.15);margin-bottom:14px">';
    h+='<div style="font-size:22px">'+(clan.weeklyRank===1?'🥇':clan.weeklyRank===2?'🥈':clan.weeklyRank===3?'🥉':'#'+clan.weeklyRank)+'</div>';
    h+='<div><div style="font-size:13px;font-weight:800;color:#ffd700">Weekly Rank #'+clan.weeklyRank+'</div><div style="font-size:11px;color:#888">Is hafte ka standing</div></div>';
    if(clan.weeklyRank<=3){
      var rew=clan.weeklyRank===1?500:clan.weeklyRank===2?300:200;
      h+='<div style="margin-left:auto;text-align:right;font-size:12px;color:#00ff64;font-weight:700">'+GDI(13)+' '+rew+' prize</div>';
    }
    h+='</div>';
  }
  /* Clan Chat button */
  h+='<div style="display:flex;gap:8px;margin-bottom:14px">';
  h+='<button onclick="window.showClanChat(\''+clan._id+'\')" style="flex:1;padding:12px;border-radius:13px;border:1.5px solid rgba(0,212,255,.3);background:rgba(0,212,255,.07);color:#00d4ff;font-size:13px;font-weight:800;cursor:pointer">💬 Clan Chat</button>';
  h+='<button onclick="window.showClanLeaderboardFull()" style="flex:1;padding:12px;border-radius:13px;border:1.5px solid rgba(255,215,0,.3);background:rgba(255,215,0,.07);color:#ffd700;font-size:13px;font-weight:800;cursor:pointer">🏆 Leaderboard</button>';
  h+='</div>';
  /* Members */
  h+='<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:10px">Members ('+mCount+'/'+MAX_MEMBERS+')</div>';
  h+='<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">';
  if(clan.members){
    Object.entries(clan.members).forEach(function(entry){
      var mUid=entry[0],mData=entry[1];
      var isMe=mUid===window.U.uid,isMLeader=mUid===clan.leader;
      h+='<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:11px;background:rgba(255,255,255,'+(isMe?'.07':'.04')+');border:1px solid rgba(255,255,255,'+(isMe?'.12':'.07')+')">';
      h+='<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">'+((mData.ign||'?').charAt(0).toUpperCase())+'</div>';
      h+='<div style="flex:1"><div style="font-size:13px;font-weight:700;color:#fff">'+(mData.ign||'Unknown')+(isMe?' (You)':'')+'</div>';
      h+='<div style="font-size:10px;color:#888">'+(isMLeader?'👑 Leader':'Member')+'</div></div>';
      h+='<div style="text-align:right;font-size:11px;color:#888">'+GDI(11)+' '+(mData.gd||0)+'</div>';
      if(isLeader&&!isMe)h+='<button onclick="window.kickClanMember(\''+clan._id+'\',\''+mUid+'\')" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,85,85,.3);background:rgba(255,85,85,.08);color:#ff6b6b;font-size:10px;cursor:pointer">Kick</button>';
      h+='</div>';
    });
  }
  h+='</div>';
  /* Invite code */
  h+='<div style="background:rgba(0,255,100,.05);border:1px solid rgba(0,255,100,.15);border-radius:12px;padding:12px;margin-bottom:14px;text-align:center">';
  h+='<div style="font-size:11px;color:#888;margin-bottom:6px">Clan Invite Code</div>';
  h+='<div style="font-size:18px;font-weight:900;color:#00ff64;letter-spacing:2px">'+(clan._id||'').substring(0,8).toUpperCase()+'</div>';
  h+='<div style="font-size:11px;color:#666;margin-top:4px">Dost ko yeh code de — wo join kar lega</div>';
  h+='</div>';
  /* Leave / Delete */
  if(isLeader)h+='<button onclick="window.disbandClan(\''+clan._id+'\')" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,85,85,.3);background:rgba(255,85,85,.07);color:#ff6b6b;font-size:13px;font-weight:700;cursor:pointer">🗑️ Clan Disband Karo</button>';
  else h+='<button onclick="window.leaveClan(\''+clan._id+'\')" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,85,85,.3);background:rgba(255,85,85,.07);color:#ff6b6b;font-size:13px;font-weight:700;cursor:pointer">👋 Clan Chhodo</button>';

  if(window.openModal)openModal('🏰 '+( clan.name||'My Clan'),h);
}

/* Browse / Search clans */
function _showClanBrowse(){
  if(!window.db){if(window.toast)toast('Connection error.','err');return;}
  if(window._supa){window._supa.from('clans').select('*').order('total_members',{ascending:false}).limit(20).then(function(r){var clans=(r.data||[]).map(function(d){return Object.assign(d,{_id:d.id,weeklyScore:d.total_wins||0,memberCount:d.total_members||0});});clans.sort(function(a,b){return(b.weeklyScore||0)-(a.weeklyScore||0);});renderClanBrowse(clans);}).catch(function(){renderClanBrowse([]);});return;}
  window.db.ref('clans').orderByChild('memberCount').limitToLast(20).once('value',function(s){
    var clans=[];
    if(s.exists())s.forEach(function(c){var d=c.val();d._id=c.key;clans.push(d);});
    clans.sort(function(a,b){return (b.weeklyScore||0)-(a.weeklyScore||0);});

    var h='';
    /* Header */
    h+='<div style="display:flex;gap:8px;margin-bottom:14px">';
    h+='<button onclick="window.showCreateClan()" style="flex:1;padding:12px;border-radius:13px;border:none;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:13px;font-weight:900;cursor:pointer">+ Clan Banao</button>';
    h+='<button onclick="window.showJoinClanByCode()" style="flex:1;padding:12px;border-radius:13px;border:1.5px solid rgba(0,212,255,.3);background:rgba(0,212,255,.07);color:#00d4ff;font-size:13px;font-weight:800;cursor:pointer">Code se Join</button>';
    h+='</div>';
    h+='<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:10px">🔥 Top Clans</div>';
    if(!clans.length){h+='<div style="text-align:center;padding:24px;color:#666">Abhi koi clan nahi hai.<br>Pehla clan banao!</div>';}
    clans.forEach(function(clan,idx){
      var mCount=clan.members?Object.keys(clan.members).length:0;
      var isFull=mCount>=MAX_MEMBERS;
      h+='<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:8px">';
      h+='<div style="font-size:24px">'+(clan.emblem||'🏰')+'</div>';
      h+='<div style="flex:1"><div style="font-size:14px;font-weight:800;color:#fff">'+(clan.name||'Clan')+'</div>';
      h+='<div style="font-size:10px;color:#888">'+mCount+'/'+MAX_MEMBERS+' members • Score: '+(clan.weeklyScore||0)+'</div></div>';
      if(!isFull)h+='<button onclick="window.joinClan(\''+clan._id+'\')" style="padding:8px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,rgba(0,255,100,.2),rgba(0,212,255,.15));color:#00ff9c;font-size:11px;font-weight:800;cursor:pointer">Join</button>';
      else h+='<div style="font-size:10px;color:#666;padding:6px">Full</div>';
      h+='</div>';
    });
    if(window.openModal)openModal('🏰 Clans',h);
  });
}

/* Create clan */
window.showCreateClan=function(){
  var tier=window.getUserPremiumTier?window.getUserPremiumTier():0;
  if(!tier){
    if(window.toast)toast('Clan banana ke liye Premium chahiye!','err');
    setTimeout(function(){if(window.showPremiumUpgrade)window.showPremiumUpgrade();},400);
    return;
  }
  var emblems=['🏰','⚔️','🛡️','🔥','💀','👑','🦁','🐉','🌙','⚡','🎯','🌟'];
  var h='<div style="font-size:13px;font-weight:700;color:#aaa;margin-bottom:12px">Clan Name *</div>';
  h+='<input id="_cName" type="text" maxlength="20" placeholder="Clan ka naam daalo" style="width:100%;padding:12px;border-radius:12px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;font-size:14px;box-sizing:border-box;margin-bottom:14px">';
  h+='<div style="font-size:13px;font-weight:700;color:#aaa;margin-bottom:12px">Tag (2-4 chars) *</div>';
  h+='<input id="_cTag" type="text" maxlength="4" placeholder="e.g. PRO" style="width:100%;padding:12px;border-radius:12px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;font-size:14px;box-sizing:border-box;margin-bottom:14px;text-transform:uppercase">';
  h+='<div style="font-size:13px;font-weight:700;color:#aaa;margin-bottom:10px">Emblem *</div>';
  h+='<div id="_cEmblems" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">';
  var selEmb=emblems[0];
  emblems.forEach(function(e){h+='<div onclick="window._selEmb(\''+e+'\')" id="_emb_'+e+'" style="width:42px;height:42px;border-radius:10px;border:1.5px solid '+(e===selEmb?'rgba(255,215,0,.6)':'rgba(255,255,255,.1)')+';background:'+(e===selEmb?'rgba(255,215,0,.15)':'rgba(255,255,255,.05)')+';display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer">'+e+'</div>';});
  h+='</div>';
  h+='<button onclick="window._doCreateClan()" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:14px;font-weight:900;cursor:pointer">🏰 Clan Banao!</button>';
  window._selEmb=function(e){selEmb=e;document.querySelectorAll('[id^="_emb_"]').forEach(function(el){var isS=el.id==='_emb_'+e;el.style.borderColor=isS?'rgba(255,215,0,.6)':'rgba(255,255,255,.1)';el.style.background=isS?'rgba(255,215,0,.15)':'rgba(255,255,255,.05)';});};
  window._doCreateClan=function(){
    var name=(document.getElementById('_cName')||{}).value||'';
    var tag=((document.getElementById('_cTag')||{}).value||'').toUpperCase();
    if(!name.trim()){if(window.toast)toast('Clan ka naam daalo!','err');return;}
    if(!tag.trim()||tag.length<2){if(window.toast)toast('Tag 2-4 characters ka hona chahiye!','err');return;}
    if(!window.U||!window.UD||!window.db)return;
    var uid=window.U.uid;
    var clanRef=window.db.ref('clans').push();
    var clanId=clanRef.key;
    var memberData={};
    memberData[uid]={ign:window.UD.ign||window.UD.displayName||'Player',joinedAt:Date.now(),gd:0};
    clanRef.set({name:name.trim(),tag:tag,emblem:selEmb,leader:uid,memberCount:1,members:memberData,weeklyScore:0,totalWins:0,totalKills:0,weeklyRank:0,createdAt:Date.now()},function(){
      window.db.ref('users/'+uid+'/clanId').set(clanId);
      if(window.UD)window.UD.clanId=clanId;
      if(window.toast)toast('✅ Clan "'+name+'" ban gaya!','ok');
      if(window.closeModal)closeModal();
    });
  };
  if(window.openModal)openModal('🏰 Clan Banao',h);
};

/* Join by code */
window.showJoinClanByCode=function(){
  var h='<div style="font-size:13px;color:#aaa;margin-bottom:12px">Dost ne tumhe clan invite code diya hoga — woh daalo:</div>';
  h+='<input id="_cCode" type="text" maxlength="8" placeholder="8-digit code" style="width:100%;padding:12px;border-radius:12px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;font-size:16px;letter-spacing:2px;text-align:center;box-sizing:border-box;text-transform:uppercase;margin-bottom:16px">';
  h+='<button onclick="window._doJoinByCode()" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,rgba(0,212,255,.2),rgba(0,255,100,.15));color:#00d4ff;font-size:14px;font-weight:900;cursor:pointer;border:1.5px solid rgba(0,212,255,.3)">Join Karo →</button>';
  window._doJoinByCode=function(){var code=((document.getElementById('_cCode')||{}).value||'').toUpperCase().substring(0,8);if(!code||code.length<6){if(window.toast)toast('Valid code daalo!','err');return;}window.joinClan(code);};
  if(window.openModal)openModal('🔑 Code se Join',h);
};

/* Join clan */
window.joinClan=function(clanId){
  if(!window.U||!window.UD||!window.db)return;
  var uid=window.U.uid;
  if(window.UD.clanId){if(window.toast)toast('Pehle apna clan chhodo!','err');return;}
  window.db.ref('clans/'+clanId).once('value',function(s){
    if(!s.exists()){if(window.toast)toast('Clan nahi mila!','err');return;}
    var clan=s.val();
    var mCount=clan.members?Object.keys(clan.members).length:0;
    if(mCount>=MAX_MEMBERS){if(window.toast)toast('Clan full hai!','err');return;}
    var updates={};
    updates['clans/'+clanId+'/members/'+uid]={ign:window.UD.ign||window.UD.displayName||'Player',joinedAt:Date.now(),gd:0};
    updates['clans/'+clanId+'/memberCount']=(mCount+1);
    updates['users/'+uid+'/clanId']=clanId;
    window.db.ref().update(updates,function(){
      if(window.UD)window.UD.clanId=clanId;
      if(window.toast)toast('✅ "'+(clan.name||'Clan')+'" join kar liya!','ok');
      if(window.closeModal)closeModal();
    });
  });
};

/* Leave clan */
window.leaveClan=function(clanId){
  if(!window.U||!window.db)return;
  var uid=window.U.uid;
  window.db.ref('clans/'+clanId+'/members/'+uid).remove();
  window.db.ref('clans/'+clanId+'/memberCount').transaction(function(v){return Math.max(0,(Number(v)||0)-1);});
  window.db.ref('users/'+uid+'/clanId').remove();
  if(window.UD)delete window.UD.clanId;
  if(window.toast)toast('Clan chhod diya!','ok');
  if(window.closeModal)closeModal();
};

/* Disband clan */
window.disbandClan=function(clanId){
  if(!window.U||!window.db)return;
  window.db.ref('clans/'+clanId).remove();
  window.db.ref('users/'+window.U.uid+'/clanId').remove();
  if(window.UD)delete window.UD.clanId;
  if(window.toast)toast('Clan disband kar diya!','ok');
  if(window.closeModal)closeModal();
};

/* Kick member */
window.kickClanMember=function(clanId,memberUid){
  if(!window.db)return;
  window.db.ref('clans/'+clanId+'/members/'+memberUid).remove();
  window.db.ref('clans/'+clanId+'/memberCount').transaction(function(v){return Math.max(0,(Number(v)||0)-1);});
  window.db.ref('users/'+memberUid+'/clanId').remove();
  if(window.toast)toast('Member kick kar diya!','ok');
  if(window.closeModal)closeModal();setTimeout(function(){window.showClanHome();},300);
};

/* Clan Chat */
window.showClanChat=function(clanId){
  if(!window.U||!window.db)return;
  var uid=window.U.uid,chatRef=window.db.ref('clanChats/'+clanId);
  var h='<div id="_clanChatMsgs" style="height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 0;margin-bottom:12px"></div>';
  h+='<div style="display:flex;gap:8px"><input id="_ccInput" type="text" maxlength="100" placeholder="Message likho..." style="flex:1;padding:10px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;font-size:13px"><button onclick="window._sendClanMsg(\''+clanId+'\')" style="padding:10px 16px;border-radius:11px;border:none;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#000;font-weight:900;cursor:pointer;font-size:13px">Send</button></div>';
  if(window.openModal)openModal('💬 Clan Chat',h);
  /* Load messages */
  var _li=chatRef.limitToLast(30).on('value',function(s){
    var el=document.getElementById('_clanChatMsgs');if(!el)return;
    var msgs=[]; if(s.exists())s.forEach(function(c){msgs.push(c.val());});
    el.innerHTML=msgs.map(function(m){
      var isMe=m.uid===uid;
      return '<div style="display:flex;flex-direction:'+(isMe?'row-reverse':'row')+';gap:6px;align-items:flex-end">'
        +'<div style="max-width:75%;padding:8px 12px;border-radius:'+(isMe?'14px 14px 4px 14px':'14px 14px 14px 4px')+';background:'+(isMe?'rgba(0,212,255,.15)':'rgba(255,255,255,.07)')+';border:1px solid '+(isMe?'rgba(0,212,255,.25)':'rgba(255,255,255,.1)')+';">'
        +'<div style="font-size:10px;color:'+(isMe?'#00d4ff':'#888')+';margin-bottom:3px;font-weight:700">'+(isMe?'You':m.ign||'Player')+'</div>'
        +'<div style="font-size:12px;color:#ddd">'+m.msg+'</div>'
        +'</div></div>';
    }).join('');
    el.scrollTop=el.scrollHeight;
  });
  window._sendClanMsg=function(cid){
    var inp=document.getElementById('_ccInput');if(!inp||!inp.value.trim())return;
    chatRef.push({uid:uid,ign:(window.UD&&(window.UD.ign||window.UD.displayName))||'Player',msg:inp.value.trim().substring(0,100),t:Date.now()});
    inp.value='';
  };
};

/* Full Clan Leaderboard */
window.showClanLeaderboardFull=function(){
  if(!window.db)return;
  window.db.ref('clans').orderByChild('weeklyScore').limitToLast(20).once('value',function(s){
    var clans=[];if(s.exists())s.forEach(function(c){var d=c.val();d._id=c.key;clans.push(d);});
    clans.sort(function(a,b){return (b.weeklyScore||0)-(a.weeklyScore||0);});
    var h='<div style="font-size:11px;color:#666;margin-bottom:10px">Weekly rewards: Top 3 clans ko Green Diamonds milte hain (Monday reset)</div>';
    var rewards=[500,300,200,0,0,0,0,0,0,50];
    clans.forEach(function(clan,idx){
      var rank=idx+1;
      var medal=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'#'+rank;
      var mCount=clan.members?Object.keys(clan.members).length:0;
      var rew=rewards[Math.min(9,idx)]||0;
      var myC=(window.UD&&window.UD.clanId)===clan._id;
      h+='<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:13px;background:rgba(255,255,255,'+(myC?'.07':rank<=3?'.06':'.04')+');border:1px solid rgba(255,255,255,'+(myC?'.15':rank<=3?'.1':'.06')+');margin-bottom:8px">';
      h+='<div style="font-size:22px;width:32px;text-align:center">'+medal+'</div>';
      h+='<div style="font-size:24px">'+(clan.emblem||'🏰')+'</div>';
      h+='<div style="flex:1"><div style="font-size:14px;font-weight:800;color:#fff">'+(clan.name||'Clan')+(myC?' (Aapka)':'')+'</div><div style="font-size:10px;color:#888">'+mCount+' members • '+GDI(11)+' '+(clan.weeklyScore||0)+' pts</div></div>';
      if(rew)h+='<div style="text-align:right"><div style="font-size:12px;font-weight:800;color:#00ff64">'+GDI(13)+' '+rew+'</div><div style="font-size:9px;color:#555">weekly</div></div>';
      h+='</div>';
    });
    if(!clans.length)h='<div style="text-align:center;padding:24px;color:#666">Abhi koi clan nahi hai!</div>';
    if(window.openModal)openModal('🏆 Clan Leaderboard',h);
  });
};

/* Update clan score on match result */
window.updateClanScore=function(uid,kills,wins){
  if(!window.db||!uid)return;
  var clanId=(window.UD&&window.UD.clanId)||(window.db&&null);
  if(!clanId)return;
  var score=(kills||0)*1+(wins||0)*5;
  window.db.ref('clans/'+clanId+'/weeklyScore').transaction(function(v){return (Number(v)||0)+score;});
  if(kills)window.db.ref('clans/'+clanId+'/totalKills').transaction(function(v){return (Number(v)||0)+kills;});
  if(wins)window.db.ref('clans/'+clanId+'/totalWins').transaction(function(v){return (Number(v)||0)+wins;});
};

console.log('[Mini eSports] Clan System v1.0 ✅');
})();
