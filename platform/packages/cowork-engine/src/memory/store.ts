type PrismaClient = any;
import type { CoworkMemoryEntry, CoworkMemoryCreateInput, CoworkMemoryEntryType } from './types.js';

export interface CoworkMemoryStore {
  add(input: CoworkMemoryCreateInput): Promise<CoworkMemoryEntry>;
  get(id: string): Promise<CoworkMemoryEntry | null>;
  list(params: { userId: string; projectId?: string | null; sessionId?: string | null; type?: CoworkMemoryEntryType; tags?: string[]; limit?: number }): Promise<CoworkMemoryEntry[]>;
  update(id: string, updates: Partial<Pick<CoworkMemoryEntry, 'content' | 'type' | 'tags'>>): Promise<CoworkMemoryEntry>;
  delete(id: string): Promise<void>;
  deleteBySession(sessionId: string): Promise<void>;
  deleteByProject(projectId: string): Promise<void>;
}

function rowToEntry(row: any): CoworkMemoryEntry {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId ?? null,
    sessionId: row.sessionId ?? null,
    content: row.content,
    type: row.type as CoworkMemoryEntryType,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
    source: row.source ?? null,
    createdAt: row.createdAt,
  };
}

export function createCoworkMemoryStore(prisma: PrismaClient): CoworkMemoryStore {
  return {
    async add(input) {
      const row = await prisma.coworkMemoryEntry.create({
        data: {
          userId: input.userId,
          projectId: input.projectId ?? null,
          sessionId: input.sessionId ?? null,
          content: input.content,
          type: input.type ?? 'context',
          tags: JSON.stringify(input.tags ?? []),
          source: input.source ?? null,
        },
      });
      return rowToEntry(row);
    },

    async get(id) {
      const row = await prisma.coworkMemoryEntry.findUnique({ where: { id } });
      return row ? rowToEntry(row) : null;
    },

    async list({ userId, projectId, sessionId, type, tags, limit = 50 }) {
      const where: any = { userId };
      if (projectId !== undefined) where.projectId = projectId;
      if (sessionId !== undefined) where.sessionId = sessionId;
      if (type) where.type = type;
      const rows = await prisma.coworkMemoryEntry.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
      const entries = rows.map(rowToEntry);
      if (tags && tags.length > 0) {
        return entries.filter((entry: CoworkMemoryEntry) => tags.some((tag: string) => entry.tags.includes(tag)));
      }
      return entries;
    },

    async update(id, updates) {
      const data: any = {};
      if (updates.content !== undefined) data.content = updates.content;
      if (updates.type !== undefined) data.type = updates.type;
      if (updates.tags !== undefined) data.tags = JSON.stringify(updates.tags);
      const row = await prisma.coworkMemoryEntry.update({ where: { id }, data });
      return rowToEntry(row);
    },

    async delete(id) {
      await prisma.coworkMemoryEntry.delete({ where: { id } });
    },

    async deleteBySession(sessionId) {
      await prisma.coworkMemoryEntry.deleteMany({ where: { sessionId } });
    },

    async deleteByProject(projectId) {
      await prisma.coworkMemoryEntry.deleteMany({ where: { projectId } });
    },
  };
}
