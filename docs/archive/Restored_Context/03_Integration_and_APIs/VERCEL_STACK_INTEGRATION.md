# Vercel Stack Integration Plan

## Overview

Integration of Vercel Labs components and AI SDK patterns into Allternit.

---

## 1. AI Elements Integration (Vercel AI SDK UI)

### What to Port

Vercel's AI Elements provides streaming-ready React components for AI applications:

| Component | Purpose | Allternit Integration Point |
|-----------|---------|----------------------|
| `Message` | Streaming message display | Replace/enhance `ai-elements/message.tsx` |
| `Conversation` | Message list container | Replace/enhance `ai-elements/conversation.tsx` |
| `ToolCall` | Tool execution visualization | Enhance `ai-elements/tool.tsx` |
| `Reasoning` | Chain-of-thought display | Enhance `ai-elements/reasoning.tsx` |
| `Artifact` | Code/content artifacts | Enhance `ai-elements/artifact.tsx` |
| `CodeBlock` | Syntax-highlighted code | Use for artifact rendering |
| `StreamingText` | Typewriter effect | Add to message streaming |

### Implementation Strategy

```typescript
// Option 1: Direct dependency (recommended)
npm install @vercel/ai-elements

// Option 2: Selective port (if customization needed)
// Copy specific components into ai-elements/ with Allternit styling
```

### Allternit-Specific Enhancements

1. **Streaming States**
   - Add `streaming` prop to Message component
   - Show partial content with cursor indicator
   - Handle tool-call-in-progress state

2. **Allternit Theme Integration**
   - Map Vercel's neutral theme to Allternit sand/nude palette
   - Ensure CSS variables (`--accent-chat`, etc.) are used
   - Maintain glass morphism styling

3. **Message Parts System**
   - Extend to support Allternit's rich content parts
   - Artifacts, A2UI, tool calls, thinking

### Files to Modify

```
components/ai-elements/
├── message.tsx          # Add streaming, tool states
├── conversation.tsx     # Add scroll-to-bottom, streaming
├── tool.tsx             # Add tool execution states
├── reasoning.tsx        # Add thinking chain display
├── artifact.tsx         # Add streaming artifact support
└── streaming-text.tsx   # New: typewriter effect
```

---

## 2. Vercel AI SDK (Tool Approval Philosophy)

### Core Concept

AI SDK 6 introduces approval gating: "not every tool call needs approval; destructive actions should."

### Allternit Implementation

1. **Approval Middleware**
   - Intercept tool calls before execution
   - Check against `ApprovalPolicy`
   - Queue for approval or auto-execute

2. **UI Components**
   - `ToolApprovalCard`: Show pending tool call
   - `ApprovalQueue`: List of pending approvals
   - `ApprovalPolicyEditor`: Configure rules

### Code Structure

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
      const decision = await policy.evaluate({ tool, args, risk });
      
      if (decision.action === 'require-approval') {
        const approved = await context.requestApproval({
          tool: tool.name,
          args,
          risk,
          reason: decision.reason,
        });
        if (!approved) throw new Error('Tool execution rejected');
      }
      
      return tool.execute(args, context);
    },
  };
}
```

### Integration Points

- Agent workspace tool registration
- Chat message tool call rendering
- Drawer approval queue tab

---

## 3. json-render Style Schema Renderer

### Concept

Generative UI framework: AI generates interfaces constrained to defined components.

### Allternit Schema Renderer Architecture

```
SchemaUI
├── components: SchemaComponent[]
├── dataModel: Record<string, SchemaDataField>
├── actions: SchemaAction[]
└── root: string

SchemaComponent
├── id: string
├── type: SchemaComponentType
├── props: Record<string, unknown>
├── children: string[]
└── conditional?: SchemaCondition
```

### Use Cases in Allternit

1. **Cowork Mode Forms**
   - Project intake forms
   - WIH (Work Item Handler) editors
   - Configuration panels

2. **Agent-Generated UI**
   - Tool configuration dialogs
   - Data collection forms
   - Interactive workflows

3. **MCP-Style Miniapps**
   - External tools provide schema
   - Allternit renders interactive interface
   - No hardcoded UI needed

### Implementation

```typescript
// components/schema-renderer/SchemaRenderer.tsx
export function SchemaRenderer({ schema }: { schema: SchemaUI }) {
  const [data, setData] = useState(() => initializeData(schema.dataModel));
  const components = useMemo(() => buildComponentMap(schema.components), [schema]);
  
  return (
    <SchemaContext.Provider value={{ data, setData, schema }}>
      <RenderComponent id={schema.root} components={components} />
    </SchemaContext.Provider>
  );
}

// Component registry
const COMPONENT_REGISTRY: Record<SchemaComponentType, React.FC> = {
  Container: ContainerRenderer,
  Stack: StackRenderer,
  TextField: TextFieldRenderer,
  // ... etc
};
```

### Files to Create

```
components/schema-renderer/
├── SchemaRenderer.tsx      # Main renderer
├── SchemaContext.tsx       # Context for data/actions
├── components/
│   ├── layout/             # Container, Stack, Grid, Card
│   ├── form/               # TextField, Select, Checkbox, etc
│   ├── display/            # Text, Heading, Badge, etc
│   └── ai/                 # Message, ToolCall, Artifact
├── hooks/
│   └── useSchemaData.ts    # Data binding hooks
└── utils/
    ├── validate.ts         # Schema validation
    └── resolve.ts          # Value resolution (${field.path})
```

### Integration with Cowork

```typescript
// views/cowork/CoworkRoot.tsx
export function CoworkRoot() {
  const { activeWIH } = useCoworkStore();
  
  if (activeWIH?.schema) {
    return <SchemaRenderer schema={activeWIH.schema} />;
  }
  
  return <DefaultCoworkView />;
}
```

---

## 4. Vercel Labs UI Guidelines

### Accessibility Standards

From Vercel's web-interface-guidelines:

| Rule | Implementation |
|------|----------------|
| Keyboard navigation | All interactive elements focusable |
| Focus management | Visible focus rings, trap in modals |
| Screen reader | Semantic HTML, ARIA labels |
| Color contrast | WCAG AA minimum |
| Reduced motion | Respect `prefers-reduced-motion` |

### Allternit Compliance Check

- [ ] Add `prefers-reduced-motion` support to glass animations
- [ ] Ensure focus rings visible on all glass surfaces
- [ ] Add ARIA labels to ShellRail navigation
- [ ] Test keyboard navigation in 3-pane layout
- [ ] Color contrast audit for sand/nude palette

### Motion Design

From Vercel's components.build spec:

| Pattern | Implementation |
|---------|----------------|
| Enter animations | Fade + slide, 200ms ease-out |
| Exit animations | Fade out, 150ms ease-in |
| Hover states | Subtle lift or glow |
| Loading states | Shimmer or pulse |

### Allternit Motion Tokens

```css
:root {
  --motion-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --motion-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --motion-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --motion-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## 5. react-best-practices for Agents

### Patterns to Adopt

From Vercel's agent-optimized React guidelines:

1. **Explicit State Dependencies**
   ```typescript
   // Good: Dependencies are clear
   const data = useMemo(() => process(items), [items]);
   
   // Bad: Hidden dependencies
   const data = useMemo(() => process(items), []);
   ```

2. **Stable References**
   ```typescript
   // Good: useCallback for event handlers
   const handleClick = useCallback(() => {...}, [deps]);
   
   // Bad: Inline functions in render
   onClick={() => {...}}
   ```

3. **Component Boundaries**
   ```typescript
   // Good: Small, focused components
   <MessageList>
     {messages.map(m => <Message key={m.id} message={m} />)}
   </MessageList>
   ```

4. **Avoid Prop Drilling**
   ```typescript
   // Use context for shell-level state
   <SidecarContext.Provider>
     <ShellFrame />
   </SidecarContext.Provider>
   ```

### Allternit Refactor Targets

- [ ] Audit `ShellApp.tsx` for inline functions
- [ ] Memoize rail item rendering
- [ ] Split `ViewHost` into smaller components
- [ ] Context for sidecar/drawer state

---

## 6. Integration Roadmap

### Week 1: Foundation
- [ ] Add `@vercel/ai-elements` dependency or port selected components
- [ ] Create `UI_CONTRACTS.ts` with all TypeScript interfaces
- [ ] Set up `schema-renderer/` directory structure

### Week 2: AI Elements Integration
- [ ] Replace message components with AI Elements versions
- [ ] Add streaming states to conversation
- [ ] Enhance tool call visualization
- [ ] Theme integration (sand/nude palette)

### Week 3: Schema Renderer
- [ ] Implement core SchemaRenderer
- [ ] Build component registry (layout + form)
- [ ] Integrate with Cowork mode
- [ ] Add schema validation

### Week 4: Approval System
- [ ] Implement approval middleware
- [ ] Build ToolApprovalCard component
- [ ] Add approval queue to drawer
- [ ] Create ApprovalPolicyEditor

---

## 7. Dependencies

### New Packages

```json
{
  "@vercel/ai-elements": "^0.1.0",
  "@ai-sdk/react": "^1.0.0",
  "react-json-schema": "^1.0.0",
  "zod": "^3.22.0" // For schema validation
}
```

### Optional: Internal Implementation

If external dependencies are not desired, we can:
1. Port AI Elements components into `ai-elements/`
2. Build custom schema renderer
3. Implement approval system from scratch

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Message streaming latency | < 50ms from chunk to render |
| Schema render time | < 100ms for 50 components |
| Tool approval UI delay | < 16ms (1 frame) |
| Bundle size increase | < 100KB gzipped |
| Accessibility score | 100 Lighthouse |

---

*Integration plan for Vercel Labs patterns into Allternit Shell*
