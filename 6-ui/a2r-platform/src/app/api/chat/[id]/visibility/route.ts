/**
 * Chat Visibility API
 * PATCH /api/chat/[id]/visibility
 * Updates the visibility of a chat (public/private)
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth-sqlite';
import { db } from '@/lib/db/client-sqlite';
import { chat } from '@/lib/db/schema-sqlite';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('api:chat:visibility');

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const chatId = params.id;
    const body = await req.json();
    const { visibility } = body;

    if (!visibility || !['public', 'private'].includes(visibility)) {
      return new Response(
        JSON.stringify({ error: 'Invalid visibility value' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify the chat belongs to the user
    const existingChat = await db
      .select()
      .from(chat)
      .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
      .limit(1);

    if (existingChat.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Chat not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update visibility
    await db
      .update(chat)
      .set({ 
        visibility,
        updatedAt: new Date(),
      })
      .where(eq(chat.id, chatId));

    log.info({ 
      chatId, 
      userId, 
      visibility 
    }, 'Chat visibility updated');

    return new Response(
      JSON.stringify({
        success: true,
        chatId,
        visibility,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    log.error({ error, chatId: params.id }, 'Failed to update chat visibility');
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update visibility',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get chat visibility
 * GET /api/chat/[id]/visibility
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const chatId = params.id;

    const existingChat = await db
      .select({
        id: chat.id,
        visibility: chat.visibility,
      })
      .from(chat)
      .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
      .limit(1);

    if (existingChat.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Chat not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        chatId,
        visibility: existingChat[0].visibility,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    log.error({ error, chatId: params.id }, 'Failed to get chat visibility');
    return new Response(
      JSON.stringify({ error: 'Failed to get visibility' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
