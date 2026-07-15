import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const readFile = vi.fn();
const writeFile = vi.fn();

vi.mock('@/lib/agents/files-api', () => ({
  filesApi: {
    readFile: (...args: unknown[]) => readFile(...args),
    writeFile: (...args: unknown[]) => writeFile(...args),
  },
}));

import { CodeFileEditor } from './CodeFileEditor';

describe('CodeFileEditor', () => {
  beforeEach(() => {
    readFile.mockReset();
    writeFile.mockReset();
  });

  it('loads and displays the selected file', async () => {
    readFile.mockResolvedValue({ path: 'src/App.tsx', content: 'export default function App() {}', totalLines: 1, offset: 0, limit: 1000 });

    render(<CodeFileEditor filePath="src/App.tsx" onClose={() => {}} />);

    expect(await screen.findByTestId('code-file-editor-path')).toHaveTextContent('src/App.tsx');
    expect(screen.getByTestId('code-file-editor-textarea')).toHaveValue('export default function App() {}');
  });

  it('saves the file when Save is clicked', async () => {
    readFile.mockResolvedValue({ path: 'src/App.tsx', content: 'initial', totalLines: 1, offset: 0, limit: 1000 });
    writeFile.mockResolvedValue({ path: 'src/App.tsx', bytesWritten: 7, operation: 'write' });

    render(<CodeFileEditor filePath="src/App.tsx" onClose={() => {}} />);

    const textarea = await screen.findByTestId('code-file-editor-textarea');
    fireEvent.change(textarea, { target: { value: 'updated' } });

    fireEvent.click(screen.getByTestId('code-file-editor-save'));

    await waitFor(() => {
      expect(writeFile).toHaveBeenCalledWith({ path: 'src/App.tsx', content: 'updated' });
    });
  });

  it('calls onClose when the back button is clicked', async () => {
    readFile.mockResolvedValue({ path: 'src/App.tsx', content: 'initial', totalLines: 1, offset: 0, limit: 1000 });
    const onClose = vi.fn();

    render(<CodeFileEditor filePath="src/App.tsx" onClose={onClose} />);

    fireEvent.click(await screen.findByTestId('code-file-editor-back'));

    expect(onClose).toHaveBeenCalled();
  });
});
