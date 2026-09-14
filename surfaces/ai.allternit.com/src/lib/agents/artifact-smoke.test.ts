import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeAgentMode } from './agent-mode-executor';
import { persistArtifactToCanvas } from './mode-session-store';
import { enrichCreationPrompt } from '@/views/create/enrich-prompt';

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));
const createCanvas = vi.hoisted(() => vi.fn());
const updateCanvas = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({ generateText }));
vi.mock('@/lib/ai/providers', () => ({ getDefaultPluginModel: vi.fn().mockResolvedValue('fake-model') }));
vi.mock('./native-agent-api', async () => {
  const actual = await vi.importActual<typeof import('./native-agent-api')>('./native-agent-api');
  return {
    ...actual,
    canvasApi: {
      createCanvas,
      updateCanvas,
      listCanvases: vi.fn(),
      getCanvas: vi.fn(),
      deleteCanvas: vi.fn(),
    },
  };
});

describe('Artifact smoke test — create one of each and persist to library canvas', () => {
  beforeEach(() => {
    generateText.mockReset();
    createCanvas.mockReset().mockResolvedValue({ id: 'canvas-smoke-123' });
    updateCanvas.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => '{}'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates and persists a website artifact', async () => {
    generateText.mockResolvedValue({
      text: JSON.stringify({
        name: 'Smoke Site',
        title: 'Smoke Site',
        description: 'A smoke-test landing page.',
        theme: {
          primary: '#4f46e5',
          secondary: '#7c3aed',
          accent: '#06b6d4',
          background: '#ffffff',
          foreground: '#0f172a',
          font: 'Inter',
        },
        nav: [{ label: 'Home', href: '#home' }],
        sections: [
          {
            type: 'hero',
            anchor: 'home',
            headline: 'Smoke Site',
            subheadline: 'It works.',
            cta: { label: 'Get started', href: '#home' },
          },
        ],
      }),
    });

    const onArtifact = vi.fn();
    const enriched = enrichCreationPrompt(
      'a smoke-test landing page',
      'website',
      { modeId: 'website', tabId: 'stack', optionId: 'html' },
    );

    await executeAgentMode('website', enriched, undefined, { onArtifact });

    expect(onArtifact).toHaveBeenCalled();
    const artifact = onArtifact.mock.calls[0][0];
    expect(artifact.kind).toBe('html');
    expect(artifact.content).toContain('<!DOCTYPE html>');
    expect(artifact.url).toContain('website://preview/');

    // Simulate the store persisting the artifact to a backend canvas.
    await persistArtifactToCanvas('ses-smoke-website', artifact, new Map());

    expect(createCanvas).toHaveBeenCalledWith('ses-smoke-website', {
      title: artifact.title,
      components: [
        {
          type: 'artifact',
          artifactId: artifact.artifactId,
          kind: 'html',
          title: artifact.title,
          content: artifact.content,
          url: artifact.url,
        },
      ],
      metadata: { artifactId: artifact.artifactId, kind: 'html' },
    });
  });

  it('creates and persists an image artifact', async () => {
    const onArtifact = vi.fn();
    const enriched = enrichCreationPrompt(
      'a red cube on a white background',
      'image',
      { modeId: 'image', tabId: 'provider', optionId: 'pollinations' },
    );

    await executeAgentMode('image', enriched, undefined, { onArtifact });

    expect(onArtifact).toHaveBeenCalled();
    const artifact = onArtifact.mock.calls[0][0];
    expect(artifact.kind).toBe('image');
    expect(artifact.url).toContain('image.pollinations.ai');

    await persistArtifactToCanvas('ses-smoke-image', artifact, new Map());

    expect(createCanvas).toHaveBeenCalledWith('ses-smoke-image', {
      title: artifact.title,
      components: [
        {
          type: 'artifact',
          artifactId: artifact.artifactId,
          kind: 'image',
          title: artifact.title,
          content: artifact.content,
          url: artifact.url,
        },
      ],
      metadata: { artifactId: artifact.artifactId, kind: 'image' },
    });
  });

  it('creates and persists a video artifact', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          videos: [
            {
              id: 'smoke-123',
              url: 'https://gen.pollinations.ai/video/smoke-123.mp4',
              prompt: 'a drone flying over mountains',
              metadata: {
                provider: 'pollinations',
                model: 'pollinations-video',
                duration: 6,
                resolution: '1080p',
                fps: 24,
                aspectRatio: '16:9',
                createdAt: new Date().toISOString(),
              },
            },
          ],
          prompt: 'a drone flying over mountains',
          config: { provider: 'pollinations', model: 'pollinations-video', duration: 6, resolution: '1080p' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const onArtifact = vi.fn();
    const enriched = enrichCreationPrompt(
      'a drone flying over mountains',
      'video',
      { modeId: 'video', tabId: 'provider', optionId: 'pollinations' },
    );

    await executeAgentMode('video', enriched, undefined, { onArtifact });

    expect(onArtifact).toHaveBeenCalled();
    const artifact = onArtifact.mock.calls[0][0];
    expect(artifact.kind).toBe('video');
    expect(artifact.url).toContain('.mp4');

    await persistArtifactToCanvas('ses-smoke-video', artifact, new Map());

    expect(createCanvas).toHaveBeenCalledWith('ses-smoke-video', {
      title: artifact.title,
      components: [
        {
          type: 'artifact',
          artifactId: artifact.artifactId,
          kind: 'video',
          title: artifact.title,
          content: artifact.content,
          url: artifact.url,
        },
      ],
      metadata: { artifactId: artifact.artifactId, kind: 'video' },
    });

    fetchSpy.mockRestore();
  });
});
