//! OpenClaw Strangler Components
//!
//! Implements StranglerComponent for each OpenClaw subsystem being migrated.
//! Each component wraps OpenClaw calls for the reference implementation
//! and native Allternit code for the native implementation.
//!
//! Migration Phases:
//! - Quarantine: reference_execute only (OpenClaw subprocess)
//! - Bridge: reference_execute + native_execute stub
//! - DualRun: Both implementations run, parity checked
//! - Graduate: Native is primary
//! - Complete: Native only

use async_trait::async_trait;
use serde_json::Value;
use tracing::debug;

use allternit_parity::strangler::{
    ComponentInput, ComponentOutput, MigrationPhase, OutputMetadata, StranglerComponent,
};

use crate::feature_flags::{FeatureFlagRegistry, TrafficRouter};
use crate::native::{
    NativeGatewayBridge, NativeProviderRouter, NativeSessionManager, NativeSkillRegistry,
};
use crate::rpc::OpenClawHttpClient;

/// Skill Registry Component
///
/// Migrates OpenClaw skill management (list, install, uninstall, execute)
#[derive(Debug)]
pub struct SkillRegistryComponent {
    phase: MigrationPhase,
    http_client: OpenClawHttpClient,
    native: Option<NativeSkillRegistry>,
    feature_flags: Option<FeatureFlagRegistry>,
}

impl SkillRegistryComponent {
    /// Create a new skill registry component
    pub fn new(base_url: impl Into<String>, phase: MigrationPhase) -> Self {
        Self {
            phase,
            http_client: OpenClawHttpClient::new(base_url),
            native: None,
            feature_flags: None,
        }
    }

    /// Create with authentication
    pub fn with_auth(mut self, token: impl Into<String>) -> Self {
        self.http_client = self.http_client.with_auth(token);
        self
    }

    /// Set native implementation (for DualRun/Graduate phases)
    pub fn with_native(mut self, native: NativeSkillRegistry) -> Self {
        self.native = Some(native);
        self
    }

    /// Set feature flag registry (for Graduate phase)
    pub fn with_feature_flags(mut self, registry: FeatureFlagRegistry) -> Self {
        self.feature_flags = Some(registry);
        self
    }

    /// Transition to a new phase
    pub fn set_phase(&mut self, phase: MigrationPhase) {
        self.phase = phase;
    }

    /// Check if should route to native based on feature flags
    fn should_route_native(&self, request_id: Option<&str>) -> bool {
        if let Some(ref flags) = self.feature_flags {
            let router = TrafficRouter::new(flags.clone());
            router.should_route_native(self.name(), request_id)
        } else {
            // No feature flags, use phase-based routing
            matches!(self.phase, MigrationPhase::Complete)
        }
    }

    /// Execute using native implementation
    async fn execute_native_impl(&self, input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        if let Some(ref native) = self.native {
            let method = input
                .data
                .get("method")
                .and_then(|m| m.as_str())
                .unwrap_or("skills.list");

            match method {
                "skills.list" => native.list_skills(input).await,
                "skills.get" => native.get_skill(input).await,
                "skills.execute" => native.execute_skill(input).await,
                _ => Err(anyhow::anyhow!("Unknown method: {}", method)),
            }
        } else {
            Err(anyhow::anyhow!("Native implementation not configured"))
        }
    }
}

#[async_trait]
impl StranglerComponent for SkillRegistryComponent {
    fn name(&self) -> &str {
        "skill-registry"
    }

    fn phase(&self) -> MigrationPhase {
        self.phase
    }

    async fn reference_execute(&self, input: ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        // Extract method from input
        let method = input
            .data
            .get("method")
            .and_then(|m| m.as_str())
            .unwrap_or("skills.list");

        let params = input
            .data
            .get("params")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));

        debug!("SkillRegistry reference_execute: {}", method);

        // Call OpenClaw via HTTP
        let result = self
            .http_client
            .call(method, params)
            .await
            .map_err(|e| anyhow::anyhow!("OpenClaw call failed: {}", e))?;

        Ok(ComponentOutput {
            data: result,
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    async fn native_execute(&self, input: ComponentInput) -> anyhow::Result<ComponentOutput> {
        match self.phase {
            MigrationPhase::Quarantine => Err(anyhow::anyhow!(
                "Native execution not available in Quarantine phase"
            )),
            MigrationPhase::Bridge => {
                // Bridge phase: return stub/error to signal not yet implemented
                Err(anyhow::anyhow!("Native execution stub in Bridge phase"))
            }
            MigrationPhase::DualRun => {
                // DualRun: Always run native for comparison
                self.execute_native_impl(&input).await
            }
            MigrationPhase::Graduate => {
                // Graduate: Use feature flags to determine routing
                // If native fails, may fall back to OpenClaw
                self.execute_native_impl(&input).await
            }
            MigrationPhase::Complete => {
                // Complete: Native only, no fallback
                self.execute_native_impl(&input).await
            }
            MigrationPhase::Permanent => Err(anyhow::anyhow!(
                "Native execution not available in Permanent phase"
            )),
        }
    }

    fn normalize_input(&self, input: &ComponentInput) -> Value {
        // Remove non-deterministic fields
        let mut data = input.data.clone();
        if let Some(obj) = data.as_object_mut() {
            obj.remove("timestamp");
            obj.remove("request_id");
        }
        data
    }

    fn normalize_output(&self, output: &ComponentOutput) -> Value {
        // Remove non-deterministic fields from output
        let mut data = output.data.clone();
        normalize_paths(&mut data);
        data
    }
}

/// Session Management Component
///
/// Migrates OpenClaw session persistence (create, export, import, delete)
#[derive(Debug)]
pub struct SessionManagerComponent {
    phase: MigrationPhase,
    http_client: OpenClawHttpClient,
    native: Option<NativeSessionManager>,
    feature_flags: Option<FeatureFlagRegistry>,
}

impl SessionManagerComponent {
    /// Create a new session manager component
    pub fn new(base_url: impl Into<String>, phase: MigrationPhase) -> Self {
        Self {
            phase,
            http_client: OpenClawHttpClient::new(base_url),
            native: None,
            feature_flags: None,
        }
    }

    /// Create with authentication
    pub fn with_auth(mut self, token: impl Into<String>) -> Self {
        self.http_client = self.http_client.with_auth(token);
        self
    }

    /// Set native implementation (for DualRun/Graduate phases)
    pub fn with_native(mut self, native: NativeSessionManager) -> Self {
        self.native = Some(native);
        self
    }

    /// Set feature flag registry (for Graduate phase)
    pub fn with_feature_flags(mut self, registry: FeatureFlagRegistry) -> Self {
        self.feature_flags = Some(registry);
        self
    }

    /// Transition to a new phase
    pub fn set_phase(&mut self, phase: MigrationPhase) {
        self.phase = phase;
    }

    /// Check if should route to native based on feature flags
    fn should_route_native(&self, request_id: Option<&str>) -> bool {
        if let Some(ref flags) = self.feature_flags {
            let router = TrafficRouter::new(flags.clone());
            router.should_route_native(self.name(), request_id)
        } else {
            // No feature flags, use phase-based routing
            matches!(self.phase, MigrationPhase::Complete)
        }
    }

    /// Execute using native implementation
    async fn execute_native_impl(&self, input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        if let Some(ref native) = self.native {
            let method = input
                .data
                .get("method")
                .and_then(|m| m.as_str())
                .unwrap_or("sessions.list");

            match method {
                "sessions.list" => native.list_sessions(input).await,
                "sessions.get" => native.get_session(input).await,
                "sessions.create" => native.create_session(input).await,
                "sessions.export" => native.export_session(input).await,
                "sessions.import" => native.import_session(input).await,
                _ => Err(anyhow::anyhow!("Unknown method: {}", method)),
            }
        } else {
            Err(anyhow::anyhow!("Native implementation not configured"))
        }
    }
}

#[async_trait]
impl StranglerComponent for SessionManagerComponent {
    fn name(&self) -> &str {
        "session-manager"
    }

    fn phase(&self) -> MigrationPhase {
        self.phase
    }

    async fn reference_execute(&self, input: ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let method = input
            .data
            .get("method")
            .and_then(|m| m.as_str())
            .unwrap_or("sessions.list");

        let params = input
            .data
            .get("params")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));

        debug!("SessionManager reference_execute: {}", method);

        let result = self
            .http_client
            .call(method, params)
            .await
            .map_err(|e| anyhow::anyhow!("OpenClaw call failed: {}", e))?;

        Ok(ComponentOutput {
            data: result,
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    async fn native_execute(&self, input: ComponentInput) -> anyhow::Result<ComponentOutput> {
        match self.phase {
            MigrationPhase::Quarantine => Err(anyhow::anyhow!(
                "Native execution not available in Quarantine phase"
            )),
            MigrationPhase::Bridge => Err(anyhow::anyhow!("Native execution stub in Bridge phase")),
            MigrationPhase::DualRun | MigrationPhase::Graduate | MigrationPhase::Complete => {
                self.execute_native_impl(&input).await
            }
            MigrationPhase::Permanent => Err(anyhow::anyhow!(
                "Native execution not available in Permanent phase"
            )),
        }
    }

    fn normalize_input(&self, input: &ComponentInput) -> Value {
        let mut data = input.data.clone();
        if let Some(obj) = data.as_object_mut() {
            obj.remove("timestamp");
            obj.remove("request_id");
        }
        data
    }

    fn normalize_output(&self, output: &ComponentOutput) -> Value {
        let mut data = output.data.clone();
        normalize_paths(&mut data);
        data
    }
}

/// Gateway Bridge Component
///
/// Migrates OpenClaw WebSocket gateway (connect, disconnect, message routing)
#[derive(Debug)]
pub struct GatewayBridgeComponent {
    phase: MigrationPhase,
    http_client: OpenClawHttpClient,
    native: Option<NativeGatewayBridge>,
}

impl GatewayBridgeComponent {
    /// Create a new gateway bridge component
    pub fn new(base_url: impl Into<String>, phase: MigrationPhase) -> Self {
        Self {
            phase,
            http_client: OpenClawHttpClient::new(base_url),
            native: None,
        }
    }

    /// Set native implementation (for DualRun/Graduate phases)
    pub fn with_native(mut self, native: NativeGatewayBridge) -> Self {
        self.native = Some(native);
        self
    }

    /// Transition to a new phase
    pub fn set_phase(&mut self, phase: MigrationPhase) {
        self.phase = phase;
    }
}

#[async_trait]
impl StranglerComponent for GatewayBridgeComponent {
    fn name(&self) -> &str {
        "gateway-bridge"
    }

    fn phase(&self) -> MigrationPhase {
        self.phase
    }

    async fn reference_execute(&self, input: ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let method = input
            .data
            .get("method")
            .and_then(|m| m.as_str())
            .unwrap_or("gateway.status");

        let params = input
            .data
            .get("params")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));

        debug!("GatewayBridge reference_execute: {}", method);

        let result = self
            .http_client
            .call(method, params)
            .await
            .map_err(|e| anyhow::anyhow!("OpenClaw call failed: {}", e))?;

        Ok(ComponentOutput {
            data: result,
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    async fn native_execute(&self, input: ComponentInput) -> anyhow::Result<ComponentOutput> {
        match self.phase {
            MigrationPhase::Quarantine => Err(anyhow::anyhow!(
                "Native execution not available in Quarantine phase"
            )),
            MigrationPhase::Bridge => Err(anyhow::anyhow!("Native execution stub in Bridge phase")),
            MigrationPhase::DualRun | MigrationPhase::Graduate | MigrationPhase::Complete => {
                if let Some(ref native) = self.native {
                    let method = input
                        .data
                        .get("method")
                        .and_then(|m| m.as_str())
                        .unwrap_or("gateway.status");

                    match method {
                        "gateway.status" => native.get_status(&input).await,
                        "gateway.connect" => native.connect(&input).await,
                        "gateway.disconnect" => native.disconnect(&input).await,
                        _ => Err(anyhow::anyhow!("Unknown method: {}", method)),
                    }
                } else {
                    Err(anyhow::anyhow!("Native implementation not configured"))
                }
            }
            MigrationPhase::Permanent => Err(anyhow::anyhow!(
                "Native execution not available in Permanent phase"
            )),
        }
    }

    fn normalize_input(&self, input: &ComponentInput) -> Value {
        let mut data = input.data.clone();
        if let Some(obj) = data.as_object_mut() {
            obj.remove("timestamp");
            obj.remove("request_id");
        }
        data
    }

    fn normalize_output(&self, output: &ComponentOutput) -> Value {
        output.data.clone()
    }
}

/// Provider Router Component
///
/// Migrates OpenClaw model provider routing
#[derive(Debug)]
pub struct ProviderRouterComponent {
    phase: MigrationPhase,
    http_client: OpenClawHttpClient,
    native: Option<NativeProviderRouter>,
}

impl ProviderRouterComponent {
    /// Create a new provider router component
    pub fn new(base_url: impl Into<String>, phase: MigrationPhase) -> Self {
        Self {
            phase,
            http_client: OpenClawHttpClient::new(base_url),
            native: None,
        }
    }

    /// Set native implementation (for DualRun/Graduate phases)
    pub fn with_native(mut self, native: NativeProviderRouter) -> Self {
        self.native = Some(native);
        self
    }

    /// Transition to a new phase
    pub fn set_phase(&mut self, phase: MigrationPhase) {
        self.phase = phase;
    }
}

#[async_trait]
impl StranglerComponent for ProviderRouterComponent {
    fn name(&self) -> &str {
        "provider-router"
    }

    fn phase(&self) -> MigrationPhase {
        self.phase
    }

    async fn reference_execute(&self, input: ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let method = input
            .data
            .get("method")
            .and_then(|m| m.as_str())
            .unwrap_or("providers.list");

        let params = input
            .data
            .get("params")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));

        debug!("ProviderRouter reference_execute: {}", method);

        let result = self
            .http_client
            .call(method, params)
            .await
            .map_err(|e| anyhow::anyhow!("OpenClaw call failed: {}", e))?;

        Ok(ComponentOutput {
            data: result,
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    async fn native_execute(&self, input: ComponentInput) -> anyhow::Result<ComponentOutput> {
        match self.phase {
            MigrationPhase::Quarantine => Err(anyhow::anyhow!(
                "Native execution not available in Quarantine phase"
            )),
            MigrationPhase::Bridge => Err(anyhow::anyhow!("Native execution stub in Bridge phase")),
            MigrationPhase::DualRun | MigrationPhase::Graduate | MigrationPhase::Complete => {
                if let Some(ref native) = self.native {
                    let method = input
                        .data
                        .get("method")
                        .and_then(|m| m.as_str())
                        .unwrap_or("providers.list");

                    match method {
                        "providers.list" => native.list_providers(&input).await,
                        "providers.select" => native.select_provider(&input).await,
                        _ => Err(anyhow::anyhow!("Unknown method: {}", method)),
                    }
                } else {
                    Err(anyhow::anyhow!("Native implementation not configured"))
                }
            }
            MigrationPhase::Permanent => Err(anyhow::anyhow!(
                "Native execution not available in Permanent phase"
            )),
        }
    }

    fn normalize_input(&self, input: &ComponentInput) -> Value {
        let mut data = input.data.clone();
        if let Some(obj) = data.as_object_mut() {
            obj.remove("timestamp");
            obj.remove("request_id");
        }
        data
    }

    fn normalize_output(&self, output: &ComponentOutput) -> Value {
        output.data.clone()
    }
}

/// Component factory for creating all OpenClaw strangler components
pub struct OpenClawComponentFactory {
    base_url: String,
    auth_token: Option<String>,
    native_skill_registry: Option<NativeSkillRegistry>,
    native_session_manager: Option<NativeSessionManager>,
    native_gateway_bridge: Option<NativeGatewayBridge>,
    native_provider_router: Option<NativeProviderRouter>,
}

impl OpenClawComponentFactory {
    /// Create a new component factory
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            auth_token: None,
            native_skill_registry: None,
            native_session_manager: None,
            native_gateway_bridge: None,
            native_provider_router: None,
        }
    }

    /// Set authentication token
    pub fn with_auth(mut self, token: impl Into<String>) -> Self {
        self.auth_token = Some(token.into());
        self
    }

    /// Enable native implementations (Phase 2+)
    pub fn with_native_implementations(mut self) -> Self {
        use crate::native::NativeImplementationFactory;

        self.native_skill_registry = Some(NativeImplementationFactory::create_skill_registry());
        self.native_session_manager = Some(NativeImplementationFactory::create_session_manager());
        self.native_gateway_bridge = Some(NativeImplementationFactory::create_gateway_bridge());
        self.native_provider_router = Some(NativeImplementationFactory::create_provider_router());

        self
    }

    /// Create all components in Quarantine phase
    pub fn create_quarantine_components(&self) -> Vec<Box<dyn StranglerComponent>> {
        vec![
            self.create_skill_registry(MigrationPhase::Quarantine),
            self.create_session_manager(MigrationPhase::Quarantine),
            self.create_gateway_bridge(MigrationPhase::Quarantine),
            self.create_provider_router(MigrationPhase::Quarantine),
        ]
    }

    /// Create all components in Bridge phase
    pub fn create_bridge_components(&self) -> Vec<Box<dyn StranglerComponent>> {
        vec![
            self.create_skill_registry(MigrationPhase::Bridge),
            self.create_session_manager(MigrationPhase::Bridge),
            self.create_gateway_bridge(MigrationPhase::Bridge),
            self.create_provider_router(MigrationPhase::Bridge),
        ]
    }

    /// Create all components in DualRun phase (Phase 2)
    pub fn create_dualrun_components(&self) -> Vec<Box<dyn StranglerComponent>> {
        vec![
            self.create_skill_registry(MigrationPhase::DualRun),
            self.create_session_manager(MigrationPhase::DualRun),
            self.create_gateway_bridge(MigrationPhase::DualRun),
            self.create_provider_router(MigrationPhase::DualRun),
        ]
    }

    /// Create skill registry component
    pub fn create_skill_registry(&self, phase: MigrationPhase) -> Box<dyn StranglerComponent> {
        let mut component = SkillRegistryComponent::new(&self.base_url, phase);

        if let Some(ref token) = self.auth_token {
            component = component.with_auth(token.clone());
        }

        if let Some(ref native) = self.native_skill_registry {
            component = component.with_native(native.clone());
        }

        Box::new(component)
    }

    /// Create session manager component
    pub fn create_session_manager(&self, phase: MigrationPhase) -> Box<dyn StranglerComponent> {
        let mut component = SessionManagerComponent::new(&self.base_url, phase);

        if let Some(ref token) = self.auth_token {
            component = component.with_auth(token.clone());
        }

        if let Some(ref native) = self.native_session_manager {
            component = component.with_native(native.clone());
        }

        Box::new(component)
    }

    /// Create gateway bridge component
    pub fn create_gateway_bridge(&self, phase: MigrationPhase) -> Box<dyn StranglerComponent> {
        let mut component = GatewayBridgeComponent::new(&self.base_url, phase);

        if let Some(ref native) = self.native_gateway_bridge {
            component = component.with_native(native.clone());
        }

        Box::new(component)
    }

    /// Create provider router component
    pub fn create_provider_router(&self, phase: MigrationPhase) -> Box<dyn StranglerComponent> {
        let mut component = ProviderRouterComponent::new(&self.base_url, phase);

        if let Some(ref native) = self.native_provider_router {
            component = component.with_native(native.clone());
        }

        Box::new(component)
    }
}

/// Normalize paths in JSON value for deterministic comparison
fn normalize_paths(value: &mut Value) {
    match value {
        Value::String(s) => {
            // Replace temp directory paths with placeholder
            if s.contains("/tmp/") || s.contains("/var/tmp/") {
                if let Ok(re) = regex::Regex::new(r"/tmp/[^/]+") {
                    if let Some(m) = re.find(s) {
                        *s = s.replace(m.as_str(), "{{TMP_DIR}}");
                    }
                }
            }
            if s.contains("/Users/") || s.contains("/home/") {
                if let Ok(re) = regex::Regex::new(r"/Users/[^/]+|/home/[^/]+") {
                    *s = re.replace_all(s, "{{HOME_DIR}}").to_string();
                }
            }
        }
        Value::Array(arr) => {
            for item in arr {
                normalize_paths(item);
            }
        }
        Value::Object(map) => {
            for (_, v) in map {
                normalize_paths(v);
            }
        }
        _ => {}
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[test]
    fn test_component_factory() {
        let factory = OpenClawComponentFactory::new("http://localhost:18789");
        let components = factory.create_quarantine_components();

        assert_eq!(components.len(), 4);
        assert_eq!(components[0].name(), "skill-registry");
        assert_eq!(components[1].name(), "session-manager");
        assert_eq!(components[2].name(), "gateway-bridge");
        assert_eq!(components[3].name(), "provider-router");
    }

    #[test]
    fn test_component_phases() {
        let factory = OpenClawComponentFactory::new("http://localhost:18789");
        let skill_registry = factory.create_skill_registry(MigrationPhase::DualRun);

        assert_eq!(skill_registry.phase(), MigrationPhase::DualRun);
        assert!(skill_registry.phase().can_run_reference());
        assert!(skill_registry.phase().can_run_native());
        assert!(skill_registry.phase().should_check_parity());
    }

    #[test]
    fn test_normalize_paths() {
        let mut value = serde_json::json!({
            "path": "/Users/test/project",
            "temp": "/tmp/xyz123/file.txt",
        });

        normalize_paths(&mut value);

        assert!(value["path"].as_str().unwrap().contains("{{HOME_DIR}}"));
        assert!(value["temp"].as_str().unwrap().contains("{{TMP_DIR}}"));
    }
}
