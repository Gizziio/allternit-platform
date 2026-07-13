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

Implemented `formatDoctorReport(report: OrchestratorDoctorReport): string` in `runtime-discovery.ts` and re-exported it from `index.ts`. The formatter emits a deterministic, newline-terminated report: a status line, a checked-at line, and one line per vendor in report order. Each vendor line includes the vendor name, binary, installation state, interactive/headless support, optional version, missing flags, and any error, with CR/LF sequences normalized to spaces to keep each vendor on a single line. Added a short README example showing `doctor()` followed by `formatDoctorReport()` without presenting it as a CLI command.
