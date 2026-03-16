import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DrawerTabId } from '../views/code/ConsoleDrawer/DrawerTabs';

interface DrawerState {
  drawers: {
    console: { open: boolean; height: number; activeTab: DrawerTabId };
  };
  openDrawer: (id: 'console', options?: { tab?: DrawerTabId; minHeight?: number }) => void;
  closeDrawer: (id: 'console') => void;
  setConsoleHeight: (height: number) => void;
  setConsoleTab: (tab: DrawerTabId) => void;
}

export const useDrawerStore = create<DrawerState>()(
  persist(
    (set) => ({
      drawers: {
        console: { open: false, height: 300, activeTab: 'queue' },
      },
      openDrawer: (id, options) => set((state) => ({
        drawers: {
          ...state.drawers,
          [id]: {
            ...state.drawers[id as keyof typeof state.drawers],
            open: true,
            height: Math.max(
              state.drawers.console.height,
              options?.minHeight ?? state.drawers.console.height,
            ),
            activeTab: options?.tab ?? state.drawers.console.activeTab,
          },
        },
      })),
      closeDrawer: (id) => set((state) => ({
        drawers: { ...state.drawers, [id]: { ...state.drawers[id as keyof typeof state.drawers], open: false } }
      })),
      setConsoleHeight: (height) => set((state) => ({
        drawers: { ...state.drawers, console: { ...state.drawers.console, height } }
      })),
      setConsoleTab: (tab) => set((state) => ({
        drawers: { ...state.drawers, console: { ...state.drawers.console, activeTab: tab } }
      })),
    }),
    { name: 'a2r-drawer-storage' }
  )
);
