# What's new: ChatGPT and Codex concepts in Allternit

OpenAI's **What's new** page is a dated digest of ChatGPT and Codex product
changes. It mixes release-week headings with capabilities from the desktop app,
Codex CLI, hosted workspaces, and integrations. Allternit does not mirror those
release dates or product names. This page maps the underlying workflows to the
self-hosted Allternit platform, the `gizzi` CLI, and `@allternit/sdk`.

For Allternit's own chronology, use the [Allternit release notes](../release-notes.md).
The month-level entries are the stable equivalent of OpenAI's weekly headings.

## Release-week headings

The following source items are navigation headings, not independently portable
features. Use the corresponding Allternit release notes to find the capabilities
that shipped in each period.

| ChatGPT/Codex heading | Allternit mapping |
|---|---|
| **February 2–6, 2026** | No matching Allternit release-week record; consult the repository changelog. |
| **February 9–13, 2026** | No matching Allternit release-week record; consult the repository changelog. |
| **March 2–6, 2026** | [2026.03](../release-notes.md#202603--core-requestresponse-parity): cross-provider request and response parity. |
| **March 9–13, 2026** | [2026.03](../release-notes.md#202603--core-requestresponse-parity). |
| **March 16–20, 2026** | [2026.03](../release-notes.md#202603--core-requestresponse-parity). |
| **March 23–27, 2026** | [2026.03](../release-notes.md#202603--core-requestresponse-parity). |
| **April 6–10, 2026** | [2026.04](../release-notes.md#202604--user-surfaces-and-distribution): profiles, admin CLI, work queue, session memory, and cron. |
| **April 13–17, 2026** | [2026.04](../release-notes.md#202604--user-surfaces-and-distribution). |
| **April 20–24, 2026** | [2026.04](../release-notes.md#202604--user-surfaces-and-distribution). |
| **May 4–8, 2026** | [2026.05](../release-notes.md#202605--pdfs-citations-and-openai-compatibility): files, PDFs, citations, and batch compatibility. |
| **May 11–15, 2026** | [2026.05](../release-notes.md#202605--pdfs-citations-and-openai-compatibility). |
| **May 18–22, 2026** | [2026.05](../release-notes.md#202605--pdfs-citations-and-openai-compatibility). |
| **May 25–29, 2026** | [2026.05](../release-notes.md#202605--pdfs-citations-and-openai-compatibility). |
| **June 1–5, 2026** | [2026.06](../release-notes.md#202606--sdk-skills-webhooks-and-hooks): SDK hooks, skills, and inference hooks. |
| **June 8–12, 2026** | [2026.06](../release-notes.md#202606--sdk-skills-webhooks-and-hooks). |
| **June 15–19, 2026** | [2026.06](../release-notes.md#202606--sdk-skills-webhooks-and-hooks). |
| **July 6–10, 2026** | [2026.07](../release-notes.md#202607--managed-agents-mcp-files-and-permissions): managed MCP, session files, and permission policy. |
| **July 13–17, 2026** | [2026.07](../release-notes.md#202607--managed-agents-mcp-files-and-permissions). |
| **July 20–24, 2026** | [2026.07](../release-notes.md#202607--managed-agents-mcp-files-and-permissions). |
| **July 27–31, 2026** | [2026.07](../release-notes.md#202607--managed-agents-mcp-files-and-permissions). |

## Start, steer, branch, and resume work

ChatGPT/Codex lets a user start conversationally, steer an active run, attach
files, branch a conversation, and resume it on another host. Allternit separates
these concerns into local Gizzi sessions and durable platform sessions.

- **Start with a chat and keep it moving** and **Organize sessions and extend
  Codex CLI 0.146.0** map to `gizzi`, `/resume`, `gizzi --resume`, session search,
  and named sessions. Allternit versions its CLI independently; `0.146.0` has no
  special meaning. See [history persistence](../cli/history-persistence.md).
- **Steer active work and add files** maps to appending input to a running client,
  session-scoped files at `/beta/sessions/:id/files`, and the event stream. A
  caller can interrupt with `POST /beta/sessions/:id/interrupt` before supplying
  revised instructions.
- **Branch earlier and choose tools from the composer** maps to child sessions
  created with `parent_thread_id` and runtime tool discovery/selection. There is
  no required Allternit-branded composer widget.
- **Continue a chat on another host** maps to durable session IDs and `gizzi
  serve`; remote clients can resume the same host over HTTP or WebSocket. See
  [Codex Remote](../cli/codex-remote.md).
- **Move chats between Local and Worktree** maps partially to local transcripts
  plus Git worktrees. A transcript is tied to its project root; Allternit does
  not expose a one-click Local/Worktree migration. Resume the session from the
  target worktree or start a child session there.

Create and branch a durable session:

```bash
API=http://localhost:8013/api/v1

curl -X POST "$API/beta/sessions" \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"implement parser","budget":{"max_turns":40}}'

curl -X POST "$API/beta/sessions" \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"alternative design","parent_thread_id":"<parent-session-id>"}'
```

For **Find chats that need your attention**, `GET /beta/sessions?status=active`
and deployment run history provide the underlying data, but there is no native
attention inbox or unread/needs-response classifier. That UI is roadmap.

## Parallel work, repositories, and folders

**Control parallel Codex work with Codex Micro** describes an OpenAI-specific
parallel-agent product. Allternit has no product named Micro. Its equivalent
primitives are child sessions, separate Git worktrees, the work queue's
lease/heartbeat/ack protocol, and agent orchestration. This is partial parity:
automatic Micro-style fan-out and its dedicated controller UI are roadmap.

**Review changes across repositories** and **Work across multiple folders in one
local project** map to multiple workspace roots or one parent directory opened as
the workspace. For strong isolation, run one agent/session per repository and
coordinate them through child sessions. The Tool Belt editor intentionally
confines each instance to one `workspaceRoot`; it does not silently grant access
to arbitrary folders.

**Review and ship pull requests in the app** is partial. Gizzi can inspect diffs,
run repository tools, and use an attached GitHub/GitLab MCP server, but Allternit
does not ship a first-party hosted PR inbox or merge button. Install/configure an
MCP integration and keep merge/push behind approval policy.

```toml
[sandbox]
mode = "workspace-write"
allow_network = true

[approval_policy]
mode = "granular"

[approval_policy.granular.rules]
bash = "ask"
edit = "allow"
```

## Trusted automation, goals, and schedules

**Automate trusted workflows**, **Follow long-running goals**, and **Schedule work
with the right environment** map to managed agents, durable sessions, cron
deployments, work-queue workers, budgets, and allow/ask/deny policies. Operators
choose the sandbox image and environment instead of relying on an OpenAI-managed
environment.

```bash
curl -X POST http://localhost:8013/api/v1/beta/deployments \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"weekday dependency review",
    "agent_id":"<agent-id>",
    "cron":"0 9 * * 1-5",
    "environment":{"repository":"https://example.com/acme/app.git"}
  }'
```

Track progress through `GET /beta/deployments/:id/runs`, or stream ordered
events from `GET /beta/sessions/:id/events`. See [deployments](../api/deployments.md),
[work queue](../api/work-queue.md), and [agent lifecycle](../guides/agent-lifecycle.md).

**Take on ambitious work in ChatGPT** is a product slogan rather than a distinct
API. In Allternit, combine session budgets, files, memory, child sessions, tools,
and deployments; no special mode is required.

## Browser, desktop, and preview

**Let Codex operate the browser and review approvals** maps directly to the
[Allternit Computer Interface](../aci/index.md) plus granular approval policy.
ACI accepts a natural-language goal and uses Playwright/accessibility/vision
adapters; approval policy remains enforced by the host.

```bash
curl -X POST http://127.0.0.1:8013/api/aci/run \
  -H 'Content-Type: application/json' \
  -d '{
    "goal":"Open the staging site and verify checkout",
    "allowedSites":["staging.example.com"],
    "openLinksInBrowser":true
  }'
```

**Find useful context across your browser and open tabs** and **Work across browser
tabs with the Chrome extension** are partial. ACI can inspect and operate tabs in
its active Playwright browser session. Allternit does not ship a Chrome extension
that automatically ingests a user's unrelated personal tabs; attach or navigate
to the required pages explicitly to preserve the self-hosted trust boundary.

**Give Codex context from any Mac app with Appshots** has no named equivalent.
ACI can capture and control native macOS, Windows, and Linux applications, and
session files can carry screenshots, but a system-wide Appshots share-sheet flow
is **Not applicable / roadmap**.

**Preview and operate work in one place** maps to ACI's observe/action loop and
browser screenshots. Gizzi can run a project and inspect it through the browser,
but Allternit does not promise a Codex-style integrated preview pane in every UI.

**Use Windows apps and control Codex remotely** maps to ACI desktop control plus
`gizzi serve --tunnel` or `--mesh`. **Run Codex natively on Windows** maps to the
cross-platform Gizzi runtime and Windows-aware shell/path handling; the product
is `gizzi`, not Codex. Where a Unix-only dependency is required, use WSL.

**Talk through work with ChatGPT Voice** is partial. The API/SDK supports audio
content, but there is no first-party continuous Voice Mode UI in the audited
Allternit surfaces. A self-hosted client may add speech-to-text and text-to-speech.

## Plugins, skills, partner tools, and providers

**Package workflows as plugins** maps to Gizzi plugins, which can bundle skills,
commands, agents, hooks, and MCP servers:

```bash
gizzi plugin install ./my-plugin
gizzi plugin list
gizzi plugin enable my-plugin
```

See [Build plugins](../cli/build-plugins.md). **Turn demonstrated workflows into
reusable skills** maps to a `SKILL.md` package under `~/.allternit/skills/` and
the SDK skill registry. Allternit does not yet record an arbitrary demonstration
and synthesize the skill automatically; author and review the manifest and
entrypoint. See [skill format](../skills/skill-format.md).

**Connect partner tools with Sign in with ChatGPT** is OpenAI identity and is
**Not applicable** to a BYOC deployment. Connect partner tools with MCP and the
partner's OAuth/API credentials; authenticate Allternit users with Clerk or the
self-hosted mode. For example, configure a remote MCP server:

```json
{
  "mcpServers": {
    "partner": {
      "type": "remote",
      "url": "https://partner.example/mcp",
      "oauth": true
    }
  }
}
```

**Use Codex with Amazon Bedrock** maps to the SDK's `AllternitBedrock` provider:

```ts
import { AllternitBedrock } from '@allternit/sdk/ai-runtime';

const bedrock = new AllternitBedrock({
  region: process.env.AWS_REGION ?? 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
});
```

## Security review

**Run security scans from the terminal, CI, or TypeScript** and **Compare security
scans and manage findings** refer to Codex Security, a separate managed product.
Allternit's API gateway performs DLP and prompt-injection checks, and its audit
and analytics APIs expose operational security events. It does not currently
ship a repository vulnerability scanner, finding schema, scan comparison API,
or security workbench. Those are **roadmap**. Today, run a BYOC scanner such as
CodeQL, Semgrep, or Trivy in CI or through the `bash` tool and retain its reports
in the repository or an attached security platform.

## Sites, research, projects, and images

**Build and deploy websites with Sites** has no managed Allternit equivalent.
Allternit can edit and test website code and invoke a hosting provider through
CLI or MCP, but deployment ownership remains with the user's BYOC platform.
This is **Not applicable / roadmap** as a first-party managed hosting surface.

**Collaborate in a dedicated academic research workspace** is partial. Admin
workspaces provide organization membership and roles, while files, memory, web
tools, citations, and MCP can support research. There is no dedicated academic
workspace UI, literature-review workflow, or scholarly connector bundle; those
are roadmap. See [admin workspaces](../admin/workspaces.md).

**Keep Work conversations and Projects together on desktop** maps partly to
project-root session history and organization workspaces. Allternit has no exact
ChatGPT Work/Projects desktop container; local transcripts and platform
workspaces remain separate storage scopes by design.

**Refine generated images in your conversation** is **roadmap**. Allternit can
send image content to vision-capable models and store files, but the audited
runtime does not expose a native image-generation/editing tool with iterative
conversation state. Attach an image-generation MCP server when this workflow is
required.

## Capability summary

| Source concept | Allternit status |
|---|---|
| Sessions, branching, steering, files, remote continuation | Available or partial through Gizzi and beta session APIs |
| Trusted scheduled workflows and long-running progress | Available through deployments, work queue, events, budgets, and approvals |
| Browser/desktop operation | Available through ACI; personal-tab extension and Appshots are roadmap |
| Plugins, skills, MCP, Bedrock | Available; demonstration-to-skill synthesis is roadmap |
| Multi-repository/folder work | Available with explicit roots and isolated sessions/worktrees |
| Managed Sites, academic UI, security workbench, Codex Micro | Not applicable / roadmap |
| Native conversational image editing and Voice Mode UI | Roadmap |
| First-party PR and attention inboxes | Partial via sessions and MCP; dedicated UI is roadmap |
