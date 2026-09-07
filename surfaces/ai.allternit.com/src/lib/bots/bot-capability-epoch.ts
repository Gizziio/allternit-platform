/**
 * Bot Capability Epoch (spec AD-4)
 *
 * A stable 12-hex-character fingerprint of a bot's whole capability surface:
 * starter prompts, description/tagline, system-prompt presence, allowed
 * skills/tools, connector bindings, secret-ref key names, and the roster's
 * bot names+handles. The epoch is stamped into the canonical chat's system
 * prompt (`Capability epoch: <hash>`) and session metadata; when a stored
 * session's epoch drifts from the freshly computed one, the identity
 * injection is rebuilt once (persona/skill edits are never stranded).
 *
 * Hashing is plain FNV-1a over canonical JSON — deterministic, no crypto.
 *
 * @module bot-capability-epoch
 */

import type { Agent } from '../agents/agent.types';

/** A minimal roster shape: bot names and handles only. */
export interface CapabilityRosterEntry {
  name: string;
  handle: string;
}

function sorted(values: Array<string | undefined>): string[] {
  return values.filter((v): v is string => typeof v === 'string').sort();
}

/**
 * FNV-1a 32-bit hash of a string, as 8 hex chars.
 */
function fnv1a(input: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Exported 8-hex FNV-1a digest, reused by monitor-mode output hashing. */
export function fnv1aHex(input: string): string {
  return fnv1a(input).toString(16).padStart(8, '0');
}

function toHex(value: number, width: number): string {
  return value.toString(16).padStart(width, '0');
}

/**
 * Compute the capability epoch for a bot against the current roster.
 * Same bot + same roster → same hash; any capability-surface edit drifts it.
 */
export function computeCapabilityEpoch(
  agent: Agent,
  roster: CapabilityRosterEntry[],
): string {
  const profile = agent.botProfile;
  const fingerprint = {
    starterPrompts: sorted(profile?.starterPrompts ?? []),
    description: agent.description ?? '',
    tagline: profile?.tagline ?? '',
    hasSystemPrompt: Boolean(agent.systemPrompt && agent.systemPrompt.trim()),
    allowedSkills: sorted(agent.allowedSkills ?? []),
    allowedTools: sorted(agent.allowedTools ?? []),
    connectorBindingIds: sorted(
      (agent.connectorBindings ?? []).map((b) => b.connectorId),
    ),
    secretRefKeys: sorted((agent.secretRefs ?? []).map((r) => r.key ?? r.name)),
    roster: roster
      .map((b) => `${b.name}@${b.handle}`)
      .sort(),
  };
  const json = JSON.stringify(fingerprint);
  // 48 bits: two differently-seeded FNV passes concatenated (8 + 4 hex).
  return toHex(fnv1a(json), 8) + toHex(fnv1a(`${json}\n:epoch2`, 0x01000193), 8).slice(0, 4);
}

/**
 * Format the identity-clause line stamped into the bot's system prompt.
 */
export function capabilityEpochLine(epoch: string): string {
  return `Capability epoch: ${epoch}`;
}

/**
 * Rebuild gate (rebuild-once-per-drift): true when the stored epoch is
 * absent or differs from the freshly computed one. A session whose stored
 * epoch matches is left untouched, so drift triggers exactly one rebuild —
 * the updated metadata carries the new epoch and the next compare is a no-op.
 */
export function hasEpochDrifted(storedEpoch: unknown, computedEpoch: string): boolean {
  return storedEpoch !== computedEpoch;
}
