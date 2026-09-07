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

import { useDrawerStore } from '@/drawers/drawer.store';
import { useTerminalWorkspaceStore } from '@/stores/terminal-workspace.store';
import { CodeSessionSidePane } from './CodeSessionSidePane';

describe('CodeSessionSidePane', () => {
  it('renders the selected pane and exposes one close action', () => {
    const onClose = vi.fn();

    render(<CodeSessionSidePane activeTab="terminal" onClose={onClose} />);

    expect(screen.getByText('Terminal panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close workspace panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the console drawer terminal tab and tags a workspace tile', () => {
    useDrawerStore.getState().closeDrawer('console');
    useTerminalWorkspaceStore.setState({ tiles: [], focusedTileId: null, filterTag: null });

    render(
      <CodeSessionSidePane activeTab="terminal" sessionId="sess-1" workingDir="/repo" />,
    );

    fireEvent.click(screen.getByTestId('code-side-pane-send-to-workspace'));

    const drawer = useDrawerStore.getState().drawers.console;
    expect(drawer.open).toBe(true);
    expect(drawer.activeTab).toBe('terminal');

    const tiles = useTerminalWorkspaceStore.getState().tiles;
    expect(tiles).toHaveLength(1);
    expect(tiles[0].sourceTag?.sessionId).toBe('sess-1');
    expect(tiles[0].cwd).toBe('/repo');
  });

  it('renders the transcript pane when selected', () => {
    render(<CodeSessionSidePane activeTab="transcript" />);
    expect(screen.getByText('Transcript panel')).toBeInTheDocument();
  });
});
