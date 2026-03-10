# Examples

This directory contains usage examples for the {{PLUGIN_NAME}} plugin.

## Available Examples

### JavaScript Examples

| File | Description |
|------|-------------|
| `basic-usage.js` | Basic JavaScript usage patterns |

### TypeScript Examples

| File | Description |
|------|-------------|
| `basic-usage.ts` | TypeScript usage with type safety |

## Running Examples

### Prerequisites

1. Make sure the plugin is installed and enabled in the A2R Platform
2. Node.js 18+ should be installed

### Running JavaScript Examples

```bash
# Navigate to examples directory
cd examples

# Run an example
node basic-usage.js
```

### Running TypeScript Examples

```bash
# Install dependencies (if not already installed)
npm install

# Run TypeScript example
npx ts-node examples/basic-usage.ts

# Or compile first
tsc examples/basic-usage.ts
node examples/basic-usage.js
```

## Example Descriptions

### 1. Initialize Plugin

Shows how to properly initialize the plugin and check its status.

```javascript
const plugin = await initializePlugin();
if (plugin && plugin.active) {
  // Plugin is ready to use
}
```

### 2. Settings Management

Demonstrates reading and writing plugin settings.

```javascript
// Get setting
const theme = plugin.getSetting('theme');

// Set setting
await plugin.setSetting('theme', 'dark');
```

### 3. Notifications

Shows how to display different types of notifications.

```javascript
plugin.showNotification('Hello!', 'info');
plugin.showNotification('Warning!', 'warning');
plugin.showNotification('Error!', 'error');
```

### 4. Panel Operations

Demonstrates opening and interacting with the plugin panel.

```javascript
await plugin.openPanel();
```

### 5. Event Handling

Shows how to listen to plugin events.

```javascript
const disposable = A2R.events.on('{{PLUGIN_ID}}:action-completed', handler);
// Later
disposable.dispose();
```

### 6. Error Handling

Demonstrates proper error handling patterns.

```javascript
try {
  await plugin.operation();
} catch (error) {
  plugin.showNotification('Error: ' + error.message, 'error');
}
```

### 7. Batch Operations

Shows how to perform batch operations with progress tracking.

```javascript
const results = await batchOperationWithProgress(
  plugin,
  (current, total, item) => {
    console.log(`${current}/${total}: ${item}`);
  }
);
```

### 8. API Usage

Demonstrates using the plugin's public API interface.

```javascript
const api: IMyPluginAPI = plugin;
await api.setSetting('key', 'value');
```

### 9. Complete Workflow

A complete end-to-end workflow example.

```javascript
await completeWorkflow();
```

### 10. Utility Functions

Helper functions for common operations.

```javascript
// Safe execution
const result = await safeExecute(plugin, async () => {
  return await plugin.riskyOperation();
}, 'Operation failed');

// Batch with concurrency
const results = await batchWithConcurrency(items, processItem, 3);
```

## Creating Your Own Examples

To create your own example:

1. Create a new file in this directory
2. Import the plugin and write your example code
3. Add documentation to this README

Example template:

```javascript
/**
 * My Custom Example
 */
async function myExample() {
  const plugin = A2R.plugins.get('{{PLUGIN_ID}}');
  
  // Your example code here
  
  return result;
}

// Export for use
module.exports = { myExample };

// Run if executed directly
if (require.main === module) {
  myExample().catch(console.error);
}
```

## Tips

1. **Check Plugin Status**: Always check if the plugin is active before using it
2. **Handle Errors**: Wrap operations in try-catch blocks
3. **Clean Up**: Dispose event listeners when done
4. **Use Types**: For TypeScript projects, use the provided interfaces
5. **Read Documentation**: Refer to the main docs for detailed API information

## Support

If you have questions about these examples:

- Check the [main documentation](../docs/README.md)
- Open an issue on [GitHub](https://github.com/{{GITHUB_USERNAME}}/{{REPO_NAME}}/issues)
- Join our [Discord community](https://discord.gg/a2r)
