// packages/ui-tars/src/config.ts

export interface UIConfig {
  superconductor: {
    enabled: boolean;
    apiKey?: string;
    endpoint: string;
    defaultModels: string[];
    maxParallelVariants: number;
  };
  features: {
    parallelMode: boolean;
    livePreviews: boolean;
    diffViewing: boolean;
    verification: boolean;
  };
}

export const DEFAULT_UI_CONFIG: UIConfig = {
  superconductor: {
    enabled: false,
    endpoint: 'https://api.superconductor.ai',
    defaultModels: ['gpt-4', 'claude-3-sonnet', 'gemini-pro'],
    maxParallelVariants: 5
  },
  features: {
    parallelMode: true,
    livePreviews: true,
    diffViewing: true,
    verification: true
  }
};

let currentConfig: UIConfig = { ...DEFAULT_UI_CONFIG };

export const configureUI = (config: Partial<UIConfig>): void => {
  currentConfig = {
    ...currentConfig,
    ...config,
    superconductor: {
      ...currentConfig.superconductor,
      ...config.superconductor
    },
    features: {
      ...currentConfig.features,
      ...config.features
    }
  };
};

export const getConfig = (): UIConfig => {
  return currentConfig;
};

export const isFeatureEnabled = (feature: keyof UIConfig['features']): boolean => {
  return currentConfig.features[feature] ?? false;
};

export const isSuperconductorEnabled = (): boolean => {
  return currentConfig.superconductor.enabled && !!currentConfig.superconductor.apiKey;
};

export const getSuperconductorConfig = () => {
  return currentConfig.superconductor;
};