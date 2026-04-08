// ============================================================================
// Allternit Developer Portal - Type Definitions
// ============================================================================

// Plugin Manifest Types
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  entry: string;
  icon?: string;
  categories: PluginCategory[];
  permissions: PluginPermission[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  settings?: PluginSetting[];
  hooks?: PluginHook[];
  commands?: PluginCommand[];
  minAllternitVersion?: string;
  maxAllternitVersion?: string;
}

export type PluginCategory =
  | 'ai'
  | 'automation'
  | 'communication'
  | 'data'
  | 'developer'
  | 'design'
  | 'productivity'
  | 'utility'
  | 'integration'
  | 'other';

export type PluginPermission =
  | 'filesystem:read'
  | 'filesystem:write'
  | 'network:fetch'
  | 'network:websocket'
  | 'ui:panel'
  | 'ui:modal'
  | 'ui:notification'
  | 'ai:model'
  | 'ai:context'
  | 'system:exec'
  | 'vault:secrets';

export interface PluginSetting {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'secret';
  label: string;
  description?: string;
  default?: unknown;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  placeholder?: string;
}

export interface PluginHook {
  event: string;
  handler: string;
  priority?: number;
}

export interface PluginCommand {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: string;
  handler: string;
}

// Template Types
export interface PluginTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  category: PluginCategory;
  tags: string[];
  author: string;
  repositoryUrl: string;
  demoUrl?: string;
  screenshotUrl?: string;
  features: string[];
  files: TemplateFile[];
  dependencies: Record<string, string>;
  usedCount: number;
  rating: number;
  isOfficial: boolean;
}

export interface TemplateFile {
  path: string;
  content: string;
  isEntry?: boolean;
}

// API Documentation Types
export interface APINamespace {
  name: string;
  description: string;
  methods: APIMethod[];
  types: APIType[];
}

export interface APIMethod {
  name: string;
  description: string;
  signature: string;
  params: APIParam[];
  returns: APIReturn;
  examples: CodeExample[];
  since: string;
  deprecated?: string;
}

export interface APIParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

export interface APIReturn {
  type: string;
  description: string;
}

export interface APIType {
  name: string;
  definition: string;
  description: string;
}

export interface CodeExample {
  title: string;
  code: string;
  language: string;
}

// Documentation Types
export interface DocSection {
  id: string;
  title: string;
  slug: string;
  content: string;
  children?: DocSection[];
  meta?: DocMeta;
}

export interface DocMeta {
  version: string;
  lastUpdated: string;
  contributors: string[];
  tags: string[];
}

export interface DocVersion {
  version: string;
  label: string;
  isStable: boolean;
  isLatest: boolean;
  path: string;
}

// Search Types
export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  type: 'doc' | 'api' | 'template' | 'example';
  category?: string;
  score: number;
}

// User Types
export interface DeveloperProfile {
  id: string;
  githubId: string;
  username: string;
  email: string;
  avatarUrl: string;
  bio?: string;
  website?: string;
  plugins: string[];
  joinedAt: string;
  isVerified: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: DeveloperProfile | null;
  token: string | null;
  isLoading: boolean;
}

// Theme Types
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
}

// UI Types
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  children?: NavItem[];
  external?: boolean;
  badge?: string;
}

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  copyable?: boolean;
  runnable?: boolean;
}
