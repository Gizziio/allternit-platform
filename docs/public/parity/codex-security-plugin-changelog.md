# Codex Security plugin changelog parity

This page maps the Codex Security plugin releases from `0.1.7` through `0.1.17`
to the security-review capabilities that are available in Allternit. The source
concepts come from the [Codex Security plugin changelog](https://learn.chatgpt.com/docs/security/plugin/changelog.md).

Codex Security is a specialized scanner with persisted scans, structured
findings, deep-scan workers, reports, exports, and issue-tracker workflows.
Allternit's current equivalent is narrower: Gizzi provides a built-in
`/security-review` workflow for reviewing the pending changes on the current
branch. It combines repository exploration, diff inspection, specialist
workers, false-positive review, and a Markdown result. Allternit also provides
general agent sessions, streaming events, usage accounting, approval profiles,
and auditable administration APIs.

There is no Allternit package whose version numbers correspond to the Codex
Security plugin versions. The release headings below are compatibility
landmarks, not claims that Allternit shipped matching releases on those dates.

## Current Allternit workflow

Start Gizzi in the repository and run the built-in command:

```bash
cd /path/to/repository
gizzi
```

```text
/security-review
```

The workflow reads `git status`, the commits and changed files relative to
`origin/HEAD`, and the complete diff. It asks a security specialist to inspect
repository context, trace concrete attack paths, and filter proposed findings.
The final Markdown includes the file and line, severity, category, description,
exploit scenario, and fix recommendation. Only findings with confidence of at
least 8/10 survive the final filter.

For automation, use the normal non-interactive agent surface and state the
scope explicitly:

```bash
gizzi exec --profile untrusted-audit --no-interactive \
  "Review changes against origin/HEAD for concrete security regressions. Read SECURITY.md, cite file and line evidence, and return Markdown findings only."
```

Use a restrictive permission profile for untrusted repositories:

```toml
# ~/.gizzi/profiles/untrusted-audit.toml
[permissions]
approval_policy = "never"
sandbox_mode = "workspace-write"
network_access = false
allow_login_shell = false

[permissions.sandbox_workspace_write]
writable_roots = []
```

The review command itself only permits repository reads and read-only Git
inspection. Gizzi's permission profile remains the enforcement boundary. See
[Agent approvals and security](../cli/agent-approvals-security.md) and
[Permission profiles](../cli/permission-profiles.md).

## Release-by-release mapping

| Codex Security release | Allternit mapping | Parity status |
| --- | --- | --- |
| **0.1.7 (June 4, 2026)** | `/security-review` covers **Run evidence-backed security reviews** for pending branch changes. It gathers the real diff, researches repository context, requires a concrete attack path, and emits actionable Markdown. It does not provide a general repository/folder scan engine, repeated discovery ledger, or persisted validation pipeline. | Partial |
| **0.1.9 (June 18, 2026)** | The slash command provides **Run scans with less setup** for the change-review case. General Gizzi sessions can be resumed, but Allternit has no security findings workspace, scan-specific cancellation/recovery, canonical scan manifest, JSON/CSV/SARIF exporter, or built-in backlog triage and tracking. This also leaves **Export portable, verifiable results** and **Triage and track existing findings** on the roadmap. | Partial / roadmap |
| **0.1.10 (June 23, 2026)** | The workflow reviews the current branch relative to `origin/HEAD` and includes status, commits, changed paths, and diff content. That is a local equivalent for reliable change context. **Improve Jira and Linear ticket intake** is roadmap: Allternit can expose connectors through MCP, but it has no security-specific ticket importer, ranking contract, or verified write-back flow. | Partial / roadmap |
| **0.1.11 (July 10, 2026)** | The Markdown finding schema and evidence/confidence rules partially cover **Produce detailed finding and hardening reports** and **Write clearer vulnerability reports**. A repository can define policy in `SECURITY.md`, and the reviewer is instructed to research the threat model and existing secure patterns. There is no automatic closest-file policy resolution, coverage ledger, per-finding report tree, PoC bundle, hardening portfolio, or direct vulnerability-writeup/hardening command; therefore **Run reporting workflows directly** and full **Apply repository guidance and coverage consistently** remain roadmap. | Partial / roadmap |
| **0.1.12 (July 23, 2026)** | Gizzi has specialist/subagent execution, generic progress UI, durable history, and retryable agent work. Those primitives do not constitute a security deep-scan coordinator or saved findings workspace. **Run deeper scans with clearer progress**, **Review and rerun previous scans**, **Review and remediate validated findings**, and **Export results for existing security workflows** are roadmap. **Configure scans with fewer interruptions** maps only to running `/security-review` in the current terminal and selecting an approval profile before the run. | Partial / roadmap |
| **0.1.13 (July 25, 2026)** | The reviewer is told that locally reachable vulnerabilities may still be severe and to judge concrete exploitability rather than deployment labels. This partially covers **Review findings across more environments**. Allternit does not persist deployment/exposure context or use it to recalculate finding confidence and severity. | Partial |
| **0.1.14 (July 28, 2026)** | A repository-level `SECURITY.md` can document trust boundaries, accepted risk, exclusions, and disclosure instructions. This is the manual equivalent for **Define repository security policy**. `/security-review` uses one complete branch diff and a high-confidence filter, partially covering **Run standard scans with a simpler workflow**. A scan-history comparator, stable finding identities, scoped/nested policy resolver, and pre-creation review queue for issues do not exist, leaving **Review scan history and recurring findings** and **Review findings before tracking them** on the roadmap. | Partial / roadmap |
| **0.1.15 (July 30, 2026)** | Gizzi supports nested Git worktrees, repository-root workspace boundaries, saved session history, and `/resume`; these are useful general foundations for **Handle more repository layouts and paths**. They do not preserve a security scan snapshot or recover malformed finding records. Scan-specific **Keep scans accurate as projects change**, **Give feedback and recover findings**, and **Reduce unnecessary scan work** remain roadmap. | Foundation / roadmap |
| **0.1.16 (August 4, 2026)** | Allternit sessions account for tokens, turns, and tool calls, and admin analytics expose token usage. Repository instructions and targets can be stated in the prompt and session metadata. There is no per-phase/per-worker security usage report, immutable target guard, enterprise scan proxy layer, deep-scan phase contract, or dedicated vulnerability-report generator. **Track measured scan usage**, **Run deeper scans with consistent results**, and **Keep scan guidance and repository targets accurate** therefore have reusable platform primitives but no scanner-level equivalent. The required Markdown schema partially covers **Write clearer vulnerability reports**. | Foundation / roadmap |
| **0.1.17 (August 5, 2026)** | Managed sessions expose ordered SSE/WebSocket events, budgets, interruption, history, and generic resumption. These provide foundations for **Follow scan progress as it happens**, **Resume interrupted deep scans**, and **Start and complete scans with less overhead**, but `/security-review` does not checkpoint file-level review, worker ownership, security phases, or findings. | Foundation / roadmap |

## Capability map

The following table makes the handoff-level distinctions explicit. “Foundation”
means that Allternit has a reusable platform primitive, but not the specialized
security workflow described by the Codex release.

| Changelog capability | Allternit equivalent | Status |
| --- | --- | --- |
| **Run evidence-backed security reviews** | `/security-review` inspects the actual pending diff, researches repository context, requires file/line evidence and an exploit scenario, and filters low-confidence findings. | Available for change reviews |
| **Run scans with less setup**; **Run standard scans with a simpler workflow**; **Start and complete scans with less overhead** | Run `/security-review` in an existing Gizzi session, or use `gizzi exec` with an explicit review prompt. | Partial; no general scan command |
| **Apply repository guidance and coverage consistently**; **Define repository security policy** | Maintain a repository `SECURITY.md`; the review prompt explicitly asks the agent to understand the project's security and threat model. | Partial; no scoped policy resolver or coverage ledger |
| **Produce detailed finding and hardening reports**; **Write clearer vulnerability reports** | The built-in Markdown contract requires location, severity, category, description, exploit scenario, and remediation. Confidence filtering separates supported findings from speculation. | Partial; no report bundle, PoCs, or hardening portfolio |
| **Review findings across more environments** | The built-in guidance does not discard an issue merely because it is locally reachable; severity follows exploitability and impact. | Partial; no stored environment model |
| **Configure scans with fewer interruptions** | Select `--profile` and `--no-interactive` before a run; approval and network behavior are deterministic. | Partial; these configure agent execution, not scan phases |
| **Follow scan progress as it happens**; **Run deeper scans with clearer progress** | Generic session events can stream over SSE or WebSocket and Gizzi renders agent/tool activity. | Foundation only |
| **Track measured scan usage** | Managed sessions enforce token/turn/tool-call budgets; organization analytics report token usage. | Foundation only; not attributed to security phases/workers |
| **Resume interrupted deep scans**; **Review and rerun previous scans** | Gizzi retains session transcripts and supports `/resume`; managed sessions retain ordered events. | Foundation only; no scan checkpoint or rerun contract |
| **Handle more repository layouts and paths** | Git-aware workspace boundaries, worktrees, path-safe tools, and nested repositories are supported by the general agent runtime. | Foundation only; no security snapshot preflight |
| **Keep scan guidance and repository targets accurate**; **Keep scans accurate as projects change** | Put target and policy in the prompt/session metadata and use Git worktrees or a pinned checkout operationally. | Roadmap; no automatic revision/target invalidation |
| **Reduce unnecessary scan work**; **Run deeper scans with consistent results** | General agents can delegate work, but no canonical security discovery/validation/attack-path phase engine exists. | Roadmap |
| **Export portable, verifiable results**; **Export results for existing security workflows** | Redirect the Markdown response to a file if needed. | Roadmap for canonical JSON, CSV, SARIF, manifest, coverage, and integrity metadata |
| **Review and remediate validated findings** | Ask Gizzi to fix an accepted Markdown finding in a separate, user-approved task and run relevant verification. | Manual workflow; no finding identity or remediation state |
| **Give feedback and recover findings** | General user feedback can steer a session, but there is no false-positive endpoint or malformed-finding recovery. | Roadmap |
| **Review scan history and recurring findings** | Session history is available, but it does not compare security results as new, persisting, resolved, or not rescanned. | Roadmap |
| **Review findings before tracking them** | Allternit's approval model can require confirmation before connector writes. | Foundation only; no findings selection queue |
| **Triage and track existing findings**; **Improve Jira and Linear ticket intake** | Jira, Linear, or GitHub may be attached as operator-selected MCP/plugin integrations. There is no security-specific intake schema, evidence verdict, duplicate check, rank queue, or verified write-back. | Roadmap |
| **Run reporting workflows directly** | A user can prompt a general agent to rewrite a supplied assessment, but Allternit has no dedicated vulnerability-writeup or hardening workflow contract. | Roadmap |

## Streaming progress and usage foundations

For a custom security workflow built on Allternit, create a managed session with
a budget, stream its ordered events, and store the scan identifier and Git
revision in metadata:

```bash
curl -X POST "${ALLTERNIT_API_URL}/api/v1/beta/sessions" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "security-review-main",
    "metadata": {
      "workflow": "security-review",
      "repository": "acme/service",
      "git_revision": "0123456789abcdef"
    },
    "budget": {
      "max_tokens": 100000,
      "max_turns": 100,
      "max_tool_calls": 500
    }
  }'
```

```bash
curl -N "${ALLTERNIT_API_URL}/api/v1/beta/sessions/${SESSION_ID}/events?after=0" \
  -H "Authorization: Bearer ${CLERK_JWT}" \
  -H "Accept: text/event-stream"
```

This supplies durable execution telemetry, not a security findings data model.
Consumers must currently define their own phases, checkpoints, result schema,
and exports. See the [Sessions API](../api/sessions.md), [Events API](../api/events.md),
and [Analytics API](../cli/analytics-api.md).

## Not applicable / roadmap

The hosted Codex plugin catalog, its plugin release pinning behavior, and its
embedded/side-panel findings UI are **not applicable** to Allternit's
self-host/BYOC deployment model. Operators choose and version their own Gizzi,
API, model provider, plugins, and MCP services.

The remaining differences are genuine roadmap items rather than BYOC
differences:

- a first-class `gizzi security scan` command for repository, path, change, and
  deep modes;
- immutable scan targets and resumable, file-level deep-scan checkpoints;
- canonical manifests, findings, coverage, reports, JSON, CSV, and SARIF;
- stable finding identities, history comparison, false-positive feedback, and
  remediation state;
- evidence-aware Jira, Linear, GitHub Issues, and GitHub Security Advisory
  intake and write-back; and
- per-finding reports, PoC artifacts, architectural hardening portfolios, and
  scan-specific usage attribution.

Until those contracts exist, do not treat a resumed Gizzi conversation, a
Markdown response, or generic connector access as equivalent to a persisted
Codex Security scan.
