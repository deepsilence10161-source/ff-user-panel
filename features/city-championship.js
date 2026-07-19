/* ================================================================
   CITY CHAMPIONSHIP v2.0 — 100% Supabase
   Table: city_championship(id,city,month,score,wins,kills,player_count)
================================================================ */
(function(){ 'use strict';
function _s(){ return window._supa; }
function _uid(){ return window.U&&window.U.uid; }
/* H14 Fix: Use IST local date not UTC — toISOString() returns UTC which may
   show previous/next month for Indian users around midnight IST (UTC+5:30).
   e.g. 11:45 PM IST = 6:15 PM UTC → still the previous UTC day. */
function _month() {
  var d = new Date();
  var istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30
  var istDate = new Date(d.getTime() + istOffset);
  var y = istDate.getUTCFullYear();
  var m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

window.showCityChampionship=function(){
  if(!_uid()){if(window.toast)toast('Pehle login karo','err');return;}
  var h='<div style="display:flex;gap:8px;margin-bottom:12px">';
  [{id:'ccTabStand',l:'🏆 Standings'},{id:'ccTabMy',l:'🏙️ My City'},{id:'ccTabRules',l:'📋 Rules'}].forEach(function(tab,i){
    h+='<button id="'+tab.id+'" onclick="ccTab('+i+')" style="flex:1;padding:9px;border-radius:11px;border:none;font-size:12px;font-weight:800;cursor:pointer;background:'+(i===0?'var(--primary)':'transparent')+';color:'+(i===0?'#000':'var(--txt)')+'">'+ tab.l+'</button>';
  });
  h+='</div><div id="ccContent"></div>';
  openModal('🏙️ City Championship',h); ccTab(0);
};

window.ccTab=function(idx){
  ['ccTabStand','ccTabMy','ccTabRules'].forEach(function(id,i){
    var b=document.getElementById(id);if(!b)return;
    b.style.background=i===idx?'var(--primary)':'transparent';b.style.color=i===idx?'#000':'var(--txt)';b.style.border=i===idx?'none':'1px solid var(--border)';
  });
  var c=document.getElementById('ccContent');if(!c)return;
  if(idx===0)_ccStandings(c); else if(idx===1)_ccMyCity(c); else _ccRules(c);
};

function _ccStandings(c){
  c.innerHTML='<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
  if(!_s()){c.innerHTML='<p style="color:#ff6b6b;text-align:center">Service unavailable</p>';return;}
  var mon=_month();
  _s().from('city_championship').select('*').eq('month',mon).order('score',{ascending:false}).limit(20)
  .then(function(r){
    var cities=r.data||[];
    var myCity=(window.UD&&window.UD.city)||'';
    var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var d=new Date(); var label=months[d.getMonth()]+' '+d.getFullYear();
    var h='<div style="text-align:center;margin-bottom:12px"><div style="font-size:12px;color:var(--txt2)">Season: <strong style="color:var(--txt)">'+label+'</strong></div><div style="font-size:11px;color:var(--txt2)">Score = Wins×10 + Kills×1</div></div>';
    if(!cities.length){h+='<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:36px;opacity:.3">🏙️</div><p>Abhi koi city registered nahi</p></div>';c.innerHTML=h;return;}
    var emojis=['🥇','🥈','🥉'];
    h+='<div style="display:flex;flex-direction:column;gap:7px">';
    cities.forEach(function(ci,i){
      var isMe=myCity&&ci.city.toLowerCase()===myCity.toLowerCase();
      h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:13px;background:'+(isMe?'rgba(0,255,156,.06)':'var(--card)')+';border:1.5px solid '+(isMe?'rgba(0,255,156,.25)':'var(--border)')+'">';
      h+='<div style="font-size:22px;min-width:32px;text-align:center">'+(emojis[i]||('#'+(i+1)))+'</div>';
      h+='<div style="flex:1"><div style="font-size:14px;font-weight:800">'+ci.city+'</div><div style="font-size:11px;color:var(--txt2)">👥 '+(ci.player_count||0)+' · 🏆 '+(ci.wins||0)+' wins</div></div>';
      h+='<div style="text-align:right"><div style="font-size:16px;font-weight:900;color:'+(isMe?'var(--green)':'var(--txt)')+'">'+((ci.score||0).toLocaleString())+'</div><div style="font-size:10px;color:var(--txt2)">pts</div></div>';
      if(isMe)h+='<span style="font-size:10px;color:var(--green);font-weight:700">YOU</span>';
      h+='</div>';
    });
    h+='</div>'; c.innerHTML=h;
  }).catch(function(){c.innerHTML='<div style="color:#ff6b6b;text-align:center">Error loading</div>';});
}

function _ccMyCity(c){
  var ud=window.UD||{},city=ud.city||'';
  if(!city){c.innerHTML='<div style="text-align:center;padding:20px"><p style="color:var(--txt2)">Profile mein apna city set karo pehle!</p><button onclick="navTo(\'profile\')" style="padding:10px 20px;border-radius:11px;border:none;background:var(--green);color:#000;font-weight:800;cursor:pointer;margin-top:10px">Profile Open</button></div>';return;}
  c.innerHTML='<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
  if(!_s()){c.innerHTML='<p style="color:#ff6b6b;text-align:center">Service unavailable</p>';return;}
  var mon=_month();
  _s().from('city_championship').select('*').eq('city',city).eq('month',mon).single()
  .then(function(r){
    var d=r.data||{score:0,wins:0,kills:0,player_count:0};
    var h='<div style="background:linear-gradient(135deg,rgba(0,255,156,.06),rgba(0,212,255,.04));border:1.5px solid rgba(0,255,156,.2);border-radius:16px;padding:20px;text-align:center;margin-bottom:14px">';
    h+='<div style="font-size:32px;margin-bottom:6px">🏙️</div><div style="font-size:22px;font-weight:900;color:var(--green)">'+city+'</div>';
    h+='<div style="display:flex;justify-content:center;gap:20px;margin-top:14px">';
    [[(d.score||0)+'pts','Score'],[(d.wins||0),'Wins'],[(d.player_count||0),'Players']].forEach(function(s){
      h+='<div style="text-align:center"><div style="font-size:18px;font-weight:900;color:var(--green)">'+s[0]+'</div><div style="font-size:10px;color:var(--txt2)">'+s[1]+'</div></div>';
    });
    h+='</div></div>';
    c.innerHTML=h;
  }).catch(function(){
    // City not in championship yet
    c.innerHTML='<div style="text-align:center;padding:20px;color:var(--txt2)"><div style="font-size:36px;opacity:.3">🏙️</div><p>'+city+' abhi championship mein nahi hai.<br><small>Match khelo toh score add hoga!</small></p></div>';
  });
}

function _ccRules(c){
  c.innerHTML='<div style="display:flex;flex-direction:column;gap:10px">'
    +_rCard('🗓️','Monthly Season','Har mahine naya season. Purane scores reset ho jaate hain.')
    +_rCard('📊','Points System','Win=10pts · Kill=1pt')
    +_rCard('🏆','Top 3','Month end pe top 3 cities ke players ko exclusive badge milta hai')
    +_rCard('📍','Represent','Profile mein city set karo — auto update hoga')
    +'</div>';
}
function _rCard(i,t,d){ return'<div style="display:flex;gap:12px;padding:12px 14px;border-radius:13px;background:var(--card);border:1px solid var(--border)"><span style="font-size:22px;flex-shrink:0">'+i+'</span><div><div style="font-size:13px;font-weight:800;margin-bottom:2px">'+t+'</div><div style="font-size:12px;color:var(--txt2);line-height:1.5">'+d+'</div></div></div>'; }

window.updateCityChampScore=function(wins,kills){
  if(!_s()||!_uid()||!window.UD)return;
  var city=window.UD.city;if(!city)return;
  /* Bug #67 Fix: Normalize city name to Title Case to prevent fragmented leaderboards
     e.g. "mumbai", "Mumbai", "MUMBAI" all treated as same city */
  city = city.trim().replace(/\b\w/g, function(c){ return c.toUpperCase(); });
  var mon=_month(); var score=(wins?10:0)+(kills||0);
  var myIgn=window.UD.ign||window.UD.displayName||'Player';
  // Upsert city total
  _s().rpc('increment_city_score',{p_city:city,p_month:mon,p_score:score,p_wins:wins?1:0,p_kills:kills||0,p_uid:_uid()})
  .catch(function(){
    // Fallback: direct upsert
    _s().from('city_championship').select('id,score,wins,kills,player_count').eq('city',city).eq('month',mon).single()
    .then(function(r){
      var d=r.data;
      if(d){
        _s().from('city_championship').update({score:(d.score||0)+score,wins:(d.wins||0)+(wins?1:0),kills:(d.kills||0)+(kills||0)}).eq('id',d.id).catch(function(){});
      } else {
        _s().from('city_championship').insert({city:city,month:mon,score:score,wins:wins?1:0,kills:kills||0,player_count:1}).catch(function(){});
      }
    }).catch(function(){});
  });
};

// Pill injection
var _i=0,_t=setInterval(function(){
  _i++;if(_i>60){clearInterval(_t);return;}
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_ccPill')){if(row)clearInterval(_t);return;}
  clearInterval(_t);
  var p=document.createElement('div');p.id='_ccPill';p.className='special-pill';
  p.style.cssText='background:rgba(255,165,0,.08);border:1px solid rgba(255,165,0,.2);color:#ffa500';
  p.innerHTML='<i class="fas fa-trophy" style="font-size:11px"></i> City War';
  p.onclick=function(){if(window.showCityChampionship)showCityChampionship();};
  row.appendChild(p);
},400);
})();
