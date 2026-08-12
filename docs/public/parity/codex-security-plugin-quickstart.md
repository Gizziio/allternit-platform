# Codex Security plugin quickstart parity

The Codex Security plugin packages security scanning into a Codex workflow. Allternit's equivalent extension mechanism is a gizzi-code plugin, and the repository contains a `security-review` command that has moved to a plugin-backed workflow.

## Install the plugin

Install from an organization-approved marketplace repository:

```bash
gizzi plugin install security-review --repo <approved-marketplace-url>
gizzi plugin list
gizzi plugin enable security-review
```

Then open gizzi-code in a Git worktree and invoke:

```text
/security-review
```

The marketplace URL is deployment-specific and is not published in this repository. If your distribution cannot resolve the plugin, this capability is unavailable until an administrator adds the approved marketplace or installs a local plugin. See [Build plugins](../cli/build-plugins.md) for local plugin structure and installation.

## What the scan creates

The workflow creates a Markdown security review in the conversation. Each retained finding is expected to include file and line, severity, category, description, exploit scenario, remediation, and confidence. It does not automatically create a durable scan record, threat model, SARIF file, patch, PR comment, or branch modification.

Capture the report and reviewed commit range in your own CI artifacts or findings system when durability is required.

## Choose your next workflow

- Ask a separate coding session to implement an accepted recommendation; the review itself is read-only.
- Validate the resulting patch with project tests and `gizzi verification verify --mode both`.
- Rerun `/security-review` on the updated immutable branch range.
- Keep SAST, dependency, secret, and manual review gates in place.
- Build a team plugin with approved policies, output schema, and hooks when you need a standardized workflow; a first-class Allternit security scanner remains roadmap work.

