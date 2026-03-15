# GP-05: Desktop Execute (pyautogui)

## Purpose
Automate native desktop applications — screenshot, click, type, observe.
For legacy apps, GUI-only systems, or cross-app workflows.

## Preconditions
- Target application launchable
- Desktop visible (not headless server)
- `pyautogui` installed
- Screen accessible (not locked)

## Routing
- **Family:** desktop
- **Mode:** desktop (or execute — both route to pyautogui)
- **Primary adapter:** desktop.pyautogui
- **Fallback chain:** none
- **Fail mode:** fail closed

## Execution Flow
```
goal → Router.route(family="desktop", mode="desktop")
     → PolicyEngine.evaluate(adapter_risk_level="high", family="desktop")
       → forces headed mode (P-003)
     → SessionManager.create(family="desktop")
     → PyAutoGUIAdapter.execute(screenshot)     # full screen capture
     → PyAutoGUIAdapter.execute(observe)         # screen size, mouse pos
     → PyAutoGUIAdapter.execute(act, click x=500 y=300)
     → PyAutoGUIAdapter.execute(act, type text="hello")
     → ReceiptWriter.emit(...)
     → SessionManager.destroy()
```

## Supported Actions
| Action       | pyautogui Method     | Notes                    |
|-------------|----------------------|--------------------------|
| `screenshot` | `pyautogui.screenshot()` | Full screen PNG      |
| `observe`    | `size()`, `position()`   | Screen dims + cursor |
| `act:click`  | `pyautogui.click(x, y)`  | Absolute coordinates |
| `act:type`   | `pyautogui.write(text)`  | Keyboard input       |

## Evidence Requirements
- Screenshot before each action
- Screenshot after each action
- Mouse position logged

## Receipt Requirements
- Route decision receipt (G5)
- Receipt per desktop action with integrity hash (G3)
- Policy forces headed mode receipt

## Conformance
- Suite D: D-01 screenshot, D-02 observe, D-03 envelope, D-04 receipt
