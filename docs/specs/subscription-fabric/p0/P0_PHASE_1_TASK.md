# P0 Phase 1 Task — subscription-fabric-contracts: scaffolding + foundational schemas

You are building Phase 1 of 2 of the package `platform/packages/subscription-fabric-contracts/` (`@allternit/subscription-fabric-contracts`). This package holds the canonical TypeScript types + zod schemas for the Allternit Subscription Capability Fabric. **Do NOT start Phase 2 files** (task.ts, routing.ts, events.ts, index.ts, test/) — a second agent does those.

## Normative sources (read these first, transcribe faithfully)

- `docs/specs/subscription-fabric/REVIEW_CLAUDE.md` — §S1–S3, §S5–S6 (lines 106–217, 288–342) and §A1 (lines 361–417) are the **normative type definitions**. Transcribe them into zod schemas with `z.infer` TypeScript types. Field names, optionality, and union members are binding.
- `docs/specs/subscription-fabric/SPEC.md` §13 (line 593) — canonical artifact types.
- `docs/specs/subscription-fabric/HARDENING.md` — binding amendments; SessionHealth union is at line 38.

## Exact deliverables

Create `platform/packages/subscription-fabric-contracts/` with:

1. `package.json` — model it on `platform/packages/replies-contract/package.json` (ESM, `"main": "./src/index.ts"`, exports map, scripts `typecheck`/`build` = tsc). Name `@allternit/subscription-fabric-contracts`, version `0.1.0`. Add dependency `"zod": "^3.25.0"` and devDependency `"typescript": "^5.3.0"`, plus `"vitest": "^1.0.0"` as devDependency (Phase 2 adds the test script; you may add `"test": "vitest --passWithNoTests"` now).
2. `tsconfig.json` — copy `platform/packages/replies-contract/tsconfig.json` exactly.
3. `src/capability.ts` — §S1: `CapabilityId` (template-literal type `` `${string}.${string}` `` + zod refinement), `CapabilityDef` (id, version, input_schema, output_artifact_types, side_effects, requires_thread, long_running_hint). Also define the **shared primitives** other files import:
   - `ProviderId` — branded/opaque `string`, **NOT** a union of provider-name literals (hard gate below).
   - `ArtifactType` — enum: `text, image, document, pdf, presentation, spreadsheet, website, code_project, archive, video, audio, html_app` (SPEC §13 list + `html_app` per §S5).
   - `Sensitivity` — `public | internal | confidential | local_only`.
   - `ModelClass` — `fast | standard | reasoning | deep` (§S1).
   - `JSONSchema` — minimal recursive JSON-Schema type (or `z.record(z.unknown())`-compatible shape); document the choice in one line.
4. `src/manifest.ts` — §S2: `AdapterManifest`, `PlanDef` (not defined in the review — define minimally: `plan_id`, `label`, optional `notes`), `PacingProfile` per §A5 (REVIEW_CLAUDE.md line 469: `min_action_gap_ms: [number, number]`, `min_task_gap_s`, `max_tasks_per_hour`, `max_tasks_per_day`, optional `quiet_hours: [number, number]`).
5. `src/account.ts` — §S3: `Account`, `SessionHealth` (union from HARDENING line 38: `ready | degraded | auth_required | challenge_presented | account_restricted | ui_drift | provider_down | profile_locked`).
6. `src/quota.ts` — §S3: `QuotaPool`, `QuotaSignal`, `Entitlement` (comment that Entitlement is a computed join, never a stored record).
7. `src/artifact.ts` — §S5: `Artifact` exactly as specified, including `source`, `context`, `storage` (with `retrieval_state`), `lineage`, `capabilities`, `trust: "untrusted_provider_output"` (zod literal), `sensitivity: Sensitivity` (imported from capability.ts — do NOT import from task.ts, it doesn't exist yet). Also `ArtifactFile` (bytes/blob-ish carrier returned by fetchArtifact/exportArtifact — define minimally: `data: Uint8Array`, `mime_type`, `format`, `sha256`, `size_bytes`) and `ProviderArtifactRef` (minimal: `provider`, `provider_artifact_id`, `provider_url`, `provider_url_expires_at`).
8. `src/thread.ts` — §S6: `ThreadMapping` exactly as specified. Also `ThreadSnapshot` (used by A1 `readThread` for divergence checks — define minimally: `provider_thread_id`, `turn_count`, `last_turn_fingerprint`, `observed_at`).

## Hard gates (will be checked in review)

- **No provider-name literals anywhere in the package.** `grep -ri "chatgpt\|claude\|kimi\|gemini\|grok\|deepseek\|openai\|anthropic" src/ package.json` must return nothing (except this note's absence — the string "kimi" etc. must not appear at all).
- Every interface from the normative sections exists as a zod schema + exported inferred type, same field names.
- zod v3 idiom (`z.object`, `z.enum`, `z.union`, `z.literal`, `.nullable()` vs `.optional()` chosen to match the spec's `| null` vs `?`).
- No comments that narrate what code does beyond one-line pointers to the normative section (e.g. `// §S3`).
- **No git operations. No dev servers.** You MAY run `pnpm install` (from repo root, pnpm only — never npm) and `pnpm -F @allternit/subscription-fabric-contracts typecheck` to verify your work; both must pass before you finish.

## Completion sentinel

When finished, write `docs/specs/subscription-fabric/p0/P0_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done|blocked
files_changed: [list of paths]
deviations: [what + why, or none]
remaining: [items for Phase 2, or none]
---
```

then prose notes. That file existing = done.
