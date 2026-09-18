# Skill: workflow-recording

**Triggers:** "record", "replay", "GIF", "export", "save this workflow", "demonstrate", "show me how"

## Purpose

Manage session recording lifecycle: start/stop/export JSONL trajectories and GIF animations. Used for documentation, fine-tuning data, and audit trails.

## Recording Architecture

```
GIF Recorder (gif_recorder.py)
  ├── Frame buffer: PIL Images at 2 FPS
  ├── Max frames: 600 (5 min at 2 FPS)
  ├── Scale: 0.5× original resolution
  └── Export: Pillow quantize → imageio GIF

Action Recorder (action_recorder.py)
  ├── JSONL trajectory: one frame per action
  ├── Fields: step, action_type, target, params, before/after screenshots
  └── Compatible with: OpenAdapt replay format
```

## Frame Capture Timing

GIF frames are captured:
- At session start (initial state)
- Before each action (before_screenshot)
- After each action (after_screenshot)
- At session end (final state)

Between action pairs, the GIF holds the before frame for `action_duration_ms / (1000/fps)` frames to make the animation feel natural.

## GIF Generation

```python
from core.gif_recorder import GIFRecorder

recorder = GIFRecorder(fps=2, scale=0.5, max_frames=600)
recorder.add_frame(screenshot_bytes)          # call per observation
gif_bytes = recorder.render(annotate=True)    # renders final GIF
recorder.save("/recordings/session.gif")
```

Frame annotation (when `annotate=True`):
- Top-left: step counter `Step 3/12`
- Top-right: elapsed time `00:00:42`
- Bottom-left: action type + target (truncated to 40 chars)

## JSONL Format

Each line in the recording:
```json
{
  "step": 3,
  "run_id": "cu-abc123",
  "session_id": "sess-xyz",
  "timestamp": "2026-04-22T09:00:00Z",
  "action_type": "click",
  "action_target": "a.submit-btn",
  "action_params": { "x": 640, "y": 360 },
  "before_screenshot_b64": "...",
  "after_screenshot_b64": "...",
  "reflection": "Submit button clicked, form submitted successfully",
  "action_succeeded": true,
  "tokens_used": 1248,
  "cost_usd": 0.0187
}
```

## Replay Protocol

To replay a JSONL:
1. Load all frames, validate schema version
2. For each frame: execute action against live session
3. After each action: screenshot and compare to stored `after_screenshot_b64`
4. Deviation score > threshold → pause and report discrepancy
5. On completion: generate comparison GIF (recorded vs. replay)

## Export Formats

| Format | Description | Use case |
|--------|-------------|----------|
| `.gif` | Animated GIF, 50% scale, 2 FPS | Documentation, demos, sharing |
| `.jsonl` | Full trajectory with screenshots | Fine-tuning, replay, audit |
| `.mp4` | Video via ffmpeg (if available) | High-quality recording |
| `.zip` | JSONL + raw PNG frames + GIF | Full archive |
