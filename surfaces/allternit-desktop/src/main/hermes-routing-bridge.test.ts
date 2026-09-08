import { describe, expect, it } from 'vitest';
import { spliceHermesRouting } from './hermes-routing-bridge.js';

const GENERATED = `provider_routing:
  sort: price
  models:
    anthropic/claude-fable-5.1:
      only:
        - anthropic
`;

describe('spliceHermesRouting', () => {
  it('appends the section to an unrelated config', () => {
    const existing = `agent:
  model: claude-fable-5.1
`;
    const merged = spliceHermesRouting(existing, GENERATED);
    expect(merged).toContain('agent:\n  model: claude-fable-5.1');
    expect(merged).toContain('provider_routing:\n  sort: price');
    expect(merged.indexOf('agent:')).toBeLessThan(merged.indexOf('provider_routing:'));
  });

  it('replaces an existing top-level provider_routing block, preserving the rest', () => {
    const existing = `agent:
  model: claude-fable-5.1

provider_routing:
  sort: latency
  only:
    - google

fallback:
  enabled: true
`;
    const merged = spliceHermesRouting(existing, GENERATED);
    expect(merged).toContain('agent:\n  model: claude-fable-5.1');
    expect(merged).toContain('provider_routing:\n  sort: price');
    expect(merged).not.toContain('sort: latency');
    expect(merged).not.toContain('- google');
    expect(merged).toContain('fallback:\n  enabled: true');
  });

  it('leaves an indented (nested) provider_routing key untouched', () => {
    const existing = `auxiliary:
  title_generation:
    provider_routing:
      sort: latency
`;
    const merged = spliceHermesRouting(existing, GENERATED);
    // Nested block survives verbatim…
    expect(merged).toContain('    provider_routing:\n      sort: latency');
    // …and the top-level section is appended.
    expect(merged).toContain('provider_routing:\n  sort: price');
  });

  it('writes a bare section when the existing file is empty', () => {
    expect(spliceHermesRouting('', GENERATED)).toBe(GENERATED);
  });

  it('round-trips: replaced content is itself replaceable', () => {
    const once = spliceHermesRouting('', GENERATED);
    const twice = spliceHermesRouting(once, GENERATED.replace('sort: price', 'sort: latency'));
    expect(twice.match(/provider_routing:/g)).toHaveLength(1);
    expect(twice).toContain('sort: latency');
  });
});
