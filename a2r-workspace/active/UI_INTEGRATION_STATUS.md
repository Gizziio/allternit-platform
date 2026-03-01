# UI Integration Status - Agent-Assisted Compute Wizard

**Date:** 2026-02-23  
**Status:** UI COMPONENTS COMPLETE | INTEGRATION IN PROGRESS

---

## What Was Built

### New UI Components

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| **AgentAssistedBrowser** | `AgentAssistedBrowser.tsx` | In-app browser with agent guidance | ✅ Complete |
| **HumanCheckpointBanner** | `HumanCheckpointBanner.tsx` | Human action required UI | ✅ Complete |
| **Wizard API Client** | `api-client.ts` | TypeScript API bindings | ✅ Complete |

### Component Details

#### 1. AgentAssistedBrowser (200+ lines)

**Features:**
- Browser-like header with navigation controls
- URL bar showing current page
- Agent status indicator (👁️ observing, 🎯 highlighting, 🙋 waiting, etc.)
- Guidance messages panel (info/warning/error/success/action)
- Iframe for provider signup page
- Highlights overlay (would render on top of iframe in production)

**States:**
```typescript
type GuidanceState = 
  | 'observing'
  | 'highlighting'
  | 'autofilling'
  | 'waitingForHuman'
  | 'resuming'
  | 'complete';
```

**Props:**
```typescript
interface AgentAssistedBrowserProps {
  url: string;
  highlights: GuidanceHighlight[];
  messages: GuidanceMessage[];
  state: GuidanceState;
  onHumanComplete: () => void;
  onNavigate: (url: string) => void;
}
```

---

#### 2. HumanCheckpointBanner (180+ lines)

**Features:**
- Checkpoint-specific icons and titles
- Guidance message display
- Instructions for each checkpoint type
- Warning about human requirement
- Confirmation checkbox ("I have completed this step")
- Resume button with loading state
- Progress indicator (Select → Signup → Checkpoint → Deploy)

**Checkpoint Types:**
```typescript
type CheckpointType = 
  | 'payment'
  | 'captcha'
  | 'emailVerification'
  | 'phoneVerification'
  | 'identityVerification'
  | 'termsAcceptance';
```

**Props:**
```typescript
interface HumanCheckpointBannerProps {
  checkpointType: CheckpointType;
  guidanceMessage: string;
  onResume: () => void;
  isResuming?: boolean;
}
```

---

#### 3. Wizard API Client

**New Methods:**
```typescript
async startWizard(request: StartWizardRequest): Promise<WizardState>
async getWizardState(deploymentId: string): Promise<WizardState>
async advanceWizard(deploymentId: string): Promise<WizardState>
async resumeWizard(deploymentId: string, checkpointType: string): Promise<WizardState>
async cancelWizard(deploymentId: string): Promise<void>
```

**TypeScript Types:**
```typescript
interface WizardState {
  deployment_id: string;
  current_step: string;
  context: WizardContext;
  timestamps: WizardTimestamps;
  retry_count: number;
  progress: number;
}

interface WizardContext {
  provider?: string;
  api_token?: string;
  ssh_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_private_key?: string;
  instance_id?: string;
  instance_ip?: string;
  provider_signup_url?: string;
  agent_guidance: string[];
}
```

---

## Integration Points

### Backend ↔ UI Mapping

| Backend (Rust) | UI (TypeScript) |
|----------------|-----------------|
| `WizardState` | `WizardState` |
| `WizardContext` | `WizardContext` |
| `WizardStep::HumanPaymentCheckpoint` | `checkpointType: 'payment'` |
| `AgentGuidanceOverlay` | `AgentAssistedBrowser` |
| `CheckpointStore` | (API persistence) |

### API Endpoints

| Endpoint | Method | UI Method |
|----------|--------|-----------|
| `/api/v1/wizard/start` | POST | `startWizard()` |
| `/api/v1/wizard/:id` | GET | `getWizardState()` |
| `/api/v1/wizard/:id/advance` | POST | `advanceWizard()` |
| `/api/v1/wizard/:id/resume` | POST | `resumeWizard()` |
| `/api/v1/wizard/:id/cancel` | POST | `cancelWizard()` |

---

## What's Still Needed

### 1. Wire Components to CloudDeployView

The existing `CloudDeployView.tsx` needs to be updated to:
- Use new wizard API methods
- Render `AgentAssistedBrowser` during signup step
- Render `HumanCheckpointBanner` at human checkpoints
- Sync wizard state with backend

### 2. Real Browser Integration

The current iframe approach has limitations:
- Cross-origin restrictions prevent DOM manipulation
- Can't actually highlight elements in provider pages
- Can't auto-fill fields across origins

**Production Solution:**
- Use Electron `BrowserView` or Tauri webview
- Inject guidance overlay via devtools protocol
- Or: Use browser automation (Playwright) in separate process

### 3. State Synchronization

Need to add:
- Polling or WebSocket for wizard state updates
- Optimistic UI updates
- Error handling and retry logic

### 4. Testing

Need to add:
- Component unit tests
- Integration tests with mock API
- E2E tests with real provider signup flows

---

## Usage Example

```tsx
import { AgentAssistedBrowser } from './components/AgentAssistedBrowser';
import { HumanCheckpointBanner } from './components/HumanCheckpointBanner';
import { cloudDeployApi, type WizardState } from './lib/api-client';

function WizardView() {
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [isResuming, setIsResuming] = useState(false);

  // Start wizard
  const handleStart = async (provider: string) => {
    const state = await cloudDeployApi.startWizard({
      provider,
      api_token: undefined,  // Will get from signup
    });
    setWizardState(state);
  };

  // Advance wizard
  const handleAdvance = async () => {
    const state = await cloudDeployApi.advanceWizard(wizardState.deployment_id);
    setWizardState(state);
  };

  // Resume after human action
  const handleResume = async (checkpointType: string) => {
    setIsResuming(true);
    const state = await cloudDeployApi.resumeWizard(
      wizardState.deployment_id,
      checkpointType
    );
    setWizardState(state);
    setIsResuming(false);
  };

  // Render based on state
  if (wizardState?.current_step === 'HumanPaymentCheckpoint') {
    return (
      <HumanCheckpointBanner
        checkpointType="payment"
        guidanceMessage="Please complete payment..."
        onResume={() => handleResume('payment')}
        isResuming={isResuming}
      />
    );
  }

  if (wizardState?.context.provider_signup_url) {
    return (
      <AgentAssistedBrowser
        url={wizardState.context.provider_signup_url}
        highlights={[]}  // Would come from backend
        messages={wizardState.context.agent_guidance.map(text => ({
          text,
          messageType: 'info' as const,
          requiresAck: false,
        }))}
        state={wizardState.current_step === 'AwaitingHumanAction' 
          ? 'waitingForHuman' 
          : 'highlighting'}
        onHumanComplete={() => handleResume('payment')}
        onNavigate={(url) => {}}
      />
    );
  }

  return <div>Wizard loading...</div>;
}
```

---

## Next Steps

1. **Update CloudDeployView** to use new components
2. **Add state polling** for wizard updates
3. **Handle errors** gracefully
4. **Add loading states** throughout
5. **Test with real providers**

---

**End of UI Integration Status**
