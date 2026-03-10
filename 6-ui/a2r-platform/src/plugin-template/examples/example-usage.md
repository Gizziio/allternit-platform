# My A2R Plugin - Usage Examples

This document provides practical examples of using My A2R Plugin in various scenarios.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Examples](#basic-examples)
3. [Advanced Usage](#advanced-usage)
4. [Integration Examples](#integration-examples)
5. [Automation Workflows](#automation-workflows)
6. [Best Practices](#best-practices)

---

## Getting Started

### Installation Check

After installing the plugin, verify it's working:

```typescript
// Check plugin status
const status = await a2r.commands.executeCommand('myPlugin.status');
console.log('Plugin status:', JSON.parse(status));
```

### Configuration Setup

```typescript
// Configure the plugin programmatically
await a2r.configuration.update('myPlugin.enabled', true);
await a2r.configuration.update('myPlugin.debug', false);
await a2r.configuration.update('myPlugin.timeout', 10000);
```

---

## Basic Examples

### Example 1: Simple Command Execution

```typescript
/**
 * Basic plugin usage - run the main command
 */
async function basicUsage() {
  try {
    // Execute the main plugin command
    const result = await a2r.commands.executeCommand('myPlugin.run');
    
    console.log('✓ Plugin executed successfully');
    console.log('Result:', result);
    
    return result;
  } catch (error) {
    console.error('✗ Plugin execution failed:', error);
    throw error;
  }
}

// Run the example
basicUsage();
```

### Example 2: With Custom Options

```typescript
/**
 * Execute with custom options
 */
async function customOptionsExample() {
  const options = {
    verbose: true,
    format: 'json',
    timeout: 15000
  };
  
  const result = await a2r.commands.executeCommand('myPlugin.run', {
    input: 'custom input data',
    options
  });
  
  return result;
}
```

### Example 3: Batch Processing

```typescript
/**
 * Process multiple items in batch
 */
async function batchProcessingExample(items: string[]) {
  const results = [];
  
  for (const item of items) {
    const result = await a2r.commands.executeCommand('myPlugin.run', {
      input: item
    });
    results.push(result);
  }
  
  console.log(`Processed ${results.length} items`);
  return results;
}

// Usage
const items = ['item1', 'item2', 'item3'];
batchProcessingExample(items);
```

---

## Advanced Usage

### Example 4: Error Handling

```typescript
/**
 * Robust error handling with retry logic
 */
async function robustExecution(maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}...`);
      
      const result = await a2r.commands.executeCommand('myPlugin.run');
      
      console.log('✓ Success!');
      return result;
      
    } catch (error) {
      lastError = error;
      console.warn(`✗ Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Example 5: Progress Tracking

```typescript
/**
 * Track progress of long-running operations
 */
async function trackProgress() {
  const progressHandler = await a2r.notifications.withProgress({
    title: 'Processing with My Plugin',
    cancellable: true
  }, async (progress, token) => {
    // Track different stages
    const stages = [
      { name: 'Initializing', increment: 10 },
      { name: 'Loading data', increment: 30 },
      { name: 'Processing', increment: 40 },
      { name: 'Finalizing', increment: 20 }
    ];
    
    for (const stage of stages) {
      if (token.isCancellationRequested) {
        console.log('Operation cancelled by user');
        return null;
      }
      
      progress.report({
        message: stage.name,
        increment: stage.increment
      });
      
      await a2r.commands.executeCommand('myPlugin.run', {
        stage: stage.name
      });
    }
    
    return 'Complete!';
  });
  
  return progressHandler;
}
```

### Example 6: Event Handling

```typescript
/**
 * Listen to plugin events
 */
function setupEventListeners() {
  // Listen for completion events
  const disposable = a2r.events.on('myPlugin.onDidComplete', (event) => {
    console.log('Plugin completed:', {
      timestamp: new Date(event.timestamp).toISOString(),
      duration: event.duration,
      result: event.result
    });
  });
  
  // Clean up listener when done
  return disposable;
}

// Usage
const listener = setupEventListeners();

// Later, when you want to stop listening
// listener.dispose();
```

---

## Integration Examples

### Example 7: Integration with A2R Agents

```typescript
/**
 * Use the plugin within an A2R agent
 */
async function agentIntegration() {
  // Create an agent that uses the plugin
  const agent = await a2r.agents.create({
    name: 'Plugin-Enhanced Agent',
    description: 'An agent that leverages My A2R Plugin',
    capabilities: ['myPlugin.skill1', 'myPlugin.skill2']
  });
  
  // Define agent behavior
  agent.registerHandler('process', async (context) => {
    const { input } = context.params;
    
    // Use the plugin
    const result = await a2r.commands.executeCommand('myPlugin.run', {
      input,
      options: { agentMode: true }
    });
    
    return {
      processed: true,
      data: result
    };
  });
  
  // Start the agent
  await agent.start();
  
  return agent;
}
```

### Example 8: Workspace Integration

```typescript
/**
 * Integrate with workspace events
 */
async function workspaceIntegration() {
  // Listen for workspace open events
  a2r.workspace.onDidOpen(async (workspace) => {
    console.log('Workspace opened:', workspace.name);
    
    // Automatically run plugin for certain workspace types
    if (workspace.type === 'project') {
      await a2r.commands.executeCommand('myPlugin.run', {
        context: 'workspace-open',
        workspaceId: workspace.id
      });
    }
  });
  
  // Listen for file changes
  a2r.workspace.onDidChangeFiles(async (event) => {
    for (const change of event.changes) {
      if (change.uri.endsWith('.myext')) {
        await a2r.commands.executeCommand('myPlugin.processFile', {
          file: change.uri
        });
      }
    }
  });
}
```

### Example 9: Custom UI Integration

```typescript
/**
 * Create a custom UI that uses the plugin
 */
async function customUIIntegration() {
  // Create a webview panel
  const panel = await a2r.ui.createWebviewPanel({
    id: 'myPlugin.panel',
    title: 'My Plugin Dashboard',
    iconPath: 'assets/icon.png'
  });
  
  // Handle messages from UI
  panel.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'run':
        const result = await a2r.commands.executeCommand('myPlugin.run', {
          input: message.data
        });
        panel.postMessage({
          type: 'result',
          data: result
        });
        break;
        
      case 'configure':
        await a2r.commands.executeCommand('myPlugin.configure');
        break;
    }
  });
  
  return panel;
}
```

---

## Automation Workflows

### Example 10: Scheduled Task

```typescript
/**
 * Set up a scheduled task using the plugin
 */
async function scheduledTask() {
  // Define the task
  const task = {
    id: 'myPlugin.dailyTask',
    schedule: '0 9 * * *', // Every day at 9 AM
    handler: async () => {
      console.log('Running scheduled task...');
      
      await a2r.commands.executeCommand('myPlugin.run', {
        context: 'scheduled',
        timestamp: Date.now()
      });
      
      // Send notification
      await a2r.notifications.showInformationMessage(
        'Daily task completed successfully!'
      );
    }
  };
  
  // Register the task
  await a2r.tasks.register(task);
  
  console.log('Scheduled task registered');
}
```

### Example 11: Pipeline Workflow

```typescript
/**
 * Create a multi-step pipeline using the plugin
 */
async function pipelineWorkflow(inputData: unknown) {
  const pipeline = [
    {
      name: 'validation',
      execute: async (data) => {
        await a2r.commands.executeCommand('myPlugin.validate', { data });
        return data;
      }
    },
    {
      name: 'transformation',
      execute: async (data) => {
        return await a2r.commands.executeCommand('myPlugin.transform', { data });
      }
    },
    {
      name: 'processing',
      execute: async (data) => {
        return await a2r.commands.executeCommand('myPlugin.process', { data });
      }
    },
    {
      name: 'export',
      execute: async (data) => {
        await a2r.commands.executeCommand('myPlugin.export', { data });
        return data;
      }
    }
  ];
  
  let result = inputData;
  
  for (const step of pipeline) {
    console.log(`Executing step: ${step.name}`);
    result = await step.execute(result);
  }
  
  console.log('Pipeline completed successfully');
  return result;
}
```

### Example 12: Conditional Workflow

```typescript
/**
 * Conditional workflow based on plugin results
 */
async function conditionalWorkflow(input: unknown) {
  // Initial processing
  const result = await a2r.commands.executeCommand('myPlugin.analyze', {
    input
  });
  
  // Branch based on result
  switch (result.type) {
    case 'typeA':
      await a2r.commands.executeCommand('myPlugin.handleTypeA', {
        data: result.data
      });
      break;
      
    case 'typeB':
      await a2r.commands.executeCommand('myPlugin.handleTypeB', {
        data: result.data
      });
      break;
      
    case 'typeC':
      // Chain multiple operations
      await a2r.commands.executeCommand('myPlugin.preprocess', {
        data: result.data
      });
      await a2r.commands.executeCommand('myPlugin.process', {
        data: result.data
      });
      break;
      
    default:
      console.warn('Unknown type:', result.type);
  }
}
```

---

## Best Practices

### Error Handling Pattern

```typescript
/**
 * Recommended error handling pattern
 */
async function safeExecution<T>(
  command: string,
  args?: unknown
): Promise<{ success: true; data: T } | { success: false; error: Error }> {
  try {
    const result = await a2r.commands.executeCommand(command, args);
    return { success: true, data: result as T };
  } catch (error) {
    console.error(`Command ${command} failed:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
```

### Resource Cleanup Pattern

```typescript
/**
 * Ensure resources are cleaned up properly
 */
async function withCleanup<T>(
  operation: () => Promise<T>
): Promise<T> {
  const disposables: Array<() => void> = [];
  
  try {
    // Register cleanup handlers
    const disposable = a2r.events.on('myPlugin.onDidComplete', () => {
      console.log('Cleanup: operation completed');
    });
    disposables.push(() => disposable.dispose());
    
    // Execute operation
    const result = await operation();
    
    return result;
  } finally {
    // Always clean up
    for (const dispose of disposables) {
      dispose();
    }
  }
}
```

### Configuration Validation Pattern

```typescript
/**
 * Validate configuration before use
 */
function validateConfig(config: Record<string, unknown>): boolean {
  const required = ['apiKey', 'endpoint'];
  
  for (const key of required) {
    if (!config[key]) {
      console.error(`Missing required config: ${key}`);
      return false;
    }
  }
  
  return true;
}
```

---

## Running the Examples

To run these examples:

1. **Setup**:
   ```bash
   # Ensure the plugin is installed
   a2r plugin list | grep my-plugin
   ```

2. **Run in A2R Dev Console**:
   - Open A2R Platform
   - Open Developer Console (Ctrl+Shift+I)
   - Paste and run the example code

3. **Run in a Script**:
   ```typescript
   // Save as example.ts
   import { a2r } from '@a2r/platform';
   
   // Copy example code here
   
   // Execute
   main().catch(console.error);
   ```

---

**Need more examples?** Check the [full documentation](../docs/README.md) or [create an issue](https://github.com/yourusername/my-a2r-plugin/issues).
