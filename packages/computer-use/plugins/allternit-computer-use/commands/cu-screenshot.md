---
description: Capture the current screen state and return a screenshot with metadata
argument-hint: "[optional: session_id]"
---

# /cu:screenshot

Take an instant screenshot of the current browser session or desktop and return it with page metadata.

## Usage

```
/cu:screenshot
/cu:screenshot --session sess-abc123
/cu:screenshot --annotate
/cu:screenshot --scope desktop
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--session` | current | Session ID to screenshot |
| `--scope` | `browser` | `browser` \| `desktop` |
| `--annotate` | false | Overlay timestamp and step number |
| `--full-page` | false | Capture full scrollable page (browser only) |

## Output

Returns:
- `screenshot` — base64-encoded PNG
- `url` — current page URL (browser scope)
- `title` — page title (browser scope)
- `width`, `height` — viewport dimensions
- `timestamp` — ISO 8601 capture time

## Use Cases

- Observe current state before starting a task
- Verify the result of a previous action
- Debug why an automation step failed
- Manually checkpoint a multi-step workflow

## Examples

```
/cu:screenshot                              -- see what the browser shows right now
/cu:screenshot --scope desktop              -- see the full desktop
/cu:screenshot --full-page --session s-123  -- full-page capture of long page
/cu:screenshot --annotate                   -- with step/time overlay for documentation
```
