/**
 * Confidence Meter Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceMeter } from './ConfidenceMeter';

describe('ConfidenceMeter', () => {
  it('renders with correct confidence percentage', () => {
    render(<ConfidenceMeter confidence={0.85} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('shows passed status for confidence above threshold', () => {
    render(<ConfidenceMeter confidence={0.85} threshold={0.7} />);
    expect(screen.getByText('✓ Passed')).toBeInTheDocument();
  });

  it('shows failed status for confidence below threshold', () => {
    render(<ConfidenceMeter confidence={0.5} threshold={0.7} />);
    expect(screen.getByText('✗ Failed')).toBeInTheDocument();
  });

  it('shows warning status for near-threshold confidence', () => {
    render(<ConfidenceMeter confidence={0.62} threshold={0.7} />);
    expect(screen.getByText('⚠ Warning')).toBeInTheDocument();
  });

  it('displays threshold information', () => {
    render(<ConfidenceMeter confidence={0.85} threshold={0.8} />);
    expect(screen.getByText('Threshold: 80%')).toBeInTheDocument();
  });

  it('renders different sizes correctly', () => {
    const { rerender } = render(<ConfidenceMeter confidence={0.75} size="small" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
    
    rerender(<ConfidenceMeter confidence={0.75} size="medium" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
    
    rerender(<ConfidenceMeter confidence={0.75} size="large" />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('animates when animated prop is true', () => {
    render(<ConfidenceMeter confidence={0.9} animated={true} />);
    const circle = document.querySelector('circle[stroke-dashoffset]');
    expect(circle).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<ConfidenceMeter confidence={0.75} showLabel={false} />);
    expect(screen.queryByText('Confidence')).not.toBeInTheDocument();
  });
});
