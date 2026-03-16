# Runtime Type Error Analysis Report

**Project:** a2r-platform  
**Analysis Date:** 2026-03-06  
**Total Files Analyzed:** 1,143 TypeScript/JavaScript files

---

## Executive Summary

This report identifies **147+ potential runtime type errors** across 8 categories. The most critical issues involve:
- Unsafe type assertions (`as any`)
- Non-null assertions on potentially undefined values
- JSON parsing without validation
- Array operations without null checks

**Severity Distribution:**
- 🔴 **Critical:** 28 issues
- 🟠 **High:** 42 issues
- 🟡 **Medium:** 52 issues
- 🟢 **Low:** 25 issues

---

## 1. Type Assertions (as any) - CRITICAL

### Overview
Using `as any` bypasses TypeScript's type checking, leading to potential runtime crashes when the actual data structure doesn't match expectations.

### Critical Issues

#### 1.1 Browser Chat Pane - Unsafe Window Access
**Location:** `src/capsules/browser/BrowserChatPane.tsx:68-69, 294, 860-861`
```typescript
// PROBLEMATIC CODE:
const url = (activeTab as any).url || "";
const label = (activeTab as any).title || formatHost(url) || "Untitled";
const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
```
**Severity:** 🔴 Critical  
**Issue:** Complete type bypass for activeTab and window objects. Runtime crashes if properties don't exist.  
**Suggested Fix:**
```typescript
interface TabInfo {
  url?: string;
  title?: string;
}
const url = (activeTab as TabInfo)?.url ?? "";
const label = (activeTab as TabInfo)?.title ?? formatHost(url) ?? "Untitled";

// For window access:
const SR = window.SpeechRecognition || (window as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
```

#### 1.2 Cowork WorkBlock - Event Type Assertions
**Location:** `src/views/cowork/CoworkWorkBlock.tsx:39-270`
```typescript
// PROBLEMATIC CODE:
const actionEvent = event as any;
const commandEvent = event as any;
const fileEvent = event as any;
```
**Severity:** 🔴 Critical  
**Issue:** Multiple `as any` casts on event objects without type guards.  
**Suggested Fix:**
```typescript
if (event.type === 'action') {
  const actionEvent = event as ActionEvent; // Use type guard first
}
```

#### 1.3 Redux Dispatch Calls
**Location:** `src/hooks/useCapsule.ts:139-180`
```typescript
// PROBLEMATIC CODE:
await dispatch(createCapsule(request) as any);
await dispatch(deleteCapsule(id) as any);
```
**Severity:** 🟠 High  
**Issue:** Action creators dispatched without proper typing.  
**Suggested Fix:**
```typescript
// Ensure createCapsule returns properly typed ThunkAction
const result = await dispatch(createCapsule(request));
if (result.meta.requestStatus === 'rejected') {
  throw new Error(result.payload as string);
}
```

#### 1.4 Kernel Integration Unsafe Access
**Location:** `src/integration/kernel/plugins.ts:15`, `src/integration/kernel/tools.ts:4`
```typescript
// PROBLEMATIC CODE:
const pluginsApi = (bridge as any)?.plugins;
return (bridge as any).plugins.getAllTools();
```
**Severity:** 🟠 High  
**Issue:** Bridge object accessed with `as any`, bypassing interface checks.  
**Suggested Fix:**
```typescript
interface KernelBridge {
  plugins?: {
    getAllTools(): Tool[];
  };
}
const pluginsApi = (bridge as KernelBridge | undefined)?.plugins;
if (!pluginsApi) throw new Error('Plugins API not available');
```

#### 1.5 Response JSON Casting Without Validation
**Location:** Multiple files
```typescript
// PROBLEMATIC CODE (src/store/slices/mcpAppsSlice.ts:83):
return await response.json() as Capsule[];

// PROBLEMATIC CODE (src/hooks/useBrainChat.ts:103-161):
const delta = event.delta as { type: string; text?: string };
const callId = event.call_id as string;
```
**Severity:** 🟠 High  
**Issue:** JSON responses cast to types without runtime validation. Malformed responses cause crashes.  
**Suggested Fix:**
```typescript
import { z } from 'zod';

const CapsuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ... other fields
});

const data = await response.json();
const result = CapsuleSchema.array().safeParse(data);
if (!result.success) {
  console.error('Invalid capsule data:', result.error);
  return [];
}
return result.data;
```

---

## 2. Non-Null Assertions (!) - HIGH RISK

### Overview
The `!` operator tells TypeScript a value is non-null, but runtime may have null/undefined, causing crashes.

### Critical Issues

#### 2.1 Sidebar Navigation - Unsafe Children Access
**Location:** `src/shell/layout/Sidebar.tsx:473, 683`
```typescript
// PROBLEMATIC CODE:
{item.children!.map((child, childIndex) => (
```
**Severity:** 🔴 Critical  
**Issue:** `children` could be undefined at runtime.  
**Suggested Fix:**
```typescript
{item.children?.map((child, childIndex) => (
// or
{(item.children ?? []).map((child, childIndex) => (
```

#### 2.2 WebSocket Unsafe Send
**Location:** `src/api/infrastructure/websocket.ts:342, 358`
```typescript
// PROBLEMATIC CODE:
this.ws!.send(message);
```
**Severity:** 🔴 Critical  
**Issue:** WebSocket may be null if connection failed or closed.  
**Suggested Fix:**
```typescript
if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
  throw new Error('WebSocket not connected');
}
this.ws.send(message);
```

#### 2.3 Policy Service Unsafe Path Access
**Location:** `src/capsules/browser/policyService.ts:168-170, 310`
```typescript
// PROBLEMATIC CODE:
if (entry.host !== request.target!.host) return false;
return entry.paths.some(path => request.target!.path!.startsWith(path));
```
**Severity:** 🟠 High  
**Issue:** `target` and `path` could be undefined.  
**Suggested Fix:**
```typescript
if (!request.target?.host || entry.host !== request.target.host) return false;
if (entry.paths && request.target?.path) {
  return entry.paths.some(path => request.target.path?.startsWith(path) ?? false);
}
```

#### 2.4 Debug View Variable Children
**Location:** `src/views/code/DebugView.tsx:155`
```typescript
// PROBLEMATIC CODE:
{variable.children!.map((child, idx) => (
```
**Severity:** 🟠 High  
**Issue:** `children` may be undefined for primitive variables.  
**Suggested Fix:**
```typescript
{(variable.children ?? []).map((child, idx) => (
```

#### 2.5 Docker Sandbox Container Operations
**Location:** `src/lib/sandbox/docker-sandbox.ts:183, 186, 205`
```typescript
// PROBLEMATIC CODE:
await container!.start();
const stream = await container!.logs({...});
await container!.wait();
```
**Severity:** 🟠 High  
**Issue:** Container may be null if creation failed.  
**Suggested Fix:**
```typescript
if (!container) {
  throw new Error('Container not initialized');
}
await container.start();
```

#### 2.6 Agent Dashboard Timeline Access
**Location:** `src/components/AgentDashboard/index.tsx:1051`
```typescript
// PROBLEMATIC CODE:
{i < snapshot.timeline!.length - 1 ? ...}
```
**Severity:** 🟡 Medium  
**Issue:** `timeline` could be undefined.  
**Suggested Fix:**
```typescript
{i < (snapshot.timeline?.length ?? 0) - 1 ? ...}
```

---

## 3. JSON Parsing Without Try-Catch - HIGH RISK

### Overview
Many JSON.parse calls lack error handling, causing crashes on malformed data.

### Critical Issues

#### 3.1 Audit Trail Service - Database JSON Parsing
**Location:** `src/capsules/browser/auditTrailService.ts:583-586`
```typescript
// PROBLEMATIC CODE:
metadata: row.outcome_metadata ? JSON.parse(row.outcome_metadata) : undefined,
law_references: JSON.parse(row.compliance_law_references),
```
**Severity:** 🔴 Critical  
**Issue:** Database corruption or malformed data causes runtime crashes.  
**Suggested Fix:**
```typescript
const safeParse = <T>(json: string | null): T | undefined => {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    console.error('Failed to parse JSON:', e);
    return undefined;
  }
};

metadata: safeParse(row.outcome_metadata),
law_references: safeParse(row.compliance_law_references) ?? [],
```

#### 3.2 Plugin Manager LocalStorage Parsing
**Location:** `src/views/plugins/PluginManager.tsx:230, 268, 323, 363, 693, 977`
```typescript
// PROBLEMATIC CODE:
return normalizeEnabledOverrides(JSON.parse(raw));
return normalizeCuratedSourceEnabled(JSON.parse(raw));
const parsed = JSON.parse(raw) as unknown;
```
**Severity:** 🟠 High  
**Issue:** LocalStorage data may be corrupted or tampered with.  
**Suggested Fix:**
```typescript
const safeJSONParse = <T>(raw: string | null, defaultValue: T): T => {
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
};

return normalizeEnabledOverrides(safeJSONParse(raw, {}));
```

#### 3.3 Capability Store JSON Parsing
**Location:** `src/plugins/capability.store.ts:395, 418`
```typescript
// PROBLEMATIC CODE:
const enabledIds = new Set(JSON.parse(raw) as string[]);
return JSON.parse(raw) as string[];
```
**Severity:** 🟠 High  
**Issue:** localStorage may contain invalid JSON.  
**Suggested Fix:**
```typescript
try {
  const enabledIds = new Set(JSON.parse(raw) as string[]);
} catch {
  return new Set<string>();
}
```

#### 3.4 A2UI Session Data Parsing (API Routes)
**Location:** `src/app/api/a2ui/sessions/[id]/route.ts:35-36, 76-77`
```typescript
// PROBLEMATIC CODE:
payload: JSON.parse(record.payload),
dataModel: JSON.parse(record.dataModel),
```
**Severity:** 🔴 Critical  
**Issue:** Database records may contain malformed JSON, causing API crashes.  
**Suggested Fix:**
```typescript
const safeParse = (json: string, fieldName: string) => {
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error(`Failed to parse ${fieldName}:`, e);
    return null;
  }
};

payload: safeParse(record.payload, 'payload'),
dataModel: safeParse(record.dataModel, 'dataModel'),
```

#### 3.5 File System Config Parsing
**Location:** `src/plugins/fileSystem.ts:237, 546, 889, 1065, 1127, 1200, 1498, 1569, 1657, 1722, 1775`
```typescript
// PROBLEMATIC CODE:
return JSON.parse(text) as T;
config = JSON.parse(configContent);
```
**Severity:** 🟠 High  
**Issue:** File system operations may return corrupted files.  
**Suggested Fix:**
```typescript
export function safeJSONParse<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}
```

---

## 4. Array Operations Without Null Checks - MEDIUM RISK

### Overview
Array methods called on potentially null/undefined arrays cause runtime errors.

### Issues Found

#### 4.1 Cowork Project View - Task Filtering
**Location:** `src/views/cowork/CoworkProjectView.tsx:66, 71`
```typescript
// PROBLEMATIC CODE:
const projectTasks = tasks.filter(t => t.projectId === currentProjectId && t.mode !== 'agent');
const agentTasks = tasks.filter(t => t.projectId === currentProjectId && t.mode === 'agent');
```
**Severity:** 🟡 Medium  
**Issue:** `tasks` may be undefined before data loads.  
**Suggested Fix:**
```typescript
const projectTasks = (tasks ?? []).filter(t => t.projectId === currentProjectId && t.mode !== 'agent');
```

#### 4.2 Chat View - Agent Mapping
**Location:** `src/views/ChatView.tsx:221`
```typescript
// PROBLEMATIC CODE:
() => new Map(agents.map((agent) => [agent.id, agent])),
```
**Severity:** 🟡 Medium  
**Issue:** `agents` may be undefined.  
**Suggested Fix:**
```typescript
() => new Map((agents ?? []).map((agent) => [agent.id, agent])),
```

#### 4.3 Cowork RightRail - Event Filtering
**Location:** `src/views/cowork/CoworkRightRail.tsx:93, 243-247`
```typescript
// PROBLEMATIC CODE:
const workEvents = session.events.filter((event) => ...);
() => (session ? session.events.filter((event) => event.type === 'cowork.tool_call') : []),
```
**Severity:** 🟡 Medium  
**Issue:** `session.events` may be undefined.  
**Suggested Fix:**
```typescript
const workEvents = (session.events ?? []).filter((event) => ...);
```

#### 4.4 Swarm Dashboard - Circuit Breakers
**Location:** `src/views/SwarmDashboard/SwarmDashboard.tsx:200, 294, 354`
```typescript
// PROBLEMATIC CODE:
{(circuitBreakers ?? []).filter(cb => cb.state === 'open').length} open
{circuitBreakers.map((cb) => (...))}
{quarantined.map((agent) => (...))}
```
**Severity:** 🟢 Low  
**Issue:** Some uses have null coalescing, others don't.  
**Suggested Fix:**
```typescript
// Consistent use of null coalescing
{(circuitBreakers ?? []).map((cb) => (...))}
{(quarantined ?? []).map((agent) => (...))}
```

---

## 5. Object Property Access Without Validation - MEDIUM RISK

### Overview
Direct property access on objects that may be undefined or have unexpected shapes.

### Issues Found

#### 5.1 Cowork Controls - Pending Approval Access
**Location:** `src/views/cowork/CoworkControls.tsx:277-298`
```typescript
// PROBLEMATIC CODE:
Approval Required: {pendingApprovals[0].summary}
{pendingApprovals[0].details.consequence}
actionId: pendingApprovals[0].actionId,
```
**Severity:** 🔴 Critical  
**Issue:** Array access without bounds checking, nested property access without validation.  
**Suggested Fix:**
```typescript
const pendingApproval = pendingApprovals[0];
if (!pendingApproval?.details) return null;

Approval Required: {pendingApproval.summary}
{pendingApproval.details.consequence}
actionId: pendingApproval.actionId,
```

#### 5.2 Cowork RightRail - Dynamic Property Access
**Location:** `src/views/cowork/CoworkRightRail.tsx:61-78`
```typescript
// PROBLEMATIC CODE:
const command = ((event as any).commands?.[0] as string | undefined) ?? ((event as any).command as string | undefined);
const operation = toTitle(((event as any).operation as string | undefined) ?? 'Updated');
```
**Severity:** 🟠 High  
**Issue:** Multiple `as any` casts with optional chaining on unknown event types.  
**Suggested Fix:**
```typescript
interface CommandEvent {
  commands?: string[];
  command?: string;
  operation?: string;
}

const commandEvent = event as CommandEvent;
const command = commandEvent.commands?.[0] ?? commandEvent.command;
```

#### 5.3 Shell Settings Drilldown - Menu Items Access
**Location:** `src/shell/SettingsDrilldown.tsx:343-410`
```typescript
// PROBLEMATIC CODE:
item={menuItems[0]}
item={menuItems[1]}
// ... through menuItems[8]
```
**Severity:** 🟡 Medium  
**Issue:** Hardcoded array index access without bounds checking.  
**Suggested Fix:**
```typescript
{menuItems.slice(0, 9).map((item, index) => (
  <MenuItem
    key={item.id}
    item={item}
    isActive={activeSubmenuId === item.id}
    onClick={() => { item.onClick?.(); setOpen(false); }}
  />
))}
```

---

## 6. Date/Number Parsing Issues - MEDIUM RISK

### Overview
Parsing functions may return NaN or invalid dates without validation.

### Issues Found

#### 6.1 Scheduled Jobs Runner - Regex Capture Parsing
**Location:** `src/lib/agents/scheduled-jobs.runner.ts:315, 327`
```typescript
// PROBLEMATIC CODE:
const hour = parseInt(dailyMatch[1]);
const hour = parseInt(weekdayMatch[1]);
```
**Severity:** 🟡 Medium  
**Issue:** `parseInt` without radix, no NaN check.  
**Suggested Fix:**
```typescript
const hour = parseInt(dailyMatch[1], 10);
if (isNaN(hour)) {
  throw new Error(`Invalid hour: ${dailyMatch[1]}`);
}
```

#### 6.2 Color Utility - Hex Parsing Without Validation
**Location:** `src/a2r-usage/ui/lib/color.ts:13-15`, `src/components/Avatar/presets/colorPalettes.ts:289-316`
```typescript
// PROBLEMATIC CODE:
const r = parseInt(h.slice(0, 2), 16) / 255
const g = parseInt(h.slice(2, 4), 16) / 255
const b = parseInt(h.slice(4, 6), 16) / 255
```
**Severity:** 🟡 Medium  
**Issue:** No validation that hex string has correct length/format.  
**Suggested Fix:**
```typescript
const parseHexColor = (hex: string): { r: number; g: number; b: number } => {
  const cleanHex = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(cleanHex.slice(0, 2), 16) / 255,
    g: parseInt(cleanHex.slice(2, 4), 16) / 255,
    b: parseInt(cleanHex.slice(4, 6), 16) / 255,
  };
};
```

#### 6.3 Resumable Stream - Timestamp Parsing
**Location:** `src/lib/stream/resumable-stream.ts:140-142`
```typescript
// PROBLEMATIC CODE:
lastChunkIndex: parseInt(data.lastChunkIndex || '0'),
createdAt: parseInt(data.createdAt || '0'),
updatedAt: parseInt(data.updatedAt || '0'),
```
**Severity:** 🟡 Medium  
**Issue:** No validation that parsed values are valid numbers.  
**Suggested Fix:**
```typescript
const parseTimestamp = (value: unknown): number => {
  const parsed = parseInt(String(value) || '0', 10);
  return isNaN(parsed) ? 0 : parsed;
};

lastChunkIndex: parseTimestamp(data.lastChunkIndex),
createdAt: parseTimestamp(data.createdAt),
```

#### 6.4 Cron View - Date Construction Without Validation
**Location:** `src/views/cowork/CronView.tsx:588, 1430, 1512`
```typescript
// PROBLEMATIC CODE:
const date = new Date(nextRun);
Next run: {new Date(task.nextRun).toLocaleString()}
<DetailItem label="Last Run" value={new Date(task.lastRun).toLocaleString()} />
```
**Severity:** 🟡 Medium  
**Issue:** `nextRun` or `lastRun` may be invalid date strings, resulting in "Invalid Date".  
**Suggested Fix:**
```typescript
const formatDateSafe = (dateStr: string | undefined): string => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
};

Next run: {formatDateSafe(task.nextRun)}
```

---

## 7. Optional Chaining Issues - LOW TO MEDIUM RISK

### Overview
Missing optional chaining where it should be used, or incorrect assumptions about data structure.

### Issues Found

#### 7.1 Agent View - Personality Config Access
**Location:** `src/views/AgentView.tsx:2621-2678` (multiple occurrences)
```typescript
// PROBLEMATIC CODE:
((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.creativity ?? 50)
```
**Severity:** 🟡 Medium  
**Issue:** Excessive type casting instead of proper type narrowing.  
**Suggested Fix:**
```typescript
interface PersonalityConfig {
  personality?: {
    creativity?: number;
    verbosity?: number;
  };
}

const config = formData.config as PersonalityConfig;
const creativity = config?.personality?.creativity ?? 50;
```

#### 7.2 Voice Service - Environment Access
**Location:** `src/services/voice/VoiceService.ts:25, 31`
```typescript
// PROBLEMATIC CODE:
const envValue = (import.meta as any).env?.VITE_ENABLE_VOICE_SERVICE;
const envUrl = (import.meta as any).env?.VITE_VOICE_URL;
```
**Severity:** 🟢 Low  
**Issue:** `import.meta.env` should have proper typing.  
**Suggested Fix:**
```typescript
// Add to vite-env.d.ts:
interface ImportMetaEnv {
  VITE_ENABLE_VOICE_SERVICE?: string;
  VITE_VOICE_URL?: string;
}

const envValue = import.meta.env.VITE_ENABLE_VOICE_SERVICE;
```

---

## 8. Function Calls on Potentially Null Objects - HIGH RISK

### Overview
Calling methods on objects that may be null or undefined.

### Critical Issues

#### 8.1 Browser Engine Session Operations
**Location:** `src/services/browserEngine.ts:87, 104, 192`
```typescript
// PROBLEMATIC CODE:
if (!this.sessionId) return;
```
**Severity:** 🟠 High  
**Issue:** Methods continue execution with early returns that may skip critical cleanup.  
**Suggested Fix:**
```typescript
if (!this.sessionId) {
  throw new Error('Session not initialized');
}
```

#### 8.2 Workflow Engine Queue Operations
**Location:** `src/services/workflowEngine.ts:276, 391, 414`
```typescript
// PROBLEMATIC CODE:
const nodeId = queue.shift()!;
const current = queue.shift()!;
```
**Severity:** 🟠 High  
**Issue:** Non-null assertion on array shift that may return undefined.  
**Suggested Fix:**
```typescript
const nodeId = queue.shift();
if (!nodeId) break;
```

#### 8.3 Pool Manager State Access
**Location:** `src/services/poolManager.ts:326`
```typescript
// PROBLEMATIC CODE:
if (!this.state.selected_pool) return undefined;
```
**Severity:** 🟡 Medium  
**Issue:** Silent return of undefined may cause issues downstream.  
**Suggested Fix:**
```typescript
if (!this.state.selected_pool) {
  throw new Error('No pool selected');
}
```

---

## Summary of Most Critical Files

| File | Issue Count | Severity |
|------|-------------|----------|
| `src/views/cowork/CoworkWorkBlock.tsx` | 7 | 🔴 Critical |
| `src/capsules/browser/BrowserChatPane.tsx` | 6 | 🔴 Critical |
| `src/views/cowork/CoworkRightRail.tsx` | 10 | 🟠 High |
| `src/plugins/fileSystem.ts` | 11 | 🟠 High |
| `src/views/plugins/PluginManager.tsx` | 9 | 🟠 High |
| `src/app/api/a2ui/sessions/*.ts` | 6 | 🔴 Critical |
| `src/services/workflowEngine.ts` | 5 | 🟠 High |
| `src/lib/agents/scheduled-jobs.runner.ts` | 4 | 🟡 Medium |

---

## Recommended Actions

### Immediate (This Sprint)
1. **Fix all `as any` casts in CoworkWorkBlock.tsx** - Add proper type guards
2. **Add try-catch to all JSON.parse calls in API routes** - Prevent server crashes
3. **Fix non-null assertions in Sidebar.tsx** - Add optional chaining

### Short Term (Next 2 Sprints)
1. **Implement Zod validation** for all API responses
2. **Add runtime type guards** for all event handling
3. **Fix array access patterns** with bounds checking

### Long Term
1. **Enable strict TypeScript configuration** (`strict: true`)
2. **Add ESLint rules** to ban `as any` and non-null assertions
3. **Implement property-based testing** for data validation

---

## Tools for Automated Detection

Add to `.eslintrc.cjs`:
```javascript
module.exports = {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
  },
};
```

---

*Report generated by automated code analysis. Manual review recommended for all issues.*
