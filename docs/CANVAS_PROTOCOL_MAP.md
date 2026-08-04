# Canvas Protocol — Gap Map

**Item:** #56 Canvas Protocol (PARTIAL → iOS)  
**Branch:** `feat/ios-canvas-protocol`  
**Reference:** Rust `platform/protocols/canvas-protocol/src/lib.rs`, iOS
`surfaces/allternit-mobile/ios/Core/API/CanvasClient.swift`

## Current state

- Rust crate defines 40+ canonical `CanvasViewType`s plus `CanvasSpec`,
  `CanvasBindings`, `DataShape`, `CanvasInteraction`, `CanvasFilter`,
  `CanvasRisk`, and `ProvenanceUI`.
- iOS `CanvasClient` only handles artifact canvases: list, create artifact
  canvas, update artifact canvas (3 methods). It has no model for the canvas
  protocol itself.
- The backend canvas routes (`canvas_routes.rs`) persist arbitrary `metadata`
  JSON, so canvas protocol specs can ride inside canvas metadata without a
  schema change.

## Phase 1 plan

Extend iOS canvas support to understand and persist the canvas protocol.

1. Add `CanvasProtocol.swift` models matching the Rust crate's public shapes.
2. Extend `CanvasClient`:
   - `createCanvas(sessionId:spec:components:)` — create a canvas with a
     canvas-protocol spec embedded in `metadata`.
   - `updateCanvasSpec(canvasId:spec:)` — PATCH the canvas metadata to store a
     new/updated spec.
   - `getCanvasSpec(canvasId:)` — GET the canvas and decode the spec from
     `metadata`.
   - Keep the existing artifact helpers unchanged.
3. Add `CanvasRecord.spec` helper that decodes the spec from metadata.

## Files

- Read:
  - `platform/protocols/canvas-protocol/src/lib.rs`
  - `surfaces/allternit-mobile/ios/Core/API/CanvasClient.swift`
- Write:
  - `docs/CANVAS_PROTOCOL_MAP.md`
  - `surfaces/allternit-mobile/ios/Core/API/Models/CanvasProtocol.swift`
  - Update `surfaces/allternit-mobile/ios/Core/API/CanvasClient.swift`

## Constraints

- Match existing iOS conventions.
- No backend schema changes (spec rides in existing `metadata` JSON column).
- No builds/typechecks; syntax review only.
- Phase 1 adds protocol models and CRUD helpers. Runtime instantiation of the
  40+ view types is deferred.
