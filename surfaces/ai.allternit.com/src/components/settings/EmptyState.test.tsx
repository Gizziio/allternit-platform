import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { PuzzlePiece } from '@phosphor-icons/react';

describe('EmptyState', () => {
  it('renders title, caption, and primary CTA', () => {
    render(
      <EmptyState
        icon={<PuzzlePiece data-testid="empty-icon" />}
        title="Nothing here"
        caption="Try browsing for extensions."
        ctaLabel="Browse"
        primaryCta
        onCtaClick={() => {}}
      />
    );

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Try browsing for extensions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument();
  });

  it('calls onCtaClick when the button is clicked', () => {
    const onCtaClick = vi.fn();
    render(
      <EmptyState
        icon={<PuzzlePiece data-testid="empty-icon" />}
        caption="No items"
        ctaLabel="Retry"
        onCtaClick={onCtaClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onCtaClick).toHaveBeenCalledTimes(1);
  });

  it('renders without a button when ctaLabel is omitted', () => {
    render(
      <EmptyState
        icon={<PuzzlePiece data-testid="empty-icon" />}
        title="Empty"
        caption="Nothing to do"
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
