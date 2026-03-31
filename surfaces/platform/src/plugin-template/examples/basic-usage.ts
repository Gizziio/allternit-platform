/**
 * TypeScript Basic Usage Examples for {{PLUGIN_NAME}}
 * 
 * This file demonstrates common usage patterns for the plugin with TypeScript.
 * Copy and modify these examples for your own use.
 */

// ============================================================================
// IMPORTS
// ============================================================================

// Import types from the plugin
import { MyA2RPlugin, IMyPluginAPI, IMyPluginEvents } from '../src/index';

// Import A2R Platform types (when available)
// import { A2RPlugin, PluginContext, EventEmitter } from '@allternit/platform';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PluginSettings {
  enabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
}

interface ProcessResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================================================
// EXAMPLE 1: BASIC INITIALIZATION
// ============================================================================

/**
 * Initialize and configure the plugin
 */
async function initializePlugin(): Promise<MyA2RPlugin | null> {
  console.log('Initializing {{PLUGIN_NAME}}...');

  try {
    // In a real scenario, you'd get the plugin from the platform
    // const plugin = A2R.plugins.get('{{PLUGIN_ID}}') as MyA2RPlugin;
    
    // For this example, we'll create a mock instance
    const plugin = new MyA2RPlugin();

    // Check plugin info
    console.log('Plugin Info:', plugin.info);

    // Activate the plugin
    await plugin.activate();

    console.log('Plugin initialized successfully!');
    return plugin;

  } catch (error) {
    console.error('Failed to initialize plugin:', error);
    return null;
  }
}

// ============================================================================
// EXAMPLE 2: WORKING WITH SETTINGS
// ============================================================================

/**
 * Demonstrates how to read and write plugin settings
 */
async function settingsExample(plugin: MyA2RPlugin): Promise<void> {
  console.log('\n--- Settings Example ---\n');

  // Define typed settings
  const settings: PluginSettings = {
    enabled: true,
    theme: 'dark',
    notifications: true,
  };

  // Set multiple settings
  for (const [key, value] of Object.entries(settings)) {
    await plugin.setSetting(key, value);
    console.log(`Set ${key} = ${value}`);
  }

  // Get settings with type safety
  const currentTheme = plugin.getSetting('theme') as PluginSettings['theme'];
  const isEnabled = plugin.getSetting('enabled') as boolean;

  console.log('Current theme:', currentTheme);
  console.log('Plugin enabled:', isEnabled);
}

// ============================================================================
// EXAMPLE 3: NOTIFICATIONS
// ============================================================================

/**
 * Demonstrates different types of notifications
 */
function notificationsExample(plugin: MyA2RPlugin): void {
  console.log('\n--- Notifications Example ---\n');

  type NotificationType = 'info' | 'warning' | 'error';

  const notifications: Array<{ message: string; type: NotificationType }> = [
    { message: 'Plugin is ready', type: 'info' },
    { message: 'This is a warning', type: 'warning' },
    { message: 'An error occurred', type: 'error' },
  ];

  notifications.forEach(({ message, type }) => {
    plugin.showNotification(message, type);
    console.log(`Sent ${type} notification: ${message}`);
  });
}

// ============================================================================
// EXAMPLE 4: PANEL OPERATIONS
// ============================================================================

/**
 * Demonstrates panel operations
 */
async function panelExample(plugin: MyA2RPlugin): Promise<void> {
  console.log('\n--- Panel Example ---\n');

  if (!plugin.active) {
    console.warn('Plugin is not active');
    return;
  }

  try {
    await plugin.openPanel();
    console.log('Panel opened successfully');
  } catch (error) {
    console.error('Failed to open panel:', error);
  }
}

// ============================================================================
// EXAMPLE 5: TYPE-SAFE EVENT HANDLING
// ============================================================================

/**
 * Demonstrates type-safe event handling
 */
function eventHandlingExample(): () => void {
  console.log('\n--- Event Handling Example ---\n');

  // Type-safe event handler
  const handleActionCompleted = (data: IMyPluginEvents['my-plugin:action-completed']): void => {
    console.log('Action completed:', data.action);
    console.log('Result:', data.result);
  };

  const handleSettingsChanged = (data: IMyPluginEvents['my-plugin:settings-changed']): void => {
    console.log(`Setting changed: ${data.key} = ${data.value}`);
  };

  // In real usage:
  // const disposable1 = A2R.events.on('{{PLUGIN_ID}}:action-completed', handleActionCompleted);
  // const disposable2 = A2R.events.on('{{PLUGIN_ID}}:settings-changed', handleSettingsChanged);

  console.log('Event listeners registered');

  // Return cleanup function
  return () => {
    // disposable1.dispose();
    // disposable2.dispose();
    console.log('Event listeners disposed');
  };
}

// ============================================================================
// EXAMPLE 6: ERROR HANDLING
// ============================================================================

/**
 * Custom error class for plugin operations
 */
class PluginOperationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PluginOperationError';
  }
}

/**
 * Demonstrates robust error handling
 */
async function errorHandlingExample(plugin: MyA2RPlugin): Promise<void> {
  console.log('\n--- Error Handling Example ---\n');

  const performRiskyOperation = async (): Promise<ProcessResult> => {
    try {
      // Simulated operation
      const shouldFail = Math.random() > 0.5;
      
      if (shouldFail) {
        throw new PluginOperationError(
          'Operation failed randomly',
          'RANDOM_FAILURE',
          { timestamp: new Date().toISOString() }
        );
      }

      return { success: true, data: { result: 'success' } };

    } catch (error) {
      if (error instanceof PluginOperationError) {
        console.error(`[${error.code}] ${error.message}`);
        return { 
          success: false, 
          error: error.message,
        };
      }
      
      // Unknown error
      console.error('Unexpected error:', error);
      return { 
        success: false, 
        error: 'An unexpected error occurred',
      };
    }
  };

  const result = await performRiskyOperation();
  
  if (!result.success) {
    plugin.showNotification(`Error: ${result.error}`, 'error');
  } else {
    console.log('Operation successful:', result.data);
  }
}

// ============================================================================
// EXAMPLE 7: ASYNC OPERATIONS WITH PROGRESS
// ============================================================================

/**
 * Progress callback type
 */
type ProgressCallback = (current: number, total: number, item: string) => void;

/**
 * Demonstrates async batch operations with progress tracking
 */
async function batchOperationWithProgress(
  plugin: MyA2RPlugin,
  onProgress?: ProgressCallback
): Promise<ProcessResult[]> {
  console.log('\n--- Batch Operation with Progress ---\n');

  const items: string[] = Array.from({ length: 10 }, (_, i) => `item-${i + 1}`);
  const results: ProcessResult[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      results.push({ success: true, data: { item, processed: true } });
      
      // Report progress
      onProgress?.(i + 1, items.length, item);

      // Show notification at milestones
      if ((i + 1) % 3 === 0) {
        plugin.showNotification(
          `Progress: ${i + 1}/${items.length}`,
          'info'
        );
      }

    } catch (error) {
      results.push({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  plugin.showNotification(
    `Completed ${results.filter(r => r.success).length}/${items.length} items`,
    'info'
  );

  return results;
}

// ============================================================================
// EXAMPLE 8: PLUGIN API USAGE
// ============================================================================

/**
 * Demonstrates using the plugin's public API
 */
async function apiUsageExample(plugin: MyA2RPlugin): Promise<void> {
  console.log('\n--- API Usage Example ---\n');

  // Cast to the API interface for type safety
  const api: IMyPluginAPI = plugin;

  // Use API methods
  console.log('Getting setting...');
  const theme = api.getSetting('theme');
  console.log('Current theme:', theme);

  console.log('Setting new value...');
  await api.setSetting('theme', 'light');

  console.log('Showing notification...');
  api.showNotification('API example complete!', 'info');
}

// ============================================================================
// EXAMPLE 9: COMPLETE WORKFLOW
// ============================================================================

/**
 * Complete workflow example
 */
async function completeWorkflow(): Promise<void> {
  console.log('\n========================================');
  console.log('  Complete Workflow Example');
  console.log('========================================\n');

  // Step 1: Initialize
  const plugin = await initializePlugin();
  if (!plugin) {
    console.error('Failed to initialize plugin');
    return;
  }

  try {
    // Step 2: Configure
    await settingsExample(plugin);

    // Step 3: Show initial notification
    notificationsExample(plugin);

    // Step 4: Open UI
    await panelExample(plugin);

    // Step 5: Set up event listeners
    const cleanupEvents = eventHandlingExample();

    // Step 6: Perform batch operation
    const results = await batchOperationWithProgress(
      plugin,
      (current, total, item) => {
        console.log(`Progress: ${current}/${total} - ${item}`);
      }
    );

    console.log('Batch results:', results);

    // Step 7: Clean up
    cleanupEvents();
    await plugin.deactivate();

    console.log('\n========================================');
    console.log('  Workflow Complete!');
    console.log('========================================');

  } catch (error) {
    console.error('Workflow failed:', error);
    plugin.showNotification(
      `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    );
  }
}

// ============================================================================
// EXAMPLE 10: UTILITY FUNCTIONS
// ============================================================================

/**
 * Utility function to safely execute plugin operations
 */
async function safeExecute<T>(
  plugin: MyA2RPlugin,
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T | null> {
  try {
    if (!plugin.active) {
      throw new Error('Plugin is not active');
    }
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : errorMessage;
    plugin.showNotification(message, 'error');
    return null;
  }
}

/**
 * Utility function to batch operations with concurrency control
 */
async function batchWithConcurrency<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  concurrency: number = 3
): Promise<Array<{ item: T; result: R | null; error?: Error }>> {
  const results: Array<{ item: T; result: R | null; error?: Error }> = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = operation(item)
      .then(result => {
        results.push({ item, result });
      })
      .catch(error => {
        results.push({ item, result: null, error });
      })
      .then(() => {
        executing.splice(executing.indexOf(promise), 1);
      });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  initializePlugin,
  settingsExample,
  notificationsExample,
  panelExample,
  eventHandlingExample,
  errorHandlingExample,
  batchOperationWithProgress,
  apiUsageExample,
  completeWorkflow,
  safeExecute,
  batchWithConcurrency,
  PluginOperationError,
};

export type {
  PluginSettings,
  ProcessResult,
  ProgressCallback,
};

// Run complete workflow if executed directly
if (require.main === module) {
  completeWorkflow().catch(console.error);
}
