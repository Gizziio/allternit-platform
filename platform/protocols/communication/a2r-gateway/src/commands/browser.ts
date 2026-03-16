/**
 * Gateway Browser Commands
 * Ported from OpenClaw gateway tool implementations
 *
 * Commands:
 * - browser.proxy    : Proxy request to browser server
 * - browser.status   : Get browser status
 * - browser.start    : Start browser
 * - browser.stop     : Stop browser
 */

export interface NodeInvokeResponse {
  payload?: unknown;
  error?: string;
}

export interface BrowserProxyParams {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  profile?: string;
}

export interface BrowserCommandContext {
  getBrowserUrl: () => string | null;
  fetch: (url: string, options: RequestInit) => Promise<Response>;
}

export function createBrowserCommands(ctx: BrowserCommandContext) {
  return {
    // Proxy request to browser control server
    async proxy(params: BrowserProxyParams): Promise<NodeInvokeResponse> {
      const browserUrl = ctx.getBrowserUrl();
      if (!browserUrl) {
        return { error: 'Browser control server not available' };
      }

      try {
        const url = new URL(params.path, browserUrl);
        
        // Add query params
        if (params.query) {
          Object.entries(params.query).forEach(([key, value]) => {
            url.searchParams.set(key, value);
          });
        }
        
        // Add profile to query if specified
        if (params.profile) {
          url.searchParams.set('profile', params.profile);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), params.timeoutMs || 20000);

        const response = await ctx.fetch(url.toString(), {
          method: params.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: params.body ? JSON.stringify(params.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const error = await response.text();
          return { error: `Browser proxy error: ${error}` };
        }

        const result = await response.json();
        return { payload: result };
      } catch (error) {
        return { error: String(error) };
      }
    },

    // Get browser status
    async status(profile?: string): Promise<NodeInvokeResponse> {
      return this.proxy({
        method: 'GET',
        path: '/',
        profile,
      });
    },

    // Start browser
    async start(profile?: string): Promise<NodeInvokeResponse> {
      return this.proxy({
        method: 'POST',
        path: '/start',
        profile,
      });
    },

    // Stop browser
    async stop(profile?: string): Promise<NodeInvokeResponse> {
      return this.proxy({
        method: 'POST',
        path: '/stop',
        profile,
      });
    },
  };
}

// Command registry for Gateway
export const BROWSER_COMMANDS = {
  'browser.proxy': {
    description: 'Proxy request to browser control server',
    parameters: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], required: true },
      path: { type: 'string', required: true },
      query: { type: 'object', optional: true },
      body: { type: 'any', optional: true },
      timeoutMs: { type: 'number', optional: true },
      profile: { type: 'string', optional: true },
    },
  },
  'browser.status': {
    description: 'Get browser status',
    parameters: {
      profile: { type: 'string', optional: true },
    },
  },
  'browser.start': {
    description: 'Start browser',
    parameters: {
      profile: { type: 'string', optional: true },
    },
  },
  'browser.stop': {
    description: 'Stop browser',
    parameters: {
      profile: { type: 'string', optional: true },
    },
  },
  'browser.recording.start': {
    description: 'Start browser session recording (GIF/video)',
    parameters: {
      profile: { type: 'string', optional: true },
      targetId: { type: 'string', optional: true, description: 'Tab target ID' },
      format: { type: 'string', enum: ['gif', 'webm', 'mp4'], optional: true, default: 'gif' },
      fps: { type: 'number', optional: true, default: 10 },
      quality: { type: 'number', optional: true, default: 80 },
      maxDurationSecs: { type: 'number', optional: true },
    },
  },
  'browser.recording.stop': {
    description: 'Stop browser session recording and save',
    parameters: {
      profile: { type: 'string', optional: true },
      recordingId: { type: 'string', required: true },
      save: { type: 'boolean', optional: true, default: true },
    },
  },
  'browser.recording.status': {
    description: 'Get recording status',
    parameters: {
      profile: { type: 'string', optional: true },
      recordingId: { type: 'string', required: true },
    },
  },
};
