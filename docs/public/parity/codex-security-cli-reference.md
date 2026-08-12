# Codex Security CLI reference parity

Codex Security has a purpose-built scan command. Allternit's supported approximation is a read-only security-review plugin workflow plus the general `gizzi run`, authentication, configuration, and verification commands. Commands shown below exist; `gizzi security scan` does not.

## Authentication and prerequisites; Select scan authentication

Run inside a Git worktree with a configured model provider and a base remote reference such as `origin/HEAD`.

```bash
gizzi auth login --provider anthropic --profile security
gizzi auth status
gizzi auth diagnose
gizzi models
```

Use `gizzi auth profile add`, `list`, `set-active`, and `remove` for named provider profiles. Provider keys may come from an environment variable through `api_key_env`; a local OpenAI-compatible endpoint can omit a cloud key when that endpoint permits it.

## Discover commands and connect agents

Use `gizzi --help`, `gizzi auth --help`, `gizzi verification --help`, and `gizzi plugin --help`. External agent/tool runtimes can connect over MCP; Allternit exposes JSON-RPC methods `initialize`, `ping`, `tools/list`, and `tools/call` at `/mcp/server`.

## Select the scan target

`/security-review` currently targets the checked-out branch diff from `origin/HEAD`. It has no `--working-tree`, `--commit`, `--paths`, or `--repo` flags. Use an isolated worktree and an explicit prompt for other targets; treat these as custom reviews, not standardized scan modes.

```bash
gizzi run --format json \
  "Read-only security review of git diff main...HEAD. Report only concrete exploitable findings; do not edit files."
```

## Add scan instructions; Add security context

Store repository-wide guidance in `AGENTS.md` and project-specific gizzi configuration/instruction files. Include architecture, trust boundaries, attacker assumptions, exclusions, and test commands. The dedicated security-review prompt already defines confidence and output requirements; additional project context refines it.

## Configure the runtime

`~/.config/gizzi-code/config.toml` supplies global settings and `.gizzi/config.toml` supplies project overrides. A conservative review profile is:

```toml
default_model = "anthropic/claude-sonnet-4"

[sandbox]
mode = "read-only"
allow_network = false

[approval_policy]
mode = "on-request"

[auth]
active_profile = "security"
```

Configuration precedence and supported values are documented in [the configuration reference](../gizzi/configuration.md).

## Use OpenRouter or Fireworks

There are no security-only provider flags. Configure either service through a provider profile when supported by the runtime, or as an OpenAI-compatible endpoint:

```toml
[auth.profiles.openrouter]
provider = "openai-compatible"
base_url = "https://openrouter.ai/api/v1"
api_key_env = "OPENROUTER_API_KEY"

[auth.profiles.fireworks]
provider = "openai-compatible"
base_url = "https://api.fireworks.ai/inference/v1"
api_key_env = "FIREWORKS_API_KEY"
```

Select the profile with `gizzi auth profile set-active openrouter`. Model availability and billing remain provider responsibilities.

## Configure deep scans

**Not applicable / roadmap:** Allternit has no deep-scan switch. For a broader custom review, provide an explicit base/head, paths, security context, and higher generic session budget. More tokens or turns do not establish complete coverage.

## Set output and policy options

General non-interactive runs support machine-readable output; verification supports `text`/`json` and confidence thresholds. Use read-only sandboxing for review:

```bash
gizzi run --format json "Perform a read-only security review of this branch"
gizzi verification verify --confidence high --output json
```

Do not use permission- or sandbox-bypass flags for untrusted repositories.

## Read scan output; Completion summary

The security-review command returns Markdown. Each accepted finding should include file and line, severity, category, description, exploit scenario, recommendation, and confidence. Absence of findings means only that the agent reported none under the supplied context; it is not a clean bill of security. There is no standardized completion/coverage summary yet.

## Scan artifacts

No first-class security artifact schema exists. Capture Markdown or JSON stdout, the exact commit IDs, model/profile, instruction version, and any verification certificate in CI artifacts. Generic Allternit artifacts and session metadata can hold references, but they do not add security-finding semantics.

## Find saved scans; Inspect or repeat a scan

Security scans are not saved by the CLI. Verification records are:

```bash
gizzi verification history --limit 20 --output json
gizzi verification show <id> --output certificate
```

Repeat a security review from the same immutable commit/worktree and pinned configuration. A dedicated `scan repeat <id>` command is roadmap work.

## Match and compare findings

**Not applicable / roadmap:** there are no stable finding fingerprints, baselines, or comparison commands. Use a team-owned SARIF/findings system if matching is required.

## Exit codes and signals

`gizzi verification verify` sets exit code `1` when verification fails or confidence is below the requested threshold; lookup and confirmation errors also set failure status. The interactive security-review workflow does not expose a documented finding-count exit-code contract. Normal process signals may interrupt a run, but there is no resumable scan checkpoint.

## Verbose diagnostics

Use `gizzi auth diagnose` for credential resolution and `gizzi debug config` for resolved configuration. Generic logging/telemetry can aid runtime diagnosis, but no `security scan --verbose` trace exists. Avoid logging secrets or full proprietary source in shared CI logs.

