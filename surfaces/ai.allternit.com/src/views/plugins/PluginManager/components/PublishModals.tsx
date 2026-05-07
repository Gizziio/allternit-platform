import React, { useState, useEffect, useRef } from 'react';
import { X, Folder, CircleNotch, Check, Shield, Warning } from '@phosphor-icons/react';
import { THEME, PLUGIN_TYPE_OPTIONS } from '../constants';
import type { PluginType } from '../types';
import type { FileSystemAPI } from '../../../../plugins/fileSystem';
import { ModalOverlay } from './ModalOverlay';
import { slugify } from '../utils';

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

  useEffect(() => {
    const homeDir = fs.getHomeDir?.() || '/home/user';
    setSaveLocation(fs.join?.(homeDir, 'plugins') || '/home/user/plugins');
  }, [fs]);

  const handleSelectDirectory = async () => {
    const defaultDir = saveLocation || (fs.getHomeDir?.() || '/home/user');
    const input = window.prompt('Enter directory path for your plugin:', defaultDir);
    if (input) {
      setSaveLocation(input.trim());
    }
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
        files.push({ path: 'src/index.ts', content: `export const config = { name: '${name}', description: '${desc || `${name} command`}', trigger: '/${slug}' };\nexport async function execute(args: string[]): Promise<string> { return \`Executed ${name} with args: \${args.join(' ')}\`; }` });
        break;
      case 'skill':
        files.push({ path: 'SKILL.md', content: `# ${name}\n\n## Purpose\n${desc || `${name} skill for Allternit`}\n\n## Instructions\n- Step 1\n` });
        break;
      case 'mcp':
        files.push({ path: 'src/main.ts', content: `import { Server } from '@modelcontextprotocol/sdk/server/index.js';\nimport { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';\nconst server = new Server({ name: '${slug}', version: '1.0.0' }, { capabilities: { tools: {} } });\nasync function main() { const transport = new StdioServerTransport(); await server.connect(transport); }\nmain().catch(console.error);` });
        break;
      case 'webhook':
        files.push({ path: 'src/main.ts', content: `export const config = { name: '${name}', description: '${desc || `${name} webhook`}', path: '/webhooks/${slug}' };\nexport async function handleWebhook(payload: unknown): Promise<{ status: number; body: unknown }> { return { status: 200, body: { received: new Date().toISOString() } }; }` });
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
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Check size={28} color="#22c55e" /></div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: THEME.textPrimary }}>Plugin Created Successfully!</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: THEME.textSecondary }}>Your plugin has been created at:</p>
          <code style={{ display: 'block', padding: 12, borderRadius: 8, backgroundColor: 'var(--surface-hover)', border: `1px solid ${THEME.border}`, fontSize: 12, color: THEME.accent, marginBottom: 20, wordBreak: 'break-all' }}>{createdPath}</code>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', backgroundColor: THEME.accent, color: THEME.bg, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: THEME.textPrimary }}>Create Plugin from Template</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: THEME.textTertiary }}><X size={20} /></button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>Plugin Name *</label>
        <input type="text" value={pluginName} onChange={(e) => setPluginName(e.target.value)} placeholder="My Awesome Plugin" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${THEME.border}`, backgroundColor: 'var(--surface-hover)', color: THEME.textPrimary, fontSize: 14, outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>Plugin Type</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {PLUGIN_TYPE_OPTIONS.map((option) => (
            <button key={option.value} onClick={() => setPluginType(option.value)} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${pluginType === option.value ? THEME.accentGlow : THEME.border}`, backgroundColor: pluginType === option.value ? THEME.accentMuted : 'var(--surface-hover)', color: pluginType === option.value ? THEME.textPrimary : THEME.textSecondary, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{option.label}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{option.description}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this plugin do?" rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${THEME.border}`, backgroundColor: 'var(--surface-hover)', color: THEME.textPrimary, fontSize: 14, outline: 'none', resize: 'vertical', minHeight: 80 }} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>Save Location *</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={saveLocation} onChange={(e) => setSaveLocation(e.target.value)} placeholder="/path/to/plugins" style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${THEME.border}`, backgroundColor: 'var(--surface-hover)', color: THEME.textPrimary, fontSize: 14, outline: 'none' }} />
          <button onClick={handleSelectDirectory} style={{ padding: '10px 16px', borderRadius: 8, border: `1px solid ${THEME.borderStrong}`, backgroundColor: 'var(--surface-hover)', color: THEME.textSecondary, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Folder size={14} />Browse</button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 6, border: `1px solid ${THEME.border}`, backgroundColor: 'transparent', color: THEME.textSecondary, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleCreate} disabled={!pluginName.trim() || !saveLocation.trim() || isCreating} style={{ padding: '10px 16px', borderRadius: 6, border: 'none', backgroundColor: pluginName.trim() && saveLocation.trim() && !isCreating ? THEME.accent : 'rgba(120,113,108,0.3)', color: pluginName.trim() && saveLocation.trim() && !isCreating ? THEME.bg : THEME.textTertiary, fontSize: 13, cursor: pluginName.trim() && saveLocation.trim() && !isCreating ? 'pointer' : 'not-allowed', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          {isCreating && <CircleNotch size={14} style={{ animation: 'spin 1s linear infinite' }} />}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: THEME.textPrimary }}>Validate Plugin Manifest</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: THEME.textTertiary }}><X size={20} /></button>
      </div>
      {!validationResult && !isValidating && (
        <div onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }} onDragLeave={() => setIsDragActive(false)} onDrop={(e) => { e.preventDefault(); setIsDragActive(false); const file = e.dataTransfer.files?.[0]; if (file) void handleFileContent(file); }} onClick={() => fileInputRef.current?.click()} style={{ padding: '40px 24px', borderRadius: 10, border: `2px dashed ${isDragActive ? THEME.accent : THEME.borderStrong}`, backgroundColor: isDragActive ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : 'var(--surface-hover)', textAlign: 'center', cursor: 'pointer' }}>
          <Shield size={40} color={THEME.textTertiary} style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 14, color: THEME.textSecondary }}>Drag and drop plugin.json here or click to browse</p>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFileContent(file); }} />
        </div>
      )}
      {isValidating && <div style={{ textAlign: 'center', padding: '40px 0' }}><CircleNotch size={32} style={{ animation: 'spin 1s linear infinite', color: THEME.accent }} /><p style={{ margin: '12px 0 0', fontSize: 13, color: THEME.textSecondary }}>Validating...</p></div>}
      {validationResult && !isValidating && (
        <div>
          <div style={{ padding: 16, borderRadius: 10, border: `1px solid ${validationResult.valid ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, backgroundColor: validationResult.valid ? 'var(--status-success-bg)' : 'var(--status-error-bg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            {validationResult.valid ? <Check size={24} color="#22c55e" /> : <Warning size={24} color="#ef4444" />}
            <div><div style={{ fontSize: 15, fontWeight: 600, color: validationResult.valid ? 'var(--status-success)' : 'var(--status-error)' }}>{validationResult.valid ? 'Valid Manifest' : 'Validation Failed'}</div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button onClick={() => setValidationResult(null)} style={{ padding: '10px 16px', borderRadius: 6, border: `1px solid ${THEME.border}`, backgroundColor: 'transparent', color: THEME.textSecondary, fontSize: 13, cursor: 'pointer' }}>Validate Another</button><button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 6, border: 'none', backgroundColor: THEME.accent, color: THEME.bg, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Done</button></div>
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
  const [shortDescription] = useState('');
  const [category] = useState('productivity');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = () => {
    if (!repoUrl.trim()) return;
    setIsSubmitting(true);
    setTimeout(() => {
      const submission = { id: `submission-${Date.now()}`, repoUrl: repoUrl.trim(), description: shortDescription.trim(), category, submittedAt: new Date().toISOString(), status: 'pending' as const };
      onSubmit(submission);
      setIsSubmitting(false);
      setShowConfirmation(true);
      showInfo('Plugin submitted for review');
    }, 800);
  };

  if (showConfirmation) {
    return (
      <ModalOverlay onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Check size={28} color="#22c55e" /></div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: THEME.textPrimary }}>Submission Received!</h3>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', backgroundColor: THEME.accent, color: THEME.bg, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      </ModalOverlay>
    );
  }

  const isValidGitHubUrl = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/.test(repoUrl.trim());

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: THEME.textPrimary }}>Submit to Marketplace</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: THEME.textTertiary }}><X size={20} /></button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>GitHub Repository URL *</label>
        <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/username/my-plugin" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${isValidGitHubUrl || !repoUrl ? THEME.border : 'rgba(239,68,68,0.5)'}`, backgroundColor: 'var(--surface-hover)', color: THEME.textPrimary, fontSize: 14, outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 6, border: `1px solid ${THEME.border}`, backgroundColor: 'transparent', color: THEME.textSecondary, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSubmit} disabled={!isValidGitHubUrl || isSubmitting} style={{ padding: '10px 16px', borderRadius: 6, border: 'none', backgroundColor: isValidGitHubUrl && !isSubmitting ? THEME.accent : 'rgba(120,113,108,0.3)', color: isValidGitHubUrl && !isSubmitting ? THEME.bg : THEME.textTertiary, fontSize: 13, cursor: isValidGitHubUrl && !isSubmitting ? 'pointer' : 'not-allowed', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          {isSubmitting && <CircleNotch size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {isSubmitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </ModalOverlay>
  );
}
