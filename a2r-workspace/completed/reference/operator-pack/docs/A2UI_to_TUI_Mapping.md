# A2UI ⇄ TUI Mapping Contract

## 1. Purpose
To ensure that a single `CapsuleSpec` containing `A2UI` structures can be rendered consistently in both the high-fidelity Web UI and the high-efficiency terminal TUI.

## 2. Mapping Rules
| A2UI Component | TUI Representation | Notes |
| :--- | :--- | :--- |
| `Container` | `Block` / `Border` | Maintains structural grouping. |
| `Text` | `Paragraph` | Supports basic markdown. |
| `Table` | `Table Widget` | Maps headers and rows directly. |
| `Button` | `List Item (Actionable)` | Triggered via Enter or Number key. |
| `Input` | `Input Widget` | Standard text input field. |
| `StatusBadge` | `Styled Span` | Uses color tokens (Green, Yellow, Red). |

## 3. Logic Constraints
- **Zero JS**: TUI does not execute JavaScript. Only declarative state changes are supported.
- **Lazy Load**: Large datasets in tables must support pagination/streaming.
- **Fallback**: Unknown components render as `[Unsupported Component: ID]`.
