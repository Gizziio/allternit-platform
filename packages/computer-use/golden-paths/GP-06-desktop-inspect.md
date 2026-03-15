# GP-06: Desktop Inspect (pyautogui — Read-Only)

## Purpose
Capture desktop state for debugging — screenshot the screen, read mouse
position, observe screen dimensions. No clicks or typing.

## Preconditions
- Desktop visible
- `pyautogui` installed

## Routing
- **Family:** desktop
- **Mode:** inspect
- **Primary adapter:** desktop.pyautogui
- **Fail mode:** fail open (read-only)

## Execution Flow
```
goal → Router.route(family="desktop", mode="inspect")
     → PolicyEngine.evaluate(action_type="observe")  # read-only
     → SessionManager.create(family="desktop")
     → PyAutoGUIAdapter.execute(screenshot)
     → PyAutoGUIAdapter.execute(observe)
     → ReceiptWriter.emit(...)
     → SessionManager.destroy()
```

## Evidence Requirements
- Full screen screenshot
- Screen size and mouse position

## Receipt Requirements
- Route decision receipt
- Observe/screenshot receipts (lower evidence bar — read-only)

## Conformance
- Suite D: D-01 screenshot, D-02 observe
