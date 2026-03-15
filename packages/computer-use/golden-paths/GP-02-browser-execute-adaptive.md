# GP-02: Adaptive Browser Execute (browser-use)

## Purpose
Extract data or complete tasks on websites with shifting UIs.
LLM reasons about the page visually and adapts to DOM changes.

## Preconditions
- Target URL reachable
- `browser-use` and `langchain-openai` installed
- OpenAI API key configured (or compatible LLM endpoint)

## Routing
- **Family:** browser
- **Mode:** execute
- **Constraints:** `deterministic=False`
- **Primary adapter:** browser.browser-use
- **Fallback chain:** browser.playwright
- **Fail mode:** fail closed

## Execution Flow
```
goal → Router.route(family="browser", mode="execute", deterministic=False)
     → PolicyEngine.evaluate(target=url, action_type="goto")
     → SessionManager.create(family="browser")
     → BrowserUseAdapter.initialize()  # spins up browser-use Agent + LLM
     → BrowserUseAdapter.execute(goal="Extract product prices from page")
     → Agent reasons about page, clicks, extracts
     → ReceiptWriter.emit(action_data, result_data, integrity_hash)
     → SessionManager.destroy()
```

## Evidence Requirements
- Screenshot before extraction
- Extracted content captured as artifact
- Agent action log (what steps the LLM took)

## Receipt Requirements
- Route decision receipt (G5)
- Action receipt per LLM-driven step (G3)
- Content hash on extracted data

## Conformance
- Suite A tests applicable in fallback mode
- Visual reasoning override: if `visual_reasoning=True` and `deterministic=False`, router prefers browser-use over playwright
