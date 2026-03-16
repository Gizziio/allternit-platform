import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, DeveloperProfile } from '../types';

interface AuthStore extends AuthState {
  login: (token: string, user: DeveloperProfile) => void;
  logout: () => void;
  updateUser: (user: Partial<DeveloperProfile>) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,

      login: (token: string, user: DeveloperProfile) => {
        set({ isAuthenticated: true, token, user, isLoading: false });
      },

      logout: () => {
        set({ isAuthenticated: false, token: null, user: null, isLoading: false });
      },

      updateUser: (userUpdate: Partial<DeveloperProfile>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdate } : null,
        }));
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },
    }),
    {
      name: 'a2r-auth-storage',
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated, 
        token: state.token,
        user: state.user 
      }),
    }
  )
);
