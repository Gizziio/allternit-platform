# cu29 — move Workflows panel to live fabric-transport surface

Goal: fix cu28 (PR #503) surface placement error. The Workflows panel landed in the
LEGACY `src/remote-control/` tree; the live surface is `src/views/FabricTransportView.tsx`
(served by `src/shell/ViewRegistry.tsx` for `remote-control` + `fabric-session` view ids).

## Steps

1. Move `src/remote-control/api/workflows.ts` → `src/lib/browser-skills-api.ts`
   (FabricTransportView's clients live in `src/lib/`, e.g. `fabric-transport-api.ts`).
2. Move/adapt `src/remote-control/api/workflows.test.ts` → `src/lib/browser-skills-api.test.ts`.
3. Add a Workflows section to `FabricTransportView.tsx` (same file, view idioms:
   `Section`, `Mono`, bounded+ aborted polling, canonical server data only) — same behavior
   as the cu28 panel: spec list, NetworkTrace view, self-check + target verify runners,
   verdict + deviations + receipt tamper check. API unchanged (`/v1/browser-skills`).
4. New component test `src/views/FabricTransportView.test.tsx` covering the section.
5. Revert legacy tree: delete `WorkflowsPanel.tsx`, `api/workflows.ts`,
   `api/workflows.test.ts`, and the DashboardPage mount.
6. Update contract doc `domains/computer-use/docs/network-trace-surfaces.md`
   (console home = Fabric Transport view; legacy tree out of scope).
7. Verify: `tsc` clean on touched files, console vitest green. Commit, push, PR, merge,
   attest, cleanup.

Boundary check done: WorkflowsPanel consumed only by `src/remote-control/pages/DashboardPage.tsx`;
legacy tree has its own `main.tsx` (separate legacy PWA), untouched otherwise.
