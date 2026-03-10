import { api } from '../api-client';
import type { ChatThreadMode } from '../../views/chat/ChatStore';

export async function createThread(
  title: string,
  projectId?: string,
  mode: ChatThreadMode = 'llm',
  agentId?: string | null,
) {
  // Use API client to create a session
  const session = await api.createSession('default', {
    title,
    projectId,
    mode,
    agentId: agentId || undefined,
  });
  return session.id;
}

export async function sendMessage(threadId: string, text: string, _sandboxMode: string = "read-only") {
  // Use API client to send message
  await api.sendMessage(threadId, text);
  // Return a mock readable stream for compatibility
  return new ReadableStream({
    start(controller) {
      controller.close();
    }
  });
}
