# Codex surfaces, marketplace, and deployment parity

This page maps Codex Micro, IDE extension, cloud, GitHub Action, Windows deployment, sandbox, plugin controls, Prisma AIRS, agent import, and workspace roles to Allternit.

## Codex Micro

Codex Micro is a dedicated hardware controller. Allternit does not ship a custom hardware surface; it is CLI-first and can be driven from any terminal, SSH session, or CI runner. Hardware-specific setup (Bluetooth pairing, dial layers, lighting) is **not applicable** to the Allternit self-host model.

## Codex IDE extension

Allternit does not provide a native IDE extension. Equivalent functionality is available through:

- **MCP servers** that expose editor context to `gizzi`.
- **`gizzi exec` invoked from the IDE's task runner or terminal**.
- **Skills** that understand your repo and editor conventions.

For example, you can configure your editor to run `gizzi exec --no-interactive "explain the current file"` on a keybinding.

## Codex cloud

Codex cloud runs tasks in parallel hosted sandboxes. Allternit's equivalent is the combination of:

- **Cloud environments** (`docs/public/cli/cloud-environments.md`) for managed compute.
- **`/api/v1/beta/deployments` and `/api/v1/beta/work`** for parallel, scheduled, and remote task execution.
- **BYOC/self-host** deployments on your own infrastructure.

## Codex GitHub Action

Use `gizzi exec` in a GitHub Actions workflow:

```yaml
name: Allternit review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Allternit review
        env:
          ALLTERNIT_API_KEY: ${{ secrets.ALLTERNIT_API_KEY }}
        run: |
          gizzi exec --no-interactive \
            "review the PR diff and post a summary as a step output" > review.md
      - name: Capture output
        run: cat review.md >> $GITHUB_STEP_SUMMARY
```

Privilege management is done through GitHub secrets and scoped service accounts; the security checklist is your existing secret-scanning and RBAC policy.

## Deploy the Windows app

Allternit's CLI is distributed as a cross-platform binary. Windows deployment options:

- Package `gizzi.exe` with your enterprise software-distribution tool.
- Install via a private package registry or container image.
- Update through your existing patch-management process.

There is no Microsoft Store distribution; managed updates are handled by your infrastructure team.

## Windows sandbox

Allternit uses configurable sandbox modes rather than a Windows-specific sandbox:

```toml
[sandbox]
mode = "workspace-write"
allow_network = false
```

To grant read access to additional paths, add them to `writable_roots` or use a granular approval policy. The Windows version matrix is replaced by the supported platform list in the release notes.

## Plugin controls

Allternit controls capabilities through:

- **RBAC roles and groups** (`/api/v1/admin/rbac_roles`) for workspace-level access.
- **Connector/MCP allowlists** via `~/.allternit/mcp-servers.json` and admin MCP tunnel policies.
- **Permission profiles** that gate tool categories per user or project.

Data flow and security are documented in the [security model](../security/security-model.md).

## Prisma AIRS

Prisma AIRS is a third-party AI security scanner. Connect it to Allternit as an MCP server or inference hook:

```toml
[inference_hooks.post]
url = "https://airs.prisma.io/api/v1/scan"
headers = { "Authorization" = "Bearer ${PRISMA_AIRS_TOKEN}" }
```

Choose how prompts are handled by setting the hook to mutate, log, or abort. Manage the connection through the admin hooks API or `gizzi admin inference-hooks`.

## Import from another agent

Allternit agents are defined through the `/api/v1/agents` CRUD API or a `SKILL.md` + config file. To import from another platform:

1. Export the agent definition (system prompt, tools, model).
2. Map tools to Allternit Tool Belt tools or MCP servers.
3. Create the agent via the API or store it as a skill in `~/.allternit/skills/`.

After importing, run the agent in a sandboxed session and review tool approvals.

## Roles and workspace permissions

Allternit implements roles and workspace permissions through the admin RBAC API:

- `/api/v1/admin/workspaces` — workspace CRUD and membership.
- `/api/v1/admin/rbac_roles` — role definitions.
- `/api/v1/admin/rbac_groups` — group membership.

Local runtime policy is enforced by permission profiles and the sandbox; control boundaries are documented in the [security model](../security/security-model.md).
