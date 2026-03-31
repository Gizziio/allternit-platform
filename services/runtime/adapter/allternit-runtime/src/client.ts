export type RuntimeEvent =
  | { t: 'run.started'; runId: string }
  | { t: 'model.output'; runId: string; text: string }
  | { t: 'tool.started'; runId: string; tool: string; input: any }
  | { t: 'tool.output'; runId: string; tool: string; output: any }
  | { t: 'run.finished'; runId: string; status: 'ok' | 'error'; result?: any; error?: string }
  | { t: 'artifact.created'; runId: string; kind: string; content: string; title: string };

export class RuntimeClient {
  constructor(private baseUrl: string = 'http://127.0.0.1:3009') {}

  async runAgent(prompt: string, onEvent: (ev: RuntimeEvent) => void, modelId: string = 'codex'): Promise<void> {
    const response = await fetch(this.baseUrl + '/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, modelId })
    });

    if (!response.ok) throw new Error('Failed to start agent run');
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent(data);
          } catch (e) {
            console.error('Failed to parse SSE event', e);
          }
        }
      }
    }
  }
}
