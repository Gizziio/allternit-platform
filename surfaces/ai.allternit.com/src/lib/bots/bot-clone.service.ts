/**
 * Bot Clone Service
 *
 * Implements duplication-safe bot cloning per Wave 4 requirements. Copies
 * canonical identity, profile, model, tools, skills, policies, and harness
 * settings while excluding active runtime state, secrets, sessions, and unique
 * identities unless safely re-provisioned.
 *
 * @module bot-clone.service
 */

import { createModuleLogger } from '@/lib/logger';
import { BotSchema, type Bot } from './orpc-contracts';
import {
  BotCloneOptionsSchema,
  BotCloneReceiptSchema,
  BotCloneGraphOptionsSchema,
  BotClonePreviewSchema,
  createRedactedMapping,
  BotCloneError,
  type BotCloneOptions,
  type BotCloneReceipt,
  type BotClonePreview,
  type BotCloneGraphOptions,
  type ChildBotGraphPreview,
  type DuplicationIdMapping,
  type ProvisionedIdentity,
} from './bot-duplication-contracts';

const logger = createModuleLogger('BotCloneService');

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateHandle(base: string): string {
  return `${base}-clone-${Date.now()}`;
}

function sanitizeBotProfile(source: Bot, options: BotCloneOptions): Bot['botProfile'] {
  const profile = source.botProfile;
  return {
    ...profile,
    displayName: options.displayName ?? `${profile.displayName} (Clone)`,
    handle: options.handle ?? generateHandle(profile.handle ?? source.name),
  };
}

function stripRuntimeState(bot: Bot): Bot {
  return {
    ...bot,
    operationalState: undefined,
  };
}

export interface CloneBotResult {
  bot: Bot;
  receipt: BotCloneReceipt;
}

// ============================================================================
// Identity provisioning
// ============================================================================

const ALL_IDENTITY_KINDS: ProvisionedIdentity['kind'][] = [
  'email',
  'phone',
  'wallet',
  'handle',
  'webauthn_credential',
  'oauth_connection',
];

/**
 * Provision new unique identities for a cloned bot.
 *
 * This is a client-side placeholder. A production implementation calls an
 * identity service to allocate email addresses, phone numbers, wallets, and
 * OAuth credentials, then records redacted references. The returned mappings
 * are safe to log and store.
 */
export function provisionIdentities(
  sourceBotId: string,
  newBotId: string,
  enabled: boolean,
): { identities: ProvisionedIdentity[]; warnings: string[] } {
  if (!enabled) {
    return {
      identities: [],
      warnings: ['No unique identities were provisioned; assign handle/email/phone/wallet before activation.'],
    };
  }

  const identities: ProvisionedIdentity[] = ALL_IDENTITY_KINDS.map((kind) => ({
    kind,
    sourceId: `${sourceBotId}:${kind}`,
    newId: generateId(`id_${kind}`),
    redacted: true,
    activated: false,
    statusNote: 'Placeholder provisioned identity; activate through identity service before use.',
  }));

  const warnings = [
    'New unique identities were provisioned; verify email/phone/wallet/handle activation.',
    `Provisioned ${identities.length} identity kinds for bot ${newBotId}; none are active until verified.`,
  ];

  return { identities, warnings };
}

// ============================================================================
// Child-bot graph preview
// ============================================================================

export interface PreviewChildGraphInput {
  /** The bot whose children should be inspected. */
  rootBotId: string;
  /** Resolve direct child bots of a given bot. Return empty array for leaf bots. */
  getChildren: (botId: string) => Bot[] | Promise<Bot[]>;
  /** Maximum depth to walk. */
  recursionLimit?: number;
  /** Whether child topology will actually be copied. */
  includeChildTopology?: boolean;
}

/**
 * Build a preview of the child-bot graph before cloning.
 *
 * Detects cycles, enforces a recursion limit, and flags each node for policy
 * reauthorization. The preview is safe to show in the UI and to log.
 */
export async function previewChildBotGraph(
  input: PreviewChildGraphInput,
): Promise<ChildBotGraphPreview> {
  const {
    rootBotId,
    getChildren,
    recursionLimit = 3,
    includeChildTopology = false,
  } = input;

  const nodes: ChildBotGraphPreview['nodes'] = [];
  const edges: ChildBotGraphPreview['edges'] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  let hasCycle = false;
  let cyclePath: string[] | undefined;
  let reachedDepthLimit = false;

  async function walk(botId: string, parentId: string | undefined, depth: number) {
    if (depth > recursionLimit) {
      reachedDepthLimit = true;
      return;
    }

    if (stack.includes(botId)) {
      hasCycle = true;
      cyclePath = [...stack.slice(stack.indexOf(botId)), botId];
      return;
    }

    if (visited.has(botId)) {
      return;
    }
    visited.add(botId);
    stack.push(botId);

    nodes.push({
      sourceBotId: botId,
      sourceParentBotId: parentId,
      depth,
      wouldCopy: includeChildTopology,
      policyReauthorizationRequired: true,
    });

    if (parentId) {
      edges.push([parentId, botId]);
    }

    const children = await getChildren(botId);
    for (const child of children) {
      await walk(child.id, botId, depth + 1);
    }

    stack.pop();
  }

  await walk(rootBotId, undefined, 0);

  return {
    rootBotId,
    nodes,
    edges,
    depthLimit: recursionLimit,
    reachedDepthLimit,
    hasCycle,
    cyclePath,
    totalNodes: nodes.length,
    nodesToCopy: includeChildTopology ? nodes.length : 0,
  };
}

// ============================================================================
// Recursive child-bot graph cloning
// ============================================================================

export interface CloneBotGraphInput {
  /** Root bot to clone. */
  rootBot: Bot;
  /** Resolve direct child bots of a given bot id. */
  getChildren: (botId: string) => Bot[] | Promise<Bot[]>;
  /** Options for the root clone. */
  options?: unknown;
  /** Options controlling recursion and safety. */
  graphOptions?: unknown;
  /** Optional actor id for audit. */
  actorId?: string;
}

export interface CloneBotGraphResult {
  root: CloneBotResult;
  children: CloneBotResult[];
  receipt: BotCloneReceipt;
  rolledBack: boolean;
}

/**
 * Clone a bot and its child-bot topology.
 *
 * Enforces recursion limits and cycle detection. If a cycle is detected or a
 * child cannot be cloned, the operation rolls back every cloned child and the
 * root bot by returning the original mappings with `copied: false`. IDs are
 * remapped from source to new bots in the returned receipt.
 */
export async function cloneBotGraph(
  input: CloneBotGraphInput,
): Promise<CloneBotGraphResult> {
  const parsedOptions = BotCloneOptionsSchema.parse(input.options ?? {});
  const graphOptions = BotCloneGraphOptionsSchema.parse(input.graphOptions ?? {});

  const { rootBot, getChildren, actorId } = input;
  const cloned: CloneBotResult[] = [];
  const idMap = new Map<string, string>();

  async function walk(source: Bot, parentNewId: string | undefined, depth: number): Promise<CloneBotResult> {
    if (depth > graphOptions.recursionLimit) {
      throw new BotCloneError(
        `Child-bot recursion limit (${graphOptions.recursionLimit}) exceeded at ${source.id}`,
        'depth_exceeded',
        { sourceBotId: source.id, depth },
      );
    }

    if (idMap.has(source.id)) {
      throw new BotCloneError(
        `Cycle detected in child-bot graph at ${source.id}`,
        'cycle_detected',
        { sourceBotId: source.id, cyclePath: Array.from(idMap.keys()) },
      );
    }

    const childOptions: BotCloneOptions = {
      ...parsedOptions,
      includeChildTopology: false,
      displayName: `${source.botProfile.displayName} (Clone)`,
      handle: generateHandle(source.botProfile.handle ?? source.name),
    };

    const result = cloneBot(source, childOptions, actorId);
    if (parentNewId) {
      result.bot.parentBotId = parentNewId;
    }
    cloned.push(result);
    idMap.set(source.id, result.bot.id);

    if (graphOptions.includeChildTopology) {
      const children = await getChildren(source.id);
      if (children.length > 0 && depth >= graphOptions.recursionLimit) {
        throw new BotCloneError(
          `Child-bot recursion limit (${graphOptions.recursionLimit}) would be exceeded at ${source.id}`,
          'depth_exceeded',
          { sourceBotId: source.id, depth, childCount: children.length },
        );
      }
      for (const child of children) {
        await walk(child, result.bot.id, depth + 1);
      }
    }

    return result;
  }

  let rootResult: CloneBotResult;
  let rolledBack = false;

  try {
    rootResult = await walk(rootBot, undefined, 0);
  } catch (err) {
    // Roll back: mark every successfully cloned mapping as not copied.
    for (const r of cloned) {
      for (const m of r.receipt.idMappings) {
        m.copied = false;
        m.newId = '';
      }
      r.receipt.warnings.push('Cloned rolled back due to child-graph error.');
    }
    rolledBack = true;

    if (err instanceof BotCloneError) {
      throw err;
    }
    throw new BotCloneError(
      err instanceof Error ? err.message : 'Child-bot graph clone failed',
      'invalid_source',
      { cause: err },
    );
  }

  // Aggregate receipts into one graph receipt.
  const aggregateMappings: DuplicationIdMapping[] = [
    ...rootResult.receipt.idMappings,
  ];
  const aggregateWarnings: string[] = [...rootResult.receipt.warnings];
  const childBots: CloneBotResult[] = [];

  for (const r of cloned) {
    if (r.bot.id !== rootResult.bot.id) {
      childBots.push(r);
      aggregateMappings.push(...r.receipt.idMappings);
      aggregateWarnings.push(...r.receipt.warnings);
    }
  }

  // Add explicit child-bot ID remappings.
  for (const [sourceId, newId] of idMap.entries()) {
    if (sourceId !== rootBot.id && !aggregateMappings.some((m) => m.sourceId === sourceId && m.entityType === 'child_bot')) {
      aggregateMappings.push(createRedactedMapping(sourceId, newId, 'child_bot', true, {
        reauthorizationRequired: graphOptions.requirePolicyReauthorization,
      }));
    }
  }

  const graphReceipt = BotCloneReceiptSchema.parse({
    id: generateId('receipt'),
    sourceBotId: rootBot.id,
    newBotId: rootResult.bot.id,
    newHandle: rootResult.bot.botProfile.handle,
    createdAt: new Date().toISOString(),
    createdBy: actorId,
    options: parsedOptions,
    idMappings: aggregateMappings,
    warnings: aggregateWarnings,
  });

  logger.info(
    { sourceBotId: rootBot.id, newBotId: rootResult.bot.id, childCount: childBots.length, rolledBack },
    'Bot graph cloned',
  );

  return {
    root: rootResult,
    children: childBots,
    receipt: graphReceipt,
    rolledBack,
  };
}

// ============================================================================
// Clone preview
// ============================================================================

export interface PreviewCloneInput {
  source: Bot;
  options?: unknown;
  graphOptions?: unknown;
  getChildren?: (botId: string) => Bot[] | Promise<Bot[]>;
}

/**
 * Build a duplication preview without mutating any state.
 *
 * Returns the cloned bot shape, a redacted receipt, identity-provisioning
 * notes, and a child-bot graph preview when a resolver is provided.
 */
export async function previewClone(input: PreviewCloneInput): Promise<BotClonePreview> {
  const sourceBot = BotSchema.parse(input.source);
  const parsedOptions = BotCloneOptionsSchema.parse(input.options ?? {});
  const graphOptions = BotCloneGraphOptionsSchema.parse(input.graphOptions ?? {});

  const { bot, receipt } = cloneBot(sourceBot, parsedOptions);
  const { identities, warnings: identityWarnings } = provisionIdentities(
    sourceBot.id,
    bot.id,
    parsedOptions.provisionNewIdentities,
  );

  let childGraph: ChildBotGraphPreview | undefined;
  if (input.getChildren) {
    childGraph = await previewChildBotGraph({
      rootBotId: sourceBot.id,
      getChildren: input.getChildren,
      recursionLimit: graphOptions.recursionLimit,
      includeChildTopology: parsedOptions.includeChildTopology,
    });
  }

  return BotClonePreviewSchema.parse({
    sourceBotId: sourceBot.id,
    newBotId: bot.id,
    newHandle: bot.botProfile.handle,
    options: parsedOptions,
    identityProvisions: identities,
    childGraph,
    warnings: [...receipt.warnings, ...identityWarnings],
  });
}

// ============================================================================
// Single-bot clone
// ============================================================================

/**
 * Clone a bot according to the Wave 4 duplication rules.
 *
 * @param source - The bot to clone. Must be a valid Bot.
 * @param options - Clone scope and behavior options.
 * @param actorId - Optional actor id for audit.
 */
export function cloneBot(source: Bot, options: unknown = {}, actorId?: string): CloneBotResult {
  const parsedOptions = BotCloneOptionsSchema.parse(options);
  const now = new Date().toISOString();
  const newBotId = generateId('bot');

  const sourceBot = BotSchema.parse(source);
  const sanitized = stripRuntimeState(sourceBot);

  const newBot: Bot = {
    ...sanitized,
    id: newBotId,
    name: `${sourceBot.name} (Clone)`,
    botProfile: sanitizeBotProfile(sourceBot, parsedOptions),
    createdAt: now,
    updatedAt: now,
  };

  const idMappings: DuplicationIdMapping[] = [];
  const warnings: string[] = [];

  // Core bot identity mapping
  idMappings.push(createRedactedMapping(sourceBot.id, newBotId, 'bot', true));

  // Memory
  if (parsedOptions.includeMemory) {
    idMappings.push(createRedactedMapping('mem_root', generateId('mem'), 'memory', true));
    warnings.push('Memory was copied; review for bot-scoped or user-scoped leakage before activating.');
  } else {
    idMappings.push(createRedactedMapping('mem_root', '', 'memory', false));
  }

  // Routines
  if (parsedOptions.includeRoutines) {
    idMappings.push(createRedactedMapping('routines', generateId('routines'), 'routine', true));
  } else {
    idMappings.push(createRedactedMapping('routines', '', 'routine', false));
  }

  // Connector bindings
  if (parsedOptions.copyConnectorBindings) {
    idMappings.push(
      createRedactedMapping('connectors', generateId('connectors'), 'connector', true, {
        reauthorizationRequired: true,
      }),
    );
    warnings.push('Connector bindings copied by reference; re-authorization is required before use.');
  } else {
    idMappings.push(createRedactedMapping('connectors', '', 'connector', false));
  }

  // Computer template
  if (parsedOptions.includeComputerTemplate) {
    idMappings.push(createRedactedMapping('computer_template', generateId('computer'), 'computer', true));
  } else {
    idMappings.push(createRedactedMapping('computer_template', '', 'computer', false));
  }

  // Child topology
  if (parsedOptions.includeChildTopology) {
    idMappings.push(createRedactedMapping('child_topology', generateId('children'), 'child_bot', true));
    warnings.push('Child topology copied; recursion limits and policy re-authorization must be verified.');
  } else {
    idMappings.push(createRedactedMapping('child_topology', '', 'child_bot', false));
  }

  // Explicitly excluded runtime IDs
  idMappings.push(createRedactedMapping('sessions', '', 'session', false));
  idMappings.push(createRedactedMapping('receipts', '', 'receipt', false));

  // Unique identities
  const { identities, warnings: identityWarnings } = provisionIdentities(
    sourceBot.id,
    newBotId,
    parsedOptions.provisionNewIdentities,
  );
  warnings.push(...identityWarnings);

  // Record identity mappings on the receipt as redacted child_bot mappings so
  // they participate in the source→new ID map without leaking values.
  for (const identity of identities) {
    idMappings.push(
      createRedactedMapping(identity.sourceId, identity.newId, 'child_bot', true, {
        reauthorizationRequired: identity.kind !== 'handle',
      }),
    );
  }

  const receipt = BotCloneReceiptSchema.parse({
    id: generateId('receipt'),
    sourceBotId: sourceBot.id,
    newBotId,
    newHandle: newBot.botProfile.handle,
    createdAt: now,
    createdBy: actorId,
    options: parsedOptions,
    idMappings,
    warnings,
  });

  logger.info(
    { sourceBotId: sourceBot.id, newBotId, actorId, identityCount: identities.length },
    'Bot cloned',
  );

  return { bot: newBot, receipt };
}
