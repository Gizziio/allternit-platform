import { generateText } from 'ai';
import { getDefaultPluginModel } from '@/lib/ai/providers';
import { createPluginInstance, type PluginId, type PluginOutput } from '@/lib/plugins';
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

async function executeDocs(prompt: string, signal?: AbortSignal): Promise<PluginOutput> {
  const model = await getDefaultPluginModel();
  const { text } = await generateText({
    model,
    temperature: 0.3,
    abortSignal: signal,
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

async function executeSheets(prompt: string, signal?: AbortSignal): Promise<PluginOutput> {
  const model = await getDefaultPluginModel();
  const { text } = await generateText({
    model,
    temperature: 0.2,
    abortSignal: signal,
    prompt: `Create an editable spreadsheet-style deliverable for the request below. Return one self-contained semantic HTML document only. Include a clearly labeled table, typed values, and a Formula column containing spreadsheet formulas beginning with = wherever calculations or forecasting are requested. Include assumptions and source-data sections. Do not use markdown fences.\n\n${prompt}`,
  });
  const html = /<(?:table|html|main)[\s>]/i.test(text)
    ? text
    : `<main><h1>Spreadsheet</h1><table><tr><th>Result</th></tr><tr><td>${escapeHtml(text)}</td></tr></table></main>`;
  return {
    success: true,
    content: 'Editable spreadsheet created with formulas and assumptions.',
    artifacts: [{ type: 'file', name: 'spreadsheet.html', url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`, metadata: { html, format: 'spreadsheet-html' } }],
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
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new DOMException('Mode execution cancelled', 'AbortError');
  const toolCallId = `mode-${modeId}-${Date.now()}`;
  const toolName = `${modeId}_mode_execute`;
  callbacks.onToolCall?.({ toolCallId, toolName, input: { prompt, templateTitle } });

  const pluginId = MODE_PLUGIN[modeId];
  let plugin: Awaited<ReturnType<typeof createPluginInstance>> | undefined;
  const output = modeId === 'docs'
    ? await executeDocs(prompt, signal)
    : modeId === 'data'
      ? await executeSheets(prompt, signal)
      : await (async () => {
          plugin = await createPluginInstance(pluginId!);
          const cancel = () => void plugin?.cancel();
          signal?.addEventListener('abort', cancel, { once: true });
          try {
            return await plugin.execute({
              prompt,
              options: { templateTitle, format: modeId === 'slides' ? 'html' : undefined },
            });
          } finally {
            signal?.removeEventListener('abort', cancel);
            await plugin.destroy();
          }
        })();

  if (!output.success) {
    throw new Error(output.error?.message ?? `${modeId} execution failed`);
  }
  if (signal?.aborted) throw new DOMException('Mode execution cancelled', 'AbortError');

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
