# GP-09: Failure Replay Path

## Purpose
Verify that when an adapter action fails (due to a bad selector, a timeout, or an
unexpected page state), the observability layer captures a complete failure timeline
and produces a replayable artifact bundle that can be analysed without re-running
the live browser session.

This golden path is **intentionally adversarial**: it uses a selector that is known
not to exist on the target page so that failure is guaranteed and reproducible.

## Preconditions
- `browser.playwright` adapter is available and Chromium is installed.
- Observability / timeline recording is enabled (default in non-production runs).
- The test target URL is reachable: `https://example.com` (or a local stub that serves a known HTML page).
- No prior session state is present (clean context).

## Routing
- **Family:** browser
- **Mode:** execute
- **Constraints:** `record_timeline=True`, `on_failure=capture_replay`
- **Primary adapter:** browser.playwright
- **Fallback chain:** none (failure is the expected outcome)
- **Fail mode:** fail open — capture artifacts, do NOT retry

## Execution Flow

```
goal: extract element with bad selector from example.com

Router.route(family="browser", mode="execute", record_timeline=True)
  → PolicyEngine.evaluate(target="https://example.com", action_type="goto")
      → decision: allow
  → SessionManager.create(family="browser", session_id="gp09-test")
  → PlaywrightAdapter.execute(goto, "https://example.com")
      → success: page loaded, DOM captured
  → ObservabilityRecorder.checkpoint("page-loaded")
      → timeline event { t=0ms, kind="checkpoint", state="ok" }
  → PlaywrightAdapter.execute(
        action="extract",
        selector="div#this-selector-does-not-exist",
        timeout_ms=3000
    )
      → TimeoutError raised after 3000 ms
      → ObservabilityRecorder.record_failure({
            selector: "div#this-selector-does-not-exist",
            action: "extract",
            error: "TimeoutError: Locator.wait_for not found within 3000ms",
            dom_snapshot: "<html>...",
            screenshot_path: "failure-frame.png"
        })
  → ReplayGenerator.generate(session_id="gp09-test")
      → writes: timeline.json, replay.gif, analysis.json
  → ReceiptWriter.emit(status="failure", artifacts=[...])
  → SessionManager.destroy(session_id="gp09-test")
```

## Intentional Failure Setup

The test deliberately uses `selector="div#this-selector-does-not-exist"` on
`https://example.com`. This element is guaranteed absent. The timeout is set to
3 000 ms (not the default 30 000 ms) to keep test runtime short.

The purpose is to exercise:
1. The error capture path inside `PlaywrightAdapter`
2. The `ObservabilityRecorder` failure branch
3. The `ReplayGenerator` artifact pipeline
4. The receipt system under failure conditions

## Artifacts Generated

### `timeline.json`
A structured sequence of every event recorded during the session, including:

```json
{
  "session_id": "gp09-test",
  "started_at": "<ISO-8601>",
  "ended_at": "<ISO-8601>",
  "outcome": "failure",
  "events": [
    {
      "t_ms": 0,
      "kind": "navigate",
      "url": "https://example.com",
      "status": "ok",
      "dom_hash": "<sha256>"
    },
    {
      "t_ms": 120,
      "kind": "checkpoint",
      "label": "page-loaded",
      "status": "ok",
      "screenshot": "checkpoint-0.png"
    },
    {
      "t_ms": 3240,
      "kind": "action_failure",
      "action": "extract",
      "selector": "div#this-selector-does-not-exist",
      "error_class": "TimeoutError",
      "error_message": "Locator.wait_for: Timeout 3000ms exceeded.",
      "screenshot": "failure-frame.png",
      "dom_snapshot_path": "dom-at-failure.html"
    }
  ]
}
```

### `replay.gif`
Animated GIF constructed from the ordered set of screenshots taken during the
session. Must include at minimum:
- Frame 1: blank/loading page
- Frame 2: `checkpoint-0.png` — page successfully loaded
- Frame 3: `failure-frame.png` — page state at moment of failure (no visual change expected for a selector miss, but the frame still appears to confirm the page was intact)

GIF frame rate: 1 fps. Max file size: 5 MB.

### `analysis.json`
Machine-readable analysis of the failure, produced by the `FailureAnalyser`:

```json
{
  "session_id": "gp09-test",
  "failure_event_index": 2,
  "failure_kind": "selector_not_found",
  "failed_selector": "div#this-selector-does-not-exist",
  "failure_frames": [
    {
      "screenshot": "failure-frame.png",
      "dom_excerpt": "<body><div><h1>Example Domain</h1>...</div></body>",
      "note": "Target element absent from DOM. Page structure differs from expected."
    }
  ],
  "suggestions": [
    "Verify the selector against the current DOM snapshot: dom-at-failure.html",
    "Check if the page requires JavaScript hydration before the element appears.",
    "Consider using a broader selector (e.g. 'h1', 'p') to confirm the page loaded correctly.",
    "If the page structure changed, update the cookbook's selector definitions."
  ],
  "similar_elements_found": [
    { "selector": "div", "count": 1, "text_excerpt": "Example Domain..." }
  ],
  "replay_artifact": "replay.gif",
  "timeline_artifact": "timeline.json"
}
```

## Evidence Requirements
- `timeline.json` must be present and valid JSON.
- `replay.gif` must be a valid GIF file, minimum 2 frames.
- `analysis.json` must be present and include `failure_frames` (at least 1) and `suggestions` (at least 1).
- A receipt must be emitted with `status: "failure"` — a missing receipt is itself a test failure.
- The receipt must reference all three artifact file paths.

## Receipt Requirements
- `status: "failure"` (not `"error"` — the system behaved correctly, the task failed as expected)
- `artifacts` list includes: `timeline.json`, `replay.gif`, `analysis.json`, `failure-frame.png`
- `integrity_hash` present for each artifact
- `session_id` matches `"gp09-test"`

## Conformance
Suite G: Failure & Replay
- G-01: session starts and navigates successfully before failure
- G-02: `ObservabilityRecorder` captures the failure event within 100 ms of the exception
- G-03: `timeline.json` contains all expected event kinds in chronological order
- G-04: `replay.gif` is a valid animated GIF with >= 2 frames
- G-05: `analysis.json` contains `failure_frames` array (non-empty) and `suggestions` (non-empty)
- G-06: receipt emitted with `status: "failure"` and all artifact paths
- G-07: session is cleanly destroyed even after failure (no leaked browser processes)
