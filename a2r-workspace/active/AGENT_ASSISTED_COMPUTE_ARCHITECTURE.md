# Agent-Assisted Compute Setup Architecture

**Date:** 2026-02-21  
**Status:** Architecture Complete  
**Implementation:** Ready for UI Integration

---

## Executive Summary

**Problem:** Non-technical users want compute without understanding VPS, SSH, tokens, or regions.

**Solution:** Agent-assisted infrastructure provisioning with human checkpoints at sensitive steps.

**Key Innovation:** Hybrid model that combines:
- Agent automation for non-sensitive tasks
- Human checkpoints for payment/CAPTCHA/verification
- Affiliate monetization without owning infra
- Enterprise BYOC with API-based provisioning

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ShellUI                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Agent-Assisted Wizard                     │ │
│  │                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │ │
│  │  │ In-App       │  │ Guidance     │  │ Human      │  │ │
│  │  │ Browser      │  │ Overlay      │  │ Checkpoint │  │ │
│  │  │              │  │              │  │            │  │ │
│  │  │ • Navigate   │  │ • Highlight  │  │ • Payment  │  │ │
│  │  │ • Auto-fill  │  │ • Messages   │  │ • CAPTCHA  │  │ │
│  │  │ • Extract    │  │ • Progress   │  │ • Verify   │  │ │
│  │  └──────────────┘  └──────────────┘  └────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              A2R Cloud Wizard                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ State        │  │ Capability   │  │ Preflight    │      │
│  │ Machine      │  │ Matrix       │  │ Validation   │      │
│  │              │  │              │  │              │      │
│  │ • Checkpoints│  │ • Providers  │  │ • Validate   │      │
│  │ • Progress   │  │ • OS Support │  │ • Quotas     │      │
│  │ • Retry      │  │ • Auth       │  │ • Connectivity│     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Bootstrap    │  │ Verification │  │ Provider     │      │
│  │ Contract     │  │              │  │ Drivers      │      │
│  │              │  │              │  │              │      │
│  │ • Idempotent │  │ • Health     │  │ • Hetzner    │      │
│  │ • OS Detect  │  │ • Version    │  │ • DO         │      │
│  │ • Package Mgr│  │ • Enrollment │  │ • AWS        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Three Deployment Modes

### Mode 1: Agent-Assisted BYOC (Consumer)

**Flow:**
```
1. User opens wizard
2. Agent opens in-app browser to provider signup
3. Agent auto-fills non-sensitive fields (email, name)
4. Agent pauses at payment/CAPTCHA
5. User completes sensitive steps
6. Agent resumes, guides token creation
7. Agent validates token instantly
8. Agent provisions and installs
9. User has working compute
```

**Human Checkpoints:**
- Payment completion
- CAPTCHA completion
- Email/phone verification
- Identity verification

**Agent Automation:**
- Page navigation
- Form filling (non-sensitive)
- Token extraction guidance
- Validation
- Provisioning
- Installation

**Monetization:**
- Affiliate links (5-15% commission)
- Concierge setup tier ($29-99 one-time)
- Pro subscription ($29/month)

---

### Mode 2: API-Based BYOC (Enterprise)

**Flow:**
```
1. User selects "Connect Cloud Account"
2. User provides API token (or OAuth)
3. Agent validates credentials
4. Agent provisions in user's cloud
5. Agent installs A2R
6. User has working compute in their cloud
```

**Providers:**
- Hetzner (API token)
- DigitalOcean (API token)
- AWS (API token or IAM role)

**Monetization:**
- Enterprise subscription ($299/month)
- Managed compute markup (10-20%)
- Support contracts

---

### Mode 3: Manual SSH (Universal Fallback)

**Flow:**
```
1. User selects "I Have a Server"
2. User provides SSH host + key
3. Agent validates SSH connection
4. Agent detects OS
5. Agent runs bootstrap
6. User has working compute
```

**Use Cases:**
- Existing VPS
- On-prem servers
- Raspberry Pi
- Any SSH-accessible machine

---

## State Machine with Human Checkpoints

```rust
pub enum WizardStep {
    SelectProvider,              // Agent automates
    AgentAssistedSignup,         // Agent navigates + fills
    HumanPaymentCheckpoint,      // HUMAN: Payment
    HumanVerificationCheckpoint, // HUMAN: CAPTCHA/Verify
    EnterCredentials,            // Agent guides
    ValidateCredentials,         // Agent validates
    Preflight,                   // Agent checks
    Provisioning,                // Agent provisions
    Bootstrap,                   // Agent installs
    Verification,                // Agent verifies
    Complete,
    Failed,
    Cancelled,
    AwaitingHumanAction,         // HUMAN: Any action
}
```

**Key Methods:**
```rust
impl WizardStep {
    pub fn requires_human(&self) -> bool {
        // Returns true for payment/CAPTCHA/verification
    }
    
    pub fn can_automate(&self) -> bool {
        // Returns true for agent-automatable steps
    }
}
```

---

## Guidance Overlay System

```rust
pub struct AgentGuidanceOverlay {
    state: GuidanceState,      // Observing, Highlighting, Waiting
    messages: Vec<GuidanceMessage>,  // What to tell user
    highlights: Vec<ElementHighlight>,  // What to click
    auto_fill: Vec<AutoFillField>,  // What to auto-fill
}
```

**Guidance States:**
- `Observing` - Agent analyzes page
- `Highlighting` - Agent highlights elements
- `AutoFilling` - Agent fills forms
- `WaitingForHuman` - Agent paused for human
- `Resuming` - Agent resuming after human

**Example Flow:**
```
1. Agent navigates to Hetzner signup
2. Agent highlights email field (green)
3. Agent auto-fills email
4. Agent highlights password field (green)
5. Agent pauses (password is sensitive)
6. User enters password
7. Agent highlights "Continue" button (blue)
8. Agent pauses at CAPTCHA
9. User completes CAPTCHA
10. Agent pauses at payment
11. User completes payment
12. Agent resumes, guides to API token page
```

---

## Affiliate/Referral Tracking

```rust
pub struct AffiliateTracker {
    affiliate_id: String,
    clicks: Vec<AffiliateClick>,
    conversions: Vec<AffiliateConversion>,
}
```

**Known Programs:**

| Provider | Commission | Cookie Duration | Min Payout |
|----------|-----------|-----------------|------------|
| Hetzner | 5% of spend | 90 days | €50 |
| DigitalOcean | $25 + 15% | 30 days | $0 |
| Linode | $25 + 10% | 90 days | $0 |
| Vultr | Up to $100 | 30 days | $50 |

**Revenue Model:**
```
Free Tier:
- Affiliate links shown
- No managed compute
- No concierge

Pro Tier ($29/month):
- Affiliate links shown
- $100 compute credits
- Concierge setup

Enterprise Tier ($299/month):
- No affiliate links
- $1000 compute credits
- 20% compute markup
- Dedicated support
```

---

## Safe Automation Boundaries

### What Agent CAN Automate

✅ Page navigation
✅ Form filling (non-sensitive fields)
✅ Button clicks
✅ Text extraction
✅ Screenshot capture
✅ Validation

### What Agent CANNOT Automate

❌ Payment completion
❌ CAPTCHA completion
❌ Identity verification
❌ Phone verification
❌ Password entry (can highlight, not auto-fill)
❌ Terms acceptance (can highlight, not auto-click)

### Implementation Pattern

```rust
pub struct AutomationStep {
    description: String,
    action: AutomationAction,
    is_sensitive: bool,  // If true, pause for human
}

pub enum AutomationAction {
    Navigate { url: String },      // Not sensitive
    Fill { selector: String, value: String },  // Check sensitivity
    Click { selector: String },    // Not sensitive
    WaitForHuman { reason: String },  // Always sensitive
}
```

---

## Integration with ShellUI

### In-App Browser Component

```tsx
<AgentAssistedBrowser
  wizardState={wizardState}
  guidance={guidanceOverlay}
  onHumanCheckpoint={handleHumanCheckpoint}
  onAutomationComplete={handleAutomationComplete}
/>
```

### Wizard UI States

```tsx
{wizardState.currentStep === 'HumanPaymentCheckpoint' && (
  <HumanCheckpointBanner
    message="Please complete payment. I'll resume once confirmed."
    onResumeClick={resumeWizard}
  />
)}

{wizardState.currentStep === 'AgentAssistedSignup' && (
  <GuidanceOverlay
    highlights={guidance.highlights}
    messages={guidance.messages}
  />
)}
```

---

## Monetization Configuration

```rust
pub struct MonetizationTier {
    name: String,
    monthly_price: f64,
    includes_managed_compute: bool,
    includes_concierge: bool,
    includes_affiliate: bool,
    compute_markup_percent: f64,
    max_compute_credits: f64,
}

pub fn get_default_tiers() -> Vec<MonetizationTier> {
    vec![
        MonetizationTier {
            name: "Free",
            monthly_price: 0.0,
            includes_affiliate: true,
            ..Default::default()
        },
        MonetizationTier {
            name: "Pro",
            monthly_price: 29.0,
            includes_concierge: true,
            includes_affiliate: true,
            compute_markup_percent: 10.0,
            max_compute_credits: 100.0,
        },
        MonetizationTier {
            name: "Enterprise",
            monthly_price: 299.0,
            includes_managed_compute: true,
            includes_affiliate: false,
            compute_markup_percent: 20.0,
            max_compute_credits: 1000.0,
        },
    ]
}
```

---

## Next Steps

### Phase 1: Core Integration (2 weeks)
1. Wire wizard to ShellUI in-app browser
2. Implement guidance overlay rendering
3. Add human checkpoint UI components
4. Integrate affiliate tracking

### Phase 2: Provider Scripts (2 weeks)
1. Hetzner automation script
2. DigitalOcean automation script
3. AWS automation script
4. Test with real provider signups

### Phase 3: Monetization (1 week)
1. Affiliate link integration
2. Tier configuration UI
3. Revenue tracking dashboard

### Phase 4: Enterprise Features (2 weeks)
1. OAuth-based cloud connection
2. Terraform module generation
3. Enterprise SSO integration

---

**End of Architecture Document**
