# Kimi parity: remaining gaps and Allternit roadmap

This page maps the remaining Kimi guide concepts that do not yet have a direct Allternit equivalent or that differ by design.

## Video input as base64 `video_url`

Kimi accepts video via a base64 `video_url` content block. Allternit's message schema currently supports text, image, audio, PDF, and file references; native video input is on the multimodal roadmap. Until then, upload videos via `POST /v1/files` and reference them by `file_id` if the provider adapter supports it.

## Long-lived `settings.json` configuration

Kimi's Python examples store defaults in `settings.json`. Allternit's CLI uses `config.toml` and environment variables instead. Equivalent long-lived settings live in `~/.gizzi/config.toml` or project-level `.gizzi/config.toml`. See [Config and state locations](../cli/config-locations.md).

## IP/CIDR lists and IP allowlisting

Allternit exposes egress CIDRs via `GET /regions` so firewall teams can allow-list outbound traffic. Per-API-key IP allowlisting is not yet exposed in the admin console; it is planned for the virtual-key policy layer.

## Agentic capability improvements

Allternit's agent runtime provides tool use, multi-turn sessions, subagents, deployments, and memory. Ongoing work adds stronger agentic planning and self-correction; follow the [agent lifecycle guide](../guides/agent-lifecycle.md) and [use-case playbooks](../guides/use-case-playbooks.md).

## K2.5 / K2.6 benchmark parameters

Kimi publishes benchmark-tuned parameters for specific models. Allternit's model registry stores `context_window` and `max_output_tokens`, and the `/api/v1/models/recommend` endpoint ranks models by task and priority. Provider-specific benchmark presets are surfaced through the provider adapter; no manual parameter table is required.

## K3 API configuration

Kimi K3 is accessed through the same API as other Kimi models. On Allternit, use `model: "kimi/kimi-k3"` (or the exact provider model ID) with the standard `/v1/chat/completions` endpoint. Reasoning, JSON mode, and tool calling are all supported. See [Kimi API overview](../api/kimi-api-overview.md).

## Show cases (news report, spreadsheet analysis)

Kimi's official show cases are example applications. Allternit covers the same patterns in [use-case playbooks](../guides/use-case-playbooks.md) and can run them through `gizzi exec` or the agent API.

## `walle` tool

`walle` is a Kimi-specific utility. Allternit provides the same capabilities through the native [Tool Belt](../tools/tool-belt.md) (`web_search`, `web_fetch`, `bash`, `code_execution`, `memory`, `pdf_process`) and attached [MCP servers](../tools/mcp.md).

## Partial Mode

Kimi Partial Mode returns multiple candidate completions and lets the client pick the best. Allternit's chat endpoint currently returns one completion per request; multi-sample partial/best-of mode is not exposed. Obtain multiple samples by sending parallel requests with different seeds.

## Playground debugging and ModelScope MCP servers

Kimi's web Playground is a hosted debugging surface. Allternit is CLI-first and self-hosted; a web Playground is not available today. ModelScope MCP servers can be attached via the standard MCP config (`~/.allternit/mcp-servers.json`) and used from `gizzi` once the server is configured.
