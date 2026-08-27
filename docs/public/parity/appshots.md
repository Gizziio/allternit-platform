# Appshots parity

An appshot is a user-triggered screenshot of an application that is attached as visual context. Allternit's equivalent is an explicit `computer` screenshot through the Allternit Computer Interface (ACI), or a browser full-page/element screenshot through `@allternit/browser-tools`.

## When to use appshots

Use a screenshot when the task depends on rendered state that text or source cannot express: a visual defect, a native dialog, a canvas, a chart, a browser layout, or the current state of an app. Prefer DOM extraction, logs, or source code when those provide the same evidence with less sensitive data.

## Take an appshot

With the SDK computer-use capability:

```typescript
import { ComputerUseCapability } from '@allternit/sdk/ai-runtime/capabilities/computer-use';

const computer = new ComputerUseCapability({
  displayWidthPx: 1280,
  displayHeightPx: 720,
});
const image = await computer.getTool().execute(
  { action: 'screenshot' },
  { callId: 'shot-1' }
);
```

For a web page, call `takeScreenshot(session.id, { fullPage: true })` or provide an element selector through browser-tools.

## What appshots capture

ACI captures the configured display exposed by the computer-use gateway at its natural resolution. A full-display shot can include every visible window, notification, menu, or secret on that display. Browser-tools captures only its isolated Playwright page (or selected element), making it the safer choice for browser-only review. Neither mechanism should be described as automatically redacting sensitive content.

## Permissions and safety

- Capture only after the user has selected the intended display/page and understands its scope.
- Close or mask passwords, tokens, private messages, notifications, and unrelated windows first.
- Keep computer actions behind the normal approval policy; screenshots do not authorize clicks or submissions.
- In self-hosted mode, image bytes stay on the selected host until included in a request to a model or external service.
- Apply host retention controls to screenshots, session events, and audit logs.

## Limits and troubleshooting

- ACI requires the computer-use gateway (default `http://127.0.0.1:8760`); a connection error means the gateway or display backend is unavailable.
- Display dimensions advertised to the model must match the captured display or click coordinates will drift.
- Headless, minimized, protected-video, and OS-secure surfaces may be blank or inaccessible.
- A screenshot is a point-in-time image; capture again after navigation or animation.
- Use browser-tools for a full-page web capture because a desktop screenshot only records the visible viewport.

See [ACI vision coordinates](../aci/index.md#vision-coordinates) and [Native Tool Belt computer use](../tools/tool-belt.md#computer-use).
