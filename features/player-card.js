/* ================================================================
   MINI eSPORTS — STYLISH PLAYER CARD v1.0
   Beautiful shareable card with stats
   Uses Canvas API for image generation
================================================================ */
(function(){
'use strict';

/* ── Generate card HTML preview ── */
window.showPlayerCard = function(targetUid){
  var uid = targetUid || (window.U && window.U.uid);
  if(!uid){ toast('Login karo','err'); return; }
  openModal('🃏 Player Card','<div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading...</div>');
  /* Load from Supabase */
  if(window._supa){
    /* BUG #38 FIX (2026-07-30): user_public_profiles view — works for self or other uid,
       columns here were already public-safe. */
    window._supa.from('user_public_profiles').select('id,ign,ff_uid,avatar_url,rank_points,rank_tier,total_wins,total_kills,total_matches,city,clan_id,is_vip').eq('id',uid).single()
    .then(function(r){ _renderPlayerCard(r.data||{}); })
    .catch(function(){ _renderPlayerCard(window.UD||{}); });
  } else {
    _renderPlayerCard(window.UD||{});
  }
};

function _renderPlayerCard(data){
  var mb=document.getElementById('modalB'); if(!mb) return;
  var ign     = data.ign||data.displayName||'Player';
  var ffUid   = data.ff_uid||data.ffUid||'—';
  var rp      = data.rank_points||data.rankPoints||0;
  var wins    = data.total_wins||0;
  var kills   = data.total_kills||0;
  var matches = data.total_matches||0;
  var city    = data.city||'India';
  var wr      = matches>0 ? Math.round(wins/matches*100) : 0;
  var kd      = matches>0 ? (kills/matches).toFixed(1) : '0.0';
  var ri      = _pcRankInfo(rp);
  /* streak */
  var streak  = (window.UD&&data.id===(window.U&&window.U.uid)&&window.UD._winStreak)||0;
  var streakBadge = streak>=7?'💀 Unstoppable':streak>=5?'⚡ On Fire':streak>=3?'🔥 Hot Streak':'';
  /* ✅ BUG FIX (2026-10-04) Bug 10: searched-user card ka border red
     (rank-tier color) tha — ab own-profile-box jaisa BLUE border + soft
     blue glow. VIP user (is_vip public view column) ke liye "unlimited
     colours" animated rainbow glow border (styles.css .rb-wrap). Premium
     status public nahi (RLS) — sirf is_vip dikhta hai, wahi use kiya. */
  var _isVipTarget = !!data.is_vip;
  var _cardBorder = _isVipTarget ? '' : 'border:2px solid rgba(0,212,255,.45);box-shadow:0 8px 24px rgba(0,212,255,.12)';
  /* Build the visual card */
  var h='<div id="playerCardWrap">';
  /* Card visual — D36 (04 Nov 2026): owner ki di hui design ka EXACT
     replica — PCARD2 core (js/profile-card2-core.js) base art + same
     coordinate table use karta hai; modal aur share-canvas dono identical. */
  var _pc2Data = {
    name: ign, uid: ffUid, level: 1, xp: 0, xpNeed: 10, pts: rp || 0,
    tier: String(data.rank_tier || ri.badge || 'Bronze'),
    stats: [matches, kills, wins, kd, wr + '%']
  };
  h += '<div id="pc2Host" style="margin-bottom:14px"></div>';
  /* Share buttons */
  h+='<button onclick="window.showAssetGallery&&window.showAssetGallery()" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,215,0,.35);background:rgba(255,215,0,.08);color:#ffd700;font-size:13px;font-weight:800;cursor:pointer;margin-bottom:8px"><i class="fas fa-trophy"></i> My Collection (Titles + Badges)</button>';
  h+='<button onclick="window.sharePlayerCard()" style="width:100%;padding:13px;border-radius:13px;border:none;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px"><i class="fab fa-whatsapp"></i> WhatsApp pe Share Karo</button>';
  h+='<button onclick="window.sharePlayerCardGeneric()" style="width:100%;padding:12px;border-radius:13px;border:1px solid var(--border);background:transparent;color:var(--txt);font-size:13px;font-weight:700;cursor:pointer"><i class="fas fa-share-alt"></i> Kisi bhi app se share karo</button>';
  h+='<p style="text-align:center;font-size:11px;color:var(--txt2);margin-top:8px">💡 Screenshot leke bhi share kar sakte ho!</p>';
  h+='</div>';
  mb.innerHTML=h;
  /* PCARD2 mount + battle-pass XP async bharo */
  try {
    var _pc2Host = document.getElementById('pc2Host');
    if (_pc2Host && window.PCARD2) {
      window.PCARD2.mount(_pc2Host, _pc2Data);
      var _pc2Uid = data.id || (window.U && window.U.uid);
      if (window._supa && _pc2Uid) {
        window._supa.from('battle_pass_progress').select('current_xp,current_tier').eq('user_id', _pc2Uid).maybeSingle().then(function (r) {
          var cx = (r && r.data && Number(r.data.current_xp)) || 0;
          var lv = ((r && r.data && Number(r.data.current_tier)) || Math.floor(cx / 100)) + 1;
          var need = 10 * lv;
          _pc2Data.level = lv; _pc2Data.xp = cx % need; _pc2Data.xpNeed = need;
          var h2 = document.getElementById('pc2Host');
          if (h2 && window.PCARD2) window.PCARD2.mount(h2, _pc2Data);
        }).catch(function () {});
      }
    }
  } catch (e) {}
  /* ── Clan chip fill (async) — ASLI clans row se (public read).
     Na mile to chip hata do (jhoota clan naam kabhi nahi). ── */
  if (_pcClanId && window._supa) {
    try {
      window._supa.from('clans').select('name,emblem,tag,total_members').eq('id', _pcClanId).maybeSingle()
        .then(function (cr) {
          var chip = document.getElementById('pcClanChip');
          if (!chip) return;
          var c = cr && cr.data;
          if (!c || !c.name) { chip.remove(); return; }
          var _em = (c.emblem || '🛡️');
          var _tag = c.tag ? ('[' + c.tag + '] ') : '';
          chip.innerHTML = _em + ' ' + (window.escHtml ? escHtml(_tag + c.name) : (_tag + c.name));
          chip.title = 'Clan' + (c.total_members != null ? ' · ' + c.total_members + ' members' : '');
        })
        .catch(function () { var chip = document.getElementById('pcClanChip'); if (chip) chip.remove(); });
    } catch (e) {}
  }
}

window.sharePlayerCard = function(){
  if(!window.UD) return;
  var ign=window.UD.ign||window.UD.displayName||'Player';
  var rp=window.UD.rank_points||0;
  var ri=_pcRankInfo(rp);
  var wins=window.UD.total_wins||0;
  var kills=window.UD.total_kills||0;
  /* ✅ 2026-10-12 (badge-engine): share text me sabse durlabh badge —
     "flex" hi marketing hai (yahan koi image attach nahi hoti, sirf
     screenshot wala text) */
  var _bestBadge = '';
  try { var _bt = window.getTopBadges ? window.getTopBadges(window._assetStats(), 1) : []; if (_bt.length) _bestBadge = _bt[0].name; } catch (e) {}
  var _myTitle='';
  try { if (window.getEquippedTagText) _myTitle = String(window.getEquippedTagText() || ''); } catch (e) {}
  var msg='🎮 '+ign+(_myTitle?(' '+_myTitle):'')+' | Mini eSports\n'+ri.emoji+' '+ri.badge+' ('+rp+' RP)'+(_bestBadge?('\n🎖️ '+_bestBadge+' badge'):'')+'\n🏆 '+wins+' Wins | 💀 '+kills+' Kills\n👉 Mini eSports pe aao aur mujhse takrao!\n#MinieSports #FreeFire';
  /* BUG FIX (2026-08-21): wa.me instead of native whatsapp:// scheme —
     see growth.js doShareResult for why. */
  /* ✅ BUG FIX (2026-08-22): window.open(url,'_blank') is silently swallowed
     by the wrapped app's WebView — only top-level navigation is intercepted
     and handed off to the real WhatsApp app. See growth.js doShareReferral
     for the full explanation. */
  var url='https://wa.me/?text='+encodeURIComponent(msg);
  window.openWhatsApp ? window.openWhatsApp(msg) : (window.location.href = url);
  toast('🎉 Share kiya!','ok');
};

window.sharePlayerCardGeneric=function(){
  if(!window.UD) return;
  var ign=window.UD.ign||window.UD.displayName||'Player';
  var rp=window.UD.rank_points||0;
  var ri=_pcRankInfo(rp);
  var _bestBadge2 = '';
  try { var _bt2 = window.getTopBadges ? window.getTopBadges(window._assetStats(), 1) : []; if (_bt2.length) _bestBadge2 = _bt2[0].name; } catch (e) {}
  var _myTitle2='';
  try { if (window.getEquippedTagText) _myTitle2 = String(window.getEquippedTagText() || ''); } catch (e) {}
  var msg='🎮 '+ign+(_myTitle2?(' '+_myTitle2):'')+' | Mini eSports | '+ri.emoji+' '+ri.badge+' ('+rp+' RP)'+(_bestBadge2?(' | 🎖️ '+_bestBadge2):'')+' | 🏆 '+(window.UD.total_wins||0)+' Wins | 💀 '+(window.UD.total_kills||0)+' Kills';
  if(navigator.share){
    navigator.share({title:'My Mini eSports Card',text:msg}).catch(function(err){
      if(err&&err.name!=='AbortError'){ _fallbackCopy(msg); }
    });
  } else { _fallbackCopy(msg); }
}
function _fallbackCopy(txt){
  if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(function(){ if(window.toast)toast('Copy ho gaya! 📋','ok'); }).catch(function(){ _execCopy(txt); }); }
  else { _execCopy(txt); }
}
function _execCopy(txt){
  try{ var t=document.createElement('textarea'); t.value=txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); if(window.toast)toast('Copy ho gaya! 📋','ok'); }
  catch(e){ if(window.toast)toast('Share ya copy nahi hua','err'); }

};

/* ── Auto-show after result ── */
window.showAutoResultCard = function(matchName, rankPos, kills, matchId){
  if(!window.UD||!window.U) return;
  var ign = window.UD.ign||window.UD.displayName||'Player';
  var rp  = window.UD.rank_points||0;
  var ri  = _pcRankInfo(rp);
  var rankEmoji = rankPos===1?'🥇':rankPos===2?'🥈':rankPos===3?'🥉':'#'+rankPos;
  var isWin = rankPos<=3;
  /* Update streak */
  if(window.updateWinStreak) updateWinStreak(isWin);
  /* Log activity */
  if(window.logActivity) logActivity(isWin?'win':'kill','Match '+matchName+': Rank '+rankPos+', '+kills+' kills');
  var h='<div>';
  /* Result card visual */
  h+='<div style="background:linear-gradient(135deg,#0a0a1a,#12122a,#0f1f2e);border-radius:20px;padding:20px;margin-bottom:14px;position:relative;overflow:hidden;border:2px solid '+(isWin?ri.color:'rgba(255,255,255,.1)')+'">';
  h+='<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,'+(isWin?ri.color:'rgba(255,255,255,.2)')+',transparent)"></div>';
  h+='<div style="text-align:center">';
  h+='<div style="font-size:60px;margin-bottom:6px;filter:drop-shadow(0 0 20px '+(isWin?ri.color+'88':'rgba(255,255,255,.2)')+')">'+rankEmoji+'</div>';
  h+='<div style="font-size:22px;font-weight:900;color:#fff">'+ign+'</div>';
  h+='<div style="font-size:12px;color:rgba(255,255,255,.5);margin:4px 0 14px">'+matchName+'</div>';
  h+='<div style="display:flex;justify-content:center;gap:24px;margin-bottom:12px">';
  h+='<div style="text-align:center"><div style="font-size:24px;font-weight:900;color:'+(isWin?ri.color:'#fff')+'">#'+rankPos+'</div><div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px">Rank</div></div>';
  h+='<div style="width:1px;background:rgba(255,255,255,.08)"></div>';
  h+='<div style="text-align:center"><div style="font-size:24px;font-weight:900;color:#ff6b6b">'+kills+'</div><div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px">Kills</div></div>';
  h+='<div style="width:1px;background:rgba(255,255,255,.08)"></div>';
  h+='<div style="text-align:center"><div style="font-size:14px;font-weight:900;color:'+ri.color+'">'+ri.emoji+' '+ri.badge+'</div><div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px">Rank Tier</div></div>';
  h+='</div>';
  h+='<div style="font-size:10px;color:rgba(0,255,156,.5);font-weight:700;letter-spacing:2px">MINI ESPORTS</div>';
  h+='</div></div>';
  /* Share buttons */
  var shareMsg = rankEmoji+' '+ign+' ne "'+matchName+'" mein #'+rankPos+' rank liya!\n💀 '+kills+' kills | '+ri.emoji+' '+ri.badge+'\n🎮 Mini eSports pe aao!\n#MinieSports #FreeFire';
  h+='<button onclick="window.openWhatsApp(\''+shareMsg.replace(/'/g,"\\'")+'\')" style="width:100%;padding:13px;border-radius:13px;border:none;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px"><i class="fab fa-whatsapp"></i> WhatsApp Share</button>';
  h+='<button onclick="window.showPlayerCard()" style="width:100%;padding:12px;border-radius:13px;border:1px solid var(--border);background:transparent;color:var(--txt);font-size:13px;font-weight:700;cursor:pointer">🃏 Full Player Card Dekho</button>';
  h+='</div>';
  openModal(isWin?'🎉 Result!':'😤 Better Luck',h);
  /* Bug #16 Fix: Removed duplicate coin award — admin-awarded prize is the only source.
     Giving coins here again caused double-crediting on result view. */
};

/* ── Helpers ── */
/* BUG #27 FIX (2026-07): was missing Platinum and Legend entirely (only had
   Bronze/Silver/Gold/Diamond) — now derives from the canonical rank system so this
   screen matches every other screen for the same player. */
function _pcRankInfo(pts){
  var t=(window.getRankTier?window.getRankTier(pts):{badge:'Bronze',emoji:'🏅',color:'#cd7f32',bg:'rgba(205,127,50,.12)'});
  return {badge:t.name||t.badge,emoji:t.emoji,color:t.color,bg:t.bg};
}
function _pcNextTier(pts){
  var tiers=[{min:0,max:300,next:'Silver',top:300},{min:301,max:600,next:'Gold',top:600},{min:601,max:1000,next:'Platinum',top:1000},{min:1001,max:1500,next:'Diamond',top:1500},{min:1501,max:2000,next:'Legend',top:2000}];
  for(var i=0;i<tiers.length;i++){
    var t=tiers[i];
    if(pts>=t.min&&pts<=t.max){
      var pct=Math.round((pts-t.min)/(t.top-t.min)*100);
      return {label:pts>=t.top?'MAX':'→ '+t.next+' ('+t.top+')',pct:pct};
    }
  }
  return {label:'Legend',pct:100};
}

/* ── Inject pill ── */
var _pci=0,_pct=setInterval(function(){
  _pci++; if(_pci>60){ clearInterval(_pct); return; }
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_pcPill')) return;
  clearInterval(_pct);
  var pill=document.createElement('div');
  pill.id='_pcPill'; pill.className='special-pill';
  pill.style.cssText='background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.25);color:#ffd700';
  pill.innerHTML='<i class="fas fa-id-card" style="font-size:11px"></i> My Card';
  pill.onclick=function(){ if(window.showPlayerCard) showPlayerCard(); };
  row.appendChild(pill);
},400);

})();
