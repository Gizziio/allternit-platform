# summit.desktop.cowork_portal_runner

## Purpose
Operate the teacher's legacy portal via visual grounding.

## PLAN
1) Screenshot current state: `desktop_screenshot(session_id)`
2) Identify element coordinates (x, y) for the target action.
3) Emit Script:
```json
{
  "steps": [
    { "action": "click", "x": 100, "y": 200 },
    { "action": "type", "text": "Summit2026" }
  ]
}
```

## EXECUTE
1) Perform clicks and typing.
2) Take verification screenshot.
