/**
 * Worker Message Bus — bidirectional IPC between main process and worker threads.
 *
 * Usage:
 *   workerBus.register('sqlite', new URL('./sqlite-worker.js', import.meta.url));
 *   const result = await workerBus.send('sqlite', { type: 'execQuery', sql: '...' });
 *   workerBus.subscribe('search', (msg) => console.log(msg));
 */

import { Worker, MessageChannel, MessagePort } from 'node:worker_threads';
import { EventEmitter } from 'node:events';
import log from 'electron-log';

export interface WorkerMessage {
  id?: string;
  type: string;
  payload?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface WorkerEntry {
  worker: Worker;
  port: MessagePort;
  url: URL;
  restartCount: number;
  subscribers: Set<(msg: WorkerMessage) => void>;
  pending: Map<string, PendingRequest>;
}

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESTARTS = 5;
const RESTART_BACKOFF_BASE_MS = 500;

class WorkerBus extends EventEmitter {
  private workers = new Map<string, WorkerEntry>();

  /**
   * Register a worker by name and URL.
   * The worker script must import { parentPort } from 'node:worker_threads'
   * and reply to messages with the same `id` field.
   */
  register(name: string, scriptUrl: URL, workerData?: unknown): void {
    if (this.workers.has(name)) {
      log.warn(`[WorkerBus] Worker "${name}" already registered`);
      return;
    }
    this.spawn(name, scriptUrl, workerData, 0);
  }

  /** Send a request to a named worker and wait for a response. */
  send<T = unknown>(name: string, message: Omit<WorkerMessage, 'id'>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
    return new Promise((resolve, reject) => {
      const entry = this.workers.get(name);
      if (!entry) {
        reject(new Error(`[WorkerBus] No worker registered: "${name}"`));
        return;
      }

      const id = `${name}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        entry.pending.delete(id);
        reject(new Error(`[WorkerBus] Request to "${name}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      entry.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      entry.port.postMessage({ ...message, id });
    });
  }

  /** Post a fire-and-forget message to a worker (no reply expected). */
  post(name: string, message: WorkerMessage): void {
    const entry = this.workers.get(name);
    if (!entry) {
      log.warn(`[WorkerBus] post: no worker named "${name}"`);
      return;
    }
    entry.port.postMessage(message);
  }

  /** Subscribe to unsolicited messages from a worker. Returns an unsubscribe fn. */
  subscribe(name: string, handler: (msg: WorkerMessage) => void): () => void {
    const entry = this.workers.get(name);
    if (!entry) {
      log.warn(`[WorkerBus] subscribe: no worker named "${name}"`);
      return () => {};
    }
    entry.subscribers.add(handler);
    return () => entry.subscribers.delete(handler);
  }

  /** Check if a named worker is registered and alive. */
  isAlive(name: string): boolean {
    return this.workers.has(name);
  }

  /** Gracefully terminate all workers. Call on app quit. */
  async shutdown(): Promise<void> {
    const terminations = [...this.workers.entries()].map(([name, entry]) =>
      entry.worker.terminate().then(() => {
        log.info(`[WorkerBus] Worker "${name}" terminated`);
      })
    );
    await Promise.allSettled(terminations);
    this.workers.clear();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private spawn(name: string, url: URL, workerData: unknown, restartCount: number): void {
    const { port1, port2 } = new MessageChannel();

    const worker = new Worker(url, {
      workerData: { port: port2, ...((workerData as object) ?? {}) },
      transferList: [port2],
    });

    const entry: WorkerEntry = {
      worker,
      port: port1,
      url,
      restartCount,
      subscribers: new Set(),
      pending: new Map(),
    };

    port1.on('message', (msg: WorkerMessage) => {
      if (msg.id && entry.pending.has(msg.id)) {
        const req = entry.pending.get(msg.id)!;
        clearTimeout(req.timer);
        entry.pending.delete(msg.id);
        if (msg.error) req.reject(new Error(msg.error));
        else req.resolve(msg.payload);
      } else {
        for (const sub of entry.subscribers) {
          try { sub(msg); } catch { /* never crash on subscriber error */ }
        }
      }
    });

    worker.on('error', (err) => {
      log.error(`[WorkerBus] Worker "${name}" error:`, err);
    });

    worker.on('exit', (code) => {
      log.warn(`[WorkerBus] Worker "${name}" exited (code ${code})`);
      this.workers.delete(name);

      // Reject all pending requests
      for (const req of entry.pending.values()) {
        clearTimeout(req.timer);
        req.reject(new Error(`Worker "${name}" exited unexpectedly (code ${code})`));
      }
      entry.pending.clear();

      // Restart with exponential backoff
      if (restartCount < MAX_RESTARTS) {
        const delay = RESTART_BACKOFF_BASE_MS * Math.pow(2, restartCount);
        log.info(`[WorkerBus] Restarting "${name}" in ${delay}ms (attempt ${restartCount + 1}/${MAX_RESTARTS})`);
        setTimeout(() => {
          this.spawn(name, url, workerData, restartCount + 1);
        }, delay);
      } else {
        log.error(`[WorkerBus] Worker "${name}" exceeded max restarts — giving up`);
        this.emit('worker-dead', name);
      }
    });

    this.workers.set(name, entry);
    log.info(`[WorkerBus] Worker "${name}" started (restart #${restartCount})`);
  }
}

export const workerBus = new WorkerBus();
