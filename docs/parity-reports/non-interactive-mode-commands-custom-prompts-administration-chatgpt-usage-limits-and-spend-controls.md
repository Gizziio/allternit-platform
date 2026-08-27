---
status: done
files_changed:
  - docs/public/parity/non-interactive-mode.md
  - docs/public/parity/commands.md
  - docs/public/parity/custom-prompts.md
  - docs/public/parity/administration.md
  - docs/public/parity/chatgpt-usage-limits-and-spend-controls.md
  - docs/parity-reports/non-interactive-mode-commands-custom-prompts-administration-chatgpt-usage-limits-and-spend-controls.md
items_covered:
  - Advanced stdin piping
  - Authenticate in automation
  - Basic usage
  - Common automation patterns
  - Create structured outputs with a schema
  - Draft a pull request comment from CI logs
  - "Example: Autofix CI failures in GitHub Actions"
  - Git repository required
  - Inspect TLS or HTTP issues
  - Make output machine-readable
  - Prepare a Slack-ready update
  - Resume a non-interactive session
  - Summarize logs
  - Use `codex exec -` when stdin is the prompt
  - Use prompt-plus-stdin
  - Deep links
  - Keyboard shortcuts
  - Search past chats and find in a chat
  - See also
  - Settings
  - Supported links
  - Add metadata and arguments
  - Administration
  - Know when these controls apply
items_missing: []
notes: "Docs-only change. SaaS-specific ChatGPT subscription limits and automatic external publishing are explicitly classified as not applicable; equivalent BYOK/self-host controls and composable publishing workflows are documented. No build was run."
---

# Parity documentation report

Created one public page for each assigned category. The pages map the original ChatGPT/Codex concepts to code-backed Allternit CLI commands, configuration, API routes, session controls, and TUI behavior.

The non-interactive page documents `gizzi exec` argument/stdin composition, NDJSON input, JSON output, JSON Schema validation, session continuation, CI examples, TLS diagnosis, authentication, and safety boundaries. The commands page records current keybindings, search surfaces, layered settings, and the guarded deep-link/transport schemes. The custom-prompts page documents command frontmatter and named/raw argument substitution. The administration and usage-control pages separate Allternit-enforced policy from upstream-provider and self-hosted responsibilities.

No Rust or application code was changed, so `cargo check` was not run. The handoff document was not modified and no git mutation was performed.
