/**
 * Per-agent plugin install script generator.
 *
 * Produces shell scripts that install an Open Design plugin into a target
 * agent workspace. The script content adapts to the agent's harness mode so
 * the installation is reproducible across BYOK, cloud, local, and subprocess
 * runtimes.
 */

import type { Agent, HarnessConfig } from '@/lib/agents/agent.types';
import type { PluginManifest } from './plugin-manifest';

export type InstallTarget = 'claude-desktop' | 'codex-cli' | 'allternit-local' | 'generic-mcp';

export interface InstallScriptOptions {
  agent: Agent;
  plugin: PluginManifest;
  target?: InstallTarget;
  pluginSourceUrl?: string;
  workspacePath?: string;
}

export interface InstallScriptResult {
  target: InstallTarget;
  filename: string;
  content: string;
  manifestPath: string;
}

function detectTarget(agent: Agent): InstallTarget {
  const harness = agent.harness;
  if (harness?.mode === 'subprocess') return 'generic-mcp';
  if (harness?.mode === 'cloud') return 'allternit-local';
  // Default to Claude Desktop for design/creative agents unless harness says otherwise.
  if (agent.category === 'design' || agent.category === 'creative') return 'claude-desktop';
  return 'codex-cli';
}

function normalizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
}

function pluginDir(plugin: PluginManifest, target: InstallTarget): string {
  const base = normalizeId(plugin.id);
  switch (target) {
    case 'claude-desktop':
      return `~/.claude/skills/${base}`;
    case 'codex-cli':
      return `./skills/${base}`;
    case 'allternit-local':
      return `./.allternit/plugins/${base}`;
    case 'generic-mcp':
      return `./mcp-plugins/${base}`;
    default:
      return `./skills/${base}`;
  }
}

function manifestFilename(target: InstallTarget): string {
  switch (target) {
    case 'claude-desktop':
    case 'codex-cli':
      return 'open-design.json';
    case 'allternit-local':
    case 'generic-mcp':
      return 'manifest.json';
    default:
      return 'open-design.json';
  }
}

function envBlock(harness: HarnessConfig | undefined): string {
  if (!harness) return '';
  const lines: string[] = [];
  if (harness.mode === 'byok' && harness.byok) {
    if (harness.byok.anthropic?.apiKey) lines.push('export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-<your-anthropic-key>}"');
    if (harness.byok.openai?.apiKey) lines.push('export OPENAI_API_KEY="${OPENAI_API_KEY:-<your-openai-key>}"');
    if (harness.byok.google?.apiKey) lines.push('export GOOGLE_API_KEY="${GOOGLE_API_KEY:-<your-google-key>}"');
  }
  if (harness.mode === 'cloud' && harness.cloud) {
    lines.push(`export ALLTERNIT_CLOUD_URL="${harness.cloud.baseURL}"`);
    lines.push('export ALLTERNIT_ACCESS_TOKEN="${ALLTERNIT_ACCESS_TOKEN:-<your-token>}"');
  }
  if (harness.mode === 'local' && harness.local) {
    lines.push(`export ALLTERNIT_LOCAL_URL="${harness.local.baseURL}"`);
  }
  if (harness.mode === 'subprocess' && harness.subprocess) {
    lines.push(`export MCP_COMMAND="${harness.subprocess.command}"`);
    if (harness.subprocess.cwd) lines.push(`export MCP_CWD="${harness.subprocess.cwd}"`);
  }
  return lines.length ? ['# Agent harness environment', ...lines, ''].join('\n') : '';
}

function installBody(options: InstallScriptOptions, target: InstallTarget): string {
  const { plugin, pluginSourceUrl, workspacePath } = options;
  const dir = workspacePath ?? pluginDir(plugin, target);
  const manifestName = manifestFilename(target);
  const source = pluginSourceUrl ?? `https://plugins.allternit.io/${normalizeId(plugin.id)}.zip`;
  const lines: string[] = [];

  lines.push(`set -euo pipefail`);
  lines.push(`echo "Installing ${plugin.name} (${plugin.id}) for ${options.agent.name}..."`);
  lines.push(`PLUGIN_DIR="${dir}"`);
  lines.push(`mkdir -p "$PLUGIN_DIR"`);

  if (pluginSourceUrl) {
    lines.push(`if [ -d "${pluginSourceUrl}" ]; then`);
    lines.push(`  cp -R "${pluginSourceUrl}/." "$PLUGIN_DIR/"`);
    lines.push(`else`);
    lines.push(`  curl -fsSL "${source}" -o /tmp/${normalizeId(plugin.id)}.zip`);
    lines.push(`  unzip -o /tmp/${normalizeId(plugin.id)}.zip -d "$PLUGIN_DIR"`);
    lines.push(`  rm /tmp/${normalizeId(plugin.id)}.zip`);
    lines.push(`fi`);
  } else {
    lines.push(`curl -fsSL "${source}" -o /tmp/${normalizeId(plugin.id)}.zip`);
    lines.push(`unzip -o /tmp/${normalizeId(plugin.id)}.zip -d "$PLUGIN_DIR"`);
    lines.push(`rm /tmp/${normalizeId(plugin.id)}.zip`);
  }

  lines.push(`cat > "$PLUGIN_DIR/${manifestName}" <<'EOF'`);
  lines.push(JSON.stringify(
    {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version ?? '0.0.1',
      description: plugin.description,
      category: plugin.category,
      author: plugin.author,
      upstream: plugin.upstream,
      tags: plugin.tags,
      preview: plugin.preview,
      inputs: plugin.inputs,
      pipelines: plugin.pipelines,
      capabilities: plugin.capabilities,
    },
    null,
    2,
  ));
  lines.push(`EOF`);

  if (target === 'claude-desktop') {
    lines.push(`echo "Register in Claude Desktop via Settings > Developer > Edit Config"`);
    lines.push(`echo "Skill path: $PLUGIN_DIR"`);
  }
  if (target === 'codex-cli') {
    lines.push(`echo "Add the skill to your CODEX_SKILLS_PATH or run from ./skills/"`);
  }
  if (target === 'allternit-local') {
    lines.push(`echo "Plugin installed to local Allternit workspace"`);
  }
  if (target === 'generic-mcp') {
    lines.push(`echo "Add the MCP server config pointing at $PLUGIN_DIR"`);
  }

  lines.push(`echo "Done."`);
  return lines.join('\n');
}

/**
 * Generate a bash install script for a plugin bound to a specific agent.
 */
export function generateInstallScript(options: InstallScriptOptions): InstallScriptResult {
  const target = options.target ?? detectTarget(options.agent);
  const env = envBlock(options.agent.harness);
  const body = installBody(options, target);
  const content = `#!/usr/bin/env bash
# Auto-generated plugin install script for ${options.agent.name}
# Plugin: ${options.plugin.name} (${options.plugin.id})
# Target runtime: ${target}
# Generated by Allternit Open Design

${env}${body}
`;
  const filename = `install-${normalizeId(options.plugin.id)}-${normalizeId(options.agent.id)}-${target}.sh`;
  return {
    target,
    filename,
    content,
    manifestPath: `${pluginDir(options.plugin, target)}/${manifestFilename(target)}`,
  };
}

/**
 * Generate install scripts for every supported target. Useful when the caller
 * wants to let the operator pick the runtime.
 */
export function generateAllInstallScripts(options: Omit<InstallScriptOptions, 'target'>): InstallScriptResult[] {
  const targets: InstallTarget[] = ['claude-desktop', 'codex-cli', 'allternit-local', 'generic-mcp'];
  return targets.map((target) => generateInstallScript({ ...options, target }));
}

/**
 * Copy the generated script to the clipboard.
 */
export async function copyInstallScriptToClipboard(options: InstallScriptOptions): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(generateInstallScript(options).content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger a download of the generated install script.
 */
export function downloadInstallScript(options: InstallScriptOptions): void {
  if (typeof document === 'undefined') return;
  const { content, filename } = generateInstallScript(options);
  const blob = new Blob([content], { type: 'application/x-sh' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
