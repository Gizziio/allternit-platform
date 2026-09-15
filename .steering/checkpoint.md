# Steering checkpoint — session/clerk-js-proxy-0915

- **Goal:** Follow-up to #550. Local clerkJSUrl made clerk-js look for sibling chunks on the auth origin (ChunkLoadError). Load clerk-js from the proxy via net.fetch instead.
- **Verified live:** after asar patch, `Clerk session token received from renderer` twice (`gizzi_io@proton.me`). `/health` 200. No `failed_to_load_clerk_js`.
- **Next:** commit, PR, merge, attest, cleanup.
