# Browser Actions Specification

Version: 0.3.0  
Status: Implementation Guide

---

## Session Model

### Session = Browser Context

```
session_id (string)
  └── browser_context (Playwright BrowserContext)
        └── current_page (Playwright Page)
```

### Rules

1. **One context per session_id**
   - First action with session_id creates context
   - Subsequent actions reuse same context
   - Context persists until explicitly closed or timeout

2. **Current page tracking**
   - `goto` sets the current page
   - Other actions operate on current page
   - New `goto` can create new page or navigate existing

3. **Session lifecycle**
   - Created: On first action with new session_id
   - Active: Extended on each action
   - Expired: After 30min idle (configurable)
   - Closed: Explicit close action or cleanup

---

## Action Semantics

### goto

**Purpose:** Navigate to URL

**Behavior:**
```
If no current page:
  Create new page → Navigate to target
Else:
  Navigate existing page to target

Set as current page
```

**Parameters:**
- `target` (required): URL to navigate to
- `parameters.wait_until`: "load" | "domcontentloaded" | "networkidle"
- `parameters.timeout`: milliseconds

**Returns:**
- `url`: Final URL after navigation
- `title`: Page title
- `load_time_ms`: Optional timing

---

### screenshot

**Purpose:** Capture screenshot

**Behavior:**
```
If target provided:
  goto(target) first

Capture screenshot of current page
```

**Parameters:**
- `target` (optional): URL to navigate to first
- `parameters.full_page`: boolean (default false)
- `parameters.type`: "png" | "jpeg"

**Returns:**
- Artifact with base64 data URL

---

### click

**Purpose:** Click element

**Behavior:**
```
Operate on current page
Find element by selector
Click element
Wait for navigation if occurs
```

**Parameters:**
- `target` (required): CSS selector or text description
- `parameters.timeout`: milliseconds to wait for element

**Returns:**
- `clicked`: boolean
- `navigated`: boolean (if page changed)
- `new_url`: string (if navigated)

---

### fill

**Purpose:** Fill input field

**Behavior:**
```
Operate on current page
Find input by selector
Clear existing value
Type new value
```

**Parameters:**
- `target` (required): CSS selector
- `parameters.text` (required): Text to fill
- `parameters.submit`: boolean (press Enter after fill)

**Returns:**
- `filled`: boolean
- `submitted`: boolean (if submit was true and performed)

---

### extract

**Purpose:** Extract structured data

**Behavior:**
```
Operate on current page
Extract based on target/query
Return structured data
```

**Parameters:**
- `target` (optional): CSS selector, query, or extraction pattern
- `parameters.format`: "text" | "html" | "json"

**Returns:**
- `extracted_content`: Structured data based on format

---

### inspect

**Purpose:** Get page structure

**Behavior:**
```
Operate on current page
Return DOM summary
```

**Parameters:**
- None (uses current page)

**Returns:**
- `url`: Current URL
- `title`: Page title
- `structure`: Simplified DOM (headings, links, forms)

---

### close (Future)

**Purpose:** Close session

**Behavior:**
```
Close browser context for session_id
Clean up resources
```

---

## Error Handling

### Validation Errors (400)

| Error | Condition |
|-------|-----------|
| `target_required` | Action needs target, none provided |
| `text_required` | Fill needs text, none provided |
| `goal_required` | Execute needs goal, none provided |
| `no_current_page` | Action needs page, session has none |

### Runtime Errors (500)

| Error | Condition | Response |
|-------|-----------|----------|
| `NAVIGATION_ERROR` | Page load failed | status: "failed" |
| `SELECTOR_NOT_FOUND` | Element not found | status: "failed" |
| `TIMEOUT` | Action exceeded timeout | status: "failed" |
| `SESSION_ERROR` | Browser/session failed | status: "failed" |

---

## Session State Machine

```
[No Session]
    |
    | First action with session_id
    v
[Creating Context] → [Active Session]
                          |
                          | Action
                          v
                    [Processing Action]
                          |
                          | Success/Failure
                          v
                    [Active Session] ←──┐
                          |             |
                          | 30min idle  |
                          v             |
                    [Expired Session]   |
                          |             |
                          | Cleanup     |
                          v             |
                    [Closed] ───────────┘
```

---

## Receipt Fields

Every action emits receipt with:

```json
{
  "action": "goto|click|fill|screenshot|extract|inspect",
  "timestamp": "2026-03-14T12:00:00Z",
  "success": true|false,
  "details": {
    "target": "...",
    "session_id": "...",
    "page_url": "...",
    // action-specific fields
  }
}
```

---

## Implementation Notes

### Session Manager

```python
class SessionManager:
    def get_or_create_context(session_id: str) -> BrowserContext
    def get_current_page(session_id: str) -> Page
    def set_current_page(session_id: str, page: Page)
    def close_session(session_id: str)
    def cleanup_expired()
```

### Page Lifecycle

1. **Creation:** `context.new_page()`
2. **Navigation:** `page.goto(url)`
3. **Interaction:** `page.click()`, `page.fill()`, etc.
4. **Capture:** `page.screenshot()`
5. **Reuse:** Keep for next action
6. **Cleanup:** Close on session end

### Thread Safety

- SessionManager uses asyncio.Lock()
- One context per session_id
- Concurrent actions on same session: serialize or reject
