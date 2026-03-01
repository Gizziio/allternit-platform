import { api } from '../api-client';
import { getKernelBridge } from './index.js';
import type { ChatThreadMode } from '../../views/chat/ChatStore';

export async function createThread(
  title: string,
  projectId?: string,
  mode: ChatThreadMode = 'llm',
  agentId?: string | null,
) {
  // Use API client to create a session
  try {
    const session = await api.createSession('default', {
      title,
      projectId,
      mode,
      agentId: agentId || undefined,
    });
    return session.id;
  } catch (error) {
    // Fallback to local stub if API is unavailable
    const bridge = await getKernelBridge();
    const wih = await bridge.kernel.createWih({
      title,
      status: 'draft',
      priority: 50,
      blockedBy: [],
      blocks: [],
      tags: ['session', mode, projectId, agentId || undefined].filter(Boolean) as string[],
      receiptRefs: [],
      artifacts: []
    });
    return wih.id;
  }
}

export async function sendMessage(threadId: string, text: string, sandboxMode: string = "read-only") {
  // Use API client to send message
  try {
    await api.sendMessage(threadId, text);
    // Return a mock readable stream for compatibility
    return new ReadableStream({
      start(controller) {
        controller.close();
      }
    });
  } catch (error) {
    console.warn('[chat] API unavailable, using fallback');
    // Return empty stream as fallback
    return new ReadableStream({
      start(controller) {
        controller.close();
      }
    });
  }
}
