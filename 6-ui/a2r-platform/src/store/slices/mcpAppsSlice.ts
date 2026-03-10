/**
 * MCP Apps Redux Slice
 * 
 * State management for interactive capsules.
 * Handles capsule lifecycle, events, and UI state.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// ============================================================================
// Types
// ============================================================================

export interface Capsule {
  id: string;
  capsule_type: string;
  state: 'pending' | 'active' | 'error' | 'closed';
  tool_id: string;
  agent_id?: string;
  session_id?: string;
  surface: {
    html: string;
    css?: string;
    js?: string;
    props?: Record<string, unknown>;
    permissions: CapsulePermission[];
  };
  created_at: string;
  updated_at: string;
}

export interface CapsulePermission {
  permission_type: string;
  resource: string;
  actions?: string[];
  conditions?: Record<string, unknown>;
}

export interface CapsuleEvent {
  id: string;
  capsule_id: string;
  event_type: string;
  direction: 'to_tool' | 'to_ui';
  payload: unknown;
  timestamp: string;
  source: string;
}

export interface McpAppsState {
  capsules: Record<string, Capsule>;
  activeCapsuleId: string | null;
  events: Record<string, CapsuleEvent[]>;
  loading: boolean;
  error: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: McpAppsState = {
  capsules: {},
  activeCapsuleId: null,
  events: {},
  loading: false,
  error: null,
  connectionStatus: 'disconnected',
};

// ============================================================================
// Async Thunks
// ============================================================================

const API_BASE = '/api/v1/mcp-apps';

export const fetchCapsules = createAsyncThunk(
  'mcpApps/fetchCapsules',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE}/capsules`);
      if (!response.ok) throw new Error('Failed to fetch capsules');
      const data: unknown = await response.json();
      // Validate that response is an array of Capsule objects
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format: expected array');
      }
      return data as Capsule[];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const fetchCapsule = createAsyncThunk(
  'mcpApps/fetchCapsule',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE}/capsules/${id}`);
      if (!response.ok) throw new Error('Failed to fetch capsule');
      const data: unknown = await response.json();
      return data as Capsule;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export interface CreateCapsuleRequest {
  capsule_type: string;
  tool_id: string;
  surface: Capsule['surface'];
  agent_id?: string;
  session_id?: string;
}

export const createCapsule = createAsyncThunk(
  'mcpApps/createCapsule',
  async (request: CreateCapsuleRequest, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE}/capsules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error('Failed to create capsule');
      const data: unknown = await response.json();
      return data as Capsule;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const deleteCapsule = createAsyncThunk(
  'mcpApps/deleteCapsule',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE}/capsules/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete capsule');
      return id;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const updateCapsuleState = createAsyncThunk(
  'mcpApps/updateCapsuleState',
  async ({ id, state }: { id: string; state: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE}/capsules/${id}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      if (!response.ok) throw new Error('Failed to update capsule state');
      const data: unknown = await response.json();
      return data as Capsule;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const sendCapsuleEvent = createAsyncThunk(
  'mcpApps/sendCapsuleEvent',
  async (
    { id, event_type, payload }: { id: string; event_type: string; payload?: unknown },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`${API_BASE}/capsules/${id}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type, payload }),
      });
      if (!response.ok) throw new Error('Failed to send event');
      return { capsuleId: id, event_type, payload };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

// ============================================================================
// Slice
// ============================================================================

const mcpAppsSlice = createSlice({
  name: 'mcpApps',
  initialState,
  reducers: {
    // Set active capsule
    setActiveCapsule: (state, action: PayloadAction<string | null>) => {
      state.activeCapsuleId = action.payload;
    },

    // Add/update capsule
    upsertCapsule: (state, action: PayloadAction<Capsule>) => {
      const capsule = action.payload;
      state.capsules[capsule.id] = capsule;
    },

    // Remove capsule
    removeCapsule: (state, action: PayloadAction<string>) => {
      delete state.capsules[action.payload];
      delete state.events[action.payload];
      if (state.activeCapsuleId === action.payload) {
        state.activeCapsuleId = null;
      }
    },

    // Add event to capsule history
    addEvent: (state, action: PayloadAction<CapsuleEvent>) => {
      const event = action.payload;
      if (!state.events[event.capsule_id]) {
        state.events[event.capsule_id] = [];
      }
      state.events[event.capsule_id].push(event);
      // Keep last 1000 events
      if (state.events[event.capsule_id].length > 1000) {
        state.events[event.capsule_id].shift();
      }
    },

    // Clear events for a capsule
    clearCapsuleEvents: (state, action: PayloadAction<string>) => {
      state.events[action.payload] = [];
    },

    // Update connection status
    setConnectionStatus: (
      state,
      action: PayloadAction<'disconnected' | 'connecting' | 'connected'>
    ) => {
      state.connectionStatus = action.payload;
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch capsules
    builder.addCase(fetchCapsules.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchCapsules.fulfilled, (state, action) => {
      state.loading = false;
      const capsuleRecord: Record<string, Capsule> = {};
      for (const capsule of action.payload) {
        capsuleRecord[capsule.id] = capsule;
      }
      state.capsules = capsuleRecord;
    });
    builder.addCase(fetchCapsules.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === 'string' ? action.payload : 'Unknown error';
    });

    // Fetch single capsule
    builder.addCase(fetchCapsule.fulfilled, (state, action) => {
      state.capsules[action.payload.id] = action.payload;
    });

    // Create capsule
    builder.addCase(createCapsule.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createCapsule.fulfilled, (state, action) => {
      state.loading = false;
      state.capsules[action.payload.id] = action.payload;
      state.activeCapsuleId = action.payload.id;
    });
    builder.addCase(createCapsule.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === 'string' ? action.payload : 'Unknown error';
    });

    // Delete capsule
    builder.addCase(deleteCapsule.fulfilled, (state, action) => {
      delete state.capsules[action.payload];
      delete state.events[action.payload];
      if (state.activeCapsuleId === action.payload) {
        state.activeCapsuleId = null;
      }
    });

    // Update capsule state
    builder.addCase(updateCapsuleState.fulfilled, (state, action) => {
      state.capsules[action.payload.id] = action.payload;
    });

    // Send event
    builder.addCase(sendCapsuleEvent.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(sendCapsuleEvent.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(sendCapsuleEvent.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === 'string' ? action.payload : 'Unknown error';
    });
  },
});

// ============================================================================
// Exports
// ============================================================================

export const {
  setActiveCapsule,
  upsertCapsule,
  removeCapsule,
  addEvent,
  clearCapsuleEvents,
  setConnectionStatus,
  clearError,
} = mcpAppsSlice.actions;

// Selectors
export const selectCapsules = (state: { mcpApps: McpAppsState }) =>
  Object.values(state.mcpApps.capsules);

export const selectCapsuleById = (state: { mcpApps: McpAppsState }, id: string) =>
  state.mcpApps.capsules[id];

export const selectActiveCapsule = (state: { mcpApps: McpAppsState }) =>
  state.mcpApps.activeCapsuleId
    ? state.mcpApps.capsules[state.mcpApps.activeCapsuleId]
    : null;

export const selectCapsuleEvents = (state: { mcpApps: McpAppsState }, id: string) =>
  state.mcpApps.events[id] || [];

export const selectMcpAppsLoading = (state: { mcpApps: McpAppsState }) =>
  state.mcpApps.loading;

export const selectMcpAppsError = (state: { mcpApps: McpAppsState }) =>
  state.mcpApps.error;

export const selectConnectionStatus = (state: { mcpApps: McpAppsState }) =>
  state.mcpApps.connectionStatus;

export default mcpAppsSlice.reducer;
