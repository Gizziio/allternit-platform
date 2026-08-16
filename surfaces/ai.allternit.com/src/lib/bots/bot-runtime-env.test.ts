import { describe, it, expect } from 'vitest';
import { buildBotRuntimeEnv, botRuntimeEnvToEnvMap } from './bot-runtime-env';
import type { HarnessConfig } from '@/lib/agents/agent.types';
import type { ResolvedSecret } from '@/lib/agents/agent-secrets-resolver';
import type { ResolvedConnectorCredential } from '@/lib/agents/agent-connectors-resolver';

describe('buildBotRuntimeEnv', () => {
  it('merges BYOK harness keys, secrets, and connector credentials', () => {
    const harness: HarnessConfig = {
      mode: 'byok',
      byok: {
        anthropic: { apiKey: 'ak-ant-xxx', baseURL: 'https://api.anthropic.com' },
        openai: { apiKey: 'sk-xxx' },
      },
    };
    const resolvedSecrets: ResolvedSecret[] = [
      { key: 'STRIPE_API_KEY', value: 'sk_stripe', source: 'vault' },
    ];
    const resolvedConnectors: ResolvedConnectorCredential[] = [
      { connectorId: 'slack-1', provider: 'slack', key: 'SLACK_TOKEN', value: 'xoxb-123', source: 'connector' },
    ];

    const result = buildBotRuntimeEnv({ harness, resolvedSecrets, resolvedConnectors });

    expect(result.env).toEqual({
      ANTHROPIC_API_KEY: 'ak-ant-xxx',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      OPENAI_API_KEY: 'sk-xxx',
      STRIPE_API_KEY: 'sk_stripe',
      SLACK_TOKEN: 'xoxb-123',
    });
  });

  it('connector credentials override secrets with the same key', () => {
    const resolvedSecrets: ResolvedSecret[] = [
      { key: 'SLACK_TOKEN', value: 'from-secret', source: 'vault' },
    ];
    const resolvedConnectors: ResolvedConnectorCredential[] = [
      { connectorId: 'slack-1', provider: 'slack', key: 'SLACK_TOKEN', value: 'from-connector', source: 'connector' },
    ];

    const result = buildBotRuntimeEnv({ resolvedSecrets, resolvedConnectors });
    expect(result.env.SLACK_TOKEN).toBe('from-connector');
  });

  it('includes cloud harness tokens', () => {
    const harness: HarnessConfig = {
      mode: 'cloud',
      cloud: { baseURL: 'https://cloud.allternit.ai', accessToken: 'at-xxx', refreshToken: 'rt-xxx' },
    };
    const result = buildBotRuntimeEnv({ harness });
    expect(result.env).toEqual({
      ALLTERNIT_CLOUD_BASE_URL: 'https://cloud.allternit.ai',
      ALLTERNIT_CLOUD_ACCESS_TOKEN: 'at-xxx',
      ALLTERNIT_CLOUD_REFRESH_TOKEN: 'rt-xxx',
    });
  });

  it('includes subprocess env vars', () => {
    const harness: HarnessConfig = {
      mode: 'subprocess',
      subprocess: { command: 'python bot.py', cwd: '/tmp', env: { CUSTOM_VAR: 'value' } },
    };
    const result = buildBotRuntimeEnv({ harness });
    expect(result.env.CUSTOM_VAR).toBe('value');
  });

  it('returns empty env when nothing is provided', () => {
    const result = buildBotRuntimeEnv({});
    expect(result.env).toEqual({});
  });

  it('includes VM operator config when enabled', () => {
    const result = buildBotRuntimeEnv({
      vmOperator: {
        enabled: true,
        provider: 'opensandbox',
        image: 'opensandbox/desktop:v1.0.0',
        allowedActions: ['command', 'browser', 'desktop'],
        networkPolicy: 'restricted',
        persistence: 'session',
        timeoutMinutes: 30,
        vncEnabled: true,
        autoStart: true,
        resources: { cpu: '1', memory: '2Gi', disk: '10Gi' },
      },
    });

    expect(result.env.ALLTERNIT_VM_OPERATOR_ENABLED).toBe('true');
    expect(result.env.ALLTERNIT_VM_PROVIDER).toBe('opensandbox');
    expect(result.env.ALLTERNIT_VM_IMAGE).toBe('opensandbox/desktop:v1.0.0');
    expect(result.env.ALLTERNIT_VM_ALLOWED_ACTIONS).toBe('command,browser,desktop');
    expect(result.env.ALLTERNIT_VM_NETWORK_POLICY).toBe('restricted');
    expect(result.env.ALLTERNIT_VM_PERSISTENCE).toBe('session');
    expect(result.env.ALLTERNIT_VM_TIMEOUT_MINUTES).toBe('30');
    expect(result.env.ALLTERNIT_VM_VNC_ENABLED).toBe('true');
    expect(result.env.ALLTERNIT_VM_AUTO_START).toBe('true');
    expect(result.env.ALLTERNIT_VM_CPU).toBe('1');
    expect(result.env.ALLTERNIT_VM_MEMORY).toBe('2Gi');
    expect(result.env.ALLTERNIT_VM_DISK).toBe('10Gi');
    expect(result.config.vmOperator).toBeDefined();
  });

  it('only marks VM operator disabled when not enabled', () => {
    const result = buildBotRuntimeEnv({
      vmOperator: { enabled: false, provider: 'opensandbox' },
    });
    expect(result.env.ALLTERNIT_VM_OPERATOR_ENABLED).toBe('false');
    expect(result.env.ALLTERNIT_VM_PROVIDER).toBeUndefined();
    expect(result.env.ALLTERNIT_VM_IMAGE).toBeUndefined();
  });
});

describe('botRuntimeEnvToEnvMap', () => {
  it('extracts env map from runtime env', () => {
    const runtimeEnv = buildBotRuntimeEnv({
      resolvedSecrets: [{ key: 'K', value: 'V', source: 'vault' }],
    });
    expect(botRuntimeEnvToEnvMap(runtimeEnv)).toEqual({ K: 'V' });
  });

  it('returns empty object when runtime env is undefined', () => {
    expect(botRuntimeEnvToEnvMap(undefined)).toEqual({});
  });
});
