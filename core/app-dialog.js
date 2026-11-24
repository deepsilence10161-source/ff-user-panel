/* ================================================================
   APP DIALOG — core/app-dialog.js  (Mini eSports USER PANEL)

   ✅ BUG FIX (2026-10-06, B3):
   Shikayat: "koi bhi browser popup na aaye — '…github.io says' jaisa
   popup nahi, har confirm app ki apni UI me ho."

   Pehle app me 12 jagah native confirm()/alert()/prompt() the — WebView
   aur browser dono me wo BADE, bhade, white system popup dikhate hain
   jinme app ka rang-roop kahin nahi hota (aur WebView me upar
   "deepsilence10161-source.github.io" likha aata hai). Naya user
   ghabra jata tha.

   Ab: apna overlay (aapke theme ke rang, gol kone, bade saaf button) —
   ⌨️ Enter = theek, Esc = cancel, bahar tap karne par band.
   Isi liye kaam ki teen soorten:
     • window.appAlert(msg, opts)            → Promise (OK dabane par)
     • window.appConfirm(msg, opts)          → Promise<true|false>
     • window.appPrompt(label, def, opts)    → Promise<string|null>
     • window.appConfirmCb(msg, onYes, onNo) → purane callback andaaz me

   Saath me ek SURAKSHA-JAAL (neeche): agar koi aisi jagah bach gayi ho
   jise hum badalna bhool gaye aur wo phir bhi native confirm() bulaye,
   to wo bhi isi app-UI dialog me badal jayegi — user ko browser popup
   kabhi nahi dikhega. (Click wale handler se bulaya gaya confirm bilkul
   theek chalta hai: "Yes" dabane par wahi button dobara apne aap chalta
   hai, aapko dobara nahi dabana padta.)
================================================================ */
(function () {
  'use strict';
  if (window.__appDialogReady) return;
  window.__appDialogReady = true;

  var _styleId = '_appDlgStyle';

  function _injectCss() {
    if (document.getElementById(_styleId)) return;
    var css = ''
      + '#_appDlgOv{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;'
      + 'background:rgba(0,0,0,.72);backdrop-filter:blur(3px);padding:18px}'
      + '#_appDlgOv.show{display:flex}'
      + '#_appDlgCard{width:100%;max-width:360px;background:var(--card,#15151c);border:1px solid var(--border,#2a2a36);'
      + 'border-radius:18px;padding:20px 18px 16px;box-shadow:0 18px 50px rgba(0,0,0,.6);'
      + 'animation:_appDlgIn .16s ease-out}'
      + '@keyframes _appDlgIn{from{transform:translateY(10px) scale(.97);opacity:0}to{transform:none;opacity:1}}'
      + '#_appDlgIcon{font-size:30px;text-align:center;margin-bottom:8px}'
      + '#_appDlgMsg{font-size:14px;line-height:1.55;color:var(--txt,#eaeaea);text-align:center;white-space:pre-wrap;'
      + 'word-break:break-word;max-height:46vh;overflow:auto}'
      + '#_appDlgIn{display:none;width:100%;margin-top:12px;padding:11px 12px;border-radius:11px;'
      + 'background:var(--card2,#1d1d26);border:1px solid var(--border,#2a2a36);color:var(--txt,#eaeaea);font-size:14px;box-sizing:border-box}'
      + '#_appDlgBtns{display:flex;gap:10px;margin-top:16px}'
      + '#_appDlgBtns button{flex:1;padding:12px;border-radius:12px;border:none;font-size:14px;font-weight:800;cursor:pointer}'
      + '#_appDlgOk{background:var(--primary,#00ff9c);color:#001b10}'
      + '#_appDlgOk.danger{background:#ff4444;color:#fff}'
      + '#_appDlgNo{background:transparent;color:var(--txt2,#9aa0aa);border:1px solid var(--border,#2a2a36)!important}';
    var st = document.createElement('style');
    st.id = _styleId;
    st.textContent = css;
    document.head.appendChild(st);
  }

  function _build() {
    if (document.getElementById('_appDlgOv')) return;
    _injectCss();
    var ov = document.createElement('div');
    ov.id = '_appDlgOv';
    ov.innerHTML = '<div id="_appDlgCard" role="dialog" aria-modal="true">'
      + '<div id="_appDlgIcon"></div>'
      + '<div id="_appDlgMsg"></div>'
      + '<input id="_appDlgIn" type="text" autocomplete="off">'
      + '<div id="_appDlgBtns">'
      +   '<button id="_appDlgNo" type="button">Cancel</button>'
      +   '<button id="_appDlgOk" type="button">OK</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) _answer(false); });
    document.getElementById('_appDlgNo').addEventListener('click', function () { _answer(false); });
    document.getElementById('_appDlgOk').addEventListener('click', function () { _answer(true); });
    document.addEventListener('keydown', function (e) {
      if (!_open) return;
      if (e.key === 'Escape') { e.preventDefault(); _answer(false); }
      else if (e.key === 'Enter' && _mode !== 'prompt') { e.preventDefault(); _answer(true); }
      else if (e.key === 'Enter' && _mode === 'prompt') { e.preventDefault(); _answer(true); }
    });
  }

  var _open = false, _mode = 'alert', _resolve = null, _opts = {};

  function _show(mode, message, opts) {
    _build();
    _mode = mode; _opts = opts || {};
    _shimFlow = !!_opts._shim;
    _open = true;
    var ov = document.getElementById('_appDlgOv');
    document.getElementById('_appDlgIcon').textContent = _opts.icon ||
      (mode === 'confirm' ? '❓' : mode === 'prompt' ? '✍️' : (opts && opts.danger ? '⚠️' : 'ℹ️'));
    document.getElementById('_appDlgMsg').innerHTML = _esc(message);
    var inp = document.getElementById('_appDlgIn');
    inp.style.display = (mode === 'prompt') ? 'block' : 'none';
    inp.value = (mode === 'prompt') ? (_opts.defaultValue || '') : '';
    inp.placeholder = _opts.placeholder || '';
    var ok = document.getElementById('_appDlgOk');
    ok.textContent = _opts.okText || (mode === 'confirm' ? 'Haan, karo' : 'OK');
    ok.className = _opts.danger ? 'danger' : '';
    var no = document.getElementById('_appDlgNo');
    no.textContent = _opts.cancelText || 'Cancel';
    no.style.display = (mode === 'alert') ? 'none' : 'block';
    ov.classList.add('show');
    try { if (mode === 'prompt') setTimeout(function () { inp.focus(); }, 40); } catch (e) {}
  }

  function _hide() {
    var ov = document.getElementById('_appDlgOv');
    if (ov) ov.classList.remove('show');
    _open = false;
  }

  function _answer(yes) {
    if (!_open) return;
    var val = document.getElementById('_appDlgIn').value;
    var mode = _mode, res = _resolve, opts = _opts, shim = _shimFlow;
    _resolve = null;
    _hide();
    if (res) {
      try { res(yes ? (mode === 'prompt' ? val : true) : (mode === 'prompt' ? null : false)); } catch (e) {}
    }
    /* callback andaaz (purane code me aam) */
    try {
      if (yes && typeof opts.onYes === 'function') opts.onYes(mode === 'prompt' ? val : undefined);
      if (!yes && typeof opts.onNo === 'function') opts.onNo();
    } catch (e) { console.warn('[AppDialog] callback fail:', e && e.message); }
    /* ☝️ SURAKSHA-JAAL: agar ye dialog kisi purane native confirm() ki
       jagah khula tha, to "Haan" dabane par wahi button apne aap dobara
       chal jata hai (bypass ke saath) — user ko dobara nahi dabana padta. */
    if (yes) {
      /* ✅ BUG FIX (2026-10-08): sirf SURAKSHA-JAAL wale dialog ka jawab
         yaad rakho aur wahi button dobara chalao. Seedhe
         appConfirm/appPrompt (promise andaaz) ka jawab purani queue me
         ghusne se wo kisi purane button ko dobara chala deta tha. */
      if (shim) {
        _q.push({ mode: mode, v: (mode === 'prompt' ? val : true) }); /* jawab yaad rakho */
        _startReplay();                                              /* wahi button dobara, jawab sath */
      }
    } else {
      _q = []; _cur = 0; _replay = null; _shimFlow = false;          /* cancel — kuch nahi, saaf */
    }
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── सार्वजनिक API ── */
  window.appAlert = function (message, opts) {
    return new Promise(function (res) { _show('alert', message, opts); _resolve = function () { res(true); }; });
  };
  window.appConfirm = function (message, opts) {
    if (typeof opts === 'function') opts = { onYes: opts };
    return new Promise(function (res) { _show('confirm', message, opts); _resolve = res; });
  };
  window.appConfirmCb = function (message, onYes, onNo, opts) {
    opts = opts || {}; opts.onYes = onYes; opts.onNo = onNo;
    return window.appConfirm(message, opts);
  };
  window.appPrompt = function (message, defaultValue, opts) {
    if (typeof defaultValue === 'object' && defaultValue !== null) { opts = defaultValue; defaultValue = ''; }
    return new Promise(function (res) {
      _show('prompt', message, Object.assign({ defaultValue: defaultValue || '' }, opts || {}));
      _resolve = res;
    });
  };

  /* ── SURAKSHA-JAAL (multi-step flows ke sath) ───────────────────
     Sabse ahem baat: kai jagah pehle ACCOUNT/REASON poocha jata hai
     (prompt) aur phir "pakka?" (confirm) — jaise Ban: pehle reason,
     phir "Ban user X? Reason: Y". Native me ye do popup lagataar aate
     the. Ab:
       1. Pehla jawab aap app-UI me dete ho (reason likh kar / Haan).
       2. Wahi button apne aap dobara chalta hai aur aapke diye hue
          jawab apne aap laga diye jate hain (queue) — dobara nahi poocha
          jata, aur koi native popup bhi nahi.
       3. Agar kisi nayi shakh (branch) me kuch naya poocha jaye, to wo
          phir se app-UI me hi dikhega — native kabhi nahi.
     "Cancel" dabane par kuch nahi hota (bilkul native jaisa) aur queue
     saaf ho jati hai, taki agli baar button dabane par fresh shuru ho. */
  var _q = [], _cur = 0, _bypass = false, _replaying = false, _replay = null;
  /* ✅ BUG FIX (2026-10-08, live E2E): ye dialog kis type ka hai —
     (a) purane native confirm()/prompt()/alert() ki jagah (SURAKSHA-JAAL, _shim),
         to jawab yaad rakhna + wahi button dobara chalana THEEK hai;
     (b) seedha window.appConfirm/appPrompt/appAlert (promise andaaz) —
         iska jawab queue me nahi ghusna chahiye (warna purana button
         apne aap dobara chal jata tha = duplicate action ka khatra). */
  var _shimFlow = false;

  function _nextQueued(mode) {
    var e = _q[_cur];
    if (e && e.mode === mode) { _cur++; return { hit: true, v: e.v }; }
    return { hit: false };
  }

  function _startReplay() {
    if (!_replay) return;
    var fn = _replay, before = _q.length;
    _cur = 0; _bypass = true; _replaying = true;
    /* Rate-limit/duplicate-click guards ko batao ki ye user ka dobara click
       NAHI hai — wahi ek action apne aap aage badh raha hai. */
    window.__appDialogBypass = true;
    setTimeout(function () {
      try { fn(); } catch (e) { console.warn('[AppDialog] replay fail:', e && e.message); }
      setTimeout(function () { _replaying = false; }, 0);
      /* 1.8 second baad dekho: replay ne apna jawab kharch kiya? Agar nahi
         (button band tha / guard ne rok diya), to user ko chup-chaap kuch
         na-hone ki jagah saaf batao. */
      setTimeout(function () {
        window.__appDialogBypass = false;
        var kuchPuchhaJaRahaHai = document.getElementById('_appDlgOv')
          && document.getElementById('_appDlgOv').classList.contains('show');
        if (before > 0 && _cur === 0 && !kuchPuchhaJaRahaHai) {
          window.appAlert('Kaam poora nahi hua — kripya wahi button ek baar dobara dabaiye.', { icon: '⚠️' });
        }
      }, 1800);
    }, 30);
  }

  /* naya click (asli user ka) = purani queue bekaar, saaf karo */
  document.addEventListener('click', function (e) {
    var t = e.target;
    /* Hamare hi dialog ke andar ka click "asli kaam wala button" nahi hai —
       isliye na yaad rakho, na queue saaf karo (warna apna hi jawab ud jata). */
    var inDlg = !!(t && t.closest && t.closest('#_appDlgOv'));
    var el = (t && t.closest && !inDlg)
      ? t.closest('[onclick], button, a, .nav-item, .filter-tab, .tab') : null;
    if (el) window.__appDialogLastEl = el;
    /* ⚠️ BUG FIX (2026-10-08, live E2E me pakda gaya): pehle yahan
       `!_bypass` bhi shart thi. Lekin ek flow poora hone ke baad _bypass
       TRUE hi reh jata hai (usko reset karne wala 1.8s wala timer sirf
       window.__appDialogBypass ko chhoota hai), is liye agli click par
       purani queue saaf hoti hi nahi thi.
       Asli asar (admin panel, live): Ban (prompt+confirm) ke baad Unban
       (sirf confirm) — “Unban?” dialog baar-baar khulta rehta tha, OK
       dabane par kuch nahi hota tha, DB me is_banned=true hi padi rehti
       thi (page reload ke bina chhutkara nahi).
       Ab: HAR naYA click queue saaf karta hai (chahe _bypass purana pada ho),
       bas replay ka apna click chhod kar — wo _replaying/_appDialogReplayClick
       se pahchana jata hai. */
    if (!inDlg && !_replaying && !window.__appDialogReplayClick) {
      _q = []; _cur = 0; _bypass = false; _shimFlow = false;
    }
  }, true);

  /* ✅ BUG FIX (2026-10-08): replay ka apna click "naya user click" NAHI hai —
     is liye us ek click ke dauran chhota flag laga dete hain, taki upar wala
     click-listener isi click par queue saaf na kar de (warna abhi-abhi diya
     hua jawab ud jata aur kaam aage hi nahi badhta). */
  function _replayFromLastEl() {
    var el = window.__appDialogLastEl;
    if (el && el.click) return function () {
      window.__appDialogReplayClick = true;
      try { el.click(); } finally { window.__appDialogReplayClick = false; }
    };
    return null;
  }

  /* ⚠️ BUG FIX (2026-10-08, live E2E): queue me is soorten ka jawab na mila =
     nayi shakh. Tab sirf utne jawab rakho jitne is flow ne sach me kharch kiye
     (_cur tak) — baaki bekaar hain. Poori queue saaf karna galat tha: async
     flows me (jaise Ban: prompt → [await token] → confirm) replay ka fn()
     await par ruk jata hai, _replaying pehle hi false ho chuka hota hai —
     “naya flow” maan kar queue saaf karne se user ka diya hua REASON ud jata
     tha aur prompt↔confirm ka infinite loop ban jata tha (live me M4 ban hi
     nahi hota tha). Prefix rakhne se replay ko bilkul wahi jawab milta hai
     jo user ne diya tha. */
  function _shimBranchReset() {
    _q = _q.slice(0, _cur);
    _bypass = false;
  }

  var _nativeAlert = window.alert, _nativeConfirm = window.confirm, _nativePrompt = window.prompt;
  window.alert = function (msg) {
    /* ✅ BUG FIX (2026-10-08, live-testing): alert ka jawab flow ke natije ko
       badalta nahi — is liye ise na queue me likho, na apne-aap-replay karo.
       Pehle aisa hota tha, aur uski wajah se "kaam ke baad ka alert"
       (jaise confirm → delete → alert('Delete ho gaya')) poore action ko
       DOBARA chala deta tha — yani delete/credit DO baar! (Live E2E me pakda
       gaya.) Ab: replay ke dauran, jab user wahi alert pehle hi dekh chuka
       hai, chup-chaap nikal jata hai; warna app-UI me saaf dikhta hai. */
    if (_bypass) return;
    _shimFlow = false;
    window.appAlert(msg, { icon: 'ℹ️' });
  };
  window.confirm = function (msg) {
    if (_bypass) {
      var r = _nextQueued('confirm');
      if (r.hit) return !!r.v;
      _shimBranchReset();          /* nayi shakh — app-UI me poocho */
    }
    _replay = _replayFromLastEl();
    _shimFlow = true;
    window.appConfirm(msg, { icon: '⚠️', _shim: true });
    return false;                  /* natija dialog se (replay ke zariye) */
  };
  window.prompt = function (msg, def) {
    if (_bypass) {
      var r = _nextQueued('prompt');
      if (r.hit) return r.v;
      _shimBranchReset();          /* nayi shakh — app-UI me poocho */
    }
    _replay = _replayFromLastEl();
    _shimFlow = true;
    window.appPrompt(msg, def || '', { _shim: true });
    return null;
  };

  /* zaroorat pade to purane wapas (debugging ke liye) */
  /* E2E/debug ke liye — kis waqt kaun sa jawab line me hai, ye dikhata hai */
  window.__appDialogState = function () {
    return { q: _q.slice(), cur: _cur, bypass: _bypass, replaying: _replaying, shim: _shimFlow,
             lastEl: window.__appDialogLastEl ? (window.__appDialogLastEl.id || window.__appDialogLastEl.className || '?') : null };
  };
  window._appDialogNatives = { alert: _nativeAlert, confirm: _nativeConfirm, prompt: _nativePrompt };

  console.log('[AppDialog] ready — koi browser popup nahi, sab app-UI (B3)');
})();
