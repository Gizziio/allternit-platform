/**
 * Resume Stream API
 * GET /api/chat/stream/resume?streamId=xxx
 * Returns stored chunks and state for resuming a stream
 */

import { NextRequest } from 'next/server';
import { resumeStream, getActiveStreamForChat } from '@/lib/stream/resumable-stream';
import { auth } from '@/lib/auth-sqlite';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('api:stream:resume');

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { searchParams } = new URL(req.url);
    const streamId = searchParams.get('streamId');
    const chatId = searchParams.get('chatId');

    // If no streamId provided, check for active stream in chat
    let targetStreamId = streamId;
    if (!targetStreamId && chatId) {
      targetStreamId = await getActiveStreamForChat(chatId);
    }

    if (!targetStreamId) {
      return new Response(
        JSON.stringify({ error: 'No active stream found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await resumeStream(targetStreamId);

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Stream not found or expired' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    log.info({ 
      streamId: targetStreamId, 
      userId,
      chunkCount: result.chunks.length 
    }, 'Stream resumed');

    return new Response(
      JSON.stringify({
        success: true,
        streamId: targetStreamId,
        state: result.state,
        chunks: result.chunks,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    log.error({ error }, 'Failed to resume stream');
    return new Response(
      JSON.stringify({ 
        error: 'Failed to resume stream',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
