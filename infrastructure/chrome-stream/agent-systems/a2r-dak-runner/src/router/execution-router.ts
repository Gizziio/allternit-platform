/**
 * Execution Router
 *
 * Routes operator tasks to the appropriate backend based on:
 * 1. Target type (browser, electron, desktop, file)
 * 2. Available connectors (API vs automation)
 * 3. User preferences (prefer_connector, allow_browser_automation)
 * 4. Policy constraints (allowed_tools, forbidden_tools)
 *
 * Decision priority:
 * 1. Connector/API if available and configured
 * 2. Browser automation if target is web and API absent/incomplete
 * 3. Electron-native if target is owned Electron surface
 * 4. OS automation fallback (if enabled)
 */

import { EventEmitter } from 'events';

export type ExecutionBackend =
  | 'connector'
  | 'browser_automation'
  | 'electron_native'
  | 'os_automation'
  | 'file_system';

export interface ExecutionRoute {
  backend: ExecutionBackend;
  reason: string;
  confidence: number; // 0-1
  fallback?: ExecutionBackend;
  config?: Record<string, unknown>;
}

export interface RouterTarget {
  target_type: 'browser' | 'electron' | 'desktop' | 'file';
  target_app?: string;
  target_domain?: string;
  target_context?: Record<string, unknown>;
  url?: string;
  window_title?: string;
}

export interface RouterPreferences {
  prefer_connector: boolean;
  allow_browser_automation: boolean;
  allow_desktop_fallback: boolean;
  allow_electron_native: boolean;
}

export interface RouterPolicy {
  allowed_tools?: string[];
  forbidden_tools?: string[];
  require_private_model: boolean;
}

export interface RouterContext {
  availableConnectors: string[];
  electronAppsInstalled: string[];
  osAutomationAvailable: boolean;
}

export class ExecutionRouter extends EventEmitter {
  private context: RouterContext;

  constructor(context: RouterContext) {
    super();
    this.context = context;
  }

  /**
   * Route a task to the appropriate backend
   */
  route(
    target: RouterTarget,
    intent: string,
    preferences: RouterPreferences,
    policy: RouterPolicy
  ): ExecutionRoute {
    this.emit('routing:start', { target, intent, preferences, policy });

    // Check policy constraints first
    if (this.isPolicyBlocked(target, policy)) {
      const route: ExecutionRoute = {
        backend: 'connector', // Safe fallback
        reason: 'Policy constraints block direct automation',
        confidence: 1.0,
      };
      this.emit('routing:complete', route);
      return route;
    }

    // Try connector first if preferred and available
    if (preferences.prefer_connector) {
      const connectorRoute = this.tryConnectorRoute(target, intent, preferences);
      if (connectorRoute && connectorRoute.confidence > 0.7) {
        this.emit('routing:complete', connectorRoute);
        return connectorRoute;
      }
    }

    // Try browser automation for web targets
    if (target.target_type === 'browser' && preferences.allow_browser_automation) {
      const browserRoute = this.tryBrowserRoute(target, intent, preferences);
      if (browserRoute) {
        this.emit('routing:complete', browserRoute);
        return browserRoute;
      }
    }

    // Try Electron-native for owned apps
    if (preferences.allow_electron_native && target.target_type === 'electron') {
      const electronRoute = this.tryElectronRoute(target, intent, preferences);
      if (electronRoute) {
        this.emit('routing:complete', electronRoute);
        return electronRoute;
      }
    }

    // Try OS automation fallback
    if (preferences.allow_desktop_fallback && this.context.osAutomationAvailable) {
      const osRoute = this.tryOSRoute(target, intent, preferences);
      if (osRoute) {
        this.emit('routing:complete', osRoute);
        return osRoute;
      }
    }

    // File system operations
    if (target.target_type === 'file') {
      const fileRoute: ExecutionRoute = {
        backend: 'file_system',
        reason: 'File system target detected',
        confidence: 1.0,
      };
      this.emit('routing:complete', fileRoute);
      return fileRoute;
    }

    // Default fallback
    const defaultRoute: ExecutionRoute = {
      backend: preferences.allow_browser_automation ? 'browser_automation' : 'connector',
      reason: 'No specific route found, using default fallback',
      confidence: 0.5,
      fallback: 'connector',
    };

    this.emit('routing:complete', defaultRoute);
    return defaultRoute;
  }

  /**
   * Check if policy blocks automation
   */
  private isPolicyBlocked(target: RouterTarget, policy: RouterPolicy): boolean {
    // Check if browser automation is explicitly forbidden
    if (policy.forbidden_tools?.includes('browser_automation')) {
      return true;
    }

    // Check if target requires private model and we can't provide it
    if (policy.require_private_model && target.target_type === 'browser') {
      // For now, allow but mark for private routing
      // In production, this would check model availability
    }

    return false;
  }

  /**
   * Try to route via connector/API
   */
  private tryConnectorRoute(
    target: RouterTarget,
    intent: string,
    preferences: RouterPreferences
  ): ExecutionRoute | null {
    // Check if we have a connector for this domain/app
    if (target.target_domain && this.context.availableConnectors.includes(target.target_domain)) {
      return {
        backend: 'connector',
        reason: `Connector available for ${target.target_domain}`,
        confidence: 0.95,
        config: {
          connector: target.target_domain,
        },
      };
    }

    // Check for Canvas connector
    if (target.target_domain?.includes('canvas') || target.target_domain?.includes('instructure')) {
      if (this.context.availableConnectors.includes('canvas')) {
        return {
          backend: 'connector',
          reason: 'Canvas API connector available',
          confidence: 0.9,
          config: {
            connector: 'canvas',
          },
        };
      }
    }

    // No connector available
    if (preferences.prefer_connector) {
      return {
        backend: 'connector',
        reason: 'Connector preferred but not available, will fallback',
        confidence: 0.3,
        fallback: 'browser_automation',
      };
    }

    return null;
  }

  /**
   * Try to route via browser automation
   */
  private tryBrowserRoute(
    target: RouterTarget,
    intent: string,
    preferences: RouterPreferences
  ): ExecutionRoute | null {
    if (!preferences.allow_browser_automation) {
      return null;
    }

    // Detect Canvas-specific routing
    if (target.target_domain?.includes('canvas') || target.target_domain?.includes('instructure')) {
      return {
        backend: 'browser_automation',
        reason: 'Canvas browser automation playbook available',
        confidence: 0.85,
        config: {
          playbook: 'canvas',
          domain: target.target_domain,
        },
      };
    }

    // Generic web automation
    if (target.target_type === 'browser' && target.url) {
      return {
        backend: 'browser_automation',
        reason: 'Generic browser automation for web target',
        confidence: 0.7,
        config: {
          playbook: 'generic_web',
          url: target.url,
        },
      };
    }

    return null;
  }

  /**
   * Try to route via Electron-native
   */
  private tryElectronRoute(
    target: RouterTarget,
    intent: string,
    preferences: RouterPreferences
  ): ExecutionRoute | null {
    if (!preferences.allow_electron_native) {
      return null;
    }

    // Check if target app is an owned Electron app
    if (target.target_app && this.context.electronAppsInstalled.includes(target.target_app)) {
      return {
        backend: 'electron_native',
        reason: `Native Electron control for ${target.target_app}`,
        confidence: 0.9,
        config: {
          app: target.target_app,
        },
      };
    }

    return null;
  }

  /**
   * Try to route via OS automation
   */
  private tryOSRoute(
    target: RouterTarget,
    intent: string,
    preferences: RouterPreferences
  ): ExecutionRoute | null {
    if (!preferences.allow_desktop_fallback || !this.context.osAutomationAvailable) {
      return null;
    }

    // Desktop app automation via AppleScript/PowerShell
    if (target.target_type === 'desktop' || target.window_title) {
      return {
        backend: 'os_automation',
        reason: 'OS-level automation fallback',
        confidence: 0.6,
        config: {
          os: process.platform,
          window: target.window_title,
        },
      };
    }

    return null;
  }

  /**
   * Get backend capabilities matrix
   */
  getCapabilities(): Record<ExecutionBackend, {
    supported: boolean;
    features: string[];
    limitations: string[];
  }> {
    return {
      connector: {
        supported: this.context.availableConnectors.length > 0,
        features: ['API integration', 'Structured data', 'High reliability'],
        limitations: ['Requires API availability', 'Limited to connector scope'],
      },
      browser_automation: {
        supported: true,
        features: ['Universal web access', 'DOM manipulation', 'Visual verification'],
        limitations: ['UI fragility', 'Slower than API', 'Requires browser'],
      },
      electron_native: {
        supported: this.context.electronAppsInstalled.length > 0,
        features: ['Direct app control', 'High performance', 'Rich integration'],
        limitations: ['Only owned apps', 'Requires app installation'],
      },
      os_automation: {
        supported: this.context.osAutomationAvailable,
        features: ['Universal desktop access', 'Legacy app support'],
        limitations: ['OS-specific', 'Fragile', 'Security restrictions'],
      },
      file_system: {
        supported: true,
        features: ['Direct file access', 'High performance'],
        limitations: ['Local only', 'Permission required'],
      },
    };
  }

  /**
   * Explain routing decision
   */
  explainRoute(route: ExecutionRoute, target: RouterTarget): string {
    const explanation = [
      `Routing to: ${route.backend}`,
      `Reason: ${route.reason}`,
      `Confidence: ${(route.confidence * 100).toFixed(0)}%`,
    ];

    if (route.fallback) {
      explanation.push(`Fallback: ${route.fallback}`);
    }

    explanation.push(`\nTarget context:`);
    explanation.push(`  Type: ${target.target_type}`);
    if (target.target_app) explanation.push(`  App: ${target.target_app}`);
    if (target.target_domain) explanation.push(`  Domain: ${target.target_domain}`);
    if (target.url) explanation.push(`  URL: ${target.url}`);

    return explanation.join('\n');
  }
}

/**
 * Factory function to create ExecutionRouter
 */
export function createExecutionRouter(context: RouterContext): ExecutionRouter {
  return new ExecutionRouter(context);
}
