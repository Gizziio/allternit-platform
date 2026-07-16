import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./ExplorerView', () => ({ ExplorerView: () => <div>Files panel</div> }));
vi.mock('./CodeDiffPanel', () => ({ CodeDiffPanel: () => <div>Diff panel</div> }));
vi.mock('./CodeFileEditor', () => ({ CodeFileEditor: () => <div>File editor</div> }));
vi.mock('./CodeAciPane', () => ({ CodeAciPane: () => <div>ACI panel</div> }));
vi.mock('./CodeTranscriptPane', () => ({ CodeTranscriptPane: () => <div>Transcript panel</div> }));
vi.mock('@/components/workspace/UnifiedTerminal', () => ({
  UnifiedTerminal: () => <div>Terminal panel</div>,
}));

import { CodeSessionSidePane } from './CodeSessionSidePane';

describe('CodeSessionSidePane', () => {
  it('renders the selected pane and exposes one close action', () => {
    const onClose = vi.fn();

    render(<CodeSessionSidePane activeTab="terminal" onClose={onClose} />);

    expect(screen.getByText('Terminal panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close workspace panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the transcript pane when selected', () => {
    render(<CodeSessionSidePane activeTab="transcript" />);
    expect(screen.getByText('Transcript panel')).toBeInTheDocument();
  });
});
