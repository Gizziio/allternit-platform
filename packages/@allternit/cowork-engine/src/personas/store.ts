type PrismaClient = any;
import type { CoworkPersona, CoworkPersonaCreateInput } from './types.js';
import { BUILT_IN_PERSONAS } from './types.js';

export interface CoworkPersonaStore {
  list(userId: string): Promise<CoworkPersona[]>;
  get(id: string): Promise<CoworkPersona | null>;
  create(input: CoworkPersonaCreateInput): Promise<CoworkPersona>;
  update(id: string, updates: Partial<Omit<CoworkPersonaCreateInput, 'userId'>>): Promise<CoworkPersona>;
  delete(id: string): Promise<void>;
  getDefault(userId: string): Promise<CoworkPersona | null>;
  ensureBuiltIns(userId: string): Promise<void>;
}

function rowToPersona(row: any): CoworkPersona {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? null,
    systemPrompt: row.systemPrompt,
    tools: row.tools ? (JSON.parse(row.tools) as string[]) : [],
    isDefault: row.isDefault ?? false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createCoworkPersonaStore(prisma: PrismaClient): CoworkPersonaStore {
  return {
    async list(userId) {
      const rows = await prisma.coworkPersona.findMany({ where: { userId }, orderBy: { name: 'asc' } });
      return rows.map(rowToPersona);
    },

    async get(id) {
      const row = await prisma.coworkPersona.findUnique({ where: { id } });
      return row ? rowToPersona(row) : null;
    },

    async create(input) {
      if (input.isDefault) {
        await prisma.coworkPersona.updateMany({ where: { userId: input.userId, isDefault: true }, data: { isDefault: false } });
      }
      const row = await prisma.coworkPersona.create({
        data: {
          userId: input.userId,
          name: input.name,
          description: input.description ?? null,
          systemPrompt: input.systemPrompt,
          tools: JSON.stringify(input.tools ?? []),
          isDefault: input.isDefault ?? false,
        },
      });
      return rowToPersona(row);
    },

    async update(id, updates) {
      const data: any = {};
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.systemPrompt !== undefined) data.systemPrompt = updates.systemPrompt;
      if (updates.tools !== undefined) data.tools = JSON.stringify(updates.tools);
      if (updates.isDefault !== undefined) {
        if (updates.isDefault) {
          const existing = await prisma.coworkPersona.findUnique({ where: { id }, select: { userId: true } });
          if (existing) {
            await prisma.coworkPersona.updateMany({ where: { userId: existing.userId, isDefault: true }, data: { isDefault: false } });
          }
        }
        data.isDefault = updates.isDefault;
      }
      const row = await prisma.coworkPersona.update({ where: { id }, data });
      return rowToPersona(row);
    },

    async delete(id) {
      await prisma.coworkPersona.delete({ where: { id } });
    },

    async getDefault(userId) {
      const row = await prisma.coworkPersona.findFirst({ where: { userId, isDefault: true } });
      if (row) return rowToPersona(row);
      const first = await prisma.coworkPersona.findFirst({ where: { userId }, orderBy: { name: 'asc' } });
      return first ? rowToPersona(first) : null;
    },

    async ensureBuiltIns(userId) {
      const existing = await prisma.coworkPersona.findMany({ where: { userId }, select: { name: true } });
      const names = new Set(existing.map((r: any) => r.name));
      for (const p of BUILT_IN_PERSONAS) {
        if (!names.has(p.name)) {
          await prisma.coworkPersona.create({
            data: {
              userId,
              name: p.name,
              description: p.description ?? null,
              systemPrompt: p.systemPrompt,
              tools: JSON.stringify(p.tools ?? []),
              isDefault: p.isDefault ?? false,
            },
          });
        }
      }
    },
  };
}
