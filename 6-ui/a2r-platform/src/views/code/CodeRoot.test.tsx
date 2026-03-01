import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-resizable-panels', async () => {
  const React = await import('react');

  return {
    PanelGroup: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="mock-panel-group">{children}</div>
    ),
    Panel: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & {
        defaultSize?: number;
        minSize?: number;
        collapsible?: boolean;
        collapsedSize?: number;
        onCollapse?: () => void;
        onExpand?: () => void;
      }
    >(
      (
        {
          children,
          defaultSize: _defaultSize,
          minSize: _minSize,
          collapsible: _collapsible,
          collapsedSize: _collapsedSize,
          onCollapse: _onCollapse,
          onExpand: _onExpand,
          ...props
        },
        ref,
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      ),
    ),
    PanelResizeHandle: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  };
});

vi.mock('./CodeCanvas', () => ({
  CodeCanvas: () => <div data-testid="mock-code-canvas" />,
}));

vi.mock('./CodePreviewPane', () => ({
  CodePreviewPane: () => <div data-testid="mock-code-preview-pane" />,
}));

import { CodeRoot } from './CodeRoot';

describe('CodeRoot', () => {
  it('renders a two-pane code workspace with a collapsible preview pane', () => {
    render(<CodeRoot />);

    expect(screen.getByTestId('code-root')).toBeInTheDocument();
    expect(screen.getByTestId('code-preview-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('code-pane-canvas')).toContainElement(
      screen.getByTestId('mock-code-canvas'),
    );
    expect(screen.getByTestId('code-pane-preview')).toContainElement(
      screen.getByTestId('mock-code-preview-pane'),
    );
    expect(screen.queryByTestId('code-pane-rail')).not.toBeInTheDocument();
  });
});
