import { generateText } from 'ai';
import { getDefaultPluginModel } from '@/lib/ai/providers';
import { loadPlugin, type PluginId, type PluginOutput } from '@/lib/plugins';
import type { ArtifactKind, ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import type { CanonicalAgentModeId } from './agent-mode-contracts';

export interface AgentModeExecutorCallbacks {
  onToolCall?: (event: { toolCallId: string; toolName: string; input: unknown }) => void;
  onToolResult?: (event: { toolCallId: string; toolName: string; result: unknown }) => void;
  onArtifact?: (artifact: ArtifactUIPart) => void;
  onChunk?: (content: string) => void;
}

const MODE_PLUGIN: Partial<Record<CanonicalAgentModeId, PluginId>> = {
  swarms: 'swarms', research: 'research', website: 'website', data: 'data',
  slides: 'slides', image: 'image', video: 'video',
};

const MODE_KIND: Record<CanonicalAgentModeId, ArtifactKind> = {
  swarms: 'document', research: 'document', website: 'html', docs: 'document',
  data: 'sheet', slides: 'slides', image: 'image', video: 'video',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]!);
}

async function executeDocs(prompt: string): Promise<PluginOutput> {
  const model = await getDefaultPluginModel();
  const { text } = await generateText({
    model,
    temperature: 0.3,
    prompt: `Create a polished professional document for this request. Return semantic HTML only, with a title, headings, paragraphs, lists, and tables where useful. Do not use markdown fences.\n\n${prompt}`,
  });
  const html = /<(?:article|main|html|h1)[\s>]/i.test(text)
    ? text
    : `<article><h1>Document</h1><p>${escapeHtml(text)}</p></article>`;
  return {
    success: true,
    content: 'Editable document created.',
    artifacts: [{ type: 'file', name: 'document.html', url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`, metadata: { html } }],
  };
}

function primaryContent(modeId: CanonicalAgentModeId, output: PluginOutput): string {
  const artifacts = output.artifacts ?? [];
  const htmlArtifact = artifacts.find((artifact) => typeof artifact.metadata?.html === 'string');
  if (htmlArtifact) return String(htmlArtifact.metadata?.html);
  if (modeId === 'image' || modeId === 'video') return artifacts[0]?.url ?? output.content ?? '';
  if (modeId === 'website') {
    const files = artifacts
      .filter((artifact) => typeof artifact.metadata?.content === 'string')
      .map((artifact) => `<!-- ${artifact.name} -->\n${String(artifact.metadata?.content)}`);
    if (files.length) return files.join('\n\n');
  }
  return output.content ?? '';
}

export async function executeAgentMode(
  modeId: CanonicalAgentModeId,
  prompt: string,
  templateTitle: string | undefined,
  callbacks: AgentModeExecutorCallbacks,
): Promise<void> {
  const toolCallId = `mode-${modeId}-${Date.now()}`;
  const toolName = `${modeId}_mode_execute`;
  callbacks.onToolCall?.({ toolCallId, toolName, input: { prompt, templateTitle } });

  const pluginId = MODE_PLUGIN[modeId];
  const output = modeId === 'docs'
    ? await executeDocs(prompt)
    : await (await loadPlugin(pluginId!)).execute({
        prompt,
        options: { templateTitle, format: modeId === 'slides' ? 'html' : undefined },
      });

  if (!output.success) {
    throw new Error(output.error?.message ?? `${modeId} execution failed`);
  }

  callbacks.onToolResult?.({ toolCallId, toolName, result: output });
  const artifact: ArtifactUIPart = {
    type: 'artifact',
    artifactId: `${modeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: MODE_KIND[modeId],
    title: templateTitle || `${modeId[0].toUpperCase()}${modeId.slice(1)} result`,
    content: primaryContent(modeId, output),
    url: output.artifacts?.[0]?.url,
  };
  callbacks.onArtifact?.(artifact);
  callbacks.onChunk?.(`${output.content ?? `${artifact.title} created.`}\n\nMODE_EXECUTION_COMPLETE\n- ${artifact.title} (${artifact.kind})`);
}
