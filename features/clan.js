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
var GDI=function(s){return '<img src="js/green-diamond.png?v=20261008c" style="width:'+(s||14)+'px;height:'+(s||14)+'px;vertical-align:middle;object-fit:contain">';};

var MAX_MEMBERS=10;

/* ── Firebase paths: clans/{clanId}, users/{uid}/clanId ── */

/* Helper: get user's clan
   ✅ BUG Z6 FIX-2 (2026-10-02): ye function pehle Firebase RTDB-bridge
   (clans/{id}.once('value')) padhta tha — Supabase-only data me ye node
   adhoora/absent hai => kabhi clan.members=undefined (0/10 members),
   leader undefined (Kick/Disband buttons gayab) aur invite-code
   UUID-prefix. Ab Supabase direct: profiles->clans(select * => join_code
   sahit)->clan_members->profiles, Firebase-shape mapping ke saath —
   bilkul waise hi jaise js/fixes-v29-all-bugs.js ka Bug#1 wrapper —
   ab dono definitions same-sahist hain, load-order race se app unaffected. */
window.getUserClan=function(cb){
  if(!window._supa||!window.U||!window.U.uid){ if(window.db){try{ var _cid=(window.UD&&window.UD.clanId)||null; if(!_cid){cb(null);return;} window.db.ref('clans/'+_cid).once('value',function(s){cb(s.exists()?Object.assign({_id:s.key},s.val()):null);}); return;}catch(e){} } cb(null); return; }
  var uid=window.U.uid;
  window._supa.from('user_public_profiles').select('clan_id').eq('id',uid).maybeSingle()
    .then(function(r){
      var clanId=r.data&&r.data.clan_id;
      if(!clanId){cb(null);return;}
      window._supa.from('clans').select('*').eq('id',clanId).maybeSingle()
        .then(function(cr){
          var clan=cr.data;
          if(!clan){cb(null);return;}
          window._supa.from('clan_members').select('user_id,role,joined_at').eq('clan_id',clanId)
            .then(function(mr){
              var members=mr.data||[];
              var ids=members.map(function(m){return m.user_id;});
              var finish=function(usersMap){
                var membersObj={};
                members.forEach(function(m){
                  var u=usersMap[m.user_id]||{};
                  membersObj[m.user_id]={uid:m.user_id,ign:u.ign||'Player',avatar:u.avatar_url||'',role:m.role||'member',rankPoints:u.rank_points||0,joinedAt:m.joined_at};
                });
                clan.members=membersObj;
                clan.totalMembers=Object.keys(membersObj).length;
                clan._id=clan.id;
                clan.leader=clan.leader_uid;
                clan.weeklyScore=clan.weekly_score||0;
                clan.totalWins=clan.total_wins||0;
                clan.totalKills=clan.total_kills||0;
                clan.memberCount=clan.total_members||Object.keys(membersObj).length;
                if(!clan.join_code) clan.join_code=(clan.id||'').replace(/-/g,'').substring(0,8).toUpperCase();
                cb(clan);
              };
              if(!ids.length){finish({});return;}
              window._supa.from('user_public_profiles').select('id,ign,avatar_url,rank_points').in('id',ids)
                .then(function(ur){var um={};(ur.data||[]).forEach(function(u){um[u.id]=u;});finish(um);})
                .catch(function(){finish({});});
            })
            .catch(function(){cb(null);});
        })
        .catch(function(){cb(null);});
    })
    .catch(function(){cb(null);});
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
  h+='<div style="font-size:18px;font-weight:900;color:#00ff64;letter-spacing:2px">'+((clan.join_code||clan._id||'').substring(0,8).toUpperCase())+'</div>'; /* BUG Z6 FIX-2: join_code pehle — uuid-prefix nahi */
  h+='<div style="font-size:11px;color:#666;margin-top:4px">Dost ko yeh code de — wo join kar lega</div>';
  h+='</div>';
  /* Leave / Delete */
  if(isLeader)h+='<button onclick="window.disbandClan(\''+clan._id+'\')" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,85,85,.3);background:rgba(255,85,85,.07);color:#ff6b6b;font-size:13px;font-weight:700;cursor:pointer">🗑️ Clan Disband Karo</button>';
  else h+='<button onclick="window.leaveClan(\''+clan._id+'\')" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,85,85,.3);background:rgba(255,85,85,.07);color:#ff6b6b;font-size:13px;font-weight:700;cursor:pointer">👋 Clan Chhodo</button>';

  if(window.openModal)openModal('🏰 '+( clan.name||'My Clan'),h);
}

/* ✅ AUDIT FIX (critical): this function was being CALLED from the Supabase
   branch above (line ~101) but never actually DEFINED anywhere — every user
   without a clan (i.e. most users) crashed with "renderClanBrowse is not
   defined" the moment they opened Clan from their profile. The Firebase
   fallback branch below already had the exact right rendering logic
   inline; extracted it here so both branches share one correct
   implementation instead of one being silently broken. */
function renderClanBrowse(clans){
  var h='';
  /* Header */
  h+='<div style="display:flex;gap:8px;margin-bottom:14px">';
  h+='<button onclick="window.showCreateClan()" style="flex:1;padding:12px;border-radius:13px;border:none;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:13px;font-weight:900;cursor:pointer">+ Clan Banao</button>';
  h+='<button onclick="window.showJoinClanByCode()" style="flex:1;padding:12px;border-radius:13px;border:1.5px solid rgba(0,212,255,.3);background:rgba(0,212,255,.07);color:#00d4ff;font-size:13px;font-weight:800;cursor:pointer">Code se Join</button>';
  h+='</div>';
  h+='<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:10px">🔥 Top Clans</div>';
  if(!clans.length){h+='<div style="text-align:center;padding:24px;color:#666">Abhi koi clan nahi hai.<br>Pehla clan banao!</div>';}
  clans.forEach(function(clan){
    var mCount=clan.members?Object.keys(clan.members).length:(clan.memberCount||0);
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
}

/* Browse / Search clans */
function _showClanBrowse(){
  if(!window.db){if(window.toast)toast('Connection error.','err');return;}
  if(window._supa){window._supa.from('clans').select('*').order('total_members',{ascending:false}).limit(20).then(function(r){var clans=(r.data||[]).map(function(d){return Object.assign(d,{_id:d.id,weeklyScore:d.total_wins||0,memberCount:d.total_members||0});});clans.sort(function(a,b){return(b.weeklyScore||0)-(a.weeklyScore||0);});renderClanBrowse(clans);}, function(){renderClanBrowse([]);});return;}
  window.db.ref('clans').orderByChild('memberCount').limitToLast(20).once('value',function(s){
    var clans=[];
    if(s.exists())s.forEach(function(c){var d=c.val();d._id=c.key;clans.push(d);});
    clans.sort(function(a,b){return (b.weeklyScore||0)-(a.weeklyScore||0);});
    renderClanBrowse(clans);
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
  /* ✅ BUG FIX (2026-08-22): this used to REDEFINE window._doCreateClan
     right here, every single time the Create Clan modal opened — clobbering
     the correct Supabase-native implementation from bugfix-v30-final.js
     (which writes to the real `clans` table with the right column names:
     total_members, leader_uid, weekly_score, etc). This version instead
     wrote via window.db.ref('clans').push() — a pure Firebase-bridge write
     using field names (memberCount, leader, weeklyScore) that don't match
     the real Postgres schema at all — so the clan the user just "created"
     was never actually persisted where anything else looks for it. The
     live database confirmed this: `clans` table was completely empty
     despite a successful-looking "✅ Clan banaya!" toast.
     Fix: don't redefine it here — bugfix-v30-final.js's window._doCreateClan
     (schema-correct, Supabase-only) is the single implementation now. If
     that script hasn't loaded yet for some reason, fail loudly instead of
     silently falling back to a broken write. */
  if (typeof window._doCreateClan !== 'function' || !window._doCreateClan._v30Supa) {
    window._doCreateClan = function () {
      if (window.toast) toast('Clan service load ho raha hai, thoda wait karo aur dobara try karo.', 'err');
    };
  }
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
window.joinClan=async function(clanIdOrCode){
  /* ✅ BUG Z6 FIX-4 (2026-10-02, WALK10s run8 live-catch): Firebase-bridge
     clans/{CODE} padhta tha — CODE uuid nahi hai to PostgREST 400 (id=eq.CODE)
     aur join maun-vifaI. Ab Supabase: DB-truth self-heal (Z8 jaisa — stale
     UD.clanId par DB hi maano) -> code/uuid lookup -> join_clan RPC.
     v30-joinClan jaisa hi vyavhaar — dono paribhasha same-sahist. */
  if(!window._supa||!window.U||!window.U.uid)return;
  try{
    var uid=window.U.uid;
    var myOld=(window.UD&&(window.UD.clanId||window.UD.clan_id))||null;
    if(myOld){
      var both=await Promise.all([
        window._supa.from('clans').select('id').eq('id',myOld).maybeSingle(),
        window._supa.from('user_public_profiles').select('clan_id').eq('id',uid).maybeSingle()
      ]);
      var _real=both[0]&&both[0].data&&both[0].data.id;
      var _dbc=both[1]&&both[1].data&&both[1].data.clan_id;
      if(_real&&_dbc===myOld){ if(window.toast)toast('Pehle apna current clan chhodo!','err'); return; }
      await window._supa.from('users').update({clan_id:null}).eq('id',uid);
      if(window.UD){window.UD.clanId=null;window.UD.clan_id=null;}
    }
    var inp=(clanIdOrCode||'').toString().trim();
    if(!inp){ if(window.toast)toast('Clan ID ya code daalo!','err'); return; }
    var isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(inp);
    var r=await (isUuid
      ? window._supa.from('clans').select('id,name,total_members,emblem,badge').eq('id',inp).maybeSingle()
      : window._supa.from('clans').select('id,name,total_members,emblem,badge').eq('join_code',inp.toUpperCase()).maybeSingle());
    var clan=r&&r.data;
    if(!clan){ if(window.toast)toast('Clan nahi mila! Code dobara check karo.','err'); return; }
    if((clan.total_members||0)>=MAX_MEMBERS){ if(window.toast)toast('Clan full hai! ('+(clan.total_members||0)+'/'+MAX_MEMBERS+')','err'); return; }
    var rpcRes=await window._supa.rpc('join_clan',{p_user_id:uid,p_clan_id:clan.id,p_ign:(window.UD&&window.UD.ign)||'Player',p_max_members:MAX_MEMBERS});
    var res=(rpcRes&&rpcRes.data)||{};
    if(res.ok===false||res.error){
      var msg=res.error==='clan_full'?'Clan full ho gaya!':res.error==='already_in_clan'?'Pehle current clan chhodo!':res.error==='Already in clan'?'Pehle se member ho!':'Join error: '+(res.error||'unknown');
      if(window.toast)toast(msg,'err'); return;
    }
    if(window.UD){window.UD.clanId=clan.id;window.UD.clan_id=clan.id;}
    if(window.toast)toast('✅ "'+(clan.name||'Clan')+'" join kar liya!','ok');
    if(window.closeModal)closeModal();
    setTimeout(function(){window.showClanHome();},400);
  }catch(e){ if(window.toast)toast('Join error: '+((e&&e.message)||e),'err'); }
};

/* Leave clan */
window.leaveClan=async function(clanId){
  if(!window.U)return;
  /* Bug 74 Fix: Confirmation before leaving — prevents accidental data loss */
  var confirmed = window.confirm('Kya aap sach mein clan chhodni chahte ho? Yeh action undo nahi ho sakta.');
  if(!confirmed) return;
  /* ✅ BUG Z6 FIX-4: Supabase RPC-first (leave_clan) — response ke baad hi
     toast; bridge sirf RPC-na-mile par. */
  var uid=window.U.uid;
  if(window._supa){
    try{
      await window._supa.rpc('leave_clan',{p_user_id:uid,p_clan_id:clanId});
      if(window.UD){delete window.UD.clanId; window.UD.clan_id=null;}
      if(window.toast)toast('Clan chhod diya!','ok');
      if(window.closeModal)closeModal();
      return;
    }catch(e){ if(window.toast)toast('Leave error: '+((e&&e.message)||e),'err'); return; }
  }
  if(!window.db)return;
  window.db.ref('clans/'+clanId+'/members/'+uid).remove();
  window.db.ref('clans/'+clanId+'/memberCount').transaction(function(v){return Math.max(0,(Number(v)||0)-1);});
  window.db.ref('users/'+uid+'/clanId').remove();
  if(window.UD)delete window.UD.clanId;
  if(window.toast)toast('Clan chhod diya!','ok');
  if(window.closeModal)closeModal();
};

/* Disband clan */
window.disbandClan=function(clanId){
  if(!window.U)return;
  /* Bug 74 Fix: Double confirmation for disband — this removes all members */
  var confirmed = window.confirm('DISBAND CLAN? Yeh clan aur sare members remove ho jayenge. Yeh permanent action hai!');
  if(!confirmed) return;
  /* ✅ BUG Z6 FIX-3 (2026-10-02): Firebase-bridge remove ki jagah Supabase
     RPC-first (disband_clan, leader-verified, atomic: users.clan_id clear +
     members + war-challenges + clan) — response ke baad hi toast; RPC na
     mile to legacy chain. */
  if(window._supa){
    window._supa.rpc('disband_clan',{p_clan_id:clanId})
      .then(function(d){
        var r=d&&d.data;
        if(r&&r.ok===false){ if(window.toast)toast('Disband error: '+(r.error||'unknown'),'err'); return; }
        if(window.UD)delete window.UD.clanId;
        if(window.toast)toast('Clan disband kar diya!','ok');
        if(window.closeModal)closeModal();
      },function(e){ if(window.toast)toast('Disband error: '+((e&&e.message)||e),'err'); });
    return;
  }
  if(!window.db)return;
  window.db.ref('clans/'+clanId).remove();
  window.db.ref('users/'+window.U.uid+'/clanId').remove();
  if(window.UD)delete window.UD.clanId;
  if(window.toast)toast('Clan disband kar diya!','ok');
  if(window.closeModal)closeModal();
};

/* Kick member */
window.kickClanMember=function(clanId,memberUid){
  /* ✅ BUG Z6 FIX-3 (2026-10-02): pehle Firebase-bridge remove + VERIFY-KE-BINA
     success-toast — Supabase-only data me member-row DB me bachi re jaati thi
     (WALK10s run5 live-catch: toast 'Member kick kar diya!' par members=2).
     Ab Supabase RPC-first (kick_clan_member, leader-verified server-side),
     response ke baad hi toast+refresh; RPC na mile to legacy chain. */
  if(!window._supa||!window.U)return;
  window._supa.rpc('kick_clan_member',{p_clan_id:clanId,p_member_uid:memberUid})
    .then(function(d){
      var r=d&&d.data;
      if(r&&r.ok===false){ if(window.toast)toast('Kick error: '+(r.error||'unknown'),'err'); return; }
      if(window.toast)toast('Member kick kar diya!','ok');
      if(window.closeModal)closeModal();
      setTimeout(function(){window.showClanHome();},300);
    },function(e){ if(window.toast)toast('Kick error: '+((e&&e.message)||e),'err'); });
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

/* Update clan score on match result — R8 (2026-09-26c): Firebase economy
   writes REMOVED. Supabase authoritative; increment_clan_score RPC server-
   side hi caller membership verify karta hai (no client-computed economy
   write). This shallow variant is kept signature-compatible but delegates
   to the RPC (bugfix-v30-final.js loads a fuller version after us anyway). */
window.updateClanScore=function(uid,kills,wins){
  if(!window.UD)return;
  var clanId=(window.UD&&window.UD.clanId)||(window.UD&&window.UD.clan_id)||null;
  if(!clanId)return;
  if(!window._supa)return;
  var score=(kills||0)*1+(wins||0)*5;
  window._supa.rpc('increment_clan_score',{
    p_clan_id:clanId,
    p_score:score,
    p_wins:wins?1:0,
    p_kills:kills||0
  }).then(null, function(){ /* R8: no client write fallback — silent drop on RPC failure (BUG Z5 FIX: thenable-safe — .catch is build me nahi hota) */ });
};

console.log('[Mini eSports] Clan System v1.0 ✅');
})();
