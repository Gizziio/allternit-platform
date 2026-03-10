/**
 * Basic Usage Examples for {{PLUGIN_NAME}}
 * 
 * This file demonstrates common usage patterns for the plugin.
 * Copy and modify these examples for your own use.
 */

// ============================================================================
// SETUP
// ============================================================================

// Import the plugin (when using in an external script)
// const { getPlugin } = require('@a2r/platform');
// const plugin = getPlugin('{{PLUGIN_ID}}');

// Or in the A2R Platform environment, the plugin is available globally
// const plugin = A2R.plugins.get('{{PLUGIN_ID}}');

// ============================================================================
// EXAMPLE 1: BASIC INITIALIZATION
// ============================================================================

/**
 * Initialize and configure the plugin
 */
async function initializePlugin() {
  console.log('Initializing {{PLUGIN_NAME}}...');

  // Get the plugin instance
  // const plugin = getPlugin('{{PLUGIN_ID}}');

  // Check if plugin is available
  // if (!plugin) {
  //   console.error('Plugin not found! Make sure it\'s installed and enabled.');
  //   return;
  // }

  // Check plugin info
  // console.log('Plugin Info:', plugin.info);
  // Output: { id: '{{PLUGIN_ID}}', name: '{{PLUGIN_NAME}}', version: '1.0.0' }

  // Open the plugin panel
  // await plugin.openPanel();

  console.log('Plugin initialized successfully!');
}

// ============================================================================
// EXAMPLE 2: WORKING WITH SETTINGS
// ============================================================================

/**
 * Demonstrates how to read and write plugin settings
 */
async function settingsExample() {
  console.log('\n--- Settings Example ---\n');

  // Get current settings
  // const currentTheme = plugin.getSetting('theme');
  // console.log('Current theme:', currentTheme);

  // Change a setting
  // await plugin.setSetting('theme', 'dark');
  // console.log('Theme changed to dark');

  // Get all settings
  // const allSettings = {
  //   enabled: plugin.getSetting('enabled'),
  //   theme: plugin.getSetting('theme'),
  //   notifications: plugin.getSetting('notifications'),
  // };
  // console.log('All settings:', allSettings);

  // Reset to defaults
  // await plugin.setSetting('theme', 'auto');
  // console.log('Theme reset to auto');
}

// ============================================================================
// EXAMPLE 3: SHOWING NOTIFICATIONS
// ============================================================================

/**
 * Demonstrates different types of notifications
 */
function notificationsExample() {
  console.log('\n--- Notifications Example ---\n');

  // Info notification
  // plugin.showNotification('This is an info message');
  // plugin.showNotification('This is also info', 'info');

  // Success notification (uses info type)
  // plugin.showNotification('Operation completed successfully!', 'info');

  // Warning notification
  // plugin.showNotification('This is a warning', 'warning');

  // Error notification
  // plugin.showNotification('Something went wrong!', 'error');

  console.log('Notifications sent!');
}

// ============================================================================
// EXAMPLE 4: PANEL INTERACTION
// ============================================================================

/**
 * Demonstrates panel open/close operations
 */
async function panelExample() {
  console.log('\n--- Panel Example ---\n');

  // Open the panel
  // await plugin.openPanel();
  // console.log('Panel opened');

  // The panel stays open until user closes it
  // or you can programmatically close it if the API supports it

  console.log('Panel operations complete');
}

// ============================================================================
// EXAMPLE 5: EVENT HANDLING
// ============================================================================

/**
 * Demonstrates listening to plugin events
 */
function eventHandlingExample() {
  console.log('\n--- Event Handling Example ---\n');

  // Import events API
  // const { events } = require('@a2r/platform');

  // Listen for plugin events
  // const disposable = events.on('{{PLUGIN_ID}}:action-completed', (data) => {
  //   console.log('Action completed:', data.action);
  //   console.log('Result:', data.result);
  // });

  // Listen for settings changes
  // const settingsDisposable = events.on('{{PLUGIN_ID}}:settings-changed', (data) => {
  //   console.log(`Setting ${data.key} changed to:`, data.value);
  // });

  // Later, clean up listeners
  // disposable.dispose();
  // settingsDisposable.dispose();

  console.log('Event listeners registered');
}

// ============================================================================
// EXAMPLE 6: ERROR HANDLING
// ============================================================================

/**
 * Demonstrates proper error handling
 */
async function errorHandlingExample() {
  console.log('\n--- Error Handling Example ---\n');

  try {
    // Attempt an operation
    // await plugin.someOperation();
    console.log('Operation successful');

  } catch (error) {
    // Handle the error
    console.error('Operation failed:', error.message);

    // Show user-friendly error message
    // plugin.showNotification(
    //   `Error: ${error.message}`,
    //   'error'
    // );
  }
}

// ============================================================================
// EXAMPLE 7: BATCH OPERATIONS
// ============================================================================

/**
 * Demonstrates batch processing with progress updates
 */
async function batchOperationExample() {
  console.log('\n--- Batch Operation Example ---\n');

  const items = ['item1', 'item2', 'item3', 'item4', 'item5'];
  const results = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    try {
      // Process each item
      // const result = await plugin.processItem(item);
      // results.push(result);

      console.log(`Processed ${i + 1}/${items.length}: ${item}`);

      // Show progress notification every 5 items
      if ((i + 1) % 5 === 0) {
        // plugin.showNotification(
        //   `Progress: ${i + 1}/${items.length} items processed`,
        //   'info'
        // );
      }

    } catch (error) {
      console.error(`Failed to process ${item}:`, error.message);
      // Continue with next item
    }
  }

  // Show completion notification
  // plugin.showNotification(
  //   `Completed! ${results.length}/${items.length} items processed`,
  //   'info'
  // );

  console.log('Batch operation complete');
  return results;
}

// ============================================================================
// EXAMPLE 8: CONDITIONAL LOGIC
// ============================================================================

/**
 * Demonstrates conditional plugin usage
 */
async function conditionalExample() {
  console.log('\n--- Conditional Logic Example ---\n');

  // Check if plugin is active before using it
  // if (!plugin.active) {
  //   console.warn('Plugin is not active. Please enable it in settings.');
  //   return;
  // }

  // Check plugin version for compatibility
  // const version = plugin.info.version;
  // if (version < '1.0.0') {
  //   console.warn('Plugin version is outdated. Please update.');
  // }

  // Check settings before operations
  // if (plugin.getSetting('enabled')) {
  //   await plugin.openPanel();
  // } else {
  //   console.log('Plugin is disabled in settings');
  // }

  console.log('Conditional checks complete');
}

// ============================================================================
// EXAMPLE 9: WORKFLOW INTEGRATION
// ============================================================================

/**
 * Demonstrates a complete workflow using the plugin
 */
async function workflowExample() {
  console.log('\n--- Workflow Example ---\n');

  console.log('Starting workflow...');

  // Step 1: Configure plugin
  // await plugin.setSetting('theme', 'dark');
  console.log('✓ Settings configured');

  // Step 2: Open panel
  // await plugin.openPanel();
  console.log('✓ Panel opened');

  // Step 3: Perform main operation
  try {
    // const result = await plugin.performOperation();
    console.log('✓ Operation completed');

    // Step 4: Show success notification
    // plugin.showNotification('Workflow completed successfully!', 'info');

  } catch (error) {
    // Step 5: Handle errors
    // plugin.showNotification(`Workflow failed: ${error.message}`, 'error');
    throw error;
  }

  console.log('Workflow complete!');
}

// ============================================================================
// EXAMPLE 10: CLEANUP
// ============================================================================

/**
 * Demonstrates proper cleanup when done
 */
async function cleanupExample() {
  console.log('\n--- Cleanup Example ---\n');

  // Save any unsaved changes
  // await plugin.saveSettings();
  console.log('✓ Settings saved');

  // Close panels
  // await plugin.closePanel();
  console.log('✓ Panels closed');

  // Remove event listeners
  // disposable.dispose();
  console.log('✓ Listeners removed');

  // Optional: Deactivate plugin if no longer needed
  // await plugin.deactivate();
  console.log('✓ Cleanup complete');
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

/**
 * Run all examples in sequence
 */
async function runAllExamples() {
  console.log('========================================');
  console.log('  {{PLUGIN_NAME}} - Usage Examples');
  console.log('========================================\n');

  await initializePlugin();
  await settingsExample();
  notificationsExample();
  await panelExample();
  eventHandlingExample();
  await errorHandlingExample();
  await batchOperationExample();
  await conditionalExample();
  await workflowExample();
  await cleanupExample();

  console.log('\n========================================');
  console.log('  All examples completed!');
  console.log('========================================');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

// Export examples for use in other scripts
module.exports = {
  initializePlugin,
  settingsExample,
  notificationsExample,
  panelExample,
  eventHandlingExample,
  errorHandlingExample,
  batchOperationExample,
  conditionalExample,
  workflowExample,
  cleanupExample,
  runAllExamples,
};
