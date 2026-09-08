import { describe, expect, it } from 'vitest';
import {
  isProviderRoutingPin,
  parseOnlyProvidersInput,
  readConfigProviderRoutingPin,
  resolveProviderRoutingWirePin,
  toWireProviderRoutingPin,
} from '../provider-routing';

describe('toWireProviderRoutingPin', () => {
  it('strips the model key and keeps only wire routing keys', () => {
    expect(
      toWireProviderRoutingPin({
        model: 'anthropic/claude-fable-5.1',
        sort: 'price',
        only: ['anthropic', 'google'],
        displayLabel: 'cheapest',
      }),
    ).toEqual({ sort: 'price', only: ['anthropic', 'google'] });
  });

  it('returns undefined when only the model is set', () => {
    expect(toWireProviderRoutingPin({ model: 'claude-fable-5.1' })).toBeUndefined();
  });

  it('returns undefined for empty, null, or non-object pins', () => {
    expect(toWireProviderRoutingPin({})).toBeUndefined();
    expect(toWireProviderRoutingPin(null)).toBeUndefined();
    expect(toWireProviderRoutingPin(undefined)).toBeUndefined();
    expect(toWireProviderRoutingPin('sort:price' as unknown as Record<string, unknown>)).toBeUndefined();
  });

  it('drops empty arrays and blank strings but keeps other valid keys', () => {
    expect(
      toWireProviderRoutingPin({ sort: '', only: [], ignore: ['openai'], require_parameters: { seed: true } }),
    ).toEqual({ ignore: ['openai'], require_parameters: { seed: true } });
  });
});

describe('resolveProviderRoutingWirePin', () => {
  it('prefers the session override over the bot pin', () => {
    expect(
      resolveProviderRoutingWirePin(
        { only: ['anthropic'] },
        { sort: 'latency', model: 'm' },
      ),
    ).toEqual({ only: ['anthropic'] });
  });

  it('falls back to the bot pin when the session has no usable override', () => {
    expect(resolveProviderRoutingWirePin(undefined, { sort: 'latency' })).toEqual({ sort: 'latency' });
    expect(resolveProviderRoutingWirePin(null, { sort: 'latency' })).toEqual({ sort: 'latency' });
    expect(resolveProviderRoutingWirePin('nope', { sort: 'latency' })).toEqual({ sort: 'latency' });
    // A session override that is an object wins even when it has nothing
    // routable — it suppresses inheritance rather than falling through.
    expect(resolveProviderRoutingWirePin({ model: 'x' }, { sort: 'price' })).toBeUndefined();
  });

  it('returns undefined when neither side defines a routable pin', () => {
    expect(resolveProviderRoutingWirePin(undefined, undefined)).toBeUndefined();
    expect(resolveProviderRoutingWirePin({}, {})).toBeUndefined();
  });
});

describe('parseOnlyProvidersInput', () => {
  it('splits, trims, drops empties, and dedupes', () => {
    expect(parseOnlyProvidersInput('anthropic, google,,anthropic,  openai ')).toEqual([
      'anthropic',
      'google',
      'openai',
    ]);
    expect(parseOnlyProvidersInput('')).toEqual([]);
  });
});

describe('isProviderRoutingPin / readConfigProviderRoutingPin', () => {
  it('accepts plain objects only', () => {
    expect(isProviderRoutingPin({ sort: 'price' })).toBe(true);
    expect(isProviderRoutingPin([])).toBe(false);
    expect(isProviderRoutingPin('sort')).toBe(false);
    expect(isProviderRoutingPin(null)).toBe(false);
  });

  it('reads the pin off an agent config bag', () => {
    expect(readConfigProviderRoutingPin({ providerRouting: { sort: 'price' } })).toEqual({ sort: 'price' });
    expect(readConfigProviderRoutingPin({ other: 1 })).toBeUndefined();
    expect(readConfigProviderRoutingPin(null)).toBeUndefined();
    expect(readConfigProviderRoutingPin({ providerRouting: 'bad' })).toBeUndefined();
  });
});
