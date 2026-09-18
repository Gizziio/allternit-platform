import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
import type { ExecutorBackend, ExecutorSession, Footprint, ReviewArtifact, SendResult, SessionSpec, SessionState, WatchOutcome } from '../orchestrator.interface.js';
import { readCompletionNotes } from '../completion-contract.js';

const run = promisify(execFile);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface TerminalControlOptions {
  artifactDir?: string;
  cols?: number;
  rows?: number;
  hostProfile?: 'opentui' | null;
}

export class TerminalControlBackend implements ExecutorBackend {
  readonly kind = 'local-pty' as const;
  private artifactDir: string;

  constructor(private options: TerminalControlOptions = {}) {
    this.artifactDir = options.artifactDir ?? join(homedir(), '.agent-orchestrator', 'evidence');
  }

  async spawn(spec: SessionSpec): Promise<ExecutorSession> {
    await probeTerminalControlOrThrow();
    const sessionId = `ao-${spec.slug}`;
    let workdir = spec.workdir;
    if (spec.isolation === 'worktree') workdir = await this.addWorktree(spec.workdir, spec.slug);
    await mkdir(this.artifactDir, { recursive: true });
    const recordingPath = join(this.artifactDir, `${sessionId}.termctrl`);
    const args = ['start', sessionId, '--cwd', workdir, '--cols', String(this.options.cols ?? 112), '--rows', String(this.options.rows ?? 34), '--record', recordingPath];
    if (this.options.hostProfile !== null) args.push('--host', this.options.hostProfile ?? 'opentui');
    args.push('--', '/bin/sh', '-lc', spec.launchCommand);
    await run('termctrl', args);
    return {
      sessionId,
      slug: spec.slug,
      backend: this.kind,
      vendor: spec.vendor,
      mode: spec.mode,
      state: 'running',
      workdir,
      transcriptPath: recordingPath,
      createdAt: new Date().toISOString(),
    };
  }

  async send(session: ExecutorSession, prompt: string): Promise<SendResult> {
    const marker = prompt.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1)?.slice(-24) ?? '';
    if (!marker) return { submitted: false, reason: 'prompt is empty' };
    // `start` returns when the control socket exists, which can precede the
    // application's input box. A settled capture prevents startup input loss.
    await run('termctrl', ['show', session.sessionId, '--settle-ms', '500', '--deadline-ms', '15000']);
    await sleep(1_500);
    for (let attempt = 0; attempt < 2; attempt++) {
      await run('termctrl', ['send', session.sessionId, `text:${prompt}`]);
      try {
        await run('termctrl', ['wait', session.sessionId, marker, '--timeout', '10000']);
        await run('termctrl', ['send', session.sessionId, 'enter']);
        return { submitted: true };
      } catch {
        // Clear a partially rendered input before retrying. Never send Ctrl-C.
        await run('termctrl', ['send', session.sessionId, 'ctrl-u']).catch(() => undefined);
        await sleep(500);
      }
    }
    return { submitted: false, reason: 'rendered-prompt-verification-failed' };
  }

  async status(session: ExecutorSession): Promise<SessionState> {
    try {
      const { stdout } = await run('termctrl', ['status', session.sessionId, '--json']);
      const value = JSON.parse(stdout) as Record<string, unknown>;
      if (value.running === true) return 'running';
      const state = String(value.state ?? value.status ?? value.lifecycle ?? '').toLowerCase();
      return state === 'running' ? 'running' : 'dead';
    } catch {
      return 'dead';
    }
  }

  async tail(session: ExecutorSession): Promise<string> {
    const { stdout } = await run('termctrl', ['show', session.sessionId]);
    return stdout;
  }

  async watch(session: ExecutorSession, spec: SessionSpec): Promise<WatchOutcome> {
    const notesPath = isAbsolute(spec.notesFile) ? spec.notesFile : join(session.workdir, spec.notesFile);
    const deadline = Date.now() + (spec.timeoutMs ?? 3_600_000);
    const interval = spec.watchIntervalMs ?? 20_000;
    while (true) {
      if (existsSync(notesPath)) return { kind: 'done', report: await readCompletionNotes(notesPath) };
      if ((await this.status(session)) === 'dead') return { kind: 'dead', transcriptPath: session.transcriptPath };
      if (Date.now() >= deadline) return { kind: 'timeout' };
      await sleep(interval);
    }
  }

  async footprint(session: ExecutorSession): Promise<Footprint> {
    const isolated = basename(session.workdir).includes(`-ao-${session.slug}`);
    const { stdout: porcelain } = await run('git', ['-C', session.workdir, 'status', '--porcelain', '-uall']);
    const changedFiles = porcelain.split('\n').filter(Boolean).map((line) => line.slice(3).trim());
    const artifacts = await this.captureEvidence(session);
    let diffStat: string | undefined;
    if (isolated) {
      const { stdout } = await run('git', ['-C', session.workdir, 'diff', '--stat']);
      diffStat = stdout.trim() || undefined;
    }
    return { isolated, changedFiles, diffStat, artifacts };
  }

  async kill(session: ExecutorSession, opts: { removeWorktree?: boolean } = {}): Promise<void> {
    await run('termctrl', ['stop', session.sessionId]).catch(() => undefined);
    if (opts.removeWorktree && basename(session.workdir).includes(`-ao-${session.slug}`)) {
      await run('git', ['-C', session.workdir, 'worktree', 'remove', '--force', session.workdir]).catch(() => undefined);
    }
  }

  private async captureEvidence(session: ExecutorSession): Promise<ReviewArtifact[]> {
    const stem = join(this.artifactDir, `${session.sessionId}-review`);
    const artifacts: ReviewArtifact[] = [];
    await run('termctrl', ['save', session.sessionId, '--format', 'png', '--format', 'txt', '--out', stem]).catch(() => undefined);
    for (const [kind, path] of [['terminal-image', `${stem}.png`], ['terminal-text', `${stem}.txt`]] as const) {
      if (existsSync(path)) artifacts.push({ kind, path, sensitive: true });
    }
    if (session.transcriptPath && existsSync(session.transcriptPath)) artifacts.push({ kind: 'terminal-recording', path: session.transcriptPath, sensitive: true });
    return artifacts;
  }

  private async addWorktree(repoDir: string, slug: string): Promise<string> {
    const { stdout } = await run('git', ['-C', repoDir, 'rev-parse', '--show-toplevel']);
    const root = stdout.trim();
    if (root === homedir()) throw new Error('git root is the home directory — a worktree would checkout everything; spawn without isolation');
    const worktree = join(dirname(root), `${basename(root)}-ao-${slug}`);
    await run('git', ['-C', root, 'worktree', 'add', worktree, '-b', `ao/${slug}`]);
    return worktree;
  }
}

export async function probeTerminalControl(): Promise<{ installed: boolean; version?: string; error?: string }> {
  try {
    const { stdout, stderr } = await run('termctrl', ['--version'], { timeout: 5_000 });
    return { installed: true, version: `${stdout}\n${stderr}`.split(/\r?\n/).map((line) => line.trim()).find(Boolean) };
  } catch (error) {
    const cause = error as NodeJS.ErrnoException;
    return { installed: false, error: cause.code === 'ENOENT' ? 'termctrl is not installed or not on PATH.' : cause.message };
  }
}

async function probeTerminalControlOrThrow(): Promise<void> {
  const probe = await probeTerminalControl();
  if (!probe.installed) throw new Error(probe.error ?? 'terminal-control is unavailable');
}
