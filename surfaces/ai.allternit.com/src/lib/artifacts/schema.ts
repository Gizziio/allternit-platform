/**
 * Allternit Artifact Schema Bridge (AASB)
 * Unified spec for grafting forked artifact engines into Allternit.
 * All 4 forks (Lobe Chat, Allternit AI, AFFiNE, Docmost) must translate
 * to/from this canonical shape.
 */

export type AllternitArtifactType =
  | 'document'
  | 'spec'
  | 'research'
  | 'analysis'
  | 'plan'
  | 'design'
  | 'proposal'
  | 'review'
  | 'decision'
  | 'report'
  | 'experiment'
  | 'feature'
  | 'guide'
  | 'log'
  | 'board'        // From AFFiNE Edgeless
  | 'code'         // From Lobe Chat / Allternit AI artifacts
  | 'ui-block';    // From Lobe Chat React artifacts

export type AllternitArtifactStatus = 'draft' | 'active' | 'final' | 'archived';

export type AllternitSectionKind =
  | 'document/markdown'
  | 'document/html'
  | 'document/wiki'
  | 'code/generic'
  | 'code/react'
  | 'data/table'
  | 'design/board'
  | 'media/svg'
  | 'media/mermaid';

export interface AllternitArtifactSection {
  id: string;
  artifactId: string;
  heading: string;
  kind: AllternitSectionKind;
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface AllternitArtifactRevision {
  id: string;
  artifactId: string;
  createdAt: string;
  reason: string;
  snapshot: {
    title: string;
    type: AllternitArtifactType;
    status: AllternitArtifactStatus;
    summary?: string;
    tags: string[];
    sections: AllternitArtifactSection[];
    yjsState?: Uint8Array;      // CRDT snapshot (AFFiNE / Docmost)
    updatedAt: string;
  };
}

export interface AllternitArtifact {
  id: string;
  workspaceId: string;
  title: string;
  type: AllternitArtifactType;
  status: AllternitArtifactStatus;
  summary?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sections: AllternitArtifactSection[];
  revisions: AllternitArtifactRevision[];

  // Fork-specific extensions (stored as metadata, not primary schema)
  forkMeta?: {
    lobeChat?: {
      artifactType: string;      // e.g. 'application/lobe.artifacts.react'
      portalId?: string;
    };
    docmost?: {
      pageId: string;
      spaceId: string;
      parentPageId?: string;
    };
    affine?: {
      docId: string;
      workspaceId: string;
      blobId?: string;
    };
    allternitAi?: {
      artifactId: string;
      collectionName?: string;
      vectorIds?: string[];
    };
  };
}

export interface AllternitWorkspaceStats {
  workspaceId: string;
  total: number;
  drafts: number;
  final: number;
  updatedAt: string;
}

// Adapter contract: every fork must implement this interface
export interface ArtifactAdapter {
  toAllternit(raw: unknown): AllternitArtifact;
  fromAllternit(artifact: AllternitArtifact): unknown;
  toAllternitSection(raw: unknown): AllternitArtifactSection;
  fromAllternitSection(section: AllternitArtifactSection): unknown;
}
