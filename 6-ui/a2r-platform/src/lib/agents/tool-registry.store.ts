/**
 * Tool Registry Store
 * 
 * Manages tool registration, enabling/disabling, and session-specific tool configurations.
 * Integrates with the kernel tool registry via Gateway API.
 * NO localStorage fallbacks - all operations go through the API.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Tool } from "./native-agent.store";
import { GATEWAY_BASE_URL } from "@/integration/api-client";

// ============================================================================
// Types
// ============================================================================

export interface ToolRegistryEntry extends Tool {
  isRegistered: boolean;
  registeredAt?: string;
  registeredBy?: string;
  version?: string;
  source: "native" | "mcp" | "custom" | "kernel";
  requiresConfirmation: boolean;
  allowedSessions: string[]; // Empty = all sessions
  category: ToolCategory;
  tags: string[];
}

export type ToolCategory =
  | "file-system"
  | "web"
  | "database"
  | "api"
  | "ai"
  | "system"
  | "custom"
  | "user";

export interface SessionToolConfig {
  sessionId: string;
  enabledTools: string[]; // Tool IDs
  toolOverrides: Record<string, Partial<ToolRegistryEntry>>;
  requireConfirmationFor: string[]; // Tool IDs that need confirmation
}

export interface ToolRegistryState {
  // Registry
  tools: Record<string, ToolRegistryEntry>; // keyed by tool ID
  sessionConfigs: Record<string, SessionToolConfig>; // keyed by sessionId
  
  // UI State
  isLoading: boolean;
  isRegistering: boolean;
  error: string | null;
  selectedToolId: string | null;
  filterCategory: ToolCategory | null;
  searchQuery: string;
}

export interface ToolRegistryActions {
  // Tool Registration
  registerTool: (tool: Omit<ToolRegistryEntry, "isRegistered" | "registeredAt">) => Promise<void>;
  unregisterTool: (toolId: string) => Promise<void>;
  fetchKernelTools: () => Promise<void>;
  
  // Tool State Management
  toggleTool: (toolId: string, enabled: boolean) => void;
  toggleToolForSession: (toolId: string, sessionId: string, enabled: boolean) => void;
  setToolRequiresConfirmation: (toolId: string, requires: boolean) => void;
  setSessionToolRequiresConfirmation: (toolId: string, sessionId: string, requires: boolean) => void;
  
  // Bulk Operations
  enableAllTools: (sessionId?: string) => void;
  disableAllTools: (sessionId?: string) => void;
  enableToolsByCategory: (category: ToolCategory, sessionId?: string) => void;
  
  // Session Config
  getSessionTools: (sessionId: string) => ToolRegistryEntry[];
  getEnabledToolsForSession: (sessionId: string) => ToolRegistryEntry[];
  cloneSessionConfig: (fromSessionId: string, toSessionId: string) => void;
  
  // Filtering
  setFilterCategory: (category: ToolCategory | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedToolId: (toolId: string | null) => void;
  
  // UI
  clearError: () => void;
}

interface BackendTool {
  id: string;
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  source?: "native" | "mcp" | "custom" | "kernel";
  category?: ToolCategory;
  tags?: string[];
  requiresConfirmation?: boolean;
}

interface ToolsApiResponse {
  native?: BackendTool[];
  mcp?: BackendTool[];
  custom?: BackendTool[];
}

// ============================================================================
// API Client
// ============================================================================

const TOOLS_API_BASE = `${GATEWAY_BASE_URL}/api/v1/tools`;

/**
 * Fetch tools from the Gateway API
 */
async function fetchToolsFromApi(): Promise<ToolsApiResponse> {
  const response = await fetch(`${TOOLS_API_BASE}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tools: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Register a tool with the kernel via Gateway API
 */
async function registerToolWithApi(
  tool: Omit<ToolRegistryEntry, "isRegistered" | "registeredAt">
): Promise<void> {
  const response = await fetch(`${TOOLS_API_BASE}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      source: tool.source,
      category: tool.category,
      tags: tool.tags,
      requiresConfirmation: tool.requiresConfirmation,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to register tool: ${response.statusText}`);
  }
}

/**
 * Unregister a tool from the kernel via Gateway API
 */
async function unregisterToolFromApi(toolId: string): Promise<void> {
  const response = await fetch(`${TOOLS_API_BASE}/unregister`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ toolId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to unregister tool: ${response.statusText}`);
  }
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ToolRegistryState = {
  tools: {},
  sessionConfigs: {},
  isLoading: false,
  isRegistering: false,
  error: null,
  selectedToolId: null,
  filterCategory: null,
  searchQuery: "",
};

// ============================================================================
// Store
// ============================================================================

export const useToolRegistryStore = create<ToolRegistryState & ToolRegistryActions>()(
  immer((set, get) => ({
    ...initialState,

    // -------------------------------------------------------------------------
    // Tool Registration
    // -------------------------------------------------------------------------

    registerTool: async (tool) => {
      set((state) => {
        state.isRegistering = true;
        state.error = null;
      });

      try {
        // Register with the kernel API
        await registerToolWithApi(tool);

        set((state) => {
          state.tools[tool.id] = {
            ...tool,
            isRegistered: true,
            registeredAt: new Date().toISOString(),
          };
          state.isRegistering = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to register tool";
          state.isRegistering = false;
        });
        throw error;
      }
    },

    unregisterTool: async (toolId) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // Unregister from the kernel API
        await unregisterToolFromApi(toolId);

        set((state) => {
          delete state.tools[toolId];
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to unregister tool";
          state.isLoading = false;
        });
        throw error;
      }
    },

    fetchKernelTools: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // Fetch from the kernel API
        const response = await fetchToolsFromApi();
        
        const backendTools: BackendTool[] = [
          ...(response.native || []),
          ...(response.mcp || []),
          ...(response.custom || []),
        ];

        set((state) => {
          backendTools.forEach((tool) => {
            if (!state.tools[tool.id]) {
              state.tools[tool.id] = {
                id: tool.id,
                name: tool.name,
                description: tool.description || "",
                parameters: tool.parameters || {},
                isEnabled: true,
                isRegistered: true,
                source: tool.source || "kernel",
                requiresConfirmation: tool.requiresConfirmation || false,
                allowedSessions: [],
                category: tool.category || "custom",
                tags: tool.tags || [],
                registeredAt: new Date().toISOString(),
              };
            }
          });
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to fetch tools";
          state.isLoading = false;
        });
        throw error;
      }
    },

    // -------------------------------------------------------------------------
    // Tool State Management
    // -------------------------------------------------------------------------

    toggleTool: (toolId, enabled) => {
      set((state) => {
        if (state.tools[toolId]) {
          state.tools[toolId].isEnabled = enabled;
        }
      });
    },

    toggleToolForSession: (toolId, sessionId, enabled) => {
      set((state) => {
        if (!state.sessionConfigs[sessionId]) {
          state.sessionConfigs[sessionId] = {
            sessionId,
            enabledTools: [],
            toolOverrides: {},
            requireConfirmationFor: [],
          };
        }

        const config = state.sessionConfigs[sessionId];
        if (enabled) {
          if (!config.enabledTools.includes(toolId)) {
            config.enabledTools.push(toolId);
          }
        } else {
          config.enabledTools = config.enabledTools.filter((id) => id !== toolId);
        }
      });
    },

    setToolRequiresConfirmation: (toolId, requires) => {
      set((state) => {
        if (state.tools[toolId]) {
          state.tools[toolId].requiresConfirmation = requires;
        }
      });
    },

    setSessionToolRequiresConfirmation: (toolId, sessionId, requires) => {
      set((state) => {
        if (!state.sessionConfigs[sessionId]) {
          state.sessionConfigs[sessionId] = {
            sessionId,
            enabledTools: [],
            toolOverrides: {},
            requireConfirmationFor: [],
          };
        }

        const config = state.sessionConfigs[sessionId];
        if (requires) {
          if (!config.requireConfirmationFor.includes(toolId)) {
            config.requireConfirmationFor.push(toolId);
          }
        } else {
          config.requireConfirmationFor = config.requireConfirmationFor.filter(
            (id) => id !== toolId
          );
        }
      });
    },

    // -------------------------------------------------------------------------
    // Bulk Operations
    // -------------------------------------------------------------------------

    enableAllTools: (sessionId) => {
      set((state) => {
        if (sessionId) {
          if (!state.sessionConfigs[sessionId]) {
            state.sessionConfigs[sessionId] = {
              sessionId,
              enabledTools: [],
              toolOverrides: {},
              requireConfirmationFor: [],
            };
          }
          state.sessionConfigs[sessionId].enabledTools = Object.keys(state.tools);
        } else {
          Object.values(state.tools).forEach((tool) => {
            tool.isEnabled = true;
          });
        }
      });
    },

    disableAllTools: (sessionId) => {
      set((state) => {
        if (sessionId) {
          if (!state.sessionConfigs[sessionId]) {
            state.sessionConfigs[sessionId] = {
              sessionId,
              enabledTools: [],
              toolOverrides: {},
              requireConfirmationFor: [],
            };
          }
          state.sessionConfigs[sessionId].enabledTools = [];
        } else {
          Object.values(state.tools).forEach((tool) => {
            tool.isEnabled = false;
          });
        }
      });
    },

    enableToolsByCategory: (category, sessionId) => {
      set((state) => {
        const toolsInCategory = Object.values(state.tools)
          .filter((t) => t.category === category)
          .map((t) => t.id);

        if (sessionId) {
          if (!state.sessionConfigs[sessionId]) {
            state.sessionConfigs[sessionId] = {
              sessionId,
              enabledTools: [],
              toolOverrides: {},
              requireConfirmationFor: [],
            };
          }
          state.sessionConfigs[sessionId].enabledTools = [
            ...new Set([...state.sessionConfigs[sessionId].enabledTools, ...toolsInCategory]),
          ];
        } else {
          toolsInCategory.forEach((toolId) => {
            if (state.tools[toolId]) {
              state.tools[toolId].isEnabled = true;
            }
          });
        }
      });
    },

    // -------------------------------------------------------------------------
    // Session Config
    // -------------------------------------------------------------------------

    getSessionTools: (sessionId) => {
      const state = get();
      const config = state.sessionConfigs[sessionId];
      
      if (!config) {
        return Object.values(state.tools);
      }

      return Object.values(state.tools).map((tool) => ({
        ...tool,
        ...config.toolOverrides[tool.id],
        isEnabled: config.enabledTools.includes(tool.id),
        requiresConfirmation: config.requireConfirmationFor.includes(tool.id),
      }));
    },

    getEnabledToolsForSession: (sessionId) => {
      const state = get();
      const config = state.sessionConfigs[sessionId];
      
      if (!config) {
        return Object.values(state.tools).filter((t) => t.isEnabled);
      }

      return Object.values(state.tools).filter((tool) =>
        config.enabledTools.includes(tool.id)
      );
    },

    cloneSessionConfig: (fromSessionId, toSessionId) => {
      set((state) => {
        const fromConfig = state.sessionConfigs[fromSessionId];
        if (fromConfig) {
          state.sessionConfigs[toSessionId] = {
            ...fromConfig,
            sessionId: toSessionId,
          };
        }
      });
    },

    // -------------------------------------------------------------------------
    // Filtering
    // -------------------------------------------------------------------------

    setFilterCategory: (category) => {
      set((state) => {
        state.filterCategory = category;
      });
    },

    setSearchQuery: (query) => {
      set((state) => {
        state.searchQuery = query;
      });
    },

    setSelectedToolId: (toolId) => {
      set((state) => {
        state.selectedToolId = toolId;
      });
    },

    // -------------------------------------------------------------------------
    // UI
    // -------------------------------------------------------------------------

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export function useToolsByCategory(category: ToolCategory | null) {
  return useToolRegistryStore((state) => {
    const tools = Object.values(state.tools);
    if (!category) return tools;
    return tools.filter((t) => t.category === category);
  });
}

export function useFilteredTools() {
  return useToolRegistryStore((state) => {
    const tools = Object.values(state.tools);
    const { filterCategory, searchQuery } = state;

    return tools.filter((tool) => {
      if (filterCategory && tool.category !== filterCategory) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          tool.name.toLowerCase().includes(query) ||
          tool.description?.toLowerCase().includes(query) ||
          tool.tags.some((t) => t.toLowerCase().includes(query))
        );
      }
      return true;
    });
  });
}

export function useEnabledToolCount() {
  return useToolRegistryStore((state) => {
    return Object.values(state.tools).filter((t) => t.isEnabled).length;
  });
}

export function useToolCategories() {
  return useToolRegistryStore((state) => {
    const categories = new Set<ToolCategory>();
    Object.values(state.tools).forEach((tool) => {
      categories.add(tool.category);
    });
    return Array.from(categories).sort();
  });
}
