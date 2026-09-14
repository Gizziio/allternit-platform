# Steering checkpoint — session/e6-0914

## Goal
Make cloud continuation actually forward work to an always-on API instead
of only retagging local jobs.

## Just did
Quit handoff POSTs ingest (envelope + bounded folders). 409 without
URL+token. Cloud routines created remotely. Tests: placement 8/8,
pack_skips ok.

## Next
Commit, PR. Still operator-owned: always-on API + gizzi-cloud process.
