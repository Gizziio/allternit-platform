/**
 * Cowork UI Store — Ephemeral UI state only
 *
 * No persistence. Memory-only state for UI chrome.
 * This prevents UI state from leaking into domain stores.
 */

import { create } from 'zustand';

export type CoworkTab = 'tasks' | 'agent-tasks' | 'runs' | 'artifacts' | 'audit';

interface CoworkUIState {
  // Layout
  showRightRail: boolean;
  rightRailWidth: number;
  sidebarOpen: boolean;

  // Tabs
  activeTab: CoworkTab;
  setActiveTab: (tab: CoworkTab) => void;

  // Viewport
  viewportZoom: number;
  setViewportZoom: (zoom: number) => void;
  showOcr: boolean;
  toggleOcr: () => void;
  showLabels: boolean;
  toggleLabels: () => void;

  // Timeline
  isTimelineExpanded: boolean;
  toggleTimeline: () => void;
  selectedEventId: string | null;
  selectEvent: (eventId: string | null) => void;

  // Modals
  showPermissionModal: boolean;
  setShowPermissionModal: (show: boolean) => void;
  showQuestionModal: boolean;
  setShowQuestionModal: (show: boolean) => void;

  // Rail panels
  activeRailPanel: 'progress' | 'files' | 'context' | 'stats' | null;
  setActiveRailPanel: (panel: CoworkUIState['activeRailPanel']) => void;
}

export const useCoworkUIStore = create<CoworkUIState>((set) => ({
  showRightRail: true,
  rightRailWidth: 320,
  sidebarOpen: true,

  activeTab: 'tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),

  viewportZoom: 1,
  setViewportZoom: (zoom) => set({ viewportZoom: zoom }),
  showOcr: false,
  toggleOcr: () => set((s) => ({ showOcr: !s.showOcr })),
  showLabels: true,
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),

  isTimelineExpanded: true,
  toggleTimeline: () => set((s) => ({ isTimelineExpanded: !s.isTimelineExpanded })),
  selectedEventId: null,
  selectEvent: (eventId) => set({ selectedEventId: eventId }),

  showPermissionModal: false,
  setShowPermissionModal: (show) => set({ showPermissionModal: show }),
  showQuestionModal: false,
  setShowQuestionModal: (show) => set({ showQuestionModal: show }),

  activeRailPanel: 'progress',
  setActiveRailPanel: (panel) => set({ activeRailPanel: panel }),
}));
