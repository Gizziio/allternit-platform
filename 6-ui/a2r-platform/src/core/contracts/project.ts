import { UUID, ISODate } from './base';

export interface Project {
  readonly id: UUID;
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  readonly version: number;
  
  name: string;
  description: string;
  rootPath: string; // Absolute path
  
  context: {
    includedFiles: string[]; // Relative paths
    workingDirectory: string;
    envVars: Record<string, string>;
    systemPromptAdditions: string[];
    lastSyncedAt: ISODate;
  };
  
  activeThreadId: UUID | null;
  threadIds: UUID[];
  
  settings: {
    autoAcceptSafeEdits: boolean;
    autoAcceptTypes: ('formatting' | 'comments' | 'types')[];
    preferredModel: string;
    preferredMode: 'llm' | 'agent';
    defaultSidecarOpen: boolean;
    defaultDrawerOpen: boolean;
    defaultDrawerHeight: number;
  };
  
  stats: {
    totalTokensUsed: number;
    totalCost: number;
    filesModified: number;
    sessionsCount: number;
    lastActivityAt: ISODate | null;
  };
}
