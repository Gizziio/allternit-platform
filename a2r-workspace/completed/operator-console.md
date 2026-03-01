# Operator Console Documentation

## 1. Purpose
The Operator Console is a safe, polished observability surface that provides a truthful trace of all IO executions. It ensures transparency by showing exactly what the system ran, not just what was suggested.

## 2. Event Mapping
The console subscribes to the IO journal stream and renders the following event kinds:

| Event Kind | Description | Visual Highlight |
|------------|-------------|-----------------|
| `io.command.executed` | Verbatim CLI/TUI command execution. | Blue label, Green prompt ($) |
| `gui.execute.performed` | Low-level GUI input event (click, type). | Orange label |
| `tools_executed` | General skill or tool call execution. | Green label |
| `gui.observe.captured` | Screenshot capture event. | Info label |

## 3. Data Contract
The console expects the following structure in the event payload:

```json
{
  "kind": "io.command.executed",
  "payload": {
    "command": "ls -la",
    "stdout": "total 0...",
    "stderr": "",
    "exit_code": 0,
    "timestamp": 123456789
  }
}
```

## 4. UI Components
- **Persistent Panel**: Located at the bottom of the Shell UI.
- **Collapsible**: Can be expanded to view full trace or collapsed to a header.
- **Verbatim Output**: Streams stdout/stderr in a monospace, dark-themed container.
- **Power Mode Toggle**: Allows switching to an interactive xterm.js terminal.

## 5. Safety
- **Read-Only by Default**: The standard console view does not allow command input.
- **Single Path**: All commands rendered in the console must originate from the centralized IO Runner.
