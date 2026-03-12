/**
 * Visual Verification Panel Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisualVerificationPanel } from './VisualVerificationPanel';

describe('VisualVerificationPanel', () => {
  const mockStatus = {
    wihId: 'wih_test_123',
    status: 'completed' as const,
    overallConfidence: 0.85,
    threshold: 0.7,
    artifacts: [
      {
        id: 'art_1',
        type: 'ui_state' as const,
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        data: {},
        metadata: {},
      },
      {
        id: 'art_2',
        type: 'console_output' as const,
        confidence: 0.75,
        timestamp: new Date().toISOString(),
        data: {},
        metadata: {},
      },
    ],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  const mockTrendData = [
    { timestamp: new Date().toISOString(), confidence: 0.8, wihId: 'wih_1' },
    { timestamp: new Date().toISOString(), confidence: 0.85, wihId: 'wih_2' },
  ];

  it('renders empty state when no status provided', () => {
    render(<VisualVerificationPanel />);
    expect(screen.getByText('No verification data available')).toBeInTheDocument();
  });

  it('renders verification status correctly', () => {
    render(<VisualVerificationPanel status={mockStatus} />);
    expect(screen.getByText('Visual Verification')).toBeInTheDocument();
    expect(screen.getByText('wih_test_123')).toBeInTheDocument();
  });

  it('displays correct status badge', () => {
    render(<VisualVerificationPanel status={mockStatus} />);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  it('shows artifact count summary', () => {
    render(<VisualVerificationPanel status={mockStatus} />);
    expect(screen.getByText('2/2')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', () => {
    const handleRefresh = vi.fn();
    render(<VisualVerificationPanel status={mockStatus} onRefresh={handleRefresh} />);
    
    const refreshButton = screen.getByTitle('Refresh');
    fireEvent.click(refreshButton);
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });

  it('calls onRequestBypass when bypass button is clicked', () => {
    const failedStatus = { ...mockStatus, status: 'failed' as const };
    const handleBypass = vi.fn();
    
    render(
      <VisualVerificationPanel 
        status={failedStatus} 
        onRequestBypass={handleBypass} 
      />
    );
    
    const bypassButton = screen.getByText('Request Bypass');
    fireEvent.click(bypassButton);
    expect(handleBypass).toHaveBeenCalledTimes(1);
  });

  it('displays error message when present', () => {
    const errorStatus = { 
      ...mockStatus, 
      status: 'failed' as const,
      error: 'Verification timeout exceeded' 
    };
    
    render(<VisualVerificationPanel status={errorStatus} />);
    expect(screen.getByText('Verification timeout exceeded')).toBeInTheDocument();
  });

  it('renders evidence cards for each artifact', () => {
    render(<VisualVerificationPanel status={mockStatus} />);
    expect(screen.getByText('UI State')).toBeInTheDocument();
    expect(screen.getByText('Console')).toBeInTheDocument();
  });

  it('filters artifacts by type', () => {
    render(<VisualVerificationPanel status={mockStatus} />);
    
    // Click on UI State filter
    const uiFilter = screen.getByText('ui state');
    fireEvent.click(uiFilter);
    
    // Should show filtered results
    expect(screen.getByText('UI State')).toBeInTheDocument();
  });

  it('renders with trend data', () => {
    render(
      <VisualVerificationPanel 
        status={mockStatus} 
        trendData={mockTrendData}
      />
    );
    
    expect(screen.getByText('Confidence Trend')).toBeInTheDocument();
  });

  it('shows running status with progress indicator', () => {
    const runningStatus = { ...mockStatus, status: 'running' as const };
    render(<VisualVerificationPanel status={runningStatus} />);
    
    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
  });

  it('displays threshold value', () => {
    render(<VisualVerificationPanel status={mockStatus} />);
    expect(screen.getByText('70%')).toBeInTheDocument();
  });
});
