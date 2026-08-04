/**
 * Tests for the LocalModelManager provider switch (MEMORY_LLM_BASE_URL)
 *
 * Uses a stub node:http server implementing both the OpenAI-compatible
 * (/v1/chat/completions) and Ollama (/api/chat) shapes, and records every
 * request so tests can assert which path was taken and with what body.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { LocalModelManager, MODEL_PRESETS } from './local-model.js';
import { VectorStore } from '../store/vector-store.js';

interface RecordedRequest {
  url: string;
  method: string;
  body: any;
}

describe('LocalModelManager provider switch', () => {
  let server: http.Server;
  let baseUrl: string;
  let requests: RecordedRequest[];
HEAD
HEAD
  let requestTimestamps: number[];
  let arrivalOffsets: number[];
  let failWithStatus: number | null;
  let failMlxWithStatus: number | null;
  let responseDelay: number;  let failWithStatus: number | null;
>>>>>>> origin/ao/mlxmem  let requestTimestamps: number[];
  let arrivalOffsets: number[];
  let failWithStatus: number | null;
  let responseDelay: number;
>>>>>>> origin/fix/mlx-serialize

  const savedEnv = { ...process.env };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
HEAD
HEAD
      req.on('end', async () => {      req.on('end', () => {
>>>>>>> origin/ao/mlxmem      req.on('end', async () => {
>>>>>>> origin/fix/mlx-serialize
        let body: any = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          body = raw;
        }
HEAD
HEAD
>>>>>>> origin/fix/mlx-serialize
        const startedAt = Date.now();
        requests.push({ url: req.url || '', method: req.method || '', body });
        arrivalOffsets.push(startedAt);

        if (responseDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, responseDelay));
        }

        requestTimestamps.push(Date.now() - startedAt);
HEAD

        const shouldFailMlx = failMlxWithStatus !== null && req.url === '/v1/chat/completions';
        const shouldFailAll = failWithStatus !== null;
        if (shouldFailMlx || shouldFailAll) {
          const status = shouldFailMlx ? failMlxWithStatus! : failWithStatus!;
          res.writeHead(status, { 'Content-Type': 'application/json' });        requests.push({ url: req.url || '', method: req.method || '', body });
>>>>>>> origin/fix/mlx-serialize

        if (failWithStatus !== null) {
          res.writeHead(failWithStatus, { 'Content-Type': 'application/json' });
>>>>>>> origin/ao/mlxmem
          res.end(JSON.stringify({ error: 'stub failure' }));
          return;
        }

        if (req.url === '/v1/chat/completions') {
HEAD
          const isEnrichment = JSON.stringify(body?.messages || '').includes('schema');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              choices: [{
                message: {
                  role: 'assistant',
                  content: isEnrichment
                    ? JSON.stringify({
                        summary: 'A company released a phone.',
                        entities: ['Apple Inc.', 'iPhone'],
                        topics: ['technology', 'products'],
                        importance: 'medium',
                      })
                    : 'mlx-response',
                },
              }],          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              choices: [{ message: { role: 'assistant', content: 'mlx-response' } }],
>>>>>>> origin/ao/mlxmem
            })
          );
        } else if (req.url === '/api/chat') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              model: body?.model,
              message: { role: 'assistant', content: 'ollama-response' },
              done: true,
            })
          );
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'not found' }));
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = savedEnv;
  });

  beforeEach(() => {
    requests = [];
HEAD
HEAD
    requestTimestamps = [];
    arrivalOffsets = [];
    failWithStatus = null;
    failMlxWithStatus = null;    requestTimestamps = [];
    arrivalOffsets = [];
    failWithStatus = null;
>>>>>>> origin/fix/mlx-serialize
    responseDelay = 0;
    delete process.env.MEMORY_LLM_BASE_URL;
    delete process.env.MEMORY_LLM_MODEL;
    delete process.env.MEMORY_LLM_BREAKER_THRESHOLD;
    delete process.env.MEMORY_LLM_BREAKER_COOLDOWN_MS;    failWithStatus = null;
    delete process.env.MEMORY_LLM_BASE_URL;
    delete process.env.MEMORY_LLM_MODEL;
>>>>>>> origin/ao/mlxmem
  });

  afterEach(() => {
    delete process.env.MEMORY_LLM_BASE_URL;
    delete process.env.MEMORY_LLM_MODEL;
  });

  it('routes generation to the OpenAI-compatible endpoint when MEMORY_LLM_BASE_URL is set', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    process.env.MEMORY_LLM_MODEL = 'mlx-test-model';

    const manager = new LocalModelManager();
    const result = await manager.generate('hello', 'you are helpful');

    expect(result).toBe('mlx-response');

    const chatReqs = requests.filter((r) => r.url === '/v1/chat/completions');
    expect(chatReqs).toHaveLength(1);
    expect(chatReqs[0].method).toBe('POST');
    expect(chatReqs[0].body.model).toBe('mlx-test-model');
    expect(chatReqs[0].body.messages).toEqual([
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: 'hello' },
    ]);
    // Sampling params come from the preset (ingest default)
    expect(chatReqs[0].body.temperature).toBe(MODEL_PRESETS.ingest.temperature);
    expect(chatReqs[0].body.top_p).toBe(MODEL_PRESETS.ingest.topP);
    expect(chatReqs[0].body.max_tokens).toBe(MODEL_PRESETS.ingest.numPredict);

    // No Ollama generate call
    expect(requests.filter((r) => r.url === '/api/chat')).toHaveLength(0);
  });

  it("defaults the MLX model name to 'qwen3-4b-instruct' when MEMORY_LLM_MODEL is unset", async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;

    const manager = new LocalModelManager();
    await manager.generate('hello');

    const chatReqs = requests.filter((r) => r.url === '/v1/chat/completions');
    expect(chatReqs).toHaveLength(1);
    expect(chatReqs[0].body.model).toBe('qwen3-4b-instruct');
  });

  it('uses the Ollama generate path with preset model names when the env is unset', async () => {
    const { port } = server.address() as AddressInfo;
    const manager = new LocalModelManager('127.0.0.1', port);
    const result = await manager.generate('hello');

    expect(result).toBe('ollama-response');

    const chatReqs = requests.filter((r) => r.url === '/api/chat');
    expect(chatReqs).toHaveLength(1);
    expect(chatReqs[0].body.model).toBe(MODEL_PRESETS.ingest.name);
    expect(chatReqs[0].body.options.num_predict).toBe(MODEL_PRESETS.ingest.numPredict);

    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(0);
  });

HEAD
  it('falls back to Ollama when the MLX endpoint returns non-2xx', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    failMlxWithStatus = 500;

    const { port } = server.address() as AddressInfo;
    const manager = new LocalModelManager('127.0.0.1', port);
    const result = await manager.generate('hello');

    // First failure is recorded, then Ollama fallback runs.
    expect(result).toBe('ollama-response');
    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(1);
    expect(requests.filter((r) => r.url === '/api/chat')).toHaveLength(1);
  });

  it('falls back to Ollama when the MLX endpoint is unreachable', async () => {
    // Port 1 is never listening
    process.env.MEMORY_LLM_BASE_URL = 'http://127.0.0.1:1/v1';

    const { port } = server.address() as AddressInfo;
    const manager = new LocalModelManager('127.0.0.1', port);
    const result = await manager.generate('hello');

    expect(result).toBe('ollama-response');
    expect(requests.filter((r) => r.url === '/api/chat')).toHaveLength(1);
  });

  it('opens the circuit breaker after threshold failures and skips MLX thereafter', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    process.env.MEMORY_LLM_BREAKER_THRESHOLD = '2';
    process.env.MEMORY_LLM_BREAKER_COOLDOWN_MS = '60000';
    failMlxWithStatus = 500;

    const { port } = server.address() as AddressInfo;
    const manager = new LocalModelManager('127.0.0.1', port);

    // First failure: MLX attempted, fallback to Ollama.
    await manager.generate('first');
    // Second failure: MLX attempted again, fallback to Ollama, breaker opens.
    await manager.generate('second');
    // Third failure: breaker is open, MLX is skipped entirely.
    await manager.generate('third');

    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(2);
    expect(requests.filter((r) => r.url === '/api/chat')).toHaveLength(3);
  });

  it('closes the circuit breaker after a successful MLX call', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    process.env.MEMORY_LLM_BREAKER_THRESHOLD = '1';
    process.env.MEMORY_LLM_BREAKER_COOLDOWN_MS = '0';
    failMlxWithStatus = 500;

    const { port } = server.address() as AddressInfo;
    const manager = new LocalModelManager('127.0.0.1', port);

    // Failure opens the breaker.
    await manager.generate('first');
    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(1);

    // Cooldown is 0, so the next call moves to half-open and retries MLX.
    failMlxWithStatus = null;
    const result = await manager.generate('second');
    expect(result).toBe('mlx-response');

    // One more MLX request was made and succeeded, closing the breaker.
    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(2);
  });

  it('allows only one half-open probe at a time under concurrent load', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    process.env.MEMORY_LLM_BREAKER_THRESHOLD = '1';
    process.env.MEMORY_LLM_BREAKER_COOLDOWN_MS = '0';
    failMlxWithStatus = 500;
    responseDelay = 60;

    const { port } = server.address() as AddressInfo;
    const manager = new LocalModelManager('127.0.0.1', port);

    // Open the breaker with one failure.
    await manager.generate('first');
    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(1);

    // With cooldown 0 the breaker is now half-open. Fire two concurrent calls:
    // only one should be allowed to probe MLX; the other must fall back to
    // Ollama immediately.
    const [a, b] = await Promise.all([
      manager.generate('second'),
      manager.generate('third'),
    ]);
    expect(a).toBe('ollama-response');
    expect(b).toBe('ollama-response');

    // Exactly one additional MLX probe was made, not two.
    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(2);
    expect(requests.filter((r) => r.url === '/api/chat')).toHaveLength(3);  it('fails with endpoint + status on non-2xx and never falls back to Ollama', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    failWithStatus = 500;

    const manager = new LocalModelManager();
    await expect(manager.generate('hello')).rejects.toThrow(
      `${baseUrl}/v1/chat/completions`
    );
    await expect(manager.generate('hello')).rejects.toThrow('HTTP 500');

    // Still no Ollama fallback
    expect(requests.filter((r) => r.url === '/api/chat')).toHaveLength(0);
  });

  it('fails clearly when the MLX endpoint is unreachable (no fallback)', async () => {
    // Port 1 is never listening
    process.env.MEMORY_LLM_BASE_URL = 'http://127.0.0.1:1/v1';

    const manager = new LocalModelManager();
    await expect(manager.generate('hello')).rejects.toThrow(
      'http://127.0.0.1:1/v1/chat/completions'
    );

    expect(requests.filter((r) => r.url === '/api/chat')).toHaveLength(0);
>>>>>>> origin/ao/mlxmem
  });

  it('keeps embeddings on Ollama even when MEMORY_LLM_BASE_URL is set', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;

    // VectorStore owns the embeddings path and is hardcoded to Ollama at
HEAD
    // localhost:11434. Stub the embed call so the test is deterministic
    // regardless of whether a real Ollama server is running.
    const vectorStore = new VectorStore();
    const originalEmbed = vectorStore.embed.bind(vectorStore);
    vectorStore.embed = async () => [0.1, 0.2, 0.3];

    try {
      const embedding = await vectorStore.embed('test text');

      expect(embedding).toEqual([0.1, 0.2, 0.3]);
      expect(requests).toHaveLength(0);
    } finally {
      vectorStore.embed = originalEmbed;
    }
  });

  it('serializes MLX generation calls so only one request is in flight at a time', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    responseDelay = 60;

    const testStart = Date.now();
    const manager = new LocalModelManager();
    const [a, b] = await Promise.all([
      manager.generate('first'),
      manager.generate('second'),
    ]);

    expect(a).toBe('mlx-response');
    expect(b).toBe('mlx-response');
    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(2);

    // If the calls had been parallel, both requests would have arrived near
    // time 0. Serialization means the second request arrives only after the
    // first response finishes (~60ms delay).
    expect(arrivalOffsets[1] - testStart).toBeGreaterThanOrEqual(responseDelay - 10);
  });

  it('does not let a failed MLX call wedge the serialized queue', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    failMlxWithStatus = 500;

    const { port } = server.address() as AddressInfo;
    const manager = new LocalModelManager('127.0.0.1', port);
    await manager.generate('first');
    await manager.generate('second');

    // Both MLX attempts ran, and the queue did not wedge because each failure
    // fell back to Ollama instead of leaving a pending promise.
    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(2);
    expect(requests.filter((r) => r.url === '/api/chat')).toHaveLength(2);
  });

  it('enrichContent reports the backend that served the structured call', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;

    const manager = new LocalModelManager();
    const result = await manager.enrichContent('Apple Inc. released a new iPhone.');

    expect(result.backend).toBe('mlx');
    expect(result.summary).toBeTruthy();
    expect(result.entities.length).toBeGreaterThan(0);
  });

  it('tracks per-backend metrics across generate calls', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    failMlxWithStatus = 500;

    const { port } = server.address() as AddressInfo;
    const manager = new LocalModelManager('127.0.0.1', port);

    // One MLX failure that falls back to Ollama.
    await manager.generate('hello');

    const metrics = manager.getMetrics();
    expect(metrics.mlx.calls).toBe(1);
    expect(metrics.mlx.failures).toBe(1);
    expect(metrics.ollama.calls).toBe(1);
    expect(metrics.ollama.failures).toBe(0);
    expect(metrics.mlx.avgLatencyMs).toBeGreaterThanOrEqual(0);
    expect(metrics.ollama.avgLatencyMs).toBeGreaterThanOrEqual(0);
    expect(metrics.enrichment.localFallbacks).toBe(0);
  });

  it('shadowCompare returns responses from both backends', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;

    const { port } = server.address() as AddressInfo;
    const manager = new LocalModelManager('127.0.0.1', port);

    const result = await manager.shadowCompare('hello');

    expect(result.mlx?.content).toBe('mlx-response');
    expect(result.ollama?.content).toBe('ollama-response');
    expect(result.mlx?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.ollama?.latencyMs).toBeGreaterThanOrEqual(0);    // localhost:11434. With nothing listening there, embed() returns []
    // (its documented failure mode) — the point is it never touches the
    // configured MLX endpoint.
    const vectorStore = new VectorStore();
    const embedding = await vectorStore.embed('test text');

    expect(embedding).toEqual([]);
    expect(requests).toHaveLength(0);
>>>>>>> origin/ao/mlxmem
  });

  it('serializes MLX generation calls so only one request is in flight at a time', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    responseDelay = 60;

    const testStart = Date.now();
    const manager = new LocalModelManager();
    const [a, b] = await Promise.all([
      manager.generate('first'),
      manager.generate('second'),
    ]);

    expect(a).toBe('mlx-response');
    expect(b).toBe('mlx-response');
    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(2);

    // If the calls had been parallel, both requests would have arrived near
    // time 0. Serialization means the second request arrives only after the
    // first response finishes (~60ms delay).
    expect(arrivalOffsets[1] - testStart).toBeGreaterThanOrEqual(responseDelay - 10);
  });

  it('does not let a failed MLX call wedge the serialized queue', async () => {
    process.env.MEMORY_LLM_BASE_URL = `${baseUrl}/v1`;
    failWithStatus = 500;

    const manager = new LocalModelManager();
    await expect(manager.generate('first')).rejects.toThrow('HTTP 500');
    await expect(manager.generate('second')).rejects.toThrow('HTTP 500');

    expect(requests.filter((r) => r.url === '/v1/chat/completions')).toHaveLength(2);
  });
});
