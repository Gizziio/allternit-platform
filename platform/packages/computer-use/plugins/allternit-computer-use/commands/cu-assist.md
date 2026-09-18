---
description: Co-pilot mode — read the current screen and suggest or take the next action
argument-hint: "[what you're trying to do]"
---

# /cu:assist

Co-pilot mode. Allternit reads the current screen state, understands what you're trying to do, and either proposes or executes the next action — your choice.

Unlike `/cu:automate` (which runs a full planning loop autonomously), `assist` is human-in-the-loop: it proposes one action at a time, waits for confirmation, and proceeds.

## Usage

```
/cu:assist I want to fill in this form with my details
/cu:assist --auto What's the next step to complete this checkout?
/cu:assist --scope desktop How do I navigate to the Downloads folder in Finder?
```

## Behavior

1. Takes a screenshot of the current state
2. Reads the accessibility tree
3. Understands your intent
4. **Proposes** the next action with explanation
5. If `--auto`: executes immediately
6. Otherwise: waits for you to say "go ahead" or redirect

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--auto` | off | Execute suggestion automatically |
| `--scope` | `browser` | `browser` \| `desktop` |
| `--session` | current | Session to act on |

## Examples

```
/cu:assist I'm trying to log in but don't know which button to click
/cu:assist --auto Scroll down and find the pricing table
/cu:assist --scope desktop --auto Close all windows except Terminal
/cu:assist What is on the current screen?
/cu:assist --auto Click the "Submit" button on this form
```

## Response Format

```
Current screen: [page title] at [url]

I can see: [brief description of relevant UI elements]

Suggested action: [action type] on [target] — [reason]

Ready to execute? Say "go" or redirect me.
```

When `--auto` is set, the action executes immediately after the proposal with a 1-second grace period for cancellation.
