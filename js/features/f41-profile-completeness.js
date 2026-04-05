/* FEATURE 41: Profile Completeness Indicator
   Profile pe progress bar — kitna complete hai, missing cheezein suggest kare. */
(function(){
'use strict';
function calcScore(ud){
  var score=0,tips=[];
  if(ud.ign){score+=20;}else tips.push('IGN add karo');
  if(ud.ffUid){score+=20;}else tips.push('FF UID add karo');
  if(ud.phone){score+=15;}else tips.push('Phone verify karo');
  if(ud.profileStatus==='verified'){score+=25;}else tips.push('Profile verify karwao');
  if(ud.profilePic||ud.avatarUrl){score+=10;}else tips.push('Photo add karo');
  if(ud.stats&&ud.stats.matches>0){score+=10;}
  return{score:score,tips:tips};
}
function render(){
  var el=document.getElementById('f41progress'); if(!el||!window.UD) return;
  var r=calcScore(window.UD);
  var col=r.score>=80?'var(--primary,#00ff9c)':r.score>=50?'#ffd700':'#ff6b6b';
  el.innerHTML='<div style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">'
    +'<span style="font-size:12px;font-weight:700">Profile Strength</span>'
    +'<span style="font-size:13px;font-weight:900;color:'+col+'">'+r.score+'%</span></div>'
    +'<div style="height:6px;background:rgba(255,255,255,.08);border-radius:10px;overflow:hidden">'
    +'<div style="height:100%;width:'+r.score+'%;background:'+col+';border-radius:10px;transition:width .6s ease"></div></div>'
    +(r.tips.length?'<div style="margin-top:8px;font-size:11px;color:var(--txt2)">💡 '+r.tips[0]+'</div>':'<div style="margin-top:6px;font-size:11px;color:var(--primary,#00ff9c)">✅ Profile strong hai!</div>');
}
var _t=0,_i=setInterval(function(){
  _t++; if(window.UD&&document.getElementById('f41progress')){ clearInterval(_i); render(); }
  if(_t>60)clearInterval(_i);
},500);
// Hook profile render
var _h=setInterval(function(){
  if(window.renderProfile&&!window._f41h){ clearInterval(_h); window._f41h=true;
    var o=window.renderProfile; window.renderProfile=function(){ o.apply(this,arguments);
      var p=document.getElementById('profileSection')||document.querySelector('.profile-body');
      if(p&&!document.getElementById('f41progress')){ var d=document.createElement('div'); d.id='f41progress';
        d.style.cssText='background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:12px;margin:10px 0';
        p.insertBefore(d,p.firstChild); render(); }
    };
  }
},500);
window.f41Profile={calc:calcScore,render:render};
})();
