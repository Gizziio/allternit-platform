# ChatUI Wiring — Runtime Model Discovery (No Hardcoded Lists)

**Problem**: Hardcoded model IDs rot. Provider runtimes (OpenCode, Gemini, etc.) change their available models frequently.

**Solution**: Treat model IDs as runtime-owned data, discoverable on-demand.

---

## 1. Never Ship Static Model Lists as Truth

Static presets are **shortcuts only**, not authoritative:

- Label them: **"suggested (may be outdated)"**
- Always allow: **freeform `runtimeModelId`**
- Provide: **"Refresh" and "Validate"** actions

---

## 2. Runtime Model Discovery

### A. Preferred: Live Model List

**New kernel endpoint:**

```
GET /v1/providers/:provider/models?profile_id=<brain_profile_id>
```

**Kernel implementation:**
- Queries the runtime using ACP method or provider CLI (`opencode models`, `gemini models`)
- Runs in protocol mode (pipes), parses JSON response
- No tool-logic in drivers

**Response:**

```json
{
  "provider": "opencode",
  "profile_id": "opencode-acp",
  "fetched_at": "2026-02-14T02:13:00Z",
  "models": [
    {
      "id": "anthropic:claude-3-7-sonnet",
      "label": "Claude 3.7 Sonnet",
      "meta": { "ctx": 200000, "vision": true }
    }
  ]
}
```

**UI uses this list as dropdown suggestions.**

---

### B. Fallback: Validate Model ID

**New kernel endpoint:**

```
POST /v1/providers/:provider/models/validate
```

**Body:**
```json
{
  "profile_id": "opencode-acp",
  "model_id": "anthropic:claude-3-7-sonnet"
}
```

**Response:**
```json
{
  "valid": true | false | "unknown",
  "suggested": ["anthropic:claude-3-5-sonnet", "openai:gpt-4o"],
  "message": "Model not found. Did you mean one of these?"
}
```

**Use case:** Freeform input with validation before starting long sessions.

---

## 3. Cache Strategy

Don't fetch on every keystroke.

| Strategy | Implementation |
|----------|----------------|
| **Cache key** | `(provider, profile_id)` |
| **TTL** | 24 hours |
| **Storage** | LocalStorage (UI) or brief API cache |
| **UI indicator** | "Updated 3h ago" with Refresh button |
| **Auto-refresh** | On "unknown model" error, trigger refresh + re-prompt |

---

## 4. Model IDs are Opaque Strings

**Do NOT parse or assume structure** like `vendor:model`. Some runtimes change formats.

**Store:**
- `id` (opaque string, pass-through to runtime)
- `label` (display only)
- `aliases` (runtime-provided fallbacks)
- `capabilities` (vision, tools, JSON mode — if provided)

---

## 5. ChatUI Implementation Spec

### Model Selector Component

```typescript
interface ModelSelectorProps {
  brainProfileId: string;      // e.g., "opencode-acp"
  provider: string;            // e.g., "opencode"
  runtimeModelId: string;      // current selection (opaque)
  onChange: (modelId: string) => void;
}
```

**UI State:**

| State | Render |
|-------|--------|
| Loading models | Spinner + "Fetching available models..." |
| Loaded | Dropdown with cached list + "Refresh" button |
| Stale warning | "Last updated 2 days ago" + yellow indicator |
| Freeform mode | Text input + "Validate" button |
| Validation error | Red text + "Model not found" + "Refresh list" link |

### User Flows

**A. Pick from known models**
1. User opens model picker
2. UI shows cached list with `fetched_at` timestamp
3. User selects model → `runtimeModelId` set
4. Send button enabled

**B. Refresh stale list**
1. User clicks "Refresh"
2. UI calls `GET /v1/providers/:provider/models?profile_id=...`
3. Cache updated, timestamp refreshed
4. Dropdown repopulated

**C. Freeform entry**
1. User clicks "Enter custom model ID"
2. Text input appears
3. User types opaque string
4. Click "Validate"
5. UI calls `POST /v1/providers/:provider/models/validate`
6. If valid → enable send; if invalid → show suggestions

**D. Unknown model detected mid-chat**
1. Runtime returns error: "unknown model"
2. UI auto-triggers refresh
3. Shows updated list
4. Prompts user to reselect

---

## 6. Session Create Payload

```json
{
  "brain_profile_id": "opencode-acp",
  "source": "chat",
  "runtime_overrides": {
    "model_id": "anthropic:claude-3-7-sonnet"
  }
}
```

**If discovery endpoints aren't ready:**
- Keep freeform input
- Cache last-known IDs locally
- Show warning: "Model list may be outdated"
- Validate on send if possible

---

## 7. Acceptance Criteria

**A) Model discovery works:**
- Click "Refresh" → fetches live list from runtime
- Shows `fetched_at` timestamp
- Dropdown populated with runtime-provided models

**B) Freeform with validation:**
- User enters unknown model ID
- "Validate" returns suggestions
- User picks valid model

**C) Stale cache handling:**
- Cache older than 24h shows warning
- Auto-refresh on "unknown model" error
- User can force refresh anytime

**D) Opaque IDs preserved:**
- Whatever runtime returns as `id` is sent back unchanged
- No parsing, no normalization

---

## 8. What NOT to Do

- ❌ Ship hardcoded `const MODELS = [...]` as truth
- ❌ Parse `vendor:model` structure
- ❌ Create brain profile per model
- ❌ Cache forever without refresh
- ❌ Block user if discovery fails (always allow freeform)

---

**Dependencies:**
- Kernel: `GET /v1/providers/:provider/models` endpoint (can stub initially)
- Kernel: `POST /v1/providers/:provider/models/validate` endpoint (optional)

**UI can start with freeform + local cache, migrate to discovery when ready.**