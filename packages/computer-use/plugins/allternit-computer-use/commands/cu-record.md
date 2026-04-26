---
description: Start or stop a workflow recording — captures all actions and screenshots as a replayable JSONL + GIF
argument-hint: "start|stop [name]"
---

# /cu:record

Record a browser or desktop automation session. Produces a JSONL trajectory file and an optional GIF replay.

## Usage

```
/cu:record start "checkout flow"
/cu:record stop --id rec-abc123
/cu:record start --scope desktop "file organization workflow"
/cu:record start --gif-only "quick demo"
```

## How Recording Works

When recording is active:
1. Every action is captured: action type, target, parameters, timestamps
2. Screenshots are taken before and after each action
3. GIF frames are buffered at 2 FPS
4. On stop: JSONL file written, GIF rendered, receipt generated

The JSONL format is compatible with OpenAdapt and can be used for:
- Replay via `/cu:replay`
- Fine-tuning vision models
- Audit trail and receipts
- Documentation and demos

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--scope` | `browser` | `browser` \| `desktop` \| `hybrid` |
| `--gif-fps` | `2` | GIF frame rate (1–10 FPS) |
| `--no-gif` | off | Capture JSONL only, no GIF |
| `--gif-only` | off | GIF frames only, no JSONL |
| `--annotate` | false | Overlay step counter on GIF frames |
| `--id` | — | Recording ID to stop (required for `stop`) |

## Output (on stop)

```json
{
  "recording_id": "rec-abc123",
  "name": "checkout flow",
  "frames": 142,
  "duration_ms": 71000,
  "jsonl_path": "/recordings/rec-abc123.jsonl",
  "gif_path": "/recordings/rec-abc123.gif",
  "gif_size_kb": 1840,
  "actions": 18
}
```

## Examples

```
/cu:record start "login and dashboard check"
-- [perform actions manually or via other commands] --
/cu:record stop --id rec-abc123

/cu:record start --gif-fps 4 --annotate "demo for docs"
/cu:record start --no-gif "audit trail for compliance run"
```
