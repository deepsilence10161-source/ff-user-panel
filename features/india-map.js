/* ================================================================
   MINI eSPORTS — INDIA CONQUEST MAP v1.0
   SVG India map showing active cities & players
   Firebase: cityChampionship/{month}/cities
================================================================ */
(function(){
'use strict';

/* Top Indian cities with approx SVG coordinates on a simplified India map */
var CITIES=[
  {name:'Mumbai',      x:138, y:278, state:'Maharashtra'},
  {name:'Delhi',       x:175, y:155, state:'Delhi'},
  {name:'Bangalore',   x:160, y:330, state:'Karnataka'},
  {name:'Hyderabad',   x:178, y:295, state:'Telangana'},
  {name:'Chennai',     x:185, y:335, state:'Tamil Nadu'},
  {name:'Kolkata',     x:258, y:215, state:'West Bengal'},
  {name:'Pune',        x:143, y:290, state:'Maharashtra'},
  {name:'Ahmedabad',   x:128, y:225, state:'Gujarat'},
  {name:'Jaipur',      x:162, y:190, state:'Rajasthan'},
  {name:'Lucknow',     x:210, y:185, state:'UP'},
  {name:'Surat',       x:130, y:250, state:'Gujarat'},
  {name:'Patna',       x:235, y:195, state:'Bihar'},
  {name:'Bhopal',      x:183, y:240, state:'MP'},
  {name:'Indore',      x:165, y:248, state:'MP'},
  {name:'Nagpur',      x:195, y:265, state:'Maharashtra'},
  {name:'Visakhapatnam',x:220,y:285, state:'AP'},
  {name:'Chandigarh',  x:172, y:138, state:'Punjab'},
  {name:'Kochi',       x:160, y:365, state:'Kerala'},
  {name:'Guwahati',    x:295, y:185, state:'Assam'},
  {name:'Bhubaneswar', x:242, y:252, state:'Odisha'},
];

window.showIndiaMap = function(){
  openModal('🗺️ India Conquest Map','<div id="imContent"><div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading map...</div></div>');
  _loadMapData();
};

function _loadMapData(){
  var month=new Date().toISOString().substring(0,7);
  if(!window._supa){ _renderMap({}); return; }
  window._supa.from('city_championship').select('city,score,player_count,wins').eq('month',month)
  .then(function(r){
    var cityData={};
    (r.data||[]).forEach(function(c){ cityData[c.city]=c; });
    _renderMap(cityData);
  }).catch(function(){ _renderMap({}); });
}

function _renderMap(cityData){
  var c=document.getElementById('imContent'); if(!c) return;
  var myCity=(window.UD&&window.UD.city)||'';
  var totalPlayers=Object.values(cityData).reduce(function(a,b){ return a+(b.playerCount||0); },0);
  var maxScore=Math.max.apply(null,[1].concat(Object.values(cityData).map(function(d){ return d.score||0; })));
  var h='';
  /* Stats bar */
  h+='<div style="display:flex;gap:8px;margin-bottom:12px">';
  [['🌍','Active Cities',Object.keys(cityData).length],['👥','Total Players',totalPlayers],['🏆','Leading City',Object.entries(cityData).sort(function(a,b){ return (b[1].score||0)-(a[1].score||0); })[0]?.[0]||'—']].forEach(function(s){
    h+='<div style="flex:1;text-align:center;padding:10px 6px;border-radius:12px;background:var(--card);border:1px solid var(--border)">';
    h+='<div style="font-size:16px">'+s[0]+'</div>';
    h+='<div style="font-size:14px;font-weight:900;color:var(--green)">'+s[2]+'</div>';
    h+='<div style="font-size:10px;color:var(--txt2)">'+s[1]+'</div>';
    h+='</div>';
  });
  h+='</div>';
  /* SVG Map */
  h+='<div style="position:relative;background:rgba(0,212,255,.03);border:1px solid rgba(0,212,255,.12);border-radius:16px;overflow:hidden;padding:8px">';
  h+='<svg viewBox="60 90 320 320" style="width:100%;display:block" xmlns="http://www.w3.org/2000/svg">';
  /* India outline path — simplified */
  h+='<path d="M175,95 L195,92 L215,95 L235,100 L260,108 L278,118 L285,135 L290,155 L295,165 L300,175 L298,185 L295,195 L298,205 L295,218 L285,230 L275,240 L265,255 L260,270 L250,280 L245,295 L240,310 L235,320 L225,330 L215,340 L205,350 L195,358 L185,365 L175,370 L165,360 L158,350 L152,340 L148,330 L143,318 L140,305 L138,295 L135,280 L133,268 L130,255 L128,242 L126,228 L127,215 L128,200 L130,188 L132,175 L138,163 L143,150 L148,138 L155,128 L162,115 L170,102 Z" fill="rgba(0,212,255,.06)" stroke="rgba(0,212,255,.25)" stroke-width="1.5" stroke-linejoin="round"/>';
  /* Northeast states */
  h+='<path d="M278,118 L285,115 L295,118 L305,125 L310,135 L308,145 L303,155 L295,165 L290,155 L285,135 Z" fill="rgba(0,212,255,.04)" stroke="rgba(0,212,255,.15)" stroke-width="1"/>';
  /* City dots */
  CITIES.forEach(function(city){
    var data=cityData[city.name]||{};
    var score=data.score||0;
    var players=data.playerCount||0;
    var isActive=score>0||players>0;
    var isMe=myCity&&city.name.toLowerCase()===myCity.toLowerCase();
    var r=isMe?8:isActive?Math.max(4,Math.min(10,4+Math.round(score/maxScore*6))):3;
    var color=isMe?'#00ff9c':isActive?_scoreColor(score,maxScore):'rgba(255,255,255,.2)';
    var pulse=isMe||isActive;
    if(pulse){
      h+='<circle cx="'+city.x+'" cy="'+city.y+'" r="'+(r+4)+'" fill="'+color+'" opacity=".12"/>';
    }
    h+='<circle cx="'+city.x+'" cy="'+city.y+'" r="'+r+'" fill="'+color+'" stroke="rgba(0,0,0,.3)" stroke-width="1" style="cursor:pointer" onclick="window._imShowCityInfo(\''+city.name+'\','+score+','+players+')"/>';
    if(isActive||isMe){
      h+='<text x="'+city.x+'" y="'+(city.y-r-3)+'" text-anchor="middle" font-size="7" fill="rgba(255,255,255,.8)" font-weight="700">'+city.name.substring(0,6)+'</text>';
    }
  });
  h+='</svg>';
  /* Legend */
  h+='<div style="position:absolute;bottom:12px;left:12px;display:flex;flex-direction:column;gap:4px">';
  h+='<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:rgba(255,255,255,.6)"><div style="width:8px;height:8px;border-radius:50%;background:#00ff9c"></div> Your city</div>';
  h+='<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:rgba(255,255,255,.6)"><div style="width:8px;height:8px;border-radius:50%;background:#ff6b00"></div> Top city</div>';
  h+='<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:rgba(255,255,255,.6)"><div style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.2)"></div> Inactive</div>';
  h+='</div></div>';
  /* Selected city card */
  h+='<div id="imCityCard" style="display:none;margin-top:10px;padding:12px 14px;border-radius:13px;background:var(--card);border:1px solid var(--border)"></div>';
  /* Top 5 cities */
  var ranked=Object.entries(cityData).sort(function(a,b){ return (b[1].score||0)-(a[1].score||0); }).slice(0,5);
  if(ranked.length){
    h+='<div style="margin-top:12px;font-size:13px;font-weight:800;color:var(--txt);margin-bottom:8px">🏙️ Top Cities This Month</div>';
    h+='<div style="display:flex;flex-direction:column;gap:6px">';
    ranked.forEach(function(e,i){
      var isMe=myCity&&e[0].toLowerCase()===myCity.toLowerCase();
      h+='<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:'+(isMe?'rgba(0,255,156,.06)':'rgba(255,255,255,.03)')+';border:1px solid '+(isMe?'rgba(0,255,156,.2)':'rgba(255,255,255,.06)')+'">';
      h+='<span style="font-size:14px">'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1))+'</span>';
      h+='<div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--txt)">'+e[0]+'</div>';
      h+='<div style="font-size:10px;color:var(--txt2)">👥 '+(e[1].playerCount||0)+' players</div></div>';
      h+='<span style="font-size:13px;font-weight:900;color:'+(isMe?'var(--green)':'var(--txt)')+'">'+( e[1].score||0)+' pts</span>';
      h+='</div>';
    });
    h+='</div>';
  }
  c.innerHTML=h;
}

window._imShowCityInfo=function(name,score,players){
  var card=document.getElementById('imCityCard'); if(!card) return;
  var isMe=window.UD&&window.UD.city&&window.UD.city.toLowerCase()===name.toLowerCase();
  card.style.display='block';
  card.innerHTML='<div style="display:flex;align-items:center;gap:12px">'
    +'<div style="font-size:28px">🏙️</div>'
    +'<div style="flex:1">'
    +'<div style="font-size:14px;font-weight:800;color:var(--txt)">'+name+(isMe?' <span style="font-size:10px;color:var(--green)">(Your City)</span>':'')+'</div>'
    +'<div style="font-size:12px;color:var(--txt2);margin-top:2px">👥 '+players+' players · 🏆 '+score+' points</div>'
    +'</div>'
    +'<button onclick="document.getElementById(\'imCityCard\').style.display=\'none\'" style="background:transparent;border:none;color:var(--txt2);font-size:16px;cursor:pointer">×</button>'
    +'</div>';
};

function _scoreColor(score,max){
  if(max<=0) return 'rgba(255,255,255,.3)';
  var pct=score/max;
  if(pct>0.7) return '#ff6b00';
  if(pct>0.4) return '#ffd700';
  if(pct>0.1) return '#00d4ff';
  return '#6b9eff';
}

/* ── Pill ── */
var _imi=0,_imt=setInterval(function(){
  _imi++; if(_imi>60){ clearInterval(_imt); return; }
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_imPill')) return;
  clearInterval(_imt);
  var pill=document.createElement('div');
  pill.id='_imPill'; pill.className='special-pill';
  pill.style.cssText='background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);color:#00d4ff';
  pill.innerHTML='<i class="fas fa-map" style="font-size:11px"></i> India Map';
  pill.onclick=function(){ if(window.showIndiaMap) showIndiaMap(); };
  row.appendChild(pill);
},400);

})();
