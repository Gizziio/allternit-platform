# Allternit API Client

Official JavaScript/TypeScript client for the Allternit platform API.

## Installation

```bash
npm install @allternit/api-client
```

## Quick Start

```typescript
import { AllternitClient } from '@allternit/api-client';

const client = new AllternitClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.allternit.com' // optional, uses default
});

// List workspaces
const workspaces = await client.workspaces.list();
console.log(workspaces);

// List plugins
const plugins = await client.plugins.list();

// Execute a plugin
const result = await client.execute('market-research', {
  topic: 'AI assistants'
});
```

## API Reference

### Workspaces

```typescript
// List all workspaces
await client.workspaces.list();

// Get a specific workspace
await client.workspaces.get('workspace-id');

// Create a workspace
await client.workspaces.create({
  name: 'My Workspace',
  description: 'Description'
});

// Delete a workspace
await client.workspaces.delete('workspace-id');
```

### Plugins

```typescript
// List all plugins
await client.plugins.list();

// Get a specific plugin
await client.plugins.get('plugin-id');

// Install a plugin
await client.plugins.install('plugin-id');

// Uninstall a plugin
await client.plugins.uninstall('plugin-id');
```

### Tasks

```typescript
// List all tasks
await client.tasks.list();

// Get a specific task
await client.tasks.get('task-id');

// Create a task
await client.tasks.create({
  name: 'My Task',
  config: { /* task config */ }
});

// Cancel a task
await client.tasks.cancel('task-id');
```

### Execute Plugin

```typescript
const result = await client.execute('plugin-id', {
  param1: 'value1',
  param2: 'value2'
});

if (result.success) {
  console.log(result.result);
} else {
  console.error(result.error);
}
```

## Error Handling

```typescript
import { AllternitApiError } from '@allternit/api-client';

try {
  await client.workspaces.get('invalid-id');
} catch (error) {
  if (error instanceof AllternitApiError) {
    console.error(error.code);    // Error code
    console.error(error.message); // Error message
    console.error(error.details); // Additional details
  }
}
```

## Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `apiKey` | string | Yes | - | Your Allternit API key |
| `baseUrl` | string | No | `https://api.allternit.com` | API base URL |
| `timeout` | number | No | `30000` | Request timeout (ms) |

## License

MIT
