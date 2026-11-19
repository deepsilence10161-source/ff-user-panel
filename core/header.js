/* ====== UPDATE HEADER ====== */
/* D103 UI z45: 6-digit values par header chips clip na hon — compact format */
function fmtCompact(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e5) return Math.round(n / 1e3) + 'K';
  return String(n);
}
function updateHdr() {
  if (!UD) return;
  var coins = Number(UD.coins) || 0;
  /* R28j (2026-09-22): hdrMoney chip 💎 = Sky Diamonds (sirf deposited/
     purchased). Pehle getMoneyBal() = deposited+winnings+bonus sab जोड़
     देता था, isliye Sky-Diamond chip par Green-Diamond + bonus मिलाकर
     ग़लत नंबर दिखता था (Green Diamonds ka apna #hdrGD chip अलग है)। */
  var money = Math.max(Number(UD.skyDiamonds) || 0, 0);
  var hc = $('hdrCoins'), hm = $('hdrMoney');
  if (hc) {
    var oldC = Number(hc.getAttribute('data-raw')) || 0;
    hc.textContent = fmtCompact(coins);
    hc.setAttribute('data-raw', coins);
    if (coins !== oldC && oldC > 0) {
      hc.parentElement.style.animation = 'none';
      hc.parentElement.offsetHeight;
      hc.parentElement.style.animation = 'pulse 0.5s ease';
    }
  }
  if (hm) {
    var oldM = Number(hm.getAttribute('data-raw')) || 0;
    hm.textContent = fmtCompact(parseFloat(money.toFixed(2)));
    hm.setAttribute('data-raw', money);
    if (money !== oldM && oldM > 0) {
      hm.parentElement.style.animation = 'none';
      hm.parentElement.offsetHeight;
      hm.parentElement.style.animation = 'pulse 0.5s ease';
    }
  }
  /* Green Diamond header chip */
  var hgd = $('hdrGD');
  if (hgd) {
    var gd = Math.max(Number(UD.greenDiamonds) || 0, 0);
    hgd.textContent = fmtCompact(gd);
  }
}

/* ====== BELL ====== */
function updateBell() {
  var dot = $('bellDot'); if (!dot) return;
  var unread = 0;
  var rd = (UD && UD.readNotifications) || {};
  // Count ALL notifications — unread = not in _READ_KEYS, not in Firebase readNotifications, not locally marked
  NOTIFS.forEach(function(n) {
    if (!_READ_KEYS[n._key] && !rd[n._key] && !n._localRead) unread++;
  });
  if (unread > 0) {
    dot.style.display = 'block';
    if (unread > 3) {
      // Show number for 4+ unread
      dot.style.cssText = 'display:flex;align-items:center;justify-content:center;min-width:15px;height:15px;padding:0 3px;border-radius:8px;background:#ff4444;color:#fff;font-size:9px;font-weight:800;position:absolute;top:-3px;right:-3px;z-index:10;';
      dot.textContent = unread > 9 ? '9+' : unread;
    } else {
      // Just a small dot for 1-3 unread
      dot.style.cssText = 'display:block;width:8px;height:8px;border-radius:50%;background:#ff4444;position:absolute;top:-1px;right:-1px;z-index:10;';
      dot.textContent = '';
    }
  } else {
    dot.style.display = 'none';
    dot.textContent = '';
  }
}

