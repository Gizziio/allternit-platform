export type ExtensionCategory = 'all' | 'productivity' | 'automation' | 'ai' | 'utilities' | 'office';

export interface Extension {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  author: string;
  category: Exclude<ExtensionCategory, 'all'>;
  isInstalled: boolean;
  isEnabled: boolean;
  permissions: string[];
  permissionDetails?: Record<string, string>;
  owned?: boolean;
  surfaceViewType?: string;
  officeHost?: 'word' | 'excel' | 'powerpoint';
  launchUrl?: string;
  storeUrl?: string;
  installStatus?: 'not-installed' | 'pending' | 'installed' | 'error';
}
