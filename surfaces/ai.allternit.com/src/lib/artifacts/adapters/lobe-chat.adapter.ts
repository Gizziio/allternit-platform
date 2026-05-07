/**
 * Lobe Chat → Allternit Adapter
 * Maps Lobe Chat's artifact types into the canonical Allternit schema.
 */

import {
  type AllternitArtifact,
  type AllternitArtifactSection,
  type AllternitArtifactType,
  type AllternitSectionKind,
  type ArtifactAdapter,
} from '@/lib/artifacts/schema';

export interface LobeArtifact {
  type: 'application/lobe.artifacts.react' | 'image/svg+xml' | 'application/lobe.artifacts.mermaid' | 'text/markdown' | string;
  content: string;
  title?: string;
  identifier?: string;
}

export const lobeChatAdapter: ArtifactAdapter = {
  toAllternit(raw: unknown): AllternitArtifact {
    const lobe = raw as LobeArtifact;

    const typeMap: Record<string, AllternitArtifactType> = {
      'application/lobe.artifacts.react': 'ui-block',
      'image/svg+xml': 'design',
      'application/lobe.artifacts.mermaid': 'design',
      'text/markdown': 'document',
    };

    const sectionKindMap: Record<string, AllternitSectionKind> = {
      'application/lobe.artifacts.react': 'code/react',
      'image/svg+xml': 'media/svg',
      'application/lobe.artifacts.mermaid': 'media/mermaid',
      'text/markdown': 'document/markdown',
    };

    const now = new Date().toISOString();
    const id = lobe.identifier ?? `lobe-${Date.now()}`;

    return {
      id,
      workspaceId: 'imported',
      title: lobe.title ?? 'Untitled Artifact',
      type: typeMap[lobe.type] ?? 'document',
      status: 'draft',
      tags: ['lobe-chat', lobe.type],
      createdAt: now,
      updatedAt: now,
      sections: [
        {
          id: `${id}-s1`,
          artifactId: id,
          heading: 'Imported Content',
          kind: sectionKindMap[lobe.type] ?? 'document/html',
          body: lobe.content,
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
      ],
      revisions: [],
      forkMeta: {
        lobeChat: {
          artifactType: lobe.type,
          portalId: lobe.identifier,
        },
      },
    };
  },

  fromAllternit(artifact: AllternitArtifact): LobeArtifact {
    const section = artifact.sections[0];
    const meta = artifact.forkMeta?.lobeChat;

    const typeReverseMap: Record<string, string> = {
      'ui-block': 'application/lobe.artifacts.react',
      'design': 'image/svg+xml',
      'document': 'text/markdown',
      'code': 'text/markdown',
    };

    return {
      type: meta?.artifactType ?? typeReverseMap[artifact.type] ?? 'text/markdown',
      content: section?.body ?? '',
      title: artifact.title,
      identifier: artifact.id,
    };
  },

  toAllternitSection(raw: unknown): AllternitArtifactSection {
    const lobe = raw as LobeArtifact;
    const id = `lobe-sec-${Date.now()}`;
    const now = new Date().toISOString();

    const kindMap: Record<string, AllternitSectionKind> = {
      'application/lobe.artifacts.react': 'code/react',
      'image/svg+xml': 'media/svg',
      'application/lobe.artifacts.mermaid': 'media/mermaid',
      'text/markdown': 'document/markdown',
    };

    return {
      id,
      artifactId: 'unknown',
      heading: lobe.title ?? 'Section',
      kind: kindMap[lobe.type] ?? 'document/html',
      body: lobe.content,
      position: 0,
      createdAt: now,
      updatedAt: now,
    };
  },

  fromAllternitSection(section: AllternitArtifactSection): LobeArtifact {
    const typeMap: Record<string, string> = {
      'code/react': 'application/lobe.artifacts.react',
      'media/svg': 'image/svg+xml',
      'media/mermaid': 'application/lobe.artifacts.mermaid',
      'document/markdown': 'text/markdown',
      'document/html': 'text/markdown',
    };

    return {
      type: typeMap[section.kind] ?? 'text/markdown',
      content: section.body,
      title: section.heading,
    };
  },
};
