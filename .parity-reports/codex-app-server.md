---
status: done
files_changed:
  - docs/public/parity/codex-app-server.md
  - .parity-reports/codex-app-server.md
items_covered:
  - "3b) Log in with ChatGPT (device-code flow)"
  - "3c) Log in with externally managed ChatGPT tokens (`chatgptAuthTokens`)"
  - "API overview"
  - "Approvals"
  - "Apps (connectors)"
  - "Archive a thread"
  - "Auth endpoints"
  - "Authentication modes"
  - "Clean background terminals"
  - "Command execution"
  - "Command execution approvals"
  - "Config RPC examples for app settings"
  - "Core primitives"
  - "Delete a thread"
  - "Detect and import external agent config"
  - "Dynamic tool calls (experimental)"
  - "Errors"
  - "Experimental API opt-in"
  - "File change approvals"
  - "Fuzzy file search events (experimental)"
  - "Getting started"
  - "Initialization"
  - "Inject items into a thread"
  - "Inspect an execution environment (experimental)"
  - "Interrupt a turn"
  - "Item deltas"
  - "Lifecycle overview"
  - "List experimental features (`experimentalFeature/list`)"
  - "List loaded threads"
  - "List models (`model/list`)"
  - "List thread turns"
  - "List threads (with pagination & filters)"
  - "MCP server elicitation requests"
  - "MCP tool-call approvals (apps)"
  - "Manage a thread goal"
  - "Notification opt-out"
  - "Permission requests"
  - "Process execution"
  - "Protocol"
  - "Read a stored thread (without resuming)"
  - "Read admin requirements (`configRequirements/read`)"
  - "Roll back recent turns"
  - "Run a thread shell command"
  - "Sandbox read access (`ReadOnlyAccess`)"
  - "Start a turn"
  - "Start a turn (invoke a skill)"
  - "Start or resume a thread"
  - "Steer an active turn"
  - "Track thread status changes"
  - "Trigger thread compaction"
  - "Turn events"
  - "Unarchive a thread"
  - "Unsubscribe from a loaded thread"
  - "Update stored thread metadata"
  - "Warning events"
  - "Windows sandbox setup (`windowsSandbox/setupStart`)"
  - "Windows sandbox setup events"
items_missing:
  - "ChatGPT device-code and externally managed ChatGPT tokens: not applicable to self-hosted/BYOC authentication."
  - "Wire-compatible Codex App Server JSON-RPC, initialization, config, and auth methods: no public equivalent."
  - "Cursor pagination, loaded-thread registry, typed turn listing, injection, and active-turn steering: roadmap."
  - "Hard delete, unarchive, and durable turn rollback: roadmap; current records and events are auditable/append-only."
  - "Addressable background-process, shell-command, environment-inspection, fuzzy-search-event, and Windows sandbox setup RPCs: roadmap or host-managed."
notes: "Docs-only change; no build or cargo check was run. All 57 handoff items are discussed, including explicit not-applicable/roadmap classifications where no stable Allternit equivalent exists."
---

# Codex App Server parity report

Created a single Allternit-branded mapping page for the Codex App Server
handoff category. The page maps durable lifecycle operations to the managed
Sessions and Events APIs, and live execution concerns to Gizzi Code, its Tool
Belt, MCP integration, permission profiles, and sandbox configuration.

The page deliberately does not claim wire compatibility. Codex-specific
ChatGPT token brokerage is classified as not applicable to Allternit's
self-hosted/BYOC model, while missing durable lifecycle and experimental RPCs
are recorded as roadmap gaps.
