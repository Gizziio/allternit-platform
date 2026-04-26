/**
 * h5i Service — Native implementation. No external CLI dependency.
 *
 * All functionality is implemented using git, filesystem, and workspace
 * session stores. Data is persisted in .allternit/ within each workspace.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function getAllternitDir(workspacePath: string): string {
  return join(workspacePath, '.allternit');
}

function ensureAllternitDir(workspacePath: string): string {
  const dir = getAllternitDir(workspacePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getContextsDir(workspacePath: string): string {
  const dir = join(getAllternitDir(workspacePath), 'contexts');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getClaimsDir(workspacePath: string): string {
  const dir = join(getAllternitDir(workspacePath), 'claims');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getSummariesDir(workspacePath: string): string {
  const dir = join(getAllternitDir(workspacePath), 'summaries');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getContextPath(workspacePath: string, sessionId: string): string {
  return join(getContextsDir(workspacePath), `${sessionId}.json`);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface H5iVibeResult {
  aiRatio: number;
  aiDirectories: string[];
  riskiestFiles: string[];
  leakedTokens: string[];
  promptInjectionHits: string[];
  fileCount: number;
  commitCount: number;
  lastCommitDate: string | null;
}

export interface H5iContextEntry {
  timestamp: string;
  type: 'OBSERVE' | 'THINK' | 'ACT' | 'NOTE';
  content: string;
}

export interface H5iClaim {
  id: string;
  text: string;
  paths: string[];
  status: 'live' | 'stale';
  gitHash: string;
}

export interface H5iSummary {
  path: string;
  text: string;
  blobOid: string;
  valid: boolean;
}

export interface H5iDiffEntry {
  type: 'OBSERVE' | 'THINK' | 'ACT' | 'NOTE';
  side: 'A' | 'B' | 'both';
  content: string;
}

export interface H5iStatus {
  initialized: boolean;
  contextExists: boolean;
  notesCount: number;
  sessionCount: number;
}

export interface AgentHookConfig {
  agent: string;
  configPath: string;
  configContent: string;
}

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Status & Init
// ---------------------------------------------------------------------------

export function getH5iStatus(workspacePath: string): H5iStatus {
  const dir = getAllternitDir(workspacePath);
  const contextsDir = join(dir, 'contexts');
  const claimsDir = join(dir, 'claims');
  const initialized = existsSync(dir);

  let sessionCount = 0;
  if (existsSync(contextsDir)) {
    try {
      sessionCount = readdirSync(contextsDir).filter((f) => f.endsWith('.json')).length;
    } catch { /* ignore */ }
  }

  let notesCount = 0;
  if (existsSync(claimsDir)) {
    try {
      notesCount = readdirSync(claimsDir).length;
    } catch { /* ignore */ }
  }

  return {
    initialized,
    contextExists: sessionCount > 0,
    notesCount,
    sessionCount,
  };
}

export function initH5i(workspacePath: string): { success: boolean; message: string } {
  try {
    if (!existsSync(workspacePath)) {
      return { success: false, message: `Workspace path does not exist: ${workspacePath}` };
    }
    ensureAllternitDir(workspacePath);
    return { success: true, message: 'Allternit session tracking initialized' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

// ---------------------------------------------------------------------------
// Context Tracking (replaces h5i context start/finish/trace)
// ---------------------------------------------------------------------------

interface ContextFile {
  sessionId: string;
  goal: string;
  startedAt: string;
  finishedAt: string | null;
  entries: H5iContextEntry[];
}

function readContextFile(workspacePath: string, sessionId: string): ContextFile | null {
  const path = getContextPath(workspacePath, sessionId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as ContextFile;
  } catch {
    return null;
  }
}

function writeContextFile(workspacePath: string, sessionId: string, data: ContextFile): void {
  const path = getContextPath(workspacePath, sessionId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

export function startH5iContext(
  workspacePath: string,
  goal: string,
  sessionId: string,
): { success: boolean; message: string } {
  try {
    ensureAllternitDir(workspacePath);
    const existing = readContextFile(workspacePath, sessionId);
    const ctx: ContextFile = existing || {
      sessionId,
      goal,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      entries: [],
    };
    if (!existing) {
      ctx.entries.push({
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'OBSERVE',
        content: `Context started: ${goal}`,
      });
    }
    writeContextFile(workspacePath, sessionId, ctx);
    return { success: true, message: 'Context started' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

export function finishH5iContext(
  workspacePath: string,
  sessionId: string,
): { success: boolean; message: string } {
  try {
    const ctx = readContextFile(workspacePath, sessionId);
    if (!ctx) {
      return { success: false, message: 'No context found for session' };
    }
    ctx.finishedAt = new Date().toISOString();
    ctx.entries.push({
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'NOTE',
      content: 'Context finished',
    });
    writeContextFile(workspacePath, sessionId, ctx);
    return { success: true, message: 'Context finished' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

export function getH5iContextTrace(
  workspacePath: string,
  sessionId: string,
): { success: boolean; trace?: H5iContextEntry[]; error?: string } {
  try {
    const ctx = readContextFile(workspacePath, sessionId);
    if (!ctx) return { success: true, trace: [] };
    return { success: true, trace: ctx.entries };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export function addContextEntry(
  workspacePath: string,
  sessionId: string,
  entry: Omit<H5iContextEntry, 'timestamp'>,
): { success: boolean; message: string } {
  try {
    const ctx = readContextFile(workspacePath, sessionId);
    if (!ctx) return { success: false, message: 'No context found' };
    ctx.entries.push({
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...entry,
    });
    writeContextFile(workspacePath, sessionId, ctx);
    return { success: true, message: 'Entry added' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

// ---------------------------------------------------------------------------
// Vibe Audit (native git + filesystem analysis)
// ---------------------------------------------------------------------------

export function runH5iVibe(
  workspacePath: string,
): { success: boolean; result?: H5iVibeResult; error?: string } {
  try {
    if (!existsSync(workspacePath)) {
      return { success: false, error: `Workspace path does not exist: ${workspacePath}` };
    }

    const result: H5iVibeResult = {
      aiRatio: 0,
      aiDirectories: [],
      riskiestFiles: [],
      leakedTokens: [],
      promptInjectionHits: [],
      fileCount: 0,
      commitCount: 0,
      lastCommitDate: null,
    };

    // Count files
    try {
      const output = execSync('git ls-files | wc -l', {
        cwd: workspacePath,
        encoding: 'utf-8',
        shell: true,
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      result.fileCount = parseInt(output.trim(), 10) || 0;
    } catch { /* not a git repo */ }

    // Commit count and last commit date
    try {
      const revCount = execSync('git rev-list --count HEAD', {
        cwd: workspacePath,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      result.commitCount = parseInt(revCount.trim(), 10) || 0;

      const lastCommit = execSync('git log -1 --format=%ci', {
        cwd: workspacePath,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      result.lastCommitDate = lastCommit.trim() || null;
    } catch { /* ignore */ }

    // Detect AI directories (presence of .cursorrules, .claude.md, .ai, etc.)
    const aiMarkers = ['.cursorrules', '.claude.md', '.cursor', '.ai', 'copilot-instructions.md'];
    try {
      const files = execSync('git ls-files', {
        cwd: workspacePath,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).split('\n');

      const aiDirs = new Set<string>();
      for (const file of files) {
        const base = file.split('/').pop() || '';
        if (aiMarkers.some((m) => base.toLowerCase().includes(m))) {
          aiDirs.add(dirname(file) || '.');
        }
      }
      result.aiDirectories = Array.from(aiDirs);
    } catch { /* ignore */ }

    // Riskiest files: largest recent additions
    try {
      const diffStat = execSync('git diff HEAD~5 --stat | tail -20', {
        cwd: workspacePath,
        encoding: 'utf-8',
        shell: true,
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const lines = diffStat.split('\n').filter((l) => l.includes('|'));
      result.riskiestFiles = lines.slice(0, 8).map((l) => l.split('|')[0].trim());
    } catch { /* ignore */ }

    // Secret scan on modified files
    try {
      const modified = execSync('git diff --name-only HEAD~3', {
        cwd: workspacePath,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).split('\n').filter(Boolean);

      for (const file of modified.slice(0, 20)) {
        const fullPath = join(workspacePath, file);
        if (!existsSync(fullPath)) continue;
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const { found } = redactSecrets(content);
          for (const f of found) {
            if (!result.leakedTokens.includes(f)) result.leakedTokens.push(f);
          }
        } catch { /* binary or unreadable */ }
      }
    } catch { /* ignore */ }

    // Prompt injection scan: look for suspicious patterns in comments
    const injectionPatterns = [
      /ignore previous instructions/gi,
      /disregard (all|the) (above|previous)/gi,
      /new instructions?:/gi,
      /you are now/gi,
      /system prompt/gi,
      /override (safety|guardrails)/gi,
    ];
    try {
      const allFiles = execSync('git ls-files', {
        cwd: workspacePath,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).split('\n').filter(Boolean);

      for (const file of allFiles.slice(0, 100)) {
        if (!/\.(ts|tsx|js|jsx|py|rs|md|txt|yaml|yml|json)$/.test(file)) continue;
        const fullPath = join(workspacePath, file);
        if (!existsSync(fullPath)) continue;
        try {
          const content = readFileSync(fullPath, 'utf-8');
          for (const pattern of injectionPatterns) {
            if (pattern.test(content)) {
              result.promptInjectionHits.push(`${file}: ${pattern.source.slice(0, 30)}...`);
              break;
            }
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    // AI ratio heuristic: % of commits mentioning AI/copilot/claude/cursor
    try {
      const logOutput = execSync('git log --oneline -50', {
        cwd: workspacePath,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const commits = logOutput.split('\n').filter(Boolean);
      const aiCommits = commits.filter((c) =>
        /\b(ai|copilot|claude|cursor|gpt|llm|generated|auto)\b/i.test(c),
      );
      result.aiRatio = commits.length > 0 ? Math.round((aiCommits.length / commits.length) * 100) : 0;
    } catch { /* ignore */ }

    return { success: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Claims (native file parsing)
// ---------------------------------------------------------------------------

export function listH5iClaims(
  workspacePath: string,
): { success: boolean; claims?: H5iClaim[]; error?: string } {
  try {
    const claimsDir = getClaimsDir(workspacePath);
    const claims: H5iClaim[] = [];

    // Read existing claims
    if (existsSync(claimsDir)) {
      for (const file of readdirSync(claimsDir)) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = JSON.parse(readFileSync(join(claimsDir, file), 'utf-8')) as H5iClaim;
          // Validate staleness against current git hash
          data.status = isClaimStale(workspacePath, data) ? 'stale' : 'live';
          claims.push(data);
        } catch { /* ignore malformed */ }
      }
    }

    // Auto-generate claims from source files if none exist
    if (claims.length === 0) {
      const newClaims = generateClaimsFromSource(workspacePath);
      for (const claim of newClaims) {
        writeFileSync(join(claimsDir, `${claim.id}.json`), JSON.stringify(claim, null, 2), 'utf-8');
      }
      claims.push(...newClaims);
    }

    return { success: true, claims };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

function getFileGitHash(workspacePath: string, filePath: string): string {
  try {
    return execSync(`git hash-object "${filePath}"`, {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function isClaimStale(workspacePath: string, claim: H5iClaim): boolean {
  for (const p of claim.paths) {
    const currentHash = getFileGitHash(workspacePath, p);
    if (currentHash && currentHash !== claim.gitHash) return true;
  }
  return false;
}

function generateClaimsFromSource(workspacePath: string): H5iClaim[] {
  const claims: H5iClaim[] = [];
  try {
    const files = execSync('git ls-files', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\n').filter(Boolean);

    for (const file of files) {
      if (!/\.(ts|tsx|js|jsx|py|rs|go)$/.test(file)) continue;
      const fullPath = join(workspacePath, file);
      if (!existsSync(fullPath)) continue;

      try {
        const content = readFileSync(fullPath, 'utf-8');
        const hash = getFileGitHash(workspacePath, file);

        // Extract exports
        const exportMatches = content.match(/export\s+(?:default\s+)?(?:function|class|interface|type|const|enum)\s+(\w+)/g);
        if (exportMatches) {
          for (const match of exportMatches) {
            const name = match.match(/\b(\w+)$/)?.[1] || '';
            if (!name) continue;
            claims.push({
              id: `claim-${Buffer.from(`${file}:${name}`).toString('base64').slice(0, 12)}`,
              text: `${name} exported from ${file}`,
              paths: [file],
              status: 'live',
              gitHash: hash,
            });
          }
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return claims;
}

// ---------------------------------------------------------------------------
// Summaries (native file reading + git hash tracking)
// ---------------------------------------------------------------------------

export function listH5iSummaries(
  workspacePath: string,
): { success: boolean; summaries?: H5iSummary[]; error?: string } {
  try {
    const summariesDir = getSummariesDir(workspacePath);
    const summaries: H5iSummary[] = [];

    // Read existing summaries
    if (existsSync(summariesDir)) {
      for (const file of readdirSync(summariesDir)) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = JSON.parse(readFileSync(join(summariesDir, file), 'utf-8')) as H5iSummary;
          // Validate against current git blob
          const currentOid = getFileGitHash(workspacePath, data.path);
          data.valid = currentOid === data.blobOid;
          summaries.push(data);
        } catch { /* ignore malformed */ }
      }
    }

    // Auto-generate summaries for key files if none exist
    if (summaries.length === 0) {
      const newSummaries = generateSummaries(workspacePath);
      for (const summary of newSummaries) {
        const safeName = summary.path.replace(/[^a-zA-Z0-9]/g, '_');
        writeFileSync(join(summariesDir, `${safeName}.json`), JSON.stringify(summary, null, 2), 'utf-8');
      }
      summaries.push(...newSummaries);
    }

    return { success: true, summaries };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

function generateSummaries(workspacePath: string): H5iSummary[] {
  const summaries: H5iSummary[] = [];
  try {
    const files = execSync('git ls-files', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\n').filter(Boolean);

    // Pick README, package.json, and a few source files
    const priorityFiles = ['README.md', 'README', 'package.json', 'Cargo.toml', 'pyproject.toml'];
    const sourceFiles = files.filter((f) => /\.(ts|tsx|js|jsx|py|rs|go)$/.test(f)).slice(0, 10);
    const targetFiles = [...priorityFiles.filter((p) => files.includes(p)), ...sourceFiles].slice(0, 12);

    for (const file of targetFiles) {
      const fullPath = join(workspacePath, file);
      if (!existsSync(fullPath)) continue;

      try {
        const content = readFileSync(fullPath, 'utf-8');
        const blobOid = getFileGitHash(workspacePath, file);
        const lines = content.split('\n');

        // Simple heuristic summary
        let summaryText = '';
        if (file.toLowerCase().includes('readme')) {
          summaryText = lines.slice(0, 5).join(' ').slice(0, 200);
        } else if (file === 'package.json' || file === 'Cargo.toml') {
          const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/);
          const descMatch = content.match(/"description"\s*:\s*"([^"]+)"/);
          summaryText = `${nameMatch?.[1] || file}: ${descMatch?.[1] || 'Project manifest'}`;
        } else {
          const commentBlock = lines.slice(0, 10).find((l) => l.startsWith('//') || l.startsWith('/*') || l.startsWith('#') || l.startsWith('*'));
          summaryText = commentBlock?.replace(/^[\s/*#]+/, '').slice(0, 150) || `${file} — ${lines.length} lines`;
        }

        summaries.push({
          path: file,
          text: summaryText,
          blobOid,
          valid: true,
        });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return summaries;
}

// ---------------------------------------------------------------------------
// Diff (native session comparison)
// ---------------------------------------------------------------------------

export function diffH5iContext(
  workspacePath: string,
  sessionA: string,
  sessionB: string,
): { success: boolean; diff?: H5iDiffEntry[]; error?: string } {
  try {
    const ctxA = readContextFile(workspacePath, sessionA);
    const ctxB = readContextFile(workspacePath, sessionB);

    if (!ctxA && !ctxB) return { success: true, diff: [] };

    const entriesA = ctxA?.entries || [];
    const entriesB = ctxB?.entries || [];

    const diff: H5iDiffEntry[] = [];
    const maxLen = Math.max(entriesA.length, entriesB.length);

    for (let i = 0; i < maxLen; i++) {
      const a = entriesA[i];
      const b = entriesB[i];

      if (a && b && a.content === b.content && a.type === b.type) {
        diff.push({ type: a.type, side: 'both', content: a.content });
      } else {
        if (a) diff.push({ type: a.type, side: 'A', content: a.content });
        if (b) diff.push({ type: b.type, side: 'B', content: b.content });
      }
    }

    return { success: true, diff };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Commit with provenance (native git)
// ---------------------------------------------------------------------------

export function commitWithH5i(
  workspacePath: string,
  message: string,
  options: { model?: string; agent?: string; prompt?: string; files?: string[] },
): { success: boolean; hash?: string; error?: string } {
  try {
    // Stage files
    if (options.files && options.files.length > 0) {
      for (const file of options.files) {
        try {
          execSync(`git add "${file}"`, { cwd: workspacePath, stdio: 'ignore' });
        } catch { /* ignore */ }
      }
    } else {
      execSync('git add -A', { cwd: workspacePath, stdio: 'ignore' });
    }

    // Build commit message with provenance trailers
    const trailers: string[] = [];
    if (options.model) trailers.push(`X-Allternit-Model: ${options.model}`);
    if (options.agent) trailers.push(`X-Allternit-Agent: ${options.agent}`);
    if (options.prompt) {
      const redacted = redactSecrets(options.prompt).redacted;
      trailers.push(`X-Allternit-Prompt: ${redacted.slice(0, 200)}`);
    }

    const fullMessage = trailers.length > 0 ? `${message}\n\n${trailers.join('\n')}` : message;

    const output = execSync(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`, {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const hashMatch = output.match(/\[.+?\s+([a-f0-9]{7,})/);
    return { success: true, hash: hashMatch?.[1] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Auto-summarization
// ---------------------------------------------------------------------------

export function generateSessionSummary(
  workspacePath: string,
  sessionId: string,
): { success: boolean; summary?: string; error?: string } {
  try {
    const ctx = readContextFile(workspacePath, sessionId);
    if (!ctx || ctx.entries.length === 0) {
      return { success: false, error: 'No context entries for summarization' };
    }

    const actEntries = ctx.entries.filter((e) => e.type === 'ACT');
    const thinkEntries = ctx.entries.filter((e) => e.type === 'THINK');
    const observeEntries = ctx.entries.filter((e) => e.type === 'OBSERVE');

    let summary = '';
    if (ctx.goal) summary = `Goal: ${ctx.goal}. `;
    if (thinkEntries.length > 0) {
      summary += `Key focus: ${thinkEntries[0].content.slice(0, 100)}. `;
    }
    if (actEntries.length > 0) {
      summary += `Actions: ${actEntries.slice(0, 3).map((a) => a.content.slice(0, 50)).join('; ')}. `;
    }
    if (observeEntries.length > 0) {
      summary += `${observeEntries.length} observations recorded. `;
    }
    summary += `(${ctx.entries.length} total entries)`;

    const { redacted } = redactSecrets(summary);

    // Store as a NOTE entry
    addContextEntry(workspacePath, sessionId, {
      type: 'NOTE',
      content: `Summary: ${redacted.slice(0, 250)}`,
    });

    return { success: true, summary: redacted };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  { regex: /\b(sk-[a-zA-Z0-9]{48,})\b/g, name: 'OpenAI API Key' },
  { regex: /\b(anthropic-[a-zA-Z0-9]{40,})\b/g, name: 'Anthropic API Key' },
  { regex: /\b(AIza[0-9A-Za-z_-]{35,})\b/g, name: 'Google API Key' },
  { regex: /\b(gh[pousr]_[A-Za-z0-9_]{36,})\b/g, name: 'GitHub Token' },
  { regex: /\b(glpat-[a-zA-Z0-9_-]{20,})\b/g, name: 'GitLab Token' },
  { regex: /\b(bearer\s+[a-zA-Z0-9_\-\.]{40,})\b/gi, name: 'Bearer Token' },
  { regex: /\b(eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*)\b/g, name: 'JWT' },
  { regex: /\b(password[:=\s]+)([^\s]{8,})\b/gi, name: 'Password' },
  { regex: /\b(api[_-]?key[:=\s]+)([^\s]{16,})\b/gi, name: 'API Key' },
  { regex: /\b(secret[:=\s]+)([^\s]{16,})\b/gi, name: 'Secret' },
  { regex: /\b(token[:=\s]+)([^\s]{16,})\b/gi, name: 'Token' },
];

export function redactSecrets(text: string): { redacted: string; found: string[] } {
  let redacted = text;
  const found: string[] = [];

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern.regex, (match, prefix, secret) => {
      const toRedact = secret || match;
      if (toRedact && toRedact.length > 8) {
        found.push(`${pattern.name}: ${toRedact.slice(0, 4)}...${toRedact.slice(-4)}`);
        return prefix ? `${prefix}[REDACTED]` : '[REDACTED]';
      }
      return match;
    });
  }

  return { redacted, found };
}

// ---------------------------------------------------------------------------
// Agent hook installer (already native, just remove h5i refs)
// ---------------------------------------------------------------------------

export function getAgentHookConfigs(workspacePath: string): AgentHookConfig[] {
  return [
    {
      agent: 'claude-code',
      configPath: `${workspacePath}/.claude/allternit.md`,
      configContent: `# Allternit Integration for Claude Code

When starting a session, record context:
\`\`\`bash
curl -X POST http://localhost:3013/api/h5i/context/start \
  -H "Content-Type: application/json" \
  -d '{"workspacePath":".","goal":"$GOAL","sessionId":"$SESSION_ID"}'
\`\`\`

When finishing:
\`\`\`bash
curl -X POST http://localhost:3013/api/h5i/context/finish \
  -H "Content-Type: application/json" \
  -d '{"workspacePath":".","sessionId":"$SESSION_ID"}'
\`\`\`
`,
    },
    {
      agent: 'cursor',
      configPath: `${workspacePath}/.cursor/allternit.md`,
      configContent: `# Allternit Integration for Cursor

Track sessions with the Allternit API at http://localhost:3013/api/h5i/context/*
`,
    },
    {
      agent: 'gemini',
      configPath: `${workspacePath}/.gemini/allternit.md`,
      configContent: `# Allternit Integration for Gemini CLI

Track sessions with the Allternit API at http://localhost:3013/api/h5i/context/*
`,
    },
    {
      agent: 'github-copilot-cli',
      configPath: `${workspacePath}/.github/allternit.md`,
      configContent: `# Allternit Integration for Copilot CLI

Track sessions with the Allternit API at http://localhost:3013/api/h5i/context/*
`,
    },
    {
      agent: 'opencode',
      configPath: `${workspacePath}/.opencode/allternit.md`,
      configContent: `# Allternit Integration for OpenCode

Track sessions with the Allternit API at http://localhost:3013/api/h5i/context/*
`,
    },
  ];
}

export function installAgentHooks(
  workspacePath: string,
  agents: string[],
): { success: boolean; installed: string[]; errors: string[] } {
  const fs = require('fs');
  const path = require('path');
  const configs = getAgentHookConfigs(workspacePath);
  const installed: string[] = [];
  const errors: string[] = [];

  for (const config of configs) {
    if (agents.length > 0 && !agents.includes(config.agent)) continue;

    try {
      const dir = path.dirname(config.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(config.configPath, config.configContent, 'utf-8');
      installed.push(config.agent);
    } catch (err) {
      errors.push(`${config.agent}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return { success: errors.length === 0, installed, errors };
}

// ---------------------------------------------------------------------------
// MCP Server config
// ---------------------------------------------------------------------------

export function getH5iMcpConfig(): McpServerConfig {
  return {
    name: 'allternit-context',
    command: 'node',
    args: ['-e', 'console.log(JSON.stringify({name:"allternit-context",version:"1.0.0"}))'],
  };
}

export function isH5iMcpAvailable(): boolean {
  return true; // Native implementation is always available
}
