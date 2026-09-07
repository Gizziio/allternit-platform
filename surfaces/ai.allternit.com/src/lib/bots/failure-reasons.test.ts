/**
 * Tests for the typed failure taxonomy (lib/bots/failure-reasons.ts).
 */

import { describe, it, expect } from 'vitest';
import {
  classifyFailure,
  classifyRetry,
  isAutoRetryable,
  isAttentionReason,
  attentionHintFor,
  ATTENTION_CLASSES,
  FAILURE_REASONS,
  type FailureReason,
} from './failure-reasons';

class FakeApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'NativeAgentApiError';
  }
}

describe('classifyFailure', () => {
  it('classifies a plain unknown error', () => {
    expect(classifyFailure(new Error('something odd happened'))).toBe('unknown');
    expect(classifyFailure(null)).toBe('unknown');
    expect(classifyFailure('')).toBe('unknown');
  });

  it('maps statusCode 401/403 to provider_auth_or_access', () => {
    expect(classifyFailure(new FakeApiError('HTTP 401', 401))).toBe('provider_auth_or_access');
    expect(classifyFailure(new FakeApiError('forbidden', 403))).toBe('provider_auth_or_access');
  });

  it('auth outranks quota when both signals are present', () => {
    // Real provider 401 bodies mention funds; auth must still win the tie.
    expect(classifyFailure(new FakeApiError('invalid api key: quota balance exceeded', 401))).toBe(
      'provider_auth_or_access',
    );
    expect(classifyFailure(new Error('401 unauthorized — insufficient funds'))).toBe(
      'provider_auth_or_access',
    );
  });

  it('auth wins on a realistic fund-mentioning 401 error body', () => {
    // Anthropic-style body: 401 status + a quota-triggering phrase. The
    // quota rule also matches the message text, so classifier precedence
    // (auth first) is what keeps this out of the quota class.
    const err = {
      name: 'NativeAgentApiError',
      statusCode: 401,
      body: '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key: insufficient funds"}}',
      message: 'HTTP 401',
    };
    expect(classifyFailure(err)).toBe('provider_auth_or_access');
    // Stringified shape a fetch wrapper would produce.
    expect(
      classifyFailure('status: 401 invalid x-api-key — insufficient funds'),
    ).toBe('provider_auth_or_access');
  });

  it('maps 402 / out-of-funds bodies to provider_quota_limit', () => {
    expect(classifyFailure(new FakeApiError('HTTP 402', 402))).toBe('provider_quota_limit');
    expect(classifyFailure(new Error('account is out of funds'))).toBe('provider_quota_limit');
    expect(classifyFailure(new Error('insufficient credits remaining'))).toBe('provider_quota_limit');
  });

  it('maps 429 / rate limit to provider_rate_limit', () => {
    expect(classifyFailure(new FakeApiError('HTTP 429', 429))).toBe('provider_rate_limit');
    expect(classifyFailure(new Error('rate limit reached, slow down'))).toBe('provider_rate_limit');
  });

  it('maps 5xx / overloaded to provider_server_error', () => {
    expect(classifyFailure(new FakeApiError('HTTP 503', 503))).toBe('provider_server_error');
    expect(classifyFailure(new Error('server error, try again'))).toBe('provider_server_error');
    expect(classifyFailure(new Error('provider is overloaded'))).toBe('provider_server_error');
  });

  it('maps context-length errors to context_overflow', () => {
    expect(classifyFailure(new Error('maximum context length exceeded'))).toBe('context_overflow');
    expect(classifyFailure(new Error('context_overflow'))).toBe('context_overflow');
  });

  it('maps missing provider/key configuration to missing_config', () => {
    expect(classifyFailure(new Error('no llm provider configured'))).toBe('missing_config');
    // Grok provider stub message.
    expect(classifyFailure(new Error('Grok is not configured. Add an xAI API key in Settings.'))).toBe(
      'missing_config',
    );
  });

  it('maps unknown models to model_unavailable', () => {
    expect(classifyFailure(new Error('model gpt-99 does not exist'))).toBe('model_unavailable');
  });

  it('maps offline runtimes and network failures to runtime_offline', () => {
    // Hermes/OpenClaw "not available in this environment" yield path.
    expect(
      classifyFailure(new Error('Hermes is not available in this environment.')),
    ).toBe('runtime_offline');
    expect(classifyFailure(new Error('spawn hermes ENOENT'))).toBe('runtime_offline');
    expect(classifyFailure(new TypeError('Failed to fetch'))).toBe('runtime_offline');
    expect(classifyFailure(new Error('connect ECONNREFUSED 127.0.0.1:8013'))).toBe('runtime_offline');
  });

  it('maps timeouts to delivery_timeout', () => {
    expect(classifyFailure(new Error('ETIMEDOUT waiting for reply'))).toBe('delivery_timeout');
    expect(classifyFailure(new Error('The operation timed out'))).toBe('delivery_timeout');
  });

  it('maps busy targets to target_busy', () => {
    expect(classifyFailure(new Error('target busy with another turn'))).toBe('target_busy');
    expect(classifyFailure(new Error('bot is busy'))).toBe('target_busy');
  });

  it('maps queue expiry to queued_expired', () => {
    expect(classifyFailure(new Error('queue entry expired before delivery'))).toBe('queued_expired');
  });

  it('maps hard bans to agent_blocked', () => {
    expect(classifyFailure(new Error('Execution blocked by hard ban: no secrets'))).toBe('agent_blocked');
  });
});

describe('retry policy', () => {
  it('auto-retries only transient classes, once', () => {
    const retryable: FailureReason[] = [
      'runtime_offline',
      'delivery_timeout',
      'provider_rate_limit',
      'provider_server_error',
    ];
    for (const reason of retryable) {
      expect(isAutoRetryable(reason)).toBe(true);
      expect(classifyRetry(reason)).toEqual({ reason, retry: 'once' });
    }
  });

  it('context_overflow retries only after compaction', () => {
    expect(isAutoRetryable('context_overflow')).toBe(false);
    expect(classifyRetry('context_overflow')).toEqual({
      reason: 'context_overflow',
      retry: 'after_compact',
    });
  });

  it('never retries auth/quota/config/model/blocked/unknown', () => {
    const neverRetry: FailureReason[] = [
      'provider_auth_or_access',
      'provider_quota_limit',
      'missing_config',
      'model_unavailable',
      'agent_blocked',
      'target_busy',
      'queued_expired',
      'unknown',
    ];
    for (const reason of neverRetry) {
      expect(isAutoRetryable(reason)).toBe(false);
      expect(classifyRetry(reason)).toEqual({ reason, retry: 'never' });
    }
  });
});

describe('attention classes', () => {
  it('badges only persistent classes', () => {
    expect([...ATTENTION_CLASSES].sort()).toEqual(
      ['agent_blocked', 'missing_config', 'provider_auth_or_access', 'provider_quota_limit'].sort(),
    );
    for (const reason of FAILURE_REASONS) {
      expect(isAttentionReason(reason)).toBe(ATTENTION_CLASSES.has(reason));
    }
  });

  it('provides a hint for every attention class', () => {
    for (const reason of ATTENTION_CLASSES) {
      expect(attentionHintFor(reason).length).toBeGreaterThan(10);
    }
  });
});
