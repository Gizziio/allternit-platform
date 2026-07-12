import { describe, expect, it } from 'vitest';
import { formatSemanticNodes } from '../playwright/snapshot.js';

describe('semantic browser snapshots', () => {
  const nodes = [
    { role: 'main', name: 'Checkout', selector: 'main', depth: 0, interactive: false },
    { role: 'textbox', name: 'Email', selector: '#email', depth: 1, interactive: true },
    { role: 'button', name: 'Pay now', selector: '[data-testid="pay"]', depth: 1, interactive: true },
  ];

  it('creates deterministic refs that resolve to selectors', () => {
    const result = formatSemanticNodes(nodes);
    expect(result.snapshot).toContain('[textbox] Email [ref=e2]');
    expect(result.refs.e2).toBe('#email');
    expect(result.refs.e3).toBe('[data-testid="pay"]');
  });

  it('can focus the observation on interactive nodes', () => {
    const result = formatSemanticNodes(nodes, { interactive: true, compact: true });
    expect(result.snapshot).not.toContain('[main]');
    expect(result.snapshot).toContain('[textbox] Email [ref=e1]');
    expect(result.refs.e2).toBe('[data-testid="pay"]');
  });

  it('does not emit refs for nodes without resolvable selectors', () => {
    const result = formatSemanticNodes([
      { role: 'generic', name: 'Broken root', selector: '', depth: 0, interactive: false },
      { role: 'link', name: 'Learn more', selector: 'a', depth: 1, interactive: true },
    ]);

    expect(result.snapshot).toContain('[generic] Broken root');
    expect(result.snapshot).not.toContain('[generic] Broken root [ref=');
    expect(result.snapshot).toContain('[link] Learn more [ref=e2]');
    expect(result.refs).toEqual({ e2: 'a' });
  });
});
