# Brain Runtime + UI-TARS Integration

Architecture for connecting UI-TARS desktop automation to the brain session system with autonomous vision model switching.

## Overview

UI-TARS should be a **tool** in the brain's toolkit, not a separate system. When the user wants desktop automation, the brain should:

1. Detect intent (via Intent Router)
2. Switch to vision model (autonomously)
3. Execute UI-TARS actions as tool calls
4. Stream results back to conversation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Intent Router                                │
│  (Natural language → capability classification)                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
┌─────────────────────┐   ┌─────────────────────┐
│   Browser Intent    │   │  Desktop Intent     │
│   → spawnBrowser()  │   │  → brain tool call  │
└─────────────────────┘   └──────────┬──────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Brain Session Runtime                         │
│                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
│  │   Standard    │    │    Vision     │    │   Tool Call   │   │
│  │     LLM       │◄──►│    Model      │◄──►│   Registry    │   │
│  │  (Default)    │    │ (Qwen2-VL,    │    │               │   │
│  │               │    │  GPT-4V, etc) │    │  ┌─────────┐  │   │
│  └───────────────┘    └───────────────┘    │  │desktop_ │  │   │
│         ▲                    ▲             │  │control │  │   │
│         │                    │             │  └────┬────┘  │   │
│         └────────────────────┘             │       │       │   │
│              Autonomous Switch             └───────┼───────┘   │
│                                                    │           │
└────────────────────────────────────────────────────┼───────────┘
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  UI-TARS Service (Port 3007)                    │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Screenshot │  │   Action    │  │   Status    │             │
│  │   Capture   │  │  Execution  │  │   Monitor   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Model Configuration

### Vision Model Selection

Users configure vision models through A2R model mapping:

```yaml
# ~/.config/a2r/models.yaml
models:
  # Default chat model
  default:
    provider: openrouter
    model: anthropic/claude-3.5-sonnet
    
  # Vision model (for UI-TARS)
  vision:
    provider: openrouter
    model: qwen/qwen2-vl-72b-instruct  # or gpt-4o, claude-3-opus, etc
    
  # Optional: Specific models for specific capabilities
  desktop:
    model: qwen/qwen2-vl-72b-instruct
    temperature: 0.1  # Lower for deterministic UI actions
```

### Autonomous Model Switching

When a desktop automation intent is detected:

```typescript
// Brain session model routing
class BrainSession {
  async processInput(input: string) {
    const intent = await intentRouter.classify(input);
    
    if (intent.intent.capability === 'desktop') {
      // Switch to vision model for this request
      const visionModel = await this.selectVisionModel();
      
      // Register UI-TARS as available tool
      const tools = [...defaultTools, desktopControlTool];
      
      // Execute with vision model + tools
      return await this.executeWithModel(visionModel, input, tools);
    }
    
    // Use default model for chat
    return await this.executeWithModel(defaultModel, input);
  }
  
  private async selectVisionModel(): Promise<ModelConfig> {
    // Priority: user desktop config → user vision config → default with vision flag
    return (
      this.config.models?.desktop ||
      this.config.models?.vision ||
      { ...this.config.models?.default, vision: true }
    );
  }
}
```

## Tool Schema

### Desktop Control Tool

```typescript
const desktopControlTool: ToolDefinition = {
  name: 'desktop_control',
  description: 'Control native desktop applications using UI-TARS automation',
  parameters: {
    type: 'object',
    properties: {
      targetApp: {
        type: 'string',
        description: 'Name of the application to control (e.g., "Finder", "VS Code")'
      },
      instruction: {
        type: 'string',
        description: 'Natural language instruction for what to do'
      },
      useVision: {
        type: 'boolean',
        description: 'Whether to use vision-based reasoning',
        default: true
      },
      confirmationRequired: {
        type: 'boolean',
        description: 'Whether to ask user before executing',
        default: false
      }
    },
    required: ['instruction']
  },
  
  async execute(params, context) {
    // Stream events to brain session
    context.emitEvent({
      type: 'tool_call.started',
      tool: 'desktop_control',
      parameters: params
    });
    
    // Get screenshot for vision model
    const screenshot = await uiTars.captureScreen();
    
    // Execute via UI-TARS
    const result = await uiTars.execute({
      ...params,
      screenshot: screenshot.base64,
      sessionId: context.sessionId
    });
    
    // Stream results
    for (const action of result.actions) {
      context.emitEvent({
        type: 'tool_call.action',
        action: action.type,
        target: action.target,
        description: action.description
      });
    }
    
    return {
      success: result.success,
      actionsTaken: result.actions.length,
      finalScreenshot: result.finalScreenshot,
      summary: result.summary
    };
  }
};
```

## Event Streaming

### Tool Call Events

```typescript
// Streamed during desktop automation
type DesktopAutomationEvent =
  | { type: 'tool_call.started'; tool: 'desktop_control'; parameters: object }
  | { type: 'tool_call.thinking'; reasoning: string }
  | { type: 'tool_call.screenshot'; image: string; annotation?: object }
  | { type: 'tool_call.action'; actionType: string; target: string; description: string }
  | { type: 'tool_call.progress'; step: number; total: number }
  | { type: 'tool_call.completed'; result: object }
  | { type: 'tool_call.error'; error: string };
```

### UI Integration

```tsx
// Brain session displays tool calls inline
function ToolCallView({ event }: { event: DesktopAutomationEvent }) {
  switch (event.type) {
    case 'tool_call.started':
      return <ToolCallCard tool={event.tool} parameters={event.parameters} />;
      
    case 'tool_call.screenshot':
      return <AnnotatedScreenshot image={event.image} annotation={event.annotation} />;
      
    case 'tool_call.action':
      return <ActionStep 
        type={event.actionType} 
        target={event.target}
        description={event.description}
      />;
      
    case 'tool_call.completed':
      return <ToolCallResult result={event.result} />;
  }
}
```

## UI-TARS API Extension

### Current (Standalone)

```python
# services/ui-tars-operator/main.py (current)
@app.post("/execute")
async def execute_task(instruction: str):
    # Execute and return result
    return {"success": True, "actions": [...]}
```

### Target (Brain Integrated)

```python
# services/ui-tars-operator/main.py (target)
@app.post("/v1/sessions/{session_id}/desktop/execute")
async def execute_brain_task(
    session_id: str,
    instruction: str,
    use_vision: bool = True,
    stream: bool = True
):
    """Execute desktop task as part of brain session"""
    
    # Join brain session
    session = await brain.get_session(session_id)
    
    # Stream events to brain
    async for event in ui_tars.execute_streaming(instruction):
        await session.emit_event({
            "type": f"tool_call.{event['type']}",
            "tool": "desktop_control",
            "data": event
        })
    
    return {"session_id": session_id, "status": "completed"}
```

## Example Flows

### Flow 1: Open App and Perform Task

```
User: "Open Calculator and compute 123 × 456"

1. Intent Router: classify → desktop (confidence: 0.92)
2. Brain Session: detects desktop capability needed
3. Model Switch: activate Qwen2-VL
4. Tool Call: desktop_control({
     targetApp: "Calculator",
     instruction: "Open Calculator and compute 123 × 456",
     useVision: true
   })
5. UI-TARS:
   - Screenshot current screen
   - Click Launchpad/Spotlight
   - Type "Calculator"
   - Press Enter
   - Click 1, 2, 3
   - Click ×
   - Click 4, 5, 6
   - Click =
   - Screenshot result
6. Brain Session:
   - Receive final result (56088)
   - Switch back to standard model
   - "The result of 123 × 456 is 56,088"
```

### Flow 2: Visual Analysis + Action

```
User: "What's wrong with this UI? [screenshot]"

1. Intent Router: classify → chat with vision (confidence: 0.88)
2. Brain Session: use vision model directly
3. Vision Model:
   - Analyze screenshot
   - "The button has poor contrast (2.1:1, should be 4.5:1)"
   - "Let me open Figma to show you the fix"
4. Intent Router (follow-up): classify → desktop
5. Tool Call: desktop_control({
     targetApp: "Figma",
     instruction: "Create a contrast comparison showing the fix"
   })
6. UI-TARS: Execute in Figma
7. Brain Session: "Here's the corrected color palette..."
```

### Flow 3: Multi-Step Chain

```
User: "Research TypeScript 5.5 features and create a summary in Notes"

1. Intent Router: classify → chain (3 steps)
   Step 1: browser - "research TypeScript 5.5"
   Step 2: chat - "summarize findings"
   Step 3: desktop - "create Notes document"
2. Execute Step 1:
   - spawnBrowser("typescript 5.5 features")
   - Extract content
3. Execute Step 2:
   - Vision model summarizes
4. Execute Step 3:
   - desktop_control({
       targetApp: "Notes",
       instruction: "Create new note with summary: [...]"
     })
5. Brain Session: "Done! Created summary in Notes."
```

## Implementation Phases

### Phase 1: Basic Integration
- [ ] Register `desktop_control` tool in brain runtime
- [ ] Simple model switching (desktop → vision model)
- [ ] Basic event streaming

### Phase 2: Enhanced UX
- [ ] Tool call UI in brain session
- [ ] Screenshot annotations
- [ ] Progress indicators

### Phase 3: Advanced Features
- [ ] Chain execution
- [ ] User confirmation for risky actions
- [ ] Action history/replay
- [ ] Multi-app workflows

## Configuration

```typescript
// apps/shell/src/config/brain.ts
export const BrainConfig = {
  models: {
    default: {
      provider: 'openrouter',
      model: 'anthropic/claude-3.5-sonnet',
    },
    vision: {
      provider: 'openrouter',
      model: 'qwen/qwen2-vl-72b-instruct',
      // UI-TARS optimized settings
      temperature: 0.1,
      max_tokens: 4096,
    }
  },
  
  capabilities: {
    desktop: {
      enabled: true,
      requireConfirmation: ['delete', 'format', 'send'],
      autoSwitchModel: true,
      visionModel: 'vision',
    },
    browser: {
      enabled: true,
      spawnNewCapsule: true,
    }
  },
  
  routing: {
    useIntentRouter: true,
    confidenceThreshold: 0.7,
    enableChains: true,
  }
};
```

## Security & Permissions

```typescript
// Desktop automation permission model
interface DesktopPermissions {
  // Per-app permissions
  apps: {
    [appName: string]: {
      allow: boolean;
      requireConfirmation: boolean;
      allowedActions: string[];
    }
  };
  
  // Global settings
  global: {
    requireConfirmationFor: ['delete', 'send_email', 'purchase'];
    maxActionsPerSession: 50;
    allowBackgroundApps: false;
  };
}

// Check before executing
async function checkPermission(action: DesktopAction): Promise<PermissionResult> {
  const perms = await loadPermissions();
  
  if (perms.global.requireConfirmationFor.includes(action.type)) {
    return { allowed: false, reason: 'confirmation_required' };
  }
  
  if (!perms.apps[action.targetApp]?.allow) {
    return { allowed: false, reason: 'app_not_allowed' };
  }
  
  return { allowed: true };
}
```

## Summary

This integration makes UI-TARS a seamless part of the brain runtime:

1. **Unified Interface**: Users talk to one agent, not "browser agent" vs "desktop agent"
2. **Natural Language**: No special commands needed - "Open Calculator" just works
3. **Smart Model Switching**: Vision models used automatically when needed
4. **Full Context**: Desktop actions are part of conversation history
5. **Observable**: Users see what the agent is doing via tool call UI
6. **Configurable**: Users choose their preferred vision models via A2R

The result: A single agent that can browse the web, control native apps, and maintain context across both.
