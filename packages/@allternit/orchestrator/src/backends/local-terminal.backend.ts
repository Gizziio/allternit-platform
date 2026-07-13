// packages/@allternit/orchestrator/src/backends/local-terminal.backend.ts
// tmux-backed executor sessions (ADR-0044). Encodes the semantics proven by the
// dev-machine ao-* reference scripts: script(1) transcripts from the first byte,
// verified send (paste → read back → submit only on match, C-u never C-c),
// sentinel-file completion, optional worktree isolation.
//
// tmux gotcha: exact-match pane targets need the '=NAME:' form (trailing colon);
// bare '=NAME' fails for capture-pane/set-option/display-message on tmux >= 3.6.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
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
const alnum = (s: string) => s.replace(/[^A-Za-z0-9]/g, '');

export interface LocalTerminalOptions {
  /** Transcript/log directory. Default: ~/.agent-orchestrator/logs (shared with the ao-* scripts). */
  logDir?: string;
}

export class LocalTerminalBackend implements ExecutorBackend {
  readonly kind = 'local-terminal' as const;
  private logDir: string;

  constructor(opts: LocalTerminalOptions = {}) {
    this.logDir = opts.logDir ?? join(homedir(), '.agent-orchestrator', 'logs');
  }

  private target(session: string): string {
    return `=${session}:`;
  }

  private async tmux(...args: string[]): Promise<string> {
    const { stdout } = await run('tmux', args);
    return stdout;
  }

  async spawn(spec: SessionSpec): Promise<ExecutorSession> {
    const name = `ao-${spec.slug}`;
    if (await this.hasSession(name)) {
      throw new Error(`session ${name} already exists`);
    }

    let workdir = spec.workdir;
    if (spec.isolation === 'worktree') {
      workdir = await this.addWorktree(spec.workdir, spec.slug);
    }

    await mkdir(this.logDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const transcriptPath = join(this.logDir, `${name}-${stamp}.log`);
    const runner = join(this.logDir, `${name}.cmd.sh`);
    await writeFile(runner, `${spec.launchCommand}\n`, 'utf8');

    // script(1) captures the transcript from the first byte — even an instant
    // crash (bad flag) leaves a readable log. remain-on-exit is chained in the
    // same tmux invocation to keep a dead pane inspectable.
    await this.tmux(
      'new-session', '-d', '-s', name, '-c', workdir,
      `script -q '${transcriptPath}' /bin/sh '${runner}'`,
      ';', 'set-option', 'remain-on-exit', 'on',
    );

    await sleep(500);
    const alive = await this.hasSession(name);
    return {
      sessionId: name,
      slug: spec.slug,
      backend: this.kind,
      vendor: spec.vendor,
      mode: spec.mode,
      state: alive ? 'running' : 'dead',
      workdir,
      transcriptPath,
      createdAt: new Date().toISOString(),
    };
  }

  async send(session: ExecutorSession, prompt: string): Promise<SendResult> {
    const t = this.target(session.sessionId);
    const marker = alnum(prompt).slice(-40);
    if (!marker) return { submitted: false, reason: 'prompt has no alphanumeric content' };

    await this.tmux('set-buffer', '-b', 'ao-send', prompt);
    await this.tmux('paste-buffer', '-p', '-b', 'ao-send', '-d', '-t', t);

    // Wait for the paste to actually render instead of a fixed sleep: poll
    // until the marker is visible in two consecutive captures (one sighting
    // can be a half-painted TUI frame), bounded at 5s.
    const deadline = Date.now() + 5_000;
    let pane = '';
    let seen = false;
    while (true) {
      pane = alnum(await this.tmux('capture-pane', '-p', '-t', t, '-S', '-80'));
      if (pane.includes(marker)) {
        if (seen) break;
        seen = true;
      } else {
        seen = false;
      }
      if (Date.now() >= deadline) break;
      await sleep(200);
    }

    if (!pane.includes(marker)) {
      // Clear the polluted line. NEVER C-c: it kills a kimi TUI outright.
      await this.tmux('send-keys', '-t', t, 'C-u');
      return { submitted: false, reason: 'verification-mismatch' };
    }
    await this.tmux('send-keys', '-t', t, 'Enter');
    return { submitted: true };
  }

  async status(session: ExecutorSession): Promise<SessionState> {
    if (!(await this.hasSession(session.sessionId))) return 'dead';
    const dead = (await this.tmux('list-panes', '-t', this.target(session.sessionId), '-F', '#{pane_dead}')).trim();
    return dead === '0' ? 'running' : 'dead';
  }

  async tail(session: ExecutorSession, lines = 25): Promise<string> {
    return this.tmux('capture-pane', '-p', '-t', this.target(session.sessionId), '-S', `-${lines}`);
  }

  async watch(session: ExecutorSession, spec: SessionSpec): Promise<WatchOutcome> {
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
    // -uall: plain --porcelain collapses untracked dirs to "dir/", hiding files from the scope check
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
    if (await this.hasSession(session.sessionId)) {
      await this.tmux('kill-session', '-t', this.target(session.sessionId));
    }
    if (opts.removeWorktree && basename(session.workdir).includes(`-ao-${session.slug}`)) {
      await run('git', ['-C', session.workdir, 'worktree', 'remove', '--force', session.workdir]).catch(() => {
        // Worktree may already be gone; branch ao/<slug> is intentionally kept
        // until the work is merged or rejected.
      });
    }
  }

  private async hasSession(name: string): Promise<boolean> {
    try {
      await run('tmux', ['has-session', '-t', `=${name}:`]);
      return true;
    } catch {
      return false;
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
