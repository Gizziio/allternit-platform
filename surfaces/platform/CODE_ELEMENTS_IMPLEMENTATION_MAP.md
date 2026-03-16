# Code Components Implementation Map

Complete mapping of all 15 AI SDK Code Elements to their implementation locations.

---

## Overview of 15 Code Components

| # | Component | Purpose | Category |
|---|-----------|---------|----------|
| 1 | **AgentCard** | Agent config display | Code |
| 2 | **Artifact** | Generated code container | Code |
| 3 | **CodeBlock** | Syntax-highlighted code | Code |
| 4 | **Commit** | Git commit display | Code |
| 5 | **EnvironmentVariables** | .env editor | Code |
| 6 | **FileTree** | File explorer | Code |
| 7 | **JSXPreview** | Live React preview | Code |
| 8 | **PackageInfo** | Package.json viewer | Code |
| 9 | **Sandbox** | Code execution | Code |
| 10 | **SchemaDisplay** | API schema viewer | Code |
| 11 | **Snippet** | Copyable code snippet | Code |
| 12 | **StackTrace** | Error display | Code |
| 13 | **Terminal** | CLI output | Code |
| 14 | **TestResults** | Test output | Code |
| 15 | **WebPreview** | Live web preview | Code |

---

## Implementation Locations by View

### 1. CodeCanvas (`src/views/code/CodeCanvas.tsx`)
**Primary code workspace - Core implementation**

| Component | Location | Usage |
|-----------|----------|-------|
| **CodeBlock** | Message content | Display code in chat |
| **Terminal** | Bottom panel | CLI output |
| **FileTree** | Left sidebar | Workspace file explorer |
| **WebPreview** | Right panel | Live preview |
| **Sandbox** | Execution area | Code execution |
| **Snippet** | Quick actions | Copy commands |
| **StackTrace** | Error panel | Runtime errors |
| **TestResults** | CI panel | Test output |
| **EnvironmentVariables** | Settings | .env editor |
| **PackageInfo** | Dependencies panel | package.json |

### 2. CoworkView (`src/views/CoworkView.tsx`)
**Artifact canvas - Rich artifact rendering**

| Component | Location | Usage |
|-----------|----------|-------|
| **Artifact** | Main container | Code artifact wrapper |
| **CodeBlock** | Code artifacts | Syntax highlighting |
| **Sandbox** | Runnable artifacts | Code execution |
| **WebPreview** | Preview artifacts | Live preview |
| **JSXPreview** | Component artifacts | React preview |
| **FileTree** | Project view | File structure |
| **Terminal** | Build output | Logs |

### 3. AgentView (`src/views/AgentView.tsx`)
**Agent runner - Agent config & execution**

| Component | Location | Usage |
|-----------|----------|-------|
| **AgentCard** | Config panel | Agent display |
| **Commit** | Version tab | Git history |
| **Terminal** | Execution log | Output |
| **CodeBlock** | Code generation | Generated code |
| **Snippet** | Quick commands | Copy snippets |

### 4. ChatView (`src/views/ChatView.tsx`)
**Chat interface - Code in messages**

| Component | Location | Usage |
|-----------|----------|-------|
| **CodeBlock** | Message content | Code responses |
| **Snippet** | Suggestions | Quick copy |
| **WebPreview** | Side panel | Preview URLs |

### 5. ElementsLab (`src/views/ElementsLab.tsx`)
**Showcase - All components demo**

| Component | Location | Usage |
|-----------|----------|-------|
| **All 15 code components** | Grid view | Component showcase |

---

## Detailed Component Mapping

### CodeBlock
```typescript
// Implementation: Message code display, syntax highlighting
// Views: ChatView, CodeCanvas, CoworkView, AgentView, ElementsLab

import { CodeBlock } from "@/components/ai-elements/code-block";

// Usage in message rendering:
<CodeBlock 
  code="console.log('hello')" 
  language="javascript"
/>
```

### Terminal
```typescript
// Implementation: CLI output display
// Views: CodeCanvas (bottom panel), CoworkView, AgentView

import { Terminal } from "@/components/ai-elements/terminal";

<Terminal output={terminalOutput} />
```

### FileTree
```typescript
// Implementation: File explorer sidebar
// Views: CodeCanvas (left sidebar), CoworkView

import { FileTree, FileTreeFolder, FileTreeFile } from "@/components/ai-elements/file-tree";

<FileTree>
  <FileTreeFolder path="src" name="src">
    <FileTreeFile path="index.ts" name="index.ts" />
  </FileTreeFolder>
</FileTree>
```

### WebPreview
```typescript
// Implementation: Live web preview
// Views: CodeCanvas, CoworkView, ChatView

import { WebPreview, WebPreviewNavigation, WebPreviewUrl, WebPreviewBody } from "@/components/ai-elements/web-preview";

<WebPreview defaultUrl="https://localhost:3000">
  <WebPreviewNavigation>
    <WebPreviewUrl />
  </WebPreviewNavigation>
  <WebPreviewBody />
</WebPreview>
```

### Sandbox
```typescript
// Implementation: Code execution environment
// Views: CodeCanvas, CoworkView

import { Sandbox, SandboxHeader, SandboxContent } from "@/components/ai-elements/sandbox";

<Sandbox>
  <SandboxHeader title="Python Execution" state="output-available" />
  <SandboxContent>
    {output}
  </SandboxContent>
</Sandbox>
```

### Artifact
```typescript
// Implementation: Generated code container
// Views: CoworkView, CodeCanvas, AgentView

import { Artifact, ArtifactHeader, ArtifactTitle, ArtifactContent, ArtifactActions } from "@/components/ai-elements/artifact";

<Artifact>
  <ArtifactHeader>
    <ArtifactTitle>Generated Component</ArtifactTitle>
    <ArtifactActions>
      <ArtifactClose />
    </ArtifactActions>
  </ArtifactHeader>
  <ArtifactContent>
    {code}
  </ArtifactContent>
</Artifact>
```

### AgentCard
```typescript
// Implementation: Agent configuration display
// Views: AgentView, CodeCanvas, CoworkView

import { AgentCard, AgentHeader, AgentContent, AgentInstructions } from "@/components/ai-elements/agent";

<AgentCard>
  <AgentHeader name="Code Assistant" model="claude-3-5-sonnet" />
  <AgentContent>
    <AgentInstructions>
      You are a code assistant...
    </AgentInstructions>
  </AgentContent>
</AgentCard>
```

### Snippet
```typescript
// Implementation: Copyable code snippets
// Views: CodeCanvas, ChatView, AgentView

import { Snippet, SnippetInput, SnippetCopyButton } from "@/components/ai-elements/snippet";

<Snippet code="npm install ai">
  <SnippetInput />
  <SnippetCopyButton />
</Snippet>
```

### Commit
```typescript
// Implementation: Git commit display
// Views: AgentView, CodeCanvas

import { Commit, CommitHash, CommitMessage } from "@/components/ai-elements/commit";

<Commit>
  <CommitHash>abc1234</CommitHash>
  <CommitMessage>feat: add new feature</CommitMessage>
</Commit>
```

### StackTrace
```typescript
// Implementation: Error stack trace
// Views: CodeCanvas (error panel), CoworkView

import { StackTrace, StackTraceHeader, StackTraceError, StackTraceContent, StackTraceFrames } from "@/components/ai-elements/stack-trace";

<StackTrace trace={errorTrace}>
  <StackTraceHeader>
    <StackTraceError>
      <StackTraceErrorType>TypeError</StackTraceErrorType>
    </StackTraceError>
  </StackTraceHeader>
  <StackTraceContent>
    <StackTraceFrames />
  </StackTraceContent>
</StackTrace>
```

### TestResults
```typescript
// Implementation: Test output
// Views: CodeCanvas (CI panel), CoworkView

import { TestResults, TestResultsHeader, TestResultsSummary, TestResultsProgress } from "@/components/ai-elements/test-results";

<TestResults summary={{ passed: 8, failed: 1, skipped: 2, total: 11 }}>
  <TestResultsHeader>Test Results</TestResultsHeader>
  <TestResultsSummary />
  <TestResultsProgress />
</TestResults>
```

### EnvironmentVariables
```typescript
// Implementation: .env editor
// Views: CodeCanvas (settings), CoworkView

import { EnvironmentVariables } from "@/components/ai-elements/environment-variables";

<EnvironmentVariables>
  {/* Variable editor content */}
</EnvironmentVariables>
```

### PackageInfo
```typescript
// Implementation: package.json display
// Views: CodeCanvas (dependencies), CoworkView

import { PackageInfo } from "@/components/ai-elements/package-info";

<PackageInfo name="react" version="^18.0.0" />
```

### JSXPreview
```typescript
// Implementation: Live React preview
// Views: CoworkView (JSX artifacts), CodeCanvas

import { JSXPreview, JSXPreviewContent, JSXPreviewError } from "@/components/ai-elements/jsx-preview";

<JSXPreview jsx="<div>Hello World</div>">
  <JSXPreviewContent />
  <JSXPreviewError />
</JSXPreview>
```

### SchemaDisplay
```typescript
// Implementation: API schema viewer
// Views: CodeCanvas (API docs), CoworkView

import { SchemaDisplay } from "@/components/ai-elements/schema-display";

<SchemaDisplay 
  method="POST" 
  path="/api/users" 
  description="Create a new user"
/>
```

---

## Implementation Priority

### Phase 1: Core Code Workspace (CodeCanvas)
- [x] CodeBlock (already in ChatView, add to CodeCanvas)
- [x] Terminal (already implemented)
- [x] WebPreview (already implemented)
- [x] FileTree (placeholder, needs proper implementation)
- [x] Sandbox (placeholder, needs proper implementation)

### Phase 2: Artifact Support (CoworkView)
- [x] Artifact (already implemented)
- [x] CodeBlock (add to artifact renderer)
- [x] Sandbox (add to artifact renderer)
- [x] WebPreview (already implemented)
- [x] JSXPreview (add to artifact renderer)

### Phase 3: Developer Tools
- [x] Snippet (add to CodeCanvas suggestions)
- [x] StackTrace (add error panel)
- [x] TestResults (add CI panel)
- [x] EnvironmentVariables (add settings)
- [x] PackageInfo (add dependencies panel)
- [x] SchemaDisplay (add API docs)

### Phase 4: Agent & Git
- [x] AgentCard (already in AgentView)
- [x] Commit (already in AgentView)

---

## Current Implementation Status

| Component | ChatView | CodeCanvas | CoworkView | AgentView | ElementsLab |
|-----------|----------|------------|------------|-----------|-------------|
| AgentCard | - | - | - | ✅ | ✅ |
| Artifact | - | - | ✅ | - | ✅ |
| CodeBlock | ✅ | ⚠️ | ✅ | - | ✅ |
| Commit | - | - | - | ✅ | ✅ |
| EnvironmentVariables | - | ⚠️ | - | - | ✅ |
| FileTree | - | ⚠️ | - | - | ✅ |
| JSXPreview | - | - | ✅ | - | ✅ |
| PackageInfo | - | ⚠️ | - | - | ✅ |
| Sandbox | - | ⚠️ | ✅ | - | ✅ |
| SchemaDisplay | - | ⚠️ | - | - | ✅ |
| Snippet | - | ⚠️ | - | - | ✅ |
| StackTrace | - | ⚠️ | - | - | ✅ |
| Terminal | - | ✅ | - | - | ✅ |
| TestResults | - | ⚠️ | - | - | ✅ |
| WebPreview | ✅ | ✅ | ✅ | - | ✅ |

**Legend:**
- ✅ Fully implemented
- ⚠️ Partial/placeholder implementation
- ❌ Not implemented
- `-` Not applicable
