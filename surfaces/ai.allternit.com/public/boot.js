// Early boot for ai.allternit.com. Loaded as a classic script in <head> so it
// runs before the Vite module bundle: applies the theme before first paint,
// registers the service worker, and logs any error that happens before
// main.tsx installs the full client-error reporting handlers.
(function () {
  try {
    var s = localStorage.getItem('allternit-theme-storage');
    var t = s && JSON.parse(s) && JSON.parse(s).state && JSON.parse(s).state.theme;
    var r = t === 'dark' ? 'dark' : t === 'light' ? 'light' : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', r);
    document.documentElement.style.colorScheme = r;
  } catch (e) {}

  function recoverFromStaleAssets() {
    if (!('sessionStorage' in window)) return;
    try {
      if (sessionStorage.getItem('allternit-sw-recover')) return;
      sessionStorage.setItem('allternit-sw-recover', '1');
    } catch (e) {
      return;
    }
    var clearing = [];
    if ('caches' in window) {
      clearing.push(caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }));
    }
    if ('serviceWorker' in navigator) {
      clearing.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
      }));
    }
    Promise.all(clearing).then(function () {
      location.reload();
    }).catch(function () {
      location.reload();
    });
  }

  // Capture phase: script/link load failures do not bubble. A 404 on a hashed
  // Vite chunk after a Pages deploy is the stale-SW index.html footgun.
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target !== window && target.src && String(target.src).indexOf('/assets/') !== -1) {
      console.error('[APP ERROR] hashed asset failed to load', target.src);
      recoverFromStaleAssets();
      return;
    }
    if (event.message) {
      console.error('[APP ERROR]', event.message, 'at', event.filename + ':' + event.lineno + ':' + event.colno, event.error);
    }
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    console.error('[UNHANDLED REJECTION]', event.reason);
    var reason = event.reason && (event.reason.message || String(event.reason));
    if (reason && /Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(reason)) {
      recoverFromStaleAssets();
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      var onFabricSession = location.pathname.indexOf('fabric-session') !== -1;
      var isLocalDesktop = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) {
          var script = (reg.active && reg.active.scriptURL) ||
            (reg.waiting && reg.waiting.scriptURL) ||
            (reg.installing && reg.installing.scriptURL) ||
            '';
          if (isLocalDesktop || (!onFabricSession && script.indexOf('fabric-session-service-worker') !== -1)) {
            reg.unregister();
          }
        });
      }).catch(function () {});

      if (onFabricSession || isLocalDesktop) return;

      navigator.serviceWorker
        .register('/sw.js')
        .then(function (registration) {
          console.log('[SW] registered:', registration.scope);
        })
        .catch(function (err) {
          console.error('[SW] registration failed:', err);
        });
    });
  }
})();
