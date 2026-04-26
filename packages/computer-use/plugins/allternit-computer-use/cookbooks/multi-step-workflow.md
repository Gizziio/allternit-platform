# Cookbook: Multi-Step Workflow

**Use case:** Chain multiple browser or desktop actions into a reliable, resumable workflow with checkpoints.

---

## Overview

```
plan steps → checkpoint state → execute → verify each step → resume on failure → complete
```

---

## Workflow Structure

A multi-step workflow is a sequence of atomic tasks, each with:
- **Precondition:** expected state before the step
- **Action:** what to do
- **Postcondition:** expected state after the step
- **On failure:** recovery action

### Example: Research → Extract → Save

```
Step 1: navigate to search engine
  pre:  browser session active
  act:  navigate("https://google.com")
  post: Google homepage visible
  
Step 2: search for topic
  pre:  Google homepage
  act:  type(search_query) → key("Enter")
  post: Search results page with ≥1 result
  
Step 3: open first result
  pre:  Search results page
  act:  click(first result link)
  post: Article page loaded (not Google)
  
Step 4: extract article content
  pre:  Article page
  act:  extract(mode="text")
  post: content.length > 100
  
Step 5: save to storage
  pre:  extracted content available
  act:  run_code to format + write to file / connector
  post: file exists or connector confirms save
```

---

## Checkpoint Pattern

Before each step, checkpoint current state:
```python
checkpoint = {
  "step": N,
  "url": current_url,
  "screenshot_b64": screenshot,
  "timestamp": now()
}
```

On failure at step N:
1. Check if previous step's postcondition still holds
2. If yes: retry step N from precondition
3. If no: roll back to step N-1 checkpoint and retry from there
4. After 3 retries: escalate to recovery-agent

---

## Cross-Application Workflows

For workflows spanning browser + desktop:

```
Step 1-3: browser (extract data from web)
Step 4:   desktop (open Excel, paste data)
Step 5:   desktop (save file)
Step 6:   browser (upload saved file)
```

Handoff protocol:
1. Complete browser steps, store result in session context
2. Switch scope to `desktop`
3. Execute desktop steps referencing stored data
4. Switch back to `browser` scope
5. Complete remaining browser steps

---

## Parallelism (Sequential Only)

Current implementation is strictly sequential. Do not attempt parallel execution within a single planning loop. For parallel tasks, use multiple sessions with separate run IDs.

---

## Progress Reporting

At each step completion:
```
✓ Step 1/5: Navigated to Google (0.8s)
✓ Step 2/5: Searched "climate report 2026" (1.2s)
✓ Step 3/5: Opened first result: "IPCC..." (2.1s)
⟳ Step 4/5: Extracting article content...
```

On failure:
```
✗ Step 4/5 failed: Extraction returned empty content
  → Retrying with strategy: text (attempt 2/3)
✓ Step 4/5: Retried successfully (1.9s)
```
