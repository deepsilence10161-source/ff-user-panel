/* ================================================================
   TOURNAMENT BRACKET v2.0 — 100% Supabase
   Table: tournament_brackets(id,name,format,status,team_count,teams,rounds,champion,prize)
================================================================ */
(function(){ 'use strict';
function _s(){ return window._supa; }
function _uid(){ return window.U&&window.U.uid; }

window.showBracket=function(tournamentId,tournamentName){
  if(!tournamentId){ _showBracketPicker(); return; }
  openModal('🏆 '+(tournamentName||'Bracket'),'<div id="brkContent"><div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div></div>');
  _loadBracket(tournamentId);
};

function _showBracketPicker(){
  openModal('🏆 Tournament Brackets','<div id="brkPickContent"><div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div></div>');
  if(!_s()){document.getElementById('brkPickContent').innerHTML='<p style="color:#ff6b6b;text-align:center">Service unavailable</p>';return;}
  _s().from('tournament_brackets').select('id,name,format,team_count,status').order('created_at',{ascending:false}).limit(10)
  .then(function(r){
    var list=r.data||[];var pc=document.getElementById('brkPickContent');if(!pc)return;
    if(!list.length){pc.innerHTML='<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:36px;opacity:.3">🏆</div><p>Koi bracket available nahi</p></div>';return;}
    var statusColor={live:'var(--green)',upcoming:'#ffd700',finished:'var(--txt2)'};
    var h='<div style="display:flex;flex-direction:column;gap:8px">';
    list.forEach(function(t){
      var sc=statusColor[t.status||'upcoming']||'var(--txt2)';
      h+='<div onclick="showBracket(\''+t.id+'\',\''+(t.name||'Tournament').replace(/'/g,"\\'")+'\')" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:13px;background:var(--card);border:1px solid var(--border);cursor:pointer">';
      h+='<div style="font-size:28px">'+(t.status==='live'?'🔴':'🏆')+'</div>';
      h+='<div style="flex:1"><div style="font-size:14px;font-weight:800">'+(t.name||'Tournament')+'</div><div style="font-size:11px;color:var(--txt2)">'+(t.team_count||0)+' teams · '+(t.format||'Single Elimination')+'</div></div>';
      h+='<div style="text-align:right"><div style="font-size:11px;font-weight:700;color:'+sc+'">'+(t.status||'upcoming').toUpperCase()+'</div><i class="fas fa-chevron-right" style="font-size:12px;color:var(--txt2)"></i></div></div>';
    });
    h+='</div>';pc.innerHTML=h;
  }).catch(function(){var pc=document.getElementById('brkPickContent');if(pc)pc.innerHTML='<div style="color:#ff6b6b;text-align:center">Error loading brackets</div>';});
}

function _loadBracket(tid){
  if(!_s())return;
  _s().from('tournament_brackets').select('*').eq('id',tid).single()
  .then(function(r){
    var c=document.getElementById('brkContent');if(!c)return;
    var data=r.data;
    if(!data||!data.rounds){c.innerHTML='<div style="text-align:center;padding:30px;color:var(--txt2)">Bracket data available nahi abhi</div>';return;}
    var rounds=typeof data.rounds==='string'?JSON.parse(data.rounds):data.rounds;
    data.rounds=rounds;
    _renderBracket(c,data);
  }).catch(function(){var c=document.getElementById('brkContent');if(c)c.innerHTML='<div style="color:#ff6b6b;text-align:center;padding:20px">Error loading bracket</div>';});
}

function _renderBracket(c, data) {
  /* Issue #34 Fix: Validate bracket structure before attempting to render */
  if (!data || !data.rounds || !Array.isArray(data.rounds)) {
    c.innerHTML = '<div class="empty-state" style="text-align:center;padding:20px;color:var(--txt2)">⚠️ Invalid bracket data — koi rounds nahi milai</div>';
    return;
  }
  for (var vi = 0; vi < data.rounds.length; vi++) {
    if (!data.rounds[vi] || !Array.isArray(data.rounds[vi].matches)) {
      c.innerHTML = '<div class="empty-state" style="text-align:center;padding:20px;color:var(--txt2)">⚠️ Invalid round data at position ' + vi + '</div>';
      return;
    }
  }
  var rounds=data.rounds||[];
  var myIgn=window.UD&&(window.UD.ign||window.UD.displayName)||'';
  var sc={live:'var(--green)',upcoming:'#ffd700',finished:'var(--txt2)'}[data.status||'']||'var(--txt2)';
  var h='<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between"><div style="font-size:12px;color:var(--txt2)">Format: <strong style="color:var(--txt)">'+(data.format||'Single Elimination')+'</strong></div><div style="font-size:12px;font-weight:700;color:'+sc+'">'+(data.status||'Upcoming').toUpperCase()+'</div></div>';
  if(data.prize)h+='<div style="font-size:12px;color:#ffd700;margin-top:3px">🏆 Prize: '+data.prize+'</div></div>';
  h+='<div style="overflow-x:auto;padding-bottom:10px"><div style="display:flex;gap:0;min-width:'+Math.max(320,rounds.length*160)+'px">';
  rounds.forEach(function(round,ri){
    var topPad=ri===0?0:Math.pow(2,ri)*20;var betGap=Math.max(16,Math.pow(2,ri+1)*20);
    h+='<div style="flex:1;min-width:140px">';
    h+='<div style="text-align:center;padding:6px 8px;font-size:11px;font-weight:800;color:var(--txt2);border-bottom:1px solid var(--border);margin-bottom:8px;background:rgba(255,255,255,.02);border-radius:8px 8px 0 0">'+(round.name||'Round '+(ri+1))+'</div>';
    h+='<div style="display:flex;flex-direction:column;gap:'+betGap+'px;padding-top:'+topPad+'px">';
    (round.matches||[]).forEach(function(match){
      var t1=match.team1||{name:'TBD',score:0},t2=match.team2||{name:'TBD',score:0};
      var myMatch=t1.name===myIgn||t2.name===myIgn;
      h+='<div style="border:1.5px solid '+(myMatch?'rgba(0,255,156,.4)':'var(--border)')+';border-radius:10px;overflow:hidden">';
      h+=_slot(t1.name,t1.score,match.winner==='team1',t1.name===myIgn,!match.winner);
      h+='<div style="height:1px;background:var(--border)"></div>';
      h+=_slot(t2.name,t2.score,match.winner==='team2',t2.name===myIgn,!match.winner);
      h+='</div>';
    });
    h+='</div></div>';
  });
  if(data.champion){
    h+='<div style="min-width:120px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;padding:0 12px"><div style="font-size:32px">🏆</div><div style="font-size:13px;font-weight:900;color:#ffd700;text-align:center">'+data.champion+'</div><div style="font-size:10px;color:var(--txt2)">CHAMPION</div></div>';
  }
  h+='</div></div>';
  c.innerHTML=h;
}

function _slot(name,score,isWin,isMe,pending){
  return'<div style="display:flex;align-items:center;padding:8px 10px;background:'+(isWin?'rgba(0,255,156,.08)':pending?'transparent':'rgba(255,107,107,.04)')+';min-height:32px"><span style="flex:1;font-size:12px;font-weight:'+(isMe?800:600)+';color:'+(isWin?'var(--green)':isMe?'#00d4ff':'var(--txt)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+'</span>'+(isWin||!pending?'<span style="font-size:13px;font-weight:900;color:'+(isWin?'var(--green)':'rgba(255,255,255,.3)')+'">'+score+'</span>':'')+(isWin?'<span style="margin-left:4px;font-size:10px">✅</span>':'')+'</div>';
}

// Pill injection
var _i=0,_t=setInterval(function(){
  _i++;if(_i>60){clearInterval(_t);return;}
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_brkPill')){if(row)clearInterval(_t);return;}
  clearInterval(_t);
  var p=document.createElement('div');p.id='_brkPill';p.className='special-pill';
  p.style.cssText='background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);color:#ffd700';
  p.innerHTML='<i class="fas fa-sitemap" style="font-size:11px"></i> Bracket';
  p.onclick=function(){if(window.showBracket)showBracket();};
  row.appendChild(p);
},400);
})();
