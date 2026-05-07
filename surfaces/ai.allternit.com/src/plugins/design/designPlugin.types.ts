export type DesignPluginId = 'frontend' | 'brand' | 'motion';

export type DesignPluginPriority = 'core' | 'supporting' | 'specialized';

export type DesignPluginSurface =
  | 'design'
  | 'canvas'
  | 'allternit-canvas'
  | 'code-skills'
  | 'marketplace'
  | 'selection';

export interface ImportedDesignSkill {
  id: string;
  name: string;
  source: string;
  description: string;
  bucket: DesignPluginId;
  priority: DesignPluginPriority;
  tags: string[];
  capabilities: string[];
  inputTypes: string[];
  outputTypes: string[];
  supportedSurfaces: DesignPluginSurface[];
  internalOnly?: boolean;
}

export interface DesignPluginAction {
  id: string;
  label: string;
  description: string;
  inputModes: string[];
  outputModes: string[];
  supportedSurfaces: DesignPluginSurface[];
}

export interface DesignPluginDefinition {
  id: DesignPluginId;
  name: string;
  description: string;
  summary: string;
  capabilities: string[];
  supportedSurfaces: DesignPluginSurface[];
  inputs: string[];
  outputs: string[];
  bundledSkillIds: string[];
  actions: DesignPluginAction[];
}
