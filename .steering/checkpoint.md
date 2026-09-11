# Checkpoint — cream-squircle icon swap across AI product surfaces

## Goal
Swap every Allternit AI-product web surface to the new master icon
`/Users/joe/Desktop/icon-candidates-v7/01-a-only-cream-squircle.png`.

## Just did
- Generated all derived assets (favicon.png 256, icons 192/512, fabric-session
  icons + splash, brand/a-only-cream-squircle.png, console/office/phone-remote/
  computer-embed icons, desktop icon.png/icns/ico from master).
- Swapped all favicon.svg references to favicon.png; deleted every
  favicon.svg; bumped fabric-session SW CACHE_NAME v28→v29 (cache guard).
- Re-authored AProtocolWordmark to render the cream squircle PNG mark +
  kept TERNIT pixel letters (props API preserved).
- Removed dead remote-control surface (html/webmanifest/SW/icons/splash/
  vite config/deploy workflow) + legacy desktop refs. Kept the
  shell:open-remote-control IPC (fabric-session opener used by ai renderer).
- Fixed pre-existing breakage: fabric-session-icon-192/512.png recreated
  (referenced but missing on main); removed dead remote-control rollup
  input from vite.config.ts.
- Verified: ai/office/platform-console builds green, typecheck green,
  fabric PWA prepare green, release-preflight 35/0.

## Next
- Commit, push, PR, merge (CI deploys ai-allternit, allternit-platform,
  allternit-office). Then manual fabrictransport deploy (needs Eoj go-ahead).

## Open questions
- None blocking. Deferred: docs.allternit.com gets a different icon later;
  platform/shell removal is handled elsewhere (sync export already retired).
