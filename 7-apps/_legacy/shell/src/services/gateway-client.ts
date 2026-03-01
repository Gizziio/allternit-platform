/**
 * Gateway Client for Shell UI
 * 
 * Provides a unified interface to communicate with the gateway,
 * which then routes requests to the appropriate kernel services.
 * This ensures all communication follows the UI → Gateway → Kernel pattern.
 */

import { gatewayRegistryLoader } from './gateway-registry-loader';

// Use relative path to ensure all requests go through the gateway proxy
// The actual gateway endpoint is configured at deployment/build time
const GATEWAY_BASE_URL = '/gateway';

// Global request log for forensics purposes
const REQUEST_LOG: Array<{
  timestamp: string;
  routeName: string;
  path: string;
  method: string;
  status: 'success' | 'error' | 'pending';
  responseTime?: number;
}> = [];

// Limit log size to last 50 entries
const MAX_LOG_ENTRIES = 50;

class GatewayClient {
  private async makeRequest(routeName: string, options: {
    method?: string;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string | number>;
    body?: any;
  } = {}) {
    const routeInfo = await gatewayRegistryLoader.getRouteByName(routeName);

    if (!routeInfo) {
      throw new Error(`Route not found in gateway registry: ${routeName}`);
    }

    // Construct the path with path parameters
    let path = routeInfo.path;
    if (options.pathParams) {
      Object.entries(options.pathParams).forEach(([key, value]) => {
        path = path.replace(`{${key}}`, encodeURIComponent(value));
      });
    }

    // Add query parameters if present
    let fullPath = path;
    if (options.queryParams) {
      const searchParams = new URLSearchParams();
      Object.entries(options.queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        fullPath += `?${queryString}`;
      }
    }

    // Determine the method to use
    const method = options.method || 'GET';

    // Validate that the method is allowed for this route
    if (!routeInfo.methods.includes(method)) {
      throw new Error(`Method ${method} not allowed for route ${routeName}. Allowed: ${routeInfo.methods.join(', ')}`);
    }

    // Log the request for forensics
    const logEntry = {
      timestamp: new Date().toISOString(),
      routeName,
      path: fullPath,
      method,
      status: 'pending' as const,
    };
    
    REQUEST_LOG.push(logEntry);
    if (REQUEST_LOG.length > MAX_LOG_ENTRIES) {
      REQUEST_LOG.shift();
    }

    // Make the request to the gateway
    const startTime = Date.now();
    const response = await fetch(`${GATEWAY_BASE_URL}${fullPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Update log entry with status and response time
    logEntry.status = response.ok ? 'success' : 'error';
    logEntry.responseTime = responseTime;

    if (!response.ok) {
      throw new Error(`Gateway request failed for route ${routeName}: ${response.statusText}`);
    }

    return response.json();
  }

  // Frameworks API
  async getFrameworks() {
    return this.makeRequest('get-frameworks', { method: 'GET' });
  }

  // Journal API
  async getJournalStream() {
    return this.makeRequest('get-journal-stream', { method: 'GET' });
  }

  // Brain API
  async sendBrainInput(sessionId: string, input: string) {
    return this.makeRequest('send-brain-input', {
      method: 'POST',
      pathParams: { session_id: sessionId },
      body: { input }
    });
  }

  // Intent API
  async dispatchIntent(intentText: string) {
    return this.makeRequest('dispatch-intent', {
      method: 'POST',
      body: { intent_text: intentText }
    });
  }

  // Action API
  async dispatchAction(payload: {
    action_id: string;
    capsule_id: string;
    view_id: string;
    context: any;
  }) {
    return this.makeRequest('dispatch-action', {
      method: 'POST',
      body: payload
    });
  }

  // Get recent request logs for forensics
  getRequestLogs() {
    return [...REQUEST_LOG];
  }
}

export default new GatewayClient();