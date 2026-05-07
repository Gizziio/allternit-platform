import { prisma } from '@/lib/db';
import { getAuth } from '@/lib/server-auth';

interface Params {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { userId: authUserId } = await getAuth();
  if (!authUserId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { workspaceId } = await params;

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [
        { ownerId: authUserId },
        { members: { some: { userId: authUserId } } },
      ],
    },
  });

  if (!workspace) {
    return new Response('Not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval>;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'));

      // Poll for changes every 3 seconds (simple SSE implementation)
      intervalId = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`));
      }, 3000);

      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(intervalId);
        controller.close();
      });
    },
    cancel() {
      closed = true;
      clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
