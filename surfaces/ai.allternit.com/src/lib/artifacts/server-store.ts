import { access, readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';

export type ArtifactType =
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
  | 'log';

export type ArtifactStatus = 'draft' | 'active' | 'final' | 'archived';

export type ArtifactSectionKind =
  | 'document/markdown'
  | 'document/text'
  | 'document/html'
  | 'code/generic'
  | 'code/typescript'
  | 'data/json';

export interface StoredArtifactSection {
  id: string;
  artifactId: string;
  heading: string;
  kind: ArtifactSectionKind;
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredArtifactRevision {
  id: string;
  artifactId: string;
  createdAt: string;
  reason: string;
  snapshot: {
    title: string;
    type: ArtifactType;
    status: ArtifactStatus;
    summary?: string;
    tags: string[];
    sections: StoredArtifactSection[];
    updatedAt: string;
  };
}

export interface StoredArtifact {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  type: ArtifactType;
  status: ArtifactStatus;
  summary?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sections: StoredArtifactSection[];
  revisions: StoredArtifactRevision[];
}

interface LegacyStoredArtifactsData {
  artifacts?: StoredArtifact[];
}

const LEGACY_ARTIFACTS_PATH = path.join(process.cwd(), 'data', 'artifacts', 'store.json');

let legacyImportPromise: Promise<void> | null = null;

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .slice(0, 24);
}

function sortSections(sections: StoredArtifactSection[]): StoredArtifactSection[] {
  return [...sections].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return normalizeTags(parsed);
  } catch {
    return [];
  }
}

function parseRevisionSnapshot(
  snapshot: string,
  fallback: Pick<StoredArtifact, 'title' | 'type' | 'status' | 'summary' | 'updatedAt'>
): StoredArtifactRevision['snapshot'] {
  try {
    const parsed = JSON.parse(snapshot) as Partial<StoredArtifactRevision['snapshot']>;
    return {
      title: typeof parsed.title === 'string' ? parsed.title : fallback.title,
      type: typeof parsed.type === 'string' ? (parsed.type as ArtifactType) : fallback.type,
      status: typeof parsed.status === 'string' ? (parsed.status as ArtifactStatus) : fallback.status,
      summary: typeof parsed.summary === 'string' ? parsed.summary : fallback.summary,
      tags: normalizeTags(parsed.tags),
      sections: Array.isArray(parsed.sections)
        ? sortSections(
            parsed.sections.map((section) => ({
              id: typeof section?.id === 'string' ? section.id : '',
              artifactId: typeof section?.artifactId === 'string' ? section.artifactId : '',
              heading: typeof section?.heading === 'string' ? section.heading : 'Section',
              kind: typeof section?.kind === 'string' ? (section.kind as ArtifactSectionKind) : 'document/markdown',
              body: typeof section?.body === 'string' ? section.body : '',
              position: typeof section?.position === 'number' ? section.position : 0,
              createdAt: typeof section?.createdAt === 'string' ? section.createdAt : fallback.updatedAt,
              updatedAt: typeof section?.updatedAt === 'string' ? section.updatedAt : fallback.updatedAt,
            }))
          )
        : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
    };
  } catch {
    return {
      title: fallback.title,
      type: fallback.type,
      status: fallback.status,
      summary: fallback.summary,
      tags: [],
      sections: [],
      updatedAt: fallback.updatedAt,
    };
  }
}

function serializeSnapshot(artifact: StoredArtifact): string {
  return JSON.stringify({
    title: artifact.title,
    type: artifact.type,
    status: artifact.status,
    summary: artifact.summary,
    tags: artifact.tags,
    sections: artifact.sections,
    updatedAt: artifact.updatedAt,
  });
}

function mapArtifactRecord(record: {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  type: string;
  status: string;
  summary: string | null;
  tags: string;
  createdAt: Date;
  updatedAt: Date;
  sections: Array<{
    id: string;
    artifactId: string;
    heading: string;
    kind: string;
    body: string;
    position: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  revisions: Array<{
    id: string;
    artifactId: string;
    reason: string;
    snapshot: string;
    createdAt: Date;
  }>;
}): StoredArtifact {
  const base = {
    title: record.title,
    type: record.type as ArtifactType,
    status: record.status as ArtifactStatus,
    summary: record.summary ?? undefined,
    updatedAt: record.updatedAt.toISOString(),
  };
  const sections = sortSections(
    record.sections.map((section) => ({
      id: section.id,
      artifactId: section.artifactId,
      heading: section.heading,
      kind: section.kind as ArtifactSectionKind,
      body: section.body,
      position: section.position,
      createdAt: section.createdAt.toISOString(),
      updatedAt: section.updatedAt.toISOString(),
    }))
  );
  return {
    id: record.id,
    userId: record.userId,
    workspaceId: record.workspaceId,
    title: base.title,
    type: base.type,
    status: base.status,
    summary: base.summary,
    tags: parseJsonArray(record.tags),
    createdAt: record.createdAt.toISOString(),
    updatedAt: base.updatedAt,
    sections,
    revisions: record.revisions
      .map((revision) => ({
        id: revision.id,
        artifactId: revision.artifactId,
        reason: revision.reason,
        createdAt: revision.createdAt.toISOString(),
        snapshot: parseRevisionSnapshot(revision.snapshot, base),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

async function ensureLegacyImported(): Promise<void> {
  if (!legacyImportPromise) {
    legacyImportPromise = (async () => {
      const existingCount = await prisma.artifact.count();
      if (existingCount > 0) return;

      try {
        await access(LEGACY_ARTIFACTS_PATH);
      } catch {
        return;
      }

      const raw = await readFile(LEGACY_ARTIFACTS_PATH, 'utf-8').catch(() => '');
      if (!raw) return;

      const parsed = JSON.parse(raw) as LegacyStoredArtifactsData;
      const artifacts = Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
      if (!artifacts.length) return;

      await prisma.$transaction(async (tx) => {
        for (const artifact of artifacts) {
          await tx.artifact.create({
            data: {
              id: artifact.id,
              userId: artifact.userId,
              workspaceId: artifact.workspaceId,
              title: artifact.title,
              type: artifact.type,
              status: artifact.status,
              summary: artifact.summary ?? null,
              tags: JSON.stringify(normalizeTags(artifact.tags)),
              createdAt: new Date(artifact.createdAt),
              updatedAt: new Date(artifact.updatedAt),
              sections: {
                create: sortSections(artifact.sections || []).map((section) => ({
                  id: section.id,
                  heading: section.heading,
                  kind: section.kind,
                  body: section.body,
                  position: section.position,
                  createdAt: new Date(section.createdAt),
                  updatedAt: new Date(section.updatedAt),
                })),
              },
              revisions: {
                create: (artifact.revisions || []).map((revision) => ({
                  id: revision.id,
                  reason: revision.reason,
                  snapshot: JSON.stringify(revision.snapshot),
                  createdAt: new Date(revision.createdAt),
                })),
              },
            },
          });
        }
      });
    })().catch((error) => {
      legacyImportPromise = null;
      throw error;
    });
  }

  await legacyImportPromise;
}

async function fetchArtifactRecord(userId: string, artifactId: string) {
  await ensureLegacyImported();
  return prisma.artifact.findFirst({
    where: { id: artifactId, userId },
    include: {
      sections: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      revisions: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function listArtifacts(
  userId: string,
  filters: {
    workspaceId?: string | null;
    status?: ArtifactStatus | null;
    type?: ArtifactType | null;
    q?: string | null;
  } = {}
): Promise<StoredArtifact[]> {
  await ensureLegacyImported();
  const query = filters.q?.trim();
  const records = await prisma.artifact.findMany({
    where: {
      userId,
      workspaceId: filters.workspaceId || undefined,
      status: filters.status || undefined,
      type: filters.type || undefined,
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { summary: { contains: query } },
              { tags: { contains: query } },
              { sections: { some: { heading: { contains: query } } } },
              { sections: { some: { body: { contains: query } } } },
            ],
          }
        : {}),
    },
    include: {
      sections: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      revisions: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return records.map(mapArtifactRecord);
}

export async function getArtifact(userId: string, artifactId: string): Promise<StoredArtifact | null> {
  const record = await fetchArtifactRecord(userId, artifactId);
  return record ? mapArtifactRecord(record) : null;
}

export async function createArtifact(
  userId: string,
  input: {
    workspaceId: string;
    title: string;
    type?: ArtifactType;
    status?: ArtifactStatus;
    summary?: string;
    tags?: unknown;
    sections?: Array<{
      heading?: string;
      kind?: ArtifactSectionKind;
      body?: string;
      position?: number;
    }>;
  }
): Promise<StoredArtifact> {
  await ensureLegacyImported();
  const type = input.type || 'document';
  const status = input.status || 'draft';
  const created = await prisma.$transaction(async (tx) => {
    const artifact = await tx.artifact.create({
      data: {
        userId,
        workspaceId: input.workspaceId,
        title: input.title.trim(),
        type,
        status,
        summary: input.summary?.trim() || null,
        tags: JSON.stringify(normalizeTags(input.tags)),
        sections: {
          create: (input.sections || []).map((section, index) => ({
            heading: section.heading?.trim() || `Section ${index + 1}`,
            kind: section.kind || 'document/markdown',
            body: section.body || '',
            position: typeof section.position === 'number' ? section.position : index,
          })),
        },
      },
      include: {
        sections: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
        revisions: true,
      },
    });

    const mapped = mapArtifactRecord({ ...artifact, revisions: [] });
    await tx.artifactRevision.create({
      data: {
        artifactId: artifact.id,
        reason: 'created',
        snapshot: serializeSnapshot(mapped),
      },
    });

    return tx.artifact.findUniqueOrThrow({
      where: { id: artifact.id },
      include: {
        sections: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
    });
  });

  return mapArtifactRecord(created);
}

export async function updateArtifact(
  userId: string,
  artifactId: string,
  input: {
    title?: string;
    type?: ArtifactType;
    status?: ArtifactStatus;
    summary?: string | null;
    tags?: unknown;
  }
): Promise<StoredArtifact | null> {
  await ensureLegacyImported();
  const existing = await fetchArtifactRecord(userId, artifactId);
  if (!existing) return null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.artifact.update({
      where: { id: artifactId },
      data: {
        title: typeof input.title === 'string' && input.title.trim() ? input.title.trim() : undefined,
        type: input.type,
        status: input.status,
        summary: input.summary !== undefined ? input.summary?.trim() || null : undefined,
        tags: input.tags !== undefined ? JSON.stringify(normalizeTags(input.tags)) : undefined,
      },
    });

    const record = await tx.artifact.findUniqueOrThrow({
      where: { id: artifactId },
      include: {
        sections: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
    });

    const mapped = mapArtifactRecord(record);
    await tx.artifactRevision.create({
      data: {
        artifactId,
        reason: 'updated',
        snapshot: serializeSnapshot(mapped),
      },
    });

    return tx.artifact.findUniqueOrThrow({
      where: { id: artifactId },
      include: {
        sections: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
    });
  });

  return mapArtifactRecord(updated);
}

export async function deleteArtifact(userId: string, artifactId: string): Promise<boolean> {
  await ensureLegacyImported();
  const existing = await fetchArtifactRecord(userId, artifactId);
  if (!existing) return false;
  await prisma.artifact.delete({ where: { id: artifactId } });
  return true;
}

export async function addArtifactSection(
  userId: string,
  artifactId: string,
  input: {
    heading: string;
    kind?: ArtifactSectionKind;
    body?: string;
    position?: number;
  }
): Promise<StoredArtifactSection | null> {
  await ensureLegacyImported();
  const existing = await fetchArtifactRecord(userId, artifactId);
  if (!existing) return null;

  const record = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const currentCount = await tx.artifactSection.count({ where: { artifactId } });
    const section = await tx.artifactSection.create({
      data: {
        artifactId,
        heading: input.heading.trim(),
        kind: input.kind || 'document/markdown',
        body: input.body || '',
        position: typeof input.position === 'number' ? input.position : currentCount,
      },
    });
    await tx.artifact.update({
      where: { id: artifactId },
      data: { updatedAt: now },
    });

    const artifact = await tx.artifact.findUniqueOrThrow({
      where: { id: artifactId },
      include: {
        sections: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
    });
    const mapped = mapArtifactRecord(artifact);
    await tx.artifactRevision.create({
      data: {
        artifactId,
        reason: `section:${section.id}:created`,
        snapshot: serializeSnapshot(mapped),
      },
    });

    return tx.artifactSection.findUniqueOrThrow({ where: { id: section.id } });
  });

  return {
    id: record.id,
    artifactId: record.artifactId,
    heading: record.heading,
    kind: record.kind as ArtifactSectionKind,
    body: record.body,
    position: record.position,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function updateArtifactSection(
  userId: string,
  artifactId: string,
  sectionId: string,
  input: {
    heading?: string;
    kind?: ArtifactSectionKind;
    body?: string;
    position?: number;
  }
): Promise<StoredArtifactSection | null> {
  await ensureLegacyImported();
  const existing = await fetchArtifactRecord(userId, artifactId);
  if (!existing) return null;
  const hasSection = existing.sections.some((section) => section.id === sectionId);
  if (!hasSection) return null;

  const record = await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.artifactSection.update({
      where: { id: sectionId },
      data: {
        heading: typeof input.heading === 'string' && input.heading.trim() ? input.heading.trim() : undefined,
        kind: input.kind,
        body: typeof input.body === 'string' ? input.body : undefined,
        position: typeof input.position === 'number' ? input.position : undefined,
      },
    });
    await tx.artifact.update({
      where: { id: artifactId },
      data: { updatedAt: now },
    });

    const artifact = await tx.artifact.findUniqueOrThrow({
      where: { id: artifactId },
      include: {
        sections: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
    });
    const mapped = mapArtifactRecord(artifact);
    await tx.artifactRevision.create({
      data: {
        artifactId,
        reason: `section:${sectionId}:updated`,
        snapshot: serializeSnapshot(mapped),
      },
    });

    return tx.artifactSection.findUniqueOrThrow({ where: { id: sectionId } });
  });

  return {
    id: record.id,
    artifactId: record.artifactId,
    heading: record.heading,
    kind: record.kind as ArtifactSectionKind,
    body: record.body,
    position: record.position,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function deleteArtifactSection(
  userId: string,
  artifactId: string,
  sectionId: string
): Promise<boolean> {
  await ensureLegacyImported();
  const existing = await fetchArtifactRecord(userId, artifactId);
  if (!existing) return false;
  const hasSection = existing.sections.some((section) => section.id === sectionId);
  if (!hasSection) return false;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.artifactSection.delete({ where: { id: sectionId } });
    await tx.artifact.update({
      where: { id: artifactId },
      data: { updatedAt: now },
    });
    const artifact = await tx.artifact.findUniqueOrThrow({
      where: { id: artifactId },
      include: {
        sections: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
    });
    const mapped = mapArtifactRecord(artifact);
    await tx.artifactRevision.create({
      data: {
        artifactId,
        reason: `section:${sectionId}:deleted`,
        snapshot: serializeSnapshot(mapped),
      },
    });
  });

  return true;
}

export async function listArtifactRevisions(
  userId: string,
  artifactId: string
): Promise<StoredArtifactRevision[]> {
  const artifact = await getArtifact(userId, artifactId);
  return artifact?.revisions ?? [];
}

export async function getArtifactStatsByWorkspace(
  userId: string
): Promise<Array<{ workspaceId: string; total: number; drafts: number; final: number; updatedAt: string }>> {
  await ensureLegacyImported();
  const [totals, drafts, finals, latest] = await Promise.all([
    prisma.artifact.groupBy({
      by: ['workspaceId'],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.artifact.groupBy({
      by: ['workspaceId'],
      where: { userId, status: 'draft' },
      _count: { _all: true },
    }),
    prisma.artifact.groupBy({
      by: ['workspaceId'],
      where: { userId, status: 'final' },
      _count: { _all: true },
    }),
    prisma.artifact.groupBy({
      by: ['workspaceId'],
      where: { userId },
      _max: { updatedAt: true },
    }),
  ]);

  const draftsByWorkspace = new Map(drafts.map((entry) => [entry.workspaceId, entry._count._all]));
  const finalsByWorkspace = new Map(finals.map((entry) => [entry.workspaceId, entry._count._all]));
  const latestByWorkspace = new Map(
    latest.map((entry) => [entry.workspaceId, entry._max.updatedAt?.toISOString() || new Date(0).toISOString()])
  );

  return totals
    .map((entry) => ({
      workspaceId: entry.workspaceId,
      total: entry._count._all,
      drafts: draftsByWorkspace.get(entry.workspaceId) || 0,
      final: finalsByWorkspace.get(entry.workspaceId) || 0,
      updatedAt: latestByWorkspace.get(entry.workspaceId) || new Date(0).toISOString(),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
