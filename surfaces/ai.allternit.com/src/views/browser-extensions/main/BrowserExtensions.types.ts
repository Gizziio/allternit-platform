export type ExtensionCategory = 'all' | 'productivity' | 'automation' | 'ai' | 'utilities' | 'office';

export interface Extension {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  author: string;
  category: ExtensionCategory;
  isInstalled: boolean;
  isEnabled: boolean;
  permissions: string[];
  owned?: boolean;
  surfaceViewType?: string;
}
