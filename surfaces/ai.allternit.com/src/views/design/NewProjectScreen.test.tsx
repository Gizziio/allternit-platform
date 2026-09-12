import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import saasLandingSkill from '../../../skills/saas-landing-skill/SKILL.md?raw';
import { parseSkillMarkdown } from '../../lib/design/skill-registry';
import { NewProjectScreen } from './NewProjectScreen';

const skill = parseSkillMarkdown('saas-landing', saasLandingSkill, ['assets/base.html']);

function Harness({ onStart }: { onStart: (config: { name: string; prompt: string; skillValues?: Record<string, unknown> }) => void }) {
  const [skillValues, setSkillValues] = useState<Record<string, unknown>>({});
  return (
    <NewProjectScreen
      onStart={onStart}
      selectedSkill={skill}
      skillValues={skillValues}
      onChangeSkillValues={setSkillValues}
    />
  );
}

describe('NewProjectScreen skill inputs (issue #374)', () => {
  it('renders one control per declared od.inputs entry', () => {
    render(<Harness onStart={vi.fn()} />);
    expect(screen.getByLabelText('Product name')).toBeTruthy();
    expect(screen.getByLabelText('Tagline')).toBeTruthy();
    expect(screen.getByLabelText('Include pricing section')).toBeTruthy();
  });

  it('blocks submit until required inputs are filled, then passes values through', () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);

    const prompt = screen.getByPlaceholderText('Describe the design you want to create');
    fireEvent.change(prompt, { target: { value: 'Landing page for my devtool' } });

    const submit = screen.getByRole('button', { name: 'Create project' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true); // required inputs still empty

    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Acme Dev' } });
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'Ship faster' } });
    fireEvent.click(screen.getByLabelText('Include pricing section')); // default true → false

    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    expect(onStart).toHaveBeenCalledTimes(1);
    const config = onStart.mock.calls[0]![0] as { name: string; skillValues?: Record<string, unknown> };
    expect(config.skillValues).toEqual({
      product_name: 'Acme Dev',
      tagline: 'Ship faster',
      has_pricing: false,
    });
  });

  it('declared defaults count as filled values', () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);
    fireEvent.change(screen.getByPlaceholderText('Describe the design you want to create'), {
      target: { value: 'Landing page' },
    });
    const submit = screen.getByRole('button', { name: 'Create project' }) as HTMLButtonElement;
    // has_pricing defaults to true, but the two required strings are empty → gated.
    expect(submit.disabled).toBe(true);
  });
});

/** Minimal in-memory IndexedDB fake for gallery tests — jsdom provides no indexedDB. */
function fakeIndexedDB(seed: Record<string, unknown>[]) {
  const store = new Map<string, unknown>(seed.map((entry) => [(entry as { id: string }).id, entry]));
  const makeRequest = (result: unknown) => {
    const req: { result: unknown; error: null; onsuccess: null | ((e: unknown) => void); onerror: null } = {
      result, error: null, onsuccess: null, onerror: null,
    };
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  };
  return {
    open: (_dbName: string, _version: number) => {
      const req: { result: unknown; error: null; onsuccess: null | ((e: unknown) => void); onerror: null; onupgradeneeded: null } = {
        result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null,
      };
      queueMicrotask(() => {
        req.result = {
          transaction: () => {
            const tx: { onerror: null; onabort: null; oncomplete: null | (() => void); objectStore: () => unknown } = {
              onerror: null, onabort: null, oncomplete: null,
              objectStore: () => ({
                getAll: () => makeRequest([...store.values()]),
                put: (value: { id: string }) => { store.set(value.id, value); return makeRequest(undefined); },
                delete: (key: string) => { store.delete(key); return makeRequest(undefined); },
              }),
            };
            queueMicrotask(() => tx.oncomplete?.());
            return tx;
          },
        };
        req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
}

describe('NewProjectScreen aspect picker + disclaimer (§6 P2/P3)', () => {
  it('defaults to Adaptive (no aspect constraint) and flows a chosen aspect through onStart', () => {
    const onStart = vi.fn();
    render(<NewProjectScreen onStart={onStart} />);
    fireEvent.change(screen.getByPlaceholderText('Describe the design you want to create'), {
      target: { value: 'Poster for a jazz night' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(onStart.mock.calls[0]![0]).toMatchObject({ aspect: undefined });

    fireEvent.click(screen.getByRole('radio', { name: '16:9' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(onStart.mock.calls[1]![0]).toMatchObject({ aspect: '16:9' });
  });

  it('renders the AI-generated disclaimer footer', () => {
    render(<NewProjectScreen onStart={vi.fn()} />);
    expect(screen.getByText(/Artifacts are AI-generated/)).toBeTruthy();
  });
});

describe('NewProjectScreen gallery (P0 use-case gallery)', () => {
  it('shows the empty state when no artifacts have been captured', async () => {
    (globalThis as { indexedDB?: unknown }).indexedDB = fakeIndexedDB([]);
    render(<NewProjectScreen onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));
    expect(await screen.findByText(/Artifacts you create will appear here/)).toBeTruthy();
  });

  it('lists category pills and remixes the clicked card', async () => {
    const entry = {
      id: 'gallery-design-1',
      projectId: 'design-1',
      projectName: 'Acme landing',
      prompt: 'Create a SaaS landing page',
      type: 'prototype',
      artifactHtml: '<html><body><h1>Acme</h1></body></html>',
      createdAt: 1,
      updatedAt: 2,
    };
    (globalThis as { indexedDB?: unknown }).indexedDB = fakeIndexedDB([entry]);
    const onRemix = vi.fn();
    render(<NewProjectScreen onStart={vi.fn()} onRemix={onRemix} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));

    expect(await screen.findByText('Acme landing')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Landing pages' })).toBeTruthy();

    fireEvent.click(screen.getByTitle('Remix: Acme landing'));
    expect(onRemix).toHaveBeenCalledTimes(1);
    expect(onRemix.mock.calls[0]![0]).toMatchObject({ projectId: 'design-1', prompt: 'Create a SaaS landing page' });
  });
});
