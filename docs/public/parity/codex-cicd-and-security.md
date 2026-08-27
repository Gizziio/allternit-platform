# Codex CI/CD and security parity

This page maps Codex's automated review, code review, security scanning, and CI/CD concepts to Allternit's self-hosted primitives.

## Auto-review

Codex Auto-review automatically flags risky tool calls. Allternit covers the same need through **permission profiles** and **approval policies** that decide when the agent must ask before acting:

```toml
[permissions]
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

To reduce review volume without weakening security, use granular rules that allow common read-only operations and ask only for writes, network access, or shell execution. See [Permission profiles](../cli/permission-profiles.md) and [Agent approvals and security](../cli/agent-approvals-security.md).

## Code review

Codex's code-review surface is a hosted IDE/review pane. In Allternit you run reviews from the CLI or CI:

```bash
gizzi exec --no-interactive "review the staged diff and leave inline comments"
```

The agent can read `git diff`, use the `str_replace_editor` tool, and emit markdown feedback. For editor-native reviews, attach an MCP server that speaks your editor's protocol.

## Review GitHub pull requests with Codex

There is no dedicated GitHub pull-request reviewer UI, but the same workflow runs in CI. Add a GitHub Actions job that calls `gizzi exec` with a PR diff:

```yaml
- name: Allternit PR review
  env:
    ALLTERNIT_API_KEY: ${{ secrets.ALLTERNIT_API_KEY }}
  run: |
    gizzi exec --no-interactive \
      "review the diff in ${{ github.event.pull_request.html_url }} and post a summary"
```

Security reviews are covered by Allternit's audit, compliance, and groundedness-check APIs; see the [security model](../security/security-model.md).

## Run Codex Security in CI

Codex Security scan jobs map to Allternit's CI-friendly CLI plus security APIs:

```bash
gizzi exec --no-interactive \
  --allowedTools bash,file.read \
  "scan this repo for secrets and dependency vulnerabilities"
```

For policy enforcement, use **inference hooks** to send every request through an internal security service, or call the compliance endpoints directly. The CLI works in GitHub Actions and GitLab CI/CD; severity policies are expressed in your `config.toml` approval rules or in an outcome rubric.

## Security Review

Allternit provides the building blocks for security review:

- Threat-model context can be attached as project instructions or an `AGENTS.md` file.
- Reporting thresholds are configured via [outcome rubrics](../guides/use-case-playbooks.md) or compliance check thresholds.
- Findings are stored in the audit/compliance feeds (`/api/v1/admin/compliance/activity`, `/api/v1/admin/audit`).

## Use the Codex Security workbench

There is no single hosted security workbench. Instead:

- Start a scan from a conversation by asking the agent to review code with the `bash` or `code_execution` tools.
- Inspect repository history with `git` tools or a connected MCP server.
- Review findings across runs through the admin audit feed and stored session transcripts.

## Triage a backlog

Triage is implemented as a skill or MCP-attached tool. For example, a security skill can list findings, filter by severity, and propose fixes:

```bash
gizzi exec --skill security-audit "triage high-severity findings in findings.json"
```

## Write vulnerability reports

Use the harness to generate a structured report from a codebase:

```bash
gizzi exec --no-interactive \
  --response_format json_schema \
  "audit this repo for OWASP Top 10 issues and return a vulnerability report"
```

The response can be saved, posted to an issue tracker via webhook, or fed into the compliance API.
