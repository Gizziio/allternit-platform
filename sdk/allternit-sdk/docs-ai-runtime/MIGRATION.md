# Migration Guide

## From @anthropic-ai/sdk

Before:
```typescript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey });
```

After:
```typescript
import { AllternitHarness } from '@allternit/sdk';
const harness = new AllternitHarness({
  mode: 'byok',
  byok: { anthropic: { apiKey } }
});
```

## From OpenAI SDK

Similar pattern...
