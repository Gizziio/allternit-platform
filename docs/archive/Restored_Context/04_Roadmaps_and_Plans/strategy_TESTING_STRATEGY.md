# TESTING STRATEGY FOR MIGRATED COMPONENTS

This document outlines the testing strategy for components during and after migration from the legacy vendor codebase to Allternit architecture.

## Testing Philosophy

### Layer-Based Testing
Each layer has specific testing requirements based on its role in the architecture:

- **infrastructure/**: Pure functions, types, shared utilities (unit tests only)
- **domains/kernel/**: Execution, sandboxing, process management (unit + integration tests)
- **domains/governance/**: Policy enforcement, WIH, receipts (unit + integration + compliance tests)
- **services/**: Runtime boundary, vendor integration (integration + boundary tests)
- **services/**: Orchestration, scheduling, long-running processes (integration + e2e tests)
- **5-ui/**: UI components, platform primitives (unit + integration + visual tests)
- **6-apps/**: Application entrypoints (e2e + smoke tests)

## Testing Strategy by Layer

### infrastructure/ Testing Strategy
**Test Types**: Unit tests, type tests
**Focus**: Type safety, utility correctness, shared primitive validation

```typescript
// Example test structure for substrate components
describe('AllternitPrimitive', () => {
  it('should have required fields', () => {
    const primitive: AllternitPrimitive = {
      id: 'test-id',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    expect(primitive.id).toBe('test-id');
  });
});

describe('AllternitProtocol', () => {
  it('should validate data correctly', () => {
    const protocol: AllternitProtocol = {
      version: '1.0.0',
      validate: (data: any) => typeof data === 'object'
    };
    expect(protocol.validate({})).toBe(true);
    expect(protocol.validate('string')).toBe(false);
  });
});
```

### domains/kernel/ Testing Strategy
**Test Types**: Unit tests, integration tests, security tests
**Focus**: Execution safety, resource limits, process isolation

```typescript
// Example test structure for execution engine
describe('ExecutionEngine', () => {
  it('should execute commands safely', async () => {
    const engine = new StubExecutionEngine();
    const result = await engine.execute({
      id: 'test-exec',
      command: 'echo',
      args: ['hello'],
      timeout: 1000
    });
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello');
  });

  it('should enforce resource limits', async () => {
    const engine = new StubExecutionEngine();
    // Test that resource limits are enforced
    const result = await engine.execute({
      id: 'resource-test',
      command: 'stress',
      args: ['--cpu', '1', '--timeout', '1s'],
      timeout: 2000
    });
    
    expect(result.resourcesUsed.cpuTimeMs).toBeGreaterThan(0);
    expect(result.resourcesUsed.memoryPeakKb).toBeGreaterThan(0);
  });
});
```

### domains/governance/ Testing Strategy
**Test Types**: Unit tests, integration tests, policy tests, compliance tests
**Focus**: Policy enforcement, WIH compliance, receipt generation

```typescript
// Example test structure for policy engine
describe('PolicyEngine', () => {
  it('should evaluate policies correctly', async () => {
    const engine = new StubPolicyEngine();
    const decision = await engine.evaluate(
      { operation: 'file.read', path: '/safe/path' },
      { userId: 'test-user', permissions: ['read:files'] }
    );
    
    expect(decision.allowed).toBe(true);
  });

  it('should reject unauthorized operations', async () => {
    const engine = new StubPolicyEngine();
    const decision = await engine.evaluate(
      { operation: 'file.write', path: '/protected/file' },
      { userId: 'test-user', permissions: ['read:files'] }
    );
    
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('denied');
  });
});
```

### services/ Testing Strategy
**Test Types**: Integration tests, boundary tests, adapter tests
**Focus**: Boundary enforcement, vendor integration, API contracts

```typescript
// Example test structure for runtime bridge
describe('RuntimeBridge', () => {
  it('should execute tools through proper boundary', async () => {
    const bridge = new StubRuntimeBridge();
    const result = await bridge.executeTool({
      id: 'test-tool',
      toolId: 'echo',
      parameters: { message: 'hello' },
      context: { userId: 'test-user', sessionId: 'session-1' }
    });
    
    expect(result.executionId).toBe('test-tool');
    expect(result.toolId).toBe('echo');
    expect(result.output).toBeDefined();
  });

  it('should prevent direct vendor access', () => {
    // This would be tested by ensuring no imports from upstream/ in UI layer
    expect(true).toBe(true); // Placeholder - actual test would be in linting
  });
});
```

### services/ Testing Strategy
**Test Types**: Integration tests, e2e tests, performance tests
**Focus**: Service orchestration, task scheduling, inter-service communication

```typescript
// Example test structure for orchestrator
describe('Orchestrator', () => {
  it('should register and manage services', async () => {
    const orchestrator = new StubOrchestrator();
    const service = {
      start: jest.fn(),
      stop: jest.fn(),
      getStatus: () => ({ status: 'running' }),
      getConfig: () => ({ name: 'test-service', dependencies: [] })
    };
    
    await orchestrator.registerService(service);
    const services = await orchestrator.listServices();
    
    expect(services.length).toBeGreaterThan(0);
  });

  it('should schedule and execute tasks', async () => {
    const scheduler = new StubTaskScheduler();
    const taskId = await scheduler.scheduleTask({
      id: 'test-task',
      title: 'Test Task',
      status: 'pending',
      priority: 'normal',
      createdAt: new Date(),
      dependencies: [],
      resources: { cpu: 1, memory: 1024, storage: 100, network: 'normal' },
      context: {}
    });
    
    expect(taskId).toBe('test-task');
  });
});
```

### 5-ui/ Testing Strategy
**Test Types**: Unit tests, integration tests, visual regression tests, accessibility tests
**Focus**: Component correctness, UI consistency, user experience

```typescript
// Example test structure for UI components
describe('ShellPlatform', () => {
  it('should initialize with proper config', async () => {
    const platform = new StubShellPlatform();
    await platform.initialize({
      theme: 'dark',
      language: 'en',
      compactMode: true
    });
    
    const state = platform.getShellState();
    expect(state.config.theme).toBe('dark');
  });

  it('should open and close views properly', async () => {
    const platform = new StubShellPlatform();
    const viewId = await platform.openView('chat');
    
    expect(platform.getShellState().openViews).toContain(viewId);
    
    const closed = await platform.closeView(viewId);
    expect(closed).toBe(true);
  });
});
```

### 6-apps/ Testing Strategy
**Test Types**: E2E tests, smoke tests, integration tests
**Focus**: Application startup, user workflows, integration with platform

```typescript
// Example test structure for app host
describe('AppHost', () => {
  it('should launch apps with proper environment', async () => {
    const host = new StubAppHost();
    const app = await host.launchApp({
      id: 'test-app',
      name: 'Test App',
      version: '1.0.0',
      description: 'A test application',
      entrypoint: './src/index.ts',
      dependencies: [],
      permissions: []
    }, {
      platform: new StubShellPlatform(),
      runtime: new StubRuntimeBridge(),
      config: {},
      logger: new StubLogger()
    });
    
    expect(app).toBeDefined();
    expect(await app.getConfig().id).toBe('test-app');
  });
});
```

## Migration-Specific Testing

### Before Migration Tests
- Verify current functionality works as expected
- Document baseline behavior
- Create smoke tests for critical paths

### During Migration Tests
- Verify stub implementations maintain contracts
- Ensure no functionality is lost during reorganization
- Test boundary enforcement

### After Migration Tests
- Full functionality verification
- Performance regression tests
- Security compliance verification
- Integration tests across layers

## Test File Organization

### Per-Unit Testing Structure
Each unit follows this structure:
```
unit-name/
├── src/
├── __tests__/
│   ├── unit.test.ts      # Unit tests
│   ├── integration.test.ts  # Integration tests
│   └── boundary.test.ts     # Boundary/interface tests
├── __mocks__/
└── test-utils/
```

### Layer-Specific Test Suites
- `tests/unit/` - Unit tests for all layers
- `tests/integration/` - Cross-layer integration tests
- `tests/e2e/` - End-to-end application tests
- `tests/compliance/` - Policy and governance compliance tests
- `tests/security/` - Security boundary tests

## Testing Tools & Frameworks

### Primary Frameworks
- **Unit/Integration**: Vitest
- **E2E**: Playwright
- **Type Checking**: TypeScript compiler
- **Linting**: ESLint + custom rules

### Boundary Verification
- Custom ESLint rules to prevent improper imports
- Build-time verification of layer boundaries
- Runtime verification of interface contracts

### Mocking Strategy
- Stub implementations for dependencies (as created in previous steps)
- Mock services for testing components in isolation
- Fake data generators for consistent test scenarios

## Quality Gates

### Pre-Merge Requirements
- All unit tests pass
- All integration tests pass
- Type checking passes
- Linting passes
- Boundary rules pass

### Post-Merge Requirements
- E2E tests pass
- Performance benchmarks met
- Security scans clear
- Compliance verification passed

## Test Execution Strategy

### Local Development
- Unit tests run on save (watch mode)
- Integration tests run before commit
- Type checking run continuously

### CI Pipeline
- Unit tests on every push
- Integration tests on PR
- E2E tests on merge to main
- Performance and security tests on release

This testing strategy ensures that as we migrate components from the legacy vendor codebase to Allternit architecture, we maintain functionality while enforcing the new layered boundaries and contracts.
