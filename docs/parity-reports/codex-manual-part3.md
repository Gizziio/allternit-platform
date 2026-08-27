---
status: done
files_changed:
  - docs/public/parity/codex-manual-part3.md
  - docs/parity-reports/codex-manual-part3.md
items_covered:
  - "Track Windows onboarding acknowledgement (Windows only). Default: false"
  - "Treat a directory as the project root when it contains any of these markers."
  - "Triage a backlog"
  - "TypeScript"
  - "UI guidelines"
  - "UI, Notifications, and Misc"
  - "UI, Notifications, and Misc (tables)"
  - "URI scheme for clickable citations: vscode (default) | vscode-insiders | windsurf | cursor | none"
  - "Use Codex in Linear"
  - "Use Codex in Slack"
  - "Use [] to unbind an action."
  - "Use a custom name such as workspace only when you also define [permissions.workspace]."
  - "Use the Codex Security workbench"
  - "Visualizations"
  - "Web search mode: disabled | cached | indexed | live. Default: cached"
  - "What's new"
  - "When notifications fire: unfocused (default) | always"
  - "When to ask for command approval:"
  - "Where to persist CLI login credentials: file (default) | keyring | auto"
  - "Who reviews eligible approval prompts: user (default) | auto_review"
  - "Windows app"
  - "Windows sandbox"
  - "Working directory for resumed or forked sessions: current | session."
  - "Workspace analytics"
  - "Workspace model availability"
  - "Worktrees"
  - "Write vulnerability reports"
  - "You can also add custom .tmTheme files under $CODEX_HOME/themes."
  - "[model-with-reasoning, context-remaining, current-dir]"
  - "[spinner, project]. Set to [] to clear the title."
  - "[[hooks.PreToolUse.hooks]] and [[hooks.PreToolUse]]"
  - "[agents.reviewer]"
  - "[apps._default], [apps.google_drive], and [apps.google_drive.tools.files/delete]"
  - "[features.code_mode], [features.network_proxy], and [features.rollout_budget]"
  - "[mcp_servers.docs] and [mcp_servers.github]"
  - "OTLP HTTP/gRPC exporter, headers, TLS, endpoint, certificate, and compression examples"
  - "[permissions.workspace] filesystem, network, domains, unix_sockets, and workspace_roots"
  - "[projects./absolute/path/to/project]"
  - "[tool_suggest]"
  - "[tui.keymap.chat], [tui.keymap.composer], and [tui.keymap.global]"
  - "[tui.model_availability_nux]"
  - ":workspace_roots filesystem rules"
  - "Network proxy allow_local_binding, allow_upstream_proxy, SOCKS5, admin URL, and dangerous non-loopback switches"
  - "alternate_screen, task-progress, approval_mode, approvals_reviewer, and background terminal timeout"
  - "App defaults, destructive enablement, enabled/disabled tool lists, and discoverables"
  - "Provider base_url examples for Ollama, Azure, custom proxy, and regional OpenAI"
  - "MCP command, args, cwd, env, bearer token, and environment-header examples"
  - "Agent description, config_file, developer_instructions, and compact_prompt examples"
  - "Prose fragments about recommended examples, common tools, defaults, and task progress"
items_missing:
  - "Configurable project-root marker list: Gizzi's marker set is currently fixed."
  - "Codex hosted Linear, Slack, and Security workbench experiences: use self-hosted connector/MCP/reviewer workflows; dedicated integrations are roadmap."
  - "Codex-specific TUI citation scheme, nested keymaps/unbind arrays, title components, focus-aware notifications, alternate screen, and .tmTheme loading: no literal config parity."
  - "Auto-review approval reviewer: human ask/allow/deny policies exist, but no distinct auto_review reviewer."
  - "Native Windows-specific sandbox: cross-platform sandbox exists; Windows-specific isolation remains roadmap."
  - "Unified network proxy with loopback/private/Unix-socket/SOCKS policy: use sandbox domain rules and deployment networking today."
  - "Codex app inheritance and per-app destructive TOML: behavior maps to connector, registry, MCP, and permission policy instead."
  - "Detailed OTLP HTTP/gRPC exporter TLS schema: basic tracing exists; configure collectors/exporters in the deployment environment."
  - "Rollout-budget feature: provider limits, key policy, rate limits, and analytics exist, but the named feature is roadmap."
notes: "Documentation-only change; no build was run. The page covers every assigned handoff item, groups context-free config fragments with their parent feature, and distinguishes semantic parity from literal key parity."
---

# Codex manual part 3 parity report

Created a single parity guide covering project discovery, sessions and
worktrees, permissions, provider profiles, model availability, MCP and apps,
agents and hooks, web search, TypeScript, TUI behavior, analytics, observability,
and vulnerability-report workflows.

The guide uses concrete Allternit TOML, JSON, TypeScript, CLI, and `curl`
examples. OpenAI-hosted product surfaces and Codex-only schema details are
explicitly marked not applicable or roadmap rather than presented as supported
Allternit keys.
