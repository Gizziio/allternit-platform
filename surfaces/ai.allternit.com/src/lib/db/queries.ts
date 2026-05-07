/**
 * Database queries for document operations
 * Uses the SQLite client (better-sqlite3) for standalone/desktop/tunnel builds.
 * The postgres client (client.ts) is only used when DATABASE_URL points to postgres.
 */

import { eq } from "drizzle-orm";
import { db } from "./client-sqlite";
import { document } from "./schema-sqlite";

export interface DocumentData {
  id: string;
  title: string;
  content: string;
  kind: "text" | "code" | "sheet";
  userId: string;
  chatId?: string;
  messageId?: string;
  createdAt: Date;
}

/**
 * Create a new document
 */
export async function createDocument(data: Partial<DocumentData>): Promise<DocumentData> {
  const result = await db
    .insert(document)
    .values({
      id: data.id ?? crypto.randomUUID(),
      title: data.title ?? "Untitled",
      content: data.content ?? "",
      kind: (data.kind as "text" | "code" | "sheet") ?? "text",
      userId: data.userId!,
      messageId: data.messageId ?? data.chatId!,
    })
    .returning();

  return result[0] as unknown as DocumentData;
}

/**
 * Save (create or update) a document
 */
export async function saveDocument(data: Partial<DocumentData> & { id: string }): Promise<DocumentData> {
  const existing = await getDocumentById(data.id);

  if (existing) {
    return updateDocument(data.id, data);
  }

  return createDocument(data);
}

/**
 * Get a document by ID
 */
export async function getDocumentById(id: string): Promise<DocumentData | null> {
  const result = await db.select().from(document).where(eq(document.id, id));
  return (result[0] as unknown as DocumentData) ?? null;
}

/**
 * Update an existing document
 */
export async function updateDocument(
  id: string,
  data: Partial<DocumentData>
): Promise<DocumentData> {
  const updateData: Partial<typeof document.$inferInsert> = {};
  
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.kind !== undefined) updateData.kind = data.kind;
  
  const result = await db
    .update(document)
    .set(updateData)
    .where(eq(document.id, id))
    .returning();

  if (!result[0]) {
    throw new Error(`Document ${id} not found`);
  }

  return result[0] as unknown as DocumentData;
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  await db.delete(document).where(eq(document.id, id));
}
