# Task pane makeover — reference screenshots

Captured 2026-09-07 with `vite preview` + Playwright at 350×640 (standard Office task-pane width).

| File | State |
|------|-------|
| `taskpane-word.png` | Companion mode, Word product target (`?product=word`) |
| `taskpane-excel.png` | Companion mode, Excel product target |
| `taskpane-powerpoint.png` | Companion mode, PowerPoint product target |
| `taskpane-standalone.png` | Standalone / no Office host |
| `taskpane-error.png` | Reconnect-needed state with Connect Allternit CTA (Office.js mocked, gateway unreachable) |

The transient "connecting" state (shimmer skeleton card, pulsing status dot) is not
captured here — it resolves too quickly to screenshot outside a real Office host.
