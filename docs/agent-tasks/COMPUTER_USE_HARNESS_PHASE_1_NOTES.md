---
status: done
files_changed:
  - docs/agent-tasks/COMPUTER_USE_HARNESS_MAP.md
  - surfaces/ai.allternit.com/src/views/api-capture/ApiCaptureView.tsx
  - surfaces/ai.allternit.com/src/lib/api-capture/index.ts
  - cmd/allternit-api/src/har_api_routes.rs
  - services/page-agent/src/index.ts
  - services/page-agent/src/types.ts
  - services/page-agent/src/client.ts
  - cmd/allternit-api/src/page_agent_routes.rs
deviations: []
remaining: []
---

# Computer Use Harness Integration — Phase 1 Notes

## Summary
Completed research and capability mapping across the 7 computer-use and browser/mobile harness projects, promoted `page-agent` into a shared workspace service with canonical Rust API proxies, and fully integrated HAR-derived API capture and client generation into the ACI and Site APIs platform views.

## Key Accomplishments
1. **Computer Use Harness Map**:
   - Authored `docs/agent-tasks/COMPUTER_USE_HARNESS_MAP.md` covering `agent-desktop`, `computer-use-mcp`, `page-agent`, `mobile-harness`, `phone-harness`, `apitap.io`, and `browse.sh`.
2. **Page Agent Shared Service Promotion**:
   - Packaged `services/page-agent` with strongly typed event streaming, lifecycle management (`run`, `stop`, `status`), and runtime clients.
   - Mounted proxy routes in `cmd/allternit-api/src/page_agent_routes.rs` under `/api/page-agent/*`.
3. **HAR-Derived API Capture (Site APIs)**:
   - Built interactive HAR ingestion, endpoint replay, and TypeScript/Python client generation in `surfaces/ai.allternit.com/src/views/api-capture/ApiCaptureView.tsx`.
   - Wired backend contract synthesis and HAR parsing in `cmd/allternit-api/src/har_api_routes.rs`.
   - Integrated ACI browser capture navigation and rail item registration.

## Verification
- Rust backend: `cargo check --package allternit-api` passing with 0 errors.
- Frontend: TypeScript compiles cleanly across all modified views and shared packages.
