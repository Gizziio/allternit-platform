# Form Surfaces — Gap Map

**Item:** #55 Form Surfaces (GAP → iOS, gizzi-code)  
**Branch:** `feat/ios-form-surfaces`  
**Reference:** web `surfaces/ai.allternit.com/src/views/FormSurfacesView.tsx`

## Current state

- Web has `FormSurfacesView.tsx`: a form schema registry (hardcoded list) and a
  dynamic form renderer supporting text, number, select, textarea, toggle,
  slider, multiselect, and radio field types.
- The view is a standalone route (`nav.policy.ts`), not gated by Design-mode
  exclusion.
- iOS has no equivalent form builder/renderer.

## Phase 1 plan

Ship an iOS Form Surfaces browser + renderer.

1. Add `FormSchema` and `FormField` models matching the web shapes.
2. Build `FormSurfacesView.swift`:
   - Schema list (Agent Config, Deploy Config, Hook Registration, Model Picker,
     Project Setup) with field count and last-used metadata.
   - Schema detail with a dynamic form renderer for all supported field types.
3. Add a "Form Surfaces" row to `ComposerPlusSheet` as the entry point.

## Files

- Read:
  - `surfaces/ai.allternit.com/src/views/FormSurfacesView.tsx`
  - `surfaces/allternit-mobile/ios/Features/Chat/Views/ComposerPlusSheet.swift`
- Write:
  - `docs/FORM_SURFACES_MAP.md`
  - `surfaces/allternit-mobile/ios/Core/API/Models/FormSchema.swift`
  - `surfaces/allternit-mobile/ios/Features/Chat/Views/FormSurfacesView.swift`
  - Update `surfaces/allternit-mobile/ios/Features/Chat/Views/ComposerPlusSheet.swift`

## Constraints

- Match existing iOS conventions.
- No backend schema changes (form schemas are hardcoded on web too).
- No builds/typechecks; syntax review only.
- Phase 1 covers browse + render + local form state. Submit/persist is deferred.
