# Metrics and telemetry

By default, `gizzi-code` periodically sends a small amount of anonymous usage and health data back to Allternit. This helps the team detect when `gizzi` is not working correctly, understand which features and configuration options are being used, and focus development on what matters most. These metrics do not contain personally identifiable information (PII), source code, prompts, or model outputs.

> Metrics collection is independent of OpenTelemetry log and trace export. To learn more about observability and how Allternit handles telemetry data, see [Observability and telemetry](./observability.md).

## Disable metrics collection

You can disable anonymous metrics collection across the `gizzi-code` CLI by disabling telemetry:

### With an environment variable

For CI runners, containers, or shared machines, set one of the supported environment variables before invoking `gizzi`:

```bash
export DISABLE_TELEMETRY=1
gizzi exec "review this change"
```

Or:

```bash
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
gizzi exec "run the tests"
```

Environment variables are evaluated before config files are loaded, so they are useful for one-off invocations or managed environments.

### With settings.json

You can also disable the session-quality feedback survey without disabling all telemetry by setting the survey rate to `0`:

```json
{
  "feedbackSurveyRate": 0
}
```

## What is collected

`gizzi-code` emits metrics in a few broad categories. The data is aggregated and sent in batches over TLS.

### Runtime and transport health

- API request counts, HTTP status, and success or failure rates
- Request and SSE/WebSocket event durations
- Time-to-first-token and inference timing
- Remote model list fetch latency and cache load times
- Startup duration and outcome

### Turn and tool activity

- End-to-end turn duration and time-to-first-token
- Tool call counts and durations by tool name
- Tool approval outcomes
- MCP tool invocation results
- Hook execution counts and durations

The `tool` field records the internal tool name (for example, `bash`, `edit`, or `webfetch`). It does not include the actual shell command, file contents, or patch being applied.

### Threads, tasks, and features

- Thread starts, forks, renames, and side conversations
- Conversation turn counts
- Number of enabled or kept skills
- Task compactions, reviews, undo actions, and user shell actions
- Non-default feature flags and configuration values

### Memory and local state

When memory features are enabled, `gizzi` may emit metrics about memory phase jobs and local state operations. No user-facing memory contents are included.

## Default context fields

Metric events may include the following context fields:

- `auth_mode`: `oauth` | `api_key` | `unknown`
- `model`: the provider/model identifier used for the operation
- `app.version`: the `gizzi-code` version in use

These fields let Allternit correlate reliability trends with specific releases, authentication methods, and model providers without identifying individual users.

## Disabling other feedback channels

Anonymous metrics are distinct from in-app feedback submissions. To disable the `/feedback` command across `gizzi-code` clients on a machine, set the feedback survey rate to `0`:

```json
{
  "feedbackSurveyRate": 0
}
```

When disabled, `gizzi` will not present feedback prompts.

## Related pages

- [Feedback controls](./feedback-controls.md)
- [Observability and telemetry](./observability.md)
- [Config and state locations](./config-locations.md)
