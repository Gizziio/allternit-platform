
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

## Addendum 2 — auth-route identity rewrites 404'd (merge 281ff4732)
The export's `public/_redirects` rewrote `/sign-in`, `/sign-up`, `/shell`, `/connect`
to themselves with status 200 (an SPA-fallback workaround from when the build
prerendered those routes). The current build no longer emits those HTML files, so
each self-rewrite resolved to a missing file and returned a hard 404 — verified live
on both ai.allternit.com and platform.allternit.com. Removed the four identity
rewrites; the generic `/* /index.html 200` SPA fallback now serves them. Verified
`/sign-in`, `/sign-up`, `/shell` → 200 on both domains post-deploy. Sync bot carried
the export to allternit-websites main (commit 42105f78).
