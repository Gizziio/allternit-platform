/**
 * IVKGE Panel Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { IVKGEPanel } from './IVKGEPanel';

global.fetch = vi.fn();

describe('IVKGEPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  it('renders upload interface initially', () => {
    render(<IVKGEPanel />);
    
    expect(screen.getByText('IVKGE Panel')).toBeInTheDocument();
    expect(screen.getByText('Upload Image for Extraction')).toBeInTheDocument();
    expect(screen.getByLabelText(/click to upload/i)).toBeInTheDocument();
  });

  it('handles file selection', async () => {
    render(<IVKGEPanel />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/click to upload/i);
    
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    });
  });

  it('displays error on upload failure', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Upload failed'));

    render(<IVKGEPanel />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/click to upload/i);
    fireEvent.change(input, { target: { files: [file] } });

    const extractButton = screen.getByRole('button', { name: /extract/i });
    fireEvent.click(extractButton);

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });
  });

  it('shows extraction results tab after successful extraction', async () => {
    const mockExtraction = {
      extraction_id: 'ext_1',
      source_type: 'screenshot',
      entities: [
        {
          entity_id: 'ent_1',
          name: 'Button',
          entity_type: 'component',
          confidence: 0.95,
          properties: {},
        },
      ],
      relationships: [],
      created_at: new Date().toISOString(),
    };

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ upload_id: 'up_1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockExtraction) });

    render(<IVKGEPanel />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/click to upload/i);
    fireEvent.change(input, { target: { files: [file] } });

    const extractButton = screen.getByRole('button', { name: /extract/i });
    fireEvent.click(extractButton);

    await waitFor(() => {
      expect(screen.getByText('Entities (1)')).toBeInTheDocument();
    });
  });

  it('displays entities in results', async () => {
    const mockExtraction = {
      extraction_id: 'ext_1',
      source_type: 'screenshot',
      entities: [
        {
          entity_id: 'ent_1',
          name: 'Submit Button',
          entity_type: 'button',
          confidence: 0.95,
          properties: {},
        },
      ],
      relationships: [],
      created_at: new Date().toISOString(),
    };

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ upload_id: 'up_1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockExtraction) });

    render(<IVKGEPanel />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/click to upload/i);
    fireEvent.change(input, { target: { files: [file] } });

    const extractButton = screen.getByRole('button', { name: /extract/i });
    fireEvent.click(extractButton);

    // Wait for extraction to complete and results to show
    await waitFor(() => {
      expect(screen.getByText('Entities (1)')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByText('Submit Button')).toBeInTheDocument();
      expect(screen.getByText('button')).toBeInTheDocument();
      expect(screen.getByText(/95%/)).toBeInTheDocument();
    });
  });

  it('allows editing entities', async () => {
    const mockExtraction = {
      extraction_id: 'ext_1',
      source_type: 'screenshot',
      entities: [
        {
          entity_id: 'ent_1',
          name: 'Old Name',
          entity_type: 'button',
          confidence: 0.95,
          properties: {},
        },
      ],
      relationships: [],
      created_at: new Date().toISOString(),
    };

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ upload_id: 'up_1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockExtraction) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockExtraction) });

    render(<IVKGEPanel />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/click to upload/i);
    fireEvent.change(input, { target: { files: [file] } });

    const extractButton = screen.getByRole('button', { name: /extract/i });
    fireEvent.click(extractButton);

    // Wait for extraction to complete
    await waitFor(() => {
      expect(screen.getByText('Entities (1)')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Edit Entity')).toBeInTheDocument();
    });
  });

  it('displays relationships when present', async () => {
    const mockExtraction = {
      extraction_id: 'ext_1',
      source_type: 'screenshot',
      entities: [],
      relationships: [
        {
          relationship_id: 'rel_1',
          source_entity: 'button_1',
          target_entity: 'container_1',
          relationship_type: 'inside',
          confidence: 0.9,
        },
      ],
      created_at: new Date().toISOString(),
    };

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ upload_id: 'up_1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockExtraction) });

    render(<IVKGEPanel />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/click to upload/i);
    fireEvent.change(input, { target: { files: [file] } });

    const extractButton = screen.getByRole('button', { name: /extract/i });
    fireEvent.click(extractButton);

    // Wait for extraction to complete
    await waitFor(() => {
      expect(screen.getByText('Relationships (1)')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays OCR text when present', async () => {
    const mockExtraction = {
      extraction_id: 'ext_1',
      source_type: 'screenshot',
      entities: [],
      relationships: [],
      ocr_text: 'Extracted text from image',
      created_at: new Date().toISOString(),
    };

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ upload_id: 'up_1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockExtraction) });

    render(<IVKGEPanel />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/click to upload/i);
    fireEvent.change(input, { target: { files: [file] } });

    const extractButton = screen.getByRole('button', { name: /extract/i });
    fireEvent.click(extractButton);

    // Wait for extraction to complete
    await waitFor(() => {
      expect(screen.getByText('OCR Text')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Extracted text from image')).toBeInTheDocument();
    });
  });

  it('displays ambiguities tab when present', async () => {
    const mockExtraction = {
      extraction_id: 'ext_1',
      source_type: 'screenshot',
      entities: [],
      relationships: [],
      ambiguity_report: {
        report_id: 'amb_1',
        ambiguities: [
          {
            ambiguity_id: 'amb_1',
            ambiguity_type: 'Entity Type Unclear',
            description: 'Could be button or link',
            options: ['button', 'link'],
          },
        ],
        overall_confidence: 0.7,
      },
      created_at: new Date().toISOString(),
    };

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ upload_id: 'up_1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockExtraction) });

    render(<IVKGEPanel />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/click to upload/i);
    fireEvent.change(input, { target: { files: [file] } });

    const extractButton = screen.getByRole('button', { name: /extract/i });
    fireEvent.click(extractButton);

    // Wait for extraction to complete and Ambiguities tab to be enabled
    await waitFor(() => {
      const ambiguitiesTab = screen.getByRole('tab', { name: /ambiguities/i });
      expect(ambiguitiesTab).not.toBeDisabled();
    }, { timeout: 3000 });
  });
});
