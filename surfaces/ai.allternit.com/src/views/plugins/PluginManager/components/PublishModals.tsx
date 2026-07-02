import React, { useState, useEffect, useRef } from 'react';
import { X, Folder, CircleNotch, Check, Shield, Warning } from '@phosphor-icons/react';
import { THEME, PLUGIN_TYPE_OPTIONS } from '../constants';
import type { PluginType } from '../types';
import type { FileSystemAPI } from '../../../../plugins/fileSystem';
import { ModalOverlay } from './ModalOverlay';
import { slugify } from '../utils';
import { cn } from '@/lib/utils';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('PublishModals');

interface CreatePluginModalProps {
  fs: FileSystemAPI;
  onClose: () => void;
  showInfo: (message: string) => void;
  showError: (message: string) => void;
}

export function CreatePluginModal({ fs, onClose, showInfo, showError }: CreatePluginModalProps) {
  const [pluginName, setPluginName] = useState('');
  const [pluginType, setPluginType] = useState<PluginType>('command');
  const [description, setDescription] = useState('');
  const [saveLocation, setSaveLocation] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const saveLocationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const homeDir = fs.getHomeDir?.() || '/home/user';
    setSaveLocation(fs.join?.(homeDir, 'plugins') || '/home/user/plugins');
  }, [fs]);

  const handleSelectDirectory = () => {
    saveLocationRef.current?.focus();
    saveLocationRef.current?.select();
  };

  const handleCreate = async () => {
    if (!pluginName.trim()) {
      showError('Plugin name is required');
      return;
    }

    if (!saveLocation.trim()) {
      showError('Save location is required');
      return;
    }

    setIsCreating(true);
    try {
      const slug = slugify(pluginName);
      const pluginDir = fs.join?.(saveLocation, slug) || `${saveLocation}/${slug}`;

      if (fs.mkdir) {
        await fs.mkdir(pluginDir);
      }

      const now = new Date().toISOString();
      const pluginJson = buildPluginJson(pluginType, slug, pluginName.trim(), description.trim(), now);
      const pluginJsonPath = fs.join?.(pluginDir, 'plugin.json') || `${pluginDir}/plugin.json`;
      if (fs.writeFile) {
        await fs.writeFile(pluginJsonPath, JSON.stringify(pluginJson, null, 2));
      }

      const srcDir = fs.join?.(pluginDir, 'src') || `${pluginDir}/src`;
      if (fs.mkdir && pluginType !== 'skill') {
        await fs.mkdir(srcDir);
      }

      const files = generateStarterFiles(pluginType, slug, pluginName.trim(), description.trim());
      for (const { path, content } of files) {
        const fullPath = fs.join?.(pluginDir, path) || `${pluginDir}/${path}`;
        if (fs.writeFile) {
          await fs.writeFile(fullPath, content);
        }
      }

      const readmeContent = generateReadme(pluginType, slug, pluginName.trim(), description.trim());
      const readmePath = fs.join?.(pluginDir, 'README.md') || `${pluginDir}/README.md`;
      if (fs.writeFile) {
        await fs.writeFile(readmePath, readmeContent);
      }

      setCreatedPath(pluginDir);
      showInfo(`Plugin created at ${pluginDir}`);
    } catch (error) {
      showError(`Failed to create plugin: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCreating(false);
    }
  };

  function buildPluginJson(type: PluginType, slug: string, name: string, description: string, createdAt: string) {
    const base = {
      $schema: 'https://anthropic.com/claude-code/plugin.schema.json',
      id: slug,
      name: name,
      description: description || `${name} - Allternit Plugin`,
      version: '1.0.0',
      author: 'User',
      createdAt,
      updatedAt: createdAt,
    };
    switch (type) {
      case 'command': return { ...base, type: 'command', trigger: `/${slug}`, entry: 'src/index.ts' };
      case 'skill': return { ...base, type: 'skill', entry: 'SKILL.md' };
      case 'mcp': return { ...base, type: 'mcp', entry: 'src/main.ts' };
      case 'webhook': return { ...base, type: 'webhook', path: `/webhooks/${slug}`, entry: 'src/main.ts' };
      case 'full': return { ...base, type: 'plugin', commands: ['./commands'], skills: ['./skills'], connectors: [], mcpServers: {} };
      default: return base;
    }
  }

  function generateStarterFiles(type: PluginType, slug: string, name: string, desc: string) {
    const files: Array<{ path: string; content: string }> = [];
    switch (type) {
      case 'command':
        files.push({ path: 'src/index.ts', content: `export const config = {
  const isClient = useIsClient(); name: '${name}', description: '${desc || `${name} command`}', trigger: '/${slug}' };\nexport async function execute(args: string[]): Promise<string> { return \`Executed ${name} with args: \${args.join(' ')}\`; }` });
        break;
      case 'skill':
        files.push({ path: 'SKILL.md', content: `# ${name}\n\n## Purpose\n${desc || `${name} skill for Allternit`}\n\n## Instructions\n- Step 1\n` });
        break;
      case 'mcp':
        files.push({ path: 'src/main.ts', content: `import { Server } from '@modelcontextprotocol/sdk/server/index.js';\nimport { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';\nconst server = new Server({ name: '${slug}', version: '1.0.0' }, { capabilities: { tools: {} } });\nasync function main() { const transport = new StdioServerTransport(); await server.connect(transport); }\nmain().catch((err: unknown) => logger.error({ err }, 'Async error'));` });
        break;
      case 'webhook':
        files.push({ path: 'src/main.ts', content: `export const config = { name: '${name}', description: '${desc || `${name} webhook`}', path: '/webhooks/${slug}' };\nexport async function handleWebhook(payload: unknown): Promise<{ status: number; body: unknown }> {
return { status: 200, body: { received: new Date().toISOString() }; }` });
        break;
      case 'full':
        files.push({ path: 'commands/hello.ts', content: `export const config = { name: 'hello', trigger: '/${slug}-hello' };\nexport async function execute(args: string[]): Promise<string> { return 'Hello!'; }` });
        files.push({ path: 'skills/main.skill.md', content: `# ${name}\n` });
        break;
    }
    return files;
  }

  function generateReadme(type: PluginType, slug: string, name: string, desc: string) {
    return `# ${name}\n\n${desc || `${name} - Allternit Plugin`}\n\n## Installation\n\n1. Copy this directory to your Allternit plugins folder\n2. Run \`allternit plugin enable ${slug}\``;
  }

  if (createdPath) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="text-center py-5 px-0">
          <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4"><Check size={28} className="text-green-500" /></div>
          <h3 className="m-0 mb-2 text-[18px] text-[var(--text-primary)]">Plugin Created Successfully!</h3>
          <p className="m-0 mb-4 text-[13px] text-[var(--text-secondary)]">Your plugin has been created at:</p>
          <code className="block p-3 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--border-subtle)] text-[12px] text-[var(--accent-primary)] mb-5 break-all">{createdPath}</code>
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--bg-primary)] text-[14px] font-semibold cursor-pointer transition-opacity hover:opacity-90">Done</button>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="m-0 text-[18px] text-[var(--text-primary)]">Create Plugin from Template</h3>
        <button type="button" onClick={onClose} className="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"><X size={20} /></button>
      </div>
      <div className="mb-4">
        <div className="block text-[12px] text-[var(--text-tertiary)] mb-1.5 font-bold uppercase tracking-wider">Plugin Name *</div>
        <input aria-label="Input" type="text" value={pluginName} onChange={(e) => setPluginName(e.target.value)} placeholder="My Awesome Plugin" className="w-full px-3 py-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-primary)] text-[14px] outline-none focus:border-[var(--accent-primary)] transition-colors" />
      </div>
      <div className="mb-4">
        <div className="block text-[12px] text-[var(--text-tertiary)] mb-1.5 font-bold uppercase tracking-wider">Plugin Type</div>
        <div className="grid grid-cols-2 gap-2">
          {PLUGIN_TYPE_OPTIONS.map((option) => (
            <button type="button" key={option.value} onClick={() => setPluginType(option.value)} className={cn("p-3 rounded-lg border border-solid text-left cursor-pointer transition-all duration-200", pluginType === option.value ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:border-[var(--border-default)]")}>
              <div className="font-bold text-[13px] mb-0.5">{option.label}</div>
              <div className="text-[12px] opacity-70 leading-tight">{option.description}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <div className="block text-[12px] text-[var(--text-tertiary)] mb-1.5 font-bold uppercase tracking-wider">Description</div>
        <textarea aria-label="Text Area" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this plugin do?" rows={3} className="w-full px-3 py-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-primary)] text-[14px] outline-none resize-y min-h-[80px] focus:border-[var(--accent-primary)] transition-colors" />
      </div>
      <div className="mb-5">
        <div className="block text-[12px] text-[var(--text-tertiary)] mb-1.5 font-bold uppercase tracking-wider">Save Location *</div>
        <div className="flex gap-2">
          <input aria-label="Input" ref={saveLocationRef} type="text" value={saveLocation} onChange={(e) => setSaveLocation(e.target.value)} placeholder="/path/to/plugins" className="flex-1 px-3 py-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-primary)] text-[14px] outline-none focus:border-[var(--accent-primary)] transition-colors" />
          <button type="button" onClick={handleSelectDirectory} className="px-4 py-2.5 rounded-lg border border-solid border-[var(--border-default)] bg-[var(--surface-hover)] text-[var(--text-secondary)] text-[13px] font-bold cursor-pointer flex items-center gap-1.5 transition-colors hover:bg-[var(--surface-active)]"><Folder size={14} />Browse</button>
        </div>
      </div>
      <div className="flex justify-end gap-2.5 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] text-[13px] font-bold cursor-pointer hover:bg-[var(--surface-hover)] transition-colors">Cancel</button>
        <button type="button" onClick={handleCreate} disabled={!pluginName.trim() || !saveLocation.trim() || isCreating} className={cn("px-4 py-2.5 rounded-lg border-none text-[13px] font-bold flex items-center gap-1.5 transition-all", pluginName.trim() && saveLocation.trim() && !isCreating ? "bg-[var(--accent-primary)] text-[var(--bg-primary)] cursor-pointer hover:opacity-90" : "bg-zinc-500/30 text-[var(--text-tertiary)] cursor-not-allowed")}>
          {isCreating && <CircleNotch size={14} className="animate-spin" />}
          {isCreating ? 'Creating...' : 'Create Plugin'}
        </button>
      </div>
    </ModalOverlay>
  );
}

interface ValidatePluginModalProps {
  onClose: () => void;
  showInfo: (message: string) => void;
  showError: (message: string) => void;
}

export function ValidatePluginModal({ onClose, showInfo, showError }: ValidatePluginModalProps) {
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[]; warnings: string[]; manifest?: unknown } | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateManifest = (content: string) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let manifest: any;
    try { manifest = JSON.parse(content); } catch { return { valid: false, errors: ['Invalid JSON format'], warnings: [] }; }
    if (typeof manifest !== 'object' || manifest === null) return { valid: false, errors: ['Manifest must be an object'], warnings: [] };
    if (!manifest.id || typeof manifest.id !== 'string') errors.push('Missing required field: id (string)');
    if (!manifest.name || typeof manifest.name !== 'string') errors.push('Missing required field: name (string)');
    if (!manifest.version || typeof manifest.version !== 'string') errors.push('Missing required field: version (string)');
    return { valid: errors.length === 0, errors, warnings, manifest };
  };

  const handleFileContent = async (file: File) => {
    setIsValidating(true);
    try {
      const content = await file.text();
      const result = validateManifest(content);
      setValidationResult(result);
      if (result.valid) showInfo('Manifest is valid!');
    } catch (error) {
      showError(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setIsValidating(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="m-0 text-[18px] text-[var(--text-primary)] font-bold">Validate Plugin Manifest</h3>
        <button type="button" onClick={onClose} className="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"><X size={20} /></button>
      </div>
      {!validationResult && !isValidating && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }} 
          onDragLeave={() => setIsDragActive(false)} 
          onDrop={(e) => { e.preventDefault(); setIsDragActive(false); const file = e.dataTransfer.files?.[0]; if (file) void handleFileContent(file); }} 
          onClick={() => fileInputRef.current?.click()} 
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          className={cn("py-10 px-6 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all", isDragActive ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-inner" : "border-[var(--border-default)] bg-[var(--surface-hover)] hover:border-[var(--border-muted)]")}
        >
          <Shield size={40} className="text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="m-0 text-[14px] text-[var(--text-secondary)] font-medium">Drag and drop plugin.json here or click to browse</p>
          <input aria-label="File upload" ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFileContent(file); }} />
        </div>
      )}
      {isValidating && <div className="text-center py-10"><CircleNotch size={32} className="animate-spin text-[var(--accent-primary)] mx-auto" /><p className="m-0 mt-3 text-[13px] text-[var(--text-secondary)] font-medium">Validating…</p></div>}
      {validationResult && !isValidating && (
        <div>
          <div className={cn("p-4 rounded-xl border border-solid flex items-center gap-3 mb-4", validationResult.valid ? "border-green-500/35 bg-[var(--status-success-bg)]" : "border-red-500/35 bg-[var(--status-error-bg)]")}>
            {validationResult.valid ? <Check size={24} className="text-green-500" /> : <Warning size={24} className="text-red-500" />}
            <div><div className={cn("text-[15px] font-bold", validationResult.valid ? "text-[var(--status-success)]" : "text-[var(--status-error)]")}>{validationResult.valid ? 'Valid Manifest' : 'Validation Failed'}</div></div>
          </div>
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setValidationResult(null)} className="px-4 py-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] text-[13px] font-bold cursor-pointer hover:bg-[var(--surface-hover)] transition-colors">Validate Another</button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--bg-primary)] text-[13px] font-bold cursor-pointer hover:opacity-90 transition-opacity">Done</button>
          </div>
        </div>
      )}
    </ModalOverlay>
  );
}

interface SubmitToMarketplaceModalProps {
  onClose: () => void;
  onSubmit: (submission: any) => void;
  showInfo: (message: string) => void;
}

export function SubmitToMarketplaceModal({ onClose, onSubmit, showInfo }: SubmitToMarketplaceModalProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const shortDescription = '';
  const category = 'productivity';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!repoUrl.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const submission = { id: `submission-${Date.now()}`, repoUrl: repoUrl.trim(), description: shortDescription.trim(), category, submittedAt: new Date().toISOString(), status: 'pending' as const };
    fetch('/api/v1/plugins/marketplace/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Submission failed (${res.status})`);
        onSubmit(submission);
        setIsSubmitting(false);
        setShowConfirmation(true);
        showInfo('Plugin submitted for review');
      })
      .catch((err: unknown) => {
        setIsSubmitting(false);
        setSubmitError(err instanceof Error ? err.message : 'Submission failed');
      });
  };

  if (showConfirmation) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="text-center py-5">
          <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4"><Check size={28} className="text-green-500" /></div>
          <h3 className="m-0 mb-4 text-[18px] text-[var(--text-primary)] font-bold">Submission Received!</h3>
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--bg-primary)] text-[14px] font-bold cursor-pointer hover:opacity-90 transition-opacity">Done</button>
        </div>
      </ModalOverlay>
    );
  }

  const isValidGitHubUrl = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/.test(repoUrl.trim());

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="m-0 text-[18px] text-[var(--text-primary)] font-bold">Submit to Marketplace</h3>
        <button type="button" onClick={onClose} className="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"><X size={20} /></button>
      </div>
      <div className="mb-5">
        <div className="block text-[12px] text-[var(--text-tertiary)] mb-1.5 font-bold uppercase tracking-wider">GitHub Repository URL *</div>
        <input aria-label="Input" type="text" 
          value={repoUrl} 
          onChange={(e) => setRepoUrl(e.target.value)} 
          placeholder="https://github.com/username/my-plugin" 
          className={cn(
            "w-full px-3 py-2.5 rounded-lg border border-solid bg-[var(--surface-hover)] text-[var(--text-primary)] text-[14px] outline-none transition-colors",
            isValidGitHubUrl || !repoUrl ? "border-[var(--border-subtle)] focus:border-[var(--accent-primary)]" : "border-red-500/50"
          )} 
        />
      </div>
      {submitError && (
        <p className="mb-3 text-xs text-red-400">{submitError}</p>
      )}
      <div className="flex justify-end gap-2.5 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] text-[13px] font-bold cursor-pointer hover:bg-[var(--surface-hover)] transition-colors">Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={!isValidGitHubUrl || isSubmitting} className={cn("px-4 py-2.5 rounded-lg border-none text-[13px] font-bold flex items-center gap-1.5 transition-all", isValidGitHubUrl && !isSubmitting ? "bg-[var(--accent-primary)] text-[var(--bg-primary)] cursor-pointer hover:opacity-90" : "bg-zinc-500/30 text-[var(--text-tertiary)] cursor-not-allowed")}>
          {isSubmitting && <CircleNotch size={14} className="animate-spin" />}
          {isSubmitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </ModalOverlay>
  );
}
