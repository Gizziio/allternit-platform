import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeSessionLauncher } from './CodeSessionLauncher';

describe('CodeSessionLauncher', () => {
  it('opens the three panes and exposes the session actions menu', () => {
    const onOpenPane = vi.fn();
    const callbacks = {
      onRename: vi.fn(),
      onFork: vi.fn(), onArchive: vi.fn(), onDelete: vi.fn(), onOpenIn: vi.fn(),
    };
    render(<CodeSessionLauncher onOpenPane={onOpenPane} {...callbacks} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open diff' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open ACI' }));
    expect(onOpenPane.mock.calls).toEqual([['terminal'], ['diff'], ['aci']]);

    fireEvent.click(screen.getByRole('button', { name: 'Session actions' }));
    expect(screen.getByRole('button', { name: 'Artifacts library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Transcript view' }));
    expect(onOpenPane).toHaveBeenLastCalledWith('transcript');
  });
});
