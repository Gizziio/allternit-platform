# Observability and telemetry

`gizzi-code` supports two observability mechanisms:

1. **OpenTelemetry spans** for AI SDK calls, enabled via the `experimental.openTelemetry` config flag.
2. **Anonymous product analytics** sent to Allternit to help detect issues and prioritize features.

Both are disabled by default or can be disabled with environment variables.

## OpenTelemetry spans for AI SDK calls

When enabled, `gizzi-code` attaches the AI SDK's `experimental_telemetry` flag to provider calls. This emits OpenTelemetry spans for model requests through whatever OTel collector is configured in your environment (for example, via standard `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_RESOURCE_ATTRIBUTES` environment variables).

### Enable in config

Add to your user config (`~/.config/gizzi-code/config.toml`):

```toml
[experimental]
openTelemetry = true
```

### Enable with an environment variable

You can also enable telemetry by setting the standard OpenTelemetry environment variables and the Allternit flag:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.example.com
export OTEL_SERVICE_NAME=gizzi-code
export GIZZI_EXPERIMENTAL_OPEN_TELEMETRY=true
gizzi
```

The exact spans and attributes depend on the AI SDK provider in use and your OTel collector configuration.

## Product analytics

Separately from OTel export, `gizzi-code` may periodically send a small amount of anonymous usage and health data to Allternit. These metrics do **not** contain personally identifiable information (PII) and are independent of OTel log/trace export.

To disable product analytics across `gizzi-code` on a machine, set:

```bash
export DISABLE_TELEMETRY=1
```

Or:

```bash
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

## Privacy considerations

- **Opt-in.** OTel span export is disabled by default.
- **Prompt content.** The AI SDK telemetry flag does not automatically include raw prompt text; what is captured depends on your OTel collector and provider configuration.
- **Tool arguments.** Analytics events describe the tool name and outcome; they do **not** include the full shell command or patch contents unless your collector captures additional application logs.
- **Project config.** Telemetry settings should be set in your user-level config. Project-local config files should not override them without review.

## Related pages

- [Metrics](./metrics.md)
- [Feedback controls](./feedback-controls.md)
