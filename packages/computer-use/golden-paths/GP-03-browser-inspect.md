# GP-03: Browser Inspect/Debug (CDP)

## Purpose
Debug a website using Chrome DevTools Protocol — inspect DOM targets,
take screenshots, evaluate JavaScript, navigate. Read-only by default.

## Preconditions
- Chrome/Chromium running with `--remote-debugging-port=9222`
- Target page loaded in browser

## Routing
- **Family:** browser
- **Mode:** inspect
- **Primary adapter:** browser.cdp
- **Fallback chain:** browser.playwright
- **Fail mode:** fail open (inspection is read-only)

## Execution Flow
```
goal → Router.route(family="browser", mode="inspect")
     → PolicyEngine.evaluate(action_type="inspect")  # read-only, lower bar
     → SessionManager.create(family="browser")
     → CDPAdapter.execute(inspect)        # GET /json — list targets
     → CDPAdapter.execute(screenshot)     # WebSocket Page.captureScreenshot
     → CDPAdapter.execute(eval, "document.title")  # WebSocket Runtime.evaluate
     → CDPAdapter.execute(goto, url)      # WebSocket Page.navigate
     → ReceiptWriter.emit(...)
     → SessionManager.destroy()
```

## Supported CDP Actions
| Action      | CDP Method             | Transport  |
|-------------|------------------------|------------|
| `inspect`   | GET /json              | HTTP       |
| `screenshot`| Page.captureScreenshot | WebSocket  |
| `eval`      | Runtime.evaluate       | WebSocket  |
| `goto`      | Page.navigate          | WebSocket  |

## Evidence Requirements
- DOM target list from /json
- Screenshot PNG as artifact
- Eval results captured

## Receipt Requirements
- Route decision receipt (G5)
- Inspection action receipts (lower evidence bar for read-only)

## Conformance
- Suite A partial (inspect subset)
- Suite F: routing determinism for inspect mode
