# Session summary — office-appdomains (Clerk auth origins in AppDomains, manifests 1.1.2.0)

- **Date/Time:** 2026-09-07 12:04 local (CDT)
- **Agent family:** kimi
- **Branch:** `session/office-appdomains` @ 564ea76c6, merged to main @ 996ade74b (PR #124)
- **Context:** Live acceptance of the hosted add-in (after office-fix2 PR #116 and the isolated-hosting move in office-host2 PR #120) hit the next blocker: clicking **Connect Allternit** in the hosted pane failed with *'The domain of the URL is not included in the AppDomains element in the manifest'*.

## What was done

Root cause: the auth bridge dialog (`platform.allternit.com/office-auth-bridge`, opened via `displayDialogAsync`) hands off to Clerk sign-in, which navigates to `clerk.allternit.com`, `*.clerk.dev`, `*.accounts.dev`, and the Cloudflare Turnstile challenge origin — all refused by Office unless listed in the manifest's AppDomains.

Fix (PR #124):

- `surfaces/allternit-extensions/allternit-office-addin/manifest.host.template.xml` — added `https://clerk.allternit.com`, `https://*.clerk.dev`, `https://*.accounts.dev`, `https://challenges.cloudflare.com` to `<AppDomains>` (with a comment explaining why).
- `scripts/build-manifest.mjs` — default version bumped 1.1.1.0 → **1.1.2.0** so clients refresh.
- Regenerated manifests: `manifest.xml`, `manifests/word.xml`, `manifests/excel.xml`, `manifests/powerpoint.xml` all at 1.1.2.0 with the new AppDomains.
- Manifests manually deployed to the isolated `allternit-office-addins` Pages project (the CI deploy job was at that moment blocked by an unrelated pnpm install breakage from another session's lockfile merge; the hosted verification passes from the manual deploy).

## Verification evidence

- `npx office-addin-manifest validate` → "The manifest is valid."
- Live manifests at `https://allternit-office-addins.pages.dev/office-addins/manifests/` verified at v1.1.2.0 with the new AppDomains entries.
- Strengthened `test:hosted` (`verify-hosted-runtime.mjs`) passes against the isolated origin.

## Incidents / honest deferrals

- The manifests on the isolated project were deployed **manually**, not by CI, because the CI pnpm install was broken at the time (another session's lockfile merge). Once CI is green again, the next merge will redeploy via the office-host2 workflow step — state will converge automatically.
- Owner's live acceptance (Connect Allternit → Clerk sign-in completes inside the Office dialog → full AI chat) remains the follow-up; if Office rejects any further Clerk/accounts subdomain in the wild, it must be added to the template's AppDomains.
- Shared checkout left untouched (it holds another session's uncommitted LEDGER.md/pnpm-lock.yaml changes).

## Merge

- PR #124 (merge commit) → main @ 996ade74b.
