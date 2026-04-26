---
description: Run a natural-language task end-to-end using the full Plan→Act→Observe→Reflect loop
argument-hint: "[task description]"
---

# /cu:automate

> See [CONNECTORS.md](../CONNECTORS.md) for available connector integrations.
> All destructive actions require explicit user approval. See policy below.

Describe a task in plain English. Allternit will plan, execute, and record it step-by-step using vision-guided browser or desktop automation.

## What This Command Does

```
┌──────────────────────────────────────────────────────────────────┐
│                        AUTOMATE                                   │
├──────────────────────────────────────────────────────────────────┤
│  PLAN     Decompose task into ordered steps                      │
│  ACT      Execute each step via browser or desktop adapter       │
│  OBSERVE  Screenshot before + after each action                  │
│  REFLECT  Verify outcome, retry on failure, adapt plan           │
├──────────────────────────────────────────────────────────────────┤
│  SUPERCHARGED (when connectors active)                           │
│  + ~~credentials vault: auto-fill login credentials             │
│  + ~~file storage: save extracted data or recordings            │
│  + ~~notifications: alert on completion or failure              │
└──────────────────────────────────────────────────────────────────┘
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--scope` | `browser` | `browser` \| `desktop` \| `hybrid` \| `auto` |
| `--max-steps` | `20` | Maximum planning loop iterations |
| `--approval` | `on-risk` | `never` \| `on-risk` \| `always` |
| `--no-gif` | off | Disable GIF recording |
| `--session` | new | Reuse an existing session ID |

## Approval Policy

All actions that mutate state require confirmation when `--approval on-risk` (default):

1. Agent describes the full plan
2. User reviews and confirms
3. Each destructive step pauses for approval
4. GIF and receipt generated on completion

## Examples

```
/cu:automate Go to github.com, find the trending repos today, and copy them to a table
/cu:automate --scope desktop Open Calculator and compute 847 × 93
/cu:automate --approval always Fill out the contact form on example.com with my saved details
/cu:automate --max-steps 5 --no-gif Check if my Stripe dashboard shows any failed payments today
```

## What's Blocked

The following are never automated without operator-level override:
- Payment submission and checkout flows
- Account deletion or password changes
- Force-push or branch deletion on git hosting
- Sending emails/messages without preview confirmation
- Any action on domains in the blocked list

## GIF Output

Every run produces a `session-{run_id}.gif` artifact showing the full automation replay at 2 FPS. The GIF is attached to the result and available via `/cu:replay`.
