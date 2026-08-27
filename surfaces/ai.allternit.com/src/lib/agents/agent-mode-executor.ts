import { generateText } from 'ai';
import { getDefaultPluginModel } from '@/lib/ai/providers';
import { createPluginInstance, type PluginId, type PluginOutput } from '@/lib/plugins';
import type { ArtifactKind, ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import type { CanonicalAgentModeId } from './agent-mode-contracts';
import { parseCreationPayload } from '@/views/create/enrich-prompt';
import { getDefaultFormatSelection, isCreationMode, type FormatSelection } from '@/views/create/presets';
import { generateDocxArtifact, generateXlsxArtifact } from './creation-engines';
import {
  IMAGE_PROVIDERS,
  type ImageProviderApiKeys,
  type ImageProviderId,
} from './modes/image-generation';
import {
  VIDEO_PROVIDERS,
  type VideoProviderApiKeys,
  type VideoProviderId,
} from './modes/video-generation';

export interface AgentModeExecutorCallbacks {
  onToolCall?: (event: { toolCallId: string; toolName: string; input: unknown }) => void;
  onToolResult?: (event: { toolCallId: string; toolName: string; result: unknown }) => void;
  onArtifact?: (artifact: ArtifactUIPart) => void;
  onChunk?: (content: string) => void;
}
const MODE_PLUGIN: Partial<Record<CanonicalAgentModeId, PluginId>> = {
  swarms: 'swarms', research: 'research', website: 'website', data: 'data',
  slides: 'slides', image: 'image', video: 'video', code: 'code',
};

const MODE_KIND: Record<CanonicalAgentModeId, ArtifactKind> = {
  swarms: 'document', research: 'document', website: 'html', docs: 'document',
  data: 'sheet', slides: 'slides', image: 'image', video: 'video',
  code: 'jsx',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]!);
}

function readVideoApiKeys(): VideoProviderApiKeys {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('allternit_video_api_keys') || '{}') as VideoProviderApiKeys;
  } catch {
    return {};
  }
}

function ensureVideoProviderKey(providerId: VideoProviderId): void {
  if (typeof window === 'undefined') return;
  const entry = VIDEO_PROVIDERS[providerId];
  if (!entry || entry.type === 'free' || entry.type === 'local') return;

  const keys = readVideoApiKeys();
  const hasKey = (() => {
    switch (providerId) {
      case 'replicate': return !!keys.replicate;
      case 'fal': return !!keys.fal;
      case 'huggingface': return !!keys.huggingface;
      case 'minimax': return !!keys.minimax;
      case 'kling': return !!keys.kling;
      case 'runway': return !!keys.runway;
      case 'pika': return !!keys.pika;
      case 'luma': return !!keys.luma;
      case 'stability': return !!keys.stability;
      case 'custom': return !!(keys.custom && keys.customBaseURL);
      default: return false;
    }
  })();

  if (hasKey) return;

  window.dispatchEvent(
    new CustomEvent('allternit:open-settings', { detail: { section: 'video-providers' } }),
  );
  throw new Error(
    `${entry.name} needs an API key. Open Settings → Video providers, connect ${entry.name}, then try again.`,
  );
}

function readImageApiKeys(): ImageProviderApiKeys {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('allternit_image_api_keys') || '{}') as ImageProviderApiKeys;
  } catch {
    return {};
  }
}

function ensureImageProviderKey(providerId: ImageProviderId): void {
  if (typeof window === 'undefined') return;
  const entry = IMAGE_PROVIDERS[providerId];
  if (!entry || entry.type !== 'api_key') return;
  if (entry.isAvailable({ apiKeys: readImageApiKeys() })) return;

  window.dispatchEvent(
    new CustomEvent('allternit:open-settings', { detail: { section: 'image-providers' } }),
  );
  throw new Error(
    `${entry.name} needs an API key. Open Settings → Image providers, connect ${entry.name}, then try again.`,
  );
}

function mapWebsitePages(pagesOption: unknown): string[] {
  switch (pagesOption) {
    case '1':
      return ['home'];
    case '3':
      return ['home', 'about', 'contact'];
    case '5':
      return ['home', 'about', 'services', 'portfolio', 'contact'];
    default:
      return ['home'];
  }
}

function mapImageSize(optionId: string): string {
  switch (optionId) {
    case 'square': return '1024x1024';
    case 'landscape': return '1920x1080';
    case 'portrait': return '1080x1920';
    case 'vertical': return '1080x1350';
    default: return '1024x1024';
  }
}

function mapVideoDuration(optionId: string): 6 | 10 {
  switch (optionId) {
    case '15s':
    case '30s':
      return 10;
    case '6s':
    default:
      return 6;
  }
}

function buildCreationOptions(
  modeId: CanonicalAgentModeId,
  selection: FormatSelection,
  templateTitle: string | undefined,
): Record<string, unknown> {
  const options: Record<string, unknown> = { templateTitle };

  switch (modeId) {
    case 'website':
      options.stack = selection.tabId === 'stack' ? selection.optionId : 'nextjs';
      options.pages = mapWebsitePages(selection.tabId === 'pages' ? selection.optionId : '1');
      options.style = selection.tabId === 'style' ? selection.optionId : 'modern';
      break;
    case 'slides':
      options.format = 'pptx';
      options.slideCount = Number(selection.tabId === 'slides' ? selection.optionId : '10') || 10;
      options.theme = selection.tabId === 'theme' ? selection.optionId : 'modern';
      options.deckType = selection.tabId === 'type' ? selection.optionId : 'pitch';
      break;
    case 'image':
      options.mode = 'generate';
      options.n = 1;
      options.provider = selection.tabId === 'provider' ? selection.optionId : 'pollinations';
      options.size = selection.tabId === 'aspect-ratio' ? mapImageSize(selection.optionId) : '1024x1024';
      options.style = selection.tabId === 'style' ? selection.optionId : 'photographic';
      break;
    case 'video':
      options.mode = 'text-to-video';
      options.provider = selection.tabId === 'provider' ? selection.optionId : 'minimax';
      options.duration = mapVideoDuration(selection.tabId === 'duration' ? selection.optionId : '6s');
      options.style = selection.tabId === 'style' ? selection.optionId : 'cinematic';
      break;
    case 'docs':
    case 'data':
      // Deterministic engines consume the format selection directly.
      break;
  }

  return options;
}

function primaryContent(modeId: CanonicalAgentModeId, output: PluginOutput): string {
  const artifacts = output.artifacts ?? [];
  const htmlArtifact = artifacts.find((artifact) => typeof artifact.metadata?.html === 'string');
  if (htmlArtifact) return String(htmlArtifact.metadata?.html);
  const contentArtifact = artifacts.find((artifact) => typeof artifact.metadata?.content === 'string');
  if (modeId === 'data' || modeId === 'slides') {
    if (contentArtifact) return String(contentArtifact.metadata?.content);
  }
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

  // Parse deterministic creation markers injected by the composer.
  const creationPayload = parseCreationPayload(prompt);
  const hasCreationPayload = Boolean(
    creationPayload && isCreationMode(creationPayload.modeId) && creationPayload.modeId === modeId,
  );
  const userPrompt = creationPayload?.prompt ?? prompt;
  const formatSelection = creationPayload?.formatSelection ?? getDefaultFormatSelection(modeId);

  callbacks.onToolCall?.({
    toolCallId,
    toolName,
    input: templateTitle === undefined ? { prompt } : { prompt, templateTitle },
  });

  const pluginId = MODE_PLUGIN[modeId];
  const options = hasCreationPayload && formatSelection
    ? buildCreationOptions(modeId, formatSelection, templateTitle)
    : { templateTitle, format: undefined };

  if (modeId === 'video') {
    ensureVideoProviderKey(String(options.provider || 'pollinations') as VideoProviderId);
  }

  if (modeId === 'image') {
    ensureImageProviderKey(String(options.provider || 'pollinations') as ImageProviderId);
  }

  let plugin: Awaited<ReturnType<typeof createPluginInstance>> | undefined;

  const output = modeId === 'docs'
    ? await generateDocxArtifact(userPrompt, formatSelection!, signal)
    : modeId === 'data'
      ? await generateXlsxArtifact(userPrompt, formatSelection!, signal)
      : await (async () => {
          plugin = await createPluginInstance(pluginId!);
          const cancel = () => void plugin?.cancel();
          signal?.addEventListener('abort', cancel, { once: true });
          try {
            return await plugin.execute({
              prompt: userPrompt,
              options,
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
