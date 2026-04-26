# Allternit Test Suite

## Test Structure

```
tests/
├── integration/           # Integration tests
│   ├── kernel-integration.test.ts
│   └── runtime-bridge-compatibility.test.ts
├── e2e/                  # End-to-end tests
│   └── workflow.test.ts
├── benchmarks/           # Performance benchmarks
│   └── performance.bench.ts
└── vitest.config.ts      # Test configuration
```

## Running Tests

```bash
# All tests
pnpm test

# Unit tests only (packages)
pnpm --filter @allternit/governor test
pnpm --filter @allternit/runtime test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Benchmarks
pnpm test:benchmark

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## Test Categories

### Unit Tests
- Located in `__tests__/` within each package
- Test individual components in isolation
- Fast execution (< 100ms each)

### Integration Tests
- Located in `tests/integration/`
- Test component interactions
- Verify runtime bridge compatibility

### E2E Tests
- Located in `tests/e2e/`
- Test complete workflows
- Simulate user interactions

### Benchmarks
- Located in `tests/benchmarks/`
- Performance measurements
- Memory usage tracking

## Writing Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

## Coverage Goals

- Core packages: > 80%
- Runtime: > 75%
- E2E: Critical paths covered
