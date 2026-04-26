/**
 * Allternit Computer Use Engine - TypeScript SDK Tests
 * 
 * Unit tests for the SDK client.
 */

import { AllternitComputerUseClient } from '../src/client';
import { ApprovalHandler, ApprovalPredicates } from '../src/approvals';
import { normalizeEndpoint, AllternitComputerUseError } from '../src/utils';

// Mock fetch for testing
global.fetch = jest.fn();

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('AllternitComputerUseClient', () => {
  let client: AllternitComputerUseClient;

  beforeEach(() => {
    client = new AllternitComputerUseClient({
      endpoint: 'http://localhost:8080',
      timeout: 60000,
    });
    mockedFetch.mockClear();
  });

  describe('constructor', () => {
    it('should normalize endpoint URL', () => {
      const client1 = new AllternitComputerUseClient({ endpoint: 'localhost:8080' });
      expect((client1 as unknown as { endpoint: string }).endpoint).toBe('http://localhost:8080/v1');
    });

    it('should handle endpoint with trailing slash', () => {
      const client1 = new AllternitComputerUseClient({ endpoint: 'http://localhost:8080/' });
      expect((client1 as unknown as { endpoint: string }).endpoint).toBe('http://localhost:8080/v1');
    });

    it('should handle endpoint with /v1 prefix', () => {
      const client1 = new AllternitComputerUseClient({ endpoint: 'http://localhost:8080/v1' });
      expect((client1 as unknown as { endpoint: string }).endpoint).toBe('http://localhost:8080/v1');
    });

    it('should store API key', () => {
      const client1 = new AllternitComputerUseClient({
        endpoint: 'http://localhost:8080',
        apiKey: 'test-key',
      });
      expect((client1 as unknown as { apiKey: string | undefined }).apiKey).toBe('test-key');
    });
  });

  describe('execute', () => {
    it('should make POST request to /execute', async () => {
      const mockResponse = {
        run_id: 'test-run-123',
        session_id: 'test-session-456',
        status: 'completed',
        mode: 'intent',
        target_scope: 'browser',
        selected_route: {
          target_scope: 'browser',
          starting_layer: 'semantic',
          final_layer: 'semantic',
          adapters: ['test-adapter'],
        },
        summary: 'Task completed successfully',
        output: null,
        artifacts: [],
        receipts: [],
        counters: { steps: 1, actions: 1, fallbacks: 0, approvals: 0 },
        error: null,
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.execute({
        mode: 'intent',
        task: 'Test task',
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/execute',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        })
      );

      expect(result.run_id).toBe('test-run-123');
      expect(result.status).toBe('completed');
    });

    it('should throw on API error', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid request', detail: 'Task is required' }),
      } as Response);

      await expect(
        client.execute({ mode: 'intent', task: '' })
      ).rejects.toThrow(AllternitComputerUseError);
    });
  });

  describe('executeIntent', () => {
    it('should execute with mode=intent', async () => {
      const mockResponse = {
        run_id: 'test-run-123',
        session_id: 'test-session-456',
        status: 'completed',
        mode: 'intent',
        target_scope: 'browser',
        selected_route: {
          target_scope: 'browser',
          starting_layer: 'semantic',
          final_layer: 'semantic',
          adapters: [],
        },
        summary: 'Task completed',
        output: null,
        artifacts: [],
        receipts: [],
        counters: { steps: 0, actions: 0, fallbacks: 0, approvals: 0 },
        error: null,
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.executeIntent('Fill out the form', {
        target_scope: 'browser',
        timeout_ms: 30000,
      });

      const requestBody = JSON.parse(
        (mockedFetch.mock.calls[0][1] as { body: string }).body
      );

      expect(requestBody.mode).toBe('intent');
      expect(requestBody.task).toBe('Fill out the form');
      expect(requestBody.target_scope).toBe('browser');
      expect(requestBody.options.timeout_ms).toBe(30000);
    });
  });

  describe('executeDirect', () => {
    it('should execute with mode=direct and actions', async () => {
      const mockResponse = {
        run_id: 'test-run-123',
        session_id: 'test-session-456',
        status: 'completed',
        mode: 'direct',
        target_scope: 'auto',
        selected_route: {
          target_scope: 'auto',
          starting_layer: 'semantic',
          final_layer: 'semantic',
          adapters: [],
        },
        summary: 'Actions executed',
        output: null,
        artifacts: [],
        receipts: [],
        counters: { steps: 0, actions: 0, fallbacks: 0, approvals: 0 },
        error: null,
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const actions = [
        { kind: 'click', target: { selector: '#btn' } },
        { kind: 'type', target: { selector: '#input' }, input: { text: 'hello' } },
      ];

      await client.executeDirect(actions);

      const requestBody = JSON.parse(
        (mockedFetch.mock.calls[0][1] as { body: string }).body
      );

      expect(requestBody.mode).toBe('direct');
      expect(requestBody.actions).toHaveLength(2);
      expect(requestBody.actions[0].kind).toBe('click');
    });
  });

  describe('executeAssist', () => {
    it('should execute with mode=assist and approvals=always', async () => {
      const mockResponse = {
        run_id: 'test-run-123',
        session_id: 'test-session-456',
        status: 'needs_approval',
        mode: 'assist',
        target_scope: 'auto',
        selected_route: {
          target_scope: 'auto',
          starting_layer: 'semantic',
          final_layer: 'semantic',
          adapters: [],
        },
        summary: 'Waiting for approval',
        output: null,
        artifacts: [],
        receipts: [],
        counters: { steps: 0, actions: 0, fallbacks: 0, approvals: 1 },
        error: null,
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.executeAssist('Delete files');

      const requestBody = JSON.parse(
        (mockedFetch.mock.calls[0][1] as { body: string }).body
      );

      expect(requestBody.mode).toBe('assist');
      expect(requestBody.options.approvals).toBe('always');
    });
  });

  describe('getRun', () => {
    it('should fetch run status', async () => {
      const mockResponse = {
        run_id: 'test-run-123',
        session_id: 'test-session-456',
        status: 'completed',
        mode: 'intent',
        target_scope: 'browser',
        summary: 'Task completed',
        completed: true,
        request: {},
        result: {},
        receipts: [],
        artifacts: [],
        events: {},
        control: null,
        trace: {},
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.getRun('test-run-123');

      expect(mockedFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/runs/test-run-123',
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(result.run_id).toBe('test-run-123');
    });
  });

  describe('cancelRun', () => {
    it('should post to cancel endpoint', async () => {
      const mockResponse = {
        run_id: 'test-run-123',
        status: 'running',
        control: { state: 'cancelling' },
        message: 'Cancellation requested',
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.cancelRun('test-run-123', {
        actor_id: 'user-1',
        comment: 'User requested',
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/runs/test-run-123/cancel',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('session management', () => {
    it('should create session', async () => {
      const mockResponse = {
        session_id: 'new-session-123',
        created: true,
        message: 'Session created successfully',
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.createSession({
        metadata: { user: 'test' },
      });

      expect(result.session_id).toBe('new-session-123');
    });

    it('should get session', async () => {
      const mockResponse = {
        session_id: 'session-123',
        run_count: 2,
        status_counts: { completed: 2 },
        latest_run_id: 'run-456',
        runs: [],
        created_at: '2024-01-01T00:00:00Z',
        metadata: {},
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.getSession('session-123');

      expect(result.session_id).toBe('session-123');
      expect(result.run_count).toBe(2);
    });

    it('should close session', async () => {
      const mockResponse = {
        session_id: 'session-123',
        closed: true,
        runs_affected: 2,
        message: 'Session closed. 2 runs archived.',
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.closeSession('session-123', true);

      expect(result.closed).toBe(true);
    });
  });

  describe('approve', () => {
    it('should submit approval', async () => {
      const mockResponse = {
        run_id: 'test-run-123',
        decision: 'approve',
        status: 'completed',
        result: {},
        message: 'Execution completed with approval',
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.approve('test-run-123', {
        decision: 'approve',
        approver_id: 'user-1',
        comment: 'Approved',
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/approve/test-run-123',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            decision: 'approve',
            approver_id: 'user-1',
            comment: 'Approved',
          }),
        })
      );

      expect(result.decision).toBe('approve');
    });
  });
});

describe('ApprovalPredicates', () => {
  const mockRequest = {
    run_id: 'test-run',
    event: {
      run_id: 'test-run',
      session_id: 'test-session',
      event_type: 'approval.required' as const,
      mode: 'assist' as const,
      target_scope: 'auto' as const,
      message: 'Approve action',
      data: {},
    },
    message: 'Approve action',
    action_summary: 'click on button',
  };

  describe('always', () => {
    it('should always return true', () => {
      expect(ApprovalPredicates.always()(mockRequest)).toBe(true);
    });
  });

  describe('never', () => {
    it('should always return false', () => {
      expect(ApprovalPredicates.never()(mockRequest)).toBe(false);
    });
  });

  describe('matches', () => {
    it('should match string pattern', () => {
      const predicate = ApprovalPredicates.matches('click');
      expect(predicate(mockRequest)).toBe(true);
    });

    it('should match regex pattern', () => {
      const predicate = ApprovalPredicates.matches(/click|type/);
      expect(predicate(mockRequest)).toBe(true);
    });

    it('should not match non-matching pattern', () => {
      const predicate = ApprovalPredicates.matches('delete');
      expect(predicate(mockRequest)).toBe(false);
    });
  });

  describe('safeActions', () => {
    it('should approve safe actions', () => {
      const predicate = ApprovalPredicates.safeActions(['click', 'scroll']);
      expect(predicate(mockRequest)).toBe(true);
    });

    it('should deny unsafe actions', () => {
      const predicate = ApprovalPredicates.safeActions(['delete', 'remove']);
      expect(predicate(mockRequest)).toBe(false);
    });
  });

  describe('notDangerous', () => {
    it('should approve non-dangerous actions', () => {
      const predicate = ApprovalPredicates.notDangerous(['delete', 'remove']);
      expect(predicate(mockRequest)).toBe(true);
    });

    it('should deny dangerous actions', () => {
      const dangerousRequest = { ...mockRequest, action_summary: 'delete file' };
      const predicate = ApprovalPredicates.notDangerous(['delete']);
      expect(predicate(dangerousRequest)).toBe(false);
    });
  });

  describe('readOnly', () => {
    it('should approve read-only actions', () => {
      const readonlyRequest = { ...mockRequest, action_summary: 'scroll down' };
      expect(ApprovalPredicates.readOnly()(readonlyRequest)).toBe(true);
    });

    it('should deny write actions', () => {
      const writeRequest = { ...mockRequest, action_summary: 'delete item' };
      expect(ApprovalPredicates.readOnly()(writeRequest)).toBe(false);
    });
  });

  describe('all', () => {
    it('should return true when all predicates pass', async () => {
      const predicate = ApprovalPredicates.all(
        ApprovalPredicates.always(),
        ApprovalPredicates.always()
      );
      expect(await predicate(mockRequest)).toBe(true);
    });

    it('should return false when any predicate fails', async () => {
      const predicate = ApprovalPredicates.all(
        ApprovalPredicates.always(),
        ApprovalPredicates.never()
      );
      expect(await predicate(mockRequest)).toBe(false);
    });
  });

  describe('any', () => {
    it('should return true when any predicate passes', async () => {
      const predicate = ApprovalPredicates.any(
        ApprovalPredicates.never(),
        ApprovalPredicates.always()
      );
      expect(await predicate(mockRequest)).toBe(true);
    });

    it('should return false when all predicates fail', async () => {
      const predicate = ApprovalPredicates.any(
        ApprovalPredicates.never(),
        ApprovalPredicates.never()
      );
      expect(await predicate(mockRequest)).toBe(false);
    });
  });

  describe('not', () => {
    it('should negate predicate', async () => {
      const predicate = ApprovalPredicates.not(ApprovalPredicates.always());
      expect(await predicate(mockRequest)).toBe(false);
    });
  });
});

describe('Utils', () => {
  describe('normalizeEndpoint', () => {
    it('should add protocol if missing', () => {
      expect(normalizeEndpoint('localhost:8080')).toBe('http://localhost:8080/v1');
    });

    it('should keep existing protocol', () => {
      expect(normalizeEndpoint('https://api.example.com')).toBe('https://api.example.com/v1');
    });

    it('should remove trailing slash', () => {
      expect(normalizeEndpoint('http://localhost:8080/')).toBe('http://localhost:8080/v1');
    });

    it('should not duplicate v1 prefix', () => {
      expect(normalizeEndpoint('http://localhost:8080/v1')).toBe('http://localhost:8080/v1');
    });
  });
});
