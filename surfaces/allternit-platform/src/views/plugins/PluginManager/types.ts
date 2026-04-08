import type { SimpleCapability, FileNode, MarketplacePlugin } from '../../../plugins/capability.types';
import type { 
  ConnectorMarketplaceCatalogItem, 
  ExternalMarketplaceDirectoryEntry 
} from '../../../plugins/marketplaceApi';

export type { FileNode, MarketplacePlugin };

export type TabId = 'skills' | 'commands' | 'cli-tools' | 'plugins' | 'mcps' | 'webhooks' | 'connectors';
export type Capability = SimpleCapability;

export type ConnectorGroupId = 'desktop' | 'connected' | 'not-connected';
export type ConnectorMarketplaceTab = 'featured' | 'all';
export type PluginMarketplaceTab = 'marketplace' | 'personal' | 'directories' | 'publish';
export type PersonalMarketplaceType = 'github' | 'url' | 'upload' | 'local';
export type ConnectorConnectionStatus = 'connected' | 'not-connected' | 'connecting';

export type ConnectorMarketplaceItem = ConnectorMarketplaceCatalogItem;

export interface PersonalMarketplaceSource {
  id: string;
  type: PersonalMarketplaceType;
  value: string;
  createdAt: string;
  label?: string;
  isDevMode?: boolean;
}

export interface ConnectorConnectionState {
  status: ConnectorConnectionStatus;
  accountLabel?: string;
  connectedAt?: string;
  lastAttemptAt?: string;
}

export interface PluginManagerPersistedState {
  version: number;
  updatedAt: string;
  enabledOverrides: Record<string, boolean>;
  marketplaceInstalledIds: string[];
  personalMarketplaceSources: PersonalMarketplaceSource[];
  connectorConnections: Record<string, ConnectorConnectionState>;
  curatedSourceEnabled: Record<string, boolean>;
  allowUntrustedMarketplaceSources: boolean;
}

export interface CreateMenuAction {
  id: string;
  label: string;
  onClick: () => void;
}

export interface ValidationResult {
  ok: boolean;
  message?: string;
  errors?: string[];
}

export interface PublishTabViewProps {
  onPublish: (manifest: any) => Promise<void>;
  isPublishing: boolean;
}

export interface CreatePluginModalProps {
  onClose: () => void;
  onCreate: (config: any) => Promise<void>;
}

export type PluginType = 'command' | 'skill' | 'mcp' | 'webhook' | 'full';

export interface ValidatePluginModalProps {
  onClose: () => void;
  onValidate: (manifest: any) => Promise<ValidationResult>;
}

export interface SubmitToMarketplaceModalProps {
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}
