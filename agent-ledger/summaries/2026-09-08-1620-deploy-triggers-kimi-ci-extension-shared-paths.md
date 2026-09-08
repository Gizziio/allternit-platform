# Session attestation — session/deploy-triggers

- **Date/Time:** 2026-09-08 16:20 local
- **Session ID / Branch:** `session/deploy-triggers` (worktree `allternit-session-deploy-triggers`)
- **Agent:** kimi (Kimi Code CLI subagent)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/153 — MERGED
- **Merge SHA:** `df60f63e7ee35b36fa578c54484e811de977f415` (merge commit)
- **Change commit:** `56cdba1a9`

## What was done

Fixed a CI path-filter gap that let an extension-shared-only PR merge with no
Pages deploy:

- `.github/workflows/deploy-cloudflare-pages.yml` — added
  `surfaces/allternit-extensions/extension-shared/**` to `on.push.paths`,
  next to the existing `allternit-office-addin/**` entry. Root cause of the
  stale live pane bundle: PR #151 touched only `extension-shared/**`, which
  was not in the deploy workflow's path filter, so the office-addins Pages
  staging step (which builds dist from `@allternit/office`, bundling
  extension-shared code) never ran.
- `.github/workflows/build-office-addin.yml` — verified, **no change needed**:
  `extension-shared/**` was already present in both `push.paths` and
  `pull_request.paths`.

## How it works

GitHub Actions `on.push.paths` is an OR-filter over changed files. Adding the
extension-shared glob means any push to main that modifies shared extension
code now triggers the full deploy workflow, including the office-addins Pages
deploy step.

## Verification

- `python3 yaml.safe_load` on both workflow files (YAML 1.1 `on:` key handled
  by checking `True` fallback); confirmed the new glob appears in the deploy
  workflow's push paths and that build-office-addin.yml lists it in both
  trigger blocks.
- `git diff --stat`: 1 file changed, 1 insertion — nothing else touched.

## Incidents / honest deferrals

- None. The live pane bundle remains stale until the next qualifying push
  (or `workflow_dispatch`, which the deploy workflow already supports) —
  rerunning the deploy for PR #151's content is an ops decision left to the
  owner.
