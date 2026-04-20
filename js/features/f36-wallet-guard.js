/* FEATURE 36: Wallet Balance Guard
   Before join — checks balance. If low → beautiful alert with top-up shortcut. */
(function(){
'use strict';
function check(fee,isCoin,cb){
  if(!window.UD){ cb(true); return; }
  var bal=isCoin?(window.UD.coins||0):((window.UD.realMoney||{}).balance||(window.UD.walletBalance)||0);
  if(bal>=fee){ cb(true); return; }
  showAlert(isCoin,fee-bal); cb(false);
}
function showAlert(isCoin,short){
  if(!window.openModal) return;
  var h='<div style="text-align:center;padding:8px">'
    +'<div style="font-size:48px;margin-bottom:8px">'+(isCoin?'🪙':'💸')+'</div>'
    +'<div style="font-size:16px;font-weight:800;margin-bottom:4px">'+(isCoin?'Coins Kam Hain!':'Balance Kam Hai!')+'</div>'
    +'<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">'+(isCoin?short+' coins aur chahiye':'₹'+short+' aur chahiye')+' is match ke liye</div>'
    +(isCoin
      ?'<button onclick="if(window.navTo)navTo(\'profile\');if(window.closeModal)closeModal()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-weight:800;border:none;cursor:pointer;margin-bottom:8px">🪙 Coins Kharido</button>'
      :'<button onclick="if(window.navTo)navTo(\'wallet\');if(window.closeModal)closeModal()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;border:none;cursor:pointer;margin-bottom:8px">💰 Wallet Top-Up</button>'
    )
    +'<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:10px;border-radius:12px;background:transparent;border:1px solid var(--border);color:var(--txt2);font-size:13px;cursor:pointer">Cancel</button></div>';
  window.openModal((isCoin?'🪙':'💰')+' Insufficient Balance',h);
}
window.f36Wallet={check:check,showAlert:showAlert};
})();
