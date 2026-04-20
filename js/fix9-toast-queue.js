/* ============================================================
   FIX 9: TOAST NOTIFICATION QUEUE SYSTEM
   - Ek finish ho to agla dikhao
   - Max 3 toasts visible at once
   - Priority levels: err > inf > ok
   - Duplicate suppression
   ============================================================ */

(function() {
  'use strict';

  var TOAST_DURATION  = 2200;   // ms each toast stays
  var TOAST_GAP       = 100;    // ms between toasts
  var MAX_VISIBLE     = 3;      // max toasts on screen at once
  var DEDUP_WINDOW    = 1500;   // suppress duplicate within ms

  var _queue    = [];    // { msg, type, priority, id }
  var _active   = [];    // currently displayed toast elements
  var _lastMsgs = {};    // dedup: msg → timestamp
  var _running  = false;
  var _idSeq    = 0;

  /* Priority map */
  var PRIORITY = { err: 3, inf: 2, ok: 1 };

  /* ── Ensure toast-wrap exists ── */
  function getWrap() {
    var w = document.getElementById('toast-wrap');
    if (!w) {
      w = document.createElement('div');
      w.id = 'toast-wrap';
      w.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;width:90%;max-width:340px';
      document.body.appendChild(w);
    }
    return w;
  }

  /* ── Show one toast element ── */
  function showOne(item) {
    var w = getWrap();
    if (_active.length >= MAX_VISIBLE) return false; // wait

    var d = document.createElement('div');
    d.className = 'toast-item t' + (item.type || 'ok');
    var ic = item.type === 'err' ? 'exclamation-circle'
           : item.type === 'inf' ? 'info-circle'
           : 'check-circle';
    d.innerHTML = '<i class="fas fa-' + ic + '"></i>' + item.msg;
    d.style.cssText += ';animation:toastIn .25s ease;pointer-events:auto';
    d.title = 'Tap to dismiss';
    d.onclick = function() { dismiss(d); };

    w.appendChild(d);
    _active.push(d);

    setTimeout(function() { dismiss(d); }, item.duration || TOAST_DURATION);
    return true;
  }

  /* ── Dismiss a toast and process queue ── */
  function dismiss(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'all .2s';
    setTimeout(function() {
      if (el.parentNode) el.remove();
      _active = _active.filter(function(a) { return a !== el; });
      /* Process next in queue */
      setTimeout(pump, TOAST_GAP);
    }, 200);
  }

  /* ── Process queue ── */
  function pump() {
    if (!_queue.length) { _running = false; return; }
    if (_active.length >= MAX_VISIBLE) { _running = false; return; }

    /* Sort by priority (high first) */
    _queue.sort(function(a, b) { return (PRIORITY[b.type]||1) - (PRIORITY[a.type]||1); });

    var item = _queue.shift();
    if (showOne(item)) {
      /* Continue pumping if queue has more and slots available */
      if (_queue.length && _active.length < MAX_VISIBLE) {
        setTimeout(pump, TOAST_GAP);
      }
    } else {
      /* Slot not available — put back and retry */
      _queue.unshift(item);
      setTimeout(pump, 300);
    }
  }

  /* ── Public toast() — replaces original ── */
  var _origToast = window.toast;

  window.toast = function(msg, type, opts) {
    if (!msg) return;
    opts = opts || {};

    /* Deduplicate */
    var dedup = type + ':' + msg;
    var now = Date.now();
    if (_lastMsgs[dedup] && now - _lastMsgs[dedup] < DEDUP_WINDOW) return;
    _lastMsgs[dedup] = now;

    /* Clean up old dedup entries */
    setTimeout(function() { delete _lastMsgs[dedup]; }, DEDUP_WINDOW + 100);

    _queue.push({
      id:       ++_idSeq,
      msg:      msg,
      type:     type || 'ok',
      duration: opts.duration || TOAST_DURATION,
      priority: PRIORITY[type] || 1
    });

    if (!_running) {
      _running = true;
      setTimeout(pump, 0);
    }
  };

  /* ── Inject CSS animation if not present ── */
  if (!document.getElementById('toastQueueStyle')) {
    var style = document.createElement('style');
    style.id = 'toastQueueStyle';
    style.textContent = [
      '@keyframes toastIn {',
      '  from { opacity:0; transform:translateY(12px) scale(.95); }',
      '  to   { opacity:1; transform:translateY(0) scale(1); }',
      '}',
      '#toast-wrap .toast-item {',
      '  transition: opacity .2s, transform .2s;',
      '  cursor: pointer;',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  /* ── Helper: urgent toast that jumps queue ── */
  window.toastUrgent = function(msg, type) {
    window.toast(msg, type || 'err', { priority: 10 });
    /* Force to front */
    if (_queue.length > 1) {
      var last = _queue.pop();
      _queue.unshift(last);
    }
    if (!_running) { _running = true; setTimeout(pump, 0); }
  };

  /* ── Helper: clear all toasts ── */
  window.toastClear = function() {
    _queue = [];
    _active.forEach(function(el) { if (el.parentNode) el.remove(); });
    _active = [];
  };

  console.log('[Mini eSports] ✅ Fix 9: Toast Queue System loaded.');
})();
