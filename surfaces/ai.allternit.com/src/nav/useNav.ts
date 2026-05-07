import { create } from 'zustand';
import { navReducer, createInitialNavState } from './nav.store';
import { NavState, NavEvent } from './nav.types';

interface NavStore extends NavState {
  dispatch: (event: NavEvent) => void;
}

export const useNav = create<NavStore>((set) => ({
  ...createInitialNavState(),
  dispatch: (event: NavEvent) => set((state) => navReducer(state, event)),
}));
