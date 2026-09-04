
## Addendum (same session, continued)
Also fixed two launch blockers found while landing the above:
1. **pnpm install totally broken** — `surfaces/ai.allternit.com/package.json` declared
   `@allternit/allternit-office-suite: workspace:*`, a package name that does not exist
   (the real package `@allternit/office-suite` was already declared and is what src
   imports). This drifted pnpm-workspace.yaml overrides from the lockfile, so CI's
   `pnpm install --frozen-lockfile` failed and NOTHING could deploy (3+ consecutive
   red runs). Removed the phantom dep, regenerated pnpm-lock.yaml, verified frozen
   install. (commits a165be187 / merge c7e635031)
2. **vite build broken by bad merge ea89a5fdb** — two identical `const submitMessage`
   declarations in `src/views/chat/ChatComposer.tsx`. Kept the canonical-agent-mode
   (OR) variant wired to submitMessageRef, dropped the stale copy. `pnpm build`
   verified locally. (merge d77353655)
3. **robots.txt/404.html swallowed by catch-all** post-deploy — added explicit
   _redirects pass-throughs. (merge eceaad535)

Final state: deploy-cloudflare-pages.yml green; platform.allternit.com and
ai.allternit.com both deploy from main again.
