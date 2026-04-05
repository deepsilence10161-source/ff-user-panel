/* ============================================================
   FIX 8: LAZY LOADING FOR IMAGES
   - Dynamically rendered img tags pe loading="lazy" add karo
   - MutationObserver se DOM changes track karo
   - Existing images bhi cover karo on load
   ============================================================ */

(function() {
  'use strict';

  /* ── Patch all img elements in a container ── */
  function patchImgs(root) {
    var imgs = (root || document).querySelectorAll('img:not([loading])');
    imgs.forEach(function(img) {
      img.setAttribute('loading', 'lazy');
      /* Also add decoding=async for paint perf */
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      /* Fade-in when loaded */
      if (!img.complete) {
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s';
        img.onload = function() { img.style.opacity = '1'; };
        img.onerror = function() { img.style.opacity = '1'; };
      }
    });
  }

  /* ── Observe dynamic DOM additions ── */
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return; // element nodes only
        if (node.tagName === 'IMG') {
          if (!node.getAttribute('loading')) {
            node.setAttribute('loading', 'lazy');
            node.setAttribute('decoding', 'async');
          }
        } else if (node.querySelectorAll) {
          patchImgs(node);
        }
      });
    });
  });

  /* ── Simple global HTML string patcher ── */
  /* Call this before setting innerHTML anywhere */
  window.injectLazy = function(html) {
    if (typeof html !== 'string') return html;
    return html.replace(/<img(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"');
  };
  /* NOTE: document.createElement override REMOVED — it caused DOM corruption
     and blocked Firebase SDK from initializing, causing infinite loading screen. */

  /* ── Start observing ── */
  function startObserver() {
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
    /* Patch existing images */
    patchImgs(document);
    console.log('[Mini eSports] ✅ Fix 8: Lazy loading observer active.');
  }

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }

  /* ── Re-patch on screen changes (SPA navigation) ── */
  var _patchTimer = null;
  window.addEventListener('hashchange', function() {
    clearTimeout(_patchTimer);
    _patchTimer = setTimeout(function() { patchImgs(document); }, 200);
  });

})();
