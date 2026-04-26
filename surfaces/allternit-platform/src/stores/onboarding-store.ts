/**
 * Allternit Platform Onboarding Store
 * 
 * Manages first-time user onboarding state
 * - Tracks onboarding completion
 * - Stores user preferences from wizard
 * - Persists state to localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OnboardingPreferences {
  // API Configuration
  defaultProvider?: string;
  apiKeysConfigured?: boolean;
  
  // UI Preferences
  theme?: 'dark' | 'light' | 'system';
  sidebarCollapsed?: boolean;
  
  // Feature Flags
  enableNotifications?: boolean;
  enableTelemetry?: boolean;
  
  // Workspace Setup
  defaultWorkspacePath?: string;
  preferredModes?: string[];
}

interface OnboardingState {
  // Onboarding Status
  hasCompletedOnboarding: boolean;
  currentScreen: number; // 0 = welcome, 1 = features, 2 = wizard/complete
  showWizard: boolean;
  hasHydrated: boolean;
  
  // User Preferences
  preferences: OnboardingPreferences;
  
  // Actions
  setHasCompletedOnboarding: (completed: boolean) => void;
  setCurrentScreen: (screen: number) => void;
  setShowWizard: (show: boolean) => void;
  nextScreen: () => void;
  previousScreen: () => void;
  skipOnboarding: () => void;
  completeOnboarding: (preferences?: Partial<OnboardingPreferences>) => void;
  updatePreferences: (prefs: Partial<OnboardingPreferences>) => void;
  resetOnboarding: () => void;
}

const defaultPreferences: OnboardingPreferences = {
  theme: 'dark',
  sidebarCollapsed: false,
  enableNotifications: true,
  enableTelemetry: false,
  preferredModes: ['chat', 'cowork', 'code'],
};

let _setStoreState: ((state: Partial<OnboardingState>) => void) | null = null;

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => {
      _setStoreState = set;
      return ({
      // Initial State
      hasCompletedOnboarding: false,
      currentScreen: 0,
      showWizard: false,
      hasHydrated: false,
      preferences: { ...defaultPreferences },
      
      // Actions
      setHasCompletedOnboarding: (completed) => set({ 
        hasCompletedOnboarding: completed 
      }),
      
      setCurrentScreen: (screen) => set({ 
        currentScreen: Math.max(0, Math.min(2, screen)) 
      }),
      
      setShowWizard: (show) => set({ showWizard: show }),
      
      nextScreen: () => {
        const { currentScreen } = get();
        if (currentScreen < 2) {
          set({ currentScreen: currentScreen + 1 });
        }
      },
      
      previousScreen: () => {
        const { currentScreen } = get();
        if (currentScreen > 0) {
          set({ currentScreen: currentScreen - 1 });
        }
      },
      
      skipOnboarding: () => set({
        hasCompletedOnboarding: true,
        currentScreen: 0,
        showWizard: false,
      }),
      
      completeOnboarding: (prefs) => set({
        hasCompletedOnboarding: true,
        currentScreen: 0,
        showWizard: false,
        preferences: {
          ...get().preferences,
          ...prefs,
        },
      }),
      
      updatePreferences: (prefs) => set({
        preferences: {
          ...get().preferences,
          ...prefs,
        },
      }),
      
      resetOnboarding: () => {
        // Clear localStorage to ensure fresh start
        if (typeof window !== 'undefined') {
          localStorage.removeItem('allternit-onboarding-storage');
        }
        set({
          hasCompletedOnboarding: false,
          currentScreen: 0,
          showWizard: false,
          preferences: { ...defaultPreferences },
        });
      },
      });
    },
    {
      name: 'allternit-onboarding-storage',
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        preferences: state.preferences,
      }),
      onRehydrateStorage: () => (state, error) => {
        // Always mark as hydrated, even if localStorage was empty (state is undefined).
        // Use the captured set function instead of useOnboardingStore because
        // onRehydrateStorage can fire before the const assignment completes (TDZ).
        _setStoreState?.({ hasHydrated: true });
      },
    }
  )
);

// Selector hooks for better performance
export const useHasCompletedOnboarding = () => 
  useOnboardingStore((state) => state.hasCompletedOnboarding);

export const useOnboardingScreen = () => 
  useOnboardingStore((state) => state.currentScreen);

export const useShowWizard = () => 
  useOnboardingStore((state) => state.showWizard);

export const useOnboardingPreferences = () => 
  useOnboardingStore((state) => state.preferences);
