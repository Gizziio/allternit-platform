# Code Mode hero usage state

## Goal

Define the empty-session hero for Code Mode so the landing surface is never empty after the user dismisses the Usage dashboard, while keeping the dashboard itself unchanged.

## Current behavior

When no Code session is active, `CodeCanvas.tsx` renders `LaunchpadStage`, which centers a greeting and the Usage dashboard.

- **Primary content**: `CodeUsageDashboard` shows code-mode usage stats and costs.
- **Dismiss action**: The dashboard exposes a close control. Clicking it sets local `showUsage` to `false`.
- **Restore action**: When `showUsage` is `false`, a compact "Show usage" pill appears in the same place. Clicking it restores the dashboard.
- **Removed content**: The Scaffold / Refactor / Debug / Optimize / Explore quick-action pills that previously rendered under the dashboard have been removed from the hero. The state and props for those pills still exist in `CodeCanvas.tsx` but are not rendered in `LaunchpadStage`.

## Non-goals

- Do not change `CodeUsageDashboard` internals, data sources, metrics, or refresh logic.
- Do not change the session-mount or workspace flows; those are covered by `code-session-mount-and-pane.md`.

## File map

| Concern | File | Notes |
|--------|------|-------|
| Empty-session hero layout | `surfaces/ai.allternit.com/src/views/code/CodeCanvas.tsx` | `LaunchpadStage` component, lines around the `showUsage` ternary |
| Usage dashboard | `surfaces/ai.allternit.com/src/views/code/CodeUsageDashboard.tsx` | unchanged except for the `onClose` callback it receives |
| Regression coverage | `surfaces/ai.allternit.com/src/views/code/CodeCanvas.test.tsx` | verifies dashboard close/restore and absence of the old action row |

## State model

```
showUsage: boolean  // local useState in LaunchpadStage
  true  -> render CodeUsageDashboard
  false -> render "Show usage" restore button
```

No other Code Mode state is affected by this interaction.

## UX principles

1. **Reversible dismissal**: closing the dashboard must not leave a blank hole; the restore control is in the same visual position.
2. **Minimal chrome**: the restore control is a single pill, not a toolbar or card.
3. **No data loss**: the dashboard is unmounted from the DOM when closed, but its data source is independent and re-fetches when restored.

## Testing

- `CodeCanvas.test.tsx` mocks `CodeUsageDashboard` and provides a close button.
- It asserts the dashboard is present on initial render and the old `code-launchpad-actions` row is absent.
- It fires the close button, asserts the dashboard disappears and the `code-show-usage` restore button appears, then restores the dashboard.

## Known follow-ups

- The dead quick-action state (`activeActionId`, `CODE_ACTION_GROUPS`, etc.) still lives in `CodeCanvas.tsx` and is passed through `CodeSessionSurface` to `LaunchpadStage`/`ConversationStage` but is not rendered. A future cleanup pass can remove it entirely without changing the hero UX.
