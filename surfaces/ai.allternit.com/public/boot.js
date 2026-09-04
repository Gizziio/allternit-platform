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

  window.addEventListener('error', function (event) {
    console.error('[APP ERROR]', event.message, 'at', event.filename + ':' + event.lineno + ':' + event.colno, event.error);
  });
  window.addEventListener('unhandledrejection', function (event) {
    console.error('[UNHANDLED REJECTION]', event.reason);
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
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
