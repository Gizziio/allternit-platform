import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImageProvidersPanel } from './ImageProvidersPanel';

afterEach(() => {
  vi.unstubAllGlobals();
});

function createStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

function installStorage(storage: ReturnType<typeof createStorage>) {
  Object.defineProperty(window, 'localStorage', { value: storage, writable: true });
  Object.defineProperty(global, 'localStorage', { value: storage, writable: true });
}

describe('ImageProvidersPanel', () => {
  it('renders all providers and highlights configured ones', () => {
    installStorage(createStorage({
      allternit_image_api_keys: JSON.stringify({ openai: 'sk-test' }),
    }));

    render(<ImageProvidersPanel />);

    expect(screen.getByText('Pollinations.ai')).toBeInTheDocument();
    expect(screen.getByText('DALL-E 3 (OpenAI)')).toBeInTheDocument();
    expect(screen.getByText('Cloudflare Workers AI')).toBeInTheDocument();
    expect(screen.getByText(/connected/)).toBeInTheDocument();
  });

  it('shows connect buttons for API-key providers that are not configured', () => {
    installStorage(createStorage());

    render(<ImageProvidersPanel />);

    expect(screen.getAllByRole('button', { name: /Connect/i }).length).toBeGreaterThanOrEqual(1);
  });
});
