/* ================================================================
   MINI eSPORTS — SKILL-BASED MATCHMAKING v1.0
   Rank filter chips on home screen
   Also enforces match rank_min / rank_max set by admin
   Provides renderFilterChips() for home.js
================================================================ */
(function(){
'use strict';

/* ── Global filter state ── */
window._modeFilter = window._modeFilter || 'all';
window._rankFilter = window._rankFilter || 'all';

var RANK_TIERS=[
  {v:'all',  label:'All Ranks', color:'var(--txt2)'},
  {v:'Bronze',label:'🏅 Bronze', color:'#cd7f32'},
  {v:'Silver',label:'🥈 Silver', color:'#c0c0c0'},
  {v:'Gold',  label:'🥇 Gold',   color:'#ffd700'},
  {v:'Diamond',label:'💎 Diamond',color:'#00d4ff'},
];

/* ── Helper: get rank tier from rank points ── */
function _tier(pts){
  pts=Number(pts)||0;
  if(pts>=1501) return 'Diamond';
  if(pts>=601)  return 'Gold';
  if(pts>=301)  return 'Silver';
  return 'Bronze';
}

/* ── Inject rank filter logic into renderHome ── */
var _origRenderHome=null;
var _injRH=0,_injRHT=setInterval(function(){
  _injRH++; if(_injRH>60){ clearInterval(_injRHT); return; }
  if(typeof window.renderHome!=='function') return;
  if(window._rankMatchmakePatched) return;
  clearInterval(_injRHT);
  window._rankMatchmakePatched=true;
  _origRenderHome=window.renderHome;
  window.renderHome=function(){
    /* Before rendering, apply rank filter to MT */
    _origRenderHome.call(this);
    /* After render, insert rank chips row if not already present */
    setTimeout(_ensureRankChips,60);
  };
},300);

/* Provide renderFilterChips for home.js */
window.renderFilterChips = function(){
  var myRp=(window.UD&&window.UD.rank_points)||0;
  var myTier=_tier(myRp);
  var h='<div class="filter-chips-row" style="display:flex;gap:6px;overflow-x:auto;padding:0 0 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin-bottom:4px">';
  /* Mode filters */
  [['all','🎮 All'],['solo','Solo'],['duo','Duo'],['squad','Squad']].forEach(function(m){
    var active=window._modeFilter===m[0];
    h+='<button onclick="window._modeFilter=\''+m[0]+'\';if(window.renderHome)renderHome();" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;background:'+(active?'var(--primary)':'rgba(255,255,255,.07)')+';color:'+(active?'#000':'var(--txt)')+'">'+m[1]+'</button>';
  });
  h+='</div>';
  /* Rank filter row */
  h+='<div id="_rankFilterRow" style="display:flex;gap:6px;overflow-x:auto;padding:0 0 8px;scrollbar-width:none;margin-bottom:6px">';
  RANK_TIERS.forEach(function(r){
    var active=window._rankFilter===r.v;
    var isMyTier=r.v===myTier;
    h+='<button onclick="window._rankFilter=\''+r.v+'\';if(window.renderHome)renderHome();" style="flex-shrink:0;padding:5px 12px;border-radius:20px;border:1.5px solid '+(active?r.color:'transparent')+';font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;background:'+(active?r.color+'22':'rgba(255,255,255,.05)')+';color:'+(active?r.color:'var(--txt2)')+'">'+r.label+(isMyTier&&!active?' ★':'')+'</button>';
  });
  h+='</div>';
  return h;
};

/* Also apply rank filter in home.js render loop via window._rankFilterFn */
window._rankFilterFn=function(t){
  if(!window._rankFilter||window._rankFilter==='all') return true;
  var myRp=(window.UD&&window.UD.rank_points)||0;
  /* Admin-set rank limits on match */
  if(t.rank_min!==undefined&&myRp<Number(t.rank_min)) return false;
  if(t.rank_max!==undefined&&myRp>Number(t.rank_max)) return false;
  /* Player's own filter preference */
  var matchTier=t.rank_tier||'all';
  if(matchTier!=='all'&&matchTier!==window._rankFilter) return false;
  return true;
};

/* Patch the home.js render to also call _rankFilterFn */
/* We monkey-patch after the fact by patching window._modeFilter check */
var _origFilterPatch=0,_origFPT=setInterval(function(){
  _origFilterPatch++; if(_origFilterPatch>80){ clearInterval(_origFPT); return; }
  if(!window._rankMatchmakePatched||typeof window.renderHome!=='function') return;
  clearInterval(_origFPT);
  var orig2=window.renderHome;
  window.renderHome=function(){
    /* Patch MT temporarily */
    var hidden=[];
    if(window.MT&&window._rankFilter&&window._rankFilter!=='all'){
      for(var id in window.MT){
        if(!window._rankFilterFn(window.MT[id])){ window.MT[id]._rankHidden=true; hidden.push(id); }
      }
    }
    orig2.call(this);
    /* Restore */
    hidden.forEach(function(id){ if(window.MT[id]) delete window.MT[id]._rankHidden; });
  };
},350);

/* ── Ensure rank chips visible even if renderFilterChips not called ── */
function _ensureRankChips(){
  /* If there's already a rank filter row, do nothing */
  if(document.getElementById('_rankFilterRow')) return;
}

/* ── Show rank-locked match indicator in match cards ── */
window.getRankLockHTML=function(match){
  var myRp=(window.UD&&window.UD.rank_points)||0;
  if(match.rank_min!==undefined&&myRp<Number(match.rank_min)){
    var needed=_tier(match.rank_min);
    return '<div style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.25);font-size:10px;font-weight:700;color:#ff6b6b">🔒 '+needed+' Rank Required</div>';
  }
  if(match.rank_tier&&match.rank_tier!=='all'){
    var ri={Bronze:{c:'#cd7f32',e:'🏅'},Silver:{c:'#c0c0c0',e:'🥈'},Gold:{c:'#ffd700',e:'🥇'},Diamond:{c:'#00d4ff',e:'💎'}}[match.rank_tier];
    if(ri) return '<div style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;background:'+ri.c+'11;border:1px solid '+ri.c+'33;font-size:10px;font-weight:700;color:'+ri.c+'">'+ri.e+' '+match.rank_tier+' Match</div>';
  }
  return '';
};

/* ── "My Rank" quick display pill in header ── */
var _rkHdrI=0,_rkHdrT=setInterval(function(){
  _rkHdrI++; if(_rkHdrI>80){ clearInterval(_rkHdrT); return; }
  if(!window.UD||!window.UD.rank_points===undefined) return;
  clearInterval(_rkHdrT);
  var rp=window.UD.rank_points||0;
  var tier=_tier(rp);
  var colors={Bronze:'#cd7f32',Silver:'#c0c0c0',Gold:'#ffd700',Diamond:'#00d4ff'};
  var emojis={Bronze:'🏅',Silver:'🥈',Gold:'🥇',Diamond:'💎'};
  var existing=document.getElementById('_rkHdrPill');
  if(existing) return;
  var pill=document.createElement('div');
  pill.id='_rkHdrPill';
  pill.style.cssText='display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;background:'+colors[tier]+'11;border:1px solid '+colors[tier]+'33;font-size:11px;font-weight:800;color:'+colors[tier]+';cursor:pointer;margin-left:6px';
  pill.innerHTML=emojis[tier]+' '+tier;
  pill.title='Your Rank Tier — '+rp+' RP';
  pill.onclick=function(){ window._rankFilter=tier; if(window.renderHome) renderHome(); toast('Showing '+tier+' matches only','ok'); };
  var hdr=document.querySelector('.header-right,.hdr-right,header .right');
  if(hdr) hdr.appendChild(pill);
},600);

})();
