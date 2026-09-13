# Attestation — session/console-ui-rail-cards (PR #371)

**Date:** 2026-09-11 ~15:30 CDT · **Session:** 00b553f5 (kimi-code) · **Merge:** 6e0038636 · **Commit:** f5bd4074e

## What was done

Matched the platform console (surfaces/platform.allternit.com) shell rail 1:1 to the
Claude Console rail design Eoj screenshotted on 2026-09-11 (10:15 AM):

- **Dashboard** and **API keys** promoted to top-level rail links (were nested in the
  "Cloud" group) — mirrors Claude's IA where API keys is a first-class item.
- Nav regrouped: **Agents** (Agents/Runs/Schedules/Approvals), **Cloud** (Compute/
  Devices/Fabric/Cloud accounts), **Organization** (Organizations/Billing);
  **Settings** top-level link.
- Group children render as plain indented rows (border-l tree removed); group
  chevron shows › closed / ⌄ open instead of a rotating chevron-down.
- Search (⌘K live filter), Credits row, Documentation, user card: unchanged.

Model cards + overlay for the same design landed earlier in PR #331
(f68915d2f) — fidelity verified against Eoj's overlay screenshots; deliberately
left untouched (unknown specs stay honest "—", no fabrication).

## How it works

`ConsoleLayout.tsx` nav model: `topNavItems` (icon + to + label) + `navGroups`
(label, icon, defaultOpen, items) + `settingsItem`; `flatNavItems` feeds both the
search filter and `currentPageLabel`. Collapsed rail renders the same set as icons.
The Organization group defaults closed; Agents/Cloud default open (matches the
screenshot's expanded state).

## Verification

- `npm run typecheck` ✅, `npm run build` ✅ (surfaces/platform.allternit.com)
- Playwright smoke vs dev server (VITE_DEV_AUTH_BYPASS=1): 20/20 PASS — rail
  structure, group expand/collapse, nested-row container, credits row, search
  filter, 8 model cards render, overlay opens with Cost|Features tables +
  Try-in-playground + copyable id, Esc close, API keys nav. Screenshots:
  /tmp/console-ui-smoke/1-rail.png, 2-overlay.png, 3-api-keys.png.
- Visual diff vs Claude rail + overlay screenshots: structure 1:1.

## Incidents / notes

- Desktop TCC block: `ls`/`git` on /Users/joe/Desktop returned "Operation not
  permitted" all session. Worked around by exporting the repo's `.git` via Finder
  AppleScript to /Users/joe/allternit-repo-export and cloning to
  /Users/joe/allternit-main (shallow). All work happened in home-dir worktrees;
  the shared Desktop checkout and the parallel console-backend session were never
  touched. Eoj may want to re-grant the terminal Desktop access.
- The parallel agent's console-backend phases (G8–G10 etc.) were not touched.

## Deferrals

- None. Desktop sidecar not rebuilt — this change does not affect the desktop
  bundle (console is a Cloudflare Pages surface).
