# A2R CLOUD LAYER - ARCHITECTURE SPECIFICATION

**Layer:** `8-cloud/`  
**Purpose:** Cloud deployment, VPS partnerships, and managed hosting  
**Status:** SPECIFICATION  
**Date:** 2026-02-21  
**Strategy:** BYOC (A) + Marketplace (C) First, Managed (B) Phase 3+

---

## 0. Strategic Decision

**Default Product Path:** Model A (BYOC) + Model C (Marketplace)

**Rationale:**
- ✅ Minimizes cash burn (no infra costs)
- ✅ Minimizes operational risk (customer owns VPS)
- ✅ Fastest time-to-credible-value
- ✅ Monetization via affiliate commissions
- ✅ Keeps door open for Managed Hosting later

**Managed Hosting (Model B) is Phase 3+ because:**
- It's a company transformation, not a feature
- Requires: incident response, abuse handling, backups, patching, billing, tenant isolation, security disclosures
- Only ship when: BYOC is boring/reliable + observability hardened + automated ops ready

---

## 1. Layer Overview

```
8-cloud/
├── a2r-cloud-core/           # Core traits, types, registry
├── a2r-cloud-providers/      # Provider implementations (Phase 1)
│   ├── aws/                  # Amazon Web Services
│   ├── digitalocean/         # DigitalOcean
│   ├── hetzner/              # Hetzner (budget)
│   ├── contabo/              # Contabo (budget)
│   └── racknerd/             # RackNerd (budget)
├── a2r-cloud-deploy/         # Deployment automation (Phase 1)
├── a2r-cloud-wizard/         # ShellUI wizard backend (Phase 1)
├── a2r-cloud-partnerships/   # Partnership marketplace (Phase 2)
├── a2r-cloud-managed/        # Managed hosting service (Phase 3+)
└── a2r-cloud-k8s/            # Kubernetes (Phase 4+)
```

---

## 2. Critical Success Factors for BYOC

### Credential Storage Policy

**Rule:** Never store provider secrets unless absolutely necessary.

```rust
// a2r-cloud-core/src/credentials.rs

pub struct CredentialPolicy {
    /// Prefer ephemeral credentials (use once, discard)
    pub ephemeral: bool,
    
    /// If storage required, encrypt at rest
    pub encryption: EncryptionConfig,
    
    /// Token scope (read-only, deploy-only, etc.)
    pub scope: TokenScope,
    
    /// Auto-rotate credentials
    pub rotation: RotationConfig,
}

impl CredentialPolicy {
    /// Default: ephemeral, scoped, no persistence
    pub fn default() -> Self {
        Self {
            ephemeral: true,
            encryption: EncryptionConfig::default(),
            scope: TokenScope::DeployOnly,
            rotation: RotationConfig::default(),
        }
    }
}
```

**Implementation:**
1. User enters credentials in wizard
2. Credentials used immediately for provisioning
3. Credentials discarded after deployment
4. Optional: encrypted storage for "saved deployments" (user opt-in)

---

### Preflight Checks

**Rule:** Validate everything BEFORE provisioning to avoid support hell.

```rust
// a2r-cloud-deploy/src/preflight.rs

pub struct PreflightChecker {
    provider: Box<dyn CloudProvider>,
}

impl PreflightChecker {
    pub async fn check(&self, config: &DeploymentConfig) -> Result<PreflightResult> {
        let mut errors = Vec::new();
        
        // 1. Validate credentials
        if !self.validate_credentials(&config.credentials).await {
            errors.push("Invalid API credentials");
        }
        
        // 2. Check quota availability
        match self.check_quota(&config.credentials, &config.region).await {
            Ok(quota) if quota.available_instances < 1 => {
                errors.push("Instance quota exceeded");
            }
            Err(_) => errors.push("Could not verify quota"),
            _ => {}
        }
        
        // 3. Check region availability
        if !self.region_available(&config.region).await {
            errors.push(format!("Region {} not available", config.region));
        }
        
        // 4. Check instance type availability
        if !self.instance_available(&config.region, &config.instance_type).await {
            errors.push(format!("Instance type {} not available in {}", 
                config.instance_type, config.region));
        }
        
        // 5. Validate firewall rules
        let required_ports = vec![22, 80, 443, 3000];
        if !self.check_firewall(&config.credentials, &required_ports).await {
            errors.push("Firewall blocks required ports (22, 80, 443, 3000)");
        }
        
        // 6. Check billing status
        if !self.check_billing_status(&config.credentials).await {
            errors.push("Account billing issue detected");
        }
        
        Ok(PreflightResult {
            passed: errors.is_empty(),
            errors,
            warnings: vec![],
        })
    }
}
```

**Wizard Integration:**
```
┌─────────────────────────────────────────────┐
│  Step 4: Preflight Checks                   │
│                                             │
│  ✓ Credentials validated                    │
│  ✓ Quota available (5 instances remaining)  │
│  ✓ Region us-west-2 available               │
│  ✓ Instance t3.medium available             │
│  ⚠ Firewall: Port 3000 may be blocked      │
│  ✓ Billing status OK                        │
│                                             │
│  [Fix Issues] [Continue Anyway]             │
└─────────────────────────────────────────────┘
```

---

## 3. Three Product Models

### Model A: Self-Service Deployment (BYOC)
**User owns VPS, we provide deployment tool**

```
┌─────────────────┐
│     User        │
│  (VPS Account)  │
└────────┬────────┘
         │
         │ API Credentials
         ▼
┌─────────────────┐
│  ShellUI Wizard │
│  (Configure)    │
└────────┬────────┘
         │
         │ Deploy Command
         ▼
┌─────────────────┐
│ a2r-cloud-deploy│
│ (Provision)     │
└────────┬────────┘
         │
         │ Terraform/API
         ▼
┌─────────────────┐
│  VPS Provider   │
│  (AWS, DO, etc) │
└─────────────────┘
```

**Files:**
- `a2r-cloud-core/src/provider.rs` - Provider trait
- `a2r-cloud-deploy/src/automation.rs` - Deployment scripts
- `a2r-cloud-wizard/src/lib.rs` - Wizard backend API

---

### Model B: Managed Hosting Service
**We run VPS, user pays subscription**

```
┌─────────────────┐
│     User        │
│  (Subscription) │
└────────┬────────┘
         │
         │ Monthly Payment
         ▼
┌─────────────────┐
│ a2r-cloud-mgmt  │
│ (Billing/CRM)   │
└────────┬────────┘
         │
         │ Provision Request
         ▼
┌─────────────────┐
│ a2r-cloud-deploy│
│ (Auto-provision)│
└────────┬────────┘
         │
         │ API
         ▼
┌─────────────────┐
│  VPS Provider   │
│  (Our accounts) │
└─────────────────┘
         │
         │ A2R Instance
         ▼
┌─────────────────┐
│     User        │
│  (Access URL)   │
└─────────────────┘
```

**Files:**
- `a2r-cloud-managed/src/billing.rs` - Subscription management
- `a2r-cloud-managed/src/multi-tenant.rs` - Tenant isolation
- `a2r-cloud-managed/src/operations.rs` - Automated ops

---

### Model C: Partnership Marketplace
**Affiliate/reseller model**

```
┌─────────────────┐
│     User        │
└────────┬────────┘
         │
         │ Deploy Request
         ▼
┌─────────────────┐
│ a2r-partnerships│
│ (Referral Gen)  │
└────────┬────────┘
         │
         │ Affiliate Link
         ▼
┌─────────────────┐
│  VPS Provider   │
│  (Direct signup)│
└─────────────────┘
         │
         │ Commission (5-20%)
         ▼
┌─────────────────┐
│     A2R         │
│  (Revenue share)│
└─────────────────┘
```

**Files:**
- `a2r-cloud-partnerships/src/affiliate.rs` - Affiliate tracking
- `a2r-cloud-partnerships/src/commission.rs` - Commission calculation
- `a2r-cloud-partnerships/src/dashboard.rs` - Partner dashboard

---

## 3. Provider Plugin Architecture

### Core Trait (Never Changes)

```rust
// a2r-cloud-core/src/provider.rs

#[async_trait]
pub trait CloudProvider: Send + Sync {
    /// Provider name (aws, digitalocean, hetzner, etc.)
    fn name(&self) -> &str;
    
    /// Display name for UI
    fn display_name(&self) -> &str;
    
    /// Provider logo URL
    fn logo_url(&self) -> &str;
    
    /// Available regions
    async fn list_regions(&self) -> Result<Vec<Region>>;
    
    /// Available instance types
    async fn list_instances(&self, region: &str) -> Result<Vec<InstanceType>>;
    
    /// Pricing information
    async fn get_pricing(&self) -> Result<PricingInfo>;
    
    /// Provision a new VM instance
    async fn provision(&self, config: DeploymentConfig) -> Result<Instance>;
    
    /// Deprovision an instance
    async fn deprovision(&self, id: String) -> Result<()>;
    
    /// Health check
    async fn health_check(&self, id: String) -> Result<HealthStatus>;
    
    /// Get instance details
    async fn get_instance(&self, id: String) -> Result<Instance>;
}
```

### Provider Registry

```rust
// a2r-cloud-core/src/registry.rs

pub struct ProviderRegistry {
    providers: HashMap<String, Box<dyn CloudProvider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self;
    
    /// Register a provider
    pub fn register(&mut self, provider: Box<dyn CloudProvider>);
    
    /// Get provider by name
    pub fn get(&self, name: &str) -> Option<&dyn CloudProvider>;
    
    /// List all registered providers
    pub fn list(&self) -> Vec<&str>;
    
    /// Load providers from config
    pub fn load_from_config(config: &ProviderConfig) -> Result<Self>;
}
```

### Provider Implementations

Each provider is a separate crate:

```
a2r-cloud-providers/aws/
├── Cargo.toml
└── src/
    ├── lib.rs          # Provider implementation
    ├── ec2.rs          # EC2-specific logic
    ├── pricing.rs      # AWS pricing API
    └── regions.rs      # AWS regions

a2r-cloud-providers/digitalocean/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── droplets.rs     # DO Droplets
    ├── pricing.rs
    └── regions.rs
```

---

## 4. Deployment Automation Flow

### Step-by-Step Process

```rust
// a2r-cloud-deploy/src/automation.rs

pub struct DeploymentOrchestrator {
    provider: Box<dyn CloudProvider>,
    config: DeploymentConfig,
}

impl DeploymentOrchestrator {
    pub async fn deploy(&self) -> Result<DeploymentResult> {
        // 1. Validate configuration
        self.validate_config()?;
        
        // 2. Check credentials
        self.verify_credentials().await?;
        
        // 3. Provision VM
        let instance = self.provider.provision(self.config.clone()).await?;
        
        // 4. Wait for VM ready
        self.wait_for_ready(&instance.id).await?;
        
        // 5. Install A2R
        self.install_a2r(&instance).await?;
        
        // 6. Configure networking
        self.configure_networking(&instance).await?;
        
        // 7. Run health checks
        self.health_check(&instance).await?;
        
        // 8. Return connection details
        Ok(DeploymentResult {
            instance_id: instance.id,
            public_ip: instance.public_ip,
            access_url: format!("https://{}", instance.public_ip),
            ssh_key: instance.ssh_key,
            admin_credentials: self.generate_admin_creds(),
        })
    }
}
```

### Installation Script

```bash
#!/bin/bash
# a2r-cloud-deploy/scripts/install-a2r.sh

# Download A2R
curl -L https://releases.a2r.sh/latest | sudo tar xz -C /opt

# Create systemd service
cat > /etc/systemd/system/a2r.service << EOF
[Unit]
Description=A2R Platform
After=network.target

[Service]
ExecStart=/opt/a2r/bin/a2r-server
Restart=always
User=a2r
Group=a2r

[Install]
WantedBy=multi-user.target
EOF

# Start service
systemctl daemon-reload
systemctl enable a2r
systemctl start a2r

# Health check
curl -f http://localhost:3000/health || exit 1
```

---

## 5. ShellUI Wizard Integration

### Wizard Flow

```
┌─────────────────────────────────────────────┐
│  Step 1: Choose Deployment Type             │
│  ○ Self-Host (Your VPS)                     │
│  ○ Managed Hosting ($29/month)              │
│  ○ Partnership (VPS + A2R bundle)           │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Step 2: Select Provider                    │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ AWS │ │  DO │ │ Hetz│ │Cont │ │Rack │  │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Step 3: Configure Instance                 │
│  Region:      [us-west-2        ▼]          │
│  Instance:    [t3.medium        ▼]          │
│  Storage:     [100 GB           ▼]          │
│  RAM:         [4 GB             ▼]          │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Step 4: Credentials                        │
│  API Key:     [•••••••••••••••••]           │
│  API Secret:  [•••••••••••••••••]           │
│  [Test Connection]                          │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Step 5: Review & Deploy                    │
│  Provider:    AWS                           │
│  Region:      us-west-2                     │
│  Instance:    t3.medium                     │
│  Cost:        $34.56/month                  │
│                                             │
│  [Deploy Now]                               │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Step 6: Deployment Progress                │
│  ✓ Provisioning VM...                       │
│  ✓ Installing A2R...                        │
│  ✓ Configuring networking...                │
│  ⏳ Running health checks...                │
│                                             │
│  Estimated time: 3-5 minutes                │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Step 7: Deployment Complete!               │
│  Access URL: https://34.123.45.67           │
│  Admin Email: admin@example.com             │
│  Temporary Password: ••••••••               │
│                                             │
│  [Open Dashboard] [Download Credentials]    │
└─────────────────────────────────────────────┘
```

### Wizard Backend API

```rust
// a2r-cloud-wizard/src/lib.rs

pub struct WizardApi {
    registry: ProviderRegistry,
}

#[derive(Serialize, Deserialize)]
pub struct WizardStep {
    pub step_number: u32,
    pub step_name: String,
    pub data: serde_json::Value,
}

impl WizardApi {
    /// Get available providers
    pub async fn get_providers(&self) -> Vec<ProviderInfo>;
    
    /// Get regions for provider
    pub async fn get_regions(&self, provider: &str) -> Vec<Region>;
    
    /// Get instance types
    pub async fn get_instances(&self, provider: &str, region: &str) -> Vec<InstanceType>;
    
    /// Validate credentials
    pub async fn validate_credentials(&self, provider: &str, creds: Credentials) -> Result<bool>;
    
    /// Get cost estimate
    pub async fn estimate_cost(&self, config: DeploymentConfig) -> CostEstimate;
    
    /// Start deployment
    pub async fn start_deployment(&self, config: DeploymentConfig) -> Result<DeploymentId>;
    
    /// Get deployment status
    pub async fn get_status(&self, id: DeploymentId) -> Result<DeploymentStatus>;
}
```

---

## 6. Provider Specifications

### Tier 1 Providers (Core Team Maintained)

| Provider | Why | Priority |
|----------|-----|----------|
| **AWS** | Enterprise standard, most users | High |
| **DigitalOcean** | Dev-friendly, good docs | High |

### Tier 2 Providers (Community/Budget)

| Provider | Why | Priority |
|----------|-----|----------|
| **Hetzner** | Best budget EU provider | Medium |
| **Contabo** | Cheap VPS, good for testing | Medium |
| **RackNerd** | Budget US provider | Medium |

---

## 7. File Structure (Complete)

```
8-cloud/
├── a2r-cloud-core/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── provider.rs       # CloudProvider trait
│       ├── registry.rs       # ProviderRegistry
│       ├── types.rs          # Common types (Instance, Region, etc.)
│       ├── config.rs         # DeploymentConfig
│       └── error.rs          # CloudError types
│
├── a2r-cloud-providers/
│   ├── aws/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── ec2.rs
│   │       ├── pricing.rs
│   │       └── regions.rs
│   ├── digitalocean/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── droplets.rs
│   │       └── ...
│   ├── hetzner/
│   ├── contabo/
│   └── racknerd/
│
├── a2r-cloud-deploy/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── automation.rs     # DeploymentOrchestrator
│       ├── scripts/          # Installation scripts
│       ├── terraform/        # Terraform templates
│       └── health.rs         # Health checks
│
├── a2r-cloud-managed/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── billing.rs        # Subscription management
│       ├── multi-tenant.rs   # Tenant isolation
│       └── operations.rs     # Automated ops
│
├── a2r-cloud-partnerships/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── affiliate.rs      # Affiliate tracking
│       ├── commission.rs     # Commission calculation
│       └── dashboard.rs      # Partner dashboard
│
├── a2r-cloud-wizard/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs            # Wizard backend API
│       ├── steps.rs          # Wizard step handlers
│       └── ui_types.rs       # UI types for ShellUI
│
└── a2r-cloud-k8s/            # Phase 2
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        ├── cluster.rs        # K8s cluster management
        └── helm.rs           # Helm chart deployment
```

---

## 9. Implementation Phases

### Phase 1: BYOC Core (Week 1-3) 🔴 CRITICAL
**Goal:** Ship working BYOC deployment

- [ ] `a2r-cloud-core` - Core traits and types
- [ ] `a2r-cloud-providers/aws` - AWS provider
- [ ] `a2r-cloud-providers/digitalocean` - DO provider
- [ ] `a2r-cloud-deploy` - Deployment automation + preflight checks
- [ ] `a2r-cloud-wizard` - ShellUI wizard backend
- [ ] Credential policy (ephemeral, scoped, encrypted)
- [ ] Preflight validation (quota, region, firewall, billing)

**Success criteria:**
- User can deploy A2R to their AWS/DO account in <5 minutes
- Zero credential storage (ephemeral use only)
- Preflight catches 95%+ of issues before provisioning

---

### Phase 2: Marketplace Monetization (Week 4-5) 🟡 HIGH
**Goal:** Add affiliate revenue stream

- [ ] `a2r-cloud-partnerships` - Affiliate tracking
- [ ] Partnership agreements (start with 1-2 providers)
- [ ] Referral link generation
- [ ] Commission dashboard
- [ ] `a2r-cloud-providers/hetzner` - Budget option
- [ ] `a2r-cloud-providers/contabo` - Budget option
- [ ] `a2r-cloud-providers/racknerd` - Budget option

**Success criteria:**
- User can sign up for VPS via affiliate link
- Commission tracking works
- 3+ budget providers available

---

### Phase 3: Managed Hosting (Week 6+) 🟢 OPTIONAL
**Goal:** Premium managed service (only if demand proven)

**Gates (ALL must be true):**
- [ ] BYOC deployments are boring/reliable (<5% failure rate)
- [ ] Observability hardened (metrics, alerts, dashboards)
- [ ] Automated ops (auto-healing, auto-scaling, auto-patching)
- [ ] Tenant isolation proven (security audit passed)
- [ ] On-call posture ready (incident response playbook)
- [ ] Billing/chargebacks implemented
- [ ] Abuse handling process defined
- [ ] Security disclosure process defined

**If gates met:**
- [ ] `a2r-cloud-managed` - Billing, multi-tenant, operations
- [ ] Payment processor integration
- [ ] Customer dashboard
- [ ] SLA definition

**Success criteria:**
- Can run 100+ tenant instances reliably
- <1 hour incident response time
- Positive unit economics (revenue > infra + ops costs)

---

### Phase 4: Kubernetes (Week 8+) 🔵 ENHANCEMENT
**Goal:** Production-scale deployments

- [ ] `a2r-cloud-k8s` - K8s cluster management
- [ ] Helm charts for A2R
- [ ] Auto-scaling configuration
- [ ] Load balancer integration

**Success criteria:**
- Can deploy multi-replica A2R clusters
- Auto-scaling works under load

---

## 9. Integration Points

| Component | Integration |
|-----------|-------------|
| **ShellUI** | Wizard UI components |
| **BYOC Edge Runner** | VPS is deployment target |
| **Budget Metering** | Track VPS costs |
| **Security Hardening** | Secure credential storage |
| **Observability** | Monitor VPS health |
| **Receipts Schema** | Log deployment events |

---

## 10. Next Steps

1. **Review and approve this architecture**
2. **Create `8-cloud/` directory structure**
3. **Implement `a2r-cloud-core` (core traits)**
4. **Implement AWS provider (reference implementation)**
5. **Implement DigitalOcean provider**
6. **Create deployment automation**
7. **Build ShellUI wizard backend**
8. **Test end-to-end deployment**
9. **Add budget providers**
10. **Add managed hosting**
11. **Add partnerships**

---

**End of Architecture Specification**
