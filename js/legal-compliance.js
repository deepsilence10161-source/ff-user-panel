/* ================================================================
   MINI eSPORTS — LEGAL COMPLIANCE SYSTEM v3.0
   India / Haryana / Panipat — Section 194BA TDS Compliant
   All modals use app's native openModal — no XHR fetch
   ================================================================ */
(function () {
  'use strict';

  var THRESHOLDS = {
    monthlyPayout: 500000,
    totalUsers: 5000,
    singleWinning: 50000
  };

  var CONFIG = {
    appName: 'Mini eSports',
    grievanceEmail: 'grievance@miniesports.in',
    supportEmail: 'support@miniesports.in',
    address: 'Panipat, Haryana — 132103, India',
    grievanceOfficerName: 'Platform Owner',
    tcVersion: '3.0',
    bannedStates: ['Telangana', 'Andhra Pradesh', 'Tamil Nadu']
  };

  /* === Modal helpers === */
  function _open(title, html) {
    if (window.openModal) { window.openModal(title, html); return; }
    // fallback
    var ov = document.getElementById('_lc_modal'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = '_lc_modal';
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;align-items:flex-end;justify-content:center';
    ov.innerHTML = '<div style="background:#0d0d12;border-radius:20px 20px 0 0;padding:22px 18px 36px;width:100%;max-width:480px;max-height:92vh;overflow-y:auto"><div style="font-size:17px;font-weight:900;color:#e8e8f0;margin-bottom:14px">' + title + '</div>' + html + '<button onclick="document.getElementById(\'_lc_modal\').remove()" style="margin-top:16px;width:100%;padding:12px;border-radius:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#aaa;font-weight:700;cursor:pointer">Close</button></div>';
    document.body.appendChild(ov);
  }
  function _close() {
    if (window.closeModal) { window.closeModal(); return; }
    var m = document.getElementById('_lc_modal'); if (m) m.remove();
  }
  function _toast(msg, type) {
    if (window.toast) { window.toast(msg, type || 'ok'); return; }
    alert(msg);
  }
  function _btn(label, color, bg, border, fn) {
    return '<button onclick="' + fn + '" style="padding:12px 16px;border-radius:11px;background:' + bg + ';border:1px solid ' + border + ';color:' + color + ';font-size:13px;font-weight:800;cursor:pointer;width:100%;margin-bottom:8px;text-align:left">' + label + '</button>';
  }

  /* ═══════════════════════════════════════
     1. STATE CHECK
  ═══════════════════════════════════════ */
  window.mesCheckState = function () {
    if (sessionStorage.getItem('_mes_state')) return;
    var h = '<div style="text-align:center"><div style="font-size:42px;margin-bottom:10px">🗺️</div>'
      + '<div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:8px">State Verification</div>'
      + '<div style="font-size:12px;color:#8888aa;margin-bottom:16px">Real money gaming kuch states mein restricted hai. Apna state select karo:</div>'
      + '<div style="display:grid;gap:8px;margin-bottom:12px">';
    CONFIG.bannedStates.forEach(function(s) {
      h += '<button onclick="window.mesStateBan()" style="padding:11px;border-radius:10px;background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.25);color:#ff6b6b;font-size:13px;font-weight:700;cursor:pointer;width:100%">' + s + '</button>';
    });
    h += '<button onclick="window.mesStateOk()" style="padding:11px;border-radius:10px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.25);color:#00ff9c;font-size:13px;font-weight:700;cursor:pointer;width:100%">✓ Haryana / Delhi / Punjab / Other</button>'
      + '</div><div style="font-size:10px;color:#555">IT Rules 2023 compliance ke liye zaroori</div></div>';
    _open('🗺️ State Verification Required', h);
  };
  window.mesStateBan = function () {
    _close();
    document.body.innerHTML = '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#050507;color:#fff;padding:32px;text-align:center"><div style="font-size:56px;margin-bottom:16px">🚫</div><div style="font-size:20px;font-weight:900;color:#ff6b6b;margin-bottom:10px">Service Unavailable</div><div style="font-size:13px;color:#888;line-height:1.9;max-width:300px">Aapke state mein real money gaming legally restricted hai.</div></div>';
  };
  window.mesStateOk = function () { sessionStorage.setItem('_mes_state','1'); _close(); setTimeout(window.mesAgeGate, 400); };

  /* ═══════════════════════════════════════
     2. AGE GATE 18+
  ═══════════════════════════════════════ */
  window.mesAgeGate = function () {
    if (!window.U || !window.db) return;
    window.db.ref('users/'+window.U.uid+'/ageVerified').once('value', function(s) {
      if (s.val() === true) { _runNext('age'); return; }
      var mx = new Date(); mx.setFullYear(mx.getFullYear()-18);
      var mxs = mx.toISOString().split('T')[0];
      var h = '<div style="text-align:center">'
        + '<div style="font-size:44px;margin-bottom:10px">🔞</div>'
        + '<div style="font-size:15px;font-weight:900;margin-bottom:6px">Age Verification</div>'
        + '<div style="font-size:12px;color:#8888aa;margin-bottom:16px">Mini eSports sirf <strong style="color:#fff">18+</strong> ke liye hai</div>'
        + '<input type="date" id="_mes_dob" max="'+mxs+'" style="width:100%;padding:12px;border-radius:10px;background:#1a1a22;border:1px solid rgba(255,255,255,.15);color:#e8e8f0;font-size:14px;box-sizing:border-box;margin-bottom:12px">'
        + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:16px">'
        + '<input type="checkbox" id="_mes_age_cbx" style="margin-top:3px;accent-color:#00ff9c;flex-shrink:0">'
        + '<label for="_mes_age_cbx" style="font-size:12px;color:#8888aa">Main confirm karta/karti hoon ki meri umar 18+ hai</label></div>'
        + '<button onclick="window.mesConfirmAge()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:900;font-size:14px;border:none;cursor:pointer;margin-bottom:8px">✓ Confirm — Main 18+ Hoon</button>'
        + '<button onclick="window.mesAgeUnder18()" style="width:100%;padding:10px;border-radius:12px;background:transparent;border:1px solid rgba(255,107,107,.3);color:#ff6b6b;font-size:12px;font-weight:700;cursor:pointer">Nahi, main 18 se chhota hoon</button></div>';
      _open('🔞 Age Verification', h);
    });
  };
  window.mesConfirmAge = function () {
    var dob = (document.getElementById('_mes_dob')||{}).value;
    var cbx = (document.getElementById('_mes_age_cbx')||{}).checked;
    if (!dob) { _toast('Date of birth enter karo','err'); return; }
    if (!cbx) { _toast('Checkbox tick karo','err'); return; }
    var bd=new Date(dob), nd=new Date();
    var age = nd.getFullYear()-bd.getFullYear() - ((nd.getMonth()<bd.getMonth()||(nd.getMonth()===bd.getMonth()&&nd.getDate()<bd.getDate()))?1:0);
    if (age < 18) { window.mesAgeUnder18(); return; }
    window.db.ref('users/'+window.U.uid).update({ageVerified:true,dateOfBirth:dob,ageVerifiedAt:Date.now()});
    _close(); _toast('Age verified! ✓','ok');
    setTimeout(function(){ _runNext('age'); }, 500);
  };
  window.mesAgeUnder18 = function () {
    _close();
    if (window.firebase && window.firebase.auth) window.firebase.auth().signOut();
    document.body.innerHTML = '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#050507;color:#fff;padding:32px;text-align:center"><div style="font-size:56px;margin-bottom:16px">🔞</div><div style="font-size:20px;font-weight:900;color:#ff6b6b;margin-bottom:10px">18+ Only</div></div>';
  };

  /* ═══════════════════════════════════════
     3. TERMS & CONDITIONS
  ═══════════════════════════════════════ */
  window.mesShowTerms = function () {
    var h = '<div style="font-size:12px;color:#8888aa;line-height:1.9">'
      + '<p style="color:#00d4ff;font-weight:900;font-size:14px;margin-bottom:12px">Mini eSports — Terms & Conditions</p>'
      + '<p><strong style="color:#fff">1. Skill-Based Platform:</strong> Sabhi tournaments games of skill hain. Gambling nahi. Match result player ki ability, strategy aur performance par depend karta hai.</p>'
      + '<p><strong style="color:#fff">2. Eligibility:</strong> Sirf 18 saal ya zyada umar ke Indian residents. Telangana, Andhra Pradesh, Tamil Nadu ke users paid tournaments mein participate nahi kar sakte.</p>'
      + '<p><strong style="color:#fff">3. One Account:</strong> Ek user = sirf ek account. Multiple accounts = permanent ban.</p>'
      + '<p><strong style="color:#fff">4. Third-Party Disclaimer:</strong> Mini eSports ka Garena/Free Fire se koi affiliation nahi. Hum sirf tournament organize karte hain. Game server issues ke liye hum liable nahi.</p>'
      + '<p><strong style="color:#fff">5. Entry Fees:</strong> Match start hone ke baad non-refundable. Platform match cancel kare to full refund milega.</p>'
      + '<p><strong style="color:#fff">6. Coins:</strong> Virtual currency — real money mein convert nahi hoti. Coin purchases non-refundable.</p>'
      + '<p><strong style="color:#fff">7. KYC:</strong> Rs.500+ withdrawal ke liye PAN card mandatory (IT Rules 2023). Ek PAN = ek account.</p>'
      + '<p><strong style="color:#fff">8. Tax (Section 194BA):</strong> Gaming winnings taxable income hain. Jab platform thresholds cross kare tab 30% TDS auto-deduct hoga. Abhi testing phase — user khud ITR declare kare.</p>'
      + '<p><strong style="color:#fff">9. Anti-Cheat:</strong> Cheating, hacking, fake screenshots, multiple accounts, VPN bypass = permanent ban + legal action.</p>'
      + '<p><strong style="color:#fff">10. Liability:</strong> Server errors, game crashes, internet failure ke liye platform liable nahi. Max liability = deposited amount.</p>'
      + '<p><strong style="color:#fff">11. Responsible Gaming:</strong> Sirf woh amount invest karo jo afford kar sako. Self-exclusion feature available hai. iCall: 9152987821.</p>'
      + '<p><strong style="color:#fff">12. Jurisdiction:</strong> Panipat, Haryana courts. Disputes: Arbitration & Conciliation Act 1996.</p>'
      + '<p><strong style="color:#fff">13. Grievance Officer:</strong> Platform Owner | grievance@miniesports.in | Panipat, Haryana. Response: 24hr ack, 15 days resolution.</p>'
      + '<p style="font-size:10px;color:#555;margin-top:12px">IT Act 2000 | IT Rules 2021 | Income Tax Act 1961 | Last Updated: 2025</p>'
      + '</div>';
    _open('📋 Terms & Conditions', h);
  };

  /* ═══════════════════════════════════════
     4. PRIVACY POLICY
  ═══════════════════════════════════════ */
  window.mesShowPrivacy = function () {
    var tdsActive = false;
    function _renderPrivacy(active) {
      var taxSection = active
        ? '<p><strong style="color:#ff6b6b">TDS ACTIVE (Section 194BA):</strong> Platform withdrawal pe 30% TDS deduct karta hai aur govt ko deposit karta hai. Deduction Form 26AS mein reflect hoga. ITR file karna user ki zimmedari hai.</p>'
        : '<p><strong style="color:#ffd700">Testing Phase — TDS:</strong> Abhi TDS deduct nahi ho raha. Lekin gaming winnings taxable hain — user khud ITR mein declare kare. Thresholds cross hone par 30% TDS auto-on hoga.</p>';
      var h = '<div style="font-size:12px;color:#8888aa;line-height:1.9">'
        + '<p style="color:#00d4ff;font-weight:900;font-size:14px;margin-bottom:12px">Mini eSports — Privacy Policy</p>'
        + '<p><strong style="color:#fff">Platform:</strong> Mini eSports, Panipat, Haryana 132103. IT Act 2000 & IT Rules 2021 compliant.</p>'
        + '<p><strong style="color:#fff">18+ Only:</strong> Hum jaante bujhe 18 se kum umar ke users ka data collect nahi karte.</p>'
        + '<p><strong style="color:#fff">Data Collected:</strong> Mobile/email, IGN, Free Fire UID, device info, UPI ID (withdrawal ke liye), PAN number, Aadhaar last 4 digits (KYC ke liye).</p>'
        + '<p><strong style="color:#fff">Financial Records:</strong> Har withdrawal, prize, entry fee ka record tax compliance ke liye maintain hota hai. Account delete hone ke baad 7 saal tak store (IT Act requirement).</p>'
        + taxSection
        + '<p><strong style="color:#fff">KYC Data:</strong> PAN securely stored, sirf admin access. Aadhaar last 4 digits only. Ek PAN = ek account.</p>'
        + '<p><strong style="color:#fff">Data Sharing:</strong> Sirf legal requirement ya govt authority pe. Hum aapka data advertiser ko NAHI beche.</p>'
        + '<p><strong style="color:#fff">Security:</strong> Firebase + HTTPS. Security breach hogi to 72 ghante mein notify karenge.</p>'
        + '<p><strong style="color:#fff">State Restrictions:</strong> Telangana, AP, Tamil Nadu ke users automatically block hain.</p>'
        + '<p><strong style="color:#fff">Your Rights:</strong> Access, correction, deletion ka right. Financial records 7 saal retention required.</p>'
        + '<p><strong style="color:#fff">Grievance Officer:</strong> Platform Owner | grievance@miniesports.in | 24hr acknowledgement, 15 days resolution.</p>'
        + '<p style="font-size:10px;color:#555;margin-top:12px">IT Act 2000 | IT Rules 2021 | Last Updated: 2025</p>'
        + '</div>';
      _open('🛡️ Privacy Policy', h);
    }
    if (window.db) {
      window.db.ref('appSettings/tdsConfig').once('value', function(s) {
        _renderPrivacy((s.val()||{}).active === true);
      }).catch(function(){ _renderPrivacy(false); });
    } else { _renderPrivacy(false); }
  };

  /* ═══════════════════════════════════════
     5. T&C CONSENT (first-time popup)
  ═══════════════════════════════════════ */
  function _showTC(uid) {
    var h = '<div>'
      + '<div style="background:#111118;border-radius:10px;padding:14px;font-size:12px;color:#8888aa;line-height:1.85;max-height:200px;overflow-y:auto;margin-bottom:14px;border:1px solid rgba(255,255,255,.06)">'
      + '<strong style="color:#fff">Mini eSports Terms (Summary):</strong><br><br>'
      + '• Skill-based esports platform — gambling nahi<br>'
      + '• Sirf 18+ users | TN/AP/Telangana restricted<br>'
      + '• Entry fees non-refundable (match cancel hone pe refund)<br>'
      + '• Coins real money mein convert nahi hoti<br>'
      + '• Rs.500+ withdrawal ke liye KYC mandatory<br>'
      + '• Gaming winnings taxable income hain (ITR declare karein)<br>'
      + '• Cheating = permanent ban<br>'
      + '• Not affiliated with Garena/Free Fire<br><br>'
      + '<span onclick="window.mesShowTerms&&mesShowTerms()" style="color:#00d4ff;cursor:pointer;text-decoration:underline">Full Terms</span>'
      + ' &nbsp; '
      + '<span onclick="window.mesShowPrivacy&&mesShowPrivacy()" style="color:#00d4ff;cursor:pointer;text-decoration:underline">Privacy Policy</span>'
      + '</div>'
      + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">'
      + '<input type="checkbox" id="_mes_tc1" style="margin-top:3px;accent-color:#00ff9c;flex-shrink:0">'
      + '<label for="_mes_tc1" style="font-size:12px;color:#8888aa">Main Terms & Conditions aur Privacy Policy se agree karta hoon</label></div>'
      + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:18px">'
      + '<input type="checkbox" id="_mes_tc2" style="margin-top:3px;accent-color:#00ff9c;flex-shrink:0">'
      + '<label for="_mes_tc2" style="font-size:12px;color:#8888aa">Main samajhta hoon ki gaming winnings taxable income hain aur mujhe ITR file karni hogi</label></div>'
      + '<button onclick="window.mesAcceptTC(\''+uid+'\')" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#000;font-weight:900;font-size:14px;border:none;cursor:pointer">✓ Accept & Continue</button>'
      + '</div>';
    _open('📋 Terms & Conditions', h);
  }
  window.mesAcceptTC = function (uid) {
    var c1=(document.getElementById('_mes_tc1')||{}).checked;
    var c2=(document.getElementById('_mes_tc2')||{}).checked;
    if (!c1||!c2) { _toast('Dono checkboxes tick karo','err'); return; }
    window.db.ref('users/'+uid).update({tcAccepted:true,tcAcceptedAt:Date.now(),tcVersion:CONFIG.tcVersion});
    _close(); _toast('Welcome to Mini eSports! ✓','ok');
  };

  /* ═══════════════════════════════════════
     6. KYC
  ═══════════════════════════════════════ */
  window.mesShowKYC = function () {
    if (!window.U||!window.UD) { _toast('Please login first','err'); return; }
    var kyc=window.UD.kyc||{}, uid=window.U.uid;
    if (kyc.status==='verified') { _toast('✓ KYC already verified!','ok'); return; }
    if (kyc.status==='pending') {
      _open('🪪 KYC Verification', '<div style="text-align:center;padding:20px"><div style="font-size:44px;margin-bottom:12px">⏳</div><div style="font-size:15px;font-weight:700;color:#ffaa00">KYC Under Review</div><div style="font-size:12px;color:#8888aa;margin-top:8px;line-height:1.7">Aapki KYC review mein hai.<br>24-48 hours mein verify hogi.</div></div>');
      return;
    }
    var h = '<div>'
      + '<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.15);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#8888aa">Rs.500+ withdrawal ke liye PAN mandatory (IT Rules 2023)</div>'
      + '<div style="margin-bottom:12px"><label style="font-size:12px;color:#8888aa;display:block;margin-bottom:6px">PAN Card Number *</label>'
      + '<input type="text" id="_mes_pan" placeholder="ABCDE1234F" maxlength="10" oninput="this.value=this.value.toUpperCase()" style="width:100%;padding:12px;border-radius:10px;background:#1a1a22;border:1px solid rgba(255,255,255,.12);color:#e8e8f0;font-size:15px;letter-spacing:2px;box-sizing:border-box"></div>'
      + '<div style="margin-bottom:12px"><label style="font-size:12px;color:#8888aa;display:block;margin-bottom:6px">Aadhaar Number *</label>'
      + '<input type="text" id="_mes_aadhaar" placeholder="123456789012" maxlength="12" style="width:100%;padding:12px;border-radius:10px;background:#1a1a22;border:1px solid rgba(255,255,255,.12);color:#e8e8f0;font-size:15px;letter-spacing:2px;box-sizing:border-box"></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;color:#8888aa;display:block;margin-bottom:6px">Full Name (as in PAN) *</label>'
      + '<input type="text" id="_mes_kycname" placeholder="RAHUL SHARMA" oninput="this.value=this.value.toUpperCase()" style="width:100%;padding:12px;border-radius:10px;background:#1a1a22;border:1px solid rgba(255,255,255,.12);color:#e8e8f0;font-size:14px;box-sizing:border-box"></div>'
      + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:16px">'
      + '<input type="checkbox" id="_mes_kyc_cbx" style="margin-top:3px;accent-color:#00ff9c;flex-shrink:0">'
      + '<label for="_mes_kyc_cbx" style="font-size:11px;color:#8888aa">Ye meri real identity hai. Galat info = ban + legal action</label></div>'
      + '<button onclick="window.mesSubmitKYC(\''+uid+'\')" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#b964ff,#8844cc);color:#fff;font-weight:900;font-size:14px;border:none;cursor:pointer">Submit KYC</button>'
      + '</div>';
    _open('🪪 KYC Verification', h);
  };
  window.mesSubmitKYC = function (uid) {
    var pan=((document.getElementById('_mes_pan')||{}).value||'').trim().toUpperCase();
    var aadhaar=((document.getElementById('_mes_aadhaar')||{}).value||'').replace(/\D/g,'');
    var name=((document.getElementById('_mes_kycname')||{}).value||'').trim();
    var cbx=(document.getElementById('_mes_kyc_cbx')||{}).checked;
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) { _toast('PAN format galat — example: ABCDE1234F','err'); return; }
    if (!/^\d{12}$/.test(aadhaar)) { _toast('Aadhaar 12 digits hona chahiye','err'); return; }
    if (name.length<3) { _toast('Full name enter karo','err'); return; }
    if (!cbx) { _toast('Checkbox tick karo','err'); return; }
    window.db.ref('users/'+uid+'/kyc').set({status:'pending',panFull:pan,panLast4:pan.slice(-4),aadhaarLast4:aadhaar.slice(-4),name:name,submittedAt:Date.now()});
    window.db.ref('kycRequests/'+uid).set({uid:uid,ign:(window.UD||{}).ign||'',pan:pan,aadhaarLast4:aadhaar.slice(-4),name:name,status:'pending',submittedAt:Date.now()});
    _close(); _toast('KYC submitted! 24-48 hrs mein verify hogi ✓','ok');
  };
  window.mesKYCGate = function (amt) {
    if (!window.UD) return false;
    var kyc=window.UD.kyc||{};
    if (Number(amt)>500 && kyc.status!=='verified') {
      var msg = kyc.status==='pending'
        ? '<div style="background:rgba(255,170,0,.08);border:1px solid rgba(255,170,0,.2);border-radius:10px;padding:12px;font-size:13px;color:#ffaa00;text-align:center">KYC review mein hai — 24-48 hrs</div>'
        : '<button onclick="window.closeModal&&closeModal();setTimeout(function(){window.mesShowKYC&&mesShowKYC()},200)" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#b964ff,#8844cc);color:#fff;font-weight:900;font-size:14px;border:none;cursor:pointer">KYC Complete Karo</button>';
      _open('🔒 KYC Required','<div style="text-align:center;padding:8px"><div style="font-size:40px;margin-bottom:10px">🔒</div><div style="font-size:16px;font-weight:700;margin-bottom:8px">KYC Required</div><div style="font-size:13px;color:#8888aa;margin-bottom:18px;line-height:1.6">Rs.500 se zyada withdraw ke liye KYC mandatory hai</div>'+msg+'</div>');
      return false;
    }
    return true;
  };

  /* ═══════════════════════════════════════
     7. TDS DISCLOSURE
  ═══════════════════════════════════════ */
  window.mesTDSDisclosure = function (amt, onConfirm) {
    if (!window.U||!window.db) { if (onConfirm) onConfirm(); return; }
    window.db.ref('appSettings/tdsConfig').once('value', function(cfgSnap) {
      var tdsActive=(cfgSnap.val()||{}).active===true;
      window.db.ref('users/'+window.U.uid+'/tds').once('value', function(snap) {
        var d=snap.val()||{};
        var won=Number(d.winningsCredited)||0, fees=Number(d.entryFeesPaid)||0;
        var net=Math.max(0,won-fees);
        var h='<div>';
        if (!tdsActive) {
          h+='<div style="background:rgba(0,255,156,.07);border:1px solid rgba(0,255,156,.2);border-radius:12px;padding:14px;margin-bottom:12px">'
            +'<div style="font-size:13px;font-weight:800;color:#00ff9c;margin-bottom:8px">Testing Phase — TDS Abhi Active Nahi</div>'
            +'<div style="font-size:12px;color:#ccc;line-height:1.8">Poora Rs.'+amt+' aapko milega.<br>Net winnings: Rs.'+net+' (Prizes Rs.'+won+' − Fees Rs.'+fees+')<br><br>Jab limits cross honge tab 30% TDS auto-on hoga.</div></div>';
        } else {
          var ded=Number(d.tdsDeducted)||0;
          var owed=Math.round(net*0.30);
          var tdsNow=Math.min(Math.max(0,owed-ded),amt);
          var gets=amt-tdsNow;
          h+='<div style="background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:14px;margin-bottom:12px">'
            +'<div style="font-size:13px;font-weight:800;color:#ffd700;margin-bottom:10px">TDS Deduction — Section 194BA</div>'
            +'<div style="font-size:12px;color:#ccc;line-height:2">'
            +'<div style="display:flex;justify-content:space-between"><span>Prizes Won:</span><span style="color:#00ff9c">Rs.'+won+'</span></div>'
            +'<div style="display:flex;justify-content:space-between"><span>Fees Paid:</span><span style="color:#ff6b6b">-Rs.'+fees+'</span></div>'
            +'<div style="display:flex;justify-content:space-between;font-weight:700"><span>Net Winnings:</span><span style="color:#ffd700">Rs.'+net+'</span></div>'
            +'<div style="display:flex;justify-content:space-between"><span>TDS @30%:</span><span style="color:#ffaa00">Rs.'+owed+'</span></div>'
            +'<div style="display:flex;justify-content:space-between"><span>Already Deducted:</span><span style="color:#00ff9c">-Rs.'+ded+'</span></div>'
            +'<div style="display:flex;justify-content:space-between;font-weight:900;border-top:1px solid rgba(255,255,255,.1);padding-top:6px;margin-top:4px"><span style="color:#fff">Is bar TDS:</span><span style="color:#ff6b6b;font-size:14px">Rs.'+tdsNow+'</span></div>'
            +'</div></div>'
            +'<div style="background:rgba(0,212,255,.07);border:1px solid rgba(0,212,255,.15);border-radius:10px;padding:12px;margin-bottom:12px">'
            +'<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:900"><span>Rs.'+amt+' request</span><span style="color:#00ff9c">Rs.'+gets+' UPI pe</span></div>'
            +'<div style="font-size:11px;color:#8888aa;margin-top:4px">Rs.'+tdsNow+' TDS govt ko — Form 26AS mein aayega</div></div>';
        }
        h+='<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:16px">'
          +'<input type="checkbox" id="_mes_tds_cbx" style="margin-top:3px;accent-color:#ffd700;flex-shrink:0">'
          +'<label for="_mes_tds_cbx" style="font-size:12px;color:#8888aa">Main samajhta hoon — gaming winnings taxable income hai</label></div>'
          +'<button onclick="window.mesTDSConfirm()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:900;font-size:14px;border:none;cursor:pointer">Samajh Gaya — Proceed ✓</button></div>';
        _open('💰 Tax Information', h);
        window._mes_tds_cb=onConfirm;
      });
    });
  };
  window.mesTDSConfirm = function () {
    if (!(document.getElementById('_mes_tds_cbx')||{}).checked) { _toast('Checkbox tick karo','err'); return; }
    _close(); if (window._mes_tds_cb) setTimeout(window._mes_tds_cb,200);
  };

  /* ═══════════════════════════════════════
     8. TDS SUMMARY
  ═══════════════════════════════════════ */
  window.mesTDSSummary = function () {
    if (!window.U||!window.db) { _toast('Please login first','err'); return; }
    window.db.ref('appSettings/tdsConfig').once('value', function(cfgSnap) {
      var tdsActive=(cfgSnap.val()||{}).active===true;
      window.db.ref('users/'+window.U.uid+'/tds').once('value', function(snap) {
        var d=snap.val()||{};
        var won=Number(d.winningsCredited)||0, fees=Number(d.entryFeesPaid)||0;
        var net=Math.max(0,won-fees), owed=Math.round(net*0.30), ded=Number(d.tdsDeducted)||0;
        var fy=(function(){var dt=new Date();return dt.getMonth()<3?(dt.getFullYear()-1)+'-'+dt.getFullYear():dt.getFullYear()+'-'+(dt.getFullYear()+1);})();
        var badge=tdsActive?'<span style="background:rgba(255,107,107,.2);color:#ff6b6b;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">TDS ACTIVE</span>':'<span style="background:rgba(0,255,156,.15);color:#00ff9c;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">TESTING PHASE</span>';
        var h='<div>'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div style="font-size:11px;color:#555">FY '+fy+'</div>'+badge+'</div>'
          +'<div style="background:#111118;border-radius:12px;padding:14px;margin-bottom:10px;font-size:12px;line-height:2;color:#8888aa">'
          +'<div style="display:flex;justify-content:space-between"><span>Total Prizes Won:</span><span style="color:#00ff9c;font-weight:700">Rs.'+won+'</span></div>'
          +'<div style="display:flex;justify-content:space-between"><span>Entry Fees Paid:</span><span style="color:#ff6b6b;font-weight:700">Rs.'+fees+'</span></div>'
          +'<div style="display:flex;justify-content:space-between;font-weight:900;border-top:1px solid rgba(255,255,255,.08);padding-top:8px;margin-top:4px"><span style="color:#fff">Net Winnings:</span><span style="color:#ffd700;font-size:14px">Rs.'+net+'</span></div>'
          +'</div>';
        if (tdsActive) {
          h+='<div style="background:#111118;border-radius:12px;padding:14px;margin-bottom:10px;font-size:12px;line-height:2;color:#8888aa">'
            +'<div style="display:flex;justify-content:space-between"><span>Total TDS (30%):</span><span style="color:#ffaa00;font-weight:700">Rs.'+owed+'</span></div>'
            +'<div style="display:flex;justify-content:space-between"><span>Already Deducted:</span><span style="color:#00ff9c;font-weight:700">Rs.'+ded+'</span></div>'
            +'<div style="display:flex;justify-content:space-between;font-weight:900;border-top:1px solid rgba(255,255,255,.08);padding-top:8px;margin-top:4px"><span style="color:#fff">Pending TDS:</span><span style="color:'+(Math.max(0,owed-ded)>0?'#ff6b6b':'#00ff9c')+';font-size:14px">Rs.'+Math.max(0,owed-ded)+'</span></div>'
            +'</div>';
        } else {
          h+='<div style="background:rgba(0,255,156,.05);border:1px solid rgba(0,255,156,.1);border-radius:10px;padding:12px;font-size:12px;color:#8888aa;line-height:1.8">'
            +'TDS tab start hoga jab:<br>• Monthly payouts Rs.5 lakh+ ho, ya<br>• Users 5000+ ho jaayein, ya<br>• Net winnings Rs.50k+ ho</div>';
        }
        h+='<div style="font-size:11px;color:#555;padding:10px;background:rgba(255,255,255,.03);border-radius:8px;margin-top:10px">Winnings income hai — ITR mein declare zaroor karo.</div></div>';
        _open('💰 My Tax Summary', h);
      });
    });
  };

  /* ═══════════════════════════════════════
     9. TDS THRESHOLD AUTO-ACTIVATION
  ═══════════════════════════════════════ */
  var _thresholdChecked = 0;
  window.mesCheckTDSThreshold = function (wdAmt, netWinnings) {
    if (Date.now()-_thresholdChecked < 300000) return;
    _thresholdChecked = Date.now();
    if (!window.db) return;
    window.db.ref('appSettings/tdsConfig').once('value', function(cfgSnap) {
      if ((cfgSnap.val()||{}).active===true) return;
      var triggered=[];
      if (netWinnings>=THRESHOLDS.singleWinning) triggered.push({type:'single_winning',value:netWinnings});
      var thirtyDaysAgo=Date.now()-30*24*3600*1000;
      window.db.ref('payoutLogs').orderByChild('timestamp').startAt(thirtyDaysAgo).once('value', function(s) {
        var monthlyTotal=0;
        if (s.exists()) s.forEach(function(c){monthlyTotal+=Number((c.val()||{}).amount)||0;});
        if (monthlyTotal>=THRESHOLDS.monthlyPayout) triggered.push({type:'monthly_payout',value:monthlyTotal});
        window.db.ref('users').once('value', function(us) {
          var totalUsers=0; if (us.exists()) us.forEach(function(){totalUsers++;});
          if (totalUsers>=THRESHOLDS.totalUsers) triggered.push({type:'user_count',value:totalUsers});
          if (triggered.length===0) return;
          var fy=(function(){var d=new Date();return d.getMonth()<3?(d.getFullYear()-1)+'-'+d.getFullYear():d.getFullYear()+'-'+(d.getFullYear()+1);})();
          window.db.ref('appSettings/tdsConfig').set({active:true,activatedAt:Date.now(),activatedBy:'auto_threshold',triggeredBy:triggered[0].type,financialYear:fy});
          window.db.ref('adminAlerts').push({type:'TDS_AUTO_ACTIVATED',severity:'CRITICAL',message:'[TDS AUTO-ON] Section 194BA TDS activated! Reason: '+triggered[0].type,triggers:triggered,activatedAt:Date.now(),read:false,action:'Admin Panel > Legal Dashboard > TDS Records check karo. TAN register karo.'});
          window.db.ref('tdsActivationLog').push({activatedAt:Date.now(),activatedBy:'auto_threshold',triggeredBy:triggered,financialYear:fy});
          _open('⚠️ TDS System Activated','<div style="text-align:center;padding:8px"><div style="font-size:40px;margin-bottom:12px">⚠️</div><div style="font-size:16px;font-weight:900;color:#ffd700;margin-bottom:10px">TDS Ab Active Hai</div><div style="font-size:13px;color:#8888aa;line-height:1.8;margin-bottom:16px">Platform ke scale hone par Section 194BA TDS automatically activate ho gaya.<br><br>Ab se har withdrawal pe <strong style="color:#ff6b6b">30% TDS</strong> deduct hoga.</div><button onclick="window.closeModal&&closeModal()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#000;font-weight:900;font-size:14px;border:none;cursor:pointer">Samajh Gaya ✓</button></div>');
        });
      });
    });
  };

  /* ═══════════════════════════════════════
     10. RESPONSIBLE GAMING
  ═══════════════════════════════════════ */
  window.mesRG = function () {
    var h='<div>'
      +'<div style="background:rgba(255,107,107,.06);border:1px solid rgba(255,107,107,.15);border-radius:12px;padding:14px;margin-bottom:12px">'
      +'<div style="font-size:13px;font-weight:700;color:#ff6b6b;margin-bottom:8px">Warning Signs</div>'
      +'<div style="font-size:12px;color:#8888aa;line-height:1.9">• Haar ke baad aur lagate rehna<br>• Budget se zyada spend karna<br>• Family se gaming ke karan jhagda</div></div>'
      +'<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:14px;margin-bottom:12px">'
      +'<div style="font-size:13px;font-weight:700;color:#00ff9c;margin-bottom:10px">Break Lena Chahte Ho?</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      +'<button onclick="window.mesBreak&&mesBreak(7)" style="padding:11px;border-radius:10px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);color:#00ff9c;font-weight:700;font-size:13px;cursor:pointer">7 Days</button>'
      +'<button onclick="window.mesBreak&&mesBreak(30)" style="padding:11px;border-radius:10px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);color:#00ff9c;font-weight:700;font-size:13px;cursor:pointer">30 Days</button>'
      +'</div></div>'
      +'<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:14px">'
      +'<div style="font-size:13px;font-weight:700;color:#00d4ff;margin-bottom:6px">Help Chahiye?</div>'
      +'<div style="font-size:13px;color:#ccc">iCall Helpline: <strong style="color:#fff">9152987821</strong></div></div></div>';
    _open('🧠 Responsible Gaming', h);
  };
  window.mesBreak = function (days) {
    if (!confirm(days+' din ka break lena chahte ho?')) return;
    window.db.ref('users/'+window.U.uid).update({selfExcluded:true,selfExcludedTill:Date.now()+days*864e5});
    _close(); _toast(days+' din ka break laga diya!','ok');
    setTimeout(function(){if(window.firebase&&window.firebase.auth)window.firebase.auth().signOut();},2000);
  };
  window.mesCheckExclusion = function () {
    if (!window.UD) return false;
    var till=Number(window.UD.selfExcludedTill);
    if (window.UD.selfExcluded&&till&&Date.now()<till) { _toast('Break active hai till '+new Date(till).toLocaleDateString('en-IN'),'err'); return true; }
    if (window.UD.selfExcluded&&till&&Date.now()>=till) { window.db.ref('users/'+window.U.uid).update({selfExcluded:false,selfExcludedTill:null}); }
    return false;
  };

  /* ═══════════════════════════════════════
     11. DISPUTE
  ═══════════════════════════════════════ */
  window.mesDispute = function (matchId, matchName) {
    var h = '<div>';
    h += '<div style="background:rgba(255,170,0,.06);border:1px solid rgba(255,170,0,.15);border-radius:10px;padding:11px;margin-bottom:14px;font-size:12px;color:#8888aa">Match complete hone ke <strong style="color:#ffaa00">24 ghante</strong> ke andar file karo</div>';
    if (!matchId) {
      h += '<div style="margin-bottom:12px"><label style="font-size:12px;color:#8888aa;display:block;margin-bottom:6px">Match ID:</label><input type="text" id="_mes_dmid" placeholder="Match ID enter karo" style="width:100%;padding:11px;border-radius:10px;background:#1a1a22;border:1px solid rgba(255,255,255,.12);color:#e8e8f0;font-size:13px;box-sizing:border-box"></div>';
    } else {
      h += '<div style="background:#111118;border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px"><span style="color:#8888aa">Match:</span> <strong>' + (matchName || matchId) + '</strong></div>';
    }
    h += '<div style="margin-bottom:12px"><label style="font-size:12px;color:#8888aa;display:block;margin-bottom:6px">Type:</label>'
      + '<select id="_mes_dtype" style="width:100%;padding:11px;border-radius:10px;background:#1a1a22;border:1px solid rgba(255,255,255,.12);color:#e8e8f0;font-size:13px">'
      + '<option>Result galat hai</option><option>Prize nahi mila</option><option>Cheater tha</option><option>Room ID nahi mili</option><option>Entry fee wapas chahiye</option><option>Technical issue</option>'
      + '</select></div>';
    h += '<div style="margin-bottom:16px"><label style="font-size:12px;color:#8888aa;display:block;margin-bottom:6px">Details:</label>'
      + '<textarea id="_mes_ddesc" placeholder="Poori baat likho..." style="width:100%;padding:11px;border-radius:10px;background:#1a1a22;border:1px solid rgba(255,255,255,.12);color:#e8e8f0;font-size:13px;height:80px;resize:none;box-sizing:border-box"></textarea></div>';
    var mid = matchId || '';
    h += '<button onclick="window.mesSubmitDispute()' + ' style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ffaa00,#ff8800);color:#000;font-weight:900;font-size:14px;border:none;cursor:pointer">Submit Dispute</button>';
    h += '</div>';
    _open('🚨 Dispute / Complaint', h);
  };

  window.mesSubmitDispute = function (mid) {
    mid=mid||((document.getElementById('_mes_dmid')||{}).value||'').trim();
    var type=((document.getElementById('_mes_dtype')||{}).value||'');
    var desc=((document.getElementById('_mes_ddesc')||{}).value||'').trim();
    if (!mid) { _toast('Match ID enter karo','err'); return; }
    if (desc.length<5) { _toast('Zyada detail do','err'); return; }
    var did=window.db.ref('disputes').push().key;
    window.db.ref('disputes/'+did).set({uid:window.U.uid,ign:(window.UD||{}).ign||'',matchId:mid,type:type,description:desc,status:'open',createdAt:Date.now()});
    window.db.ref('adminAlerts').push({type:'dispute',uid:window.U.uid,matchId:mid,disputeType:type,timestamp:Date.now(),severity:'MEDIUM'});
    _close(); _toast('Dispute filed! 24-48 hrs mein reply milegi ✓','ok');
  };

  /* ═══════════════════════════════════════
     12. LEGAL FOOTER (Profile screen)
  ═══════════════════════════════════════ */
  window.mesLegalFooter = function () {
    return '<div style="margin-top:20px;padding:16px;border-top:1px solid rgba(255,255,255,.06)">'
      +'<div style="font-size:10px;color:#555;text-align:center;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">⚖️ Legal & Compliance</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
      +'<button onclick="window.mesShowTerms&&mesShowTerms()" style="padding:10px;border-radius:10px;background:#0d0d12;border:1px solid rgba(0,212,255,.2);color:#00d4ff;font-size:11px;font-weight:700;cursor:pointer">📋 Terms</button>'
      +'<button onclick="window.mesShowPrivacy&&mesShowPrivacy()" style="padding:10px;border-radius:10px;background:#0d0d12;border:1px solid rgba(0,212,255,.2);color:#00d4ff;font-size:11px;font-weight:700;cursor:pointer">🛡️ Privacy</button>'
      +'<button onclick="window.mesTDSSummary&&mesTDSSummary()" style="padding:10px;border-radius:10px;background:rgba(255,215,0,.05);border:1px solid rgba(255,215,0,.15);color:#ffd700;font-size:11px;font-weight:700;cursor:pointer">💰 Tax Summary</button>'
      +'<button onclick="window.mesShowKYC&&mesShowKYC()" style="padding:10px;border-radius:10px;background:rgba(185,100,255,.06);border:1px solid rgba(185,100,255,.15);color:#b964ff;font-size:11px;font-weight:700;cursor:pointer">🪪 KYC</button>'
      +'<button onclick="window.mesRG&&mesRG()" style="padding:10px;border-radius:10px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);color:#00ff9c;font-size:11px;font-weight:700;cursor:pointer">🧠 Responsible</button>'
      +'<button onclick="window.mesDispute&&mesDispute()" style="padding:10px;border-radius:10px;background:rgba(255,170,0,.06);border:1px solid rgba(255,170,0,.15);color:#ffaa00;font-size:11px;font-weight:700;cursor:pointer">🚨 Dispute</button>'
      +'</div>'
      +'<div style="font-size:10px;color:#444;text-align:center;line-height:1.8">'
      +CONFIG.appName+' | '+CONFIG.address+'<br>'+CONFIG.supportEmail+' | Grievance: '+CONFIG.grievanceEmail+'<br>Skill-based | 18+ | Not affiliated with Garena'
      +'</div></div>';
  };

  /* ═══════════════════════════════════════
     13. INIT FLOW
  ═══════════════════════════════════════ */
  function _runNext(step) {
    if (!window.U||!window.UD) return;
    if (step==='age'&&!window.UD.tcAccepted) { setTimeout(function(){_showTC(window.U.uid);},400); }
  }
  window.mesInit = function () {
    if (!window.U||!window.UD) return;
    if (!sessionStorage.getItem('_mes_state')) { setTimeout(window.mesCheckState,1800); return; }
    if (!window.UD.ageVerified) { setTimeout(window.mesAgeGate,1800); return; }
    if (!window.UD.tcAccepted) { setTimeout(function(){_showTC(window.U.uid);},1800); }
  };

  console.log('[Mini eSports] Legal v3.0 loaded — all modals using native openModal');
})();
