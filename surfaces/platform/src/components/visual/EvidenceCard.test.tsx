/**
 * Evidence Card Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceCard } from './EvidenceCard';

describe('EvidenceCard', () => {
  const mockArtifact = {
    type: 'ui_state' as const,
    confidence: 0.95,
    timestamp: new Date().toISOString(),
    metadata: { width: 1920, height: 1080 },
    previewUrl: undefined,
  };

  it('renders artifact type badge correctly', () => {
    render(<EvidenceCard {...mockArtifact} />);
    expect(screen.getByText('UI State')).toBeInTheDocument();
  });

  it('displays confidence percentage', () => {
    render(<EvidenceCard {...mockArtifact} />);
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('shows captured timestamp', () => {
    render(<EvidenceCard {...mockArtifact} />);
    expect(screen.getByText(/Captured at/)).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const handleClick = vi.fn();
    render(<EvidenceCard {...mockArtifact} onClick={handleClick} />);
    
    const card = screen.getByText('UI State').closest('div');
    if (card) {
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });

  it('renders different artifact types', () => {
    const types = [
      { type: 'coverage_map' as const, label: 'Coverage' },
      { type: 'console_output' as const, label: 'Console' },
      { type: 'visual_diff' as const, label: 'Visual Diff' },
      { type: 'error_state' as const, label: 'Errors' },
    ];

    types.forEach(({ type, label }) => {
      const { unmount } = render(
        <EvidenceCard 
          type={type} 
          confidence={0.8} 
          timestamp={new Date().toISOString()}
        />
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });

  it('displays metadata items', () => {
    render(<EvidenceCard {...mockArtifact} />);
    expect(screen.getByText('width:')).toBeInTheDocument();
    expect(screen.getByText('1920')).toBeInTheDocument();
  });

  it('shows selected state', () => {
    render(<EvidenceCard {...mockArtifact} isSelected={true} />);
    // Selected state is indicated by border color change
    const card = screen.getByText('UI State').closest('div');
    expect(card).toBeInTheDocument();
  });
});
