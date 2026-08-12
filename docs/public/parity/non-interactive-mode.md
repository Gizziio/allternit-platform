# Non-interactive mode

Codex non-interactive mode runs an agent from a script or CI job, writes its result to standard output, and exits. The Allternit equivalent is `gizzi exec`, a pipe-safe alias of `gizzi run` that enables print mode and defaults to the non-prompting `dontAsk` permission mode.

## Basic usage

Pass a prompt as arguments or on standard input:

```bash
gizzi exec "Summarize the changes in this repository"
git diff --staged | gizzi exec "Review this diff for correctness"
```

Unlike Codex, Allternit does not require a Git repository. Repository-aware tasks benefit from Git metadata, but `gizzi exec` also works in an ordinary directory. Use `--dir`, `--worktree`, or `--file` to make the intended boundary explicit.

## Standard input patterns

When stdin is text, `gizzi exec` appends it to any prompt arguments. This covers the Codex `exec -` convention without a special `-` sentinel:

```bash
# Stdin is the whole prompt
printf '%s\n' "Explain the TLS error below" | gizzi exec

# Prompt plus stdin
journalctl -u payments.service --since -30m | \
  gizzi exec "Summarize failures, group them by root cause, and suggest next checks"

# Multiple inputs can be assembled by the shell
{ printf '%s\n' 'CI LOG:'; sed -n '1,400p' ci.log; } | \
  gizzi exec "Draft a concise pull-request comment"
```

For advanced producers, use newline-delimited input and output events:

```bash
printf '%s\n' \
  '{"role":"user","content":"Use the following deployment context."}' \
  '{"role":"user","content":"Summarize the failed checks."}' | \
  gizzi exec --input-format stream-json --output-format stream-json
```

## Machine-readable and structured output

Use `--output-format json` for JSON events or `stream-json` for events as they happen. Use `--json-schema` when a downstream program needs a validated shape; the value may be inline JSON or a file path.

```bash
gizzi exec --output-format json \
  --json-schema schemas/ci-summary.schema.json \
  "Analyze ci.log" --file ci.log > result.jsonl
```

Example schema:

```json
{
  "type": "object",
  "properties": {
    "status": {"type": "string", "enum": ["pass", "fail"]},
    "summary": {"type": "string"},
    "failed_checks": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["status", "summary", "failed_checks"],
  "additionalProperties": false
}
```

## Authentication in automation

Use a dedicated provider profile and inject its secret from the CI secret store:

```bash
printenv ANTHROPIC_API_KEY | \
  gizzi auth login --api-key --provider anthropic --profile ci
gizzi auth profile set-active ci
gizzi auth status
```

Prefer an environment reference over an inline secret:

```toml
[auth]
active_profile = "ci"
credential_store = "auto"

[auth.profiles.ci]
provider = "anthropic"
api_key_env = "ANTHROPIC_API_KEY"
```

Allternit OAuth is appropriate for an attended workstation; API-key or service-account credentials are the predictable choice for unattended jobs. See [API-key authentication](../cli/auth-api-key.md).

## Resume a run

Sessions are persisted unless `--no-session-persistence` is set. Continue the most recent session in the current directory or name a session explicitly:

```bash
gizzi exec --continue "Now turn the findings into an action list"
gizzi exec --session "$GIZZI_SESSION_ID" "Recheck after the retry"
gizzi exec --session "$GIZZI_SESSION_ID" --fork "Explore a different fix"
```

JSON output includes `sessionID`; save it from the initial invocation when a workflow must resume exactly the same run.

## Common automation recipes

### Summarize logs

```bash
gzip -cd app.log.gz | gizzi exec \
  "Summarize errors by frequency and include the first relevant timestamp"
```

### Inspect TLS or HTTP failures

```bash
curl -sv https://service.example.test/health 2>&1 | gizzi exec \
  "Diagnose this TLS/HTTP exchange. Separate certificate, DNS, proxy, and server issues."
```

Set `GIZZI_CA_CERTIFICATE=/path/to/ca.pem` when the runner must trust a private CA. See [custom CA bundles](../cli/custom-ca-bundles.md).

### Draft a pull-request comment from CI logs

```bash
gizzi exec --file ci.log \
  "Write a PR comment with a one-line status, failing checks, evidence, and next action" \
  > pr-comment.md
gh pr comment "$PR_NUMBER" --body-file pr-comment.md
```

Generating and publishing are deliberately separate. `gizzi exec` drafts the text; an authenticated CI integration such as `gh`, a webhook, or an MCP tool performs the external write.

### Prepare a Slack-ready update

```bash
git log -10 --oneline | gizzi exec \
  "Write a Slack-ready release update: headline, bullets, risks, and owner asks" \
  > update.txt
```

Posting is **not an implicit Allternit action**. Send the reviewed file with your approved Slack webhook, connector, or MCP workflow.

### Autofix CI failures in GitHub Actions

```yaml
- name: Ask Allternit to repair the failure
  if: failure()
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    gizzi exec --max-budget-usd 2 \
      --allowedTools Read Grep Edit Bash \
      --file ci.log \
      "Fix only the failures evidenced in ci.log, then summarize changed files"

- name: Upload patch for review
  if: failure()
  run: git diff --binary > allternit-fix.patch
```

Run autofix jobs in an isolated checkout with a least-privilege token. Do not use `--dangerously-skip-permissions` or `--dangerously-skip-sandbox` on an untrusted runner. Allternit does not automatically commit, push, or comment unless the workflow explicitly authorizes those actions.

## Operational controls

Bound unattended work with `--max-budget-usd`, tool allowlists, sandbox settings, and a restrictive permission profile. `--no-session-persistence` prevents a one-off job from writing a resumable transcript. For long-running background tasks, `--print-background-mode drain` waits for children; `steer` permits bounded completion-driven parent turns, with `--print-wait-ceiling` and `--print-max-turns` as limits.

## See also

- [Gizzi headless execution](../gizzi/index.md#headless-execution)
- [History persistence](../cli/history-persistence.md)
- [Agent approvals and security](../cli/agent-approvals-security.md)
- [JSON mode](../api/kimi-json-mode.md)

