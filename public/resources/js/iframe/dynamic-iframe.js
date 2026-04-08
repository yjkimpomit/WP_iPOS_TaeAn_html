/*
 * Dynamic iframe initializer (native, no external library)
 * - Injects an iframe that fills its container.
 * - Auto-resizes height via:
 *   a) same-origin ResizeObserver inside the iframe (if allowed), or
 *   b) postMessage protocol from child ({ type: 'ifr-lite:resize', height, width })
 * - Also responds to container resizing to maintain full-bleed fit.
 *
 * Usage (unchanged API):
 *   initDynamicIframe('#panorama-tab03-pane', '/your/url', {
 *     mode: 'fill' | 'content-height', // default 'fill'
 *     attrs: { allow: 'fullscreen', scrolling: 'no' }
 *   });
 */
(function(global){
  'use strict';

  function toElement(target){
    if (!target) return null;
    if (target instanceof Element) return target;
    if (typeof target === 'string') {
      if (target.charAt(0) === '#') {
        return document.querySelector(target);
      }
      return document.getElementById(target);
    }
    return null;
  }

  function empty(el){
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function applyFillStyles(iframe){
    if (!iframe) return;
    iframe.style.position = 'absolute';
    iframe.style.inset = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
  }

  function ensureContainer(el){
    if (!el) return;
    var style = el.style;
    if (!style.position || style.position === '' || style.position === 'static') {
      //style.position = 'relative';
    }
  }

  function createIframe(url, attrs){
    var ifr = document.createElement('iframe');
    ifr.src = url || 'about:blank';
    if (attrs && typeof attrs === 'object') {
      Object.keys(attrs).forEach(function(k){
        try { ifr.setAttribute(k, attrs[k]); } catch(e) {}
      });
    }
    return ifr;
  }

  function observeContainerSize(containerEl, iframe){
    if (!('ResizeObserver' in global)) return;
    try {
      var ro = new ResizeObserver(function(){
        // Keep iframe stretched to container
        iframe.style.width = '100%';
        if (iframe.dataset.mode === 'fill') {
          iframe.style.height = '100%';
        }
      });
      ro.observe(containerEl);
    } catch(e) { /* noop */ }
  }

  function setupSameOriginAutoHeight(iframe){
    try {
      var cw = iframe.contentWindow;
      var doc = cw && cw.document;
      if (!doc) return false;
      var update = function(){
        try {
          var h = Math.max(
            doc.body ? doc.body.scrollHeight : 0,
            doc.documentElement ? doc.documentElement.scrollHeight : 0,
            doc.body ? doc.body.offsetHeight : 0,
            doc.documentElement ? doc.documentElement.offsetHeight : 0
          );
          if (h && iframe.dataset.mode === 'content-height') {
            iframe.style.height = h + 'px';
          }
        } catch(e) {}
      };
      if ('ResizeObserver' in global) {
        try {
          var ro = new cw.ResizeObserver(update);
          ro.observe(doc.documentElement);
          if (doc.body) ro.observe(doc.body);
        } catch(e) {
          // Fallback to parent observer polling
          var ro2 = new ResizeObserver(update);
          ro2.observe(iframe);
        }
      } else {
        cw.addEventListener('load', update);
        cw.addEventListener('resize', update);
        setTimeout(update, 50);
      }
      // Initial kick
      setTimeout(update, 0);
      return true;
    } catch(e) {
      // Cross-origin or blocked
      return false;
    }
  }

  function setupPostMessageListener(iframe){
    function onMessage(ev){
      try {
        if (!ev || !ev.source || ev.source !== iframe.contentWindow) return;
        var data = ev.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch(_e) { /* ignore */ }
        }
        if (!data || (data.type !== 'ifr-lite:resize' && data.type !== 'resize')) return;
        if (typeof data.width === 'number') iframe.style.width = data.width + 'px';
        if (typeof data.height === 'number' && iframe.dataset.mode === 'content-height') {
          iframe.style.height = data.height + 'px';
        }
      } catch(e) { /* noop */ }
    }
    global.addEventListener('message', onMessage, false);
    // Keep a reference so it could be removed if needed later
    iframe._ifrLiteMsgHandler = onMessage;
  }

  function initWithNative(containerEl, url, opts){
    var options = opts || {};
    var mode = options.mode || 'fill'; // 'fill' or 'content-height'
    var ifr = createIframe(url, options.attrs || { scrolling: 'no' });
    ifr.dataset.mode = mode;

    // Default to fill styles
    applyFillStyles(ifr);

    // If content-height mode, start with minimal height until measured
    if (mode === 'content-height') {
      ifr.style.height = '150px';
    }

    containerEl.appendChild(ifr);

    // Maintain fill on container resize
    observeContainerSize(containerEl, ifr);

    // Try same-origin auto-height inside the iframe
    ifr.addEventListener('load', function(){
      var ok = setupSameOriginAutoHeight(ifr);
      // Regardless of same-origin, accept child postMessages
      setupPostMessageListener(ifr);
      // In fill mode we keep 100% height; in content-height, if same-origin failed, rely on messages
    });

    return { type: 'native', iframe: ifr, mode: mode };
  }

  function initDynamicIframe(container, url, opts){
    var el = toElement(container);
    if (!el) {
      if (global && global.console) console.warn('[dynamic-iframe] container not found:', container);
      return null;
    }
    ensureContainer(el);
    empty(el);
    return initWithNative(el, url, opts);
  }

  // export
  global.initDynamicIframe = initDynamicIframe;

})(window);
