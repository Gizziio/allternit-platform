# A2R Agent-Assisted Compute Wizard - Audit Package

**Created:** 2026-02-23  
**Version:** 1.0.0  
**Total Lines:** ~2,500 lines of Rust code

---

## What's In This Archive

### Core Implementation (`a2r-cloud-wizard/`)

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib.rs` | Module exports | 33 |
| `src/capability.rs` | Supported surface matrix (providers/OS/auth) | 250 |
| `src/state_machine.rs` | Wizard state machine with human checkpoints | 340 |
| `src/preflight.rs` | Credential validation + connectivity checks | 280 |
| `src/bootstrap.rs` | Idempotent OS installer (Ubuntu/Debian/RHEL) | 300 |
| `src/verifier.rs` | Post-install verification (4 checks) | 180 |
| `src/provider.rs` | Provider driver trait + Hetzner/DO drivers | 250 |
| `src/failure_policy.rs` | Failure handling (cleanup vs preserve) | 160 |
| `src/guidance.rs` | Agent guidance overlay for browser | 350 |
| `src/affiliate.rs` | Affiliate tracking + monetization tiers | 280 |
| `src/handlers.rs` | Wizard API handlers | 200 |
| `src/routes.rs` | Wizard API routes | 150 |
| `src/api.rs` | Wizard API client | 180 |
| `src/state.rs` | Wizard state persistence | 120 |
| `src/types.rs` | Common types | 100 |

**Total:** ~2,800 lines

---

### Architecture Documentation

| File | Purpose |
|------|---------|
| `AGENT_ASSISTED_COMPUTE_ARCHITECTURE.md` | Full architecture spec |

---

## Key Features

### 1. Human Checkpoint System

```rust
pub enum WizardStep {
    // Agent automates these
    SelectProvider,
    AgentAssistedSignup,
    ValidateCredentials,
    Preflight,
    Provisioning,
    Bootstrap,
    Verification,
    
    // Human completes these
    HumanPaymentCheckpoint,      // Payment
    HumanVerificationCheckpoint, // CAPTCHA/Verify
    AwaitingHumanAction,         // Generic wait
}
```

### 2. Guidance Overlay

```rust
pub struct AgentGuidanceOverlay {
    state: GuidanceState,
    messages: Vec<GuidanceMessage>,
    highlights: Vec<ElementHighlight>,
    auto_fill: Vec<AutoFillField>,
}
```

### 3. Affiliate Monetization

```rust
pub struct AffiliateTracker {
    affiliate_id: String,
    clicks: Vec<AffiliateClick>,
    conversions: Vec<AffiliateConversion>,
}

// Known programs:
// - Hetzner: 5% commission
// - DigitalOcean: $25 + 15%
// - Linode: $25 + 10%
// - Vultr: Up to $100
```

### 4. Monetization Tiers

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

// Tiers:
// - Free: $0, affiliate links
// - Pro: $29/mo, concierge, $100 credits
// - Enterprise: $299/mo, managed compute, 20% markup
```

---

## The Complete Flow

```
User Opens Wizard
       │
       ▼
Agent Opens Provider Signup (in-app browser)
       │
       ▼
Agent Auto-fills Non-sensitive Fields
       │
       ▼
HUMAN CHECKPOINT (Agent Pauses)
├─ Payment
├─ CAPTCHA
└─ Identity Verification
       │
       ▼ (User Completes)
Agent Resumes + Guides Token Creation
       │
       ▼
Agent Validates Token
       │
       ▼
Agent Provisions VPS
       │
       ▼
Agent Installs A2R (idempotent bootstrap)
       │
       ▼
Agent Verifies (4 checks)
       │
       ▼
Complete! (Affiliate commission tracked)
```

---

## Build Instructions

```bash
cd a2r-cloud-wizard
cargo build
cargo test
```

**Dependencies:**
- tokio (async runtime)
- serde (serialization)
- reqwest (HTTP client)
- uuid (unique IDs)
- chrono (timestamps)

---

## Integration Points

### ShellUI Integration

```tsx
<AgentAssistedBrowser
  wizardState={wizardState}
  guidance={guidanceOverlay}
  onHumanCheckpoint={handleHumanCheckpoint}
  onAutomationComplete={handleAutomationComplete}
/>
```

### Wizard API

```rust
// Create wizard
let wizard = WizardState::new();

// Advance step
wizard.advance()?;

// Check if can automate
if wizard.current_step.can_automate() {
    agent.automate().await?;
} else if wizard.current_step.requires_human() {
    // Wait for human
    wizard.await_human().await?;
}
```

---

## Testing

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_wizard_state_machine

# Run with output
cargo test -- --nocapture
```

---

## Next Steps (UI Integration)

1. **In-app browser component** - Embed browser in ShellUI
2. **Guidance overlay rendering** - Show highlights/messages
3. **Human checkpoint UI** - "I've completed payment" button
4. **Affiliate link tracking** - Click/conversion tracking
5. **Tier configuration UI** - Free/Pro/Enterprise selector

---

## Contact

For questions about this implementation, refer to:
- `AGENT_ASSISTED_COMPUTE_ARCHITECTURE.md` - Full architecture
- Source code comments - Inline documentation

---

**End of README**
