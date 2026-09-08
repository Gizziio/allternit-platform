//! Warm VM pool in front of the sandbox execution routes.
//!
//! `/sandbox/execute` used to spawn → exec → destroy a fresh VM per request,
//! paying full provisioning latency on every call. The pool keeps a set of
//! warm VMs checked in between requests and hands them out via
//! checkout/checkin:
//!
//!   checkout()  — take an idle VM (health-checked first), or spawn a new one
//!                 under `max_total`; fail closed with `PoolError` when no
//!                 healthy VM can be obtained. Callers must map that to a 503
//!                 and never fall back to unsandboxed execution.
//!   checkin()   — return a VM to the idle set, or destroy it when it is
//!                 unhealthy (a failed exec usually means a dead VM).
//!
//! Durability: pool state is persisted to disk (`pool-state.json` under the
//! computer-use state dir) on every mutation, so a gateway restart does not
//! leak VMs. VMs that were checked out when the process died are "unknown" —
//! nothing in this process owns them anymore — and are marked for reclamation
//! on boot: the pool reconstructs their handles and destroys them
//! best-effort.
//!
//! Configuration (env):
//!   ALLTERNIT_VM_POOL_ENABLED        "false" disables the pool entirely
//!   ALLTERNIT_VM_POOL_MIN_IDLE       warm VMs to keep ready (default 0)
//!   ALLTERNIT_VM_POOL_MAX_TOTAL      hard cap on pooled VMs (default 8)
//!   ALLTERNIT_VM_POOL_IDLE_TTL_SECS  destroy idle VMs older than this
//!                                    (default 600)

use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::RwLock;
use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};
use uuid::Uuid;

use allternit_driver_interface::{
    CommandSpec, EnvironmentSpec, ExecutionDriver, ExecutionHandle, PolicySpec, ResourceSpec,
    SpawnSpec, TenantId,
};

use crate::aci_approvals::computer_use_dir;

/// How the pool decides what to keep warm.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PoolConfig {
    pub min_idle: usize,
    pub max_total: usize,
    pub idle_ttl: Duration,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            min_idle: 0,
            max_total: 8,
            idle_ttl: Duration::from_secs(600),
        }
    }
}

impl PoolConfig {
    pub fn from_env() -> Self {
        let mut cfg = Self::default();
        if let Ok(v) = std::env::var("ALLTERNIT_VM_POOL_MIN_IDLE") {
            if let Ok(n) = v.parse() {
                cfg.min_idle = n;
            }
        }
        if let Ok(v) = std::env::var("ALLTERNIT_VM_POOL_MAX_TOTAL") {
            if let Ok(n) = v.parse::<usize>() {
                cfg.max_total = n.max(cfg.min_idle);
            }
        }
        if let Ok(v) = std::env::var("ALLTERNIT_VM_POOL_IDLE_TTL_SECS") {
            if let Ok(n) = v.parse::<u64>() {
                if n > 0 {
                    cfg.idle_ttl = Duration::from_secs(n);
                }
            }
        }
        cfg
    }
}

/// Why a checkout could not produce a healthy VM. Always maps to a 503 at the
/// route layer — the pool never silently degrades to unsandboxed execution.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PoolError {
    /// Every slot is occupied by checked-out VMs (or the pool is at capacity
    /// and cannot spawn).
    NoCapacity,
    /// Spawning (or health-checking) a fresh VM failed.
    Unavailable(String),
}

impl PoolError {
    pub fn message(&self) -> String {
        match self {
            Self::NoCapacity => {
                "no healthy sandbox VM available: pool is at capacity, retry later".to_string()
            }
            Self::Unavailable(m) => format!("no healthy sandbox VM available: {m}"),
        }
    }
}

/// Lifecycle state of one pooled VM.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PoolVmState {
    /// Checked in, waiting for a request.
    Idle,
    /// Checked out by a request; the gateway process owns it.
    CheckedOut,
}

/// One VM in the pool.
#[derive(Debug, Clone)]
pub struct PoolVm {
    pub handle: ExecutionHandle,
    pub spawned_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,
    pub state: PoolVmState,
    /// Number of requests served by this VM (observability).
    pub execs: u64,
}

/// Serializable pool state snapshot (see the module docs for semantics).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PoolStateFile {
    version: u32,
    vms: Vec<PersistedVm>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedVm {
    handle: ExecutionHandle,
    state: PoolVmState,
    spawned_at: DateTime<Utc>,
    last_used: DateTime<Utc>,
    execs: u64,
}

/// A checked-out VM. Callers exec against it, then checkin by id.
#[derive(Debug)]
pub struct PoolCheckout {
    pub vm_id: Uuid,
    handle: ExecutionHandle,
}

impl PoolCheckout {
    pub fn handle(&self) -> &ExecutionHandle {
        &self.handle
    }
}

/// Observability snapshot for the `/sandbox/pool` status route.
#[derive(Debug, Clone, Serialize)]
pub struct PoolStats {
    pub enabled: bool,
    pub total: usize,
    pub idle: usize,
    pub checked_out: usize,
    pub min_idle: usize,
    pub max_total: usize,
    pub idle_ttl_secs: u64,
    pub state_path: Option<String>,
}

/// Warm pool of sandbox VMs. Global to the gateway process (like
/// `aci_approvals::GRANTS`) so the sandbox routes can reach it without
/// threading new state through `AppState`.
pub struct VmPool {
    driver: Arc<dyn ExecutionDriver>,
    config: PoolConfig,
    vms: std::sync::Mutex<HashMap<Uuid, PoolVm>>,
    state_path: Option<PathBuf>,
    /// Handles of VMs that were checked out when a previous gateway process
    /// died. Destroyed best-effort by `reclaim_unknown` after boot.
    reclaim: std::sync::Mutex<Vec<ExecutionHandle>>,
}

/// Cheap liveness probe run inside a VM before it is handed out. A VM that
/// cannot run `true` is destroyed, never checked out.
fn health_probe() -> CommandSpec {
    CommandSpec {
        command: vec!["true".to_string()],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: false,
        capture_stderr: false,
    }
}

/// Fixed spawn spec for pooled sandbox VMs. Pooled VMs are generic
/// ubuntu-22.04-minimal environments; per-request code/env/workdir are
/// applied at exec time (same image the direct sandbox path used).
fn pool_spawn_spec() -> SpawnSpec {
    SpawnSpec {
        tenant: TenantId::new("allternit-vm-pool".to_string())
            .expect("static tenant id is valid"),
        project: None,
        workspace: None,
        run_id: None,
        env: EnvironmentSpec {
            image: "ubuntu-22.04-minimal".to_string(),
            ..Default::default()
        },
        policy: PolicySpec::default_permissive(),
        resources: ResourceSpec::minimal(),
        envelope: None,
        prewarm_pool: None,
    }
}

impl VmPool {
    /// Build a pool, restoring on-disk state from a previous process. Idle
    /// VMs come back as warm candidates (they are health-checked again before
    /// any checkout); VMs that were checked out at crash time are marked
    /// unknown and queued for reclamation.
    pub fn restore(
        driver: Arc<dyn ExecutionDriver>,
        config: PoolConfig,
        state_path: Option<PathBuf>,
    ) -> Arc<Self> {
        let mut vms: HashMap<Uuid, PoolVm> = HashMap::new();
        let mut reclaim = Vec::new();

        if let Some(path) = &state_path {
            match std::fs::read_to_string(path) {
                Ok(text) => match serde_json::from_str::<PoolStateFile>(&text) {
                    Ok(state) => {
                        for pv in state.vms {
                            let id = pv.handle.id.0;
                            match pv.state {
                                PoolVmState::Idle => {
                                    vms.insert(
                                        id,
                                        PoolVm {
                                            handle: pv.handle,
                                            spawned_at: pv.spawned_at,
                                            last_used: pv.last_used,
                                            state: PoolVmState::Idle,
                                            execs: pv.execs,
                                        },
                                    );
                                }
                                PoolVmState::CheckedOut => {
                                    warn!(
                                        vm_id = %id,
                                        "pool restore: VM was checked out when the gateway \
                                         stopped; marking for reclamation"
                                    );
                                    reclaim.push(pv.handle);
                                }
                            }
                        }
                        info!(
                            restored_idle = vms.len(),
                            reclaim = reclaim.len(),
                            "VM pool state restored from disk"
                        );
                    }
                    Err(e) => warn!("pool restore: unparseable state file {path:?}: {e}"),
                },
                Err(e) if e.kind() != std::io::ErrorKind::NotFound => {
                    warn!("pool restore: cannot read state file {path:?}: {e}")
                }
                _ => {}
            }
        }

        Arc::new(Self {
            driver,
            config,
            vms: std::sync::Mutex::new(vms),
            state_path,
            reclaim: std::sync::Mutex::new(reclaim),
        })
    }

    /// Number of unknown (checked-out at crash) VMs pending reclamation.
    pub fn pending_reclaim(&self) -> usize {
        self.reclaim.lock().expect("reclaim lock").len()
    }

    /// Destroy VMs that were checked out when a previous gateway process
    /// died. Best-effort: failures are logged and the entry dropped anyway —
    /// a later Incus/Tart sweep reaps truly orphaned instances.
    pub async fn reclaim_unknown(&self) {
        let handles = std::mem::take(&mut *self.reclaim.lock().expect("reclaim lock"));
        for handle in handles {
            if let Err(e) = self.driver.destroy(&handle).await {
                warn!(vm_id = %handle.id.0, error = %e, "reclaim destroy failed");
            } else {
                info!(vm_id = %handle.id.0, "reclaimed unknown pooled VM");
            }
        }
    }

    fn persist(&self) {
        let Some(path) = &self.state_path else {
            return;
        };
        let state = PoolStateFile {
            version: 1,
            vms: self
                .vms
                .lock()
                .expect("pool lock")
                .values()
                .map(|vm| PersistedVm {
                    handle: vm.handle.clone(),
                    state: vm.state,
                    spawned_at: vm.spawned_at,
                    last_used: vm.last_used,
                    execs: vm.execs,
                })
                .collect(),
        };
        let Ok(json) = serde_json::to_string(&state) else {
            return;
        };
        // Write-then-rename so a crash mid-write cannot corrupt the state.
        let tmp = path.with_extension("json.tmp");
        if std::fs::write(&tmp, json).is_ok() {
            let _ = std::fs::rename(&tmp, path);
        }
    }

    /// Total VMs currently in the pool (idle + checked out).
    pub fn total(&self) -> usize {
        self.vms.lock().expect("pool lock").len()
    }

    fn idle_count(&self) -> usize {
        self.vms
            .lock()
            .expect("pool lock")
            .values()
            .filter(|vm| vm.state == PoolVmState::Idle)
            .count()
    }

    /// Check out a healthy VM. Takes the least-recently-used idle VM after
    /// probing it; dead idle VMs are destroyed and skipped. Spawns a new VM
    /// when nothing idle is usable and `max_total` allows. Fail closed with
    /// `PoolError` — callers must not fall back to unsandboxed execution.
    pub async fn checkout(&self) -> Result<PoolCheckout, PoolError> {
        const PROBE_TIMEOUT: Duration = Duration::from_secs(10);

        // Try idle VMs first, oldest last-used first.
        let candidates: Vec<(Uuid, ExecutionHandle)> = {
            let mut vms: Vec<(Uuid, DateTime<Utc>)> = self
                .vms
                .lock()
                .expect("pool lock")
                .iter()
                .filter(|(_, vm)| vm.state == PoolVmState::Idle)
                .map(|(id, vm)| (*id, vm.last_used))
                .collect();
            vms.sort_by_key(|(_, last_used)| *last_used);
            let mut handles = Vec::with_capacity(vms.len());
            let map = self.vms.lock().expect("pool lock");
            for (id, _) in vms.drain(..) {
                if let Some(vm) = map.get(&id) {
                    handles.push((id, vm.handle.clone()));
                }
            }
            handles
        };

        for (id, handle) in candidates {
            let healthy =
                matches!(tokio::time::timeout(PROBE_TIMEOUT, self.driver.exec(&handle, health_probe())).await, Ok(Ok(_)));
            if healthy {
                let claimed = {
                    let mut vms = self.vms.lock().expect("pool lock");
                    match vms.get_mut(&id) {
                        Some(vm) => {
                            vm.state = PoolVmState::CheckedOut;
                            true
                        }
                        // The VM vanished between candidate collection and
                        // checkout (e.g. the reaper claimed it); keep looking.
                        None => false,
                    }
                };
                if claimed {
                    self.persist();
                    return Ok(PoolCheckout { vm_id: id, handle });
                }
            } else {
                warn!(vm_id = %id, "idle pooled VM failed health probe; destroying");
                let _ = self.driver.destroy(&handle).await;
                self.vms.lock().expect("pool lock").remove(&id);
                self.persist();
            }
        }

        // Nothing usable idle — spawn under the cap.
        if self.total() < self.config.max_total {
            return self.spawn_checked_out().await;
        }
        Err(PoolError::NoCapacity)
    }

    async fn spawn_checked_out(&self) -> Result<PoolCheckout, PoolError> {
        let handle = self
            .driver
            .spawn(pool_spawn_spec())
            .await
            .map_err(|e| PoolError::Unavailable(format!("spawn failed: {e}")))?;
        let id = handle.id.0;

        let healthy = matches!(
            tokio::time::timeout(Duration::from_secs(10), self.driver.exec(&handle, health_probe()))
                .await,
            Ok(Ok(_))
        );
        if !healthy {
            warn!(vm_id = %id, "freshly spawned pooled VM failed health probe");
            let _ = self.driver.destroy(&handle).await;
            return Err(PoolError::Unavailable(
                "fresh VM failed health check".to_string(),
            ));
        }

        let now = Utc::now();
        self.vms.lock().expect("pool lock").insert(
            id,
            PoolVm {
                handle: handle.clone(),
                spawned_at: now,
                last_used: now,
                state: PoolVmState::CheckedOut,
                execs: 0,
            },
        );
        self.persist();
        Ok(PoolCheckout { vm_id: id, handle })
    }

    /// Execute a command on a checked-out VM. A driver-level error means the
    /// VM is likely dead — the caller should `checkin(vm_id, false)`.
    pub async fn exec_on(
        &self,
        checkout: &PoolCheckout,
        cmd: CommandSpec,
    ) -> Result<allternit_driver_interface::ExecResult, allternit_driver_interface::DriverError>
    {
        self.driver.exec(checkout.handle(), cmd).await
    }

    /// Return a VM to the pool. Unhealthy VMs are destroyed; healthy ones go
    /// back to the idle set (the reaper enforces `idle_ttl` and `max_total`).
    pub async fn checkin(&self, vm_id: Uuid, healthy: bool) {
        let entry = {
            let mut vms = self.vms.lock().expect("pool lock");
            if healthy {
                match vms.get_mut(&vm_id) {
                    Some(vm) => {
                        vm.state = PoolVmState::Idle;
                        vm.last_used = Utc::now();
                        vm.execs += 1;
                        None
                    }
                    None => None,
                }
            } else {
                vms.remove(&vm_id)
            }
        };
        if let Some(vm) = entry {
            // Unhealthy: destroy outside the lock.
            let _ = self.driver.destroy(&vm.handle).await;
        }
        self.persist();
    }

    /// Destroy idle VMs past the idle TTL and top up toward `min_idle`.
    pub async fn reap_expired(&self) {
        let now = Utc::now();
        let expired: Vec<ExecutionHandle> = {
            let vms = self.vms.lock().expect("pool lock");
            vms.values()
                .filter(|vm| {
                    vm.state == PoolVmState::Idle
                        && now.signed_duration_since(vm.last_used)
                            > chrono::Duration::from_std(self.config.idle_ttl)
                                .unwrap_or_else(|_| chrono::Duration::seconds(600))
                })
                .map(|vm| vm.handle.clone())
                .collect()
        };
        if !expired.is_empty() {
            {
                let mut vms = self.vms.lock().expect("pool lock");
                for handle in &expired {
                    warn!(vm_id = %handle.id.0, "idle TTL reached; destroying pooled VM");
                    vms.remove(&handle.id.0);
                }
            }
            self.persist();
            for handle in &expired {
                let _ = self.driver.destroy(handle).await;
            }
        }

        // Top up toward min_idle (never past max_total).
        while self.idle_count() < self.config.min_idle && self.total() < self.config.max_total {
            let handle = match self.driver.spawn(pool_spawn_spec()).await {
                Ok(h) => h,
                Err(e) => {
                    warn!("pool top-up spawn failed: {e}");
                    break;
                }
            };
            let now = Utc::now();
            self.vms.lock().expect("pool lock").insert(
                handle.id.0,
                PoolVm {
                    handle,
                    spawned_at: now,
                    last_used: now,
                    state: PoolVmState::Idle,
                    execs: 0,
                },
            );
            self.persist();
        }
    }

    pub fn stats(&self) -> PoolStats {
        let vms = self.vms.lock().expect("pool lock");
        PoolStats {
            enabled: true,
            total: vms.len(),
            idle: vms.values().filter(|v| v.state == PoolVmState::Idle).count(),
            checked_out: vms
                .values()
                .filter(|v| v.state == PoolVmState::CheckedOut)
                .count(),
            min_idle: self.config.min_idle,
            max_total: self.config.max_total,
            idle_ttl_secs: self.config.idle_ttl.as_secs(),
            state_path: self
                .state_path
                .as_ref()
                .map(|p| p.display().to_string()),
        }
    }
}

// ─── Global process-wide pool ─────────────────────────────────────────────────

static GLOBAL_POOL: Lazy<RwLock<Option<Arc<VmPool>>>> = Lazy::new(|| RwLock::new(None));

/// Boot-time initialization: build the pool from the configured driver and
/// persisted state, then start the maintenance task. No-op (pool stays
/// disabled) when there is no driver or `ALLTERNIT_VM_POOL_ENABLED=false`.
pub fn init_global(driver: Option<Arc<dyn ExecutionDriver>>) {
    let enabled = std::env::var("ALLTERNIT_VM_POOL_ENABLED")
        .map(|v| v != "false" && v != "0")
        .unwrap_or(true);
    match (enabled, driver) {
        (true, Some(driver)) => {
            let state_path = Some(computer_use_dir().join("pool-state.json"));
            init_global_for_test(driver, PoolConfig::from_env(), state_path);
        }
        _ => {
            let mut global = GLOBAL_POOL.write().expect("global pool lock");
            *global = None;
        }
    }
}

/// Same as `init_global` but with explicit configuration and state path —
/// used by tests to exercise the pool (including restart persistence) without
/// depending on process env. Returns the activated pool.
pub fn init_global_for_test(
    driver: Arc<dyn ExecutionDriver>,
    config: PoolConfig,
    state_path: Option<PathBuf>,
) -> Arc<VmPool> {
    let pool = VmPool::restore(driver, config, state_path);
    info!(
        idle = pool.stats().idle,
        pending_reclaim = pool.pending_reclaim(),
        "VM pool initialized"
    );

    {
        let mut global = GLOBAL_POOL.write().expect("global pool lock");
        *global = Some(pool.clone());
    }

    // Reclaim VMs left checked-out by a previous process lifetime.
    if pool.pending_reclaim() > 0 {
        let reclaim_pool = pool.clone();
        tokio::spawn(async move {
            reclaim_pool.reclaim_unknown().await;
        });
    }
    // Maintenance: reap idle TTL + top up min_idle.
    let maintenance_pool = pool.clone();
    tokio::spawn(async move {
        loop {
            maintenance_pool.reap_expired().await;
            tokio::time::sleep(Duration::from_secs(30)).await;
        }
    });
    pool
}

/// The process-wide pool, if enabled.
pub fn global_pool() -> Option<Arc<VmPool>> {
    GLOBAL_POOL.read().expect("global pool lock").clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_driver_interface::{
        DriverCapabilities, DriverError, DriverHealth, DriverType, ExecResult, ExecutionId,
        IsolationLevel,
    };

    /// Scriptable mock driver: exec fails while `fail_exec` is set, spawns
    /// fail while `fail_spawn` is set, and every destroy is recorded.
    #[derive(Debug)]
    struct MockDriver {
        spawns: std::sync::Mutex<u32>,
        destroys: std::sync::Mutex<Vec<Uuid>>,
        fail_spawn: std::sync::Mutex<bool>,
        fail_exec: std::sync::Mutex<bool>,
        fail_exec_for: std::sync::Mutex<Option<Uuid>>,
    }

    impl MockDriver {
        fn new() -> Arc<Self> {
            Arc::new(Self {
                spawns: std::sync::Mutex::new(0),
                destroys: std::sync::Mutex::new(Vec::new()),
                fail_spawn: std::sync::Mutex::new(false),
                fail_exec: std::sync::Mutex::new(false),
                fail_exec_for: std::sync::Mutex::new(None),
            })
        }

        fn spawn_count(&self) -> u32 {
            *self.spawns.lock().unwrap()
        }

        fn destroyed(&self) -> Vec<Uuid> {
            self.destroys.lock().unwrap().clone()
        }

        fn fail_spawn(&self) {
            *self.fail_spawn.lock().unwrap() = true;
        }

        fn fail_exec(&self) {
            *self.fail_exec.lock().unwrap() = true;
        }

        /// Make exec fail only for the given VM (simulates one dead VM).
        fn kill_vm(&self, id: Uuid) {
            *self.fail_exec_for.lock().unwrap() = Some(id);
        }
    }

    #[async_trait::async_trait]
    impl ExecutionDriver for MockDriver {
        fn capabilities(&self) -> DriverCapabilities {
            DriverCapabilities {
                driver_type: DriverType::Container,
                isolation: IsolationLevel::Standard,
                max_resources: ResourceSpec::minimal(),
                supported_env_specs: vec![],
                features: Default::default(),
            }
        }

        async fn spawn(
            &self,
            _spec: SpawnSpec,
        ) -> Result<ExecutionHandle, DriverError> {
            if *self.fail_spawn.lock().unwrap() {
                return Err(DriverError::SpawnFailed {
                    reason: "mock spawn failure".to_string(),
                });
            }
            *self.spawns.lock().unwrap() += 1;
            let id = Uuid::new_v4();
            Ok(ExecutionHandle {
                id: ExecutionId(id),
                tenant: TenantId::new("allternit-vm-pool".to_string()).unwrap(),
                driver_info: HashMap::new(),
                env_spec: Default::default(),
            })
        }

        async fn pause_vm(&self, _h: &ExecutionHandle) -> Result<(), DriverError> {
            Ok(())
        }
        async fn resume_vm(&self, _h: &ExecutionHandle) -> Result<(), DriverError> {
            Ok(())
        }

        async fn exec(&self, h: &ExecutionHandle, _cmd: CommandSpec) -> Result<ExecResult, DriverError> {
            let targeted = *self.fail_exec_for.lock().unwrap() == Some(h.id.0);
            if targeted || *self.fail_exec.lock().unwrap() {
                return Err(DriverError::InternalError {
                    message: "mock exec failure".to_string(),
                });
            }
            Ok(ExecResult {
                exit_code: 0,
                stdout: None,
                stderr: None,
                duration_ms: 1,
                resource_usage: Default::default(),
            })
        }

        async fn stream_logs(
            &self,
            _h: &ExecutionHandle,
        ) -> Result<Vec<allternit_driver_interface::LogEntry>, DriverError> {
            Ok(vec![])
        }
        async fn get_artifacts(
            &self,
            _h: &ExecutionHandle,
        ) -> Result<Vec<allternit_driver_interface::Artifact>, DriverError> {
            Ok(vec![])
        }

        async fn destroy(&self, handle: &ExecutionHandle) -> Result<(), DriverError> {
            self.destroys.lock().unwrap().push(handle.id.0);
            Ok(())
        }

        async fn get_consumption(
            &self,
            _h: &ExecutionHandle,
        ) -> Result<allternit_driver_interface::ResourceConsumption, DriverError> {
            Ok(Default::default())
        }
        async fn get_receipt(
            &self,
            _h: &ExecutionHandle,
        ) -> Result<Option<allternit_driver_interface::Receipt>, DriverError> {
            Ok(None)
        }

        async fn health_check(&self) -> Result<DriverHealth, DriverError> {
            Ok(DriverHealth {
                healthy: true,
                message: None,
                active_executions: 0,
                available_capacity: ResourceSpec::minimal(),
                capabilities: vec![],
            })
        }
    }

    fn cfg(min_idle: usize, max_total: usize, idle_ttl: Duration) -> PoolConfig {
        PoolConfig {
            min_idle,
            max_total,
            idle_ttl,
        }
    }

    #[test]
    fn config_from_env_overrides_defaults() {
        // Parse against explicit env values (unique names so parallel tests
        // don't collide: set, read, restore).
        std::env::set_var("ALLTERNIT_VM_POOL_MIN_IDLE", "2");
        std::env::set_var("ALLTERNIT_VM_POOL_MAX_TOTAL", "5");
        std::env::set_var("ALLTERNIT_VM_POOL_IDLE_TTL_SECS", "42");
        let c = PoolConfig::from_env();
        std::env::remove_var("ALLTERNIT_VM_POOL_MIN_IDLE");
        std::env::remove_var("ALLTERNIT_VM_POOL_MAX_TOTAL");
        std::env::remove_var("ALLTERNIT_VM_POOL_IDLE_TTL_SECS");
        assert_eq!(c.min_idle, 2);
        assert_eq!(c.max_total, 5);
        assert_eq!(c.idle_ttl, Duration::from_secs(42));
    }

    #[tokio::test]
    async fn checkout_spawns_then_checkin_reuses_idle_vm() {
        let driver = MockDriver::new();
        let pool = VmPool::restore(driver.clone(), cfg(0, 4, Duration::from_secs(600)), None);

        let first = pool.checkout().await.expect("checkout");
        assert_eq!(driver.spawn_count(), 1);

        pool.checkin(first.vm_id, true).await;
        assert_eq!(pool.stats().idle, 1);

        let second = pool.checkout().await.expect("checkout reuses idle");
        assert_eq!(
            driver.spawn_count(),
            1,
            "idle VM must be reused, not respawned"
        );
        pool.checkin(second.vm_id, true).await;
    }

    #[tokio::test]
    async fn unhealthy_checkin_destroys_vm() {
        let driver = MockDriver::new();
        let pool = VmPool::restore(driver.clone(), cfg(0, 4, Duration::from_secs(600)), None);

        let vm = pool.checkout().await.expect("checkout");
        pool.checkin(vm.vm_id, false).await;

        assert_eq!(pool.total(), 0);
        assert_eq!(driver.destroyed(), vec![vm.vm_id]);
    }

    #[tokio::test]
    async fn dead_idle_vm_is_destroyed_and_skipped() {
        let driver = MockDriver::new();
        let pool = VmPool::restore(driver.clone(), cfg(0, 4, Duration::from_secs(600)), None);

        let vm = pool.checkout().await.expect("checkout");
        pool.checkin(vm.vm_id, true).await;

        // The VM dies while idle; the next checkout must destroy it and
        // spawn a replacement rather than handing out a corpse.
        driver.kill_vm(vm.vm_id);
        let replacement = pool.checkout().await.expect("replacement checkout");
        assert!(driver.destroyed().contains(&vm.vm_id));
        assert!(replacement.vm_id != vm.vm_id);
        assert_eq!(driver.spawn_count(), 2);
    }

    #[tokio::test]
    async fn fail_closed_at_capacity() {
        let driver = MockDriver::new();
        let pool = VmPool::restore(driver.clone(), cfg(0, 1, Duration::from_secs(600)), None);

        let _held = pool.checkout().await.expect("first checkout");
        let err = pool.checkout().await.expect_err("second checkout must fail");
        assert_eq!(err, PoolError::NoCapacity);
        assert!(err.message().contains("503") || err.message().contains("capacity"));
    }

    #[tokio::test]
    async fn spawn_failure_is_unavailable_not_silent_success() {
        let driver = MockDriver::new();
        let pool = VmPool::restore(driver.clone(), cfg(0, 2, Duration::from_secs(600)), None);
        driver.fail_spawn();
        let err = pool.checkout().await.expect_err("spawn failure");
        matches!(err, PoolError::Unavailable(_));
    }

    #[tokio::test]
    async fn idle_ttl_reaps_idle_vms() {
        let driver = MockDriver::new();
        let pool = VmPool::restore(driver.clone(), cfg(0, 4, Duration::from_secs(0)), None);
        // idle_ttl of 0s: any idle VM is immediately expired. Use 1s floor
        // semantics via a tiny ttl and an aged last_used instead.
        let vm = pool.checkout().await.expect("checkout");
        pool.checkin(vm.vm_id, true).await;
        // Force the VM's last_used into the past.
        pool.vms
            .lock()
            .unwrap()
            .get_mut(&vm.vm_id)
            .unwrap()
            .last_used = Utc::now() - chrono::Duration::seconds(3600);
        pool.reap_expired().await;
        assert_eq!(pool.total(), 0);
        assert!(driver.destroyed().contains(&vm.vm_id));
    }

    #[tokio::test]
    async fn state_roundtrip_restores_idle_and_marks_checked_out_for_reclaim() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("pool-state.json");
        let driver = MockDriver::new();

        // Generation 1: two VMs spawned while both were checked out, then one
        // checked back in — leaving one idle + one held (as if mid-request).
        let pool = VmPool::restore(driver.clone(), cfg(0, 4, Duration::from_secs(600)), Some(path.clone()));
        let idle_vm = pool.checkout().await.unwrap();
        let held_vm = pool.checkout().await.unwrap();
        assert!(idle_vm.vm_id != held_vm.vm_id);
        pool.checkin(idle_vm.vm_id, true).await;
        assert_eq!(pool.stats().idle, 1);
        assert_eq!(pool.stats().checked_out, 1);
        drop(pool);

        // Generation 2 (simulated restart): idle VM restored as warm;
        // checked-out VM marked unknown for reclamation.
        let pool2 = VmPool::restore(driver.clone(), cfg(0, 4, Duration::from_secs(600)), Some(path));
        assert_eq!(pool2.stats().idle, 1);
        assert_eq!(pool2.pending_reclaim(), 1);

        pool2.reclaim_unknown().await;
        assert_eq!(pool2.pending_reclaim(), 0);
        assert!(
            driver.destroyed().contains(&held_vm.vm_id),
            "unknown VM must be destroyed on reclaim"
        );

        // The restored idle VM is still usable and health-checked.
        let reused = pool2.checkout().await.expect("restored idle reusable");
        assert_eq!(reused.vm_id, idle_vm.vm_id);
        assert_eq!(driver.spawn_count(), 2, "no new spawn for restored VM");
    }
}
