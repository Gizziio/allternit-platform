import { afterEach, describe, expect, it, vi } from 'vitest';

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock('ai', () => ({ generateText }));
vi.mock('@/lib/ai/providers', () => ({ getDefaultPluginModel: vi.fn().mockResolvedValue('fake-model') }));

import { createWebsitePlugin } from './plugin';

describe('Website plugin', () => {
  afterEach(() => {
    generateText.mockReset();
  });

  it('produces a runnable HTML preview and a deployment manifest', async () => {
    generateText.mockResolvedValue({
      text: JSON.stringify({
        name: 'Acme Launch',
        title: 'Acme Launch',
        description: 'A launch page for Acme.',
        theme: {
          primary: '#4f46e5',
          secondary: '#7c3aed',
          accent: '#06b6d4',
          background: '#ffffff',
          foreground: '#0f172a',
          font: 'Inter',
        },
        nav: [
          { label: 'Home', href: '#home' },
          { label: 'About', href: '#about' },
          { label: 'Contact', href: '#contact' },
        ],
        sections: [
          {
            type: 'hero',
            anchor: 'home',
            headline: 'Launch your idea',
            subheadline: 'The fastest way to ship.',
            cta: { label: 'Get started', href: '#contact' },
          },
          {
            type: 'features',
            anchor: 'about',
            headline: 'Why us',
            items: [
              { title: 'Fast', description: 'Ship in hours.' },
              { title: 'Reliable', description: 'Production-grade.' },
            ],
          },
          {
            type: 'contact',
            anchor: 'contact',
            headline: 'Get in touch',
          },
        ],
      }),
    });

    const plugin = createWebsitePlugin();
    await plugin.initialize();
    const output = await plugin.execute({
      prompt: 'A landing page for a SaaS startup called Acme',
      options: { stack: 'html', pages: '3', style: 'modern' },
    });

    expect(output.success).toBe(true);
    // preview + index + styles + script + README + about + contact + zip + deploy = 9
    expect(output.artifacts).toHaveLength(9);

    const preview = output.artifacts?.find((a) => a.name === 'preview.html');
    expect(preview).toBeDefined();
    expect(preview?.metadata?.format).toBe('html');
    const html = String(preview?.metadata?.html);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Acme Launch');
    expect(html).toContain('https://cdn.tailwindcss.com');
    expect(html).toContain('#contact');

    const sourceFiles = output.artifacts?.filter((a) => a.type === 'code' && a.name !== 'preview.html' && a.name !== 'deploy.json');
    expect(sourceFiles?.map((a) => a.name)).toEqual(
      expect.arrayContaining(['index.html', 'styles.css', 'script.js', 'README.md', 'about.html', 'contact.html']),
    );

    const zip = output.artifacts?.find((a) => a.name === 'Acme Launch.zip');
    expect(zip).toBeDefined();
    expect(zip?.metadata?.format).toBe('zip');

    const deploy = output.artifacts?.find((a) => a.name === 'deploy.json');
    expect(deploy).toBeDefined();
    expect(deploy?.metadata).toMatchObject({
      target: 'vercel',
      stack: 'html',
      entryFile: 'index.html',
      outputDirectory: '.',
    });
  });

  it('falls back to a working outline when the model returns invalid JSON', async () => {
    generateText.mockResolvedValue({ text: 'not json' });

    const plugin = createWebsitePlugin();
    await plugin.initialize();
    const output = await plugin.execute({
      prompt: 'A portfolio site',
      options: { stack: 'html', pages: '1', style: 'creative' },
    });

    expect(output.success).toBe(true);
    const preview = output.artifacts?.find((a) => a.name === 'preview.html');
    const html = String(preview?.metadata?.html);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('portfolio');

    const zip = output.artifacts?.find((a) => a.name === 'generated-website.zip');
    expect(zip).toBeDefined();
    expect(zip?.metadata?.format).toBe('zip');
  });
});
