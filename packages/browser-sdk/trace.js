/*! Originary Trace Browser SDK v1.0.0 | Apache-2.0 | trace.originary.xyz */
(function () {
  'use strict';

  var s = document.currentScript || document.querySelector('script[data-tenant]');
  if (!s) return;

  var tenant   = s.dataset.tenant || location.host;
  var pubKey   = s.dataset.pub || '';
  var endpoint = s.dataset.endpoint || 'https://api.trace.originary.xyz';
  var debug    = s.dataset.debug === 'true';

  // Respect privacy flags
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) {
    if (debug) console.log('[OriginaryTrace] Respecting DNT/GPC, tracking disabled');
    return;
  }

  // Don't track prerendering
  if (document.visibilityState === 'prerender') {
    if (debug) console.log('[OriginaryTrace] Skipping prerender state');
    return;
  }

  /**
   * Build minimal, privacy-safe payload
   * No fingerprinting, no persistent IDs
   */
  function buildEvent(kind) {
    var now = Date.now();
    return {
      ts: now,
      kind: kind || 'pageview',
      tenant: tenant,
      path: location.pathname,
      ref: document.referrer || null,
      ua: navigator.userAgent,
      lang: navigator.language || null,
      scr: { w: screen.width, h: screen.height },
      src: 'browser-sdk',
      // Publishable key for routing only; server never trusts it for auth
      pub: pubKey || null
    };
  }

  /**
   * Non-blocking send with keepalive
   */
  function send(ev) {
    var url = endpoint.replace(/\/$/, '') + '/v1/events-browser';
    var body = JSON.stringify(ev);
    var headers = { 'content-type': 'application/json' };
    var opts = {
      method: 'POST',
      headers: headers,
      body: body,
      keepalive: true,  // Ensures delivery even if page closes
      mode: 'cors',
      credentials: 'omit'  // No cookies
    };

    // Use sendBeacon for page unload, fetch otherwise
    if (navigator.sendBeacon && document.visibilityState === 'hidden') {
      // sendBeacon can't set headers, so use fetch with keepalive
      fetch(url, opts).catch(function(){ /* drop silently */ });
      return;
    }

    fetch(url, opts).catch(function (e) {
      if (debug) console.warn('[OriginaryTrace] Send failed:', e);
    });
  }

  /**
   * Track event
   */
  function track(kind) {
    try {
      send(buildEvent(kind));
    } catch (e) {
      if (debug) console.warn('[OriginaryTrace] Track error:', e);
    }
  }

  /**
   * Initial pageview
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        track('pageview');
      }, { once: true });
    } else {
      track('pageview');
    }
  }

  // Start tracking
  init();

  // SPA route changes (React Router, Vue Router, etc.)
  var _pushState = history.pushState;
  history.pushState = function () {
    _pushState.apply(this, arguments);
    queueMicrotask(function() { track('route'); });
  };

  addEventListener('popstate', function() {
    queueMicrotask(function() { track('route'); });
  });

  // Flush on page hide
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      track('ping');
    }
  });

  // Public API for manual events
  window.OriginaryTrace = {
    track: track,
    version: '1.0.0'
  };
})();
