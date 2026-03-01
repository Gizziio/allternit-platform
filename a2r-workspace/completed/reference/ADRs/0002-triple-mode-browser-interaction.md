# 0002. Triple-Mode Browser Interaction Strategy (Vision, DOM, Network)

Date: 2026-02-04

## Status
Accepted

## Context
Traditional browser automation (Playwright/Puppeteer) is brittle and slow. Vision-based agents (like UI-TARS or A2R-Operator) are robust but computationally expensive and have high latency. 

We need an execution strategy that balances the discovery power of Vision with the extreme speed of the "Unbrowse" model (direct API replay).

## Decision
Implement a "Triple-Mode" interaction system within the A2R Browser and Orchestrator layers:

1.  **Vision Mode (Discovery)**: Used for initial exploration of unknown UIs or when the DOM is obfuscated. Relies on VLM coordinate mapping.
2.  **DOM Mode (Extraction)**: Used for high-volume structured data extraction from the accessibility tree.
3.  **Network Mode (Replay/Unbrowse)**: Used for repeated tasks. Captures internal API calls via CDP (Chrome DevTools Protocol) and replays them browser-lessly using captured authentication state.

## Consequences
- **Performance**: Repeated tasks move from ~45 seconds (UI) to <500ms (Network).
- **Reliability**: Network mode is immune to UI changes as long as backend endpoints are stable.
- **Observability**: The UI (CodeCanvas) provides clear indicators of which mode the agent is using, improving user trust.
- **Cost**: Significant reduction in VLM tokens for productionized "learned" skills.

