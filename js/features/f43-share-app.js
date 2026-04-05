/* FEATURE 43: Share App Button (Referral-linked)
   Profile ya home pe "Share App" button — auto includes referral code. */
(function(){
'use strict';
function shareApp(){
  var code=(window.UD&&window.UD.referralCode)||'MINI';
  var ign=(window.UD&&window.UD.ign)||'Player';
  var txt='🎮 Mini eSports pe khelo aur paise kamao!\n'
    +'Free Fire tournaments join karo, real prizes jito!\n'
    +'📲 mini-esports.netlify.app\n'
    +'🎁 Join karo mere referral code se: '+code+'\n'
    +'(Dono ko bonus coins milenge!)';
  if(navigator.share) navigator.share({title:'Mini eSports',text:txt});
  else if(navigator.clipboard){ navigator.clipboard.writeText(txt); if(window.toast)toast('📋 Share text copied!','ok'); }
}

// Inject share button in profile
var _h=setInterval(function(){
  if(window.renderProfile&&!window._f43h){ clearInterval(_h); window._f43h=true;
    var o=window.renderProfile; window.renderProfile=function(){ o.apply(this,arguments);
      var btns=document.querySelector('.profile-actions')||document.getElementById('profileSection');
      if(btns&&!document.getElementById('f43shareBtn')){
        var b=document.createElement('button'); b.id='f43shareBtn';
        b.onclick=shareApp;
        b.innerHTML='<i class="fas fa-share-alt"></i> Share App';
        b.style.cssText='padding:10px 18px;border-radius:12px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.25);color:var(--primary,#00ff9c);font-size:13px;font-weight:700;cursor:pointer;margin:8px 0;display:flex;align-items:center;gap:8px';
        btns.appendChild(b);
      }
    };
  }
},500);
window.f43Share={share:shareApp}; window.shareApp=shareApp;
})();
