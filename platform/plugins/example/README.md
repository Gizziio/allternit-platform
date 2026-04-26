# Message Counter Plugin

An example plugin for the Allternit ChatView plugin system that demonstrates how to build and structure plugins.

## Features

- 📊 **Message Statistics**: Tracks total messages, user messages, and assistant messages
- 📈 **Live Counter**: Sidebar panel with real-time statistics
- 🔔 **Notifications**: Shows notifications every 5 messages
- 🧮 **Toolbar Button**: Quick access to statistics via alert dialog
- 🖱️ **Message Action**: Right-click menu option to count specific messages

## Plugin Structure

```
plugins/example/
├── plugin.json          # Plugin manifest
├── src/
│   └── index.ts         # Plugin source code
├── dist/
│   └── index.js         # Compiled plugin bundle
└── README.md            # This file
```

## Manifest (plugin.json)

The manifest defines plugin metadata and contributions:

```json
{
  "id": "example.counter",
  "name": "Message Counter",
  "version": "1.0.0",
  "contributions": {
    "sidebar": [...],
    "toolbar": [...],
    "messageActions": [...]
  },
  "permissions": ["read:messages", "read:session"]
}
```

## Building

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Or for development with watch mode
npm run dev
```

## Development

This plugin demonstrates:

1. **State Management**: Maintaining plugin state across message events
2. **Component Registration**: Using `api.ui.registerComponent()` for sidebar panels
3. **Event Handling**: Subscribing to `messages.onNewMessage()` and `session.onSessionChange()`
4. **Command Registration**: Using `plugin.registerCommand()` for toolbar and context menu actions
5. **Notifications**: Using `api.ui.showNotification()` for user feedback

## API Usage

### Messages API

```typescript
// Subscribe to new messages
const unsubscribe = api.messages.onNewMessage((message) => {
  console.log('New message:', message.content);
});

// Get all messages in current thread
const messages = api.messages.getThreadMessages();

// Get a specific message
const message = api.messages.getMessageById(id);
```

### Session API

```typescript
// Get current session
const session = api.session.getCurrentSession();

// Subscribe to session changes
const unsubscribe = api.session.onSessionChange((session) => {
  if (session) {
    console.log('New session started:', session.id);
  }
});
```

### UI API

```typescript
// Show notification
api.ui.showNotification('Hello!', 'success');

// Register a component for sidebar/toolbar
api.ui.registerComponent('MyComponent', () => h('div', null, 'Hello'));

// Update toolbar badge
api.ui.setToolbarBadge('button-id', 5);
```

## Permissions

This plugin requests:

- `read:messages` - To count and track messages
- `read:session` - To detect session changes and reset counters

## License

MIT
