# Hide or surface reasoning events

Reasoning models in Allternit expose an internal "thinking" stream alongside the final response. In `gizzi-code`, you can control whether reasoning is requested from the model and how much of it is shown in the interface.

## Available controls

| Setting | Scope | Description |
| --- | --- | --- |
| `alwaysThinkingEnabled` | User/project settings (`settings.json`) | Whether to request thinking/reasoning output from compatible models. |
| `showThinkingSummaries` | User/project settings (`settings.json`) | Whether to render a summarized view of reasoning in the transcript view. |
| `effortLevel` | User/project settings (`settings.json`) | How much reasoning effort to request (`low`, `medium`, `high`). |
| `display_thinking` | `gizzi config.toml` keybinding | TUI keybinding to toggle thinking block visibility interactively. |

## Enable or disable reasoning globally

Set `alwaysThinkingEnabled` in your user settings to turn reasoning on or off by default.

### User settings (`~/.config/gizzi/settings.json`)

```json
{
  "alwaysThinkingEnabled": true
}
```

With this enabled, `gizzi-code` asks supported models to produce reasoning content. The visibility of that content is controlled separately by `showThinkingSummaries` and the `display_thinking` keybinding.

Disable it when you want final answers only:

```json
{
  "alwaysThinkingEnabled": false
}
```

### Project settings (`.gizzi/settings.json`)

```json
{
  "alwaysThinkingEnabled": true
}
```

Project settings override user settings.

## Show summaries vs. hide reasoning

Reasoning output can be verbose. Use `showThinkingSummaries` to display a condensed version in the transcript view.

```json
{
  "alwaysThinkingEnabled": true,
  "showThinkingSummaries": true
}
```

- `showThinkingSummaries: true` — renders a short summary of reasoning in the transcript view (`ctrl+o`).
- `showThinkingSummaries: false` — reasoning content is still requested but not surfaced as a summary in the transcript view.

To toggle thinking block visibility interactively in the TUI, use the `display_thinking` keybinding (configurable in `~/.gizzi/config.toml` under `keybinds.display_thinking`).

## Adjust reasoning effort

`effortLevel` controls how deeply a reasoning model should think before responding. Higher effort can improve quality on complex tasks but uses more tokens and latency.

```json
{
  "effortLevel": "medium"
}
```

Allowed values:

- `"low"` — faster, cheaper responses; best for simple or well-defined tasks.
- `"medium"` — balanced reasoning depth (default).
- `"high"` — deeper analysis for complex planning, debugging, or multi-step problems.

Some providers map these values to provider-specific effort levels internally. If a model does not support configurable effort, this setting is ignored.

## Common patterns

### Clean output for CI

```json
{
  "alwaysThinkingEnabled": false,
  "showThinkingSummaries": false
}
```

### Deep interactive debugging

```json
{
  "alwaysThinkingEnabled": true,
  "showThinkingSummaries": false,
  "effortLevel": "high"
}
```

## Scope

These settings apply to the local `gizzi-code` CLI. API callers can also pass `reasoning_effort` and related provider options through the platform chat completions API.

## Related pages

- [Config and state locations](./config-locations.md)
- [`gizzi configuration`](../gizzi/configuration.md)
