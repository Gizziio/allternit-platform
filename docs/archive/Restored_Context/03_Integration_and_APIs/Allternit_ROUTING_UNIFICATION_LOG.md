# Allternit Platform: Routing Unification & Proxy Fix Log

## 1. Resolved Issues

### [GATEWAY] - Missing Routes Added
- **Problem:** UI was hitting 404s for chat and session paths at port 8013.
- **Fix:** Added `/api/chat`, `/session`, and `/api/v1` catch-all handlers to the Gateway (8013) that proxy to the Rust API (3000).
- **Result:** Gateway is now a complete entry point for the entire platform.

### [UI] - Relative Path Mismatch Fixed
- **Problem:** UI was using relative paths (e.g., `/api/v1/providers`) which hit the Vite server (5177), resulting in 500 errors.
- **Fix:** Refactored `AgentView`, `OperatorBrowserView`, and `CoworkStore` to use absolute `GATEWAY_URL` (8013).
- **Result:** All UI traffic is correctly steered through the Gateway.

### [API CLIENT] - Single Source of Truth
- **Problem:** Mismatch between `DEFAULT_GATEWAY_URL` (3210) and actual usage (8013).
- **Fix:** Updated `api-client.ts` to default to 8013 and ensured the `baseUrl` property is always used for requests.
- **Result:** Consistent behavior across all platform modules.

## 2. Verified End-to-End Path
The following path is now end-to-end operational:
`Chat UI` -> `Gateway (8013)` -> `Rust API (3000)` -> `Rust Kernel (3004)` -> `TS Service (3005)`.

**The Allternit Platform is GO.**
