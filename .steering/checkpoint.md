# Steering checkpoint — session/clerk-js-load-0915

- **Goal:** Fix desktop auth renderer `failed_to_load_clerk_js`.
- **Just did:** net.fetch + bypass for intercepted https; persist Set-Cookie; clerk-js staged into the auth renderer and loaded from the same origin.
- **Verified:** vitest 159/159; `node scripts/build-auth-renderer.cjs` staged clerk.browser.js (314K).
- **Next:** commit, PR, merge, rebuild/install the packaged app so the running Desktop picks this up.
- **Open questions:** None.
