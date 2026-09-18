# Skill: error-recovery

**Triggers:** Automatic on any action failure, unexpected page state, screenshot unchanged after action, error messages detected

## Purpose

Detect, classify, and recover from automation failures without user intervention when safe to do so. Escalate to the recovery-agent subagent for complex failures.

## Error Classification

| Class | Examples | Auto-recover? |
|-------|----------|---------------|
| **Transient** | Network timeout, element not yet visible, page still loading | Yes — retry with backoff |
| **Structural** | Element moved, page redesigned, selector invalid | Yes — re-discover via a11y/vision |
| **State** | Already submitted, already logged in, item no longer exists | Yes — detect and skip |
| **Auth** | Session expired, login required | Partial — surface to user for credentials |
| **Policy** | CAPTCHA, bot detection, rate limit | No — pause and notify user |
| **Fatal** | Gateway crash, session dead, adapter unavailable | No — report and abort |

## Recovery Protocols

### Protocol 1: Retry with Backoff
```
attempt 1: immediate retry
attempt 2: 1s delay
attempt 3: 3s delay + re-screenshot
attempt 4: escalate to recovery-agent
```

### Protocol 2: Element Re-Discovery
When selector/coordinate no longer valid:
1. Re-read accessibility tree
2. Search for element by semantic description (not exact selector)
3. If found with new selector/coordinates: update and retry
4. If not found: visual grounding fallback

### Protocol 3: State Detection
Before retrying, check if action already succeeded:
- "Click Submit" failed but page shows success state → mark as succeeded, don't retry
- "Fill field" failed but field already has correct value → skip

### Protocol 4: Page Recovery
When page is in unexpected state:
1. Read current URL and title
2. Compare to expected URL in plan
3. If redirected: check if redirect is expected (auth redirect, success page)
4. If unexpected: go back and retry from last known good state

## Stall Detection

If last 3 consecutive actions were `screenshot` type with confidence=0.0:
- Log: "Vision provider stalled — 3 consecutive screenshot-only responses"
- Stop planning loop with `StopReason.ERROR`
- Report: what the last screenshot showed, what the task was, last attempted action

## Escalation to Recovery Agent

Escalate when:
- 3+ retries of the same action fail
- Page state is unrecognized (not matching any expected state)
- Multiple error classes detected simultaneously

Pass to recovery-agent:
- Last 3 screenshots (before/after pairs)
- Task description and current step
- Error messages from page (if any)
- Full action history

## Post-Recovery Reporting

After recovery:
```
⚠️ Recovered from [error_class] error at step [N]:
   Error: [description]
   Action taken: [recovery action]
   Status: [recovered / partially recovered / escalated]
   Resumed at: step [N] / step [N+1]
```
