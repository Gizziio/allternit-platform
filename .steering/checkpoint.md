# Steering checkpoint

Goal: Enable office+beta production flags; accept Clerk proxy issuer; keep rolling remaining owner work (P2 fleet, 8013 migrations, secrets).

Just did:
- NEXT_PUBLIC_ALLTERNIT_OFFICE_API=1 and BETA_API=1 in .env.production and Pages build env.
- cloud-api Clerk verifier accepts comma-separated issuers and always includes https://allternit.com/__clerk (browser proxy JWTs).

Next: commit/push/merge; register provisioned_hosts on mail; 8013 V124–V130 need a newer allternit-api binary (current max is v102).

Open questions: Incus client certs for P2 create() from cloud-api.
