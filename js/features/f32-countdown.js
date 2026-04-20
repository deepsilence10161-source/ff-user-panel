/* FEATURE 32: Live Countdown Timer on Every Match Card
   data-match-time attribute pe auto-updates every 30s. Color shifts urgency. */
(function(){
'use strict';
function cd(mt){
  var d=Number(mt)-Date.now();
  if(d<=0) return {txt:'🔴 Starting!',clr:'#ff4500',bold:true};
  var h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000),s=Math.floor((d%60000)/1000);
  if(d<5*60*1000)  return {txt:'⚡'+m+'m '+s+'s',clr:'#ff4500',bold:true};
  if(d<30*60*1000) return {txt:'⏰'+m+' min',clr:'#ffaa00',bold:false};
  if(d<2*3600000)  return {txt:'⏰'+h+'h '+m+'m',clr:'#ffd700',bold:false};
  return {txt:'⏰'+h+'h '+m+'m',clr:'var(--txt2)',bold:false};
}
function upd(){
  document.querySelectorAll('[data-match-time]').forEach(function(el){
    var c=cd(el.getAttribute('data-match-time'));
    el.textContent=c.txt; el.style.color=c.clr; el.style.fontWeight=c.bold?'800':'500';
  });
}
setInterval(upd,30000); setTimeout(upd,800);
window.f32={update:upd,get:cd};
window.startMatchTimers=function(){ setTimeout(upd,200); };
})();
