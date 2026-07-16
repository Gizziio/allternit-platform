import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeDiffPanel } from './CodeDiffPanel';

const SAMPLE_DIFF = `diff --git a/src/App.tsx b/src/App.tsx
@@ -1,3 +1,3 @@
 export default function App() {
-  return <div>old</div>;
+  return <div>new</div>;
 }`;

describe('CodeDiffPanel', () => {
  it('renders the diff review panel', () => {
    render(<CodeDiffPanel />);

    expect(screen.getByTestId('code-diff-panel')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste unified diff here…')).toBeInTheDocument();
  });

  it('renders pasted unified diff content', () => {
    render(<CodeDiffPanel />);

    const input = screen.getByPlaceholderText('Paste unified diff here…');
    fireEvent.change(input, { target: { value: SAMPLE_DIFF } });

    expect(screen.getByText('src/App.tsx')).toBeInTheDocument();
    expect(document.querySelector('.code-diff-line-deletion')).toBeInTheDocument();
    expect(document.querySelector('.code-diff-line-addition')).toBeInTheDocument();
  });
});
