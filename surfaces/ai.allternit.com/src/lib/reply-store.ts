/**
 * reply-store.ts
 *
 * Thin persistence layer for completed replies.
 * Called by the streaming handler once a reply reaches terminal state.
 */

import { prisma } from '@/lib/db';
import type { ReplyItem, ReplyStatus } from '@/types/replies-contract';

export interface StoredReply {
  id: string;
  conversationId: string;
  status: ReplyStatus;
  items: ReplyItem[];
  createdAt: Date;
  updatedAt: Date;
}

export async function upsertReply(
  id: string,
  conversationId: string,
  status: ReplyStatus,
  items: ReplyItem[],
): Promise<void> {
  await prisma.reply.upsert({
    where: { id },
    create: { id, conversationId, status, content: JSON.stringify(items) },
    update: { status, content: JSON.stringify(items) },
  });
}

export async function getReply(id: string): Promise<StoredReply | null> {
  const row = await prisma.reply.findUnique({ where: { id } });
  if (!row) return null;
  let items: ReplyItem[] = [];
  try { items = JSON.parse(row.content) as ReplyItem[]; } catch { /* ignore */ }
  return {
    id: row.id,
    conversationId: row.conversationId,
    status: row.status as ReplyStatus,
    items,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getRepliesForConversation(conversationId: string): Promise<StoredReply[]> {
  const rows = await prisma.reply.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => {
    let items: ReplyItem[] = [];
    try { items = JSON.parse(row.content) as ReplyItem[]; } catch { /* ignore */ }
    return {
      id: row.id,
      conversationId: row.conversationId,
      status: row.status as ReplyStatus,
      items,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}
