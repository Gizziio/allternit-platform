---
description: Replay a recorded workflow or export it as a GIF animation
argument-hint: "[recording_id]"
---

# /cu:replay

Replay a previously recorded workflow, or export any recording as a GIF without re-executing it.

## Usage

```
/cu:replay rec-abc123
/cu:replay rec-abc123 --export-gif
/cu:replay rec-abc123 --speed 2.0
/cu:replay rec-abc123 --dry-run
```

## Modes

| Mode | Description |
|------|-------------|
| **Live replay** | Re-executes every action in the recording against a live session |
| `--export-gif` | Renders the stored screenshots into a GIF without re-running |
| `--dry-run` | Shows the action plan without executing anything |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--speed` | `1.0` | Replay speed multiplier (2.0 = 2× faster) |
| `--export-gif` | off | Render GIF from stored frames instead of re-running |
| `--gif-fps` | `2` | Frame rate for exported GIF |
| `--dry-run` | off | Preview the action plan without executing |
| `--session` | new | Session to replay into (new session by default) |
| `--approval` | `on-risk` | Approval policy for re-execution |

## GIF Export

The `--export-gif` flag takes stored screenshot frames from the JSONL recording and renders them into an animated GIF without running any live browser or desktop actions. This is safe and fast — useful for generating documentation or sharing demos.

GIF properties:
- Resolution: 50% of original capture resolution
- Frame rate: configurable (default 2 FPS)
- Palette: 256-color optimized via Pillow quantization
- Format: GIF87a (universal compatibility)

## Examples

```
/cu:replay rec-abc123                       -- re-run the recorded workflow live
/cu:replay rec-abc123 --export-gif          -- just render the GIF, no live execution
/cu:replay rec-abc123 --speed 3.0 --dry-run -- preview at 3× speed without running
/cu:replay rec-abc123 --approval always     -- re-run with confirmation at every step
```

## Output

```json
{
  "recording_id": "rec-abc123",
  "mode": "export-gif",
  "gif_path": "/recordings/rec-abc123-replay.gif",
  "gif_size_kb": 2100,
  "frames": 142,
  "duration_ms": 71000
}
```
