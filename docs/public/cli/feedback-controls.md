# Feedback controls

By default, `gizzi-code` occasionally prompts for feedback after a session or command. You can disable these prompts entirely or lower their frequency. This page describes the available controls.

## Disable feedback surveys

To stop all feedback prompts across `gizzi-code` sessions on a machine, set the feedback survey rate to `0` in your user settings.

### User settings (`~/.config/gizzi/settings.json`)

```json
{
  "feedbackSurveyRate": 0
}
```

A value of `0` disables surveys; values between `0` and `1` rate-limit them proportionally (for example, `0.25` shows a prompt roughly once every four eligible sessions).

### Project settings (`.gizzi/settings.json`)

You can also set this per project:

```json
{
  "feedbackSurveyRate": 0
}
```

Project settings override user settings.

## Environment variable overrides

For CI runners, shared workstations, or ephemeral environments, you can disable feedback without editing a settings file by disabling telemetry:

| Variable | Effect |
|---|---|
| `DISABLE_TELEMETRY` | Disables analytics, telemetry, and feedback surveys for the current process. |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Disables all nonessential network traffic, including feedback surveys. |

### Examples

Disable feedback for a single command:

```bash
DISABLE_TELEMETRY=1 gizzi exec "review this change"
```

Disable telemetry and feedback for a container or shared runner:

```bash
export DISABLE_TELEMETRY=1
gizzi
```

## Rate-limit feedback surveys

Instead of disabling surveys completely, reduce how often they appear:

```json
{
  "feedbackSurveyRate": 0.25
}
```

## Scope of feedback controls

These settings apply to the local `gizzi-code` CLI. They control in-client survey prompts and explicit feedback submissions. They do not affect:

- Crash reports or structured logs emitted by `gizzi-code` itself (see [Observability and telemetry](./observability.md)).
- Feedback sent through the Allternit web platform or other Allternit clients.
- Optional plugin or skill-based feedback mechanisms that manage their own opt-in state.

## Related pages

- [Config and state locations](./config-locations.md)
- [Permission profiles](./permission-profiles.md)
- [`gizzi configuration`](../gizzi/configuration.md)
