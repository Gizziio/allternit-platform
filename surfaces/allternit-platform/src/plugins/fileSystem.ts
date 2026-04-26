/**
 * File System Integration for PluginManager
 * 
 * Re-exports real filesystem integration with API-backed fallback.
 */

// Import types from separate file to avoid circular dependency
export type { FileSystemAPI, FileEntry } from './fileSystem.types';
import type { FileSystemAPI, FileEntry } from './fileSystem.types';

function safeJSONParse<T>(text: string | undefined | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('[fileSystem] JSON parse error:', error);
    return fallback;
  }
}

// Import real implementation
import { RealFileSystem } from './fileSystem.real';
export { RealFileSystem } from './fileSystem.real';

import type { SimpleCapability as Capability, FileNode, MarketplacePlugin } from './capability.types';
import { resolveMarketplacePluginPackage } from './marketplaceInstaller';
import { validatePluginManifestV1 } from './pluginStandards';

// Base directories to scan
const ALLTERNIT_DIR = '.allternit';
const SKILLS_DIR = `${ALLTERNIT_DIR}/skills`;
const COMMANDS_DIR = `${ALLTERNIT_DIR}/commands`;
const PLUGINS_DIR = `${ALLTERNIT_DIR}/plugins`;
const MCPS_DIR = `${ALLTERNIT_DIR}/mcps`;
const WEBHOOKS_DIR = `${ALLTERNIT_DIR}/webhooks`;
const CONNECTORS_DIR = `${ALLTERNIT_DIR}/connectors`;

const SKILL_DIR_CANDIDATES = [SKILLS_DIR, '.agents/skills', '.codex/skills'];
const COMMAND_DIR_CANDIDATES = [COMMANDS_DIR, '.agents/commands', '.codex/commands'];
const COMMAND_MARKDOWN_DIR_CANDIDATES = ['.claude/commands'];
const COMMAND_CONFIG_FILE_CANDIDATES = [
  '.config/allternit-shell/opencode.json',
  '.config/gizzi/opencode.json',
  '.config/gizzi/allternit.json',
  '.config/opencode/opencode.json',
  '.config/opencode/oh-my-opencode.json',
  '.config/gizzi-code/allternit.json',
  '.claude/settings.json',
];
const INTERNAL_COMMAND_SOURCE_FILE_CANDIDATES = [
  'Desktop/allternit-workspace/allternit/cmd/gizzi-code/src/cli/ui/tui/routes/session/index.tsx',
  'cmd/gizzi-code/src/cli/ui/tui/routes/session/index.tsx',
  '../cmd/gizzi-code/src/cli/ui/tui/routes/session/index.tsx',
  '../../cmd/gizzi-code/src/cli/ui/tui/routes/session/index.tsx',
];
const PLUGIN_DIR_CANDIDATES = [PLUGINS_DIR, '.agents/plugins', '.codex/plugins'];
const MCP_DIR_CANDIDATES = [MCPS_DIR, '.agents/mcps', '.codex/mcps'];
const MCP_CONFIG_FILE_CANDIDATES = [
  '.config/allternit-shell/allternit.json',
  '.config/gizzi/allternit.json',
  '.config/gizzi-code/allternit.json',
  '.config/allternit-shell/opencode.json',
  '.config/gizzi/opencode.json',
  '.config/opencode/opencode.json',
  '.claude/settings.json',
  '.codex/config.toml',
  '.gemini/mcp.json',
];
const WEBHOOK_DIR_CANDIDATES = [WEBHOOKS_DIR, '.agents/webhooks', '.codex/webhooks'];
const WEBHOOK_CONFIG_FILE_CANDIDATES = [
  '.codex/config.toml',
  '.config/allternit-shell/opencode.json',
  '.config/opencode/opencode.json',
  '.claude/settings.json',
];
const CONNECTOR_DIR_CANDIDATES = [CONNECTORS_DIR, '.agents/connectors', '.codex/connectors'];
const INTERNAL_CLI_PACKAGE_FILE_CANDIDATES = [
  'Desktop/allternit-workspace/allternit/package.json',
  'Desktop/allternit-workspace/allternit/cmd/gizzi-code/package.json',
  'Desktop/allternit-workspace/allternit/7-apps/ts/cli/package.json',
  'package.json',
  '../package.json',
  '../../package.json',
  'cmd/gizzi-code/package.json',
  '7-apps/ts/cli/package.json',
  '../cmd/gizzi-code/package.json',
  '../7-apps/ts/cli/package.json',
  '../../cmd/gizzi-code/package.json',
  '../../7-apps/ts/cli/package.json',
];
const INTERNAL_EXECUTABLE_DIR_CANDIDATES = [
  'Desktop/allternit-workspace/allternit/bin',
  'Desktop/allternit-workspace/allternit/dev/scripts',
  'bin',
  'dev/scripts',
  '../bin',
  '../dev/scripts',
  '../../bin',
  '../../dev/scripts',
];
const INTERNAL_GIZZI_COMMAND_DIR_CANDIDATES = [
  'Desktop/allternit-workspace/allternit/cmd/gizzi-code/src/cli/commands',
  'cmd/gizzi-code/src/cli/commands',
  '../cmd/gizzi-code/src/cli/commands',
  '../../cmd/gizzi-code/src/cli/commands',
];
const INTERNAL_ALLTERNIT_CLI_SWITCH_FILE_CANDIDATES = [
  'Desktop/allternit-workspace/allternit/cmd/gizzi-code/src/cli/allternit.ts',
  'cmd/gizzi-code/src/cli/allternit.ts',
  '../cmd/gizzi-code/src/cli/allternit.ts',
  '../../cmd/gizzi-code/src/cli/allternit.ts',
];
const HOME_DIR_STORAGE_KEY = 'allternit:plugin-manager:home-dir:v1';

const OH_MY_OPENCODE_BUILTIN_COMMANDS = [
  'init-deep',
  'ralph-loop',
  'cancel-ralph',
  'ulw-loop',
  'refactor',
  'start-work',
  'stop-continuation',
  'handoff',
];

// Types are already imported at the top of the file

// ============================================================================
// API File System (renderer-safe, backed by gateway /api/v1/files)
// ============================================================================

export class ApiFileSystem implements FileSystemAPI {
  private homeDir = '/Users/macbook';
  private ready = false;
  private apiConfigured = false;
  private apiBases: string[] = [];
  private authHeader: string | null = null;
  private failedApiBases = new Set<string>(); // Cache failed endpoints to avoid repeated calls

  constructor() {
    void this.detectHomeDir();
  }

  private normalizeBaseUrl(value: string): string {
    return value.replace(/\/+$/g, '');
  }

  private async detectApiConfig() {
    if (this.apiConfigured) return;
    this.apiConfigured = true;

    const candidates = new Set<string>();

    if (typeof window !== 'undefined') {
      const sidecar = (window as any).allternitSidecar;
      if (sidecar?.getApiUrl) {
        try {
          const apiUrl = await sidecar.getApiUrl();
          if (typeof apiUrl === 'string' && apiUrl.trim()) {
            candidates.add(this.normalizeBaseUrl(apiUrl.trim()));
          }
        } catch {
          // Ignore sidecar API lookup errors.
        }
      }

      if (sidecar?.getBasicAuth) {
        try {
          const basicAuth = await sidecar.getBasicAuth();
          if (basicAuth?.header) {
            this.authHeader = basicAuth.header;
          }
        } catch {
          // Ignore auth lookup errors.
        }
      }

      const injectedGateway = (window as any).__ALLTERNIT_GATEWAY_URL__;
      if (typeof injectedGateway === 'string' && injectedGateway.trim()) {
        candidates.add(this.normalizeBaseUrl(injectedGateway.trim()));
      }

      if (window.location?.origin) {
        candidates.add(this.normalizeBaseUrl(window.location.origin));
      }
    }

    // Always include local fallback backends so stale sidecar URLs can recover.
    candidates.add('http://127.0.0.1:8013');
    candidates.add('http://127.0.0.1:3210');
    candidates.add('http://127.0.0.1:3000');

    this.apiBases = Array.from(candidates);
  }

  private buildFilesUrl(endpoint: string, path: string, extraParams?: Record<string, string>): string {
    const params = new URLSearchParams();
    params.set('path', path);
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => params.set(key, value));
    }
    return `/api/v1/files/${endpoint}?${params.toString()}`;
  }

  private async request(endpointPath: string, init?: RequestInit): Promise<Response> {
    await this.detectApiConfig();
    let lastError: Error | null = null;
    const method = (init?.method || 'GET').toUpperCase();

    for (const base of this.apiBases) {
      // Skip failed endpoints to avoid repeated 404s and connection errors
      if (this.failedApiBases.has(base)) {
        continue;
      }
      
      const url = `${base}${endpointPath}`;
      try {
        const response = await fetch(url, {
          ...init,
          headers: {
            Accept: 'application/json',
            ...(init?.headers || {}),
            ...(this.authHeader ? { Authorization: this.authHeader } : {}),
          },
        });

        if (!response.ok) {
          // Mark endpoint as failed for 4xx errors (not temporary 5xx)
          if (response.status >= 400 && response.status < 500) {
            this.failedApiBases.add(base);
          }
          lastError = new Error(`HTTP ${response.status} for ${url}`);
          continue;
        }

        if (method !== 'HEAD') {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            lastError = new Error(`Invalid HTML response for ${url}`);
            continue;
          }
        }

        return response;
      } catch (error) {
        // Mark endpoint as failed for connection errors
        this.failedApiBases.add(base);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError || new Error('No files API endpoint is available');
  }

  private async requestJson<T>(endpointPath: string, init?: RequestInit): Promise<T> {
    const response = await this.request(endpointPath, init);
    const text = await response.text();
    if (!text) throw new Error(`Empty response for ${endpointPath}`);
    return JSON.parse(text) as T;
  }

  private async detectHomeDir() {
    await this.detectApiConfig();

    const candidates = new Set<string>();
    candidates.add('/Users/macbook');
    candidates.add('/home/user');
    candidates.add('.');

    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(HOME_DIR_STORAGE_KEY);
      if (stored) candidates.add(stored);
    }

    const addChildren = async (base: string) => {
      try {
        const entries = await this.readDir(base);
        for (const entry of entries) {
          if (entry.type === 'directory' && !entry.name.startsWith('.')) {
            candidates.add(this.join(base, entry.name));
          }
        }
      } catch {
        // Ignore inaccessible roots.
      }
    };

    await addChildren('/Users');
    await addChildren('/home');

    for (const candidate of candidates) {
      const hasAllternit = await this.pathLooksLikeHome(candidate);
      if (hasAllternit) {
        this.homeDir = candidate;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(HOME_DIR_STORAGE_KEY, candidate);
        }
        this.ready = true;
        return;
      }
    }

    const first = Array.from(candidates)[0];
    if (first) this.homeDir = first;
    this.ready = true;
  }

  private async pathLooksLikeHome(path: string): Promise<boolean> {
    const dirs = ['.allternit', '.agents', '.codex'];
    for (const dir of dirs) {
      if (await this.directoryExists(this.join(path, dir))) return true;
    }
    return false;
  }

  private async directoryExists(path: string): Promise<boolean> {
    try {
      await this.readDir(path);
      return true;
    } catch {
      return false;
    }
  }

  async readDir(path: string): Promise<FileEntry[]> {
    const response = await this.requestJson<{
      path: string;
      entries: Array<{
        name: string;
        path: string;
        type: 'file' | 'directory';
        size?: number;
        modifiedAt?: string;
      }>;
    }>(this.buildFilesUrl('list', path, { details: 'true' }));

    return response.entries.map((entry) => ({
      name: entry.name,
      path: entry.path,
      type: entry.type,
      size: entry.size,
      modified: entry.modifiedAt ? new Date(entry.modifiedAt) : undefined,
    }));
  }

  async readFile(path: string): Promise<string> {
    const result = await this.requestJson<{ content: string } | null>(this.buildFilesUrl('read', path));
    return result?.content ?? '';
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.request(
      '/api/v1/files/write',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path, content }),
      }
    );
  }

  async exists(path: string): Promise<boolean> {
    try {
      const response = await this.request(this.buildFilesUrl('exists', path), { method: 'HEAD' });
      if (response.ok) return true;
    } catch {
      // Fall back to read/list probes.
    }

    try {
      await this.readDir(path);
      return true;
    } catch {
      // Might be a file.
    }

    try {
      await this.readFile(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(_path: string): Promise<void> {
    await this.request(this.buildFilesUrl('mkdir', _path), { method: 'POST' });
  }

  async deleteFile(path: string): Promise<void> {
    await this.request(this.buildFilesUrl('delete', path), { method: 'DELETE' });
  }

  join(...paths: string[]): string {
    const normalized = paths
      .filter((p) => p !== '')
      .join('/')
      .replace(/\/+/g, '/');
    if (!normalized) return '.';
    if (normalized === '/.') return '/';
    return normalized;
  }

  basename(path: string): string {
    const clean = path.replace(/\/+$/, '');
    const idx = clean.lastIndexOf('/');
    return idx >= 0 ? clean.slice(idx + 1) : clean;
  }

  dirname(path: string): string {
    const clean = path.replace(/\/+$/, '');
    const idx = clean.lastIndexOf('/');
    if (idx <= 0) return idx === 0 ? '/' : '.';
    return clean.slice(0, idx);
  }

  async exec(_command: string): Promise<{ stdout: string; stderr: string }> {
    return { stdout: '', stderr: 'exec is not available in ApiFileSystem' };
  }

  getHomeDir(): string {
    return this.homeDir;
  }

  isReady(): boolean {
    return this.ready;
  }
}

// ============================================================================
// Capability Scanners
// ============================================================================

export class CapabilityScanner {
  private fs: FileSystemAPI;

  constructor(fs: FileSystemAPI) {
    this.fs = fs;
  }

  private toSafeId(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'item';
  }

  private async resolveBasePaths(relativeDirs: string[]): Promise<string[]> {
    const candidates = new Set<string>();
    const homeDir = this.fs.getHomeDir();

    for (const relativeDir of relativeDirs) {
      candidates.add(this.fs.join(homeDir, relativeDir));
      candidates.add(relativeDir);
      candidates.add(this.fs.join('.', relativeDir));
    }

    const addHomeVariants = async (base: string) => {
      try {
        const entries = await this.fs.readDir(base);
        for (const entry of entries) {
          if (entry.type !== 'directory' || entry.name.startsWith('.')) continue;
          for (const relativeDir of relativeDirs) {
            candidates.add(this.fs.join(base, entry.name, relativeDir));
          }
        }
      } catch {
        // Ignore if this root is inaccessible.
      }
    };

    await addHomeVariants('/Users');
    await addHomeVariants('/home');

    const existing: string[] = [];
    for (const path of candidates) {
      try {
        if (await this.fs.exists(path)) existing.push(path);
      } catch {
        // Ignore invalid candidate.
      }
    }

    return existing.length > 0 ? existing : Array.from(candidates);
  }

  // -------------------------------------------------------------------------
  // Skills Scanner
  // -------------------------------------------------------------------------
  private async discoverSkillDirectories(basePath: string): Promise<Array<{ path: string; name: string; modified?: Date }>> {
    const discovered: Array<{ path: string; name: string; modified?: Date }> = [];
    const visited = new Set<string>();
    const queue: Array<{ path: string; modified?: Date; depth: number }> = [{ path: basePath, depth: 0 }];
    const MAX_DEPTH = 10;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (visited.has(current.path)) continue;
      visited.add(current.path);

      let entries: FileEntry[] = [];
      try {
        entries = await this.fs.readDir(current.path);
      } catch {
        continue;
      }

      const hasSkillFile = entries.some(
        (entry) => entry.type === 'file' && entry.name.toLowerCase() === 'skill.md'
      );

      if (hasSkillFile) {
        discovered.push({
          path: current.path,
          name: this.fs.basename(current.path),
          modified: current.modified,
        });
        continue;
      }

      if (current.depth >= MAX_DEPTH) continue;

      for (const entry of entries) {
        if (entry.type !== 'directory') continue;
        queue.push({ path: entry.path, modified: entry.modified, depth: current.depth + 1 });
      }
    }

    return discovered;
  }

  async scanSkills(): Promise<Capability[]> {
    const skills: Capability[] = [];
    const seen = new Set<string>();
    const skillsPaths = await this.resolveBasePaths(SKILL_DIR_CANDIDATES);

    for (const skillsPath of skillsPaths) {
      try {
        const skillDirectories = await this.discoverSkillDirectories(skillsPath);
        for (const directory of skillDirectories) {
          const skill = await this.loadSkill(directory.path, directory.name, directory.modified);
          if (skill && !seen.has(skill.id)) {
            seen.add(skill.id);
            skills.push(skill);
          }
        }
      } catch {
        // Ignore missing skills paths.
      }
    }

    return skills;
  }

  private async loadSkill(dirPath: string, name: string, modified?: Date): Promise<Capability | null> {
    try {
      const configPath = this.fs.join(dirPath, 'config.json');
      const skillMdPath = this.fs.join(dirPath, 'SKILL.md');
      
      let config: any = {};
      let content = '';
      
      try {
        const configContent = await this.fs.readFile(configPath);
        config = safeJSONParse(configContent, {});
      } catch (e) {
        // No config, use defaults
      }

      try {
        content = await this.fs.readFile(skillMdPath);
      } catch (e) {
        // No SKILL.md
      }

      // Scan for nested files
      const files = await this.scanDirectoryStructure(dirPath);

      return {
        id: `skill-${this.toSafeId(dirPath)}`,
        name: config.name || name,
        description: config.description || `Skill: ${name}`,
        icon: 'book-open',
        enabled: config.enabled !== false,
        version: config.version || '1.0.0',
        author: config.author || 'System',
        updatedAt: config.updatedAt || modified?.toISOString() || new Date().toISOString(),
        content,
        files,
      };
    } catch (e) {
      console.error('Failed to load skill:', name, e);
      return null;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  private toDisplayLabel(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return 'Unnamed';
    return trimmed
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private toTriggerSlug(value: string): string {
    return this.toSafeId(value).slice(0, 64) || 'command';
  }

  private getCommandDedupKey(command: Capability): string {
    const trigger = (command.trigger || '').trim().toLowerCase();
    if (trigger) return `trigger:${trigger}`;
    return `name:${command.name.trim().toLowerCase()}`;
  }

  private getMcpDedupKey(mcp: Capability): string {
    return mcp.name.trim().toLowerCase();
  }

  private getWebhookDedupKey(webhook: Capability): string {
    return webhook.name.trim().toLowerCase();
  }

  private parseMarkdownDescription(content: string): string | null {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('#')) continue;
      return trimmed.slice(0, 220);
    }
    return null;
  }

  private async resolveCandidateFiles(relativePaths: string[]): Promise<string[]> {
    const candidates = new Set<string>();
    const homeDir = this.fs.getHomeDir();

    for (const relativePath of relativePaths) {
      candidates.add(this.fs.join(homeDir, relativePath));
      candidates.add(relativePath);
      candidates.add(this.fs.join('.', relativePath));
    }

    const existing: string[] = [];
    for (const candidate of candidates) {
      try {
        if (await this.fs.exists(candidate)) {
          existing.push(candidate);
        }
      } catch {
        // Ignore invalid candidate.
      }
    }

    return existing;
  }

  private async resolveCandidateDirectories(relativePaths: string[]): Promise<string[]> {
    const candidates = new Set<string>();
    const homeDir = this.fs.getHomeDir();

    for (const relativePath of relativePaths) {
      candidates.add(this.fs.join(homeDir, relativePath));
      candidates.add(relativePath);
      candidates.add(this.fs.join('.', relativePath));
    }

    const existing: string[] = [];
    for (const candidate of candidates) {
      try {
        if (!(await this.fs.exists(candidate))) continue;
        const entries = await this.fs.readDir(candidate);
        if (Array.isArray(entries)) {
          existing.push(candidate);
        }
      } catch {
        // Ignore invalid directory candidate.
      }
    }

    return existing;
  }

  private parseSlashNamesFromSource(content: string): string[] {
    const names = new Set<string>();
    const matcher = /slash:\s*\{\s*name:\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null = matcher.exec(content);
    while (match) {
      const name = match[1].trim();
      if (name) names.add(name);
      match = matcher.exec(content);
    }
    return Array.from(names);
  }

  private normalizeCliCommandLiteral(commandLiteral: string): string | null {
    const trimmed = commandLiteral.trim();
    if (!trimmed) return null;
    const firstToken = trimmed.split(/\s+/)[0];
    if (!firstToken) return null;
    if (firstToken.startsWith('<') || firstToken.startsWith('[')) return null;
    const cleaned = firstToken.replace(/[^A-Za-z0-9._:@+-]/g, '');
    if (!cleaned) return null;
    if (!/^[A-Za-z]/.test(cleaned)) return null;
    return cleaned;
  }

  private parseCliCommandLiterals(content: string): string[] {
    const commands = new Set<string>();
    const matcher = /command:\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null = matcher.exec(content);
    while (match) {
      const normalized = this.normalizeCliCommandLiteral(match[1]);
      if (normalized) commands.add(normalized);
      match = matcher.exec(content);
    }
    return Array.from(commands);
  }

  private parseAllternitSwitchSubcommands(content: string): string[] {
    const commands = new Set<string>();
    const matcher = /case\s+["']([^"']+)["']\s*:/g;
    let match: RegExpExecArray | null = matcher.exec(content);
    while (match) {
      const command = match[1].trim();
      if (!command || command === 'help' || command.startsWith('-')) {
        match = matcher.exec(content);
        continue;
      }
      commands.add(command);
      match = matcher.exec(content);
    }
    return Array.from(commands);
  }

  private parseTomlSection(content: string, sectionName: string): string[] {
    const lines = content.split(/\r?\n/);
    const sectionLines: string[] = [];
    let isInSection = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        isInSection = sectionMatch[1] === sectionName;
        continue;
      }
      if (isInSection) {
        sectionLines.push(line);
      }
    }

    return sectionLines;
  }

  private parseTomlStringOrArray(rawValue: string): string | string[] | null {
    const value = rawValue.trim();
    if (!value) return null;

    if (value.startsWith('[') && value.endsWith(']')) {
      const parsed: string[] = [];
      const matcher = /"((?:\\.|[^"])*)"/g;
      let match: RegExpExecArray | null = matcher.exec(value);
      while (match) {
        parsed.push(match[1].replace(/\\"/g, '"'));
        match = matcher.exec(value);
      }
      return parsed;
    }

    const quoted = value.match(/^"((?:\\.|[^"])*)"$/);
    if (quoted) {
      return quoted[1].replace(/\\"/g, '"');
    }

    return value;
  }

  private parseTomlMcpSections(content: string): Array<{ name: string; values: Record<string, unknown> }> {
    const lines = content.split(/\r?\n/);
    const sections: Array<{ name: string; values: Record<string, unknown> }> = [];
    let current: { name: string; values: Record<string, unknown> } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      const sectionMatch = trimmed.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        if (current) sections.push(current);
        const sectionName = sectionMatch[1];
        const mcpMatch = sectionName.match(/^mcp_servers\.([A-Za-z0-9._-]+)$/);
        current = mcpMatch ? { name: mcpMatch[1], values: {} } : null;
        continue;
      }

      if (!current || !trimmed || trimmed.startsWith('#')) continue;
      const keyMatch = trimmed.match(/^([A-Za-z0-9._-]+)\s*=\s*(.+)$/);
      if (!keyMatch) continue;
      const parsed = this.parseTomlStringOrArray(keyMatch[2]);
      if (parsed !== null) {
        current.values[keyMatch[1]] = parsed;
      }
    }

    if (current) sections.push(current);
    return sections;
  }

  private parseTomlHookHandlers(content: string): Array<{ event: string; handlers: string[] }> {
    const sectionLines = this.parseTomlSection(content, 'hooks');
    const hooks: Array<{ event: string; handlers: string[] }> = [];

    for (const line of sectionLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const keyMatch = trimmed.match(/^([A-Za-z0-9._-]+)\s*=\s*(.+)$/);
      if (!keyMatch) continue;
      const event = keyMatch[1];
      const parsed = this.parseTomlStringOrArray(keyMatch[2]);
      const handlers = typeof parsed === 'string'
        ? [parsed]
        : Array.isArray(parsed)
          ? parsed
          : [];
      hooks.push({ event, handlers: handlers.filter(Boolean) });
    }

    return hooks;
  }

  // -------------------------------------------------------------------------
  // Commands Scanner
  // -------------------------------------------------------------------------
  async scanCommands(): Promise<Capability[]> {
    const commands: Capability[] = [];
    const seen = new Set<string>();
    const addCommand = (command: Capability | null) => {
      if (!command) return;
      const key = this.getCommandDedupKey(command);
      if (seen.has(key)) return;
      seen.add(key);
      commands.push(command);
    };
    const commandsPaths = await this.resolveBasePaths(COMMAND_DIR_CANDIDATES);

    for (const commandsPath of commandsPaths) {
      try {
        const entries = await this.fs.readDir(commandsPath);
        
        for (const entry of entries) {
          if (entry.type === 'file' && entry.name.endsWith('.json')) {
            const command = await this.loadCommand(entry.path, entry.name, entry.modified);
            addCommand(command);
          }
        }
      } catch {
        // Ignore missing command paths.
      }
    }

    const markdownCommandPaths = await this.resolveBasePaths(COMMAND_MARKDOWN_DIR_CANDIDATES);
    for (const markdownPath of markdownCommandPaths) {
      try {
        const entries = await this.fs.readDir(markdownPath);
        for (const entry of entries) {
          if (entry.type !== 'file' || !entry.name.toLowerCase().endsWith('.md')) continue;
          const commandName = entry.name.replace(/\.md$/i, '');
          let description = `Slash command ${commandName}`;
          try {
            const markdown = await this.fs.readFile(entry.path);
            description = this.parseMarkdownDescription(markdown) || description;
          } catch {
            // Keep fallback description.
          }

          addCommand({
            id: `cmd-${this.toSafeId(entry.path)}`,
            name: this.toDisplayLabel(commandName),
            description,
            icon: 'command',
            enabled: true,
            trigger: `/${this.toTriggerSlug(commandName)}`,
            version: 'runtime',
            author: 'Claude CLI',
            updatedAt: entry.modified?.toISOString() || new Date().toISOString(),
            content: `Source: ${entry.path}`,
          });
        }
      } catch {
        // Ignore missing markdown command paths.
      }
    }

    const commandConfigFiles = await this.resolveCandidateFiles(COMMAND_CONFIG_FILE_CANDIDATES);
    for (const configPath of commandConfigFiles) {
      try {
        const raw = await this.fs.readFile(configPath);
        const parsed = safeJSONParse<unknown>(raw, {});
        const config = this.asRecord(parsed);
        if (!config) continue;
        const updatedAt = new Date().toISOString();

        const pushCommandEntry = (
          trigger: string,
          name: string,
          description: string,
          author: string,
          metadata?: Record<string, unknown>
        ) => {
          const cleanedTrigger = trigger.trim();
          if (!cleanedTrigger.startsWith('/') && !cleanedTrigger.startsWith('@')) return;
          addCommand({
            id: `cmd-${this.toSafeId(`${configPath}:${cleanedTrigger}`)}`,
            name,
            description,
            icon: 'command',
            enabled: true,
            trigger: cleanedTrigger,
            version: 'runtime',
            author,
            updatedAt,
            content: metadata ? JSON.stringify(metadata, null, 2) : `Source: ${configPath}`,
            language: metadata ? 'json' : undefined,
          });
        };

        const pluginList = [
          ...this.asStringArray(config.plugin),
          ...this.asStringArray(config.plugins),
        ];
        if (pluginList.some((entry) => entry.toLowerCase().includes('oh-my-opencode'))) {
          const disabled = new Set(this.asStringArray(config.disabled_commands));
          for (const builtin of OH_MY_OPENCODE_BUILTIN_COMMANDS) {
            if (disabled.has(builtin)) continue;
            pushCommandEntry(
              `/${builtin}`,
              this.toDisplayLabel(builtin),
              `Built-in slash command from oh-my-opencode (${builtin})`,
              'Gizzi/OpenCode'
            );
          }
        }

        const commandEntries = config.commands;
        if (Array.isArray(commandEntries)) {
          for (const entry of commandEntries) {
            if (typeof entry === 'string') {
              const trigger = entry.startsWith('/') || entry.startsWith('@')
                ? entry
                : `/${this.toTriggerSlug(entry)}`;
              const normalized = entry.replace(/^[@/]+/, '');
              pushCommandEntry(
                trigger,
                this.toDisplayLabel(normalized),
                `Configured command from ${configPath}`,
                'Runtime Config'
              );
              continue;
            }

            const commandRecord = this.asRecord(entry);
            if (!commandRecord) continue;
            const triggerValue = typeof commandRecord.trigger === 'string'
              ? commandRecord.trigger
              : typeof commandRecord.command === 'string'
                ? commandRecord.command
                : null;
            if (!triggerValue) continue;
            const normalized = triggerValue.replace(/^[@/]+/, '');
            const commandName = typeof commandRecord.name === 'string'
              ? commandRecord.name
              : this.toDisplayLabel(normalized);
            const description = typeof commandRecord.description === 'string'
              ? commandRecord.description
              : `Configured command from ${configPath}`;
            pushCommandEntry(triggerValue, commandName, description, 'Runtime Config', commandRecord);
          }
        } else {
          const commandMap = this.asRecord(commandEntries);
          if (commandMap) {
            for (const [key, value] of Object.entries(commandMap)) {
              const commandRecord = this.asRecord(value);
              if (!commandRecord) continue;
              const triggerValue = typeof commandRecord.trigger === 'string'
                ? commandRecord.trigger
                : key.startsWith('/') || key.startsWith('@')
                  ? key
                  : `/${this.toTriggerSlug(key)}`;
              const description = typeof commandRecord.description === 'string'
                ? commandRecord.description
                : `Configured command from ${configPath}`;
              const commandName = typeof commandRecord.name === 'string'
                ? commandRecord.name
                : this.toDisplayLabel(key.replace(/^[@/]+/, ''));
              pushCommandEntry(triggerValue, commandName, description, 'Runtime Config', commandRecord);
            }
          }
        }

        const agentGroups = [this.asRecord(config.agent), this.asRecord(config.agents)];
        for (const agentGroup of agentGroups) {
          if (!agentGroup) continue;
          for (const [agentName, agentValue] of Object.entries(agentGroup)) {
            const trimmedAgentName = agentName.trim();
            if (!trimmedAgentName) continue;
            const mentionTrigger = trimmedAgentName.startsWith('@')
              ? trimmedAgentName
              : `@${trimmedAgentName}`;
            const aliasTrigger = `@${this.toTriggerSlug(trimmedAgentName.replace(/^@+/, ''))}`;
            const agentRecord = this.asRecord(agentValue);
            const description = agentRecord && typeof agentRecord.description === 'string'
              ? agentRecord.description
              : `Mention command for ${agentName}`;
            const metadata: Record<string, unknown> = {};
            if (agentRecord) {
              if (typeof agentRecord.mode === 'string') metadata.mode = agentRecord.mode;
              if (typeof agentRecord.model === 'string') metadata.model = agentRecord.model;
              if (typeof agentRecord.hidden === 'boolean') metadata.hidden = agentRecord.hidden;
            }
            if (aliasTrigger.toLowerCase() !== mentionTrigger.toLowerCase()) {
              metadata.aliasTrigger = aliasTrigger;
            }

            pushCommandEntry(
              mentionTrigger,
              this.toDisplayLabel(agentName),
              description,
              'Gizzi/OpenCode',
              metadata
            );
          }
        }
      } catch {
        // Ignore malformed runtime config files.
      }
    }

    const internalCommandSources = await this.resolveCandidateFiles(INTERNAL_COMMAND_SOURCE_FILE_CANDIDATES);
    for (const sourcePath of internalCommandSources) {
      try {
        const content = await this.fs.readFile(sourcePath);
        const lowerPath = sourcePath.toLowerCase().replace(/\\/g, '/');
        const updatedAt = new Date().toISOString();

        if (lowerPath.includes('/cli/ui/tui/routes/session/index.tsx')) {
          const slashCommands = this.parseSlashNamesFromSource(content);
          for (const slashName of slashCommands) {
            addCommand({
              id: `cmd-${this.toSafeId(`${sourcePath}:${slashName}`)}`,
              name: this.toDisplayLabel(slashName),
              description: `Built-in Gizzi slash command (${slashName})`,
              icon: 'command',
              enabled: true,
              trigger: `/${slashName}`,
              version: 'runtime',
              author: 'Gizzi Terminal',
              updatedAt,
              content: `Source: ${sourcePath}`,
            });
          }
        }

      } catch {
        // Ignore unreadable internal command source files.
      }
    }

    return commands;
  }

  private async loadCommand(filePath: string, filename: string, modified?: Date): Promise<Capability | null> {
    try {
      const content = await this.fs.readFile(filePath);
      const config = safeJSONParse<Record<string, unknown>>(content, {});
      const name = filename.replace('.json', '');

      return {
        id: `cmd-${this.toSafeId(filePath)}`,
        name: (config.name as string) || name,
        description: (config.description as string) || `Command: ${name}`,
        icon: 'command',
        enabled: config.enabled !== false,
        trigger: (config.trigger as string) || `/${name}`,
        version: (config.version as string) || '1.0.0',
        author: (config.author as string) || 'System',
        updatedAt: (config.updatedAt as string) || modified?.toISOString() || new Date().toISOString(),
        content: (config.content as string) || '',
      };
    } catch (e) {
      console.error('Failed to load command:', filename, e);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Plugins Scanner (with nested structure)
  // -------------------------------------------------------------------------
  async scanPlugins(): Promise<Capability[]> {
    const plugins: Capability[] = [];
    const seen = new Set<string>();
    const pluginsPaths = await this.resolveBasePaths(PLUGIN_DIR_CANDIDATES);

    for (const pluginsPath of pluginsPaths) {
      try {
        const entries = await this.fs.readDir(pluginsPath);
        
        for (const entry of entries) {
          if (entry.type === 'directory') {
            const plugin = await this.loadPlugin(entry.path, entry.name, entry.modified);
            if (plugin && !seen.has(plugin.id)) {
              seen.add(plugin.id);
              plugins.push(plugin);
            }
          }
        }
      } catch {
        // Ignore missing plugin paths.
      }
    }

    return plugins;
  }

  private async loadPlugin(dirPath: string, name: string, modified?: Date): Promise<Capability | null> {
    try {
      const pluginManifestCandidates = [
        this.fs.join(dirPath, '.claude-plugin', 'plugin.json'),
        this.fs.join(dirPath, 'plugin.json'),
        this.fs.join(dirPath, 'config.json'),
      ];
      let config: any = {};
      
      for (const candidatePath of pluginManifestCandidates) {
        try {
          const content = await this.fs.readFile(candidatePath);
          config = safeJSONParse(content, {});
          if (config && typeof config === 'object' && Object.keys(config).length > 0) {
            break;
          }
        } catch {
          // Try next candidate.
        }
      }
      if (!config || typeof config !== 'object') config = { name, id: name };
      if (!config.name) config.name = name;
      if (!config.id) config.id = name;

      // Scan full directory structure
      const files = await this.scanDirectoryStructure(dirPath);
      const author =
        typeof config.author === 'string'
          ? config.author
          : (config.author && typeof config.author.name === 'string')
            ? config.author.name
            : 'System';

      return {
        id: `plugin-${config.id || name}`,
        name: config.name || name,
        description: config.description || `Plugin: ${name}`,
        icon: 'puzzle',
        enabled: config.enabled !== false,
        version: config.version || '1.0.0',
        author,
        updatedAt: config.updatedAt || modified?.toISOString() || new Date().toISOString(),
        files,
      };
    } catch (e) {
      console.error('Failed to load plugin:', name, e);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // CLI Tools Scanner
  // -------------------------------------------------------------------------
  async scanCliTools(): Promise<Capability[]> {
    const toolsByName = new Map<string, Capability>();
    const now = new Date().toISOString();

    const addTool = (
      name: string,
      commandValue: string,
      options?: {
        description?: string;
        author?: string;
      }
    ) => {
      const normalizedName = name.trim();
      if (!normalizedName) return;
      if (!/^[A-Za-z0-9][A-Za-z0-9._:+@-]*$/.test(normalizedName)) return;
      const dedupKey = normalizedName.toLowerCase();
      if (toolsByName.has(dedupKey)) return;

      toolsByName.set(dedupKey, {
        id: `cli-${this.toSafeId(normalizedName)}`,
        name: normalizedName,
        description: options?.description || 'Discovered from system PATH',
        icon: 'terminal',
        enabled: true,
        command: commandValue || normalizedName,
        author: options?.author || 'System PATH',
        updatedAt: now,
      });
    };

    const packageFiles = await this.resolveCandidateFiles(INTERNAL_CLI_PACKAGE_FILE_CANDIDATES);
    for (const packagePath of packageFiles) {
      try {
        const raw = await this.fs.readFile(packagePath);
        const parsed = safeJSONParse<unknown>(raw, {});
        const pkg = this.asRecord(parsed);
        if (!pkg) continue;

        const packageName = typeof pkg.name === 'string'
          ? pkg.name
          : this.fs.basename(this.fs.dirname(packagePath));
        const packageLabel = this.toSafeId(packageName.replace(/^@[^/]+\//, '')) || 'package';
        const packageDir = this.fs.dirname(packagePath);

        if (typeof pkg.bin === 'string') {
          const inferredBinName = packageName.replace(/^@[^/]+\//, '');
          addTool(
            inferredBinName,
            this.fs.join(packageDir, pkg.bin),
            {
              description: `CLI binary from ${packageName}`,
              author: 'Allternit Internal CLI',
            }
          );
        } else {
          const bins = this.asRecord(pkg.bin);
          if (bins) {
            for (const [binName, binPathValue] of Object.entries(bins)) {
              if (typeof binPathValue !== 'string') continue;
              addTool(
                binName,
                this.fs.join(packageDir, binPathValue),
                {
                  description: `CLI binary from ${packageName}`,
                  author: 'Allternit Internal CLI',
                }
              );
            }
          }
        }

        const scripts = this.asRecord(pkg.scripts);
        if (scripts) {
          for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
            if (typeof scriptCommand !== 'string') continue;
            const trimmedScriptName = scriptName.trim();
            if (!trimmedScriptName) continue;
            const scriptToolName = `${packageLabel}:${trimmedScriptName}`;
            addTool(
              scriptToolName,
              `pnpm --dir "${packageDir}" run ${trimmedScriptName}`,
              {
                description: `Package script from ${packageName}`,
                author: 'Allternit Internal CLI',
              }
            );
          }
        }
      } catch {
        // Ignore malformed package metadata.
      }
    }

    const internalExecutableDirs = await this.resolveCandidateDirectories(INTERNAL_EXECUTABLE_DIR_CANDIDATES);
    for (const executableDir of internalExecutableDirs) {
      let entries: FileEntry[] = [];
      try {
        entries = await this.fs.readDir(executableDir);
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.type !== 'file') continue;
        if (entry.name.startsWith('.')) continue;
        addTool(entry.name, entry.path, {
          description: `Internal executable from ${executableDir}`,
          author: 'Allternit Internal CLI',
        });
      }
    }

    const gizziCommandDirs = await this.resolveCandidateDirectories(INTERNAL_GIZZI_COMMAND_DIR_CANDIDATES);
    for (const commandDir of gizziCommandDirs) {
      let entries: FileEntry[] = [];
      try {
        entries = await this.fs.readDir(commandDir);
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.type !== 'file') continue;
        if (!entry.name.endsWith('.ts')) continue;
        const moduleName = entry.name.replace(/\.ts$/i, '').trim();
        if (!moduleName || moduleName === 'cmd') continue;
        const normalizedTopLevel = this.normalizeCliCommandLiteral(moduleName);
        if (!normalizedTopLevel) continue;
        try {
          const content = await this.fs.readFile(entry.path);
          const commandLiterals = this.parseCliCommandLiterals(content);
          addTool(`gizzi:${normalizedTopLevel}`, `gizzi ${normalizedTopLevel}`, {
            description: `Internal Gizzi command from ${entry.name}`,
            author: 'Allternit Internal CLI',
          });

          for (const subcommand of commandLiterals) {
            if (subcommand === normalizedTopLevel) continue;
            if (!/^[A-Za-z][A-Za-z0-9._:@+-]*$/.test(subcommand)) continue;
            addTool(`gizzi:${normalizedTopLevel}:${subcommand}`, `gizzi ${normalizedTopLevel} ${subcommand}`, {
              description: `Internal Gizzi subcommand from ${entry.name}`,
              author: 'Allternit Internal CLI',
            });
          }
        } catch {
          // Ignore unreadable command module.
        }
      }
    }

    const allternitSwitchFiles = await this.resolveCandidateFiles(INTERNAL_ALLTERNIT_CLI_SWITCH_FILE_CANDIDATES);
    for (const switchFile of allternitSwitchFiles) {
      try {
        const content = await this.fs.readFile(switchFile);
        const subcommands = this.parseAllternitSwitchSubcommands(content);
        for (const subcommand of subcommands) {
          addTool(`allternit:${subcommand}`, `allternit ${subcommand}`, {
            description: `Internal allternit subcommand from ${switchFile}`,
            author: 'Allternit Internal CLI',
          });
        }
      } catch {
        // Ignore missing allternit switch command source.
      }
    }

    const pathDirectories = new Set<string>();
    try {
      const pathResult = await this.fs.exec('echo "$PATH"');
      const fromRuntimePath = pathResult.stdout
        .split(':')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      for (const entry of fromRuntimePath) {
        pathDirectories.add(entry);
      }
    } catch {
      // Runtime PATH command unavailable; fallback paths are still scanned below.
    }

    const homeDir = this.fs.getHomeDir();
    const fallbackPathDirectories = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      this.fs.join(homeDir, '.local/bin'),
      this.fs.join(homeDir, '.bun/bin'),
      this.fs.join(homeDir, '.cargo/bin'),
      this.fs.join(homeDir, '.npm-global/bin'),
    ];
    for (const fallbackDir of fallbackPathDirectories) {
      if (fallbackDir && fallbackDir.trim()) {
        pathDirectories.add(fallbackDir.trim());
      }
    }

    for (const pathEntry of pathDirectories) {
      try {
        if (!(await this.fs.exists(pathEntry))) continue;
      } catch {
        continue;
      }

      let entries: FileEntry[] = [];
      try {
        entries = await this.fs.readDir(pathEntry);
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.type !== 'file') continue;
        if (entry.name.startsWith('.')) continue;
        addTool(entry.name, entry.path, {
          description: `Discovered from PATH directory ${pathEntry}`,
          author: 'System PATH',
        });
        if (toolsByName.size >= 2600) break;
      }

      if (toolsByName.size >= 2600) break;
    }

    if (toolsByName.size === 0) {
      const commonTools = [
        'git', 'docker', 'node', 'npm', 'yarn', 'pnpm',
        'python', 'python3', 'pip', 'go', 'cargo',
        'kubectl', 'helm', 'terraform', 'aws', 'gcloud',
        'code', 'cursor', 'vim', 'nvim', 'emacs',
      ];

      for (const tool of commonTools) {
        try {
          const result = await this.fs.exec(`command -v ${tool}`);
          const resolved = result.stdout.trim();
          if (resolved) {
            addTool(tool, resolved, {
              description: 'Discovered from command lookup',
              author: 'System PATH',
            });
          }
        } catch {
          // Tool unavailable in this environment.
        }
      }
    }

    return Array.from(toolsByName.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 2200);
  }

  // -------------------------------------------------------------------------
  // MCP Scanner
  // -------------------------------------------------------------------------
  async scanMcps(): Promise<Capability[]> {
    const mcps: Capability[] = [];
    const seen = new Set<string>();
    const addMcp = (mcp: Capability | null) => {
      if (!mcp) return;
      const key = this.getMcpDedupKey(mcp);
      if (seen.has(key)) return;
      seen.add(key);
      mcps.push(mcp);
    };
    const mcpsPaths = await this.resolveBasePaths(MCP_DIR_CANDIDATES);

    for (const mcpsPath of mcpsPaths) {
      try {
        const entries = await this.fs.readDir(mcpsPath);
        
        for (const entry of entries) {
          if (entry.type === 'file' && entry.name.endsWith('.json')) {
            const mcp = await this.loadMcp(entry.path, entry.name, entry.modified);
            addMcp(mcp);
          }
        }
      } catch {
        // Ignore missing MCP paths.
      }
    }

    const configFiles = await this.resolveCandidateFiles(MCP_CONFIG_FILE_CANDIDATES);
    for (const configPath of configFiles) {
      try {
        if (configPath.toLowerCase().endsWith('.toml')) {
          const raw = await this.fs.readFile(configPath);
          const sections = this.parseTomlMcpSections(raw);
          for (const section of sections) {
            const values = section.values;
            const name = this.toDisplayLabel(section.name);
            const commandValue = values.command;
            const argsValue = values.args;
            const command = typeof commandValue === 'string' ? commandValue : '';
            const args = this.asStringArray(argsValue);
            const url = typeof values.url === 'string' ? values.url : '';
            const description = url
              ? `MCP server ${section.name} (${url})`
              : command
                ? `MCP server ${section.name} (${command})`
                : `MCP server ${section.name}`;

            addMcp({
              id: `mcp-${this.toSafeId(`${configPath}:${section.name}`)}`,
              name,
              description,
              icon: 'cpu',
              enabled: true,
              version: 'runtime',
              author: 'Runtime Config',
              updatedAt: new Date().toISOString(),
              content: JSON.stringify(
                {
                  source: configPath,
                  transport: values.transport,
                  url,
                  command,
                  args,
                },
                null,
                2
              ),
              language: 'json',
            });
          }
          continue;
        }

        const raw = await this.fs.readFile(configPath);
        const parsed = safeJSONParse<unknown>(raw, {});
        const config = this.asRecord(parsed);
        if (!config) continue;

        const containers = [
          this.asRecord(config.mcp),
          this.asRecord(config.mcpServers),
          this.asRecord(config.mcp_servers),
        ];

        for (const container of containers) {
          if (!container) continue;
          for (const [mcpName, mcpValue] of Object.entries(container)) {
            const mcpRecord = this.asRecord(mcpValue);
            if (!mcpRecord) continue;

            const commandValue = mcpRecord.command;
            const commandParts = Array.isArray(commandValue)
              ? this.asStringArray(commandValue)
              : typeof commandValue === 'string'
                ? [commandValue]
                : [];
            const command = commandParts[0] || '';
            const args = commandParts.length > 1
              ? commandParts.slice(1)
              : this.asStringArray(mcpRecord.args);
            const url = typeof mcpRecord.url === 'string' ? mcpRecord.url : '';
            const description = typeof mcpRecord.description === 'string'
              ? mcpRecord.description
              : url
                ? `MCP server ${mcpName} (${url})`
                : command
                  ? `MCP server ${mcpName} (${command})`
                  : `MCP server ${mcpName}`;

            addMcp({
              id: `mcp-${this.toSafeId(`${configPath}:${mcpName}`)}`,
              name: this.toDisplayLabel(mcpName),
              description,
              icon: 'cpu',
              enabled: mcpRecord.enabled !== false,
              version: typeof mcpRecord.version === 'string' ? mcpRecord.version : 'runtime',
              author: 'Runtime Config',
              updatedAt: new Date().toISOString(),
              content: JSON.stringify(
                {
                  source: configPath,
                  command,
                  args,
                  url,
                  transport: mcpRecord.transport,
                  type: mcpRecord.type,
                },
                null,
                2
              ),
              language: 'json',
            });
          }
        }
      } catch {
        // Ignore malformed runtime config files.
      }
    }

    return mcps;
  }

  private async loadMcp(filePath: string, filename: string, modified?: Date): Promise<Capability | null> {
    try {
      const content = await this.fs.readFile(filePath);
      const config = safeJSONParse<Record<string, unknown>>(content, {});
      const name = filename.replace('.json', '');

      return {
        id: `mcp-${this.toSafeId(filePath)}`,
        name: (config.name as string) || name,
        description: (config.description as string) || `MCP Server: ${name}`,
        icon: 'cpu',
        enabled: config.enabled !== false,
        version: (config.version as string) || '1.0.0',
        author: (config.author as string) || 'System',
        updatedAt: (config.updatedAt as string) || modified?.toISOString() || new Date().toISOString(),
        content: JSON.stringify(config, null, 2),
        language: 'json',
      };
    } catch (e) {
      console.error('Failed to load MCP:', filename, e);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Webhooks Scanner
  // -------------------------------------------------------------------------
  async scanWebhooks(): Promise<Capability[]> {
    const webhooks: Capability[] = [];
    const seen = new Set<string>();
    const addWebhook = (webhook: Capability | null) => {
      if (!webhook) return;
      const key = this.getWebhookDedupKey(webhook);
      if (seen.has(key)) return;
      seen.add(key);
      webhooks.push(webhook);
    };
    const webhooksPaths = await this.resolveBasePaths(WEBHOOK_DIR_CANDIDATES);

    for (const webhooksPath of webhooksPaths) {
      try {
        const entries = await this.fs.readDir(webhooksPath);
        
        for (const entry of entries) {
          if (entry.type === 'file' && entry.name.endsWith('.json')) {
            const webhook = await this.loadWebhook(entry.path, entry.name, entry.modified);
            addWebhook(webhook);
          }
        }
      } catch {
        // Ignore missing webhook paths.
      }
    }

    const configFiles = await this.resolveCandidateFiles(WEBHOOK_CONFIG_FILE_CANDIDATES);
    for (const configPath of configFiles) {
      try {
        if (configPath.toLowerCase().endsWith('.toml')) {
          const raw = await this.fs.readFile(configPath);
          const hooks = this.parseTomlHookHandlers(raw);
          for (const hook of hooks) {
            const path = `/hooks/${this.toTriggerSlug(hook.event)}`;
            const description = hook.handlers.length > 0
              ? `Hook ${hook.event} (${hook.handlers.length} handler${hook.handlers.length === 1 ? '' : 's'})`
              : `Hook ${hook.event}`;
            addWebhook({
              id: `webhook-${this.toSafeId(`${configPath}:${hook.event}`)}`,
              name: this.toDisplayLabel(hook.event),
              description,
              icon: 'webhook',
              enabled: true,
              version: 'runtime',
              author: 'Runtime Config',
              updatedAt: new Date().toISOString(),
              content: JSON.stringify(
                {
                  source: configPath,
                  event: hook.event,
                  handlers: hook.handlers,
                  path,
                },
                null,
                2
              ),
              language: 'json',
            });
          }
          continue;
        }

        const raw = await this.fs.readFile(configPath);
        const parsed = safeJSONParse<unknown>(raw, {});
        const config = this.asRecord(parsed);
        if (!config) continue;
        const hookContainers = [this.asRecord(config.hooks), this.asRecord(config.webhooks)];

        for (const container of hookContainers) {
          if (!container) continue;
          for (const [hookName, hookValue] of Object.entries(container)) {
            const hookRecord = this.asRecord(hookValue);
            const handlers = typeof hookValue === 'string'
              ? [hookValue]
              : Array.isArray(hookValue)
                ? this.asStringArray(hookValue)
                : hookRecord
                  ? [
                    ...this.asStringArray(hookRecord.handlers),
                    ...this.asStringArray(hookRecord.commands),
                    ...(typeof hookRecord.command === 'string' ? [hookRecord.command] : []),
                    ...(typeof hookRecord.url === 'string' ? [hookRecord.url] : []),
                  ]
                  : [];

            const path = hookRecord && typeof hookRecord.path === 'string'
              ? hookRecord.path
              : `/hooks/${this.toTriggerSlug(hookName)}`;
            const description = hookRecord && typeof hookRecord.description === 'string'
              ? hookRecord.description
              : handlers.length > 0
                ? `Hook ${hookName} (${handlers.length} handler${handlers.length === 1 ? '' : 's'})`
                : `Hook ${hookName}`;

            addWebhook({
              id: `webhook-${this.toSafeId(`${configPath}:${hookName}`)}`,
              name: this.toDisplayLabel(hookName),
              description,
              icon: 'webhook',
              enabled: hookRecord ? hookRecord.enabled !== false : true,
              version: hookRecord && typeof hookRecord.version === 'string' ? hookRecord.version : 'runtime',
              author: 'Runtime Config',
              updatedAt: new Date().toISOString(),
              content: JSON.stringify(
                {
                  source: configPath,
                  event: hookName,
                  path,
                  handlers,
                },
                null,
                2
              ),
              language: 'json',
            });
          }
        }
      } catch {
        // Ignore malformed runtime config files.
      }
    }

    return webhooks;
  }

  private async loadWebhook(filePath: string, filename: string, modified?: Date): Promise<Capability | null> {
    try {
      const content = await this.fs.readFile(filePath);
      const config = safeJSONParse(content, {}) as Record<string, any>;
      const name = filename.replace('.json', '');

      return {
        id: `webhook-${this.toSafeId(filePath)}`,
        name: config.name || name,
        description: config.description || `Webhook: ${name}`,
        icon: 'webhook',
        enabled: config.enabled !== false,
        version: config.version || '1.0.0',
        author: config.author || 'System',
        updatedAt: config.updatedAt || modified?.toISOString() || new Date().toISOString(),
        content: JSON.stringify(config, null, 2),
        language: 'json',
      }
    } catch (e) {
      console.error('Failed to load webhook:', filename, e);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Connectors Scanner
  // -------------------------------------------------------------------------
  async scanConnectors(): Promise<Capability[]> {
    const connectors: Capability[] = [];
    const seen = new Set<string>();
    const connectorsPaths = await this.resolveBasePaths(CONNECTOR_DIR_CANDIDATES);

    for (const connectorsPath of connectorsPaths) {
      try {
        const entries = await this.fs.readDir(connectorsPath);
        
        for (const entry of entries) {
          if (entry.type === 'file' && entry.name.endsWith('.json')) {
            const connector = await this.loadConnector(entry.path, entry.name, entry.modified);
            if (connector && !seen.has(connector.id)) {
              seen.add(connector.id);
              connectors.push(connector);
            }
          }
        }
      } catch {
        // Ignore missing connector paths.
      }
    }

    return connectors;
  }

  private async loadConnector(filePath: string, filename: string, modified?: Date): Promise<Capability | null> {
    try {
      const content = await this.fs.readFile(filePath);
      const config = safeJSONParse(content, {}) as Record<string, any>;
      const name = filename.replace('.json', '');

      return {
        id: `connector-${this.toSafeId(filePath)}`,
        name: config.name || name,
        description: config.description || `Connector: ${name}`,
        icon: 'plug',
        enabled: config.enabled !== false,
        appName: config.appName || name,
        version: config.version || '1.0.0',
        author: config.author || 'System',
        updatedAt: config.updatedAt || modified?.toISOString() || new Date().toISOString(),
      }
    } catch (e) {
      console.error('Failed to load connector:', filename, e);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Utility: Scan Directory Structure
  // -------------------------------------------------------------------------
  private async scanDirectoryStructure(dirPath: string): Promise<FileNode[]> {
    const root: FileNode = {
      id: dirPath,
      name: this.fs.basename(dirPath),
      type: 'directory',
      path: '/',
      expanded: true,
      children: [],
    };

    await this.scanDirectoryRecursive(dirPath, root, dirPath);

    return [root];
  }

  private async scanDirectoryRecursive(
    dirPath: string, 
    parent: FileNode, 
    basePath: string
  ): Promise<void> {
    try {
      const entries = await this.fs.readDir(dirPath);
      
      for (const entry of entries) {
        const relativePath = entry.path.startsWith(basePath)
          ? entry.path.slice(basePath.length) || '/'
          : this.fs.join('/', entry.name);
        
        if (entry.type === 'directory') {
          const dirNode: FileNode = {
            id: entry.path,
            name: entry.name,
            type: 'directory',
            path: relativePath,
            expanded: false,
            children: [],
          };
          
          if (!parent.children) parent.children = [];
          parent.children.push(dirNode);
          
          await this.scanDirectoryRecursive(entry.path, dirNode, basePath);
        } else {
          // Read file content
          let content = '';
          let language: string | undefined;
          
          try {
            content = await this.fs.readFile(entry.path);
            
            // Detect language from extension
            const ext = entry.name.split('.').pop()?.toLowerCase();
            const langMap: Record<string, string> = {
              'md': 'markdown',
              'json': 'json',
              'ts': 'typescript',
              'js': 'javascript',
              'py': 'python',
              'rs': 'rust',
              'go': 'go',
              'html': 'html',
              'css': 'css',
              'yaml': 'yaml',
              'yml': 'yaml',
              'toml': 'toml',
            };
            language = langMap[ext || ''];
          } catch (e) {
            // Can't read file
          }
          
          const fileNode: FileNode = {
            id: entry.path,
            name: entry.name,
            type: 'file',
            path: relativePath,
            content,
            language,
          };
          
          if (!parent.children) parent.children = [];
          parent.children.push(fileNode);
        }
      }
    } catch (e) {
      console.error('Failed to scan directory:', dirPath, e);
    }
  }
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { 
  CreateSkillInput, 
  CreateCommandInput, 
  CreateConnectorInput, 
  CreateMcpInput, 
  CreateCliToolInput, 
  CreateWebhookInput,
  CreatePluginInput,
} from './capabilityWriter';
import {
  createSkill,
  createCommand,
  createConnector,
  createMcp,
  createCliTool,
  createWebhook,
  createPlugin,
  updateSkill,
  updateCapabilityMetadata,
  updateFileContent,
  deleteCapability,
  createFileInTree,
  createDirectoryInTree,
  deleteFileInTree,
  renameFileInTree,
  toggleCapabilityEnabled,
} from './capabilityWriter';

export interface UseFileSystemReturn {
  skills: Capability[];
  commands: Capability[];
  plugins: Capability[];
  cliTools: Capability[];
  mcps: Capability[];
  webhooks: Capability[];
  connectors: Capability[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  installMarketplacePlugin: (plugin: MarketplacePlugin) => Promise<{ success: boolean; error?: string }>;
  uninstallMarketplacePlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
  fs: FileSystemAPI;
  // CRUD operations
  createSkill: (input: CreateSkillInput) => Promise<{ success: boolean; capability?: Capability; error?: string }>;
  createCommand: (input: CreateCommandInput) => Promise<{ success: boolean; capability?: Capability; error?: string }>;
  createConnector: (input: CreateConnectorInput) => Promise<{ success: boolean; capability?: Capability; error?: string }>;
  createMcp: (input: CreateMcpInput) => Promise<{ success: boolean; capability?: Capability; error?: string }>;
  createCliTool: (input: CreateCliToolInput) => Promise<{ success: boolean; capability?: Capability; error?: string }>;
  createWebhook: (input: CreateWebhookInput) => Promise<{ success: boolean; capability?: Capability; error?: string }>;
  createPlugin: (input: CreatePluginInput) => Promise<{ success: boolean; capability?: Capability; error?: string }>;
  updateSkill: (id: string, updates: Partial<CreateSkillInput>) => Promise<{ success: boolean; error?: string }>;
  updateCapabilityMetadata: (
    type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin',
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      appName: string;
      trigger: string;
      command: string;
    }>
  ) => Promise<{ success: boolean; error?: string }>;
  updateFileContent: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  deleteCapability: (type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin', id: string) => Promise<{ success: boolean; error?: string }>;
  createFileInTree: (parentDir: string, fileName: string, content?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  createDirectoryInTree: (parentDir: string, dirName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  deleteFileInTree: (filePath: string, isDirectory: boolean) => Promise<{ success: boolean; error?: string }>;
  renameFileInTree: (oldPath: string, newName: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  toggleCapabilityEnabled: (type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin', id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
}

export function useFileSystem(): UseFileSystemReturn {
  const [fs, setFs] = useState<FileSystemAPI>(() => new RealFileSystem());
  const [isFsReady, setIsFsReady] = useState(false);
  const isElectronRuntime = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).allternitSidecar || (window as any).process?.versions?.electron);
  }, []);

  // Prefer RealFileSystem, then ApiFileSystem.
  useEffect(() => {
    let cancelled = false;

    const markReady = () => {
      if (!cancelled) {
        setIsFsReady(true);
      }
    };

    if (fs instanceof RealFileSystem) {
      const realFs = fs as RealFileSystem;
      const checkReady = () => Boolean(realFs.isReady && realFs.isReady());

      const poll = setInterval(() => {
        if (checkReady()) {
          clearInterval(poll);
          clearTimeout(fallbackTimer);
          markReady();
        }
      }, 80);

      const fallbackTimer = setTimeout(() => {
        clearInterval(poll);
        if (!checkReady() && !cancelled) {
          console.log('[useFileSystem] RealFileSystem not ready, falling back to ApiFileSystem');
          setFs(new ApiFileSystem());
          return;
        }
        markReady();
      }, 700);

      return () => {
        cancelled = true;
        clearInterval(poll);
        clearTimeout(fallbackTimer);
      };
    }

    if (fs instanceof ApiFileSystem) {
      const apiFs = fs as ApiFileSystem;
      const checkReady = () => Boolean(apiFs.isReady && apiFs.isReady());

      const poll = setInterval(() => {
        if (checkReady()) {
          clearInterval(poll);
          clearTimeout(fallbackTimer);
          markReady();
        }
      }, 80);

      const fallbackTimer = setTimeout(() => {
        clearInterval(poll);
        if (!checkReady() && !cancelled) {
          console.warn('[useFileSystem] ApiFileSystem not ready');
          markReady();
          return;
        }
        markReady();
      }, isElectronRuntime ? 2400 : 1200);

      return () => {
        cancelled = true;
        clearInterval(poll);
        clearTimeout(fallbackTimer);
      };
    }

    if (!(fs instanceof RealFileSystem) && !(fs instanceof ApiFileSystem)) {
      markReady();
      return;
    }
  }, [fs, isElectronRuntime]);

  const scanner = useMemo(() => new CapabilityScanner(fs), [fs]);
  
  const [skills, setSkills] = useState<Capability[]>([]);
  const [commands, setCommands] = useState<Capability[]>([]);
  const [plugins, setPlugins] = useState<Capability[]>([]);
  const [cliTools, setCliTools] = useState<Capability[]>([]);
  const [mcps, setMcps] = useState<Capability[]>([]);
  const [webhooks, setWebhooks] = useState<Capability[]>([]);
  const [connectors, setConnectors] = useState<Capability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isFsReady) {
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const [
        skillsData,
        commandsData,
        pluginsData,
        cliToolsData,
        mcpsData,
        webhooksData,
        connectorsData,
      ] = await Promise.all([
        scanner.scanSkills(),
        scanner.scanCommands(),
        scanner.scanPlugins(),
        scanner.scanCliTools(),
        scanner.scanMcps(),
        scanner.scanWebhooks(),
        scanner.scanConnectors(),
      ]);

      setSkills(skillsData);
      setCommands(commandsData);
      setPlugins(pluginsData);
      setCliTools(cliToolsData);
      setMcps(mcpsData);
      setWebhooks(webhooksData);
      setConnectors(connectorsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to scan capabilities');
    } finally {
      setIsLoading(false);
    }
  }, [scanner, isFsReady]);

  const removeDirectoryRecursive = useCallback(async (targetPath: string): Promise<void> => {
    try {
      const entries = await fs.readDir(targetPath);
      for (const entry of entries) {
        if (entry.type === 'directory') {
          await removeDirectoryRecursive(entry.path);
        } else {
          try {
            await fs.deleteFile(entry.path);
          } catch {
            // Best-effort cleanup.
          }
        }
      }
    } catch {
      // Directory may not exist or may be unsupported in this backend.
    }

    try {
      await fs.deleteFile(targetPath);
    } catch {
      // Some backends do not support deleting directories directly.
    }
  }, [fs]);

  const ensurePersistentWriteBackend = useCallback((): { success: boolean; error?: string } | null => {
    return null;
  }, []);

  // Define installMarketplacePlugin after refresh
  const installMarketplacePlugin = useCallback(
    async (plugin: MarketplacePlugin): Promise<{ success: boolean; error?: string }> => {
      if (!isFsReady) {
        return { success: false, error: 'File system is not ready yet' };
      }
      const persistenceError = ensurePersistentWriteBackend();
      if (persistenceError) return persistenceError;
      try {
        const homeDir = fs.getHomeDir();
        const pluginDir = fs.join(homeDir, PLUGINS_DIR, plugin.id);
        const claudePluginDir = fs.join(pluginDir, '.claude-plugin');
        const installBundle = await resolveMarketplacePluginPackage(plugin);
        const installedAt = new Date().toISOString();
        const ensureRelativeParentDirs = async (relativePath: string) => {
          const segments = relativePath.split('/').filter(Boolean);
          if (segments.length <= 1) return;
          let current = pluginDir;
          for (let i = 0; i < segments.length - 1; i += 1) {
            current = fs.join(current, segments[i]);
            await fs.mkdir(current);
          }
        };

        await fs.mkdir(pluginDir);
        await fs.mkdir(claudePluginDir);

        for (const file of installBundle.files) {
          await ensureRelativeParentDirs(file.relativePath);
          await fs.writeFile(fs.join(pluginDir, file.relativePath), file.content);
        }

        const baseManifest = installBundle.pluginManifest || {};
        const pluginName = typeof baseManifest.name === 'string' && baseManifest.name.trim()
          ? baseManifest.name
          : plugin.name;
        const pluginDescription = typeof baseManifest.description === 'string' && baseManifest.description.trim()
          ? baseManifest.description
          : plugin.description;
        const pluginVersion = typeof baseManifest.version === 'string' && baseManifest.version.trim()
          ? baseManifest.version
          : (plugin.version || '1.0.0');

        const pluginConfig = {
          ...baseManifest,
          id: plugin.id,
          name: pluginName,
          version: pluginVersion,
          description: pluginDescription,
          author: (baseManifest as Record<string, unknown>).author || plugin.author,
          enabled: true,
          installedAt,
          source: 'marketplace',
          category: (baseManifest as Record<string, unknown>).category || plugin.category,
          tags: Array.isArray((baseManifest as Record<string, unknown>).tags)
            ? (baseManifest as Record<string, unknown>).tags
            : (plugin.tags || []),
          sourceLabel: plugin.sourceLabel,
          sourceUrl: plugin.sourceUrl || installBundle.source.sourceUrl,
          sourceTrust: plugin.sourceTrust || 'unknown',
          sourceKind: plugin.sourceKind || 'curated',
          sourceDescriptor: plugin.sourceDescriptor,
          sourceRepo: plugin.sourceRepo || installBundle.source.repo,
          sourceRef: plugin.sourceRef || installBundle.source.ref,
          sourcePath: plugin.sourcePath || installBundle.source.path,
          updatedAt: installedAt,
        };

        const manifestValidation = validatePluginManifestV1(pluginConfig);
        if (!manifestValidation.valid) {
          return {
            success: false,
            error: `Resolved plugin manifest is invalid: ${manifestValidation.errors.slice(0, 4).join(' ')}`,
          };
        }

        await fs.writeFile(fs.join(claudePluginDir, 'plugin.json'), JSON.stringify(pluginConfig, null, 2));
        await fs.writeFile(fs.join(pluginDir, 'plugin.json'), JSON.stringify(pluginConfig, null, 2));

        const readmeContent = installBundle.readme.trim()
          ? installBundle.readme
          : `# ${plugin.name}\n\n${plugin.description}\n`;
        await fs.writeFile(fs.join(pluginDir, 'README.md'), readmeContent);

        await fs.writeFile(
          fs.join(claudePluginDir, 'install-source.json'),
          JSON.stringify(
            {
              installedAt,
              kind: installBundle.source.kind,
              repo: installBundle.source.repo,
              ref: installBundle.source.ref,
              path: installBundle.source.path,
              sourceUrl: installBundle.source.sourceUrl || plugin.sourceUrl,
            },
            null,
            2,
          ),
        );

        await refresh();
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to install plugin',
        };
      }
    },
    [ensurePersistentWriteBackend, fs, refresh, isFsReady]
  );

  const uninstallMarketplacePlugin = useCallback(
    async (pluginId: string): Promise<{ success: boolean; error?: string }> => {
      if (!isFsReady) {
        return { success: false, error: 'File system is not ready yet' };
      }
      const persistenceError = ensurePersistentWriteBackend();
      if (persistenceError) return persistenceError;

      try {
        const normalized = pluginId.startsWith('plugin-') ? pluginId.slice('plugin-'.length) : pluginId;
        const homeDir = fs.getHomeDir();
        const pluginDir = fs.join(homeDir, PLUGINS_DIR, normalized);
        await removeDirectoryRecursive(pluginDir);
        await refresh();
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to uninstall plugin',
        };
      }
    },
    [ensurePersistentWriteBackend, fs, refresh, isFsReady, removeDirectoryRecursive]
  );

  useEffect(() => {
    if (!isFsReady) return;
    void refresh();
  }, [isFsReady, refresh]);

  // CRUD wrappers
  const createSkillWrapper = useCallback(async (input: CreateSkillInput) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await createSkill(fs, input);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const createCommandWrapper = useCallback(async (input: CreateCommandInput) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await createCommand(fs, input);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const createConnectorWrapper = useCallback(async (input: CreateConnectorInput) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await createConnector(fs, input);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const createMcpWrapper = useCallback(async (input: CreateMcpInput) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await createMcp(fs, input);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const createCliToolWrapper = useCallback(async (input: CreateCliToolInput) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await createCliTool(fs, input);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const createWebhookWrapper = useCallback(async (input: CreateWebhookInput) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await createWebhook(fs, input);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const createPluginWrapper = useCallback(async (input: CreatePluginInput) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await createPlugin(fs, input);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const updateSkillWrapper = useCallback(async (id: string, updates: Partial<CreateSkillInput>) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await updateSkill(fs, id, updates);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const updateCapabilityMetadataWrapper = useCallback(async (
    type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin',
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      appName: string;
      trigger: string;
      command: string;
    }>
  ) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await updateCapabilityMetadata(fs, type, id, updates);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const updateFileContentWrapper = useCallback(async (filePath: string, content: string) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await updateFileContent(fs, filePath, content);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const deleteCapabilityWrapper = useCallback(async (type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin', id: string) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await deleteCapability(fs, type, id);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const createFileInTreeWrapper = useCallback(async (parentDir: string, fileName: string, content?: string) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await createFileInTree(fs, parentDir, fileName, content);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const createDirectoryInTreeWrapper = useCallback(async (parentDir: string, dirName: string) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await createDirectoryInTree(fs, parentDir, dirName);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const deleteFileInTreeWrapper = useCallback(async (filePath: string, isDirectory: boolean) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await deleteFileInTree(fs, filePath, isDirectory);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const renameFileInTreeWrapper = useCallback(async (oldPath: string, newName: string) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await renameFileInTree(fs, oldPath, newName);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  const toggleCapabilityEnabledWrapper = useCallback(async (type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin', id: string, enabled: boolean) => {
    const persistenceError = ensurePersistentWriteBackend();
    if (persistenceError) return persistenceError;
    const result = await toggleCapabilityEnabled(fs, type, id, enabled);
    if (result.success) await refresh();
    return result;
  }, [ensurePersistentWriteBackend, fs, refresh]);

  return {
    skills,
    commands,
    plugins,
    cliTools,
    mcps,
    webhooks,
    connectors,
    isLoading,
    error,
    refresh,
    installMarketplacePlugin,
    uninstallMarketplacePlugin,
    fs,
    // CRUD operations
    createSkill: createSkillWrapper,
    createCommand: createCommandWrapper,
    createConnector: createConnectorWrapper,
    createMcp: createMcpWrapper,
    createCliTool: createCliToolWrapper,
    createWebhook: createWebhookWrapper,
    createPlugin: createPluginWrapper,
    updateSkill: updateSkillWrapper,
    updateCapabilityMetadata: updateCapabilityMetadataWrapper,
    updateFileContent: updateFileContentWrapper,
    deleteCapability: deleteCapabilityWrapper,
    createFileInTree: createFileInTreeWrapper,
    createDirectoryInTree: createDirectoryInTreeWrapper,
    deleteFileInTree: deleteFileInTreeWrapper,
    renameFileInTree: renameFileInTreeWrapper,
    toggleCapabilityEnabled: toggleCapabilityEnabledWrapper,
  };
}

// Export singleton for direct usage (try real first)
export const fileSystem = new RealFileSystem();
export const scanner = new CapabilityScanner(fileSystem);
