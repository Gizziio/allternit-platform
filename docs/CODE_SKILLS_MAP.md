# Code Skills view — Gap Map

**Item:** #23 Code Skills view (GAP → iOS)  
**Branch:** `feat/ios-code-skills`  
**Reference:** web `surfaces/ai.allternit.com/src/views/code/SkillsView.tsx`, backend `cmd/allternit-api/src/team_skill_routes.rs`

## Current state

- Web `SkillsView.tsx` is a static 3-item mock. It is not wired to any backend.
- Backend already has real `/api/v1/team-skills` routes (`team_skill_routes.rs`) backed by the `team_skills` table.
- iOS has no Skills view at all.

## Phase 1 plan

1. Update web `SkillsView.tsx` to fetch from `/api/v1/team-skills` and render real skills/plugins.
2. Add iOS models for team skills (`TeamSkill.swift`).
3. Add iOS API client `TeamSkillsClient.swift` for `/api/v1/team-skills`.
4. Add iOS store `TeamSkillsStore.swift`.
5. Build iOS `CodeSkillsView.swift` — grid of skill/plugin cards matching web.
6. Add entry point in iOS Code mode (CodeModeView or Code surface nav).

## Files

- Read:
  - `surfaces/ai.allternit.com/src/views/code/SkillsView.tsx`
  - `cmd/allternit-api/src/team_skill_routes.rs`
  - `surfaces/allternit-mobile/ios/Features/Code/Views/CodeModeView.swift`
- Write:
  - `surfaces/ai.allternit.com/src/views/code/SkillsView.tsx` (update)
  - `surfaces/allternit-mobile/ios/Core/API/Models/TeamSkill.swift`
  - `surfaces/allternit-mobile/ios/Core/API/TeamSkillsClient.swift`
  - `surfaces/allternit-mobile/ios/Core/TeamSkillsStore.swift`
  - `surfaces/allternit-mobile/ios/Features/Code/Views/CodeSkillsView.swift`
  - Update `surfaces/allternit-mobile/ios/Features/Code/Views/CodeModeView.swift` for entry point.

## Constraints

- Match existing iOS conventions.
- No backend schema changes (table already exists).
- No builds/typechecks; syntax review only.
