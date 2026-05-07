# Cookbook: Page Automation

## Goal
Execute a repetitive or multi-step task on the current page with full user approval
at each destructive step and a receipt artifact at the end.

## Preconditions
- An active browser tab where the task is to be performed
- User has described the task in plain language
- User has approved the planned steps before execution begins

## Family
browser

## Mode
automate

## Policy
- Plugin policy profile: `chrome` (max_destructive_actions: 2, requires_approval: true)
- Any click that submits data, sends a message, or mutates server state = destructive
- Navigation-only actions (scrolling, tab switching) = non-destructive, no approval needed
- Blocked: payment submission, account deletion, social posting without preview

## Steps

1. **Parse the task**
   - Identify: target element(s), action type, repetition pattern, stop condition
   - Example: "Mark done on each item in the checklist" →
     target: `.checklist-item button[aria-label='Mark done']`, action: click, repeat: all, stop: none remaining

2. **Plan the steps**
   - Write out every planned action in plain English, numbered
   - Classify each step: non-destructive / destructive
   - Estimate step count

3. **Present the plan for approval**
   ```
   I'll do the following 4 steps:
   1. Scroll to the checklist section [non-destructive]
   2. Click "Mark done" on item 1 [destructive]
   3. Click "Mark done" on item 2 [destructive]
   4. Click "Mark done" on item 3 [destructive]

   Proceed?
   ```
   - Wait for explicit confirmation before continuing

4. **Execute step by step**
   - Run each step and report: "Step 2 ✓ — clicked Mark done on 'Update dependencies'"
   - On error: pause, report the failure, ask how to proceed (skip / retry / abort)
   - Screenshot before the first destructive step: `before-state.png`

5. **Confirm completion**
   - Screenshot after last step: `after-state.png`
   - Count successful vs failed actions
   - Emit receipt

## Expected Artifacts
- `before-state.png` — screenshot before automation ran
- `after-state.png` — screenshot after completion
- Receipt: `{ task, steps_planned, steps_completed, steps_failed, status }`

## Failure Handling
- **Element not found**: report which step failed, offer to retry after user re-describes target
- **Approval denied at any step**: stop immediately, emit partial receipt with `status: blocked`
- **Page navigated away mid-task**: pause, report location change, ask to continue on new page
- **Rate limit / CAPTCHA detected**: stop, report, do not attempt bypass
