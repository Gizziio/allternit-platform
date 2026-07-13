# Orchestrator Doctor Format — Gate Run 3 Task

Implement a deterministic human-readable formatter for the existing runtime discovery doctor report.

## Exact scope

You may modify only:

- `packages/@allternit/orchestrator/src/runtime-discovery.ts`
- `packages/@allternit/orchestrator/src/index.ts`
- `packages/@allternit/orchestrator/README.md`
- `docs/ORCHESTRATOR_DOCTOR_FORMAT_NOTES.md` (required completion sentinel)

Do not modify any other file. Do not run builds, tests, typechecks, dev servers, or git commands.

## Required behavior

1. Export `formatDoctorReport(report: OrchestratorDoctorReport): string` from `runtime-discovery.ts` and make it available from the package public index.
2. The output must be deterministic for the supplied report and end with a newline.
3. First line: `Orchestrator doctor: OK` when `report.ok` is true, otherwise `Orchestrator doctor: NO USABLE EXECUTORS`.
4. Second line: `Checked: <checkedAt>`.
5. Emit one line per vendor, preserving report order, with the vendor and binary plus these states:
   - installation: `installed` or `not installed`
   - interactive: `interactive=yes` or `interactive=no`
   - headless: `headless=yes` or `headless=no`
   Include `version=<version>` only when present.
6. If a probe has missing flags, append `missing interactive flags: ...` and/or `missing headless flags: ...` on that vendor line. If it has an error, append `error: ...`. Keep user-provided strings on one line by replacing CR/LF sequences with spaces.
7. Add a short README example showing `doctor()` followed by `formatDoctorReport()`; do not claim it is a CLI command.

## Completion contract

Write `docs/ORCHESTRATOR_DOCTOR_FORMAT_NOTES.md` only when finished. It must begin with valid YAML frontmatter exactly shaped like:

```yaml
---
status: done
files_changed:
  - packages/@allternit/orchestrator/src/runtime-discovery.ts
  - packages/@allternit/orchestrator/src/index.ts
  - packages/@allternit/orchestrator/README.md
  - docs/ORCHESTRATOR_DOCTOR_FORMAT_NOTES.md
deviations: []
remaining: []
---
```

After the frontmatter, briefly summarize the implementation. If blocked, use `status: blocked` and explain honestly in `remaining`.
