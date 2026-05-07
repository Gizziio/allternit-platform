# A2UI Developer Guide

## What is A2UI?

A2UI (Agent-to-User Interface) is a declarative UI system that allows AI agents to generate user interfaces dynamically. Instead of returning just text, agents can now render rich interactive components.

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   User      │────▶│   UI     │────▶│  Gateway │────▶│   API    │
│ Interaction │     │ (Next.js)│     │ (Port    │     │ (Port    │
│             │◀────│          │◀────│  8013)   │◀────│  3000)   │
└─────────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                           │
                                                           ▼
                                                    ┌──────────┐
                                                    │  Kernel  │
                                                    │ (Port    │
                                                    │  3004)   │
                                                    └──────────┘
```

## Quick Start

### 1. Create an A2UI Session

```typescript
import { a2uiApi } from "@/capsules/a2ui";

const session = await a2uiApi.createSession(
  chatId,
  {
    version: "1.0",
    surfaces: [
      {
        id: "main",
        title: "My First A2UI",
        components: [
          {
            type: "Text",
            props: { content: "Hello from Agent!", variant: "title" },
          },
          {
            type: "Button",
            props: { label: "Click Me", action: "greet" },
          },
        ],
      },
    ],
  },
  { agentId: "my-agent", messageId: "msg-123" }
);
```

### 2. Render the A2UI

```tsx
import { BackendA2UIRenderer } from "@/capsules/a2ui";

function MyComponent({ sessionId }: { sessionId: string }) {
  return <BackendA2UIRenderer sessionId={sessionId} />;
}
```

### 3. Handle Actions

Actions are automatically forwarded to the backend. The agent processes them and returns updates.

```typescript
// Agent receives action from Kernel
{
  "session_id": "sess-123",
  "action_id": "greet",
  "payload": { "name": "User" },
  "data_model": { "greeting_count": 0 }
}

// Agent responds with
{
  "success": true,
  "message": "Hello, User!",
  "data_model_updates": { "greeting_count": 1 }
}
```

## Component Reference

### Base Components (Always Available)

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `Container` | Layout container | `direction`, `padding`, `gap` |
| `Stack` | Horizontal/vertical stack | `direction`, `gap`, `align` |
| `Grid` | CSS Grid layout | `columns`, `gap` |
| `Text` | Text display | `content`, `variant` |
| `Card` | Card container | `title`, `elevation` |
| `Button` | Clickable button | `label`, `variant`, `action` |
| `TextField` | Input field | `label`, `valuePath`, `placeholder` |
| `Select` | Dropdown select | `label`, `options`, `valuePath` |
| `Switch` | Toggle switch | `label`, `valuePath` |
| `Checkbox` | Checkbox input | `label`, `valuePath` |
| `RadioGroup` | Radio button group | `options`, `valuePath` |
| `Slider` | Range slider | `min`, `max`, `valuePath` |
| `List` | List of items | `items`, `renderItem` |
| `DataTable` | Data table | `dataPath`, `columns` |
| `Badge` | Status badge | `content`, `variant` |
| `Progress` | Progress bar | `value`, `max` |
| `Spinner` | Loading spinner | `size` |
| `Tabs` | Tab navigation | `tabs`, `activeTab` |
| `Accordion` | Collapsible sections | `items` |
| `Alert` | Alert message | `title`, `message`, `severity` |
| `Dialog` | Modal dialog | `open`, `title`, `children` |
| `Tooltip` | Hover tooltip | `content`, `children` |
| `Popover` | Click popover | `trigger`, `content` |
| `Menu` | Dropdown menu | `items`, `trigger` |
| `Image` | Image display | `src`, `alt` |
| `Code` | Code block | `content`, `language` |
| `Search` | Search input | `placeholder`, `onSearch` |

### Extended Components (Full Roadmap)

| Component | Description | Phase |
|-----------|-------------|-------|
| `Chart` | Data visualization | 1 |
| `DatePicker` | Date selection | 1 |
| `Calendar` | Full calendar view | 1 |
| `FileUpload` | File upload | 1 |
| `RichText` | Rich text editor | 2 |
| `TreeView` | Hierarchical tree | 2 |
| `SplitPane` | Resizable panes | 2 |
| `Timeline` | Timeline view | 2 |
| `AgentThinking` | Agent thought process | 3 |
| `ToolCall` | Tool execution display | 3 |
| `ArtifactPreview` | File preview | 3 |
| `ResponsiveContainer` | Responsive layout | 4 |
| `DockPanel` | Dockable panels | 4 |

## Example Payloads

### Contact Form

```json
{
  "version": "1.0",
  "surfaces": [{
    "id": "contact-form",
    "title": "Contact Us",
    "components": [
      {
        "type": "Container",
        "props": { "direction": "column", "padding": 24, "gap": 16 },
        "children": [
          {
            "type": "TextField",
            "props": {
              "label": "Name",
              "valuePath": "form.name",
              "placeholder": "Enter your name"
            }
          },
          {
            "type": "TextField",
            "props": {
              "label": "Email",
              "valuePath": "form.email",
              "type": "email",
              "placeholder": "Enter your email"
            }
          },
          {
            "type": "TextField",
            "props": {
              "label": "Message",
              "valuePath": "form.message",
              "multiline": true,
              "rows": 4
            }
          },
          {
            "type": "Stack",
            "props": { "direction": "row", "gap": 8, "justify": "end" },
            "children": [
              {
                "type": "Button",
                "props": { "label": "Cancel", "variant": "secondary", "action": "cancel" }
              },
              {
                "type": "Button",
                "props": { "label": "Submit", "variant": "primary", "action": "submit" }
              }
            ]
          }
        ]
      }
    ]
  }],
  "dataModel": {
    "form": { "name": "", "email": "", "message": "" }
  }
}
```

### Data Dashboard

```json
{
  "version": "1.0",
  "surfaces": [{
    "id": "dashboard",
    "title": "Sales Dashboard",
    "components": [
      {
        "type": "Grid",
        "props": { "columns": 3, "gap": 16 },
        "children": [
          {
            "type": "Card",
            "props": { "title": "Revenue" },
            "children": [{
              "type": "Text",
              "props": { "content": "$45,230", "variant": "h2" }
            }]
          },
          {
            "type": "Card",
            "props": { "title": "Orders" },
            "children": [{
              "type": "Text",
              "props": { "content": "1,234", "variant": "h2" }
            }]
          },
          {
            "type": "Card",
            "props": { "title": "Customers" },
            "children": [{
              "type": "Text",
              "props": { "content": "567", "variant": "h2" }
            }]
          }
        ]
      },
      {
        "type": "Chart",
        "props": {
          "type": "line",
          "dataPath": "salesData",
          "xAxis": { "key": "month", "type": "category" },
          "series": [{ "key": "revenue", "name": "Revenue", "color": "#007aff" }],
          "height": 300
        }
      }
    ]
  }],
  "dataModel": {
    "salesData": [
      { "month": "Jan", "revenue": 12000 },
      { "month": "Feb", "revenue": 15000 },
      { "month": "Mar", "revenue": 18230 }
    ]
  }
}
```

### Task List with Actions

```json
{
  "version": "1.0",
  "surfaces": [{
    "id": "task-list",
    "title": "My Tasks",
    "components": [
      {
        "type": "Stack",
        "props": { "direction": "row", "gap": 8, "justify": "end" },
        "children": [
          {
            "type": "Button",
            "props": { "label": "Add Task", "variant": "primary", "action": "add_task" }
          },
          {
            "type": "Button",
            "props": { "label": "Refresh", "variant": "secondary", "action": "refresh" }
          }
        ]
      },
      {
        "type": "DataTable",
        "props": {
          "dataPath": "tasks",
          "columns": [
            { "key": "title", "header": "Title" },
            { "key": "status", "header": "Status" },
            { "key": "priority", "header": "Priority" },
            { "key": "dueDate", "header": "Due Date" }
          ],
          "rowActions": [
            { "label": "Edit", "action": "edit_task" },
            { "label": "Delete", "action": "delete_task", "variant": "danger" }
          ]
        }
      }
    ]
  }],
  "dataModel": {
    "tasks": [
      { "id": 1, "title": "Review PR", "status": "Pending", "priority": "High", "dueDate": "2024-01-20" },
      { "id": 2, "title": "Update Docs", "status": "In Progress", "priority": "Medium", "dueDate": "2024-01-22" }
    ]
  }
}
```

## API Reference

### Session Management

```typescript
// Create session
const session = await a2uiApi.createSession(chatId, payload, options);

// Get session
const session = await a2uiApi.getSession(sessionId);

// List sessions for chat
const { sessions } = await a2uiApi.listSessions(chatId);

// Update data model
await a2uiApi.updateDataModel(sessionId, newDataModel);

// Delete session
await a2uiApi.deleteSession(sessionId);
```

### Action Execution

```typescript
// Execute action
const result = await a2uiApi.executeAction({
  sessionId: "sess-123",
  actionId: "submit",
  payload: { name: "John" },
  dataModel: currentDataModel,
});

// Execute with streaming (for long-running actions)
const cleanup = await a2uiApi.executeActionStream(
  { sessionId, actionId: "long_task" },
  (event) => {
    console.log(event.type, event.progress, event.message);
  },
  (error) => {
    console.error("Stream error:", error);
  }
);

// Cleanup when done
cleanup();
```

### Capsule Registry

```typescript
// List capsules
const { capsules } = await a2uiApi.listCapsules();

// Search capsules
const { capsules } = await a2uiApi.listCapsules("form");

// Install capsule
const capsule = await a2uiApi.installCapsule({
  id: "my-capsule",
  name: "My Capsule",
  version: "1.0.0",
  entry: { type: "a2ui", src: "payload.json" },
});

// Launch capsule as session
const { sessionId } = await a2uiApi.launchCapsule(capsuleId, {
  chat_id: "chat-123",
  context: { initialData: "..." },
});
```

### Generate A2UI from Prompt

```typescript
// Request agent to generate UI
const { sessionId, payload } = await a2uiApi.requestA2UIGeneration(
  chatId,
  "Create a form for booking a meeting room",
  {
    dataModel: { rooms: [...] },
  }
);
```

## React Hooks

### useA2UIBackend

Full-featured hook for backend-connected A2UI:

```tsx
import { useA2UIBackend } from "@/capsules/a2ui";

function MyA2UIComponent({ sessionId }: { sessionId: string }) {
  const {
    session,
    loading,
    error,
    localDataModel,
    actionLoading,
    handleAction,
    updateLocalDataModel,
    refreshSession,
  } = useA2UIBackend({
    sessionId,
    autoSave: true,
    onDataModelChange: (data) => console.log("Data changed:", data),
    onPayloadChange: (payload) => console.log("New payload:", payload),
  });

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <A2UIRenderer
      payload={session.payload}
      dataModel={localDataModel}
      onAction={handleAction}
    />
  );
}
```

### useA2UISession

Simple session fetching:

```tsx
const { session, loading, error, refresh } = useA2UISession(sessionId);
```

### useA2UIAction

Standalone action execution:

```tsx
const { executeAction, loading, error } = useA2UIAction();

// Later...
await executeAction({
  sessionId: "sess-123",
  actionId: "submit",
  payload: formData,
});
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_A2UI_ENABLED` | Enable A2UI feature | `true` |
| `NEXT_PUBLIC_A2UI_DEFAULT_RENDERER` | Default renderer to use | `extended` |
| `A2UI_SESSION_TIMEOUT` | Session expiry in seconds | `3600` |
| `A2UI_MAX_SESSIONS_PER_CHAT` | Max sessions per chat | `10` |

## Troubleshooting

### Session not found
- Check session ID is correct
- Verify user has access to the session
- Session may have expired

### Actions not working
- Verify Kernel is running on port 3004
- Check Gateway configuration includes A2UI routes
- Review Kernel logs for action processing errors

### Components not rendering
- Check component type is in whitelist
- Verify payload structure matches schema
- Check browser console for errors

### Type errors
- Run `npm run typecheck` to identify issues
- Ensure all component props match type definitions

## Resources

- [A2UI Kernel Endpoints](./A2UI_KERNEL_ENDPOINTS.md) - Kernel API specification
- [A2UI Types](../src/capsules/a2ui/a2ui.types.ts) - TypeScript definitions
- [Example Payloads](../src/capsules/a2ui/examples/) - More example payloads
