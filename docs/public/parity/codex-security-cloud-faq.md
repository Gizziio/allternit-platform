# Codex Security cloud FAQ parity

Codex Security cloud is a managed service that builds a repository threat model, searches for vulnerabilities, validates findings, and proposes patches. Allternit currently provides a self-hosted/BYOC agent runtime and a high-confidence security-review workflow, not an equivalent managed scanner. This page separates usable Allternit building blocks from roadmap items.

## What is Codex Security? What business problem does it solve? Why does it matter?

The original product turns repository context into prioritized, actionable security findings and suggested fixes. Allternit's closest capability is the `security-review` gizzi-code plugin command: it reviews a branch diff for concrete high- or medium-severity vulnerabilities, requires a clear exploit path, and suppresses speculative findings. This helps teams review security-sensitive changes, but it is not a continuous cloud scanner and has no security SLA or managed dashboard.

```text
/security-review
```

**Not applicable / roadmap:** a hosted Allternit Security product with repository onboarding, scheduled scans, centralized findings, and patch generation is not implemented.

## How does Codex Security work? What is the analysis pipeline?

Codex Security describes a managed pipeline from repository ingestion through threat modeling, vulnerability analysis, validation, and patch proposal. Allternit's present workflow is agent-driven:

1. `security-review` gathers `git status`, the branch commit list, and the diff from `origin/HEAD`.
2. An agent researches the repository's security model and established patterns.
3. It traces changed input and privilege boundaries and filters findings below its confidence threshold.
4. A human reviews the Markdown report.
5. A separately requested coding run can implement a fix.
6. `gizzi verification verify` can reason about or empirically test a supplied patch.

These stages are composable, but there is no single durable security-scan job object joining them today.

## What is a threat model? How is a threat model generated?

A threat model describes assets, trust boundaries, entry points, attacker capabilities, and plausible abuse paths. Codex Security generates one from repository structure and code. Allternit's review prompt researches security frameworks and the repository security model as context, but does not emit or persist a structured threat-model artifact.

**Not applicable / roadmap:** use a project instruction such as `.gizzi/SECURITY.md` or `AGENTS.md` to provide a hand-authored model. Structured generation, editing, versioning, and reuse are roadmap work.

## Can I edit the threat model?

There is no generated Allternit threat-model object to edit. Teams can edit their repository instructions and security policy documents directly; gizzi-code loads project instructions as agent context.

```markdown
# Security context

- Public entry points: `/api/v1/*`
- Trust boundary: API gateway to provider adapters
- Sensitive assets: provider keys and session resources
- Required control: every tenant-owned record is scoped by user or organization
```

## Do I need to configure a scan before using threat modeling?

No Allternit scan configuration or threat-model command exists. Repository exploration can be requested in an ordinary gizzi-code session without a prior scan. Persist important context in project instructions so later reviews use the same assumptions.

## Does Codex Security auto-apply patches? Does the patch directly modify my PR branch?

The Allternit security-review workflow is read-only: its allowed tools inspect Git and files, and its required output is a report. It neither creates nor applies a patch. A separate agent run may edit the current worktree only when the user authorizes that work and the configured sandbox/approval policy permits writes. It does not implicitly push or update a remote PR branch.

## What does the proposed patch contain?

**Not applicable / roadmap:** Allternit security review currently gives a fix recommendation, not a standardized proposed-patch artifact. If a user asks an agent to implement the recommendation, the ordinary worktree diff is the proposed change and should be reviewed with `git diff` before any commit.

## Does it replace SAST? Does it replace manual security review?

No. The agent review is semantic and change-focused; it does not provide deterministic rule coverage, dependency/CVE inventory, or a supported language analyzer matrix. Keep SAST, dependency scanning, secret scanning, tests, and expert review in CI. Agent review is an additional signal, not a compliance control or approval authority.

## Does the project need to be built for scanning?

The read-only `security-review` workflow analyzes source and diffs without building. Empirical validation may require project tests or a build, but that is a separate, explicit operation. In Allternit's sandbox, network and write access depend on project policy.

## What is auto-validation? Validation

Codex Security auto-validation attempts to confirm exploitability and patch correctness. Allternit's closest independent primitive is:

```bash
gizzi verification verify --mode adaptive \
  --description "Validate authorization fix" \
  --patch /tmp/fix.patch \
  --output json
```

Modes are `semi-formal`, `empirical`, `both`, and `adaptive`; empirical mode accepts repeatable `--test-file` options. The command emits a reasoning certificate when available and exits nonzero when verification or the requested confidence threshold fails. It verifies code changes generally; it does not reproduce a vulnerability automatically.

## What happens if validation fails?

`gizzi verification verify` prints the reason and next action, stores the result in verification history, and sets exit code `1`. It does not apply or revert code. Treat failure as a review gate: inspect the counterexample or test output, revise the patch, then rerun verification.

## How does Codex Security reduce false positives and avoid broken patches?

The Allternit security-review prompt only reports concrete high/medium issues, requires a plausible attack path, excludes common noise classes, and applies a confidence filter. Broken-patch risk is handled separately through human diff review, project tests, and `gizzi verification`. There is no guarantee equivalent to managed auto-validation.

## What languages are supported?

The workflow uses repository-reading tools and an LLM rather than language-specific security analyzers, so it can reason over any text source the selected model understands. That is not a formal support matrix. Parser-backed shell safety exists inside gizzi-code, but it is a runtime protection and not repository vulnerability coverage.

## What outputs do I get after the scan completes?

The current review returns Markdown findings with file, line, severity, category, description, exploit scenario, recommendation, and confidence. `gizzi verification` separately produces text or JSON results and may persist a certificate. There is no unified SARIF, threat-model, finding database, or patch bundle.

## How is customer code isolated?

Allternit is self-hosted/BYOC: users choose where the API, storage, models, and worktrees run. gizzi-code supports `read-only`, `workspace-write`, and `danger-full-access` sandbox modes, approval policies, network controls, and provider profiles. Isolation is therefore deployment- and policy-dependent rather than a claim about an Allternit-operated scanning cloud.

```toml
[sandbox]
mode = "read-only"
allow_network = false

[approval_policy]
mode = "on-request"
```

## How long do initial scans take, and what happens after that?

**Not applicable / roadmap:** Allternit has no initial-versus-incremental security scan lifecycle or duration commitment. Agent review time varies with diff size, repository context, model, and provider. Repeat reviews are new runs unless the team preserves context in instructions or a managed session.

