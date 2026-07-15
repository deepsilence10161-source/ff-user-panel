/* ================================================================
   MENTOR SYSTEM v2.0 — 100% Supabase | Premium2+ only
   Tables: mentor_profiles(uid,ign,rank_pts,rank_tier,speciality,bio,active,total_sessions,total_students,successful_students,gd_earned)
           mentor_requests(id,mentor_id,mentor_ign,student_id,student_ign,student_rank_pts,student_rank_badge,message,status)
================================================================ */
(function(){ 'use strict';
function _s(){ return window._supa; }
function _uid(){ return window.U&&window.U.uid; }
function _ud(){ return window.UD||{}; }
/* BUG #27 FIX (2026-07): was its own separate simplified 4-tier system with wrong
   thresholds (Bronze/Silver/Gold/Diamond only) — now derives from the same canonical
   window.RANK_TIERS/getRankTier used everywhere else, so this screen shows the same
   rank as every other screen for the same player. */
function _ri(p){ var t=(window.getRankTier?window.getRankTier(p):{name:'Bronze',emoji:'🏅',color:'#cd7f32',bg:'rgba(205,127,50,.12)'}); return {b:t.name,e:t.emoji,c:t.color,bg:t.bg}; }
function _tier(p){ if(!window.RANK_TIERS)return 1; var t=window.getRankTier(p); return window.RANK_TIERS.indexOf(t)+1; }

var MIN_PREMIUM=2, MIN_RANK=600;
function _canMentor(ud){ ud=ud||_ud();var lv=Number(ud.premium_level||ud.premiumLevel||(ud.premium&&ud.premium.tier)||0);return lv>=MIN_PREMIUM&&Number(ud.rank_points||0)>=MIN_RANK; }

window.showMentorHub=function(){
  if(!_uid()){if(window.toast)toast('Login karo','err');return;}
  var h='<div style="display:flex;gap:8px;margin-bottom:12px">';
  h+='<button id="mtTab0" onclick="mtTab(0)" style="flex:1;padding:9px;border-radius:11px;border:none;background:var(--primary);color:#000;font-size:12px;font-weight:800;cursor:pointer">🔍 Find Mentor</button>';
  h+='<button id="mtTab1" onclick="mtTab(1)" style="flex:1;padding:9px;border-radius:11px;border:1px solid var(--border);background:transparent;color:var(--txt);font-size:12px;font-weight:700;cursor:pointer">📚 My Sessions</button>';
  if(_canMentor())h+='<button id="mtTab2" onclick="mtTab(2)" style="flex:1;padding:9px;border-radius:11px;border:1px solid rgba(255,215,0,.3);background:rgba(255,215,0,.06);color:#ffd700;font-size:12px;font-weight:700;cursor:pointer">👨‍🏫 Be Mentor</button>';
  h+='</div><div id="mtContent"></div>';
  openModal('📚 Mentor Hub',h); mtTab(0);
};

window.mtTab=function(idx){
  [0,1,2].forEach(function(i){var b=document.getElementById('mtTab'+i);if(!b)return;b.style.background=i===idx?'var(--primary)':'transparent';b.style.color=i===idx?'#000':'var(--txt)';b.style.border=i===idx?'none':'1px solid '+(i===2?'rgba(255,215,0,.3)':'var(--border)');});
  var c=document.getElementById('mtContent');if(!c)return;
  if(idx===0)_mtFind(c); else if(idx===1)_mtMySessions(c); else _mtDashboard(c);
};

function _mtFind(c){
  c.innerHTML='<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
  if(!_s()){c.innerHTML='<p style="color:#ff6b6b;text-align:center">Service unavailable</p>';return;}
  _s().from('mentor_profiles').select('*').eq('is_available',true).order('rank_pts',{ascending:false}).limit(20)
  .then(function(r){
    var list=(r.data||[]).filter(function(m){return m.user_id!==_uid();});
    if(!list.length){c.innerHTML='<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:36px;opacity:.3">👨‍🏫</div><p>Koi mentor available nahi abhi</p></div>';return;}
    var h='<div style="margin-bottom:10px;padding:10px 12px;border-radius:11px;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);font-size:11px;color:#ffd700">💡 Rank badhne par mentor ko Green Diamonds milte hain!</div>';
    h+='<div style="display:flex;flex-direction:column;gap:8px">';
    list.forEach(function(m){
      var ri=_ri(m.rank_pts||0);
      h+='<div style="padding:14px;border-radius:14px;background:var(--card);border:1px solid var(--border)">';
      h+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">';
      h+='<div style="width:48px;height:48px;border-radius:50%;background:'+ri.bg+';border:2px solid '+ri.c+';display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">'+ri.e+'</div>';
      h+='<div style="flex:1"><div style="display:flex;align-items:center;gap:6px"><span style="font-size:14px;font-weight:800">'+(m.ign||'Mentor')+'</span><span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.3);color:#ffd700;font-weight:700">👨‍🏫 MENTOR</span></div>';
      h+='<div style="font-size:11px;color:var(--txt2)">'+ri.e+' '+ri.b+'</div>';
      if(m.speciality)h+='<div style="font-size:11px;color:#00d4ff">🎯 '+m.speciality+'</div></div></div>';
      if(m.bio)h+='<div style="font-size:12px;color:var(--txt2);font-style:italic;margin-bottom:10px">"'+(window.escHtml?window.escHtml(m.bio.substring(0,80)):m.bio.substring(0,80))+'"</div>';
      h+='<div style="display:flex;align-items:center;justify-content:space-between">';
      h+='<div style="font-size:11px;color:var(--txt2)">Sessions: <strong style="color:var(--txt)">'+(m.total_sessions||0)+'</strong></div>';
      h+='<button onclick="window.requestMentorSession(\''+m.uid+'\',\''+(m.ign||'Mentor').replace(/'/g,"\\'")+'\')" style="padding:8px 14px;border-radius:10px;border:1.5px solid rgba(255,215,0,.4);background:rgba(255,215,0,.08);color:#ffd700;font-size:12px;font-weight:800;cursor:pointer">Request</button>';
      h+='</div></div>';
    });
    h+='</div>';c.innerHTML=h;
  }).catch(function(){c.innerHTML='<div style="color:#ff6b6b;text-align:center">Error loading mentors</div>';});
}

function _mtMySessions(c){
  c.innerHTML='<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
  if(!_s()||!_uid()){c.innerHTML='<p style="color:#ff6b6b;text-align:center">Login required</p>';return;}
  _s().from('mentor_requests').select('*').eq('student_uid',_uid()).order('created_at',{ascending:false}).limit(10)
  .then(function(r){
    var reqs=r.data||[];
    if(!reqs.length){c.innerHTML='<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:36px;opacity:.3">📚</div><p>Koi session nahi abhi</p></div>';return;}
    var statusColors={pending:'#ffd700',accepted:'var(--green)',completed:'#00d4ff',declined:'#ff6b6b'};
    var h='<div style="display:flex;flex-direction:column;gap:8px">';
    reqs.forEach(function(r){
      var sc=statusColors[r.status||'pending']||'var(--txt2)';
      h+='<div style="padding:12px 14px;border-radius:13px;background:var(--card);border:1px solid var(--border)">';
      h+='<div style="display:flex;justify-content:space-between;margin-bottom:5px"><div style="font-size:13px;font-weight:800">👨‍🏫 '+(r.mentor_ign||'Mentor')+'</div><span style="font-size:11px;font-weight:700;color:'+sc+'">'+(r.status||'pending').toUpperCase()+'</span></div>';
      if(r.message)h+='<div style="font-size:12px;color:var(--txt2)">'+r.message+'</div>';
      h+='<div style="font-size:10px;color:var(--txt2);margin-top:4px">'+new Date(r.created_at||Date.now()).toLocaleDateString('en-IN')+'</div></div>';
    });
    h+='</div>';c.innerHTML=h;
  }).catch(function(){c.innerHTML='<div style="color:#ff6b6b;text-align:center">Error</div>';});
}

function _mtDashboard(c){
  if(!_canMentor()){
    c.innerHTML='<div style="text-align:center;padding:20px"><div style="font-size:36px;margin-bottom:10px">🔒</div><div style="font-size:15px;font-weight:800;color:var(--txt)">Mentor banne ke liye</div><div style="font-size:12px;color:var(--txt2);margin-top:6px;line-height:1.7">✅ Gold rank (600+ RP)<br>✅ Premium Gold (₹99) ya Diamond (₹199)</div><button onclick="if(window.showPremiumUpgrade)showPremiumUpgrade()" style="margin-top:14px;padding:12px 24px;border-radius:12px;border:none;background:var(--primary);color:#000;font-size:13px;font-weight:800;cursor:pointer">Premium Upgrade Karo</button></div>';
    return;
  }
  c.innerHTML='<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
  if(!_s()||!_uid()){c.innerHTML='<p style="color:#ff6b6b;text-align:center">Login required</p>';return;}
  _s().from('mentor_profiles').select('*').eq('user_id',_uid()).single()
  .then(function(r){
    if(!r.data||!r.data.is_available)_renderBecomeMentor(c);
    else _renderMentorStats(c,r.data);
  }).catch(function(){ _renderBecomeMentor(c); });
}

function _renderBecomeMentor(c){
  var h='<div style="text-align:center;padding:14px 0 20px"><div style="font-size:42px;margin-bottom:8px">👨‍🏫</div><div style="font-size:16px;font-weight:900">Mentor bano!</div><div style="font-size:12px;color:var(--txt2);margin-top:4px;line-height:1.6">Students guide karo aur Green Diamonds kamao.</div></div>';
  h+='<div style="margin-bottom:12px"><div style="font-size:12px;color:var(--txt2);font-weight:700;margin-bottom:7px">Speciality</div><input id="mtSpecIn" type="text" placeholder="e.g. Sniper, Rush, IGL..." maxlength="40" style="width:100%;padding:11px 14px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;box-sizing:border-box"></div>';
  h+='<div style="margin-bottom:14px"><div style="font-size:12px;color:var(--txt2);font-weight:700;margin-bottom:7px">Bio</div><textarea id="mtBioIn" maxlength="120" placeholder="Apne baare mein batao..." style="width:100%;padding:11px 14px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;box-sizing:border-box;resize:none;height:70px"></textarea></div>';
  h+='<button onclick="window.registerAsMentor()" style="width:100%;padding:13px;border-radius:13px;border:none;background:linear-gradient(135deg,#ffd700,#ff9f1c);color:#000;font-size:14px;font-weight:900;cursor:pointer">👨‍🏫 Mentor Register Karo</button>';
  c.innerHTML=h;
}

function _renderMentorStats(c,m){
  var h='<div style="background:rgba(255,215,0,.06);border:1.5px solid rgba(255,215,0,.2);border-radius:16px;padding:16px;margin-bottom:14px">';
  h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="font-size:28px">👨‍🏫</div><div><div style="font-size:15px;font-weight:900;color:#ffd700">Active Mentor</div></div>';
  h+='<button onclick="window.deactivateMentor()" style="margin-left:auto;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,107,107,.3);background:transparent;color:#ff6b6b;font-size:10px;cursor:pointer">Pause</button></div>';
  h+='<div style="display:flex;gap:16px">';
  [['📚',m.total_sessions||0,'Sessions'],['👥',m.total_students||0,'Students'],['📈',m.successful_students||0,'Ranked Up'],['💎',m.gd_earned||0,'GD']].forEach(function(s){
    h+='<div style="text-align:center"><div style="font-size:18px;font-weight:900;color:#ffd700">'+s[1]+'</div><div style="font-size:9px;color:var(--txt2)">'+s[2]+'</div></div>';
  });
  h+='</div></div>';
  // Load pending student requests
  h+='<div style="font-size:13px;font-weight:800;margin-bottom:8px">📬 Student Requests</div><div id="mtStudentReqs"><div style="text-align:center;padding:12px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div></div>';
  c.innerHTML=h;
  _s().from('mentor_requests').select('*').eq('mentor_uid',_uid()).eq('status','pending').order('created_at',{ascending:false}).limit(10)
  .then(function(r){
    var reqs=r.data||[];var rr=document.getElementById('mtStudentReqs');if(!rr)return;
    if(!reqs.length){rr.innerHTML='<div style="text-align:center;padding:16px;color:var(--txt2);font-size:12px">Koi request nahi</div>';return;}
    var h='<div style="display:flex;flex-direction:column;gap:8px">';
    reqs.forEach(function(req){
      h+='<div style="padding:12px 14px;border-radius:13px;background:rgba(255,215,0,.05);border:1px solid rgba(255,215,0,.2)">';
      h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><div><div style="font-size:13px;font-weight:800">📚 '+(req.student_ign||'Student')+'</div><div style="font-size:11px;color:var(--txt2)">'+( req.student_rank_badge||'Bronze')+'</div></div>';
      h+='<div style="display:flex;gap:6px"><button onclick="window.acceptMentorReq('+req.id+')" style="padding:7px 11px;border-radius:9px;border:none;background:var(--green);color:#000;font-size:11px;font-weight:800;cursor:pointer">Accept</button>';
      h+='<button onclick="window.declineMentorReq('+req.id+')" style="padding:7px 11px;border-radius:9px;border:1px solid var(--border);background:transparent;color:var(--txt2);font-size:11px;cursor:pointer">Decline</button></div></div>';
      if(req.message)h+='<div style="font-size:11px;color:var(--txt2)">'+req.message+'</div>';
      h+='</div>';
    });
    h+='</div>';rr.innerHTML=h;
  }).catch(function(){var rr=document.getElementById('mtStudentReqs');if(rr)rr.innerHTML='<div style="color:#ff6b6b;text-align:center;font-size:12px">Error</div>';});
}

window.registerAsMentor=function(){
  if(!_s()||!_uid()||!_ud().ign){if(window.toast)toast('Login karo','err');return;}
  if(!_canMentor()){if(window.toast)toast('Premium Gold + Gold Rank required','err');return;}
  var spec=(document.getElementById('mtSpecIn')||{}).value||'';
  var bio=(document.getElementById('mtBioIn')||{}).value||'';
  var ud=_ud();var ri=_ri(ud.rank_points||0);
  _s().from('mentor_profiles').upsert({user_id:_uid(),ign:ud.ign||ud.displayName||'Player',rank_pts:ud.rank_points||0,rank_tier:ri.b,avatar_url:ud.avatar_url||'',speciality:spec.trim(),bio:bio.trim(),is_available:true,total_sessions:0,total_students:0,successful_students:0,gd_earned:0},{onConflict:'user_id'})
  .then(function(){if(window.toast)toast('🎉 Mentor register ho gaye!','ok');if(window.logActivity)logActivity('rank_up','👨‍🏫 Mentor ban gaye!');if(window.closeModal)closeModal();})
  .catch(function(e){if(window.toast)toast('Error: '+(e.message||'Try again'),'err');});
};

window.requestMentorSession=function(mentorUid,mentorIgn){
  var ud=_ud();var ri=_ri(ud.rank_points||0);
  var h='<div style="text-align:center;margin-bottom:14px"><div style="font-size:36px;margin-bottom:6px">📚</div><div style="font-size:16px;font-weight:800">'+mentorIgn+' se guidance lo</div></div>';
  h+='<div style="margin-bottom:12px"><div style="font-size:12px;color:var(--txt2);font-weight:700;margin-bottom:7px">Message (optional)</div><textarea id="mtMsgIn" maxlength="100" placeholder="Kya seekhna chahte ho?" style="width:100%;padding:11px 14px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;box-sizing:border-box;resize:none;height:70px"></textarea></div>';
  h+='<div style="padding:10px 14px;border-radius:11px;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);margin-bottom:14px;font-size:12px;color:var(--txt2)">✅ Rank badhne par mentor ko Green Diamonds milenge.</div>';
  h+='<button onclick="window._submitMentorRequest(\''+mentorUid+'\',\''+mentorIgn.replace(/'/g,"\\'")+'\')" style="width:100%;padding:13px;border-radius:13px;border:none;background:linear-gradient(135deg,#ffd700,#ff9f1c);color:#000;font-size:14px;font-weight:900;cursor:pointer">📚 Request Bhejo</button>';
  var mb=document.getElementById('modalB');if(mb)mb.innerHTML=h;
};

window._submitMentorRequest=function(mentorUid,mentorIgn){
  if(!_s()||!_uid()||!_ud()){if(window.toast)toast('Login karo','err');return;}
  var msg=(document.getElementById('mtMsgIn')||{}).value||'';
  var ud=_ud();var ri=_ri(ud.rank_points||0);
  _s().from('mentor_requests').insert({mentor_uid:mentorUid,mentor_ign:mentorIgn,student_uid:_uid(),student_ign:ud.ign||ud.displayName||'Player',student_rank_pts:ud.rank_points||0,student_rank_badge:ri.b,message:msg.trim(),status:'pending'})
  .then(function(){
    _s().from('notifications').insert({user_id:mentorUid,type:'mentor_request',title:'📚 New Student Request!',body:(ud.ign||'Player')+' ('+ri.b+') ne mentor session request bheja!',ref_id:_uid(),is_read:false}).catch(function(){});
    if(window.toast)toast('✅ Request bhej di!','ok');if(window.closeModal)closeModal();
  }).catch(function(e){if(window.toast)toast('Error: '+(e.message||'Try again'),'err');});
};

window.acceptMentorReq=function(reqId){
  if(!_s()||!_uid())return;
  _s().from('mentor_requests').select('student_uid,student_ign').eq('id',reqId).single()
  .then(function(r){
    var req=r.data;if(!req)return;
    _s().from('mentor_requests').update({status:'accepted'}).eq('id',reqId).then(function(){
      _s().from('notifications').insert({user_id:req.student_uid,type:'mentor_accepted',title:'🎉 Mentor Accepted!',body:(_ud().ign||'Mentor')+' ne tumhari request accept kar li!',ref_id:_uid(),is_read:false}).catch(function(){});
      _s().from('mentor_profiles').select('total_students').eq('user_id',_uid()).single().then(function(m){
        if(m.data)_s().from('mentor_profiles').update({total_students:(m.data.total_students||0)+1}).eq('user_id',_uid()).catch(function(){});
      }).catch(function(){});
      if(window.toast)toast('✅ Request accept!','ok');
      var rr=document.getElementById('mtStudentReqs');if(rr)rr.innerHTML='<div style="text-align:center;padding:8px;color:var(--green);font-size:12px">✅ Accepted</div>';
    });
  }).catch(function(){if(window.toast)toast('Error','err');});
};
window.declineMentorReq=function(reqId){
  if(!_s())return;
  _s().from('mentor_requests').update({status:'declined'}).eq('id',reqId).then(function(){if(window.toast)toast('Declined','ok');}).catch(function(){});
};
window.deactivateMentor=function(){
  if(!_s()||!_uid())return;
  _s().from('mentor_profiles').update({is_available:false}).eq('user_id',_uid()).then(function(){if(window.toast)toast('Mentor profile paused','ok');if(window.closeModal)closeModal();}).catch(function(){});
};

window.checkMentorReward=function(oldRp,newRp){
  if(!_s()||!_uid())return;
  var oldT=_tier(oldRp),newT=_tier(newRp);if(newT<=oldT)return;
  _s().from('mentor_requests').select('mentor_uid,mentor_ign').eq('student_uid',_uid()).eq('status','accepted').limit(1).single()
  .then(function(r){
    if(!r.data)return;
    var mid=r.data.mentor_uid,mign=r.data.mentor_ign;
    var gd=20*(newT-oldT);
    _s().from('users').select('green_diamonds').eq('id',mid).single().then(function(u){
      if(!u.data)return;
      _s().from('users').update({green_diamonds:(u.data.green_diamonds||0)+gd}).eq('id',mid).catch(function(){});
      _s().from('mentor_profiles').select('gd_earned,successful_students').eq('user_id',mid).single().then(function(mp){
        if(!mp.data)return;
        _s().from('mentor_profiles').update({gd_earned:(mp.data.gd_earned||0)+gd,successful_students:(mp.data.successful_students||0)+1}).eq('user_id',mid).catch(function(){});
      }).catch(function(){});
      _s().from('notifications').insert({user_id:mid,type:'mentor_reward',title:'💎 Mentor Reward!',body:'Tumhare student '+(_ud().ign||'Player')+' ka rank badh gaya! Tumhe '+gd+' Green Diamonds mile!',ref_id:_uid(),is_read:false}).catch(function(){});
    }).catch(function(){});
  }).catch(function(){});
};

// Pill injection
var _i=0,_t=setInterval(function(){
  _i++;if(_i>80){clearInterval(_t);return;}
  if(!window.UD)return;
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_mtPill')){if(row)clearInterval(_t);return;}
  clearInterval(_t);
  var p=document.createElement('div');p.id='_mtPill';p.className='special-pill';
  p.style.cssText='background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);color:#ffd700';
  p.innerHTML='<i class="fas fa-graduation-cap" style="font-size:11px"></i> Mentor';
  p.onclick=function(){if(window.showMentorHub)showMentorHub();};
  row.appendChild(p);
},600);
})();
