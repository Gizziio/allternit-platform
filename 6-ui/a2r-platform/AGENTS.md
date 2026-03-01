# A2R Agent System Documentation

## Overview

The A2R Platform includes a comprehensive agent system with native tool execution, scheduled jobs, and interactive user questioning capabilities.

## Features

### 1. Native Agent Tools

Tools that agents can invoke during conversations:

| Tool | Description | Confirmation Required |
|------|-------------|----------------------|
| `ask_user` | Ask the user a question and wait for response | No |
| `read_file` | Read file contents from workspace | No |
| `write_file` | Write/modify files in workspace | Yes |
| `search_code` | Search codebase with patterns | No |
| `list_directory` | List directory contents | No |
| `schedule_job` | Create scheduled cron jobs | Yes |

### 2. Tool Hooks System

Pre and post tool execution hooks for:
- **Confirmation dialogs** - Require user approval before executing sensitive tools
- **Audit logging** - Track all tool executions
- **Access control** - Route tool calls through authorization checks

```typescript
import { useToolHooksStore, createConfirmationHook } from "@/lib/agents";

// Register a confirmation hook
const hooks = useToolHooksStore.getState();
hooks.registerPreToolUse("confirm-write", createConfirmationHook(
  (toolName) => toolName === "write_file"
));
```

### 3. AskUserQuestion System

Interactive question components for agents:

**Basic Usage:**
```typescript
import { AskUserQuestion, useAskUserQuestion } from "@/components/agents";

// Hook-based approach
const { askQuestion } = useAskUserQuestion();
const answer = await askQuestion({
  id: "confirm-delete",
  question: "Are you sure you want to delete these files?",
  type: "confirm",
});
```

**Wizard Flow:**
```typescript
import { AskUserQuestionWizard } from "@/components/agents";

const config = {
  title: "Project Setup",
  steps: [
    {
      id: "framework",
      title: "Choose Framework",
      question: "Which framework would you like to use?",
      type: "select",
      options: [
        {
          id: "react",
          label: "React",
          description: "Component-based UI library",
          preview: { type: "code", content: "import React from 'react';" }
        }
      ]
    }
  ],
  onComplete: (answers) => console.log(answers)
};
```

### 4. Scheduled Jobs (Cron)

Create and manage recurring agent tasks:

**Job Templates:**
- Code Review - Review recent commits
- Documentation Update - Auto-generate docs
- Dependency Check - Check for vulnerabilities
- Activity Summary - Summarize project activity
- Monitor & Alert - Watch logs/metrics
- File Organization - Auto-organize files
- Content Curation - Research and summarize content
- PR Preparation - Generate PR descriptions
- Smart Backup - Intelligent project backups

**Usage:**
```typescript
import { CronJobWizard } from "@/components/agents";

<CronJobWizard
  isOpen={showWizard}
  onClose={() => setShowWizard(false)}
  onSubmit={async (config) => {
    await createScheduledJob(config);
  }}
/>
```

**Job Runner:**
```typescript
import { startJobRunner, useJobRunner } from "@/lib/agents";

// Start the background runner
startJobRunner({
  pollInterval: 60000,  // Check every minute
  maxConcurrentJobs: 3,
  enableNotifications: true
});

// Or use the React hook
const { isRunning, start, stop } = useJobRunner();
```

### 5. Chat Integration

All tool interactions are integrated into the chat flow:

- **ToolCallVisualization** - Shows tool calls with expandable details
- **ToolConfirmation** - Inline confirmation dialogs
- **ToolQuestionDisplay** - Renders pending `ask_user` questions

## Architecture

### Tool Execution Flow

```
User Message
    ↓
Agent Processes
    ↓
Tool Call Detected
    ↓
Pre-Tool Hooks (confirmation, audit)
    ↓
Tool Execution
    ↓
Post-Tool Hooks (logging, cleanup)
    ↓
Result Displayed in Chat
```

### File Structure

```
src/
├── components/agents/
│   ├── AskUserQuestion.tsx        # Interactive question component
│   ├── AskUserQuestionWizard.tsx  # Multi-step wizard
│   ├── ToolCallVisualization.tsx  # Tool call display
│   ├── ToolConfirmation.tsx       # Confirmation dialogs
│   ├── CronJobWizard.tsx          # Scheduled job creation
│   └── AgentChatIntegration.tsx   # Chat integration
├── lib/agents/
│   ├── tools/
│   │   ├── ask-user.tool.ts       # ask_user implementation
│   │   ├── file-tools.ts          # File system tools
│   │   ├── tool-hooks.ts          # Hooks system
│   │   └── index.ts               # Tool registry
│   ├── scheduled-jobs.service.ts  # Job CRUD operations
│   ├── scheduled-jobs.runner.ts   # Background execution
│   └── native-agent.store.ts      # Agent state management
```

## Configuration

### Tool Registry

Tools are registered in `src/lib/agents/tools/index.ts`:

```typescript
import { registerTool } from "@/lib/agents";

registerTool(
  {
    name: "my_tool",
    description: "Does something useful",
    parameters: {
      type: "object",
      properties: {
        arg1: { type: "string" }
      }
    }
  },
  async (context, parameters) => {
    // Execute tool
    return { result: "success" };
  }
);
```

### Tool Registry Store

Configure tool behavior per session:

```typescript
import { useToolRegistryStore } from "@/lib/agents";

const registry = useToolRegistryStore.getState();

// Enable/disable tools
registry.toggleTool("write_file", true);

// Require confirmation
registry.setToolRequiresConfirmation("write_file", true);

// Per-session configuration
registry.toggleToolForSession("write_file", sessionId, true);
```

## API Reference

### Native Agent Store

```typescript
import { useNativeAgentStore } from "@/lib/agents";

const store = useNativeAgentStore.getState();

// Sessions
store.createSession(name, description);
store.sendMessageStream(sessionId, content);
store.executeTool(sessionId, toolName, parameters);

// State selectors
useActiveSession();
useActiveMessages();
useStreamingState();
```

### Scheduled Jobs

```typescript
import {
  createScheduledJob,
  listScheduledJobs,
  runScheduledJobNow,
  type CronJobConfig
} from "@/lib/agents";

const config: CronJobConfig = {
  name: "Daily Code Review",
  schedule: "0 9 * * *",  // Daily at 9am
  taskType: "code-review",
  prompt: "Review recent code changes...",
  enabled: true,
  maxRetries: 3,
  timeout: 30,
  notifyOnSuccess: false,
  notifyOnFailure: true
};

await createScheduledJob(config);
```

## Best Practices

1. **Always require confirmation for destructive operations** (write_file, delete)
2. **Use the wizard for complex multi-step questions** instead of chaining individual questions
3. **Enable notifications for critical scheduled jobs**
4. **Set appropriate timeouts** for long-running tools
5. **Use the audit hooks** for compliance tracking

## Troubleshooting

### Tool execution fails
- Check if tool is registered in `src/lib/agents/tools/index.ts`
- Verify confirmation hooks aren't blocking
- Check browser console for errors

### Scheduled jobs not running
- Ensure job runner is started with `startJobRunner()`
- Check if job is enabled (not paused)
- Verify cron expression is valid

### Questions not appearing
- Verify `ToolQuestionDisplay` is mounted in chat panel
- Check session ID matches
- Ensure `ask_user` tool is registered

## Testing

Run agent-related tests:

```bash
pnpm exec vitest run src/views/NativeAgentView.test.tsx
```

## Future Enhancements

- [ ] More tool types (API calls, database queries)
- [ ] Tool chaining/workflows
- [ ] Advanced scheduling (timezone support, exceptions)
- [ ] Job execution history UI
- [ ] Tool marketplace
