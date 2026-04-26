# Vercel Stack Integration Plan v1.1

## Overview

Integration of Vercel Labs components and AI SDK patterns into Allternit.

**CORRECTIONS IN v1.1:**
- Removed recommendation to `npm install @vercel/ai-elements` (package may not exist)
- Default to vendoring components into codebase
- Added verification steps for any external packages

---

## 1. AI Elements Integration

### Source Material

Vercel's AI Elements are open-source React components for AI applications. They exist as a **reference implementation** rather than a published npm package.

**Source:** https://github.com/vercel/ai-elements (or similar Vercel Labs repos)

### Integration Strategy

**Option A: Vendor Components (RECOMMENDED)**

Copy selected components into `src/components/ai-elements/` with Allternit styling.

**Why vendor instead of npm:**
- AI Elements is a pattern library, not a stable package
- Need Allternit-specific theming (sand/nude palette)
- Need to integrate with existing Allternit stores
- Avoid dependency on potentially unstable external package

### Components to Port

| Component | Purpose | Allternit Location | Priority |
|-----------|---------|--------------|----------|
| `Message` | Streaming message display | `ai-elements/message.tsx` | High |
| `Conversation` | Message list container | `ai-elements/conversation.tsx` | High |
| `ToolCall` | Tool execution UI | `ai-elements/tool.tsx` | High |
| `Reasoning` | Chain-of-thought display | `ai-elements/reasoning.tsx` | Medium |
| `Artifact` | Code/content display | `ai-elements/artifact.tsx` | High |
| `CodeBlock` | Syntax highlighting | `ai-elements/code-block.tsx` | High |
| `StreamingText` | Typewriter effect | `ai-elements/streaming-text.tsx` | Medium |

### Allternit-Specific Enhancements

```typescript
// Add to each ported component:

interface AllternitMessageProps extends BaseMessageProps {
  // Allternit-specific
  glassStyle?: boolean;
  accentColor?: 'chat' | 'cowork' | 'code';
  onRouteToSidecar?: (artifactId: string) => void;
}
```

### Files to Create/Modify

```
src/components/ai-elements/
├── message.tsx          # Port + streaming states
├── conversation.tsx     # Port + scroll management  
├── tool.tsx             # Port + approval integration
├── reasoning.tsx        # Port
├── artifact.tsx         # Port + version support
├── streaming-text.tsx   # New
└── index.ts             # Re-exports
```

---

## 2. Vercel AI SDK Integration

### Core Concept

AI SDK 4+ introduces tool approval patterns: "not every tool call needs approval; destructive actions should."

### Allternit Implementation

**No npm package required** - implement pattern using existing Allternit infrastructure.

```typescript
// middleware/tool-approval.ts
export function withApproval<T extends Tool>(
  tool: T,
  policy: ApprovalPolicy
): T {
  return {
    ...tool,
    execute: async (args, context) => {
      const risk = assessRisk(tool, args);
      const decision = policy.evaluate({ tool, args, risk });
      
      if (decision.action === 'require-approval') {
        const approved = await context.requestApproval({
          tool: tool.name,
          args,
          risk,
          reason: decision.reason,
        });
        if (!approved) {
          throw new ApprovalRejectedError(tool.name);
        }
      }
      
      return tool.execute(args, context);
    },
  };
}
```

### UI Components Needed

```typescript
// components/approval/
├── ToolApprovalCard.tsx      # Pending tool approval
├── ApprovalQueue.tsx         # List of pending approvals  
├── ApprovalPolicyEditor.tsx  # Configure risk tiers
└── RiskBadge.tsx             # Display risk level
```

---

## 3. json-render Style Schema Renderer

### Concept

Generative UI: AI generates interfaces constrained to defined components.

### Implementation

Build custom schema renderer - no external package needed.

```typescript
// Schema definition
interface SchemaUI {
  version: '1.0';
  id: string;
  title: string;
  components: SchemaComponent[];
  root: string;
  dataModel: Record<string, SchemaDataField>;
  actions: SchemaAction[];
}

// Component registry
const COMPONENT_REGISTRY: Record<SchemaComponentType, React.FC> = {
  Container: ContainerRenderer,
  Stack: StackRenderer,
  TextField: TextFieldRenderer,
  // ... etc
};
```

### Use Cases

1. **Cowork Mode Forms** - Project intake, WIH editors
2. **Agent-Generated UI** - Tool config dialogs
3. **MCP Miniapps** - External tool interfaces

### Files to Create

```
src/components/schema-renderer/
├── SchemaRenderer.tsx      # Main renderer
├── SchemaContext.tsx       # Data/action context
├── registry.tsx            # Component registry
├── components/
│   ├── layout/             # Container, Stack, Grid
│   ├── form/               # Inputs, selects
│   ├── display/            # Text, headings
│   └── ai/                 # Message, ToolCall
└── hooks/
    └── useSchemaData.ts
```

---

## 4. UI Guidelines

### From Vercel Labs

**Accessibility:**
- Keyboard navigation
- Focus management
- ARIA labels
- Color contrast (WCAG AA)

**Motion:**
- Enter: fade + slide, 200ms
- Exit: fade, 150ms
- Hover: subtle lift
- Respect `prefers-reduced-motion`

### Allternit Compliance

```css
/* Add to theme.css */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Focus rings */
:focus-visible {
  outline: 2px solid var(--accent-chat);
  outline-offset: 2px;
}
```

---

## 5. Implementation Roadmap

### Week 1: Foundation
- [ ] Vendor AI Elements components (selective port)
- [ ] Apply Allternit theming
- [ ] Integrate with stores

### Week 2: Approval System
- [ ] Implement tool approval middleware
- [ ] Build approval UI components
- [ ] Integrate with drawer

### Week 3: Schema Renderer
- [ ] Build core renderer
- [ ] Create component registry
- [ ] Integrate with Cowork mode

### Week 4: Polish
- [ ] Accessibility audit
- [ ] Motion refinement
- [ ] Documentation

---

## 6. Dependencies

### NO New Packages Required

All patterns can be implemented with existing Allternit infrastructure.

**If you must use external packages, verify first:**

```bash
# Check if package exists and is maintained
npm view @vercel/ai-elements
npm view @ai-sdk/react

# Check bundle size
npm view @vercel/ai-elements --json | grep size

# Check TypeScript support
npm view @vercel/ai-elements types
```

### Recommended Internal Implementation

| Feature | Implementation | Location |
|---------|---------------|----------|
| Streaming messages | Custom hook + CSS | `hooks/useStreaming.ts` |
| Tool approval | Middleware pattern | `middleware/tool-approval.ts` |
| Schema renderer | Component registry | `components/schema-renderer/` |
| Motion | CSS + Framer Motion | `design/motion.ts` |

---

## 7. Verification Checklist

Before integrating any external code:

- [ ] Source is from official Vercel Labs repo
- [ ] License is compatible (MIT preferred)
- [ ] TypeScript types are complete
- [ ] Bundle size impact is acceptable (< 50KB)
- [ ] No conflicting dependencies
- [ ] Can be themed to Allternit palette
- [ ] Accessibility is maintained

---

*Integration plan v1.1 - Corrected for package reality*
