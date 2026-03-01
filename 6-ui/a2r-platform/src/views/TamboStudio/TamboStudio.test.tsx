/**
 * Tambo Studio Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TamboStudio } from './TamboStudio';

global.fetch = vi.fn();

describe('TamboStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial state', () => {
    render(<TamboStudio />);
    
    expect(screen.getByText('Tambo Studio')).toBeInTheDocument();
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('Specification')).toBeInTheDocument();
    expect(screen.getByText('Generated Code')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('displays component palette', () => {
    render(<TamboStudio />);
    
    expect(screen.getByText('Button')).toBeInTheDocument();
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Card')).toBeInTheDocument();
    expect(screen.getByText('Container')).toBeInTheDocument();
  });

  it('adds component when clicked', async () => {
    render(<TamboStudio />);

    const buttonComponent = screen.getByRole('button', { name: /button/i });
    fireEvent.click(buttonComponent);

    await waitFor(() => {
      expect(screen.getByText('Added Components (1)')).toBeInTheDocument();
    });
  });

  it('removes component when delete clicked', async () => {
    render(<TamboStudio />);

    // Add component
    const buttonComponent = screen.getByRole('button', { name: /button/i });
    fireEvent.click(buttonComponent);

    await waitFor(() => {
      expect(screen.getByText('Added Components (1)')).toBeInTheDocument();
    });

    // Remove component
    const deleteButton = screen.getByRole('button', { name: '' }); // Trash icon
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByText('Added Components (1)')).not.toBeInTheDocument();
    });
  });

  it('updates spec title', () => {
    render(<TamboStudio />);

    const titleInput = screen.getByPlaceholderText('My Generated UI');
    fireEvent.change(titleInput, { target: { value: 'My Custom UI' } });

    expect(titleInput).toHaveValue('My Custom UI');
  });

  it('updates spec description', () => {
    render(<TamboStudio />);

    const descInput = screen.getByPlaceholderText('Describe what you want to build...');
    fireEvent.change(descInput, { target: { value: 'A test description' } });

    expect(descInput).toHaveValue('A test description');
  });

  it('changes layout type', async () => {
    render(<TamboStudio />);

    const layoutSelect = screen.getByLabelText(/layout type/i);
    fireEvent.click(layoutSelect);

    // Wait for portal to open and option to be visible (Radix renders options in document.body)
    await waitFor(() => {
      const gridOption = screen.getByRole('option', { name: /grid/i });
      expect(gridOption).toBeInTheDocument();
    });

    const gridOption = screen.getByRole('option', { name: /grid/i });
    fireEvent.click(gridOption);

    // Verify the select shows the new value
    await waitFor(() => {
      expect(layoutSelect).toHaveTextContent(/grid/i);
    });
  });

  it('changes theme', async () => {
    render(<TamboStudio />);

    const themeSelect = screen.getByLabelText(/theme/i);
    fireEvent.click(themeSelect);

    await waitFor(() => {
      const darkOption = screen.getByRole('option', { name: /dark/i });
      expect(darkOption).toBeInTheDocument();
    });

    const darkOption = screen.getByRole('option', { name: /dark/i });
    fireEvent.click(darkOption);

    await waitFor(() => {
      expect(themeSelect).toHaveTextContent(/dark/i);
    });
  });

  it('changes UI type for generation', async () => {
    render(<TamboStudio />);

    const uiTypeSelect = screen.getByLabelText(/ui type/i);
    fireEvent.click(uiTypeSelect);

    await waitFor(() => {
      const vueOption = screen.getByRole('option', { name: /vue/i });
      expect(vueOption).toBeInTheDocument();
    });

    const vueOption = screen.getByRole('option', { name: /vue/i });
    fireEvent.click(vueOption);

    await waitFor(() => {
      expect(uiTypeSelect).toHaveTextContent(/vue/i);
    });
  });

  it('disables generate button when no components', () => {
    render(<TamboStudio />);

    const generateButton = screen.getByRole('button', { name: /generate ui/i });
    expect(generateButton).toBeDisabled();
  });

  it('enables generate button when components added', async () => {
    render(<TamboStudio />);

    const buttonComponent = screen.getByRole('button', { name: /button/i });
    fireEvent.click(buttonComponent);

    await waitFor(() => {
      const generateButton = screen.getByRole('button', { name: /generate ui/i });
      expect(generateButton).not.toBeDisabled();
    });
  });

  it('generates UI successfully', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ spec_id: 'spec_1' }) })
      .mockResolvedValueOnce({ 
        ok: true, 
        json: () => Promise.resolve({ 
          generation_id: 'gen_1',
          code: '<div>Generated</div>',
          components_generated: 1,
          confidence: 0.9,
        }) 
      });

    render(<TamboStudio />);

    // Add component
    const buttonComponent = screen.getByRole('button', { name: /button/i });
    fireEvent.click(buttonComponent);

    await waitFor(() => {
      expect(screen.getByText('Added Components (1)')).toBeInTheDocument();
    });

    // Generate
    const generateButton = screen.getByRole('button', { name: /generate ui/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('<div>Generated</div>')).toBeInTheDocument();
    });
  });

  it('handles generation failure', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ spec_id: 'spec_1' }) })
      .mockRejectedValueOnce(new Error('Generation failed'));

    render(<TamboStudio />);

    const buttonComponent = screen.getByRole('button', { name: /button/i });
    fireEvent.click(buttonComponent);

    await waitFor(() => {
      expect(screen.getByText('Added Components (1)')).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /generate ui/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.queryByDisplayValue('<div>Generated</div>')).not.toBeInTheDocument();
    });
  });

  it('copies code to clipboard', async () => {
    const mockClipboard = { writeText: vi.fn() };
    Object.assign(navigator, { clipboard: mockClipboard });

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ spec_id: 'spec_1' }) })
      .mockResolvedValueOnce({ 
        ok: true, 
        json: () => Promise.resolve({ 
          generation_id: 'gen_1',
          code: '<div>Test</div>',
          components_generated: 1,
          confidence: 0.9,
        }) 
      });

    render(<TamboStudio />);

    const buttonComponent = screen.getByRole('button', { name: /button/i });
    fireEvent.click(buttonComponent);

    await waitFor(() => {
      expect(screen.getByText('Added Components (1)')).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /generate ui/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('<div>Test</div>')).toBeInTheDocument();
    });

    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith('<div>Test</div>');
    });
  });

  it('downloads code as file', async () => {
    const mockClick = vi.fn();
    const originalCreateElement = document.createElement;
    
    // Only mock createElement for 'a' tag
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'a') {
        return { click: mockClick, setAttribute: vi.fn(), style: {}, href: '', download: '' } as any;
      }
      return originalCreateElement.call(document, tagName);
    }) as any;

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ spec_id: 'spec_1' }) })
      .mockResolvedValueOnce({ 
        ok: true, 
        json: () => Promise.resolve({ 
          generation_id: 'gen_1',
          code: '<div>Test</div>',
          components_generated: 1,
          confidence: 0.9,
        }) 
      });

    render(<TamboStudio />);

    const buttonComponent = screen.getByRole('button', { name: /button/i });
    fireEvent.click(buttonComponent);

    await waitFor(() => {
      expect(screen.getByText('Added Components (1)')).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /generate ui/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('<div>Test</div>')).toBeInTheDocument();
    });

    const downloadButton = screen.getByRole('button', { name: /download/i });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled();
    });

    // Restore original
    document.createElement = originalCreateElement;
  });

  it('displays preview with components', async () => {
    render(<TamboStudio />);

    const buttonComponent = screen.getByRole('button', { name: /button/i });
    fireEvent.click(buttonComponent);

    await waitFor(() => {
      expect(screen.getByText('Added Components (1)')).toBeInTheDocument();
    });

    // Preview should show the component
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('shows empty preview when no components', () => {
    render(<TamboStudio />);

    expect(screen.getByText('Add components to see preview')).toBeInTheDocument();
  });

  it('changes preview layout based on spec', async () => {
    render(<TamboStudio />);

    // Add component
    const buttonComponent = screen.getByRole('button', { name: /button/i });
    fireEvent.click(buttonComponent);

    // Change to grid layout
    const layoutSelect = screen.getByLabelText(/layout type/i);
    fireEvent.click(layoutSelect);
    
    await waitFor(() => {
      const gridOption = screen.getByRole('option', { name: /grid/i });
      expect(gridOption).toBeInTheDocument();
    });
    
    const gridOption = screen.getByRole('option', { name: /grid/i });
    fireEvent.click(gridOption);

    await waitFor(() => {
      expect(screen.getByText('Added Components (1)')).toBeInTheDocument();
    });
  });
});
