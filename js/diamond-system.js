/* ════════════════════════════════════════════════════════════════════
   DIAMOND SYSTEM — R28j (2026-09-22) HALAL CURRENCY MODEL
   ─────────────────────────────────────────────────────────────────────
   Policy (admin DEVELOPER_GUIDE + live server RPCs से confirm):

   • Sky Diamonds   (users.sky_diamonds)   = खरीदी हुई in-app currency,
       sirf matches khelne ke liye. NON-REFUNDABLE — kabhi ₹ cash nahi.
   • Green Diamonds (users.green_diamonds) = match win का VIRTUAL prize,
       non-withdrawable (badge/status only).
   • Sponsored Winnings (users.sponsored_winnings) = SIRF yahi ₹
       withdrawable hain, aur sirf sponsored-tournament wins,
       admin-approve के बाद (submitSponsoredWd flow).

   ─────────────────────────────────────────────────────────────────────
   Is file ka purana roop ek legacy "diamond → ₹ cash nikal" system tha
   jo window.startWd, window._confirmDiamondWD aur ek "Diamond → ₹
   Conversion" card inject karta tha — Sky + Green diamonds ko jodkar
   "Withdrawable 💎84 → Aapko milega: ₹84" dikhata tha (TDS ke saath).

   Wo model policy ka seedha उल्लंघन tha:
     (1) Sky Diamonds non-refundable hain (buy-screen खुद "❌ Withdraw
         nahi hota" bolti hai),
     (2) Green Diamonds virtual hain,
     (3) server-side RPC submit_gd_withdrawal green_diamonds deduct
         karta tha — aisa koi REAL-money payout admin कभी approve नहीं
         karta (request_type green_diamond_withdrawal, 0 rows live).

   Isliye (R28j) puri cash-withdrawal machinery DISABLED कर दी गई —
   यह "feature delete" नहीं, FALSE-CLAIM removal है (user की standing
   नीति: बिक्री/withdraw कॉपी का झूठा दावा हटाओ या सच implement करो;
   real-money diamond withdrawal policy में banned है, isliye implement
   की जगह हटाया + सही path से जोड़ा)।

   असली withdraw path (जो अब काम करता है) =
     screens/wallet.js  startWd() → sponsored_winnings → submitSponsoredWd()
     (R5: SECDEF RPC submit_sponsored_withdrawal — server balance/dup-guard
     verify karke EXPLICIT status='pending' row; admin resolve_sponsored_withdrawal
     se approve/reject).

   Native render/update पहले से सही:
     • screens/wallet.js renderWallet() — Sky=deposited, Green=
       #greenDiaCount, sponsoredPrizeCard toggle, history+filter tabs.
     • core/header.js    updateHdr()   — coins + sky_diamonds (#hdrMoney)
       + greenDiamonds (#hdrGD).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  /* Tiny public format helpers — banaye rakhe hain taaki koi bhi purana
     caller / dynamic onclick / future feature undefined na paaye.
     Ab inka koi cash-conversion meaning nahi hota. */
  window.fmtDiamond = function (val) { return '💎 ' + (Number(val) || 0); };
  window.fmtRupee   = function (val) { return '₹' + (Number(val) || 0); };

  /* NOTE: window.startWd / window.renderWallet / window.updateHdr /
     window._confirmDiamondWD ko ab override NAHIN kiya jaata —
     screens/wallet.js + core/header.js ke native (policy-sahi)
     implementations hi chalti hain. */

  console.log('[Mini eSports] ✅ Diamond System (halal) loaded — no cash withdrawal');
})();
