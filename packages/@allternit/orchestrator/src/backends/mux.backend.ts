// packages/@allternit/orchestrator/src/backends/mux.backend.ts
// allternit-mux-backed executor sessions (ADR-0044). Same semantics as the
// tmux backend — runner-script spawn, verified send, sentinel-file completion,
// worktree isolation — but the terminal layer is the mux daemon's owned PTYs
// instead of external tmux. Wins over tmux: NDJSON socket control (no
// capture-pane scraping), scrollback that survives daemon restarts, and a
// rendered-screen verified send (vt100) instead of tmux text polling.
//
// State authority is unchanged: the notes sentinel file is the ONLY completion
// signal. Mux agent-state heuristics are never consulted for orchestration.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { connect as netConnect } from 'node:net';
import type {
  ExecutorBackend,
  ExecutorSession,
  Footprint,
  SendResult,
  SessionSpec,
  SessionState,
  WatchOutcome,
} from '../orchestrator.interface.js';
import { readCompletionNotes } from '../completion-contract.js';

const run = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface MuxBackendOptions {
  /** Mux socket. Default: $ALLTERNIT_MUX_SOCKET or ~/.allternit/mux/mux.sock */
  socketPath?: string;
  /** Mux state dir (for transcript paths). Default: $ALLTERNIT_MUX_STATE_DIR or ~/.allternit/mux */
  stateDir?: string;
}

/** Minimal NDJSON client for the mux Unix socket protocol. */
class MuxClient {
  private constructor(private sock: any, private pending: string[]) {}

  static connect(socketPath: string): Promise<MuxClient> {
    return new Promise((resolve, reject) => {
      const pending: string[] = [];
      const client = new MuxClient(null as any, pending);
      const sock = netConnect(socketPath);
      let buffer = '';
      sock.on('connect', () => resolve(client));
      sock.on('error', reject);
      sock.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.trim()) pending.push(line);
        }
      });
      client.sock = sock;
    });
  }

  private nextLine(): Promise<string> {
    if (this.pending.length) return Promise.resolve(this.pending.shift()!);
    return new Promise((resolve, reject) => {
      const onData = () => {
        if (this.pending.length) {
          this.sock.off('data', onData);
          resolve(this.pending.shift()!);
        }
      };
      this.sock.on('data', onData);
      this.sock.once('error', reject);
      this.sock.once('close', () => reject(new Error('mux socket closed')));
    });
  }

  async request(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.sock.write(JSON.stringify({ id, method, params }) + '\n');
    // Skip pushed events; responses carry our id.
    for (;;) {
      const line = await this.nextLine();
      const frame = JSON.parse(line);
      if (frame.id !== id) continue;
      if (frame.error) throw new Error(`${frame.error.code}: ${frame.error.message}`);
      return frame.result;
    }
  }

  close(): void {
    try {
      this.sock.destroy();
    } catch {
      /* already closed */
    }
  }
}

export class MuxBackend implements ExecutorBackend {
  readonly kind = 'mux' as const;
  private socketPath: string;
  private stateDir: string;

  constructor(opts: MuxBackendOptions = {}) {
    const home = homedir();
    this.stateDir =
      opts.stateDir ?? process.env.ALLTERNIT_MUX_STATE_DIR ?? join(home, '.allternit', 'mux');
    this.socketPath =
      opts.socketPath ?? process.env.ALLTERNIT_MUX_SOCKET ?? join(this.stateDir, 'mux.sock');
  }

  private async mux<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const client = await MuxClient.connect(this.socketPath);
    try {
      return await client.request(method, params);
    } finally {
      client.close();
    }
  }

  private transcriptPath(paneId: string): string {
    const sessionId = paneId.slice(0, paneId.lastIndexOf('-'));
    return join(this.stateDir, sessionId, `${paneId}.scrollback`);
  }

  async spawn(spec: SessionSpec): Promise<ExecutorSession> {
    let workdir = spec.workdir;
    if (spec.isolation === 'worktree') {
      workdir = await this.addWorktree(spec.workdir, spec.slug);
    }

    // Same runner-script pattern as the tmux backend: the mux scrollback file
    // is the byte-zero transcript (script(1) equivalent).
    const runner = join(this.stateDir, `ao-${spec.slug}.cmd.sh`);
    await mkdir(this.stateDir, { recursive: true });
    await writeFile(runner, `${spec.launchCommand}\n`, 'utf8');

    const { session } = await this.mux('session.create', {
      label: `ao-${spec.slug}`,
      cwd: workdir,
    });
    const { pane } = await this.mux('pane.create', {
      session_id: session.session_id,
      cols: 200,
      rows: 50,
      command: ['/bin/sh', runner],
      env: { ALLTERNIT_AO_SLUG: spec.slug },
    });
    const paneId: string = pane.pane_id;

    const state = (await this.paneRunning(paneId)) ? 'running' : 'dead';
    return {
      sessionId: paneId,
      slug: spec.slug,
      backend: this.kind,
      vendor: spec.vendor,
      mode: spec.mode,
      state,
      workdir,
      transcriptPath: this.transcriptPath(paneId),
      createdAt: new Date().toISOString(),
    };
  }

  async send(session: ExecutorSession, prompt: string): Promise<SendResult> {
    try {
      await this.mux('pane.send_verified', {
        pane_id: session.sessionId,
        data: prompt,
        timeout_ms: 10_000,
      });
      return { submitted: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        submitted: false,
        reason: msg.includes('no alphanumeric')
          ? 'prompt has no alphanumeric content'
          : 'verification-mismatch',
      };
    }
  }

  async status(session: ExecutorSession): Promise<SessionState> {
    return (await this.paneRunning(session.sessionId)) ? 'running' : 'dead';
  }

  private async paneRunning(paneId: string): Promise<boolean> {
    try {
      const out = await this.mux('pane.get', { pane_id: paneId });
      return out.pane?.process_running === true;
    } catch {
      return false;
    }
  }

  async tail(session: ExecutorSession, lines = 25): Promise<string> {
    const out = await this.mux('pane.read', {
      pane_id: session.sessionId,
      lines,
      source: 'scrollback',
    });
    return out.output ?? '';
  }

  async watch(session: ExecutorSession, spec: SessionSpec): Promise<WatchOutcome> {
    // Identical contract to the tmux backend: the sentinel file is the ONLY
    // completion signal.
    const notesPath = isAbsolute(spec.notesFile) ? spec.notesFile : join(session.workdir, spec.notesFile);
    const timeout = spec.timeoutMs ?? 3_600_000;
    const interval = spec.watchIntervalMs ?? 20_000;
    const deadline = Date.now() + timeout;

    while (true) {
      if (existsSync(notesPath)) {
        return { kind: 'done', report: await readCompletionNotes(notesPath) };
      }
      if ((await this.status(session)) === 'dead') {
        return { kind: 'dead', transcriptPath: session.transcriptPath };
      }
      if (Date.now() >= deadline) return { kind: 'timeout' };
      await sleep(interval);
    }
  }

  async footprint(session: ExecutorSession): Promise<Footprint> {
    const isolated = basename(session.workdir).includes(`-ao-${session.slug}`);
    const { stdout: porcelain } = await run('git', ['-C', session.workdir, 'status', '--porcelain', '-uall']);
    const changedFiles = porcelain
      .split('\n')
      .filter(Boolean)
      .map((l) => l.slice(3).trim());
    let diffStat: string | undefined;
    if (isolated) {
      const { stdout } = await run('git', ['-C', session.workdir, 'diff', '--stat']);
      diffStat = stdout.trim() || undefined;
    }
    return { isolated, changedFiles, diffStat };
  }

  async kill(session: ExecutorSession, opts: { removeWorktree?: boolean } = {}): Promise<void> {
    // Transcripts are review evidence and must outlive the mux session (the
    // tmux backend keeps script(1) logs in the shared ao log dir; mux's
    // session.close deletes its state dir). Archive before closing.
    if (session.transcriptPath && existsSync(session.transcriptPath)) {
      try {
        const logDir = join(homedir(), '.agent-orchestrator', 'logs');
        await mkdir(logDir, { recursive: true });
        const durable = join(logDir, `ao-${session.slug}-mux.log`);
        await copyFile(session.transcriptPath, durable);
        session.transcriptPath = durable;
      } catch {
        /* keep the original path if archiving fails */
      }
    }
    try {
      await this.mux('pane.close', { pane_id: session.sessionId });
    } catch {
      /* pane may already be gone */
    }
    const sessionId = session.sessionId.slice(0, session.sessionId.lastIndexOf('-'));
    try {
      await this.mux('session.close', { session_id: sessionId });
    } catch {
      /* session may already be gone */
    }
    if (opts.removeWorktree && basename(session.workdir).includes(`-ao-${session.slug}`)) {
      await run('git', ['-C', session.workdir, 'worktree', 'remove', '--force', session.workdir]).catch(() => {
        // Worktree may already be gone; branch ao/<slug> is intentionally kept
        // until the work is merged or rejected.
      });
    }
  }

  private async addWorktree(repoDir: string, slug: string): Promise<string> {
    const { stdout } = await run('git', ['-C', repoDir, 'rev-parse', '--show-toplevel']);
    const root = stdout.trim();
    if (root === homedir()) {
      throw new Error('git root is the home directory — a worktree would checkout everything; spawn without isolation');
    }
    const wt = join(dirname(root), `${basename(root)}-ao-${slug}`);
    await run('git', ['-C', root, 'worktree', 'add', wt, '-b', `ao/${slug}`]);
    return wt;
  }
}

export async function probeMux(socketPath?: string): Promise<{ installed: boolean; version?: string; error?: string }> {
  const path =
    socketPath ?? process.env.ALLTERNIT_MUX_SOCKET ?? join(homedir(), '.allternit', 'mux', 'mux.sock');
  try {
    const client = await MuxClient.connect(path);
    const pong = await client.request('ping');
    client.close();
    return { installed: true, version: `mux protocol ${pong?.protocol ?? 'unknown'}` };
  } catch (error) {
    return { installed: false, error: error instanceof Error ? error.message : String(error) };
  }
}
