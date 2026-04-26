# Skill: browser-navigation

**Triggers:** Any URL, domain mention, "go to", "open", "navigate", "visit", "back", "forward", "reload"

## Purpose

Handle all browser navigation actions safely and reliably. Manages session lifecycle, wait conditions, and navigation failure recovery.

## Navigation Protocol

### Standard Navigation

```
1. Call navigate(url, wait_until="domcontentloaded")
2. Verify: check URL matches expected domain
3. Take initial screenshot
4. Check for: login walls, cookie banners, bot detection, error pages
5. Handle blockers before proceeding with the task
```

### Wait Strategy by Page Type

| Page type | wait_until | Extra wait |
|-----------|------------|------------|
| Static content | `domcontentloaded` | None |
| SPA / React / Next.js | `networkidle` | 500ms |
| Heavy dashboard | `networkidle` | 1000ms |
| Streaming/realtime | `load` | None |

### Blocker Detection

After navigation, check for:
- **Cookie banner** (`#cookie-banner`, `.cookie-consent`, `[aria-label*="cookie"]`) → click "Accept" or "Dismiss"
- **Login wall** (`form[action*="login"]`, `/login`, `/signin` redirect) → surface to user, do not attempt login without explicit authorization
- **CAPTCHA** (`iframe[src*="recaptcha"]`, `[data-sitekey]`) → pause, notify user, await resolution
- **Bot detection** (Cloudflare, PerimeterX, DataDome) → notify user, do not spoof or bypass

### Multi-Tab Management

- Default: single tab per session
- New tabs: only open if task explicitly requires it
- Tab switch: use `bring_to_front()` before acting on a different page
- Tab close: only when instructed

## Error Recovery

| Error | Recovery |
|-------|----------|
| Navigation timeout | Retry once with `wait_until=load`, then report |
| 404 / error page | Report immediately, suggest alternatives |
| Redirect loop | Break after 5 redirects, report |
| SSL error | Report, do not bypass |
| Network offline | Report, do not retry indefinitely |

## History Tracking

Track navigation history in step context:
```json
{ "action": "goto https://example.com", "observation": "landed on Example Domain homepage" }
```
Use history to avoid re-navigating to pages already visited unnecessarily.
