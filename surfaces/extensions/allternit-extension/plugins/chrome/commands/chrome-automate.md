---
description: Automate a repetitive task on the current page — form filling, data entry, bulk actions
argument-hint: "[describe the task]"
---

# /chrome:automate

> If you see unfamiliar tool placeholders or need to check which connectors are active, see [CONNECTORS.md](../CONNECTORS.md).
> All automation requires explicit user approval before execution. See policy below.

Describe a repetitive task on this page and Allternit will plan and execute it step by step.

## What Can Be Automated

```
┌─────────────────────────────────────────────────────────────────┐
│                       AUTOMATE                                   │
├─────────────────────────────────────────────────────────────────┤
│  STANDALONE (always works)                                       │
│  ✓ Fill forms from context (name, address, known fields)        │
│  ✓ Click through multi-step UI flows                            │
│  ✓ Repeat the same action across a list of items                │
│  ✓ Copy/reorganize content between sections of a page           │
├─────────────────────────────────────────────────────────────────┤
│  SUPERCHARGED (when tools are connected)                         │
│  + ~~knowledge base: fill forms from saved profile data         │
│  + ~~project tracker: bulk-create tickets from page lists       │
│  + ~~calendar: book multiple slots from a scheduling page       │
└─────────────────────────────────────────────────────────────────┘
```

## Approval Policy

Per plugin policy, **all automation steps that mutate state** (form submissions, button
clicks that trigger server-side actions, sending messages) require explicit approval:

1. Allternit describes the planned steps in plain language
2. User reviews and confirms ("go ahead") or cancels
3. Allternit executes step by step, reporting each action
4. A receipt is generated at the end

## Example Invocations

- `/chrome:automate Fill this checkout form using my saved address`
- `/chrome:automate Click "Mark as done" on every completed item in this list`
- `/chrome:automate Apply label "Q4" to all 12 rows in this table`

## Blocked Actions

The following are **never automated** without additional operator-level approval:
- Payment submission
- Account deletion or deactivation
- Sending email or social posts without preview
- Force-actions that bypass UI confirmation dialogs

## If Connectors Available

If **~~knowledge base** is connected:
- Pull saved profile data (name, address, preferences) to fill form fields
- No need to type — ask to use saved data

If **~~project tracker** is connected:
- Create tickets in bulk from any list on the page
- Map list items to ticket fields automatically
