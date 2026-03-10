/**
 * Avatar Creator Store
 * 
 * Zustand store for managing avatar creation wizard state.
 * Handles configuration history, validation, templates, and draft persistence.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { 
  AvatarConfig, 
  AvatarBodyShape, 
  EyePreset, 
  PupilStyle, 
  BlinkRate,
  AntennaStyle,
  AntennaAnimation,
  AvatarEmotion,
  AgentSetup
} from '../lib/agents/character.types';
import { 
  DEFAULT_AVATAR_CONFIG, 
  createDefaultAvatarConfig 
} from '../lib/agents/character.types';
import { validateAvatarConfig, cloneAvatarConfig } from '../lib/agents/avatar-validation';

// ============================================================================
// Types
// ============================================================================

export type CreatorTab = 'body' | 'eyes' | 'colors' | 'antennas' | 'accessories' | 'personality';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ConfigHistoryEntry {
  config: AvatarConfig;
  timestamp: number;
  action: string;
}

export interface AvatarTemplate {
  id: string;
  name: string;
  description: string;
  setup: AgentSetup;
  preview: string; // Emoji or icon identifier
  config: AvatarConfig;
}

export interface AvatarCreatorState {
  // Current configuration
  currentConfig: AvatarConfig;
  
  // UI State
  activeTab: CreatorTab;
  previewEmotion: AvatarEmotion;
  previewSize: number;
  isPreviewAnimating: boolean;
  showGrid: boolean;
  
  // History for undo/redo
  history: ConfigHistoryEntry[];
  historyIndex: number;
  maxHistorySize: number;
  
  // Validation
  validationErrors: ValidationError[];
  isValid: boolean;
  
  // Template selection
  selectedTemplateId: string | null;
  
  // Agent context (for smart defaults)
  agentSetup: AgentSetup | null;
  agentTemperament: "precision" | "exploratory" | "systemic" | "balanced" | null;
}

export interface AvatarCreatorActions {
  // Configuration updates
  setConfig: (config: AvatarConfig) => void;
  updateConfig: (updates: Partial<AvatarConfig>) => void;
  resetConfig: () => void;
  
  // Body updates
  setBaseShape: (shape: AvatarBodyShape) => void;
  setBodySize: (size: number) => void;
  
  // Eye updates
  setEyePreset: (preset: EyePreset) => void;
  setEyeSize: (size: number) => void;
  setEyeColor: (color: string) => void;
  setPupilStyle: (style: PupilStyle) => void;
  setBlinkRate: (rate: BlinkRate) => void;
  
  // Antenna updates
  setAntennaCount: (count: 0 | 1 | 2 | 3) => void;
  setAntennaStyle: (style: AntennaStyle) => void;
  setAntennaAnimation: (animation: AntennaAnimation) => void;
  setAntennaTip: (tip: "none" | "ball" | "glow" | "star" | "diamond") => void;
  
  // Color updates
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  setGlowColor: (color: string) => void;
  setOutlineColor: (color: string) => void;
  setColorScheme: (colors: AvatarConfig['colors']) => void;
  randomizeColors: () => void;
  
  // Personality updates
  setBounce: (bounce: number) => void;
  setSway: (sway: number) => void;
  setBreathing: (breathing: boolean) => void;
  
  // Emotion updates
  setCurrentEmotion: (emotion: AvatarEmotion) => void;
  setPreviewEmotion: (emotion: AvatarEmotion) => void;
  
  // Accessory updates
  addAccessory: (accessoryId: string) => void;
  removeAccessory: (accessoryId: string) => void;
  toggleAccessory: (accessoryId: string) => void;
  
  // UI State updates
  setActiveTab: (tab: CreatorTab) => void;
  setPreviewSize: (size: number) => void;
  setPreviewAnimating: (animating: boolean) => void;
  toggleGrid: () => void;
  
  // Template actions
  applyTemplate: (template: AvatarTemplate) => void;
  selectTemplate: (templateId: string | null) => void;
  
  // History actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  
  // Validation
  validate: () => boolean;
  getValidationErrors: () => ValidationError[];
  
  // Context
  setAgentContext: (setup: AgentSetup, temperament: AvatarCreatorState['agentTemperament']) => void;
  applySmartDefaults: () => void;
  
  // Import/Export
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  
  // Randomization
  randomize: () => void;
  randomizeEyes: () => void;
  randomizeAntennas: () => void;
  
  // Internal
  _addToHistory: (config: AvatarConfig, action: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

export const AVATAR_TEMPLATES: AvatarTemplate[] = [
  {
    id: 'hacker',
    name: 'The Hacker',
    description: 'Sharp, focused, and ready to code',
    setup: 'coding',
    preview: '💻',
    config: createDefaultAvatarConfig('coding')
  },
  {
    id: 'architect',
    name: 'The Architect',
    description: 'Systematic builder of digital worlds',
    setup: 'coding',
    preview: '🏗️',
    config: {
      ...createDefaultAvatarConfig('coding'),
      baseShape: 'square',
      eyes: {
        preset: 'focused',
        size: 0.9,
        color: '#22D3EE',
        pupilStyle: 'ring',
        blinkRate: 'slow'
      }
    }
  },
  {
    id: 'artist',
    name: 'The Artist',
    description: 'Creative soul with boundless imagination',
    setup: 'creative',
    preview: '🎨',
    config: createDefaultAvatarConfig('creative')
  },
  {
    id: 'dreamer',
    name: 'The Dreamer',
    description: 'Imaginative and full of wonder',
    setup: 'creative',
    preview: '✨',
    config: {
      ...createDefaultAvatarConfig('creative'),
      eyes: {
        preset: 'starry',
        size: 1.2,
        color: '#FCD34D',
        pupilStyle: 'star',
        blinkRate: 'slow'
      },
      antennas: {
        count: 1,
        style: 'leaf',
        animation: 'sway',
        tipDecoration: 'glow'
      }
    }
  },
  {
    id: 'scholar',
    name: 'The Scholar',
    description: 'Wise, curious, and always learning',
    setup: 'research',
    preview: '📚',
    config: createDefaultAvatarConfig('research')
  },
  {
    id: 'explorer',
    name: 'The Explorer',
    description: 'Adventurous seeker of knowledge',
    setup: 'research',
    preview: '🔍',
    config: {
      ...createDefaultAvatarConfig('research'),
      eyes: {
        preset: 'curious',
        size: 1.1,
        color: '#1E40AF',
        pupilStyle: 'dot',
        blinkRate: 'normal'
      },
      personality: { bounce: 0.3, sway: 0.25, breathing: true }
    }
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    description: 'Protective and always vigilant',
    setup: 'operations',
    preview: '🛡️',
    config: createDefaultAvatarConfig('operations')
  },
  {
    id: 'commander',
    name: 'The Commander',
    description: 'Bold leader taking charge',
    setup: 'operations',
    preview: '⭐',
    config: {
      ...createDefaultAvatarConfig('operations'),
      baseShape: 'square',
      eyes: {
        preset: 'proud',
        size: 1.0,
        color: '#FCD34D',
        pupilStyle: 'dot',
        blinkRate: 'slow'
      },
      antennas: {
        count: 2,
        style: 'bolt',
        animation: 'pulse',
        tipDecoration: 'star'
      }
    }
  },
  {
    id: 'helper',
    name: 'The Helper',
    description: 'Friendly assistant ready to help',
    setup: 'generalist',
    preview: '🤝',
    config: createDefaultAvatarConfig('generalist')
  },
  {
    id: 'robot',
    name: 'The Robot',
    description: 'Efficient, logical, and precise',
    setup: 'generalist',
    preview: '🤖',
    config: {
      ...createDefaultAvatarConfig('generalist'),
      eyes: {
        preset: 'pixel',
        size: 0.8,
        color: '#22D3EE',
        pupilStyle: 'dot',
        blinkRate: 'never'
      },
      antennas: {
        count: 1,
        style: 'straight',
        animation: 'static',
        tipDecoration: 'ball'
      },
      personality: { bounce: 0.1, sway: 0, breathing: false }
    }
  }
];

// Color palettes for randomization
const COLOR_PALETTES = {
  coding: {
    primary: ['#1E293B', '#0F172A', '#1e3a5f', '#0c4a6e', '#164e63'],
    secondary: ['#22D3EE', '#06B6D4', '#0891B2', '#0EA5E9', '#38BDF8'],
    glow: ['#06B6D4', '#22D3EE', '#67E8F9', '#A5F3FC', '#CFFAFE'],
    outline: ['#0E7490', '#155E75', '#164E63', '#0C4A6E', '#075985']
  },
  creative: {
    primary: ['#8B5CF6', '#7C3AED', '#6D28D9', '#EC4899', '#DB2777'],
    secondary: ['#F472B6', '#F9A8D4', '#E879F9', '#F0ABFC', '#F5D0FE'],
    glow: ['#E879F9', '#F0ABFC', '#F5D0FE', '#FAE8FF', '#FDF4FF'],
    outline: ['#7C3AED', '#6B21A8', '#86198F', '#9F1239', '#BE185D']
  },
  research: {
    primary: ['#F59E0B', '#D97706', '#B45309', '#1E40AF', '#1E3A8A'],
    secondary: ['#FCD34D', '#FDE68A', '#FEF3C7', '#60A5FA', '#93C5FD'],
    glow: ['#EAB308', '#FDE047', '#FEF08A', '#FEF9C3', '#FACC15'],
    outline: ['#B45309', '#92400E', '#78350F', '#1E3A8A', '#172554']
  },
  operations: {
    primary: ['#DC2626', '#B91C1C', '#991B1B', '#F97316', '#EA580C'],
    secondary: ['#FBBF24', '#FCD34D', '#FDE68A', '#FB923C', '#FDBA74'],
    glow: ['#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEF2F2'],
    outline: ['#991B1B', '#7F1D1D', '#9A3412', '#7C2D12', '#431407']
  },
  generalist: {
    primary: ['#14B8A6', '#0D9488', '#0F766E', '#22C55E', '#16A34A'],
    secondary: ['#34D399', '#6EE7B7', '#A7F3D0', '#4ADE80', '#86EFAC'],
    glow: ['#2DD4BF', '#5EEAD4', '#99F6E4', '#CCFBF1', '#F0FDFA'],
    outline: ['#0F766E', '#115E59', '#14532D', '#166534', '#064E3B']
  }
};

// ============================================================================
// Store Implementation
// ============================================================================

const createInitialState = (): AvatarCreatorState => ({
  currentConfig: cloneAvatarConfig(DEFAULT_AVATAR_CONFIG),
  activeTab: 'body',
  previewEmotion: 'steady',
  previewSize: 200,
  isPreviewAnimating: true,
  showGrid: false,
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  validationErrors: [],
  isValid: true,
  selectedTemplateId: null,
  agentSetup: null,
  agentTemperament: null
});

export const useAvatarCreatorStore = create<AvatarCreatorState & AvatarCreatorActions>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      // ============================================================================
      // Configuration Updates
      // ============================================================================
      
      setConfig: (config) => {
        const state = get();
        get()._addToHistory(config, 'Set config');
        set({ 
          currentConfig: config,
          validationErrors: [],
          isValid: true
        });
      },

      updateConfig: (updates) => {
        const state = get();
        const newConfig = { ...state.currentConfig, ...updates } as AvatarConfig;
        get()._addToHistory(newConfig, 'Update config');
        set({ currentConfig: newConfig });
        state.validate();
      },

      resetConfig: () => {
        const state = get();
        const defaultConfig = state.agentSetup 
          ? createDefaultAvatarConfig(state.agentSetup)
          : cloneAvatarConfig(DEFAULT_AVATAR_CONFIG);
        get()._addToHistory(defaultConfig, 'Reset config');
        set({ 
          currentConfig: defaultConfig,
          selectedTemplateId: null,
          validationErrors: [],
          isValid: true
        });
      },

      // ============================================================================
      // Body Updates
      // ============================================================================
      
      setBaseShape: (shape) => {
        const state = get();
        const newConfig = { ...state.currentConfig, baseShape: shape };
        get()._addToHistory(newConfig, `Change shape to ${shape}`);
        set({ currentConfig: newConfig });
      },

      setBodySize: (size) => {
        // Body size affects overall scale, stored in personality or we could add a new field
        // For now, we'll keep it simple and just log this would affect the SVG viewBox
        console.log('Body size adjustment:', size);
      },

      // ============================================================================
      // Eye Updates
      // ============================================================================
      
      setEyePreset: (preset) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          eyes: { ...state.currentConfig.eyes, preset }
        };
        get()._addToHistory(newConfig, `Change eye preset to ${preset}`);
        set({ currentConfig: newConfig });
      },

      setEyeSize: (size) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          eyes: { ...state.currentConfig.eyes, size }
        };
        get()._addToHistory(newConfig, `Change eye size to ${size}`);
        set({ currentConfig: newConfig });
      },

      setEyeColor: (color) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          eyes: { ...state.currentConfig.eyes, color }
        };
        get()._addToHistory(newConfig, 'Change eye color');
        set({ currentConfig: newConfig });
      },

      setPupilStyle: (style) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          eyes: { ...state.currentConfig.eyes, pupilStyle: style }
        };
        get()._addToHistory(newConfig, `Change pupil style to ${style}`);
        set({ currentConfig: newConfig });
      },

      setBlinkRate: (rate) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          eyes: { ...state.currentConfig.eyes, blinkRate: rate }
        };
        get()._addToHistory(newConfig, `Change blink rate to ${rate}`);
        set({ currentConfig: newConfig });
      },

      // ============================================================================
      // Antenna Updates
      // ============================================================================
      
      setAntennaCount: (count) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          antennas: { ...state.currentConfig.antennas, count }
        };
        get()._addToHistory(newConfig, `Change antenna count to ${count}`);
        set({ currentConfig: newConfig });
      },

      setAntennaStyle: (style) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          antennas: { ...state.currentConfig.antennas, style }
        };
        get()._addToHistory(newConfig, `Change antenna style to ${style}`);
        set({ currentConfig: newConfig });
      },

      setAntennaAnimation: (animation) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          antennas: { ...state.currentConfig.antennas, animation }
        };
        get()._addToHistory(newConfig, `Change antenna animation to ${animation}`);
        set({ currentConfig: newConfig });
      },

      setAntennaTip: (tip) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          antennas: { ...state.currentConfig.antennas, tipDecoration: tip }
        };
        get()._addToHistory(newConfig, `Change antenna tip to ${tip}`);
        set({ currentConfig: newConfig });
      },

      // ============================================================================
      // Color Updates
      // ============================================================================
      
      setPrimaryColor: (color) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          colors: { ...state.currentConfig.colors, primary: color }
        };
        get()._addToHistory(newConfig, 'Change primary color');
        set({ currentConfig: newConfig });
      },

      setSecondaryColor: (color) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          colors: { ...state.currentConfig.colors, secondary: color }
        };
        get()._addToHistory(newConfig, 'Change secondary color');
        set({ currentConfig: newConfig });
      },

      setGlowColor: (color) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          colors: { ...state.currentConfig.colors, glow: color }
        };
        get()._addToHistory(newConfig, 'Change glow color');
        set({ currentConfig: newConfig });
      },

      setOutlineColor: (color) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          colors: { ...state.currentConfig.colors, outline: color }
        };
        get()._addToHistory(newConfig, 'Change outline color');
        set({ currentConfig: newConfig });
      },

      setColorScheme: (colors) => {
        const state = get();
        const newConfig = { ...state.currentConfig, colors };
        get()._addToHistory(newConfig, 'Apply color scheme');
        set({ currentConfig: newConfig });
      },

      randomizeColors: () => {
        const state = get();
        const setup = state.agentSetup || 'generalist';
        const palette = COLOR_PALETTES[setup];
        
        const randomColor = (colors: string[]) => 
          colors[Math.floor(Math.random() * colors.length)];
        
        const newConfig = {
          ...state.currentConfig,
          colors: {
            primary: randomColor(palette.primary),
            secondary: randomColor(palette.secondary),
            glow: randomColor(palette.glow),
            outline: randomColor(palette.outline)
          }
        };
        get()._addToHistory(newConfig, 'Randomize colors');
        set({ currentConfig: newConfig });
      },

      // ============================================================================
      // Personality Updates
      // ============================================================================
      
      setBounce: (bounce) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          personality: { ...state.currentConfig.personality, bounce }
        };
        get()._addToHistory(newConfig, `Set bounce to ${bounce}`);
        set({ currentConfig: newConfig });
      },

      setSway: (sway) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          personality: { ...state.currentConfig.personality, sway }
        };
        get()._addToHistory(newConfig, `Set sway to ${sway}`);
        set({ currentConfig: newConfig });
      },

      setBreathing: (breathing) => {
        const state = get();
        const newConfig = {
          ...state.currentConfig,
          personality: { ...state.currentConfig.personality, breathing }
        };
        get()._addToHistory(newConfig, `Set breathing to ${breathing}`);
        set({ currentConfig: newConfig });
      },

      // ============================================================================
      // Emotion Updates
      // ============================================================================
      
      setCurrentEmotion: (emotion) => {
        const state = get();
        const newConfig = { ...state.currentConfig, currentEmotion: emotion };
        set({ currentConfig: newConfig });
      },

      setPreviewEmotion: (emotion) => {
        set({ previewEmotion: emotion });
      },

      // ============================================================================
      // Accessory Updates
      // ============================================================================
      
      addAccessory: (accessoryId) => {
        const state = get();
        const currentAccessories = state.currentConfig.accessories ?? [];
        if (!currentAccessories.includes(accessoryId)) {
          const newConfig = {
            ...state.currentConfig,
            accessories: [...currentAccessories, accessoryId]
          };
          get()._addToHistory(newConfig, `Add accessory ${accessoryId}`);
          set({ currentConfig: newConfig });
        }
      },

      removeAccessory: (accessoryId) => {
        const state = get();
        const currentAccessories = state.currentConfig.accessories ?? [];
        const newConfig = {
          ...state.currentConfig,
          accessories: currentAccessories.filter(id => id !== accessoryId)
        };
        get()._addToHistory(newConfig, `Remove accessory ${accessoryId}`);
        set({ currentConfig: newConfig });
      },

      toggleAccessory: (accessoryId) => {
        const state = get();
        const currentAccessories = state.currentConfig.accessories ?? [];
        const hasAccessory = currentAccessories.includes(accessoryId);
        if (hasAccessory) {
          state.removeAccessory(accessoryId);
        } else {
          state.addAccessory(accessoryId);
        }
      },

      // ============================================================================
      // UI State Updates
      // ============================================================================
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      setPreviewSize: (size) => set({ previewSize: size }),
      
      setPreviewAnimating: (animating) => set({ isPreviewAnimating: animating }),
      
      toggleGrid: () => set(state => ({ showGrid: !state.showGrid })),

      // ============================================================================
      // Template Actions
      // ============================================================================
      
      applyTemplate: (template) => {
        const state = get();
        const config = cloneAvatarConfig(template.config);
        get()._addToHistory(config, `Apply template: ${template.name}`);
        set({ 
          currentConfig: config,
          selectedTemplateId: template.id
        });
      },

      selectTemplate: (templateId) => set({ selectedTemplateId: templateId }),

      // ============================================================================
      // History Actions
      // ============================================================================
      
      undo: () => {
        const state = get();
        if (state.canUndo()) {
          const newIndex = state.historyIndex - 1;
          set({
            historyIndex: newIndex,
            currentConfig: state.history[newIndex].config
          });
        }
      },

      redo: () => {
        const state = get();
        if (state.canRedo()) {
          const newIndex = state.historyIndex + 1;
          set({
            historyIndex: newIndex,
            currentConfig: state.history[newIndex].config
          });
        }
      },

      canUndo: () => {
        const state = get();
        return state.historyIndex > 0;
      },

      canRedo: () => {
        const state = get();
        return state.historyIndex < state.history.length - 1;
      },

      clearHistory: () => set({ history: [], historyIndex: -1 }),

      // Internal: Add to history - exposed for use by other actions
      _addToHistory: (config: AvatarConfig, action: string) => {
        set((state) => {
          const newEntry: ConfigHistoryEntry = {
            config: cloneAvatarConfig(config),
            timestamp: Date.now(),
            action
          };
          
          // Remove any future history if we're not at the end
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          newHistory.push(newEntry);
          
          // Limit history size
          if (newHistory.length > state.maxHistorySize) {
            newHistory.shift();
          }
          
          return {
            history: newHistory,
            historyIndex: newHistory.length - 1
          };
        });
      },

      // ============================================================================
      // Validation
      // ============================================================================
      
      validate: () => {
        const state = get();
        const result = validateAvatarConfig(state.currentConfig);
        
        if (result.success) {
          set({ validationErrors: [], isValid: true });
          return true;
        } else {
          const errors = result.errors?.map((msg, i) => ({
            field: `field-${i}`,
            message: msg
          })) || [];
          set({ validationErrors: errors, isValid: false });
          return false;
        }
      },

      getValidationErrors: () => get().validationErrors,

      // ============================================================================
      // Context
      // ============================================================================
      
      setAgentContext: (setup, temperament) => {
        set({ 
          agentSetup: setup, 
          agentTemperament: temperament 
        });
      },

      applySmartDefaults: () => {
        const state = get();
        if (state.agentSetup) {
          const defaultConfig = createDefaultAvatarConfig(state.agentSetup);
          
          // Apply temperament adjustments
          if (state.agentTemperament) {
            switch (state.agentTemperament) {
              case 'precision':
                defaultConfig.personality = { bounce: 0.1, sway: 0.05, breathing: true };
                if (defaultConfig.eyes) {
                  defaultConfig.eyes.blinkRate = 'slow';
                }
                break;
              case 'exploratory':
                defaultConfig.personality = { bounce: 0.4, sway: 0.3, breathing: true };
                if (defaultConfig.eyes) {
                  defaultConfig.eyes.preset = 'curious';
                }
                break;
              case 'systemic':
                defaultConfig.personality = { bounce: 0.2, sway: 0.1, breathing: true };
                if (defaultConfig.antennas) {
                  defaultConfig.antennas.animation = 'pulse';
                }
                break;
              case 'balanced':
                defaultConfig.personality = { bounce: 0.3, sway: 0.15, breathing: true };
                break;
            }
          }
          
          get()._addToHistory(defaultConfig, 'Apply smart defaults');
          set({ currentConfig: defaultConfig });
        }
      },

      // ============================================================================
      // Import/Export
      // ============================================================================
      
      exportConfig: () => {
        const state = get();
        return JSON.stringify(state.currentConfig, null, 2);
      },

      importConfig: (json) => {
        try {
          const parsed = JSON.parse(json);
          const result = validateAvatarConfig(parsed);
          
          if (result.success && result.data) {
            const state = get();
            get()._addToHistory(result.data, 'Import config');
            set({ 
              currentConfig: result.data,
              validationErrors: [],
              isValid: true
            });
            return true;
          } else {
            set({
              validationErrors: result.errors?.map((msg, i) => ({
                field: `import-${i}`,
                message: msg
              })) || [{ field: 'import', message: 'Invalid config format' }],
              isValid: false
            });
            return false;
          }
        } catch {
          set({
            validationErrors: [{ field: 'import', message: 'Invalid JSON format' }],
            isValid: false
          });
          return false;
        }
      },

      // ============================================================================
      // Randomization
      // ============================================================================
      
      randomize: () => {
        const state = get();
        const setup = state.agentSetup || 'generalist';
        const palette = COLOR_PALETTES[setup];
        
        const randomItem = <T>(arr: T[]): T => 
          arr[Math.floor(Math.random() * arr.length)];
        
        const shapes: AvatarBodyShape[] = ['round', 'square', 'hex', 'diamond', 'cloud'];
        const eyePresets: EyePreset[] = ['round', 'wide', 'narrow', 'curious', 'pleased', 'skeptical', 'mischief', 'proud', 'starry'];
        const pupilStyles: PupilStyle[] = ['dot', 'ring', 'slit', 'star', 'heart'];
        const blinkRates: BlinkRate[] = ['slow', 'normal', 'fast'];
        const antennaStyles: AntennaStyle[] = ['straight', 'curved', 'coiled', 'zigzag', 'leaf', 'bolt'];
        const antennaAnimations: AntennaAnimation[] = ['static', 'wiggle', 'pulse', 'sway', 'bounce'];
        const tips: ("none" | "ball" | "glow" | "star" | "diamond")[] = ['none', 'ball', 'glow', 'star', 'diamond'];
        
        const newConfig: AvatarConfig = {
          version: '1.0',
          baseShape: randomItem(shapes),
          eyes: {
            preset: randomItem(eyePresets),
            size: 0.7 + Math.random() * 0.6, // 0.7 - 1.3
            color: randomItem(palette.secondary),
            pupilStyle: randomItem(pupilStyles),
            blinkRate: randomItem(blinkRates)
          },
          antennas: {
            count: Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3,
            style: randomItem(antennaStyles),
            animation: randomItem(antennaAnimations),
            tipDecoration: randomItem(tips)
          },
          colors: {
            primary: randomItem(palette.primary),
            secondary: randomItem(palette.secondary),
            glow: randomItem(palette.glow),
            outline: randomItem(palette.outline)
          },
          personality: {
            bounce: Math.random() * 0.5,
            sway: Math.random() * 0.3,
            breathing: Math.random() > 0.3
          },
          accessories: [],
          currentEmotion: 'steady'
        };
        
        get()._addToHistory(newConfig, 'Randomize all');
        set({ currentConfig: newConfig });
      },

      randomizeEyes: () => {
        const state = get();
        const eyePresets: EyePreset[] = ['round', 'wide', 'narrow', 'curious', 'pleased', 'skeptical', 'mischief', 'proud', 'starry'];
        const pupilStyles: PupilStyle[] = ['dot', 'ring', 'slit', 'star', 'heart'];
        
        const randomItem = <T>(arr: T[]): T => 
          arr[Math.floor(Math.random() * arr.length)];
        
        const newConfig = {
          ...state.currentConfig,
          eyes: {
            ...state.currentConfig.eyes,
            preset: randomItem(eyePresets),
            pupilStyle: randomItem(pupilStyles)
          }
        };
        
        get()._addToHistory(newConfig, 'Randomize eyes');
        set({ currentConfig: newConfig });
      },

      randomizeAntennas: () => {
        const state = get();
        const antennaStyles: AntennaStyle[] = ['straight', 'curved', 'coiled', 'zigzag', 'leaf', 'bolt'];
        const antennaAnimations: AntennaAnimation[] = ['static', 'wiggle', 'pulse', 'sway', 'bounce'];
        
        const randomItem = <T>(arr: T[]): T => 
          arr[Math.floor(Math.random() * arr.length)];
        
        const newConfig = {
          ...state.currentConfig,
          antennas: {
            ...state.currentConfig.antennas,
            count: Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3,
            style: randomItem(antennaStyles),
            animation: randomItem(antennaAnimations)
          }
        };
        
        get()._addToHistory(newConfig, 'Randomize antennas');
        set({ currentConfig: newConfig });
      }
    }),
    {
      name: 'avatar-creator-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentConfig: state.currentConfig,
        selectedTemplateId: state.selectedTemplateId,
        agentSetup: state.agentSetup,
        agentTemperament: state.agentTemperament
      })
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectAvatarConfig = (state: AvatarCreatorState & AvatarCreatorActions) => 
  state.currentConfig;

export const selectIsValid = (state: AvatarCreatorState & AvatarCreatorActions) => 
  state.isValid;

export const selectValidationErrors = (state: AvatarCreatorState & AvatarCreatorActions) => 
  state.validationErrors;

export const selectCanUndo = (state: AvatarCreatorState & AvatarCreatorActions) => 
  state.canUndo();

export const selectCanRedo = (state: AvatarCreatorState & AvatarCreatorActions) => 
  state.canRedo();
