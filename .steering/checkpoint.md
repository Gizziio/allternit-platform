# Steering checkpoint

Goal: Merge office+beta flags (PR #94), then P2 fleet, then chores.

Just did:
- Dogfood agent-sessions end-to-end on the paired mail node (list 200, create 201 ses_f906ca6a1ffeuNrD4WSjpYnTE6, get 200). Root cause was gizzi JWKS defaulting to clerk.platform.allternit.com; set GIZZI_CLERK_JWKS_URL to clerk.allternit.com.
- Typography CI: drop font-family from 404.html and desktop-cloud-admin.html so validate-typography passes.

Next: push/merge PR #94; watch Pages + cloud-api deploys; P2 NODE_RELEASE_URL tarball + create instance; 8013 newer binary; Tailscale tag:ci ACL; secret rotation.

Open questions: none for flags. P2 still needs a published linux-x86_64 allternit-api tarball and the allternit-node Incus image.
