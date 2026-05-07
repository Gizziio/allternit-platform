import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export function createBrowserJSONStorage() {
  return createJSONStorage(() =>
    typeof window !== 'undefined' ? window.localStorage : noopStorage,
  );
}
