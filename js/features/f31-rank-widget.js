/* FEATURE 31: Rank + Sunday Eligibility Widget
   Now shows in Special screen (between header and toggle), not home */
(function(){
'use strict';
var _rank=null,_total=null;

function badge(){
  if(!_rank) return '';
  if(_rank<=96)  return '<span style="background:rgba(255,60,60,.15);color:#ff4500;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:800">🔴 Sunday Eligible</span>';
  if(_rank<=200) return '<span style="background:rgba(255,170,0,.12);color:#ffaa00;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700">🟡 Top 200</span>';
  if(_rank<=400) return '<span style="background:rgba(0,212,255,.1);color:#00d4ff;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700">🔵 Top 400</span>';
  return '<span style="background:rgba(255,255,255,.06);color:#888;border-radius:20px;padding:3px 12px;font-size:11px">Keep playing!</span>';
}

function fetch(){
  if(!window.db||!window.U) return;
  window.db.ref('users').orderByChild('stats/earnings').once('value',function(s){
    var arr=[]; s.forEach(function(c){ arr.push({k:c.key,e:(c.val().stats||{}).earnings||0}); });
    arr.sort(function(a,b){return b.e-a.e;}); _total=arr.length;
    var i=arr.findIndex(function(u){return u.k===window.U.uid;});
    _rank=i>=0?i+1:_total+1; render();
  });
}

function render(){
  var el=document.getElementById('f31widget'); if(!el||!_rank) return;
  el.style.display='flex';
  el.innerHTML=
    '<div style="flex:1">' +
      '<div style="font-size:11px;color:#888;margin-bottom:2px">Your Rank</div>' +
      '<div style="font-size:20px;font-weight:900;color:#00ff9c">#'+_rank+
        '<span style="font-size:12px;color:#666;font-weight:400"> of '+_total+'</span>' +
      '</div>' +
    '</div>' +
    '<div>'+badge()+'</div>';
}

function inject(){
  /* Inject into Special screen, before the toggle */
  var spScreen=document.getElementById('scrSpecial');
  if(!spScreen||document.getElementById('f31widget')) return;
  var toggle=spScreen.querySelector('.sp-toggle');
  if(!toggle) return;

  var d=document.createElement('div');
  d.id='f31widget';
  d.style.cssText='display:none;align-items:center;gap:12px;' +
    'background:rgba(0,255,156,.04);border:1px solid rgba(0,255,156,.1);' +
    'border-radius:14px;padding:12px 16px;margin:8px 16px 8px';
  toggle.parentNode.insertBefore(d, toggle);
  fetch();
}

/* Init after login */
var _t=0,_i=setInterval(function(){
  _t++;
  if(window.db&&window.U&&window.UD){ clearInterval(_i); setTimeout(inject,1500); setInterval(fetch,5*60*1000); }
  if(_t>60) clearInterval(_i);
},1000);

/* Hook renderSP to re-inject if needed */
var _h=setInterval(function(){
  if(window.renderSP&&!window._f31h){ clearInterval(_h); window._f31h=true;
    var o=window.renderSP;
    window.renderSP=function(){ o.apply(this,arguments); setTimeout(function(){ if(!document.getElementById('f31widget')) inject(); },300); };
  }
},500);

window.f31Rank={fetch:fetch,render:render};
})();
