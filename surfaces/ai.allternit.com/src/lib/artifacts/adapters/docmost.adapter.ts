/**
 * Docmost → Allternit Adapter
 * Maps Docmost pages / revisions into the canonical Allternit schema.
 *
 * NOTE: Docmost is AGPL-3.0. This adapter runs in the public fork
 * `allternit/docmost-artifacts` or across a service boundary.
 * Do NOT import Docmost source directly into the private Allternit monorepo.
 */

import {
  type AllternitArtifact,
  type AllternitArtifactSection,
  type AllternitArtifactStatus,
  type AllternitSectionKind,
  type ArtifactAdapter,
} from '@/lib/artifacts/schema';

export interface DocmostPage {
  id: string;
  spaceId: string;
  parentPageId?: string | null;
  title: string;
  content: Record<string, unknown>; // ProseMirror JSON
  slug: string;
  sortOrder: number;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocmostRevision {
  id: string;
  pageId: string;
  data: Record<string, unknown>;
  createdAt: string;
  createdBy: { name: string };
}

function proseMirrorToSections(
  pageId: string,
  doc: Record<string, unknown>,
): AllternitArtifactSection[] {
  const sections: AllternitArtifactSection[] = [];
  const now = new Date().toISOString();

  const walk = (node: Record<string, unknown>, depth = 0) => {
    if (node.type === 'heading' && node.content) {
      const text = (node.content as Array<Record<string, unknown>>)
        .map((c) => c.text ?? '')
        .join('');
      sections.push({
        id: `docmost-${pageId}-h${sections.length}`,
        artifactId: pageId,
        heading: text,
        kind: 'document/markdown',
        body: '',
        position: sections.length,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (node.type === 'paragraph' && node.content && sections.length > 0) {
      const text = (node.content as Array<Record<string, unknown>>)
        .map((c) => c.text ?? '')
        .join('');
      sections[sections.length - 1].body += `${text}\n`;
    }

    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child as Record<string, unknown>, depth + 1);
      }
    }
  };

  walk(doc);
  return sections.length ? sections : [
    {
      id: `docmost-${pageId}-fallback`,
      artifactId: pageId,
      heading: 'Content',
      kind: 'document/markdown',
      body: JSON.stringify(doc),
      position: 0,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export const docmostAdapter: ArtifactAdapter = {
  toAllternit(raw: unknown): AllternitArtifact {
    const page = raw as DocmostPage;

    return {
      id: page.id,
      workspaceId: page.spaceId,
      title: page.title,
      type: 'document',
      status: 'active' as AllternitArtifactStatus,
      tags: ['docmost'],
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      sections: proseMirrorToSections(page.id, page.content),
      revisions: [],
      forkMeta: {
        docmost: {
          pageId: page.id,
          spaceId: page.spaceId,
          parentPageId: page.parentPageId ?? undefined,
        },
      },
    };
  },

  fromAllternit(artifact: AllternitArtifact): DocmostPage {
    const meta = artifact.forkMeta?.docmost;

    return {
      id: artifact.id,
      spaceId: meta?.spaceId ?? artifact.workspaceId,
      parentPageId: meta?.parentPageId ?? null,
      title: artifact.title,
      content: {}, // Would need ProseMirror serializer
      slug: artifact.title.toLowerCase().replace(/\s+/g, '-'),
      sortOrder: 0,
      creatorId: 'system',
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
    };
  },

  toAllternitSection(raw: unknown): AllternitArtifactSection {
    const node = raw as Record<string, unknown>;
    const now = new Date().toISOString();
    const id = `docmost-sec-${Date.now()}`;

    return {
      id,
      artifactId: 'unknown',
      heading: (node.type as string) ?? 'Section',
      kind: 'document/markdown',
      body: JSON.stringify(node),
      position: 0,
      createdAt: now,
      updatedAt: now,
    };
  },

  fromAllternitSection(section: AllternitArtifactSection): Record<string, unknown> {
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: section.body }],
    };
  },
};
