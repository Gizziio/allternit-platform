---
status: done
files_changed:
  - docs/public/parity/codex-manual-part4.md
  - .parity-reports/codex-manual-part4.md
items_covered:
  - 'env_key = "AZURE_OPENAI_API_KEY"'
  - 'env_key_instructions = "Set AZURE_OPENAI_API_KEY in your environment"'
  - 'env_vars local and remote forwarding examples'
  - 'excluded_tool_namespaces = ["mcp__codex_apps"]'
  - 'experimental_compact_prompt_file (relative and absolute forms)'
  - 'experimental_environment = "remote"'
  - 'exporter tables and OTLP headers'
  - 'fast_mode = true'
  - 'features/unified_exec and unified_exec = true'
  - 'forced_chatgpt_workspace_id and forced_login_method = "chatgpt"'
  - 'generate_memories = true'
  - 'glob patterns and glob_scan_max_depth = 3'
  - 'warning, migration, and nudge suppression flags'
  - 'hooks, matcher, command type, and statusMessage'
  - 'MCP static headers, OAuth resource/scopes, URL, required, and timeouts'
  - 'include_only arrays and environment inheritance modes'
  - 'interrupt message/turn and session interrupt API'
  - 'limit_tokens, reminder interval, compaction limits, and tool output limit'
  - 'log_dir, sqlite_home, history max_bytes, and save-all/none'
  - 'max_concurrent_threads_per_session = 6'
  - 'mcp_oauth_callback_port and mcp_oauth_callback_url'
  - 'mode = "limited", open_world_enabled, and remote_plugin'
  - 'model catalog, context window, instructions, provider, verbosity, and service tier'
  - 'Azure, Ollama, Bedrock, data-residency, and proxy provider examples'
  - 'network proxy, proxy URL, and SOCKS URL'
  - 'notification, idle sleep, and refresh controls'
  - 'external editor, transcript, submit, status line, terminal title, and theme controls'
  - 'oss_provider = "ollama" and openai_base_url'
  - 'skill path and skill_mcp_dependency_install'
  - 'personality boolean and named variants'
  - 'prefill_token_weight and sampling_token_weight'
  - 'profile = "default" and project_root_markers'
  - 'protocol = "binary" | "json" and wire_api = "responses"'
  - 'query_params api-version and region'
  - 'resume_cwd = "session"'
  - 'sandbox unelevated/read-only, trust level, and workspace metadata rules'
  - 'shell_snapshot, shell_tool, view_image, and tools_view_image'
  - 'startup_timeout_sec and tool_timeout_sec variants'
  - 'web_search indexed/live and search-index explanation'
  - 'Google Calendar, Gmail, Figma, and Slack connector/plugin objects'
items_missing: []
notes: 'Docs-only change. No build, cargo check, commit, or other git mutation was run. Related duplicate literals are grouped in the coverage list and individually discussed in the documentation.'
---

# Completion report

Created the fourth Codex-manual parity page and mapped every assigned literal
to a supported Allternit configuration, SDK adapter, CLI/runtime workflow, API
endpoint, deployment-level alternative, or an explicit Not applicable / roadmap
classification. Examples cover provider profiles, Azure/Ollama/Bedrock, MCP,
sandbox and permissions, history, OTel, keybindings, session interruption, and
live web search.
