/**
 * TypeScript compile-time type tests for @allternit/computer-use SDK.
 * Verifies that the exported type surface matches the engine contract.
 *
 * These tests use runtime assignment checks to exercise TypeScript's
 * structural type system. If any assignment is wrong the file won't compile.
 */

import type {
  EngineMode,
  ExecutionStatus,
  EngineAction,
  EngineActionKind,
  BrowserTaskRequest,
  VisionProposeRequest,
  DesktopExecuteRequest,
  TargetScope,
  EngineLayer,
  EngineExecutionRequest,
  EngineEvent,
  EngineArtifact,
  ExecuteRequest,
  ExecuteResponse,
  SessionCreateRequest,
  SessionCreateResponse,
  ClientConfig,
  ReceiptKind,
  ReceiptStatus,
  ApprovalDecision,
  DeterminismLevel,
  PerceptionLevel,
  ApprovalLevel,
  UserPresenceLevel,
  TabScopeLevel,
  BrowserTaskMode,
  BrowserTaskStatus,
  VisionViewport,
  VisionProposeResponse,
  ActionProposal,
} from '../src/types';

// ---------------------------------------------------------------------------
// String literal union types
// ---------------------------------------------------------------------------

describe('EngineMode literal union', () => {
  it('accepts all valid modes', () => {
    const modes: EngineMode[] = ['intent', 'direct', 'assist'];
    expect(modes).toHaveLength(3);
  });
});

describe('ExecutionStatus literal union', () => {
  it('accepts all valid statuses', () => {
    const statuses: ExecutionStatus[] = [
      'completed',
      'failed',
      'cancelled',
      'paused',
      'needs_approval',
      'needs_input',
    ];
    expect(statuses).toHaveLength(6);
  });
});

describe('TargetScope literal union', () => {
  it('accepts all valid scopes', () => {
    const scopes: TargetScope[] = ['auto', 'browser', 'desktop', 'hybrid'];
    expect(scopes).toHaveLength(4);
  });
});

describe('EngineLayer literal union', () => {
  it('accepts all valid layers', () => {
    const layers: EngineLayer[] = ['semantic', 'deterministic', 'perceptual'];
    expect(layers).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// EngineActionKind literal union
// ---------------------------------------------------------------------------

describe('EngineActionKind literal union', () => {
  it('accepts all documented action kinds', () => {
    const kinds: EngineActionKind[] = [
      'click',
      'type',
      'scroll',
      'navigate',
      'key',
      'hover',
      'drag',
      'wait',
      'screenshot',
      'assert',
      'select',
      'focus',
      'clear',
      'upload',
      'download',
    ];
    // Just ensure they compile — length check confirms no missing items
    expect(kinds.length).toBeGreaterThanOrEqual(15);
  });
});

// ---------------------------------------------------------------------------
// EngineAction shape
// ---------------------------------------------------------------------------

describe('EngineAction interface', () => {
  it('can be constructed with just kind', () => {
    const action: EngineAction = { kind: 'click' };
    expect(action.kind).toBe('click');
  });

  it('accepts all optional fields', () => {
    const action: EngineAction = {
      kind: 'type',
      action_id: 'act-001',
      target: { selector: '#email' },
      input: { text: 'hello@example.com' },
      expect: { value: 'hello@example.com' },
      metadata: { source: 'conformance-test' },
    };
    expect(action.kind).toBe('type');
    expect(action.input?.text).toBe('hello@example.com');
  });
});

// ---------------------------------------------------------------------------
// Service layer types
// ---------------------------------------------------------------------------

describe('BrowserTaskRequest interface', () => {
  it('requires goal field', () => {
    const req: BrowserTaskRequest = { goal: 'test' };
    expect(req.goal).toBe('test');
  });

  it('accepts optional url and mode', () => {
    const req: BrowserTaskRequest = {
      goal: 'Open dashboard',
      url: 'https://example.com',
      mode: 'playwright',
    };
    expect(req.url).toBe('https://example.com');
    expect(req.mode).toBe('playwright');
  });
});

describe('VisionProposeRequest interface', () => {
  it('requires session_id, task, screenshot, viewport', () => {
    const req: VisionProposeRequest = {
      session_id: 'ses-vision',
      task: 'click the submit button',
      screenshot: 'base64encodedpng==',
      viewport: { w: 1920, h: 1080 },
    };
    expect(req.session_id).toBe('ses-vision');
    expect(req.task).toBe('click the submit button');
    expect(req.viewport.w).toBe(1920);
    expect(req.viewport.h).toBe(1080);
  });

  it('accepts optional constraints', () => {
    const req: VisionProposeRequest = {
      session_id: 'ses-001',
      task: 'scroll down',
      screenshot: 'abc==',
      viewport: { w: 1280, h: 720 },
      constraints: { max_proposals: 3 },
    };
    expect(req.constraints?.max_proposals).toBe(3);
  });
});

describe('DesktopExecuteRequest interface', () => {
  it('requires session_id and instruction', () => {
    const req: DesktopExecuteRequest = {
      session_id: 'ses-desktop',
      instruction: 'open terminal',
    };
    expect(req.session_id).toBe('ses-desktop');
    expect(req.instruction).toBe('open terminal');
  });

  it('accepts optional app field', () => {
    const req: DesktopExecuteRequest = {
      session_id: 'ses-desktop',
      instruction: 'close window',
      app: 'com.example.app',
    };
    expect(req.app).toBe('com.example.app');
  });
});

// ---------------------------------------------------------------------------
// VisionViewport
// ---------------------------------------------------------------------------

describe('VisionViewport interface', () => {
  it('has w and h fields', () => {
    const vp: VisionViewport = { w: 800, h: 600 };
    expect(vp.w).toBe(800);
    expect(vp.h).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// HTTP API types
// ---------------------------------------------------------------------------

describe('ExecuteRequest interface', () => {
  it('requires mode, rest optional', () => {
    const minimal: ExecuteRequest = { mode: 'intent' };
    expect(minimal.mode).toBe('intent');

    const full: ExecuteRequest = {
      mode: 'direct',
      run_id: 'run-xyz',
      session_id: 'ses-abc',
      target_scope: 'browser',
      task: 'click button',
      actions: [{ kind: 'click', input: { x: 100, y: 200 } }],
      options: { timeout_ms: 30000 },
      context: { urls: ['https://example.com'] },
      metadata: { source: 'test' },
    };
    expect(full.run_id).toBe('run-xyz');
  });
});

describe('SessionCreateRequest interface', () => {
  it('is fully optional', () => {
    const empty: SessionCreateRequest = {};
    expect(empty).toBeDefined();

    const withId: SessionCreateRequest = {
      session_id: 'ses-001',
      metadata: { env: 'test' },
    };
    expect(withId.session_id).toBe('ses-001');
  });
});

describe('ClientConfig interface', () => {
  it('requires endpoint', () => {
    const cfg: ClientConfig = { endpoint: 'http://localhost:8080' };
    expect(cfg.endpoint).toBe('http://localhost:8080');
  });

  it('accepts optional apiKey, timeout, headers', () => {
    const cfg: ClientConfig = {
      endpoint: 'http://localhost:8080',
      apiKey: 'secret',
      timeout: 60000,
      headers: { 'x-custom': 'value' },
    };
    expect(cfg.apiKey).toBe('secret');
    expect(cfg.timeout).toBe(60000);
  });
});

// ---------------------------------------------------------------------------
// Approval + control type literals
// ---------------------------------------------------------------------------

describe('ApprovalDecision literal union', () => {
  it('accepts approve, deny, cancel', () => {
    const decisions: ApprovalDecision[] = ['approve', 'deny', 'cancel'];
    expect(decisions).toHaveLength(3);
  });
});

describe('DeterminismLevel literal union', () => {
  it('accepts required, preferred, allowed', () => {
    const levels: DeterminismLevel[] = ['required', 'preferred', 'allowed'];
    expect(levels).toHaveLength(3);
  });
});

describe('PerceptionLevel literal union', () => {
  it('accepts off, fallback, allowed, required', () => {
    const levels: PerceptionLevel[] = ['off', 'fallback', 'allowed', 'required'];
    expect(levels).toHaveLength(4);
  });
});

describe('ApprovalLevel literal union', () => {
  it('accepts never, on-risk, always', () => {
    const levels: ApprovalLevel[] = ['never', 'on-risk', 'always'];
    expect(levels).toHaveLength(3);
  });
});

describe('UserPresenceLevel literal union', () => {
  it('accepts headless, headed, present', () => {
    const levels: UserPresenceLevel[] = ['headless', 'headed', 'present'];
    expect(levels).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// BrowserTask types
// ---------------------------------------------------------------------------

describe('BrowserTaskMode and BrowserTaskStatus', () => {
  it('BrowserTaskMode accepts browser-use, playwright, computer-use', () => {
    const modes: BrowserTaskMode[] = ['browser-use', 'playwright', 'computer-use'];
    expect(modes).toHaveLength(3);
  });

  it('BrowserTaskStatus accepts pending, running, completed, failed', () => {
    const statuses: BrowserTaskStatus[] = [
      'pending',
      'running',
      'completed',
      'failed',
    ];
    expect(statuses).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// ActionProposal shape
// ---------------------------------------------------------------------------

describe('ActionProposal interface', () => {
  it('requires type and confidence', () => {
    const proposal: ActionProposal = {
      type: 'click',
      confidence: 0.97,
    };
    expect(proposal.confidence).toBe(0.97);
  });

  it('accepts optional coordinate and text fields', () => {
    const proposal: ActionProposal = {
      type: 'type',
      confidence: 0.85,
      x: 300,
      y: 150,
      text: 'hello world',
      target: '#input-email',
      thought: 'The email field is focused, type the address',
    };
    expect(proposal.text).toBe('hello world');
    expect(proposal.thought).toBeDefined();
  });
});
