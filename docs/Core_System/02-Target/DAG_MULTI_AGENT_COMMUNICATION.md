# DAG: Multi-Agent Communication Layer Implementation

**DAG ID:** `dag_comm_layer_v1`  
**Created:** 2026-03-08  
**Status:** READY  
**Priority:** CRITICAL  

---

## Root Node: Multi-Agent Communication Layer

```
dag_id: dag_comm_layer_v1
title: Multi-Agent Communication Layer
description: Full implementation of agent-to-agent communication, webhook ingestion, 
             chat rooms, loop guard, and specialist agent profiles
acceptance_criteria:
  - All 8 phases completed with production code
  - Zero placeholders or stub implementations
  - Full test coverage (>80%)
  - Documentation complete
  - Integration with Rails verified
```

---

## Phase 1: Core Infrastructure - Webhook Ingestion Service

### Node 1.1: Webhook Ingestion Service Foundation
```
node_id: n_001
title: Create webhook-ingestion service structure
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: []
```

**Subtasks:**
```
node_id: n_001_01
title: Create 2-governance/webhook-ingestion directory structure
parent_node_id: n_001
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_001_02
title: Create package.json with production dependencies
parent_node_id: n_001_01
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_001_03
title: Create TypeScript configuration (tsconfig.json)
parent_node_id: n_001_01
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 1.2: Webhook Schema & Types
```
node_id: n_002
title: Define webhook schemas and TypeScript types
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: []
```

**Subtasks:**
```
node_id: n_002_01
title: Create src/types/webhook.types.ts with all webhook event types
parent_node_id: n_002
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_002_02
title: Create src/types/rails-event.types.ts for Rails event emission
parent_node_id: n_002
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_002_03
title: Create src/types/idempotency.types.ts for deduplication
parent_node_id: n_002
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 1.3: Webhook Normalization Engine
```
node_id: n_003
title: Implement webhook normalization engine (reverse engineered from IDE Agent Kit)
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_002]
```

**Subtasks:**
```
node_id: n_003_01
title: Create src/normalizer/github-normalizer.ts for GitHub webhooks
parent_node_id: n_003
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_003_02
title: Create src/normalizer/discord-normalizer.ts for Discord webhooks
parent_node_id: n_003
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_003_03
title: Create src/normalizer/antfarm-normalizer.ts for Ant Farm webhooks
parent_node_id: n_003
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_003_04
title: Create src/normalizer/moltbook-normalizer.ts for Moltbook webhooks
parent_node_id: n_003
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_003_05
title: Create src/normalizer/normalizer-registry.ts for normalizer dispatch
parent_node_id: n_003
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 1.4: Signature Verification & Security
```
node_id: n_004
title: Implement webhook signature verification
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_002]
```

**Subtasks:**
```
node_id: n_004_01
title: Create src/security/hmac-verifier.ts for HMAC signature validation
parent_node_id: n_004
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_004_02
title: Create src/security/allowlist-validator.ts for source allowlisting
parent_node_id: n_004
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_004_03
title: Create src/security/rate-limiter.ts for webhook rate limiting
parent_node_id: n_004
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 1.5: Idempotency & Deduplication
```
node_id: n_005
title: Implement idempotency key generation and deduplication
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_002]
```

**Subtasks:**
```
node_id: n_005_01
title: Create src/idempotency/key-generator.ts for deterministic key generation
parent_node_id: n_005
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_005_02
title: Create src/idempotency/deduplication-store.ts for duplicate detection
parent_node_id: n_005
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 1.6: Rails Event Emission
```
node_id: n_006
title: Implement Rails event emission layer
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_003, n_004, n_005]
```

**Subtasks:**
```
node_id: n_006_01
title: Create src/rails/event-emitter.ts for ledger event emission
parent_node_id: n_006
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_006_02
title: Create src/rails/receipt-recorder.ts for receipt generation
parent_node_id: n_006
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_006_03
title: Create src/rails/work-request-creator.ts for automatic work generation
parent_node_id: n_006
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 1.7: Webhook HTTP Server
```
node_id: n_007
title: Implement webhook HTTP server
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_006]
```

**Subtasks:**
```
node_id: n_007_01
title: Create src/server/webhook-server.ts with Fastify
parent_node_id: n_007
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_007_02
title: Create src/server/routes/webhook-route.ts for POST /webhook/:source
parent_node_id: n_007_01
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_007_03
title: Create src/server/routes/health-route.ts for health checks
parent_node_id: n_007_01
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_007_04
title: Create src/server/middleware/error-handler.ts for error handling
parent_node_id: n_007_01
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_007_05
title: Create src/server/middleware/logging-middleware.ts for request logging
parent_node_id: n_007_01
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 1.8: CLI Commands
```
node_id: n_008
title: Create CLI commands for webhook service
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_007]
```

**Subtasks:**
```
node_id: n_008_01
title: Create src/cli/commands/serve.ts for starting webhook server
parent_node_id: n_008
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_008_02
title: Create src/cli/commands/list.ts for listing configured webhooks
parent_node_id: n_008
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_008_03
title: Create src/cli/commands/trigger.ts for manual webhook triggering
parent_node_id: n_008
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_008_04
title: Create src/cli/index.ts for CLI entry point
parent_node_id: n_008
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 1.9: Configuration & Environment
```
node_id: n_009
title: Create configuration system
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: []
```

**Subtasks:**
```
node_id: n_009_01
title: Create src/config/index.ts for configuration management
parent_node_id: n_009
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_009_02
title: Create .env.example with all required environment variables
parent_node_id: n_009
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_009_03
title: Create config/webhook-config.schema.ts for validation
parent_node_id: n_009
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 1.10: Testing
```
node_id: n_010
title: Create comprehensive test suite for webhook ingestion
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: validator
blocked_by: [n_007, n_008]
```

**Subtasks:**
```
node_id: n_010_01
title: Create tests/normalizer.test.ts for all normalizers
parent_node_id: n_010
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

```
node_id: n_010_02
title: Create tests/security.test.ts for signature verification
parent_node_id: n_010
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

```
node_id: n_010_03
title: Create tests/idempotency.test.ts for deduplication
parent_node_id: n_010
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

```
node_id: n_010_04
title: Create tests/server.test.ts for HTTP server endpoints
parent_node_id: n_010
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

```
node_id: n_010_05
title: Create tests/integration.test.ts for end-to-end flows
parent_node_id: n_010
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

---

## Phase 2: Communication Primitives - @mention Router & Parser

### Node 2.1: Mention Parser
```
node_id: n_011
title: Implement @mention parser (reverse engineered from agentchattr)
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: []
```

**Subtasks:**
```
node_id: n_011_01
title: Create 5-agents/communication/src/parser/mention-parser.ts
parent_node_id: n_011
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_011_02
title: Create 5-agents/communication/src/parser/mention-types.ts
parent_node_id: n_011
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_011_03
title: Create tests/parser/mention-parser.test.ts
parent_node_id: n_011
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 2.2: Mention Router
```
node_id: n_012
title: Implement @mention router with agent resolution
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_011]
```

**Subtasks:**
```
node_id: n_012_01
title: Create 5-agents/communication/src/router/mention-router.ts
parent_node_id: n_012
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_012_02
title: Create 5-agents/communication/src/router/agent-resolver.ts
parent_node_id: n_012
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_012_03
title: Create 5-agents/communication/src/router/routing-rules.ts
parent_node_id: n_012
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_012_04
title: Create tests/router/mention-router.test.ts
parent_node_id: n_012
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 2.3: Rails Event Integration
```
node_id: n_013
title: Integrate @mention with Rails events
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_012]
```

**Subtasks:**
```
node_id: n_013_01
title: Extend 0-substrate/allternit-agent-system-rails/spec/EVENT_TAXONOMY.md
parent_node_id: n_013
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_013_02
title: Create 5-agents/communication/src/rails/agent-mentioned-event.ts
parent_node_id: n_013
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_013_03
title: Create 5-agents/communication/src/rails/work-request-trigger.ts
parent_node_id: n_013
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

---

## Phase 3: MCP Proxy & Terminal Injection System

### Node 3.1: MCP Proxy
```
node_id: n_014
title: Implement per-instance MCP proxy (reverse engineered from agentchattr)
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: []
```

**Subtasks:**
```
node_id: n_014_01
title: Create 5-agents/communication/src/mcp/mcp-proxy.ts
parent_node_id: n_014
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_014_02
title: Create 5-agents/communication/src/mcp/mcp-types.ts
parent_node_id: n_014
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_014_03
title: Create 5-agents/communication/src/mcp/identity-injector.ts
parent_node_id: n_014
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_014_04
title: Create tests/mcp/mcp-proxy.test.ts
parent_node_id: n_014
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 3.2: Terminal Injection (Unix/tmux)
```
node_id: n_015
title: Implement tmux-based terminal injection for Mac/Linux
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_014]
```

**Subtasks:**
```
node_id: n_015_01
title: Create 5-agents/communication/src/injector/tmux-injector.ts
parent_node_id: n_015
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_015_02
title: Create 5-agents/communication/src/injector/injector-types.ts
parent_node_id: n_015
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_015_03
title: Create 5-agents/communication/src/injector/injector-registry.ts
parent_node_id: n_015
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_015_04
title: Create tests/injector/tmux-injector.test.ts
parent_node_id: n_015
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 3.3: Terminal Injection (Windows/Win32)
```
node_id: n_016
title: Implement Win32 console injection for Windows
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_014]
```

**Subtasks:**
```
node_id: n_016_01
title: Create 5-agents/communication/src/injector/win32-injector.ts
parent_node_id: n_016
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_016_02
title: Create 5-agents/communication/src/injector/win32-bindings.ts
parent_node_id: n_016
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_016_03
title: Create tests/injector/win32-injector.test.ts
parent_node_id: n_016
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 3.4: Activity Detection
```
node_id: n_017
title: Implement agent activity detection (screen buffer hashing)
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_015, n_016]
```

**Subtasks:**
```
node_id: n_017_01
title: Create 5-agents/communication/src/activity/screen-hasher.ts
parent_node_id: n_017
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_017_02
title: Create 5-agents/communication/src/activity/activity-monitor.ts
parent_node_id: n_017
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_017_03
title: Create 5-agents/communication/src/activity/activity-types.ts
parent_node_id: n_017
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_017_04
title: Create tests/activity/activity-monitor.test.ts
parent_node_id: n_017
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

---

## Phase 4: Loop Guard & Agent Chain Management

### Node 4.1: Loop Guard Policy
```
node_id: n_018
title: Implement loop guard policy engine (reverse engineered from agentchattr)
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: []
```

**Subtasks:**
```
node_id: n_018_01
title: Create 5-agents/communication/src/guard/loop-guard.ts
parent_node_id: n_018
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_018_02
title: Create 5-agents/communication/src/guard/hop-counter.ts
parent_node_id: n_018
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_018_03
title: Create 5-agents/communication/src/guard/cooldown-tracker.ts
parent_node_id: n_018
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_018_04
title: Create 5-agents/communication/src/guard/guard-types.ts
parent_node_id: n_018
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_018_05
title: Create tests/guard/loop-guard.test.ts
parent_node_id: n_018
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 4.2: Escalation Handler
```
node_id: n_019
title: Implement escalation handler for blocked chains
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_018]
```

**Subtasks:**
```
node_id: n_019_01
title: Create 5-agents/communication/src/escalation/escalation-handler.ts
parent_node_id: n_019
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_019_02
title: Create 5-agents/communication/src/escalation/escalation-types.ts
parent_node_id: n_019
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_019_03
title: Create tests/escalation/escalation-handler.test.ts
parent_node_id: n_019
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 4.3: Human Passthrough
```
node_id: n_020
title: Implement human passthrough (bypass loop guard for humans)
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_018]
```

**Subtasks:**
```
node_id: n_020_01
title: Create 5-agents/communication/src/guard/human-passthrough.ts
parent_node_id: n_020
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_020_02
title: Create tests/guard/human-passthrough.test.ts
parent_node_id: n_020
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

---

## Phase 5: Chat Rooms UI & Real-time Backend

### Node 5.1: Chat Rooms Backend
```
node_id: n_021
title: Implement chat rooms backend service
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: []
```

**Subtasks:**
```
node_id: n_021_01
title: Create 4-services/chat-rooms/src/main.ts (Fastify server)
parent_node_id: n_021
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_021_02
title: Create 4-services/chat-rooms/src/types/room.types.ts
parent_node_id: n_021
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_021_03
title: Create 4-services/chat-rooms/src/types/message.types.ts
parent_node_id: n_021
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_021_04
title: Create 4-services/chat-rooms/src/store/room-store.ts
parent_node_id: n_021
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_021_05
title: Create 4-services/chat-rooms/src/store/message-store.ts
parent_node_id: n_021
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 5.2: WebSocket Server
```
node_id: n_022
title: Implement WebSocket server for real-time messaging
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_021]
```

**Subtasks:**
```
node_id: n_022_01
title: Create 4-services/chat-rooms/src/websocket/ws-server.ts
parent_node_id: n_022
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_022_02
title: Create 4-services/chat-rooms/src/websocket/ws-handler.ts
parent_node_id: n_022
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_022_03
title: Create 4-services/chat-rooms/src/websocket/ws-types.ts
parent_node_id: n_022
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_022_04
title: Create tests/websocket/ws-server.test.ts
parent_node_id: n_022
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 5.3: REST API
```
node_id: n_023
title: Implement REST API for chat rooms
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_021]
```

**Subtasks:**
```
node_id: n_023_01
title: Create 4-services/chat-rooms/src/routes/rooms-routes.ts
parent_node_id: n_023
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_023_02
title: Create 4-services/chat-rooms/src/routes/messages-routes.ts
parent_node_id: n_023
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_023_03
title: Create 4-services/chat-rooms/src/routes/members-routes.ts
parent_node_id: n_023
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_023_04
title: Create tests/routes/rooms-routes.test.ts
parent_node_id: n_023
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 5.4: Push Notifications (Elphame pattern)
```
node_id: n_024
title: Implement push notification system for @mentions
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_021]
```

**Subtasks:**
```
node_id: n_024_01
title: Create 4-services/chat-rooms/src/push/webhook-delivery.ts
parent_node_id: n_024
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_024_02
title: Create 4-services/chat-rooms/src/push/push-types.ts
parent_node_id: n_024
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_024_03
title: Create 4-services/chat-rooms/src/push/push-registry.ts
parent_node_id: n_024
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_024_04
title: Create tests/push/webhook-delivery.test.ts
parent_node_id: n_024
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 5.5: Chat Rooms UI (React)
```
node_id: n_025
title: Implement chat rooms UI (React + TypeScript)
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_022, n_023]
```

**Subtasks:**
```
node_id: n_025_01
title: Create 6-ui/chat-rooms/src/App.tsx
parent_node_id: n_025
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_025_02
title: Create 6-ui/chat-rooms/src/components/RoomList.tsx
parent_node_id: n_025
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_025_03
title: Create 6-ui/chat-rooms/src/components/MessageThread.tsx
parent_node_id: n_025
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_025_04
title: Create 6-ui/chat-rooms/src/components/MessageInput.tsx
parent_node_id: n_025
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_025_05
title: Create 6-ui/chat-rooms/src/components/MentionAutocomplete.tsx
parent_node_id: n_025
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_025_06
title: Create 6-ui/chat-rooms/src/components/RoomHeader.tsx
parent_node_id: n_025
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_025_07
title: Create 6-ui/chat-rooms/src/components/MemberList.tsx
parent_node_id: n_025
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_025_08
title: Create 6-ui/chat-rooms/src/hooks/useWebSocket.ts
parent_node_id: n_025
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_025_09
title: Create 6-ui/chat-rooms/src/hooks/useRoomMessages.ts
parent_node_id: n_025
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_025_10
title: Create 6-ui/chat-rooms/src/hooks/usePushNotifications.ts
parent_node_id: n_025
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

---

## Phase 6: Specialist Agent Profiles (The Agency import)

### Node 6.1: Import Agent Profiles
```
node_id: n_026
title: Import all 61 specialist agent profiles from The Agency
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: []
```

**Subtasks:**
```
node_id: n_026_01
title: Create 5-agents/packs/engineering/ directory with 8 agent profiles
parent_node_id: n_026
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_026_02
title: Create 5-agents/packs/design/ directory with 8 agent profiles
parent_node_id: n_026
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_026_03
title: Create 5-agents/packs/marketing/ directory with 12 agent profiles
parent_node_id: n_026
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_026_04
title: Create 5-agents/packs/product/ directory with 3 agent profiles
parent_node_id: n_026
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_026_05
title: Create 5-agents/packs/project-management/ directory with 5 agent profiles
parent_node_id: n_026
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_026_06
title: Create 5-agents/packs/testing/ directory with 8 agent profiles
parent_node_id: n_026
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_026_07
title: Create 5-agents/packs/support/ directory with 7 agent profiles
parent_node_id: n_026
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_026_08
title: Create 5-agents/packs/spatial-computing/ directory with 7 agent profiles
parent_node_id: n_026
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_026_09
title: Create 5-agents/packs/specialized/ directory with 7 agent profiles
parent_node_id: n_026
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 6.2: Rails Registry Integration
```
node_id: n_027
title: Register specialist agents in Rails registry
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_026]
```

**Subtasks:**
```
node_id: n_027_01
title: Create 4-services/registry/registry-server/src/agents/specialist-agents.ts
parent_node_id: n_027
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_027_02
title: Create 4-services/registry/registry-server/src/routes/agents-routes.ts
parent_node_id: n_027
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_027_03
title: Create CLI command: allternit registry import-agents
parent_node_id: n_027
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

---

## Phase 7: Rails Integration - Events, Gates, Receipts

### Node 7.1: Event Taxonomy Extension
```
node_id: n_028
title: Extend Rails event taxonomy with new event types
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: []
```

**Subtasks:**
```
node_id: n_028_01
title: Update 0-substrate/allternit-agent-system-rails/spec/EVENT_TAXONOMY.md
parent_node_id: n_028
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_028_02
title: Create 0-substrate/types/src/events/communication-events.ts
parent_node_id: n_028
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 7.2: Gate Extensions
```
node_id: n_029
title: Implement new Rails gates for communication layer
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_028]
```

**Subtasks:**
```
node_id: n_029_01
title: Create 2-governance/gate/src/gates/mention-gate.ts
parent_node_id: n_029
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_029_02
title: Create 2-governance/gate/src/gates/loop-guard-gate.ts
parent_node_id: n_029
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_029_03
title: Create 2-governance/gate/src/gates/webhook-gate.ts
parent_node_id: n_029
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 7.3: Receipt Types
```
node_id: n_030
title: Define new receipt types for communication events
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_028]
```

**Subtasks:**
```
node_id: n_030_01
title: Update 0-substrate/allternit-agent-system-rails/spec/RECEIPTS.md
parent_node_id: n_030
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_030_02
title: Create 0-substrate/types/src/receipts/communication-receipts.ts
parent_node_id: n_030
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

### Node 7.4: CLI Extensions
```
node_id: n_031
title: Extend Rails CLI with communication commands
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_028]
```

**Subtasks:**
```
node_id: n_031_01
title: Create 0-substrate/allternit-agent-system-rails/cli/commands/mention.ts
parent_node_id: n_031
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_031_02
title: Create 0-substrate/allternit-agent-system-rails/cli/commands/room.ts
parent_node_id: n_031
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_031_03
title: Create 0-substrate/allternit-agent-system-rails/cli/commands/webhook.ts
parent_node_id: n_031
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

---

## Phase 8: Testing & Documentation

### Node 8.1: Integration Testing
```
node_id: n_032
title: Create comprehensive integration test suite
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: validator
blocked_by: [n_010, n_014, n_018, n_022, n_027]
```

**Subtasks:**
```
node_id: n_032_01
title: Create tests/integration/webhook-to-workflow.test.ts
parent_node_id: n_032
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

```
node_id: n_032_02
title: Create tests/integration/mention-to-execution.test.ts
parent_node_id: n_032
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

```
node_id: n_032_03
title: Create tests/integration/multi-agent-chain.test.ts
parent_node_id: n_032
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

```
node_id: n_032_04
title: Create tests/integration/chat-room-flow.test.ts
parent_node_id: n_032
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: validator
```

### Node 8.2: Documentation
```
node_id: n_033
title: Create comprehensive documentation
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: planner
blocked_by: [n_032]
```

**Subtasks:**
```
node_id: n_033_01
title: Create docs/WEBHOOK_INGESTION_GUIDE.md
parent_node_id: n_033
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: planner
```

```
node_id: n_033_02
title: Create docs/AGENT_COMMUNICATION_GUIDE.md
parent_node_id: n_033
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: planner
```

```
node_id: n_033_03
title: Create docs/CHAT_ROOMS_GUIDE.md
parent_node_id: n_033
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: planner
```

```
node_id: n_033_04
title: Create docs/SPECIALIST_AGENTS_GUIDE.md
parent_node_id: n_033
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: planner
```

```
node_id: n_033_05
title: Create docs/LOOP_GUARD_GUIDE.md
parent_node_id: n_033
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: planner
```

```
node_id: n_033_06
title: Update docs/ARCHITECTURE.md with communication layer
parent_node_id: n_033
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: planner
```

### Node 8.3: Deployment
```
node_id: n_034
title: Create deployment configuration
parent_node_id: dag_comm_layer_v1
kind: subtask
execution_mode: PLAN_ONLY
owner_role: builder
blocked_by: [n_032]
```

**Subtasks:**
```
node_id: n_034_01
title: Create docker-compose.communication.yml
parent_node_id: n_034
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_034_02
title: Create 8-cloud/kubernetes/chat-rooms-deployment.yaml
parent_node_id: n_034
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

```
node_id: n_034_03
title: Create 8-cloud/kubernetes/webhook-ingestion-deployment.yaml
parent_node_id: n_034
kind: subtask
execution_mode: ACCEPT_EDITS
owner_role: builder
```

---

## Execution Order Summary

```
Phase 1 (n_001-n_010): Webhook Ingestion Service
  └── Blocked by: None
  └── Blocks: All phases (foundation)

Phase 2 (n_011-n_013): @mention Router
  └── Blocked by: None
  └── Blocks: Phase 3, 4

Phase 3 (n_014-n_017): MCP Proxy & Terminal Injection
  └── Blocked by: Phase 2
  └── Blocks: Phase 4

Phase 4 (n_018-n_020): Loop Guard
  └── Blocked by: Phase 2, 3
  └── Blocks: Phase 5

Phase 5 (n_021-n_025): Chat Rooms UI
  └── Blocked by: Phase 4
  └── Blocks: Phase 8

Phase 6 (n_026-n_027): Specialist Agents
  └── Blocked by: None (parallel)
  └── Blocks: Phase 8

Phase 7 (n_028-n_031): Rails Integration
  └── Blocked by: Phase 1-6 (for schemas)
  └── Blocks: Phase 8

Phase 8 (n_032-n_034): Testing & Documentation
  └── Blocked by: All phases
  └── Blocks: None (final)
```

---

## Total Task Count

- **Root:** 1
- **Phase 1:** 10 nodes, 43 subtasks
- **Phase 2:** 3 nodes, 10 subtasks
- **Phase 3:** 4 nodes, 13 subtasks
- **Phase 4:** 3 nodes, 8 subtasks
- **Phase 5:** 5 nodes, 24 subtasks
- **Phase 6:** 2 nodes, 12 subtasks
- **Phase 7:** 4 nodes, 10 subtasks
- **Phase 8:** 3 nodes, 13 subtasks

**Total: 35 nodes, 133 subtasks**

---

## Acceptance Criteria (Root DAG)

- [ ] All 133 subtasks completed with production code
- [ ] Zero placeholders, stubs, or TODO comments
- [ ] Test coverage >80% for all modules
- [ ] All integration tests passing
- [ ] Documentation complete and reviewed
- [ ] Deployment configuration ready
- [ ] Rails integration verified
- [ ] No license violations (AGPL code not copied)

---

**END OF DAG SPECIFICATION**
