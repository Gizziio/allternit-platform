# A2R Vision Brain Runtime Integration

This document describes the brain runtime integration for A2R Vision, enabling desktop automation as a tool within brain sessions with autonomous vision model switching.

## Architecture Overview

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
│                  A2R Vision Service (Port 3007)                    │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Screenshot │  │   Action    │  │   Status    │             │
│  │   Capture   │  │  Execution  │  │   Monitor   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Brain Adapter (`src/brain_adapter.py`)

Core integration module providing:

- **Tool Registration**: Registers `desktop_control` tool with brain runtime
- **Event Streaming**: Streams A2R Vision actions as brain events
- **Session Context**: Maintains desktop state across interactions
- **Model Routing**: Autonomous vision model switching
- **Receipt Generation**: Generates immutable receipts for all desktop operations (G0501)
- **Safety Interception**: Policy enforcement via Rust Bridge (G0502)

### 2. Enhanced Main Service (`src/main.py`)

Extended FastAPI service with brain endpoints:

```
GET  /v1/brain/tools              - List available tools
POST /v1/sessions/{id}/desktop/execute         - Execute task
POST /v1/sessions/{id}/desktop/execute/stream  - Stream execution
GET  /v1/sessions/{id}/context    - Get session context
POST /v1/sessions/{id}/correction - Record user correction
POST /v1/brain/vision-model/check - Check if vision model needed
GET  /v1/receipts/{receipt_id}    - Retrieve specific receipt by ID (G0501)
GET  /health                      - Health check
```

### 3. Frontend Integration (`apps/shell/src/services/a2r-vision-brain/`)

React hooks and API client:

- `useUITarsBrain()` - Hook for desktop automation
- `useVisionModelSwitch()` - Hook for model switching
- `ToolCallView` - Component for rendering A2R Vision events

## Event Types

A2R Vision streams these event types during desktop automation:

| Event Type | Description |
|------------|-------------|
| `tool_call.started` | Desktop automation initiated |
| `tool_call.thinking` | Vision model reasoning |
| `tool_call.screenshot` | Screenshot captured |
| `tool_call.action` | Action executed (click, type, etc) |
| `tool_call.progress` | Progress update |
| `tool_call.completed` | Task completed |
| `tool_call.error` | Error occurred |
| `tool_call.receipt` | Receipt generated for action (G0501) |
| `attachment` | Screenshot attachment |
| `reasoning` | Agent thoughts |
| `model.switch` | Model switched to vision |

## Receipt Generation (G0501)

The A2R Vision Operator now generates comprehensive receipts for all desktop operations, compliant with the A2R Receipt schema (`spec/Contracts/Receipt.schema.json`). Each action produces an immutable receipt that includes:

- Content integrity verification via input/output hashes
- Artifact manifest for generated content
- Execution metadata and timing information
- Policy decision references
- Traceability information

Receipts are stored locally in `/.a2r/receipts/` and submitted to the governance kernel for centralized tracking.

## Tool Schema

```typescript
{
  name: "desktop_control",
  description: "Control native desktop applications using A2R Vision automation",
  parameters: {
    type: "object",
    properties: {
      app: {
        type: "string",
        description: "Application name (e.g., 'Finder', 'VS Code')"
      },
      instruction: {
        type: "string",
        description: "Natural language instruction"
      },
      use_vision: {
        type: "boolean",
        default: true,
        description: "Use vision-based reasoning"
      },
      confirmation_required: {
        type: "boolean",
        default: false,
        description: "Ask before destructive actions"
      }
    },
    required: ["instruction"]
  }
}
```

## Vision Model Autonomous Switching

### Detection

The system automatically detects when vision model should be used:

```python
vision_keywords = [
    "screenshot", "screen", "visual", "look at", "see", "image",
    "desktop", "app", "application", "window", "ui", "interface",
    "click", "type", "press", "button", "menu", "finder",
    "what's on my screen", "what do you see"
]
```

### Configuration

Users configure vision models via A2R:

```yaml
# ~/.config/a2r/models.yaml
models:
  default:
    provider: openrouter
    model: anthropic/claude-3.5-sonnet
    
  vision:
    provider: openrouter
    model: qwen/qwen2-vl-72b-instruct
    temperature: 0.1
    
  desktop:
    model: qwen/qwen2-vl-72b-instruct
    auto_switch: true
```

## Usage Examples

### Basic Desktop Control

```typescript
import { useUITarsBrain } from '../services/a2r-vision-brain';

function DesktopAutomationComponent({ sessionId }) {
  const { execute, isExecuting, progress } = useUITarsBrain({
    sessionId,
    onEvent: (event) => console.log('Event:', event)
  });
  
  const handleOpenCalculator = async () => {
    const result = await execute({
      app: 'Calculator',
      instruction: 'Open Calculator and compute 123 * 456',
      use_vision: true
    });
    console.log('Result:', result);
  };
  
  return (
    <button onClick={handleOpenCalculator} disabled={isExecuting}>
      {isExecuting ? `Progress: ${progress?.percent_complete}%` : 'Open Calculator'}
    </button>
  );
}
```

### Streaming with Real-time Updates

```typescript
const { executeStreaming, currentScreenshot, agentReasoning } = useUITarsBrain({
  sessionId
});

const handleStreamingTask = async () => {
  await executeStreaming({
    app: 'Finder',
    instruction: 'Create a new folder called "Project A"'
  });
  // Updates currentScreenshot and agentReasoning in real-time
};
```

### Vision Model Switching

```typescript
import { useVisionModelSwitch } from '../services/a2r-vision-brain';

function IntentHandler({ sessionId, userInput }) {
  const { shouldUseVision, recommendedModel, checkIntent } = useVisionModelSwitch(sessionId);
  
  useEffect(() => {
    checkIntent(userInput);
  }, [userInput]);
  
  if (shouldUseVision) {
    return <div>Switching to vision model: {recommendedModel}</div>;
  }
  
  return <div>Using standard model</div>;
}
```

## Session Context

Shared state maintained across desktop interactions:

```typescript
interface DesktopSessionContext {
  session_id: string;
  active_app?: string;
  window_position?: WindowPosition;
  previous_actions: ActionRecord[];  // Last 50 actions
  user_corrections: UserCorrection[]; // Learned corrections
  created_at: string;
  updated_at: string;
}
```

## Integration with Intent Router

The intent router automatically routes desktop intents:

```typescript
// Intent Router Classification
const result = await router.classify("Open Calculator and compute 123 * 456");
// Result: { capability: 'desktop', confidence: 0.92, ... }

// Convert to spawn directive
const directive = router.toSpawnDirective(result);
// Result: { type: 'tool_call', toolCall: { tool: 'desktop_control', ... } }
```

## Running the Service

```bash
# Install dependencies
cd services/a2r-vision-operator
pip install -r requirements.txt

# Set environment variables
export A2R_VISION_INFERENCE_BASE="https://api.openrouter.ai/v1"
export A2R_VISION_INFERENCE_KEY="your-api-key"
export A2R_VISION_MODEL_NAME="qwen/qwen2-vl-72b-instruct"

# Run the service
python src/main.py
```

## Testing

```bash
# Check service health
curl http://localhost:3007/health

# Get tool definitions
curl http://localhost:3007/v1/brain/tools

# Execute desktop task
curl -X POST http://localhost:3007/v1/sessions/test-session/desktop/execute \
  -H "Content-Type: application/json" \
  -d '{"app": "Finder", "instruction": "List files"}'

# Check vision model requirement
curl -X POST http://localhost:3007/v1/brain/vision-model/check \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test", "intent": "Open Calculator"}'
```

## Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `A2R_VISION_INFERENCE_BASE` | - | Vision model API base URL |
| `A2R_VISION_INFERENCE_KEY` | - | API key for vision model |
| `A2R_VISION_MODEL_NAME` | a2r-vision-7b-qwen | Model to use |
| `A2R_VISION_PORT` | 3007 | Service port |
| `BRAIN_GATEWAY_URL` | http://localhost:3004 | Brain gateway endpoint |

## Future Enhancements

1. **Multi-step Chain Execution**: Execute complex multi-app workflows
2. **Action Confirmation UI**: Confirm destructive actions before execution
3. **Action Replay**: Replay previous successful actions
4. **Correction Learning**: Automatically improve from user corrections
5. **Screen Recording**: Record desktop sessions for debugging
