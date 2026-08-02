import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrainView } from './BrainView';
import { fetchBrains, fetchBrainPages } from '@/services/brain-api';

vi.mock('@/services/brain-api', () => ({
  fetchBrains: vi.fn(),
  fetchBrainPages: vi.fn(),
}));

const mockFetchBrains = vi.mocked(fetchBrains);
const mockFetchBrainPages = vi.mocked(fetchBrainPages);

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BrainView />
    </QueryClientProvider>
  );
}

describe('BrainView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state explaining how to create a brain', async () => {
    mockFetchBrains.mockResolvedValue([]);
    renderView();

    expect(await screen.findByText('No brains yet')).toBeInTheDocument();
    expect(screen.getByText(/gizzi brain init/)).toBeInTheDocument();
    expect(screen.getByText(/POST \/api\/v1\/brains/)).toBeInTheDocument();
  });

  it('dims stale lessons in the learning feed and shows provenance refs', async () => {
    mockFetchBrains.mockResolvedValue([
      { brain_id: 'brain-1', created_at: '2026-07-01T00:00:00Z', clone_url: 'https://example.com/brain.git' },
    ]);
    mockFetchBrainPages.mockResolvedValue({
      brain_id: 'brain-1',
      branch: 'main',
      pages: [
        {
          path: 'learnings/stale-lesson.md',
          frontmatter: {
            type: 'lesson',
            status: 'stale',
            domain: 'testing',
            confidence: 'low',
            added: '2026-06-01',
            provenance_refs: ['decisions/d1.md', 'runbooks/r1.md'],
          },
          content: 'Old lesson body.',
        },
        {
          path: 'learnings/active-lesson.md',
          frontmatter: {
            type: 'lesson',
            status: 'active',
            domain: 'testing',
            confidence: 'high',
            added: '2026-07-15',
            provenance_refs: 'notes/source.md',
          },
          content: 'Fresh lesson body.',
        },
      ],
    });

    renderView();

    // Select the brain from the list to open the detail.
    fireEvent.click(await screen.findByText('brain-1'));

    const cards = await screen.findAllByTestId('learning-card');
    expect(cards).toHaveLength(2);

    const staleCard = cards.find((c) => c.textContent?.includes('learnings/stale-lesson.md'))!;
    const activeCard = cards.find((c) => c.textContent?.includes('learnings/active-lesson.md'))!;
    expect(staleCard.className).toContain('opacity-50');
    expect(activeCard.className).not.toContain('opacity-50');

    // Newest-first ordering.
    expect(cards[0].textContent).toContain('learnings/active-lesson.md');
    expect(cards[1].textContent).toContain('learnings/stale-lesson.md');

    // Provenance refs visible (array form and comma-string form).
    const refs = screen.getAllByTestId('provenance-ref').map((n) => n.textContent);
    expect(refs).toContain('decisions/d1.md');
    expect(refs).toContain('runbooks/r1.md');
    expect(refs).toContain('notes/source.md');
  });
});
