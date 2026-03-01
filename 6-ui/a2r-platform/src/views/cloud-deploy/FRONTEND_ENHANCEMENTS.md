# Cloud Deploy Frontend Enhancements Roadmap

## Current Status

### ✅ Backend (Complete)
- SQLite persistent storage for deployments
- WebSocket real-time events (`/api/v1/deployments/{id}/events`)
- Multi-provider abstraction layer:
  - Hetzner (fully implemented)
  - AWS (placeholder)
  - DigitalOcean (placeholder)
  - GCP (placeholder)
  - Azure (placeholder)
  - **Contabo** (newly added - needs testing)
  - **RackNerd** (newly added - needs testing)
- SSH key generation and management
- Cloud-init script deployment
- Full REST API coverage
- Wizard-based agent-assisted flow

### ⚠️ Frontend (Needs Enhancement)
Current components work but lack advanced features for production use.

---

## Enhancement Areas

### 1. 🔍 Provider Selection Enhancement

**Current State:** Basic card grid with provider info

**Enhancements Needed:**
- [ ] **Feature Comparison Table**: Side-by-side comparison of all 7 providers
  - Pricing (hourly/monthly)
  - Instance types available
  - Region coverage
  - API automation level
  - Setup time estimates
- [ ] **Provider Search/Filter**: Filter by region, price range, features
- [ ] **Recommendation Engine**: Suggest best provider based on:
  - User location (nearest region)
  - Budget constraints
  - Instance requirements (RAM/CPU)
- [ ] **Provider Status Indicator**: Show provider API health/status

**Files to Modify:**
- `components/steps/Step2ProviderSelection.tsx`
- `data/providers.ts` (add more metadata)

---

### 2. 📡 Real-Time Progress Tracking

**Current State:** WebSocket connected but limited event display

**Enhancements Needed:**
- [ ] **Live Event Log**: Scrollable feed of deployment events with timestamps
- [ ] **Visual Timeline**: Animated step-by-step progress
- [ ] **Provider-Specific Steps**: Different progress steps per provider
- [ ] **Estimated Time Remaining**: Calculate based on current step + historical data
- [ ] **Download Logs Button**: Export deployment logs for debugging
- [ ] **Auto-Retry on Error**: Configurable retry logic with exponential backoff

**Files to Modify:**
- `components/DeploymentProgress.tsx`
- `CloudDeployView.tsx` (WebSocket handling)

---

### 3. 🔐 SSH Key Management UI

**Current State:** No dedicated SSH key management

**Enhancements Needed:**
- [ ] **Key List View**: Display all stored SSH keys
  - Key name, fingerprint, created date, associated instances
- [ ] **Generate New Key Pair**: Client-side or server-side generation
- [ ] **Import Existing Key**: Paste or upload private/public key files
- [ ] **Key Association**: Link keys to specific deployments
- [ ] **Secure Storage**: Encrypt keys at rest (browser or backend)
- [ ] **Download Keys**: Export private keys (with security warning)

**New Files:**
- `components/SSHKeyManager.tsx`
- `pages/SSHKeysPage.tsx`

---

### 4. 📜 Deployment History Dashboard

**Current State:** No history view

**Enhancements Needed:**
- [ ] **Deployment List**: Paginated list of all past deployments
  - Filter by: status, provider, date range
  - Sort by: date, status, provider
- [ ] **Deployment Details View**: Full info for each deployment
  - Configuration used
  - Event history
  - Final status and error messages
  - Instance details (if successful)
- [ ] **Re-deploy Feature**: One-click re-deployment with same config
- [ ] **Deployment Analytics**: Success rate by provider, average deploy time

**New Files:**
- `pages/DeploymentHistoryPage.tsx`
- `components/DeploymentList.tsx`

---

### 5. 🔄 Error Recovery & Retry Logic

**Current State:** Basic error display, no recovery options

**Enhancements Needed:**
- [ ] **Error Classification**: Categorize errors (auth, network, quota, etc.)
- [ ] **Contextual Help**: Show provider-specific troubleshooting steps
- [ ] **Retry with Modified Config**: Allow changing credentials/config before retry
- [ ] **Partial Recovery**: Resume from last successful checkpoint
- [ ] **Error Notifications**: Email/webhook notifications on failure

**Files to Modify:**
- `CloudDeployView.tsx`
- `components/DeploymentProgress.tsx`

---

### 6. 🖥️ Instance Management View

**Current State:** Basic table with mock data

**Enhancements Needed:**
- [ ] **Real Data Integration**: Connect to backend `/api/v1/instances`
- [ ] **Instance Actions**:
  - Start/Stop/Restart instances
  - View instance console/logs
  - Resize/upgrade instance
  - Destroy with confirmation
- [ ] **Instance Detail Panel**: Expanded view showing:
  - Full configuration
  - Network details (IP, DNS)
  - Resource usage graphs
  - Associated SSH keys
- [ ] **Bulk Actions**: Multi-select for batch operations
- [ ] **Cost Tracking**: Monthly spend by instance/provider

**Files to Modify:**
- `pages/InstancesPage.tsx`
- `lib/api-client.ts` (add instance management APIs)

---

### 7. 🎨 UI/UX Improvements

**Enhancements Needed:**
- [ ] **Dark Mode Support**: Full theming system
- [ ] **Responsive Design**: Mobile-friendly layouts
- [ ] **Loading States**: Skeleton screens, spinners
- [ ] **Empty States**: Helpful messaging when no data
- [ ] **Keyboard Navigation**: Full accessibility support
- [ ] **Onboarding Tour**: First-time user walkthrough

---

## Implementation Priority

### Phase 1: Core Functionality (Critical)
1. ✅ Multi-provider backend (COMPLETE)
2. 🔄 Real-time progress enhancement
3. 🖥️ Instance management with real data

### Phase 2: User Experience (High)
4. 🔐 SSH key management
5. 📜 Deployment history
6. 🔄 Error recovery

### Phase 3: Polish (Medium)
7. 🔍 Provider comparison/enhancement
8. 🎨 UI/UX improvements

---

## API Endpoints to Add/Verify

### Existing (Verify Working):
- `GET /api/v1/deployments` - List deployments
- `POST /api/v1/deployments` - Create deployment
- `GET /api/v1/deployments/{id}` - Get deployment status
- `DELETE /api/v1/deployments/{id}/cancel` - Cancel deployment
- `WS /api/v1/deployments/{id}/events` - WebSocket events
- `POST /api/v1/wizard/start` - Start wizard
- `GET /api/v1/wizard/{id}` - Get wizard state
- `POST /api/v1/wizard/{id}/advance` - Advance wizard
- `POST /api/v1/wizard/{id}/resume` - Resume wizard

### Needed for Enhancements:
- `GET /api/v1/instances` - List instances (real data)
- `POST /api/v1/instances/{id}/start` - Start instance
- `POST /api/v1/instances/{id}/stop` - Stop instance
- `POST /api/v1/instances/{id}/restart` - Restart instance
- `DELETE /api/v1/instances/{id}` - Destroy instance
- `GET /api/v1/ssh-keys` - List SSH keys
- `POST /api/v1/ssh-keys` - Create SSH key
- `DELETE /api/v1/ssh-keys/{id}` - Delete SSH key
- `GET /api/v1/deployments/{id}/logs` - Get deployment logs

---

## Files Structure

```
src/views/cloud-deploy/
├── CloudDeployView.tsx          # Main container (ENHANCE)
├── CloudDeployView.css
├── components/
│   ├── CloudDeployWizard.tsx    # 5-step wizard
│   ├── DeploymentProgress.tsx   # Real-time progress (ENHANCE)
│   ├── DeploymentComplete.tsx   # Success screen
│   ├── HumanCheckpointBanner.tsx
│   ├── SSHKeyManager.tsx        # NEW: SSH key management
│   ├── DeploymentList.tsx       # NEW: History list
│   ├── ProviderComparison.tsx   # NEW: Compare providers
│   └── steps/
│       ├── Step1DeploymentType.tsx
│       ├── Step2ProviderSelection.tsx  # ENHANCE
│       ├── Step3Configuration.tsx
│       ├── Step4Credentials.tsx
│       └── Step5Review.tsx
├── pages/
│   ├── InstancesPage.tsx        # ENHANCE with real data
│   ├── DeploymentHistoryPage.tsx # NEW
│   └── SSHKeysPage.tsx          # NEW
├── data/
│   └── providers.ts             # ENHANCE with more metadata
└── lib/
    └── api-client.ts            # ENHANCE with new endpoints
```
