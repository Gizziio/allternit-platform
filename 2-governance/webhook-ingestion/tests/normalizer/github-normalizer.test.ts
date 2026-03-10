/**
 * GitHub Normalizer Tests
 */

import { describe, it, expect } from 'vitest';
import { normalizeGitHubWebhook, requiresAgentAction, inferAgentRole } from '../src/normalizer/github-normalizer.js';
import type { GitHubWebhookPayload } from '../src/types/webhook.types.js';

describe('GitHub Normalizer', () => {
  const basePayload: GitHubWebhookPayload = {
    id: 'wh_test_123',
    source: 'github',
    eventType: 'pull_request.opened',
    timestamp: '2026-03-08T12:00:00.000Z',
    rawPayload: {},
    repository: {
      fullName: 'a2rchitech/platform',
      name: 'platform',
      owner: 'a2rchitech',
      url: 'https://github.com/a2rchitech/platform',
      private: false,
    },
    sender: {
      login: 'alice',
      id: 12345,
      type: 'User',
    },
    pullRequest: {
      number: 42,
      title: 'Add new feature',
      state: 'open',
      url: 'https://github.com/a2rchitech/platform/pull/42',
      author: 'alice',
      body: 'This PR adds a new feature',
      labels: ['enhancement'],
    },
  };

  describe('normalizeGitHubWebhook', () => {
    it('should normalize pull_request.opened event', () => {
      const normalized = normalizeGitHubWebhook(basePayload);

      expect(normalized.source).toBe('github');
      expect(normalized.type).toBe('github.pull_request.opened');
      expect(normalized.actor).toEqual({
        id: '12345',
        name: 'alice',
        type: 'human',
      });
      expect(normalized.target).toEqual({
        type: 'pull_request',
        id: '42',
        name: 'Add new feature',
        url: 'https://github.com/a2rchitech/platform/pull/42',
      });
      expect(normalized.action?.type).toBe('opened');
      expect(normalized.idempotencyKey).toMatch(/^gh_[a-f0-9]{16}$/);
    });

    it('should normalize issue_comment.created event', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        eventType: 'issue_comment.created',
        pullRequest: undefined,
        issue: {
          number: 10,
          title: 'Bug report',
          state: 'open',
          url: 'https://github.com/a2rchitech/platform/issues/10',
          author: 'bob',
          body: 'Found a bug',
          labels: ['bug'],
        },
        comment: {
          id: 999,
          body: 'I can reproduce this',
          author: 'alice',
          url: 'https://github.com/a2rchitech/platform/issues/10#issuecomment-999',
        },
      };

      const normalized = normalizeGitHubWebhook(payload);

      expect(normalized.type).toBe('github.issue_comment.created');
      expect(normalized.content?.text).toBe('I can reproduce this');
    });

    it('should normalize push event', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        eventType: 'push',
        pullRequest: undefined,
        push: {
          ref: 'refs/heads/main',
          before: 'abc123',
          after: 'def456',
          commits: [
            {
              sha: 'def456',
              message: 'Add new feature',
              author: 'alice',
              url: 'https://github.com/a2rchitech/platform/commit/def456',
            },
          ],
          pushedBy: 'alice',
        },
      };

      const normalized = normalizeGitHubWebhook(payload);

      expect(normalized.type).toBe('github.push.updated');
      expect(normalized.target?.type).toBe('repository');
      expect(normalized.content?.text).toContain('Add new feature');
    });

    it('should generate consistent idempotency keys', () => {
      const normalized1 = normalizeGitHubWebhook(basePayload);
      const normalized2 = normalizeGitHubWebhook(basePayload);

      expect(normalized1.idempotencyKey).toBe(normalized2.idempotencyKey);
    });

    it('should include context information', () => {
      const normalized = normalizeGitHubWebhook(basePayload);

      expect(normalized.context).toEqual({
        repository: 'a2rchitech/platform',
        repositoryUrl: 'https://github.com/a2rchitech/platform',
        eventType: 'pull_request.opened',
        pullRequestNumber: '42',
        pullRequestUrl: 'https://github.com/a2rchitech/platform/pull/42',
      });
    });
  });

  describe('requiresAgentAction', () => {
    it('should return true for pull_request.opened', () => {
      expect(requiresAgentAction(basePayload)).toBe(true);
    });

    it('should return true for issue_comment.created', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        eventType: 'issue_comment.created',
        pullRequest: undefined,
        issue: {
          number: 10,
          title: 'Bug',
          state: 'open',
          url: 'https://github.com/a2rchitech/platform/issues/10',
          author: 'bob',
          body: 'Bug found',
          labels: ['bug'],
        },
        comment: {
          id: 999,
          body: 'Comment',
          author: 'alice',
          url: 'https://example.com',
        },
      };

      expect(requiresAgentAction(payload)).toBe(true);
    });

    it('should return false for push event', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        eventType: 'push',
        pullRequest: undefined,
        push: {
          ref: 'refs/heads/main',
          before: 'abc',
          after: 'def',
          commits: [],
          pushedBy: 'alice',
        },
      };

      expect(requiresAgentAction(payload)).toBe(false);
    });
  });

  describe('inferAgentRole', () => {
    it('should infer reviewer for pull request events', () => {
      const role = inferAgentRole(basePayload);
      expect(role).toBe('reviewer');
    });

    it('should infer security for security-related content', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        pullRequest: {
          ...basePayload.pullRequest!,
          body: 'This fixes a security vulnerability',
        },
      };

      const role = inferAgentRole(payload);
      expect(role).toBe('security');
    });

    it('should default to builder for unknown events', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        eventType: 'release.published',
        pullRequest: undefined,
      };

      const role = inferAgentRole(payload);
      expect(role).toBe('builder');
    });
  });
});
