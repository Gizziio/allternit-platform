/**
 * In-page bridge for site tools.
 *
 * The bridge source is injected into pages (Playwright addInitScript or
 * evaluate) and installs `window.__allternitSiteTools` with WebMCP-shaped
 * listTools/invokeTool methods. It does NOT depend on native WebMCP support:
 * `navigator.modelContext` is probed as an optional capability only — its
 * presence or absence is logged, never required.
 */

export interface SiteToolsBridgeTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const SITE_TOOLS_BRIDGE_SOURCE = String.raw`
(() => {
  if (window.__allternitSiteTools) return;
  const state = {
    tools: [] ,
    modelContextAvailable: false,
  };
  const probeModelContext = () => {
    try {
      state.modelContextAvailable = typeof navigator.modelContext !== 'undefined' && navigator.modelContext !== null;
    } catch {
      state.modelContextAvailable = false;
    }
    if (state.modelContextAvailable) {
      console.info('[allternit-site-tools] navigator.modelContext is available (native WebMCP surface detected; optional capability)');
    } else {
      console.info('[allternit-site-tools] navigator.modelContext not present; operating without native WebMCP');
    }
  };
  probeModelContext();
  window.__allternitSiteTools = {
    version: '1.0',
    registerTools(tools) {
      if (!Array.isArray(tools)) throw new Error('registerTools expects an array of { name, description, inputSchema }');
      const names = new Set(state.tools.map((tool) => tool.name));
      for (const tool of tools) {
        if (!tool || typeof tool.name !== 'string' || typeof tool.description !== 'string') {
          throw new Error('Each tool requires name and description');
        }
        if (names.has(tool.name)) continue;
        names.add(tool.name);
        state.tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema || { type: 'object', properties: {} },
        });
      }
      return state.tools.map((tool) => tool.name);
    },
    listTools() {
      return state.tools.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } }));
    },
    invokeTool(name, args) {
      const tool = state.tools.find((candidate) => candidate.name === name);
      if (!tool) {
        return Promise.reject(new Error('Unknown site tool: ' + name));
      }
      // In-page dispatch: handlers are page-provided (e.g. by the site itself
      // via WebMCP). Node-side handlers are driven through the run controller.
      const dispatcher = window.__allternitSiteTools.__handlers && window.__allternitSiteTools.__handlers[name];
      if (typeof dispatcher !== 'function') {
        return Promise.reject(new Error('No in-page handler registered for tool: ' + name));
      }
      return Promise.resolve(dispatcher(args || {}));
    },
    modelContextAvailable() {
      return state.modelContextAvailable;
    },
  };
})();
`;

/** Evaluate-only probe: reports whether the page already exposes a native WebMCP surface. */
export const MODEL_CONTEXT_PROBE_SOURCE = String.raw`
(() => {
  try {
    return typeof navigator.modelContext !== 'undefined' && navigator.modelContext !== null;
  } catch {
    return false;
  }
})()
`;
