# Phase A — Fix platform shell startup loop

## Problem
The authenticated platform shell (`ShellApp.tsx`) crashed on startup with a React "Maximum update depth exceeded" error. The console also warned:

```
Warning: The result of getSnapshot should be cached to avoid an infinite loop
    at ShellAppInner
```

The stack pointed to `useStackProviders` → `StackedAgentService.subscribe`.

## Root cause
`useStackProviders` uses `useSyncExternalStore`:

```tsx
const state = useSyncExternalStore(
  (callback) => stackedAgentService.subscribe(callback),
  () => stackedAgentService.getState(),
  ...
);
```

React's `useSyncExternalStore` requires the snapshot returned by `getSnapshot` to be referentially stable when the underlying data has not changed. `StackedAgentService.getState()` was returning a fresh object on every call:

```ts
getState(): StackedAgentSyncState {
  return { ...this.state };
}
```

Because React calls `getSnapshot` during render and after every external-store emission, the new object reference made React believe the store had changed on every render, triggering a re-render, which called `getSnapshot` again, producing another new object — an infinite loop.

## Fix
Updated `surfaces/ai.allternit.com/src/lib/bots/stacked-agent.service.ts` to cache the snapshot and only create a new object when the internal `state` reference changes:

```ts
private lastStateRef: StackedAgentSyncState | null = null;
private cachedSnapshot: StackedAgentSyncState | null = null;

getState(): StackedAgentSyncState {
  if (this.cachedSnapshot === null || this.lastStateRef !== this.state) {
    this.lastStateRef = this.state;
    this.cachedSnapshot = { ...this.state };
  }
  return this.cachedSnapshot;
}
```

This preserves the existing immutable-update pattern (`this.state = { ... }` replacements in `sync()`) while giving React the stable snapshot it requires.

## Verification
1. Started the Allternit API on `http://127.0.0.1:8013`.
2. Started the platform Vite dev server on `http://127.0.0.1:3013`.
3. Opened the shell with Playwright and captured console/page errors.
4. Confirmed the "Maximum update depth exceeded" error no longer appears.
5. Clicked the "Desktop Cloud" rail item; the `DesktopCloudAdminView` rendered with live data:
   - Templates: 3
   - Sandboxes: 0
   - Usage: 2h 1m
   - Cost: $6.05
   - Capacity: Microvm Healthy
   - Provision form with bots and templates.

### Screen recording
- `docs/desktop-cloud-mvp/phaseA-shell-fix-demo.webm` (459 KB)
- Shows the shell loading and the Desktop Cloud admin view opening end-to-end.

## Known remaining blocker
`ChatComposer.tsx` has a pre-existing `ReferenceError: Cannot access 'submitMessage' before initialization` that causes the default chat view to show an error boundary. This error is unrelated to the `useStackProviders` loop or the Desktop Cloud integration; it reproduces before the Desktop Cloud rail is clicked and does not prevent the Desktop Cloud view from loading.

## LOC
- Change to `stacked-agent.service.ts`: ~10 lines added.
- Well under the 1,500 LOC feature limit.
