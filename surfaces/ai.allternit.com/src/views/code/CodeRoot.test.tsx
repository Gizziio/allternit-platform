import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./CodeSurfaceRouter', () => ({
  CodeSurfaceRouter: () => (
    <div data-testid="code-root">
      <div data-testid="code-pane-canvas">
        <div data-testid="mock-code-canvas" />
      </div>
      <div data-testid="code-pane-preview">
        <div data-testid="mock-code-preview-pane" />
      </div>
    </div>
  ),
}));

import { CodeRoot } from './CodeRoot';

describe('CodeRoot', () => {
  it('renders the code surface router as the workspace root', () => {
    render(<CodeRoot />);

    expect(screen.getByTestId('code-root')).toBeInTheDocument();
    expect(screen.getByTestId('code-pane-canvas')).toContainElement(
      screen.getByTestId('mock-code-canvas'),
    );
    expect(screen.getByTestId('code-pane-preview')).toContainElement(
      screen.getByTestId('mock-code-preview-pane'),
    );
  });
});
