/**
 * Plugin Manifest Validator Tests
 *
 * Tests for the PluginManifestValidator component covering:
 * - Initial render states
 * - File input handling
 * - Text input validation
 * - URL loading
 * - Tab switching
 * - Copy functionality
 * - Example loading
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PluginManifestValidator } from './PluginManifestValidator';

// Mock the pluginStandards module
vi.mock('../plugins/pluginStandards', () => ({
  validatePluginManifestV1: vi.fn((value: unknown) => {
    const obj = value as Record<string, unknown>;
    if (!obj?.name) return { valid: false, errors: ['name: Required'] };
    if (!obj?.description) return { valid: false, errors: ['description: Required'] };
    if (!obj?.version) return { valid: false, errors: ['version: Required'] };
    return { valid: true, errors: [] };
  }),
  validateMarketplaceManifestV1: vi.fn((value: unknown) => {
    const obj = value as Record<string, unknown>;
    if (!obj?.name) return { valid: false, errors: ['name: Required'] };
    if (!obj?.owner) return { valid: false, errors: ['owner: Required'] };
    if (!Array.isArray(obj?.plugins)) return { valid: false, errors: ['plugins: Required'] };
    return { valid: true, errors: [] };
  }),
}));

// Mock fetch
global.fetch = vi.fn();

const validPluginManifest = {
  $schema: 'https://anthropic.com/claude-code/plugin.schema.json',
  name: 'test-plugin',
  description: 'A test plugin',
  version: '1.0.0',
  author: {
    name: 'Test Author',
    email: 'test@example.com',
  },
  license: 'MIT',
  tags: ['test', 'plugin'],
};

const validMarketplaceManifest = {
  $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
  name: 'test-marketplace',
  owner: {
    name: 'Test Owner',
    email: 'owner@example.com',
  },
  metadata: {
    version: '1.0.0',
    description: 'A test marketplace',
  },
  plugins: [
    {
      name: 'example-plugin',
      source: {
        source: 'github',
        repo: 'owner/repo',
      },
    },
  ],
};

const invalidManifest = {
  name: 'invalid-plugin',
  // Missing description and version
};

describe('PluginManifestValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Render', () => {
    it('renders with default state', () => {
      render(<PluginManifestValidator />);

      expect(screen.getByText('Plugin Manifest Validator')).toBeInTheDocument();
      expect(screen.getByText('Validate plugin.json and marketplace.json files')).toBeInTheDocument();
      expect(screen.getByText('Drop JSON file here or click to browse')).toBeInTheDocument();
    });

    it('renders in compact mode without header', () => {
      render(<PluginManifestValidator compact hideHeader />);

      expect(screen.queryByText('Plugin Manifest Validator')).not.toBeInTheDocument();
      expect(screen.getByText('Drop JSON file here or click to browse')).toBeInTheDocument();
    });

    it('renders with initial content', () => {
      const initialContent = JSON.stringify(validPluginManifest, null, 2);
      render(<PluginManifestValidator initialContent={initialContent} />);

      expect(screen.getByText('Plugin Manifest JSON')).toBeInTheDocument();
      expect(screen.getByDisplayValue(/test-plugin/)).toBeInTheDocument();
    });

    it('renders with two tabs', () => {
      render(<PluginManifestValidator />);

      expect(screen.getByTestId('tab-plugin')).toBeInTheDocument();
      expect(screen.getByTestId('tab-marketplace')).toBeInTheDocument();
    });

    it('defaults to plugin tab', () => {
      render(<PluginManifestValidator />);

      const pluginTab = screen.getByTestId('tab-plugin');
      expect(pluginTab).toHaveStyle({ borderBottom: '2px solid #d4b08c' });
    });
  });

  describe('Tab Switching', () => {
    it('switches to marketplace tab', async () => {
      render(<PluginManifestValidator />);

      const marketplaceTab = screen.getByTestId('tab-marketplace');
      
      await act(async () => {
        fireEvent.click(marketplaceTab);
      });

      expect(marketplaceTab).toHaveStyle({ borderBottom: '2px solid #d4b08c' });
      expect(screen.getByText('Marketplace Manifest JSON')).toBeInTheDocument();
    });

    it('clears content when switching tabs', async () => {
      const initialContent = JSON.stringify(validPluginManifest, null, 2);
      render(<PluginManifestValidator initialContent={initialContent} />);

      const marketplaceTab = screen.getByTestId('tab-marketplace');
      
      await act(async () => {
        fireEvent.click(marketplaceTab);
      });

      // Content should be cleared
      expect(screen.queryByDisplayValue(/test-plugin/)).not.toBeInTheDocument();
    });
  });

  describe('File Input', () => {
    it('has file input available', () => {
      render(<PluginManifestValidator />);

      const fileInput = screen.getByTestId('file-input');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('accept', '.json,application/json');
    });

    // Note: File upload tests are skipped in jsdom environment because
    // File.text() method is not available in jsdom
    it.skip('handles file selection', async () => {
      // This test would work in a real browser with actual File API
    });
  });

  describe('Text Input', () => {
    it('validates valid plugin manifest', async () => {
      render(<PluginManifestValidator />);

      const textarea = screen.getByTestId('json-textarea');
      
      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: JSON.stringify(validPluginManifest, null, 2) },
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('validation-status')).toBeInTheDocument();
      });

      const status = screen.getByTestId('validation-status');
      expect(status.textContent).toContain('Valid manifest');
    });

    it('validates valid marketplace manifest', async () => {
      render(<PluginManifestValidator />);

      // Switch to marketplace tab
      const marketplaceTab = screen.getByTestId('tab-marketplace');
      await act(async () => {
        fireEvent.click(marketplaceTab);
      });

      const textarea = screen.getByTestId('json-textarea');
      
      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: JSON.stringify(validMarketplaceManifest, null, 2) },
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('validation-status')).toBeInTheDocument();
      });

      const status = screen.getByTestId('validation-status');
      expect(status.textContent).toContain('Valid manifest');
    });

    it('shows errors for invalid JSON', async () => {
      render(<PluginManifestValidator />);

      const textarea = screen.getByTestId('json-textarea');
      
      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: 'not valid json {{' },
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('validation-status')).toBeInTheDocument();
      });

      const status = screen.getByTestId('validation-status');
      expect(status.textContent).toContain('Validation failed');
    });

    it('shows errors for invalid manifest structure', async () => {
      render(<PluginManifestValidator />);

      const textarea = screen.getByTestId('json-textarea');
      
      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: JSON.stringify(invalidManifest, null, 2) },
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('validation-status')).toBeInTheDocument();
      });

      const status = screen.getByTestId('validation-status');
      expect(status.textContent).toContain('Validation failed');
    });
  });

  describe('URL Loading', () => {
    it('loads manifest from URL', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(validPluginManifest),
      } as Response);

      render(<PluginManifestValidator />);

      const urlInput = screen.getByPlaceholderText(/raw.githubusercontent.com/);
      const loadButton = screen.getByText('Load');

      await act(async () => {
        fireEvent.change(urlInput, { target: { value: 'https://example.com/plugin.json' } });
        fireEvent.click(loadButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('https://example.com/plugin.json');
      });
    });

    it('handles URL fetch errors', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<PluginManifestValidator />);

      const urlInput = screen.getByPlaceholderText(/raw.githubusercontent.com/);
      const loadButton = screen.getByText('Load');

      await act(async () => {
        fireEvent.change(urlInput, { target: { value: 'https://example.com/plugin.json' } });
        fireEvent.click(loadButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Error loading from URL/)).toBeInTheDocument();
      });
    });
  });

  describe('Collapsible Sections', () => {
    it('toggles sections', async () => {
      const initialContent = JSON.stringify(validPluginManifest, null, 2);
      render(<PluginManifestValidator initialContent={initialContent} />);

      await waitFor(() => {
        expect(screen.getByText('Formatted Preview')).toBeInTheDocument();
      });

      // Find the preview section header button
      const previewButton = screen.getByText('Formatted Preview');
      
      // Click to toggle - this should work without errors
      await act(async () => {
        fireEvent.click(previewButton);
      });

      // The button should still be present after clicking
      expect(screen.getByText('Formatted Preview')).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    it('copies formatted JSON', async () => {
      // Mock clipboard with Object.defineProperty since it's read-only
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      const initialContent = JSON.stringify(validPluginManifest, null, 2);
      render(<PluginManifestValidator initialContent={initialContent} />);

      await waitFor(() => {
        expect(screen.getByText('Formatted Preview')).toBeInTheDocument();
      });

      // Expand the preview section
      const previewButton = screen.getByText('Formatted Preview');
      await act(async () => {
        fireEvent.click(previewButton);
      });

      // Find and click the copy button
      const copyButton = screen.getByText('Copy JSON');
      await act(async () => {
        fireEvent.click(copyButton);
      });

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
      });
    });
  });

  describe('Example Loading', () => {
    it('loads plugin example', async () => {
      render(<PluginManifestValidator />);

      const exampleButton = screen.getByTestId('example-button');
      
      await act(async () => {
        fireEvent.click(exampleButton);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue(/example-plugin/)).toBeInTheDocument();
      });
    });

    it('loads marketplace example', async () => {
      render(<PluginManifestValidator />);

      // Switch to marketplace tab
      const marketplaceTab = screen.getByTestId('tab-marketplace');
      await act(async () => {
        fireEvent.click(marketplaceTab);
      });

      const exampleButton = screen.getByTestId('example-button');
      
      await act(async () => {
        fireEvent.click(exampleButton);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue(/example-marketplace/)).toBeInTheDocument();
      });
    });
  });

  describe('Clear Functionality', () => {
    it('clears the content', async () => {
      const initialContent = JSON.stringify(validPluginManifest, null, 2);
      render(<PluginManifestValidator initialContent={initialContent} />);

      const clearButton = screen.getByText('Clear');
      
      await act(async () => {
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        expect(screen.queryByDisplayValue(/test-plugin/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Format JSON', () => {
    it('formats JSON when button is clicked', async () => {
      render(<PluginManifestValidator />);

      const textarea = screen.getByTestId('json-textarea');
      
      // Enter minified JSON
      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: '{"name":"test","version":"1.0.0","description":"Test"}' },
        });
      });

      const formatButton = screen.getByTestId('format-button');
      
      await act(async () => {
        fireEvent.click(formatButton);
      });

      // Should be formatted with indentation
      await waitFor(() => {
        const value = (textarea as HTMLTextAreaElement).value;
        expect(value).toContain('\n');
        expect(value).toContain('  ');
      });
    });

    it('disables format button when content is empty', () => {
      render(<PluginManifestValidator />);

      const formatButton = screen.getByTestId('format-button');
      expect(formatButton).toBeDisabled();
    });
  });

  describe('Drag and Drop', () => {
    it('handles drag over state', async () => {
      render(<PluginManifestValidator />);

      const dropZone = screen.getByTestId('drop-zone');
      
      await act(async () => {
        fireEvent.dragOver(dropZone);
      });

      // Check that the drop zone styling changes
      expect(dropZone).toHaveStyle({ cursor: 'pointer' });
    });
  });

  describe('Validation Callback', () => {
    it('calls onValidationChange with validation results', async () => {
      const onValidationChange = vi.fn();
      
      render(<PluginManifestValidator onValidationChange={onValidationChange} />);

      const textarea = screen.getByTestId('json-textarea');
      
      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: JSON.stringify(validPluginManifest, null, 2) },
        });
      });

      await waitFor(() => {
        expect(onValidationChange).toHaveBeenCalled();
      });

      const lastCall = onValidationChange.mock.calls[onValidationChange.mock.calls.length - 1][0];
      expect(lastCall).toBeTruthy();
      expect(lastCall.valid).toBe(true);
    });

    it('calls onValidationChange with null when content is cleared', async () => {
      const onValidationChange = vi.fn();
      const initialContent = JSON.stringify(validPluginManifest, null, 2);
      
      render(<PluginManifestValidator initialContent={initialContent} onValidationChange={onValidationChange} />);

      // Wait for initial validation
      await waitFor(() => {
        expect(onValidationChange).toHaveBeenCalled();
      });

      // Clear the content
      const clearButton = screen.getByText('Clear');
      await act(async () => {
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        const lastCall = onValidationChange.mock.calls[onValidationChange.mock.calls.length - 1][0];
        expect(lastCall).toBeNull();
      });
    });
  });
});
