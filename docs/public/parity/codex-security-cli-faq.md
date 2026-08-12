# Codex Security CLI FAQ parity

Codex Security CLI exposes durable repository scans, comparison, history, budgets, and automation. Allternit does not currently ship a `gizzi security scan` command. Its closest present surfaces are the `security-review` plugin workflow, generic non-interactive agent runs, managed session budgets, and `gizzi verification` history.

## Who can use the CLI? Why can a scan use an API key after sign-in?

Anyone who can install gizzi-code and authenticate a supported provider can run agent workflows. Authentication is provider-based rather than a Codex Security entitlement:

```bash
gizzi auth login --provider anthropic --profile security
gizzi auth status
gizzi auth diagnose
```

An API key remains necessary because the selected model provider executes the inference. Allternit may run fully against a self-hosted OpenAI-compatible endpoint instead:

```toml
[auth]
active_profile = "local"

[auth.profiles.local]
provider = "openai-compatible"
base_url = "http://localhost:11434/v1"
```

## Repository scans; Can scans check commits and pull requests?

The built-in security-review prompt compares the current branch with `origin/HEAD` and focuses on newly introduced issues. It is suitable for a checked-out PR or branch, but it is not a selectable committed-changes/working-tree scan API. For a specific commit or range, check it out in an isolated worktree or ask a read-only agent to review an explicit `git diff <base>...<head>`.

## Can an interrupted bulk scan resume? How does bulk repository scanning work?

**Not applicable / roadmap:** there is no bulk security scanner, checkpoint file, or resume token. External CI can invoke one isolated gizzi-code job per repository and persist its outputs, but orchestration, concurrency, retry, and resume belong to that automation. Do not share one mutable checkout between jobs.

## Can another application run scans directly?

There is no security-specific API. Applications can compose the generic platform primitives: create a managed session with `POST /api/v1/beta/sessions`, append/consume events, or attach tools through MCP. This can host a custom scanner agent, but the caller must define target selection, findings schema, storage, cancellation, and validation.

## Automation and cost; How do scan cost limits work?

Generic session budgets cap tokens, turns, and tool calls; gateway keys also support monthly token/cost policy. These limits stop agent work, not a security-specific notion of scan depth or repository coverage.

```bash
curl -X POST http://localhost:8013/api/v1/beta/sessions \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"security-review-acme",
    "budget":{"max_tokens":20000,"max_turns":30,"max_tool_calls":80},
    "metadata":{"repository":"acme/api","purpose":"security-review"}
  }'
```

When an appended usage delta exceeds a limit, the platform records `budget_exceeded` and rejects that delta. This is a hard execution guard, not a forecast of scan completeness.

## Findings and coverage; What does incomplete coverage mean?

Allternit security review is best-effort semantic review of the supplied diff and readable repository context. "Incomplete coverage" is not a current machine-produced status. Teams should assume coverage is incomplete when files are omitted, generated/vendor code is excluded, context limits are reached, tools fail, or tests cannot run. Keep deterministic scanners in CI for measurable rule and language coverage.

## How can a scan use architecture and security policies?

Put durable architecture, trust boundaries, exclusions, and secure-coding rules in repository instructions such as `AGENTS.md` or `.gizzi/SECURITY.md`. Project instructions are loaded with the session; the security-review workflow also researches existing security patterns. Allternit does not yet have a typed security knowledge-base option.

## How can a team confirm that a fix worked?

Review the diff, run relevant project tests, rerun the security review against the updated branch, and optionally verify the patch:

```bash
git diff > /tmp/security-fix.patch
gizzi verification verify --mode both \
  --description "Confirm the reported authorization bypass is fixed" \
  --patch /tmp/security-fix.patch \
  --test-file tests/authz.test.ts
```

Verification is evidence, not proof that every exploit path is closed.

## How do scans distinguish new and known findings? Match and compare findings

The review prompt targets issues newly introduced by the branch diff. There is no stable finding ID, baseline, fingerprint matcher, or "known finding" state. Store normalized findings in an external tracker if deduplication is required. A first-class baseline/SARIF comparison layer is roadmap work.

## How does false-positive feedback work?

Security findings do not yet have feedback records. For general verification results, a reviewer can record ground truth:

```bash
gizzi verification confirm <verification-id> --correct=false --by security-team
gizzi verification stats --output json
```

This calibrates verification history only; it does not retrain or suppress a security finding in later reviews.

## Where can teams find earlier scan results? What if the CLI can't save scan history?

There is no security scan store. Save the Markdown output in CI artifacts or a team-owned findings system. `gizzi verification history` and `gizzi verification show <id>` expose only verification records. If its local store is unavailable, emit `--output json` and let CI capture stdout; the security-review result likewise needs external persistence.

## Why can repeat scans return different findings?

Agent output is nondeterministic and can vary with model/provider versions, repository state, instructions, context selection, and tool availability. Pin the provider/model, base and head commits, instructions, and execution policy for more reproducible reviews. Do not interpret a missing finding on a later run as proof of remediation.

