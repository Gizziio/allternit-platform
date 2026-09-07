# Steering checkpoint — session/office-fix2

Goal: Fix "add-in won't start" for hosted Allternit Word/Excel/PowerPoint add-ins.

Just did:
- Diagnosed live failure: manifest SourceLocation `.../taskpane/index.html?product=*` gets a Cloudflare Pages 308 (directory-index redirect); earlier the pane was also blocked by ghost X-Frame-Options: DENY + CSP frame-ancestors 'none' (now clear).
- build-manifest.mjs: SourceLocation now `.../src/taskpane/?product=*` (direct 200); version bump 1.1.0.0 -> 1.1.1.0.
- platform public/_headers: /office-addins/* allows framing (X-Frame-Options: ALLOWALL + CSP frame-ancestors for Office on the web origins), defensively ahead of the catch-all.
- verify-hosted-runtime.mjs: now fails on redirects (manual), XFO DENY, frame-ancestors 'none'. Verified it catches the current production 308.
- MS validator: "The manifest is valid."

Next: commit, push, PR, merge; verify live post-deploy (direct 200, no frame-blocking headers); refresh Desktop manifests for the user to re-upload in Word on the web.

Open questions:
- Where the transient XFO DENY came from (not in git _headers, gone after PR #114 deploy; possibly zone-level transform rule outside repo control). Defensive _headers rule mitigates repo-side recurrence.
