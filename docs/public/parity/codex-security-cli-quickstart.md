# Codex Security CLI quickstart parity

Allternit does not yet provide a dedicated security scanning CLI. This quickstart uses the supported gizzi-code `security-review` plugin workflow for a high-confidence review of the current branch and `gizzi verification` for separate patch validation.

## Check the prerequisites

You need gizzi-code, a Git worktree with an `origin/HEAD` base reference, and a configured model provider.

```bash
gizzi --version
git rev-parse --show-toplevel
git symbolic-ref refs/remotes/origin/HEAD
gizzi auth status
```

If the last command reports no authentication, sign in. Reviews do not require a build; tests are needed only when you choose empirical validation.

## Set up and verify the CLI; Sign in

```bash
gizzi auth login --provider anthropic --profile security
gizzi auth status
gizzi auth diagnose
gizzi --help
```

For BYOC inference, configure an `openai-compatible` profile and its `base_url` in `~/.config/gizzi-code/config.toml`.

## Install the security-review workflow

The legacy `/security-review` command delegates to the `security-review` plugin. Install it from your approved Allternit marketplace when available, then verify it is enabled:

```bash
gizzi plugin install security-review --repo <approved-marketplace-url>
gizzi plugin list
gizzi plugin enable security-review
```

If the private marketplace is available in your distribution, invoking `/security-review` may guide the installation. There is no public package URL guaranteed by this repository.

## Add architecture and security context

Add durable, reviewable context to `AGENTS.md` or a project instruction file. Include trust boundaries, sensitive assets, attacker assumptions, expected authorization checks, and known exclusions. Never put secrets in instructions.

## Prepare a scan

Fetch the intended base, inspect the exact range, and use a clean, isolated worktree:

```bash
git fetch origin
git status --short
git log --oneline origin/HEAD..HEAD
git diff --stat origin/HEAD...HEAD
```

The workflow reads the branch diff and does not edit it. Large or unrelated diffs reduce review quality; split them when possible.

## Run your first scan

Start gizzi-code in the repository and invoke:

```text
/security-review
```

This is a change-focused agent review, not a deterministic SAST scan. The command requests only concrete high- and medium-severity findings with an exploitable path.

## Review the results

For each finding, verify its file/line, data flow, attacker control, boundary crossed, exploit scenario, severity, and proposed remediation. Compare it with project policy and deterministic scanner output. A blank report is not proof of safety.

## Choose the next scan

Rerun after material fixes, review a smaller explicit commit range in an isolated worktree, or use a normal read-only gizzi-code prompt for selected paths. There are no standardized `working-tree`, `commits`, `paths`, or `deep` scan modes yet.

## Scan changes before each commit

Use a manual pre-commit review or a CI job; Allternit does not install a Git hook automatically. In automation, pin the target commits and capture output as an artifact. Avoid blocking a commit solely on nondeterministic agent output; combine it with tests and deterministic security tooling.

## Set a scan budget

There is no security-specific cost flag. Services built on Allternit's managed sessions can cap generic execution:

```json
{"budget":{"max_tokens":20000,"max_turns":30,"max_tool_calls":80}}
```

Budget exhaustion means the run may be incomplete. It must not be reported as "no findings."

## Revisit a saved scan

Security reviews are not stored as named scans. Save Markdown/JSON output and immutable commit IDs in CI artifacts. Only general verification has local history:

```bash
gizzi verification history --limit 20
gizzi verification show <id> --output certificate
```

## Scan repositories in bulk

**Not applicable / roadmap:** no built-in bulk or resume command exists. A CI matrix can run one isolated review per repository and retain each result, but the operator owns provider quotas, budgets, retry, cancellation, and deduplication.

