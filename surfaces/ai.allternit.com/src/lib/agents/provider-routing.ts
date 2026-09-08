/**
 * Provider routing pin helpers (Hermes-style).
 *
 * A "pin" is a per-bot or per-session provider routing preference. It is
 * stored on records as a plain object (agent `config.providerRouting` or
 * session `metadata.providerRouting`) and sent per chat message as a Hermes
 * provider object on the chat POST body. The stored object may carry a
 * `model` id used for editing/display only — the wire object never includes
 * it because model matching is implicit per request.
 *
 * @module provider-routing
 */

/** Keys that make up the Hermes provider object on the wire. */
export const WIRE_ROUTING_KEYS = [
  'sort',
  'only',
  'ignore',
  'order',
  'require_parameters',
  'data_collection',
] as const;

/** A stored routing pin: `{ model?, sort?, only?, ... }` free-form record. */
export type StoredProviderRoutingPin = Record<string, unknown>;

export function isProviderRoutingPin(value: unknown): value is StoredProviderRoutingPin {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Build the Hermes wire object from a stored pin. Only wire routing keys are
 * carried over (never `model`); returns `undefined` when nothing routable is
 * set so callers can omit `providerRouting` from the request entirely.
 */
export function toWireProviderRoutingPin(
  pin: StoredProviderRoutingPin | null | undefined,
): Record<string, unknown> | undefined {
  if (!isProviderRoutingPin(pin)) return undefined;
  const wire: Record<string, unknown> = {};
  for (const key of WIRE_ROUTING_KEYS) {
    const value = pin[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    wire[key] = value;
  }
  return Object.keys(wire).length > 0 ? wire : undefined;
}

/**
 * Resolve the effective wire pin for a send: the session override wins when
 * it is a usable object; otherwise the bot/agent pin is inherited. Returns
 * `undefined` when neither defines anything routable.
 */
export function resolveProviderRoutingWirePin(
  sessionPin: unknown,
  botPin: unknown,
): Record<string, unknown> | undefined {
  const stored = isProviderRoutingPin(sessionPin) ? sessionPin : isProviderRoutingPin(botPin) ? botPin : undefined;
  return toWireProviderRoutingPin(stored);
}

/** Parse a comma-separated "only providers" input into a clean slug list. */
export function parseOnlyProvidersInput(input: string): string[] {
  const seen = new Set<string>();
  for (const part of input.split(',')) {
    const slug = part.trim();
    if (slug) seen.add(slug);
  }
  return [...seen];
}

/** Read a stored pin off an agent `config` bag (never throws on bad shapes). */
export function readConfigProviderRoutingPin(config: unknown): StoredProviderRoutingPin | undefined {
  if (!isProviderRoutingPin(config)) return undefined;
  return isProviderRoutingPin(config.providerRouting) ? config.providerRouting : undefined;
}
