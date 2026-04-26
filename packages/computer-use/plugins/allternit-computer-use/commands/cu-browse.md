---
description: Navigate to a URL and optionally perform a task on that page
argument-hint: "[url] [optional: task description]"
---

# /cu:browse

Navigate to a URL in the active browser session. Optionally pass a task to perform on arrival.

## Usage

```
/cu:browse https://example.com
/cu:browse https://news.ycombinator.com Show me the top 5 stories
/cu:browse https://app.example.com/dashboard --session sess-abc123
```

## Behavior

1. Opens (or reuses) a Playwright browser session
2. Navigates to the given URL and waits for `domcontentloaded`
3. Takes an initial screenshot
4. If a task is provided, runs it using the `assist` skill (single-step, no full planning loop)
5. Returns: current URL, page title, screenshot, and any task result

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--wait` | `domcontentloaded` | `load` \| `domcontentloaded` \| `networkidle` |
| `--session` | new | Reuse existing session |
| `--screenshot` | true | Include screenshot in response |

## Output

```json
{
  "url": "https://example.com/",
  "title": "Example Domain",
  "screenshot": "<base64-png>",
  "task_result": "..."
}
```

## Examples

```
/cu:browse https://stripe.com/dashboard
/cu:browse https://github.com/trending --wait networkidle
/cu:browse https://docs.anthropic.com What are the rate limits for Claude Sonnet?
```
