/**
 * Shared bridge between the Sketch canvas (tldraw selection) and
 * the Handoff tab (CSS inspect panel).
 *
 * When the user selects a shape in the canvas, the canvas writes the
 * equivalent PenpotShape here. The Handoff view reads it and runs
 * inspectShape() to show live CSS.
 */

import { create } from 'zustand';
import type { PenpotShape } from '@/lib/penpot/schema';

interface DesignInspectState {
  /** The currently selected shape, in Penpot schema form. Null = nothing selected. */
  selectedShape: PenpotShape | null;
  setSelectedShape: (shape: PenpotShape | null) => void;
  clearSelection: () => void;
}

export const useDesignInspectStore = create<DesignInspectState>((set) => ({
  selectedShape: null,
  setSelectedShape: (shape) => set({ selectedShape: shape }),
  clearSelection: () => set({ selectedShape: null }),
}));
