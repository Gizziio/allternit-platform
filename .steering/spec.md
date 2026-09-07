# Steering spec — public dual-API content pass

Public docs and website must describe the production control-plane / data-plane split. Source of truth: `docs/architecture/2026-09-03-control-plane-data-plane-decision.md` (D1–D5) and the live services (`api.allternit.com` = cloud-api; `allternit-api` :8013 is never public).

## Requirements

- [ ] R1: WHEN a reader opens the API docs, THE SYSTEM SHALL present one public API (`https://api.allternit.com`, Cloud API / `cmd/allternit-cloud-api`) and one private data-plane runtime (Allternit API / `cmd/allternit-api`, port 8013, SQLite, not publicly reachable).
- [ ] R2: WHEN BYOC / architecture / introduction describe deployment, THE SYSTEM SHALL list three data-plane modes: local desktop, user-paired box, Allternit-provisioned instance — not “control plane = Vercel” or “runtime.yaml on port 8080” as the production story.
- [ ] R3: WHEN Cloud API env/docs mention `DATABASE_URL`, THE SYSTEM SHALL state production uses Postgres (SQLite is local/dev only).
- [ ] R4: WHEN agent-sessions / office / beta research are documented as public routes, THE SYSTEM SHALL state they are Cloud API handlers that authenticate with Clerk, resolve the caller’s default node, and relay to that node (HTTP 428 if none is healthy).
- [ ] R5: WHEN SDK / marketing / platform console examples name a Cloud API host, THE SYSTEM SHALL use `https://api.allternit.com` — never `allternit-cloud-api.fly.dev` or `http://localhost:8013` as the public base URL.
- [ ] R6: WHEN docs.json is built, THE SYSTEM SHALL list `api/overview`, `api/cloud-api`, and `api/allternit-api` in the API Reference Overview group so the dual-API pages are navigable.

## Acceptance

- Scenario: public topology
  Given docs.allternit.com after this merge
  When a reader opens API Overview
  Then they see Cloud API vs Allternit API, one public origin, and 8013 as data plane only.
- Scenario: stale BYOC
  Given byoc/overview.mdx
  When a reader opens it
  Then the diagram is not “Control Plane (Vercel)” / “allternit-runtime :8080”.
- Scenario: marketing
  Given allternit.com/docs
  When the sample client is shown
  Then the base URL is api.allternit.com.
