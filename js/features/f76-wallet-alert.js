/* =============================================
   FEATURE 31: Low Wallet Alert + Quick Top-Up Prompt
   - Jab user join karna chaahe aur balance low ho
   - Smart alert with UPI deep link shortcut
   ============================================= */
(function() {
  'use strict';

  function checkBeforeJoin(entryFee, isCoin, callback) {
    if (!window.UD) { callback(true); return; }
    var rm = window.UD.realMoney || {};
    var coins = window.UD.coins || 0;

    if (isCoin) {
      if (coins >= entryFee) { callback(true); return; }
      showLowAlert('coin', entryFee - coins, entryFee);
      callback(false);
    } else {
      var balance = (rm.deposited||0) + (rm.winnings||0) + (rm.bonus||0);
      if (balance >= entryFee) { callback(true); return; }
      showLowAlert('money', entryFee - balance, entryFee);
      callback(false);
    }
  }

  function showLowAlert(type, shortfall, fee) {
    if (!window.openModal) return;
    var isCoin = type === 'coin';
    var h = '<div style="text-align:center;padding:8px">' +
      '<div style="font-size:48px;margin-bottom:8px">' + (isCoin ? '🪙' : '💸') + '</div>' +
      '<div style="font-size:16px;font-weight:800;margin-bottom:4px">' + (isCoin ? 'Coins Kam Hain!' : 'Balance Kam Hai!') + '</div>' +
      '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">' +
        (isCoin ? shortfall + ' coins aur chahiye' : '₹' + shortfall + ' aur chahiye') + ' is match ke liye' +
      '</div>' +
      (isCoin
        ? '<button onclick="if(window.navTo)navTo(\'profile\');if(window.closeModal)closeModal()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-weight:800;border:none;cursor:pointer;margin-bottom:8px">🪙 Coins Kharido</button>'
        : '<button onclick="if(window.navTo)navTo(\'wallet\');if(window.closeModal)closeModal()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;border:none;cursor:pointer;margin-bottom:8px">💰 Wallet Top-Up Karo</button>'
      ) +
      '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:10px;border-radius:12px;background:transparent;border:1px solid var(--border);color:var(--txt2);font-size:13px;cursor:pointer">Cancel</button>' +
    '</div>';
    window.openModal((isCoin ? '🪙' : '💰') + ' Insufficient Balance', h);
  }

  window.f31WalletAlert = { check: checkBeforeJoin, showAlert: showLowAlert };
})();
