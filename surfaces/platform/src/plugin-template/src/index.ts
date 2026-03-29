/**
 * A2R Plugin - {{PLUGIN_NAME}}
 * 
 * This is the main entry point for your plugin.
 * 
 * The A2R Platform provides a rich API for building plugins:
 * - UI Components: Panels, modals, notifications
 * - Commands: Register keyboard shortcuts and commands
 * - Storage: Persist plugin data
 * - Network: Make HTTP requests
 * - Events: Listen to platform events
 * 
 * @see https://docs.a2r.dev/plugins/api-reference
 */

// ============================================================================
// IMPORTS
// ============================================================================

// A2R Platform SDK (when available)
// import { A2RPlugin, Panel, Command, Storage } from '@a2r/platform';

// Or use the global A2R object provided by the platform
// declare const A2R: {
//   registerPlugin: (plugin: A2RPlugin) => void;
//   // ... other APIs
// };

// ============================================================================
// PLUGIN CONFIGURATION
// ============================================================================

const PLUGIN_ID = '{{PLUGIN_ID}}';
const PLUGIN_NAME = '{{PLUGIN_NAME}}';
const PLUGIN_VERSION = '1.0.0';

// ============================================================================
// PLUGIN CLASS
// ============================================================================

/**
 * Main plugin class
 * 
 * Implement the A2RPlugin interface to create a fully functional plugin.
 * This template provides stubs for all lifecycle methods and common features.
 */
export class MyA2RPlugin {
  /**
   * Plugin ID (from plugin.json)
   */
  public readonly id: string = PLUGIN_ID;

  /**
   * Plugin display name
   */
  public readonly name: string = PLUGIN_NAME;

  /**
   * Plugin version
   */
  public readonly version: string = PLUGIN_VERSION;

  /**
   * Storage instance for persisting plugin data
   */
  private _storage: any = null;

  /**
   * Logger instance
   */
  private _logger: any = null;

  /**
   * Plugin settings
   */
  private settings: Record<string, any> = {};

  /**
   * Whether the plugin is currently active
   */
  private isActive: boolean = false;

  /**
   * Command disposables (for cleanup)
   */
  private disposables: Array<() => void> = [];

  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================

  /**
   * Called when the plugin is activated
   * 
   * Use this method to:
   * - Register commands
   * - Create UI components
   * - Set up event listeners
   * - Initialize storage
   */
  public async activate(): Promise<void> {
    console.log(`[${this.name}] Activating plugin v${this.version}...`);

    try {
      // Initialize storage
      // this.storage = await A2R.storage.createStorage(this.id);
      
      // Load settings
      await this.loadSettings();

      // Register commands
      this.registerCommands();

      // Register UI components
      this.registerUI();

      // Set up event listeners
      this.registerEventListeners();

      this.isActive = true;
      console.log(`[${this.name}] Plugin activated successfully!`);

    } catch (error) {
      console.error(`[${this.name}] Failed to activate plugin:`, error);
      throw error;
    }
  }

  /**
   * Called when the plugin is deactivated
   * 
   * Use this method to:
   * - Clean up resources
   * - Save state
   * - Remove event listeners
   * - Dispose UI components
   */
  public async deactivate(): Promise<void> {
    console.log(`[${this.name}] Deactivating plugin...`);

    try {
      // Dispose all registered disposables
      this.disposables.forEach(dispose => {
        try {
          dispose();
        } catch (error) {
          console.error(`[${this.name}] Error during disposal:`, error);
        }
      });
      this.disposables = [];

      // Save settings
      await this.saveSettings();

      this.isActive = false;
      console.log(`[${this.name}] Plugin deactivated`);

    } catch (error) {
      console.error(`[${this.name}] Error during deactivation:`, error);
    }
  }

  // ==========================================================================
  // SETTINGS MANAGEMENT
  // ==========================================================================

  /**
   * Load plugin settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      // Default settings
      const defaults = {
        enabled: true,
        theme: 'auto',
        notifications: true,
      };

      // Load saved settings (when storage API is available)
      // const saved = await this.storage?.get('settings') || {};
      // this.settings = { ...defaults, ...saved };
      
      this.settings = defaults;

    } catch (error) {
      console.error(`[${this.name}] Failed to load settings:`, error);
    }
  }

  /**
   * Save plugin settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      // await this.storage?.set('settings', this.settings);
    } catch (error) {
      console.error(`[${this.name}] Failed to save settings:`, error);
    }
  }

  /**
   * Update a setting value
   */
  public async setSetting(key: string, value: any): Promise<void> {
    this.settings[key] = value;
    await this.saveSettings();
  }

  /**
   * Get a setting value
   */
  public getSetting(key: string): any {
    return this.settings[key];
  }

  // ==========================================================================
  // COMMANDS
  // ==========================================================================

  /**
   * Register plugin commands
   */
  private registerCommands(): void {
    // Example: Register a command to open the plugin panel
    // const openCommand = A2R.commands.registerCommand({
    //   id: `${this.id}.open`,
    //   title: 'Open My Plugin',
    //   keybinding: 'Cmd+Shift+P',
    //   handler: () => this.openPanel(),
    // });
    // this.disposables.push(() => openCommand.dispose());

    // Example: Register a command with arguments
    // const runCommand = A2R.commands.registerCommand({
    //   id: `${this.id}.run`,
    //   title: 'Run Plugin Action',
    //   handler: (args: any) => this.handleAction(args),
    // });
    // this.disposables.push(() => runCommand.dispose());

    console.log(`[${this.name}] Commands registered`);
  }

  // ==========================================================================
  // UI COMPONENTS
  // ==========================================================================

  /**
   * Register UI components
   */
  private registerUI(): void {
    // Example: Register a sidebar panel
    // const panel = A2R.ui.createPanel({
    //   id: `${this.id}.panel`,
    //   title: this.name,
    //   icon: 'plugin-icon',
    //   component: MyPanelComponent,
    // });
    // this.disposables.push(() => panel.dispose());

    // Example: Register a status bar item
    // const statusBarItem = A2R.ui.createStatusBarItem({
    //   id: `${this.id}.status`,
    //   text: '$(icon) Ready',
    //   tooltip: 'Click to open plugin',
    //   command: `${this.id}.open`,
    // });
    // this.disposables.push(() => statusBarItem.dispose());

    console.log(`[${this.name}] UI components registered`);
  }

  /**
   * Open the main plugin panel
   */
  public async openPanel(): Promise<void> {
    console.log(`[${this.name}] Opening panel...`);
    // Implementation: Show panel UI
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Example: Listen for workspace events
    // const workspaceListener = A2R.events.on('workspace:changed', (data) => {
    //   this.handleWorkspaceChange(data);
    // });
    // this.disposables.push(() => workspaceListener.dispose());

    // Example: Listen for configuration changes
    // const configListener = A2R.events.on('config:changed', (key: string) => {
    //   if (key.startsWith(this.id)) {
    //     this.handleConfigChange(key);
    //   }
    // });
    // this.disposables.push(() => configListener.dispose());

    console.log(`[${this.name}] Event listeners registered`);
  }

  /**
   * Handle workspace change event
   */
  private _handleWorkspaceChange(data: any): void {
    console.log(`[${this.name}] Workspace changed:`, data);
    // Implementation: React to workspace changes
  }

  /**
   * Handle configuration change
   */
  private _handleConfigChange(key: string): void {
    console.log(`[${this.name}] Config changed:`, key);
    // Implementation: React to config changes
  }

  // ==========================================================================
  // PLUGIN ACTIONS
  // ==========================================================================

  /**
   * Handle a plugin action
   */
  private _handleAction(args: any): void {
    console.log(`[${this.name}] Handling action:`, args);
    // Implementation: Execute plugin functionality
  }

  /**
   * Show a notification
   */
  public showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    // A2R.notifications.show({
    //   message,
    //   type,
    //   source: this.name,
    // });
    console.log(`[${this.name}] ${type}: ${message}`);
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Check if the plugin is active
   */
  public get active(): boolean {
    return this.isActive;
  }

  /**
   * Get plugin information
   */
  public get info(): { id: string; name: string; version: string } {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
    };
  }
}

// ============================================================================
// PLUGIN EXPORT
// ============================================================================

/**
 * Default plugin instance
 * 
 * The platform will import this and call activate() when the plugin is loaded.
 */
const plugin = new MyA2RPlugin();

export default plugin;

// ============================================================================
// TYPE DEFINITIONS (for development)
// ============================================================================

/**
 * Example: Define your plugin's API surface for other plugins
 */
export interface IMyPluginAPI {
  /**
   * Open the plugin panel
   */
  openPanel(): Promise<void>;

  /**
   * Get a setting value
   */
  getSetting(key: string): any;

  /**
   * Set a setting value
   */
  setSetting(key: string, value: any): Promise<void>;

  /**
   * Show a notification
   */
  showNotification(message: string, type?: 'info' | 'warning' | 'error'): void;
}

/**
 * Example: Plugin events that other plugins can listen to
 */
export interface IMyPluginEvents {
  /**
   * Emitted when the plugin completes an action
   */
  'my-plugin:action-completed': { action: string; result: any };

  /**
   * Emitted when settings change
   */
  'my-plugin:settings-changed': { key: string; value: any };
}

// ============================================================================
// DOCUMENTATION
// ============================================================================

/**
 * @fileoverview
 * 
 * This is a template for creating A2R Platform plugins.
 * 
 * ## Getting Started
 * 
 * 1. Replace all {{PLACEHOLDER}} values with your actual plugin info
 * 2. Implement the activate() method with your plugin logic
 * 3. Add commands, UI components, and event listeners as needed
 * 4. Build and test your plugin locally
 * 5. Publish to the A2R Marketplace
 * 
 * ## Best Practices
 * 
 * - Always clean up resources in deactivate()
 * - Use the storage API for persistence
 * - Handle errors gracefully
 * - Provide meaningful notifications to users
 * - Document your plugin's API for other developers
 * 
 * ## Resources
 * 
 * - Documentation: https://docs.a2r.dev/plugins
 * - API Reference: https://docs.a2r.dev/plugins/api-reference
 * - Examples: https://github.com/a2rchitech/a2r-plugin-examples
 * - Community: https://discord.gg/a2r
 */
