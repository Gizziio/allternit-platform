/**
 * Bot Runtime Environment Builder
 *
 * Combines an agent's harness configuration, resolved vault secrets, and
 * resolved connector credentials into a single env/config map that the
 * runtime can inject when a bot session executes.
 *
 * This keeps secret material out of the agent record; values are only
 * resolved at session start and passed through session metadata.
 */

import type { HarnessConfig, AgentVMOperatorConfig, CharacterLayerConfig } from '@/lib/agents/agent.types';
import type { ResolvedSecret } from '@/lib/agents/agent-secrets-resolver';
import type { ResolvedConnectorCredential } from '@/lib/agents/agent-connectors-resolver';

export interface BotRuntimeEnvInput {
  harness?: HarnessConfig;
  resolvedSecrets?: ResolvedSecret[];
  resolvedConnectors?: ResolvedConnectorCredential[];
  vmOperator?: AgentVMOperatorConfig;
  agentId?: string;
  characterLayer?: CharacterLayerConfig;
}

export interface BotRuntimeEnv {
  env: Record<string, string>;
  config: Record<string, unknown>;
}

function harnessToEnv(harness?: HarnessConfig): Record<string, string> {
  const env: Record<string, string> = {};
  if (!harness) return env;

  if (harness.mode === 'byok' && harness.byok) {
    if (harness.byok.anthropic?.apiKey) {
      env.ANTHROPIC_API_KEY = harness.byok.anthropic.apiKey;
      if (harness.byok.anthropic.baseURL) env.ANTHROPIC_BASE_URL = harness.byok.anthropic.baseURL;
    }
    if (harness.byok.openai?.apiKey) {
      env.OPENAI_API_KEY = harness.byok.openai.apiKey;
      if (harness.byok.openai.baseURL) env.OPENAI_BASE_URL = harness.byok.openai.baseURL;
    }
    if (harness.byok.google?.apiKey) {
      env.GOOGLE_API_KEY = harness.byok.google.apiKey;
      if (harness.byok.google.baseURL) env.GOOGLE_BASE_URL = harness.byok.google.baseURL;
    }
  }

  if (harness.mode === 'cloud' && harness.cloud) {
    env.ALLTERNIT_CLOUD_BASE_URL = harness.cloud.baseURL;
    env.ALLTERNIT_CLOUD_ACCESS_TOKEN = harness.cloud.accessToken;
    if (harness.cloud.refreshToken) env.ALLTERNIT_CLOUD_REFRESH_TOKEN = harness.cloud.refreshToken;
  }

  if (harness.mode === 'subprocess' && harness.subprocess?.env) {
    Object.assign(env, harness.subprocess.env);
  }

  return env;
}

function secretsToEnv(secrets?: ResolvedSecret[]): Record<string, string> {
  const env: Record<string, string> = {};
  if (!Array.isArray(secrets)) return env;
  for (const s of secrets) {
    if (s.key && s.value !== undefined) {
      env[s.key] = s.value;
    }
  }
  return env;
}

function connectorsToEnv(connectors?: ResolvedConnectorCredential[]): Record<string, string> {
  const env: Record<string, string> = {};
  if (!Array.isArray(connectors)) return env;
  for (const c of connectors) {
    if (c.key && c.value !== undefined) {
      env[c.key] = c.value;
    }
  }
  return env;
}

function vmOperatorToEnv(vmOperator?: AgentVMOperatorConfig): Record<string, string> {
  const env: Record<string, string> = {};
  if (!vmOperator) return env;

  env.ALLTERNIT_VM_OPERATOR_ENABLED = vmOperator.enabled ? 'true' : 'false';
  if (vmOperator.enabled) {
    env.ALLTERNIT_VM_PROVIDER = vmOperator.provider;
    if (vmOperator.image) env.ALLTERNIT_VM_IMAGE = vmOperator.image;
    if (vmOperator.allowedActions?.length) {
      env.ALLTERNIT_VM_ALLOWED_ACTIONS = vmOperator.allowedActions.join(',');
    }
    if (vmOperator.networkPolicy) env.ALLTERNIT_VM_NETWORK_POLICY = vmOperator.networkPolicy;
    if (vmOperator.persistence) env.ALLTERNIT_VM_PERSISTENCE = vmOperator.persistence;
    if (vmOperator.timeoutMinutes) env.ALLTERNIT_VM_TIMEOUT_MINUTES = String(vmOperator.timeoutMinutes);
    if (vmOperator.vncEnabled) env.ALLTERNIT_VM_VNC_ENABLED = 'true';
    if (vmOperator.autoStart) env.ALLTERNIT_VM_AUTO_START = 'true';
    if (vmOperator.resources?.cpu) env.ALLTERNIT_VM_CPU = vmOperator.resources.cpu;
    if (vmOperator.resources?.memory) env.ALLTERNIT_VM_MEMORY = vmOperator.resources.memory;
    if (vmOperator.resources?.disk) env.ALLTERNIT_VM_DISK = vmOperator.resources.disk;
  }
  return env;
}

/**
 * Agent identity + policy env for the runtime. `ALLTERNIT_AGENT_ID` is the
 * default sender identity for agent-email tools; `ALLTERNIT_AGENT_HARD_BANS`
 * carries the character role-card hard bans so gizzi-code can enforce them at
 * tool-dispatch time (e.g. blocking email-send tools for `email_send` bans).
 */
function agentPolicyToEnv(input: BotRuntimeEnvInput): Record<string, string> {
  const env: Record<string, string> = {};
  if (input.agentId) env.ALLTERNIT_AGENT_ID = input.agentId;
  const hardBans = input.characterLayer?.roleCard?.hardBans;
  if (hardBans?.length) env.ALLTERNIT_AGENT_HARD_BANS = JSON.stringify(hardBans);
  return env;
}

/**
 * Build a runtime env/config bundle for a bot session.
 *
 * Priority (later overrides earlier):
 * 1. Harness-level env vars (BYOK keys, cloud tokens, subprocess env)
 * 2. VM operator config
 * 3. Resolved vault secrets
 * 4. Resolved connector credentials
 * 5. Agent identity + policy (highest priority, never secret-derived)
 */
export function buildBotRuntimeEnv(input: BotRuntimeEnvInput): BotRuntimeEnv {
  return {
    env: {
      ...harnessToEnv(input.harness),
      ...vmOperatorToEnv(input.vmOperator),
      ...secretsToEnv(input.resolvedSecrets),
      ...connectorsToEnv(input.resolvedConnectors),
      ...agentPolicyToEnv(input),
    },
    config: {
      vmOperator: input.vmOperator,
    },
  };
}

/**
 * Build a plain env map from a bot runtime env bundle.
 */
export function botRuntimeEnvToEnvMap(runtimeEnv?: BotRuntimeEnv): Record<string, string> {
  return runtimeEnv?.env ?? {};
}
