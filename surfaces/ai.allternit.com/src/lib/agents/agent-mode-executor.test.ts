import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute, destroy, createPluginInstance } = vi.hoisted(() => ({
  execute: vi.fn(),
  destroy: vi.fn(),
  createPluginInstance: vi.fn(),
}));

const { generateText } = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

const { exportDocxFile, exportXlsxFile } = vi.hoisted(() => ({
  exportDocxFile: vi.fn(),
  exportXlsxFile: vi.fn(),
}));

vi.mock('@/lib/plugins', () => ({ createPluginInstance }));
vi.mock('@/lib/ai/providers', () => ({ getDefaultPluginModel: vi.fn() }));
vi.mock('ai', () => ({ generateText }));
vi.mock('@/views/documents/office-io', () => ({
  exportDocxFile,
  exportXlsxFile,
}));

import { executeAgentMode } from './agent-mode-executor';
import { enrichCreationPrompt } from '@/views/create/enrich-prompt';
import { getDefaultFormatSelection } from '@/views/create/presets';

describe('executeAgentMode', () => {
  beforeEach(() => {
    execute.mockReset();
    destroy.mockReset();
    createPluginInstance.mockReset();
    generateText.mockReset();
    exportDocxFile.mockReset();
    exportXlsxFile.mockReset();

    execute.mockResolvedValue({ success: true, content: 'Code created.', artifacts: [] });
    createPluginInstance.mockResolvedValue({ execute, destroy, cancel: vi.fn() });
    generateText.mockResolvedValue({ text: '{}' });
    exportDocxFile.mockResolvedValue(new Blob(['docx']));
    exportXlsxFile.mockResolvedValue(new Blob(['xlsx']));

    if (typeof URL !== 'undefined' && !URL.createObjectURL) {
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:mock') });
    }
  });

  it('routes Code Mode through the code plugin', async () => {
    const onArtifact = vi.fn();

    await executeAgentMode('code', 'Create a component', undefined, { onArtifact });

    expect(createPluginInstance).toHaveBeenCalledWith('code');
    expect(execute).toHaveBeenCalledWith({
      prompt: 'Create a component',
      options: { templateTitle: undefined, format: undefined },
    });
    expect(onArtifact).toHaveBeenCalledWith(expect.objectContaining({ kind: 'jsx' }));
  });

  it('generates a real DOCX artifact for docs mode', async () => {
    const onArtifact = vi.fn();
    const enriched = enrichCreationPrompt('Q3 marketing plan', 'docs', getDefaultFormatSelection('docs')!);

    generateText.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Q3 Marketing Plan',
        blocks: [
          { type: 'heading', level: 1, text: 'Q3 Marketing Plan' },
          { type: 'paragraph', text: 'Overview of the plan.' },
        ],
      }),
    });

    await executeAgentMode('docs', enriched, undefined, { onArtifact });

    expect(generateText).toHaveBeenCalled();
    expect(exportDocxFile).toHaveBeenCalled();
    expect(onArtifact).toHaveBeenCalledWith(expect.objectContaining({ kind: 'document' }));
  });

  it('generates a real XLSX artifact for data mode', async () => {
    const onArtifact = vi.fn();
    const enriched = enrichCreationPrompt('Q3 budget', 'data', getDefaultFormatSelection('data')!);

    generateText.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Q3 Budget',
        sheets: [
          {
            name: 'Budget',
            cells: [
              ['Item', 'Amount'],
              ['Ads', 5000],
            ],
            formulas: [{ row: 1, col: 1, formula: '=SUM(B2:B10)' }],
          },
        ],
      }),
    });

    await executeAgentMode('data', enriched, undefined, { onArtifact });

    expect(generateText).toHaveBeenCalled();
    expect(exportXlsxFile).toHaveBeenCalled();
    expect(onArtifact).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sheet' }));
  });

  it('passes deterministic creation options to the slides plugin', async () => {
    const onArtifact = vi.fn();
    const enriched = enrichCreationPrompt('fintech pitch', 'slides', getDefaultFormatSelection('slides')!);

    execute.mockResolvedValueOnce({
      success: true,
      content: 'Slides created.',
      artifacts: [{ type: 'file', url: 'blob:slides', name: 'deck.pptx' }],
    });

    await executeAgentMode('slides', enriched, undefined, { onArtifact });

    expect(createPluginInstance).toHaveBeenCalledWith('slides');
    expect(execute).toHaveBeenCalledWith({
      prompt: 'fintech pitch',
      options: expect.objectContaining({
        format: 'pptx',
        slideCount: 10,
        theme: 'modern',
        deckType: 'pitch',
      }),
    });
  });

  it('passes the selected image provider through to the image plugin', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) =>
        key === 'allternit_image_api_keys' ? JSON.stringify({ openai: 'sk-test' }) : null
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const onArtifact = vi.fn();
    const enriched = enrichCreationPrompt(
      'a red cube',
      'image',
      { modeId: 'image', tabId: 'provider', optionId: 'openai' },
    );

    await executeAgentMode('image', enriched, undefined, { onArtifact });

    expect(createPluginInstance).toHaveBeenCalledWith('image');
    expect(execute).toHaveBeenCalledWith({
      prompt: 'a red cube',
      options: expect.objectContaining({
        mode: 'generate',
        provider: 'openai',
      }),
    });

    vi.unstubAllGlobals();
  });

  it('emits a website artifact with html content for the library', async () => {
    const onArtifact = vi.fn();
    const enriched = enrichCreationPrompt(
      'a landing page for a SaaS startup',
      'website',
      { modeId: 'website', tabId: 'stack', optionId: 'html' },
    );

    execute.mockResolvedValueOnce({
      success: true,
      content: 'Website created.',
      artifacts: [
        { type: 'code', url: 'website://preview/1', name: 'preview.html', metadata: { format: 'html', html: '<!DOCTYPE html><html>…</html>' } },
        { type: 'code', url: 'website://index.html', name: 'index.html', metadata: { fileType: 'html', content: '<!DOCTYPE html>…' } },
        { type: 'file', url: 'blob:zip', name: 'site.zip', metadata: { format: 'zip' } },
        { type: 'code', url: 'website://deploy/1', name: 'deploy.json', metadata: { target: 'vercel' } },
      ],
    });

    await executeAgentMode('website', enriched, undefined, { onArtifact });

    expect(createPluginInstance).toHaveBeenCalledWith('website');
    expect(onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'html',
        title: 'Website result',
        content: expect.stringContaining('<!DOCTYPE html>'),
        url: 'website://preview/1',
      }),
    );
  });

  it('emits an image artifact with a url for the library', async () => {
    const onArtifact = vi.fn();
    const enriched = enrichCreationPrompt(
      'a red cube',
      'image',
      { modeId: 'image', tabId: 'provider', optionId: 'pollinations' },
    );

    execute.mockResolvedValueOnce({
      success: true,
      content: 'Image generated.',
      artifacts: [
        { type: 'image', url: 'https://image.pollinations.ai/prompt/a%20red%20cube', name: 'generated-abc.png' },
      ],
    });

    await executeAgentMode('image', enriched, undefined, { onArtifact });

    expect(createPluginInstance).toHaveBeenCalledWith('image');
    expect(onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'image',
        title: 'Image result',
        url: 'https://image.pollinations.ai/prompt/a%20red%20cube',
      }),
    );
  });

  it('emits a video artifact with a url for the library', async () => {
    const onArtifact = vi.fn();
    const enriched = enrichCreationPrompt(
      'a drone flying over mountains',
      'video',
      { modeId: 'video', tabId: 'provider', optionId: 'pollinations' },
    );

    execute.mockResolvedValueOnce({
      success: true,
      content: 'Video generated.',
      artifacts: [
        { type: 'video', url: 'https://gen.pollinations.ai/video/abc', name: 'video-abc.mp4' },
      ],
    });

    await executeAgentMode('video', enriched, undefined, { onArtifact });

    expect(createPluginInstance).toHaveBeenCalledWith('video');
    expect(onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'video',
        title: 'Video result',
        url: 'https://gen.pollinations.ai/video/abc',
      }),
    );
  });

  it('opens image provider settings when an API-key provider is not configured', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => (key === 'allternit_image_api_keys' ? '{}' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent').mockReturnValue(true);

    const enriched = enrichCreationPrompt(
      'a red cube',
      'image',
      { modeId: 'image', tabId: 'provider', optionId: 'openai' },
    );

    await expect(executeAgentMode('image', enriched, undefined, {})).rejects.toThrow(
      'DALL-E 3 (OpenAI) needs an API key',
    );

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'allternit:open-settings',
        detail: { section: 'image-providers' },
      }),
    );

    dispatchEvent.mockRestore();
    vi.unstubAllGlobals();
  });
});
