import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BrowserExtensionPermission = 'allow' | 'block' | 'ask';
export type BrowserExtensionCategory = 'productivity' | 'automation' | 'ai' | 'utilities' | 'office';

export interface BrowserExtension {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  version: string;
  author?: string;
  category?: BrowserExtensionCategory;
  owned?: boolean;
  surfaceViewType?: string;
  officeHost?: 'word' | 'excel' | 'powerpoint';
  launchUrl?: string;
  chromeStoreId?: string;
  storeUrl?: string;
  installStatus?: 'not-installed' | 'pending' | 'installed' | 'error';
  permissions?: Record<string, BrowserExtensionPermission>;
}

export const ALLTERNIT_OWNED_EXTENSIONS: BrowserExtension[] = [
  {
    id: 'allternit-agent',
    name: 'Allternit Computer Agent',
    description: 'The attached browser extension for Allternit browser-use and computer-use.',
    icon: '◎',
    enabled: true,
    version: '1.0.0',
    author: 'Allternit',
    category: 'ai',
    owned: true,
    installStatus: 'installed',
    permissions: { scripts: 'ask', clipboard: 'ask', downloads: 'ask' },
  },
  {
    id: 'allternit-office-word',
    name: 'Allternit for Word',
    description: 'Allternit Office agent and document tools for Microsoft Word.',
    icon: 'W',
    enabled: false,
    version: '1.0.0',
    author: 'Allternit',
    category: 'office',
    owned: true,
    surfaceViewType: 'addin-word',
    officeHost: 'word',
    launchUrl: 'https://word.office.com',
    installStatus: 'not-installed',
  },
  {
    id: 'allternit-office-excel',
    name: 'Allternit for Excel',
    description: 'Allternit Office agent and workbook tools for Microsoft Excel.',
    icon: 'X',
    enabled: false,
    version: '1.0.0',
    author: 'Allternit',
    category: 'office',
    owned: true,
    surfaceViewType: 'addin-excel',
    officeHost: 'excel',
    launchUrl: 'https://excel.office.com',
    installStatus: 'not-installed',
  },
  {
    id: 'allternit-office-powerpoint',
    name: 'Allternit for PowerPoint',
    description: 'Allternit Office agent and presentation tools for Microsoft PowerPoint.',
    icon: 'P',
    enabled: false,
    version: '1.0.0',
    author: 'Allternit',
    category: 'office',
    owned: true,
    surfaceViewType: 'addin-ppt',
    officeHost: 'powerpoint',
    launchUrl: 'https://powerpoint.office.com',
    installStatus: 'not-installed',
  },
];

interface BrowserExtensionsState {
  extensions: BrowserExtension[];
  addExtension: (extension: Omit<BrowserExtension, 'id'>) => void;
  removeExtension: (id: string) => void;
  toggleExtension: (id: string) => void;
  setEnabled: (id: string, enabled: boolean) => void;
  updateExtension: (id: string, patch: Partial<BrowserExtension>) => void;
  setExtensionPermission: (id: string, key: string, value: BrowserExtensionPermission) => void;
}

function withOwnedExtensions(stored: BrowserExtension[] = []): BrowserExtension[] {
  const storedById = new Map(stored.map((extension) => [extension.id, extension]));
  const owned = ALLTERNIT_OWNED_EXTENSIONS.map((extension) => ({
    ...extension,
    ...storedById.get(extension.id),
    owned: true,
    installStatus: extension.id === 'allternit-agent'
      ? 'installed' as const
      : storedById.get(extension.id)?.installStatus ?? extension.installStatus,
  }));
  return [...owned, ...stored.filter((extension) => !extension.owned && !ALLTERNIT_OWNED_EXTENSIONS.some((ownedExtension) => ownedExtension.id === extension.id))];
}

export const useBrowserExtensionsStore = create<BrowserExtensionsState>()(
  persist(
    (set) => ({
      extensions: ALLTERNIT_OWNED_EXTENSIONS,
      addExtension: (extension) => set((state) => ({ extensions: [...state.extensions, { ...extension, id: `ext-${Date.now()}` }] })),
      removeExtension: (id) => set((state) => ({ extensions: state.extensions.filter((extension) => extension.id !== id || extension.owned) })),
      toggleExtension: (id) => set((state) => ({ extensions: state.extensions.map((extension) => extension.id === id ? { ...extension, enabled: !extension.enabled } : extension) })),
      setEnabled: (id, enabled) => set((state) => ({ extensions: state.extensions.map((extension) => extension.id === id ? { ...extension, enabled } : extension) })),
      updateExtension: (id, patch) => set((state) => ({ extensions: state.extensions.map((extension) => extension.id === id ? { ...extension, ...patch } : extension) })),
      setExtensionPermission: (id, key, value) => set((state) => ({ extensions: state.extensions.map((extension) => extension.id === id ? { ...extension, permissions: { ...extension.permissions, [key]: value } } : extension) })),
    }),
    {
      name: 'allternit.browser.extensions',
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<BrowserExtensionsState>), extensions: withOwnedExtensions((persisted as Partial<BrowserExtensionsState>)?.extensions) }),
    },
  ),
);
