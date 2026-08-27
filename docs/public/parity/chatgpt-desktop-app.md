# ChatGPT desktop app parity

ChatGPT's desktop app presents chat, files, tools, and long-running work in one native command center. Allternit provides the same work surface through its self-hosted web/desktop clients and the `gizzi` terminal client; it is not tied to an OpenAI-hosted desktop binary.

## See what the app can do

The closest Allternit capability map is:

| Desktop concept | Allternit equivalent |
| --- | --- |
| Ask questions and work with code | `gizzi` interactive sessions and the OpenAI-compatible `/v1/chat/completions` API |
| Use local files and commands | Workspace-scoped file tools, `bash`, and `code_execution` |
| See and operate apps or web pages | [Allternit Computer Interface](../aci/index.md) and `@allternit/browser-tools` |
| Continue prior work | `/resume`, `gizzi --continue`, and server-managed sessions |
| Extend the assistant | Local skills, plugins, MCP servers, and the Native Tool Belt |
| Coordinate longer work | Agent, task, Cowork, workflow, and swarm APIs |

Start in a repository:

```bash
cd /path/to/project
gizzi
```

Or make a non-interactive request:

```bash
gizzi exec "Inspect the failing tests, fix the cause, and summarize the validation"
```

## Your command center for complex work

Allternit separates the command center from the compute. A client connects to the self-hosted API, while agents use the configured model providers, tools, sandboxes, sessions, and approval policy. This BYOC design lets the same work be driven from the browser, a desktop shell, CI, or the CLI.

For example, a service can start work through the gateway:

```bash
curl -s http://127.0.0.1:8013/v1/chat/completions \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "allternit-balanced",
    "messages": [{"role":"user","content":"Plan the migration and identify risky steps."}]
  }'
```

Use project instructions and a safe default execution posture for repeatable work:

```toml
instructions = ["AGENTS.md", "docs/CODING_GUIDELINES.md"]

[sandbox]
mode = "workspace-write"
allow_network = false

[approval_policy]
mode = "ask"
```

See [advanced configuration](../cli/advanced-configuration.md), [sessions](../api/sessions.md), and the [Native Tool Belt](../tools/tool-belt.md).
