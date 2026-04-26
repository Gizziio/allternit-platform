# Skill: form-filling

**Triggers:** "fill", "type", "enter", "submit", "input", form/input elements visible in a11y tree or screenshot

## Purpose

Safely fill and submit web forms with appropriate approval gates, field detection, and validation.

## Field Detection Strategy

### Ordered preference:
1. **Label association** — `<label for="id">` → target `#id`
2. **Placeholder text** — `input[placeholder="Email"]`
3. **ARIA label** — `[aria-label="Email address"]`
4. **Name attribute** — `input[name="email"]`
5. **Visual position** — coordinate-based fallback if accessibility fails

### Field Type Handling

| Field type | Action |
|------------|--------|
| `text` / `email` / `search` | `fill(selector, value)` |
| `password` | `fill(selector, value)` — **never log password value** |
| `textarea` | `fill(selector, value)` |
| `select` / `dropdown` | `select_option(selector, value)` |
| `checkbox` | `check(selector)` / `uncheck(selector)` |
| `radio` | `click(selector)` with correct value |
| `file upload` | surface to user — do not auto-upload without explicit file path |
| `date picker` | type YYYY-MM-DD format, fall back to calendar interaction |

## Credential Handling

**NEVER:**
- Ask the user to type credentials into the chat
- Log, store, or echo passwords
- Prefill credentials from memory

**DO:**
- Check if `~~credentials vault` connector is active
- If active: fetch credentials by domain and fill silently
- If not active: pause and ask user to enter credentials directly in the browser

## Pre-Submit Checklist

Before clicking Submit/Send/Continue:
1. Screenshot the completed form
2. List all fields and their values (redacting password fields)
3. If `approval_policy != never`: pause for user confirmation
4. Execute submit action
5. Screenshot post-submit state
6. Check for: success message, error message, redirect

## Approval Gate

For all form submissions:
```
📋 Form ready to submit:
  name: "Jane Doe"
  email: "jane@example.com"
  message: "Hello..."
  [password field: ••••••••]

Submit now? (yes / no / edit)
```

## Error Handling

| Error | Recovery |
|-------|----------|
| Required field empty | Fill and retry |
| Validation error on page | Read error message, fix field, retry |
| CSRF token mismatch | Reload page and re-fill |
| Rate limit / CAPTCHA | Pause, notify user |
| Submission timeout | Retry once, report if still failing |
