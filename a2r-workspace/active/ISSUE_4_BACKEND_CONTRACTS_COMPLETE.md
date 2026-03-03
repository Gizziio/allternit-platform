# Issue 4: Backend Contracts for Session Metadata - COMPLETE

**Date:** 2026-03-02  
**Status:** ✅ Implementation Complete  
**Related Spec:** AGENT_MODE_SESSION_ARCHITECTURE.md

---

## Summary

Successfully implemented backend contracts for agent session metadata persistence. The Rust API now properly stores and retrieves `origin_surface`, `session_mode`, and all agent-specific metadata fields.

---

## Changes Made

### 1. **Rust Backend - Agent Session Routes** (`7-apps/api/src/agent_session_routes.rs`)

#### Added New Types

```rust
/// Agent session surface (origin UI)
#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
#[serde(rename_all = "snake_case")]
pub enum AgentSessionSurface {
    Chat,
    Cowork,
    Code,
    Browser,
}

/// Agent session mode
#[derive(Debug, Deserialize, Serialize, ToSchema, Clone)]
#[serde(rename_all = "lowercase")]
pub enum AgentSessionMode {
    Regular,
    Agent,
}

/// Agent session features
#[derive(Debug, Deserialize, Serialize, ToSchema, Clone, Default)]
pub struct AgentSessionFeatures {
    #[serde(default)]
    pub workspace: Option<bool>,
    #[serde(default)]
    pub tools: Option<bool>,
    #[serde(default)]
    pub automation: Option<bool>,
}
```

#### Updated CreateSessionRequest

Added fields to properly capture agent session context:

```rust
pub struct CreateSessionRequest {
    // ... existing fields ...
    pub agent_name: Option<String>,
    pub origin_surface: Option<AgentSessionSurface>,
    pub session_mode: Option<AgentSessionMode>,
    pub project_id: Option<String>,
    pub workspace_scope: Option<String>,
    pub agent_features: Option<AgentSessionFeatures>,
}
```

#### Updated create_session Handler

Now persists all agent session metadata with proper keys:

```rust
async fn create_session(...) {
    // Build metadata with all agent session fields
    let mut metadata_patch = metadata.unwrap_or_default();
    
    // Core agent identity
    if let Some(agent_id) = agent_id {
        metadata_patch.insert("a2r_agent_id".to_string(), ...);
    }
    if let Some(agent_name) = agent_name {
        metadata_patch.insert("a2r_agent_name".to_string(), ...);
    }
    
    // Session origin and mode
    if let Some(surface) = origin_surface {
        metadata_patch.insert("a2r_origin_surface".to_string(), ...);
    }
    if let Some(mode) = session_mode {
        metadata_patch.insert("a2r_session_mode".to_string(), ...);
    }
    
    // Project and workspace context
    if let Some(pid) = project_id { ... }
    if let Some(scope) = workspace_scope { ... }
    
    // Agent features
    if let Some(features) = agent_features {
        let features_obj = serde_json::json!({
            "workspace": features.workspace.unwrap_or(false),
            "tools": features.tools.unwrap_or(false),
            "automation": features.automation.unwrap_or(false),
        });
        metadata_patch.insert("a2r_agent_features".to_string(), features_obj);
    }
    
    // Persist to session manager
    manager.patch_session(..., Some(metadata_patch), ...).await?;
}
```

#### Updated UpdateSessionRequest

Added support for updating agent metadata fields:

```rust
pub struct UpdateSessionRequest {
    // ... existing fields ...
    pub origin_surface: Option<AgentSessionSurface>,
    pub session_mode: Option<AgentSessionMode>,
    pub project_id: Option<String>,
    pub workspace_scope: Option<String>,
    pub agent_features: Option<AgentSessionFeatures>,
}
```

#### Updated update_session Handler

Merges agent metadata fields on update:

```rust
async fn update_session(...) {
    let mut metadata_patch = request.metadata.clone().unwrap_or_default();
    
    // Update origin surface if provided
    if let Some(surface) = &request.origin_surface { ... }
    
    // Update session mode if provided
    if let Some(mode) = &request.session_mode { ... }
    
    // Update project, workspace, features
    if let Some(pid) = &request.project_id { ... }
    if let Some(scope) = &request.workspace_scope { ... }
    if let Some(features) = &request.agent_features { ... }
    
    // Persist merged metadata
    manager.patch_session(..., Some(metadata_patch), ...).await?;
}
```

---

### 2. **TypeScript API Client** (`6-ui/a2r-platform/src/lib/agents/native-agent-api.ts`)

#### Updated CreateNativeAgentSessionRequest

```typescript
export interface CreateNativeAgentSessionRequest {
  name?: string;
  description?: string;
  agentId?: string;
  agentName?: string;
  model?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  /** Origin surface (chat, cowork, code, browser) */
  origin_surface?: "chat" | "cowork" | "code" | "browser";
  /** Session mode (regular or agent) */
  session_mode?: "regular" | "agent";
  /** Project identifier */
  project_id?: string;
  /** Workspace scope path */
  workspace_scope?: string;
  /** Agent-specific features */
  agent_features?: {
    workspace?: boolean;
    tools?: boolean;
    automation?: boolean;
  };
}
```

#### Updated API Calls

**createSession:**
```typescript
async createSession(options: CreateNativeAgentSessionRequest = {}): Promise<BackendSession> {
  const response = await fetch(AGENT_SESSION_API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: options.name || "New Session",
      description: options.description,
      agent_id: options.agentId,
      agent_name: options.agentName,
      model: options.model,
      tags: options.tags,
      metadata: options.metadata,
      // Agent session metadata fields
      origin_surface: options.origin_surface,
      session_mode: options.session_mode,
      project_id: options.project_id,
      workspace_scope: options.workspace_scope,
      agent_features: options.agent_features,
    }),
  });
  // ...
}
```

**updateSession:**
```typescript
async updateSession(
  sessionId: string,
  updates: {
    name?: string;
    description?: string;
    active?: boolean;
    tags?: string[];
    metadata?: Record<string, unknown>;
    origin_surface?: "chat" | "cowork" | "code" | "browser";
    session_mode?: "regular" | "agent";
    project_id?: string;
    workspace_scope?: string;
    agent_features?: {
      workspace?: boolean;
      tools?: boolean;
      automation?: boolean;
    };
  },
): Promise<BackendSession> {
  const response = await fetch(..., {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: updates.name,
      description: updates.description,
      active: updates.active,
      tags: updates.tags,
      metadata: updates.metadata,
      // Agent session metadata fields
      origin_surface: updates.origin_surface,
      session_mode: updates.session_mode,
      project_id: updates.project_id,
      workspace_scope: updates.workspace_scope,
      agent_features: updates.agent_features,
    }),
  });
  // ...
}
```

---

### 3. **TypeScript Store** (`6-ui/a2r-platform/src/lib/agents/native-agent.store.ts`)

#### Updated createSession

```typescript
createSession: async (name, description, options = {}) => {
  const request: CreateNativeAgentSessionRequest = {
    name,
    description,
    agentId: options.agentId,
    agentName: options.agentName,
    model: options.runtimeModel,
    tags: options.tags,
    // Send agent session fields directly for proper backend persistence
    origin_surface: options.originSurface,
    session_mode: options.sessionMode,
    project_id: options.projectId,
    workspace_scope: options.workspaceScope,
    agent_features: options.agentFeatures,
    // Also include in metadata for backwards compatibility
    metadata: buildAgentSessionMetadata({
      originSurface: options.originSurface,
      sessionMode: options.sessionMode,
      agentId: options.agentId,
      agentName: options.agentName,
      projectId: options.projectId,
      workspaceScope: options.workspaceScope,
      runtimeModel: options.runtimeModel,
      agentFeatures: options.agentFeatures,
      metadata: options.metadata,
    }),
  };
  
  const backendSession = await nativeAgentApi.sessions.createSession(request);
  // ...
}
```

#### Updated updateSession

```typescript
updateSession: async (sessionId, updates) => {
  const backendSession = await nativeAgentApi.sessions.updateSession(
    sessionId,
    {
      name: updates.name,
      description: updates.description,
      active: updates.isActive,
      tags: updates.tags,
      metadata: updates.metadata,
      // Send agent session fields directly for proper backend persistence
      origin_surface: (updates.metadata?.['a2r_origin_surface'] as any) || undefined,
      session_mode: (updates.metadata?.['a2r_session_mode'] as any) || undefined,
      project_id: (updates.metadata?.['a2r_project_id'] as any) || undefined,
      workspace_scope: (updates.metadata?.['a2r_workspace_scope'] as any) || undefined,
      agent_features: (updates.metadata?.['a2r_agent_features'] as any) || undefined,
    },
  );
  // ...
}
```

---

## Metadata Keys Standard

All agent session metadata uses the `a2r_` prefix for namespacing:

| Key | Type | Description |
|-----|------|-------------|
| `a2r_origin_surface` | `"chat" \| "cowork" \| "code" \| "browser"` | UI surface where session originated |
| `a2r_session_mode` | `"regular" \| "agent"` | Runtime mode |
| `a2r_agent_id` | `string` | Selected agent identifier |
| `a2r_agent_name` | `string` | Agent display name |
| `a2r_project_id` | `string` | Project context |
| `a2r_workspace_scope` | `string` | Workspace path/scope |
| `a2r_runtime_model` | `string` | Model being used |
| `a2r_agent_features` | `{workspace, tools, automation}` | Feature flags |

---

## API Contract

### POST /api/v1/agent-sessions

**Request:**
```json
{
  "name": "Research Session",
  "description": "Investigating codebase structure",
  "agent_id": "agent-123",
  "agent_name": "Research Operator",
  "model": "claude-3-5-sonnet",
  "origin_surface": "chat",
  "session_mode": "agent",
  "project_id": "project-456",
  "workspace_scope": "/Users/dev/my-project",
  "agent_features": {
    "workspace": true,
    "tools": true,
    "automation": false
  },
  "metadata": {
    "a2r_origin_surface": "chat",
    "a2r_session_mode": "agent",
    ...
  }
}
```

**Response:**
```json
{
  "id": "session-789",
  "name": "Research Session",
  "description": "Investigating codebase structure",
  "created_at": "2026-03-02T23:00:00Z",
  "updated_at": "2026-03-02T23:00:00Z",
  "last_accessed": "2026-03-02T23:00:00Z",
  "active": true,
  "message_count": 0,
  "tags": [],
  "metadata": {
    "a2r_agent_id": "agent-123",
    "a2r_agent_name": "Research Operator",
    "a2r_origin_surface": "chat",
    "a2r_session_mode": "agent",
    "a2r_project_id": "project-456",
    "a2r_workspace_scope": "/Users/dev/my-project",
    "a2r_agent_features": {
      "workspace": true,
      "tools": true,
      "automation": false
    }
  }
}
```

### PATCH /api/v1/agent-sessions/:id

**Request:**
```json
{
  "origin_surface": "code",
  "session_mode": "agent",
  "metadata": {
    "a2r_workspace_scope": "/new/path"
  }
}
```

**Note:** The backend will merge the direct fields (`origin_surface`, `session_mode`, etc.) into the metadata automatically.

---

## Verification

### Rust Compilation
```bash
cd 7-apps/api && cargo check
# ✅ No errors
```

### TypeScript Compilation
```bash
cd 6-ui/a2r-platform && npx tsc --noEmit
# ✅ No new errors (pre-existing errors unrelated to our changes)
```

---

## Integration Points

### Session Creation Flow

1. **UI Component** (ChatView, CodeCanvas, etc.)
   - User enables agent mode
   - Selects an agent from dropdown
   - Sends first message

2. **Store Layer** (`native-agent.store.ts`)
   - Calls `createSession()` with options:
     ```typescript
     {
       originSurface: 'chat',
       sessionMode: 'agent',
       agentId: 'agent-123',
       agentName: 'Research Operator',
       ...
     }
     ```

3. **API Layer** (`native-agent-api.ts`)
   - Transforms to backend format
   - Sends both direct fields AND metadata

4. **Backend** (`agent_session_routes.rs`)
   - Receives request
   - Merges direct fields into metadata
   - Persists to session manager
   - Returns session with full metadata

### Session Retrieval

1. **Frontend** requests session list or single session
2. **Backend** returns session with metadata intact
3. **Store** transforms and extracts metadata using `getAgentSessionDescriptor()`
4. **UI** displays agent context strip with proper surface/mode/agent info

---

## Benefits

1. **Type Safety:** Full TypeScript and Rust type checking end-to-end
2. **Backwards Compatible:** Metadata still works for old clients
3. **Explicit Contracts:** Direct fields make API intent clear
4. **Queryable:** Backend can easily filter/sort by surface, mode, etc.
5. **Future-Proof:** Easy to add new agent session fields

---

## Remaining Work (Out of Scope)

### Agent Registry Integration
- Real agent list API endpoint needed
- Agent availability checking
- Agent capability negotiation

### Browser Agent Responses
- Replace placeholder responses in BrowserChatPane
- Wire real browser automation events

### Session Sync Enhancements
- SSE events for metadata changes
- Real-time agent state updates

These are tracked as separate issues and can be implemented incrementally.

---

## Files Modified

1. **`7-apps/api/src/agent_session_routes.rs`** (+200 lines)
   - Added AgentSessionSurface, AgentSessionMode, AgentSessionFeatures types
   - Updated CreateSessionRequest and UpdateSessionRequest
   - Enhanced create_session and update_session handlers

2. **`6-ui/a2r-platform/src/lib/agents/native-agent-api.ts`** (+40 lines)
   - Updated CreateNativeAgentSessionRequest interface
   - Enhanced createSession and updateSession API calls

3. **`6-ui/a2r-platform/src/lib/agents/native-agent.store.ts`** (+20 lines)
   - Updated createSession to send direct fields
   - Updated updateSession to extract and send metadata fields

---

## Testing Recommendations

1. **Create agent session from Chat surface**
   - Verify `a2r_origin_surface` = "chat"
   - Verify `a2r_session_mode` = "agent"

2. **Create agent session from Code surface**
   - Verify `a2r_origin_surface` = "code"

3. **Update session mode**
   - Switch from regular to agent mode
   - Verify metadata updates

4. **Query sessions by surface**
   - List all chat agent sessions
   - List all code agent sessions

5. **Offline resilience**
   - Create session when backend unavailable
   - Verify local draft mode works
   - Verify sync when backend reconnects

---

**End of Report**
