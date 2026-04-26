# KERNEL UI ADAPTERS

## Read Hooks
- `useThreads()`: Maps to `kernel.listWih({ type: 'session' })`.
- `useProjects()`: Maps to `kernel.listWih({ type: 'project' })`.
- `useReceipts(wihId)`: Pulls trace/artifact receipts for a task.
- `useLogs()`: Subscribes to `RuntimeBridge` audit logs.

## Write Actions
- `spawnSession(agentId)`: `bridge.prepareSessionInit()` + `kernel.createWih()`.
- `submitPrompt(sessionId, text)`: `bridge.executeTool('send_message', ...)`.
- `applyGovernance(wihId, decision)`: `kernel.updateWih(wihId, { status: decision })`.

## Bridge Locations
All adapters must live in: `packages/allternit-platform/src/integration/kernel/*.ts`
