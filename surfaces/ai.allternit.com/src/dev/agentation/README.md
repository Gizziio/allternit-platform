# Agentation Integration for Allternit

## Overview

Local-first agent assistance for UI development, integrated with the Allternit platform.

**⚠️ DEV-ONLY**: This module is gated by `NODE_ENV === 'development'` and is never included in production builds.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agentation Module                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Provider  │  │    Hooks    │  │      Panel UI       │ │
│  │  (ReactCtx) │  │  (useRole)  │  │   (Floating Panel)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Allternit Adapter Layer                        │
│         (Converts Agentation output to DAG-ready)          │
├─────────────────────────────────────────────────────────────┤
│                      Storybook Bridge                       │
│              (Evidence emission & preview)                  │
└─────────────────────────────────────────────────────────────┘
```

## Usage

```tsx
import { AgentationProvider, AgentationPanel } from './dev/agentation';

function App() {
  return (
    <AgentationProvider>
      {/* Your app */}
      <AgentationPanel />
    </AgentationProvider>
  );
}
```

## Roles

- **UI_ARCHITECT**: Design and structure UI components
- **UI_IMPLEMENTER**: Write and modify component code
- **UI_TESTER**: Create and run tests
- **UI_REVIEWER**: Review changes without write access

## Integration Points

1. **Context Pack Builder**: Provides ontology-aware context
2. **Storybook**: Emits evidence and renders previews
3. **DAG Runner**: Outputs DAG-ready task structures

## License

Based on benjitaylor/agentation (PolyForm Shield 1.0.0)
