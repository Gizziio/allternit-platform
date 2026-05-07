/**
 * UI Forge Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { UIForge } from './UIForge';

global.fetch = vi.fn();

describe('UIForge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial state', () => {
    render(<UIForge />);
    
    expect(screen.getByText('UI Forge')).toBeInTheDocument();
    expect(screen.getByText('AI Architect')).toBeInTheDocument();
    expect(screen.getByText('Manual Spec')).toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    render(<UIForge />);
    
    const manualTab = screen.getByText('Manual Spec');
    fireEvent.click(manualTab);
    
    expect(screen.getByText('MANUAL PALETTE')).toBeInTheDocument();
    
    const aiTab = screen.getByText('AI Architect');
    fireEvent.click(aiTab);
    
    expect(screen.getByText('GENERATIVE PROMPT')).toBeInTheDocument();
  });
});
