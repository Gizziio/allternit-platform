import { UUID, ISODate } from './base';

export interface SidecarState {
  isOpen: boolean;
  activePanel: 'artifact' | 'context' | 'agent' | 'changeset' | 'preview';
  width: number;
  isResizing: boolean;
  
  panels: {
    artifact: {
      activeArtifactId: UUID | null;
      viewMode: 'preview' | 'code' | 'split';
      pinnedArtifacts: UUID[];
    };
    context: {
      activeThreadId: UUID | null;
      showTokenCount: boolean;
      showModelInfo: boolean;
      showProjectContext: boolean;
    };
    agent: {
      activeRunId: UUID | null;
      filter: 'all' | 'running' | 'completed' | 'failed';
      autoFollow: boolean;
    };
    changeset: {
      activeChangeSetId: UUID | null;
      filter: 'pending' | 'approved' | 'rejected' | 'applied' | 'all';
      showDiffView: boolean;
    };
  };
  
  history: {
    panel: 'artifact' | 'context' | 'agent' | 'changeset' | 'preview';
    entityId?: UUID;
    timestamp: ISODate;
  }[];
  
  toggleShortcut: string;
}
