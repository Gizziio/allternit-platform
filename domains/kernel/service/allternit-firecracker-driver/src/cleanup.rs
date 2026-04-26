//! # Transactional Resource Cleanup (P0-1)
//!
//! Provides RAII guards and async cleanup coordination for VM resources.
//! Ensures resources are properly cleaned up even on panic or crash.
//!
//! ## Features
//!
//! - **ResourceHandle**: RAII guard that automatically cleans up resources on drop
//! - **CleanupCoordinator**: Async cleanup queue with retry logic and crash recovery
//! - **spawn_with_cleanup**: Panic-safe wrapper for VM spawning operations

use std::future::Future;
use std::panic::AssertUnwindSafe;
use std::path::{Path, PathBuf};

use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use allternit_driver_interface::{DriverError, ExecutionId};
use serde::{Deserialize, Serialize};
use tokio::fs;
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, Mutex};
use tokio::time::interval;
use tracing::{debug, error, info, info_span, warn};

/// RAII guard for VM resources that automatically cleans up on drop.
///
/// Track resources allocated during VM creation and ensure they are
/// properly cleaned up if the operation fails at any point.
///
/// # Example
///
/// ```rust,ignore
/// use allternit_firecracker_driver::ResourceHandle;
/// use allternit_driver_interface::ExecutionId;
/// use std::path::PathBuf;
///
/// let vm_id = ExecutionId::new();
/// let mut handle = ResourceHandle::new(vm_id);
/// handle.set_tap("tap-test".to_string());
/// handle.set_api_socket(PathBuf::from("/tmp/test.sock"));
///
/// // On success, disarm to prevent cleanup
/// handle.disarm();
/// ```
pub struct ResourceHandle {
    vm_id: ExecutionId,
    tap_name: Option<String>,
    api_socket: Option<PathBuf>,
    vsock_path: Option<PathBuf>,
    mount_points: Vec<String>,
    container_names: Vec<String>,
    process: Option<Child>,
    completed: bool,
    /// Reference to the coordinator for async cleanup
    coordinator: Option<Arc<CleanupCoordinator>>,
}

impl ResourceHandle {
    /// Create a new resource handle for the given VM ID.
    pub fn new(vm_id: ExecutionId) -> Self {
        Self {
            vm_id,
            tap_name: None,
            api_socket: None,
            vsock_path: None,
            mount_points: Vec::new(),
            container_names: Vec::new(),
            process: None,
            completed: false,
            coordinator: None,
        }
    }

    /// Create a new resource handle with a cleanup coordinator.
    pub fn with_coordinator(vm_id: ExecutionId, coordinator: Arc<CleanupCoordinator>) -> Self {
        Self {
            vm_id,
            tap_name: None,
            api_socket: None,
            vsock_path: None,
            mount_points: Vec::new(),
            container_names: Vec::new(),
            process: None,
            completed: false,
            coordinator: Some(coordinator),
        }
    }

    /// Set the TAP device name for cleanup.
    pub fn set_tap(&mut self, name: String) {
        self.tap_name = Some(name);
    }

    /// Set the API socket path for cleanup.
    pub fn set_api_socket(&mut self, path: PathBuf) {
        self.api_socket = Some(path);
    }

    /// Set the VSOCK path for cleanup.
    pub fn set_vsock_path(&mut self, path: PathBuf) {
        self.vsock_path = Some(path);
    }

    /// Set the Firecracker process handle.
    pub fn set_process(&mut self, process: Child) {
        self.process = Some(process);
    }

    /// Add a mount point that needs to be unmounted.
    pub fn add_mount(&mut self, path: String) {
        self.mount_points.push(path);
    }

    /// Add a container name that needs to be removed.
    pub fn add_container(&mut self, name: String) {
        self.container_names.push(name);
    }

    /// Disarm the cleanup mechanism - call this on successful completion.
    ///
    /// After calling `disarm`, the resources will NOT be cleaned up when
    /// the handle is dropped. This should be called once the VM is
    /// successfully running and all resources are committed.
    #[tracing::instrument(skip(self), fields(vm_id = %self.vm_id))]
    pub fn disarm(&mut self) {
        debug!(
            event = "cleanup.disarm",
            vm_id = %self.vm_id,
            "Disarming resource cleanup - VM successfully created"
        );
        self.completed = true;
        // Take ownership of the process so it won't be killed on drop
        let _ = self.process.take();
    }

    /// Check if cleanup has been disarmed.
    pub fn is_disarmed(&self) -> bool {
        self.completed
    }

    /// Get the VM ID associated with this handle.
    pub fn vm_id(&self) -> ExecutionId {
        self.vm_id
    }

    /// Perform synchronous cleanup operations.
    /// This is called from Drop, so it must be quick and non-blocking.
    fn sync_cleanup(&mut self) {
        if self.completed {
            return;
        }

        warn!(
            event = "cleanup.sync.start",
            vm_id = %self.vm_id,
            tap = ?self.tap_name,
            api_socket = ?self.api_socket,
            mount_count = self.mount_points.len(),
            "Performing synchronous cleanup for incomplete VM"
        );

        // Kill process synchronously if possible
        if let Some(mut process) = self.process.take() {
            let _ = process.start_kill();
        }

        // Queue async cleanup if we have a coordinator
        if let Some(coordinator) = &self.coordinator {
            let resources = self.to_cleanup_resources();
            let coordinator = Arc::clone(coordinator);
            tokio::spawn(async move {
                if let Err(e) = coordinator.queue_cleanup(resources).await {
                    error!(error = %e, "Failed to queue cleanup");
                }
            });
        }
    }

    /// Convert this handle's resources to a CleanupResources structure.
    fn to_cleanup_resources(&self) -> CleanupResources {
        CleanupResources {
            vm_id: self.vm_id,
            tap_name: self.tap_name.clone(),
            api_socket: self.api_socket.clone(),
            vsock_path: self.vsock_path.clone(),
            mount_points: self.mount_points.clone(),
            container_names: self.container_names.clone(),
            created_at: chrono::Utc::now(),
        }
    }
}

impl Drop for ResourceHandle {
    fn drop(&mut self) {
        self.sync_cleanup();
    }
}

/// Serializable resource cleanup record for persistence.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupResources {
    pub vm_id: ExecutionId,
    pub tap_name: Option<String>,
    pub api_socket: Option<PathBuf>,
    pub vsock_path: Option<PathBuf>,
    pub mount_points: Vec<String>,
    pub container_names: Vec<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Cleanup operation status for tracking retry attempts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
enum CleanupStatus {
    Pending,
    InProgress,
    Completed,
    Failed { attempts: u32 },
}

/// Pending cleanup operation with retry tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PendingCleanup {
    resources: CleanupResources,
    status: CleanupStatus,
    next_attempt: chrono::DateTime<chrono::Utc>,
}

/// Coordinator for async cleanup operations with retry logic and crash recovery.
///
/// The coordinator maintains a queue of cleanup operations that are processed
/// in the background. Failed operations are retried with exponential backoff.
/// Pending cleanups are persisted to disk for crash recovery.
pub struct CleanupCoordinator {
    /// Queue sender for new cleanup operations
    queue_tx: mpsc::Sender<CleanupResources>,
    /// In-memory tracking of pending cleanups
    pending: Arc<Mutex<Vec<PendingCleanup>>>,
    /// Base directory for persistence
    state_dir: PathBuf,
    /// Flag indicating if the background task is running
    running: AtomicBool,
    /// Maximum retry attempts
    max_retries: u32,
    /// Base delay for exponential backoff (milliseconds)
    base_delay_ms: u64,
}

impl CleanupCoordinator {
    /// Create a new cleanup coordinator with the given state directory.
    ///
    /// The state directory is used to persist pending cleanups for crash recovery.
    #[tracing::instrument(skip(state_dir))]
    pub async fn new(state_dir: impl AsRef<Path>) -> Result<Arc<Self>, DriverError> {
        let state_dir = state_dir.as_ref().to_path_buf();

        // Ensure state directory exists
        fs::create_dir_all(&state_dir)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create cleanup state directory: {}", e),
            })?;

        let (queue_tx, queue_rx) = mpsc::channel(100);
        let pending = Arc::new(Mutex::new(Vec::new()));

        let coordinator = Arc::new(Self {
            queue_tx,
            pending: Arc::clone(&pending),
            state_dir,
            running: AtomicBool::new(false),
            max_retries: 3,
            base_delay_ms: 1000,
        });

        // Load any pending cleanups from disk
        let recovered = coordinator.load_pending().await?;
        if !recovered.is_empty() {
            info!(
                event = "cleanup.recovered",
                count = recovered.len(),
                "Recovered pending cleanups from disk"
            );
            let mut pending_guard = pending.lock().await;
            *pending_guard = recovered;
        }

        // Start the background processing task
        coordinator.start_background_task(queue_rx).await;

        Ok(coordinator)
    }

    /// Queue a cleanup operation for async processing.
    #[tracing::instrument(skip(self, resources), fields(vm_id = %resources.vm_id))]
    pub async fn queue_cleanup(&self, resources: CleanupResources) -> Result<(), DriverError> {
        info!(
            event = "cleanup.queue",
            vm_id = %resources.vm_id,
            tap = ?resources.tap_name,
            socket = ?resources.api_socket,
            mount_count = resources.mount_points.len(),
            container_count = resources.container_names.len(),
            "Queueing cleanup operation"
        );

        // Add to in-memory queue
        let pending_cleanup = PendingCleanup {
            resources: resources.clone(),
            status: CleanupStatus::Pending,
            next_attempt: chrono::Utc::now(),
        };

        self.pending.lock().await.push(pending_cleanup);

        // Persist to disk
        self.persist_pending().await?;

        // Notify the background task
        self.queue_tx
            .send(resources)
            .await
            .map_err(|_| DriverError::InternalError {
                message: "Cleanup queue closed".to_string(),
            })?;

        Ok(())
    }

    /// Start the background cleanup processing task.
    #[tracing::instrument(skip(self, queue_rx))]
    async fn start_background_task(
        self: &Arc<Self>,
        mut queue_rx: mpsc::Receiver<CleanupResources>,
    ) {
        if self.running.swap(true, Ordering::SeqCst) {
            return; // Already running
        }

        let coordinator = Arc::clone(self);

        tokio::spawn(async move {
            info!(
                event = "cleanup.task.start",
                "Cleanup coordinator background task started"
            );

            // Process queue messages
            let mut ticker = interval(Duration::from_secs(5));

            loop {
                tokio::select! {
                    // New cleanup request
                    Some(resources) = queue_rx.recv() => {
                        coordinator.process_cleanup(resources).await;
                    }
                    // Periodic retry check
                    _ = ticker.tick() => {
                        coordinator.retry_pending().await;
                    }
                    // Channel closed
                    else => {
                        warn!(
                            event = "cleanup.task.channel_closed",
                            "Cleanup queue receiver closed, stopping background task"
                        );
                        break;
                    }
                }
            }

            coordinator.running.store(false, Ordering::SeqCst);
        });
    }

    /// Process a single cleanup operation.
    #[tracing::instrument(skip(self, resources), fields(vm_id = %resources.vm_id))]
    async fn process_cleanup(&self, resources: CleanupResources) {
        debug!(
            event = "cleanup.process.start",
            vm_id = %resources.vm_id,
            "Processing cleanup"
        );

        let mut success = true;

        // Clean up TAP device
        if let Some(ref tap_name) = resources.tap_name {
            if let Err(e) = Self::cleanup_tap_device(tap_name).await {
                warn!(error = %e, tap = %tap_name, "Failed to cleanup TAP device");
                success = false;
            }
        }

        // Clean up API socket
        if let Some(ref socket_path) = resources.api_socket {
            if let Err(e) = Self::cleanup_socket(socket_path).await {
                warn!(error = %e, path = %socket_path.display(), "Failed to cleanup API socket");
                success = false;
            }
        }

        // Clean up VSOCK path
        if let Some(ref vsock_path) = resources.vsock_path {
            if let Err(e) = Self::cleanup_socket(vsock_path).await {
                warn!(error = %e, path = %vsock_path.display(), "Failed to cleanup VSOCK");
                success = false;
            }
        }

        // Clean up mount points
        for mount_point in &resources.mount_points {
            if let Err(e) = Self::cleanup_mount(mount_point).await {
                warn!(error = %e, mount = %mount_point, "Failed to unmount");
                success = false;
            }
        }

        // Clean up containers
        for container_name in &resources.container_names {
            if let Err(e) = Self::cleanup_container(container_name).await {
                warn!(error = %e, container = %container_name, "Failed to remove container");
                success = false;
            }
        }

        // Update status
        if success {
            info!(
                event = "cleanup.process.complete",
                vm_id = %resources.vm_id,
                "Cleanup completed successfully"
            );
            self.remove_pending(&resources.vm_id).await;
        } else {
            warn!(
                event = "cleanup.process.partial_failure",
                vm_id = %resources.vm_id,
                "Cleanup partially failed, will retry"
            );
            self.mark_for_retry(&resources.vm_id).await;
        }
    }

    /// Retry pending cleanups that have exceeded their backoff time.
    async fn retry_pending(&self) {
        let now = chrono::Utc::now();
        let mut to_retry = Vec::new();

        {
            let mut pending = self.pending.lock().await;
            for cleanup in pending.iter_mut() {
                if matches!(cleanup.status, CleanupStatus::Failed { .. })
                    && cleanup.next_attempt <= now
                {
                    cleanup.status = CleanupStatus::InProgress;
                    to_retry.push(cleanup.resources.clone());
                }
            }
        }

        for resources in to_retry {
            debug!(vm_id = %resources.vm_id, "Retrying cleanup");
            self.process_cleanup(resources).await;
        }
    }

    /// Mark a pending cleanup for retry with exponential backoff.
    async fn mark_for_retry(&self, vm_id: &ExecutionId) {
        let mut pending = self.pending.lock().await;

        for cleanup in pending.iter_mut() {
            if cleanup.resources.vm_id == *vm_id {
                let attempts = match cleanup.status {
                    CleanupStatus::Failed { attempts } => attempts + 1,
                    _ => 1,
                };

                if attempts >= self.max_retries {
                    error!(
                        event = "cleanup.max_retries_exceeded",
                        vm_id = %vm_id,
                        attempts = attempts,
                        max_retries = self.max_retries,
                        "Cleanup failed after max retries"
                    );
                    cleanup.status = CleanupStatus::Failed { attempts };
                } else {
                    // Exponential backoff: 1s, 2s, 4s
                    let delay = Duration::from_millis(self.base_delay_ms * (1 << (attempts - 1)));
                    cleanup.next_attempt = chrono::Utc::now()
                        + chrono::Duration::from_std(delay)
                            .unwrap_or_else(|_| chrono::Duration::seconds(1));
                    cleanup.status = CleanupStatus::Failed { attempts };
                    info!(
                        event = "cleanup.retry.scheduled",
                        vm_id = %vm_id,
                        attempt = attempts,
                        next_attempt = %cleanup.next_attempt,
                        delay_ms = self.base_delay_ms * (1 << (attempts - 1)),
                        "Scheduling retry"
                    );
                }
                break;
            }
        }

        // Persist updated state
        drop(pending);
        let _ = self.persist_pending().await;
    }

    /// Remove a pending cleanup entry after successful completion.
    async fn remove_pending(&self, vm_id: &ExecutionId) {
        let mut pending = self.pending.lock().await;
        pending.retain(|c| c.resources.vm_id != *vm_id);
        drop(pending);
        let _ = self.persist_pending().await;
    }

    /// Persist pending cleanups to disk for crash recovery.
    async fn persist_pending(&self) -> Result<(), DriverError> {
        let pending = self.pending.lock().await;
        let path = self.state_dir.join("pending_cleanups.json");
        let temp_path = self.state_dir.join("pending_cleanups.json.tmp");

        let json =
            serde_json::to_string_pretty(&*pending).map_err(|e| DriverError::InternalError {
                message: format!("Failed to serialize pending cleanups: {}", e),
            })?;

        fs::write(&temp_path, json)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write pending cleanups: {}", e),
            })?;

        fs::rename(&temp_path, &path)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to rename pending cleanups file: {}", e),
            })?;

        Ok(())
    }

    /// Load pending cleanups from disk (crash recovery).
    async fn load_pending(&self) -> Result<Vec<PendingCleanup>, DriverError> {
        let path = self.state_dir.join("pending_cleanups.json");

        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&path)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read pending cleanups: {}", e),
            })?;

        if content.trim().is_empty() {
            return Ok(Vec::new());
        }

        let pending: Vec<PendingCleanup> =
            serde_json::from_str(&content).map_err(|e| DriverError::InternalError {
                message: format!("Failed to parse pending cleanups: {}", e),
            })?;

        // Filter out stale cleanups (older than 24 hours)
        let cutoff = chrono::Utc::now() - chrono::Duration::hours(24);
        let filtered: Vec<_> = pending
            .into_iter()
            .filter(|c| c.resources.created_at > cutoff)
            .collect();

        Ok(filtered)
    }

    /// Clean up a TAP device.
    #[tracing::instrument(fields(tap_name = %tap_name))]
    async fn cleanup_tap_device(tap_name: &str) -> Result<(), DriverError> {
        debug!(
            event = "cleanup.tap.start",
            tap = %tap_name,
            "Cleaning up TAP device"
        );

        let output = Command::new("ip")
            .args(["tuntap", "del", tap_name, "mode", "tap"])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to delete TAP device {}: {}", tap_name, e),
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Don't fail if device doesn't exist
            if stderr.contains("cannot find") || stderr.contains("No such device") {
                debug!(tap = %tap_name, "TAP device already removed");
                return Ok(());
            }
            return Err(DriverError::InternalError {
                message: format!("Failed to delete TAP device {}: {}", tap_name, stderr),
            });
        }

        info!(
            event = "cleanup.tap.complete",
            tap = %tap_name,
            "TAP device removed"
        );
        Ok(())
    }

    /// Clean up a Unix socket file.
    #[tracing::instrument(fields(socket_path = %socket_path.display()))]
    async fn cleanup_socket(socket_path: &Path) -> Result<(), DriverError> {
        debug!(
            event = "cleanup.socket.start",
            path = %socket_path.display(),
            "Cleaning up socket"
        );

        match fs::remove_file(socket_path).await {
            Ok(_) => {
                info!(path = %socket_path.display(), "Socket removed");
                Ok(())
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                debug!(path = %socket_path.display(), "Socket already removed");
                Ok(())
            }
            Err(e) => Err(DriverError::InternalError {
                message: format!("Failed to remove socket {}: {}", socket_path.display(), e),
            }),
        }
    }

    /// Clean up a mount point.
    #[tracing::instrument(fields(mount_point = %mount_point))]
    async fn cleanup_mount(mount_point: &str) -> Result<(), DriverError> {
        debug!(
            event = "cleanup.mount.start",
            mount = %mount_point,
            "Cleaning up mount point"
        );

        // Try to unmount
        let output = Command::new("umount").arg(mount_point).output().await;

        match output {
            Ok(output) if output.status.success() => {
                info!(mount = %mount_point, "Mount point unmounted");
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                if stderr.contains("not mounted") || stderr.contains("not found") {
                    debug!(mount = %mount_point, "Mount point not active");
                } else {
                    warn!(mount = %mount_point, error = %stderr, "Failed to unmount");
                }
            }
            Err(e) => {
                warn!(mount = %mount_point, error = %e, "Failed to run umount");
            }
        }

        // Remove mount directory
        match fs::remove_dir(mount_point).await {
            Ok(_) => {
                info!(mount = %mount_point, "Mount directory removed");
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => {
                warn!(mount = %mount_point, error = %e, "Failed to remove mount directory");
            }
        }

        Ok(())
    }

    /// Clean up a container (docker/podman).
    #[tracing::instrument(fields(container_name = %container_name))]
    async fn cleanup_container(container_name: &str) -> Result<(), DriverError> {
        debug!(
            event = "cleanup.container.start",
            container = %container_name,
            "Cleaning up container"
        );

        // Try docker first, then podman
        for cmd in ["docker", "podman"] {
            let output = Command::new(cmd)
                .args(["rm", "-f", container_name])
                .stderr(Stdio::null())
                .stdout(Stdio::null())
                .output()
                .await;

            if let Ok(output) = output {
                if output.status.success() {
                    info!(container = %container_name, tool = %cmd, "Container removed");
                    return Ok(());
                }
            }
        }

        // Don't fail if container doesn't exist or tool not available
        debug!(container = %container_name, "Container not found or cleanup tools unavailable");
        Ok(())
    }
}

/// Spawn a future with automatic cleanup on panic.
///
/// This function wraps an async block with panic catching and ensures
/// that resources are cleaned up even if the operation panics.
///
/// # Example
///
/// ```rust,ignore
/// use allternit_firecracker_driver::{spawn_with_cleanup, ResourceHandle};
/// use allternit_driver_interface::{ExecutionId, DriverError, ExecutionHandle};
///
/// async fn spawn_vm() -> Result<ExecutionHandle, DriverError> {
///     let vm_id = ExecutionId::new();
///     
///     spawn_with_cleanup(|| async move {
///         let mut handle = ResourceHandle::new(vm_id);
///         // ... setup resources ...
///         
///         // On success, disarm
///         handle.disarm();
///         Ok(ExecutionHandle { /* ... */ })
///     }).await
/// }
/// ```
pub async fn spawn_with_cleanup<F, Fut, T>(f: F) -> Result<T, DriverError>
where
    F: FnOnce() -> Fut + Send + 'static,
    Fut: Future<Output = Result<T, DriverError>> + Send,
    T: Send + 'static,
{
    let span = info_span!("spawn_with_cleanup");
    let _enter = span.enter();
    // Wrap the future in catch_unwind
    let result = std::panic::catch_unwind(AssertUnwindSafe(|| {
        // We need to block on the async function here
        tokio::runtime::Handle::current().block_on(f())
    }));

    match result {
        Ok(Ok(value)) => Ok(value),
        Ok(Err(e)) => {
            // Function returned an error - cleanup should have been handled
            Err(e)
        }
        Err(panic_info) => {
            // Panic occurred - resources may be leaked
            let panic_msg = if let Some(s) = panic_info.downcast_ref::<String>() {
                s.clone()
            } else if let Some(s) = panic_info.downcast_ref::<&str>() {
                s.to_string()
            } else {
                "Unknown panic".to_string()
            };

            error!(
                event = "spawn.panic",
                panic = %panic_msg,
                "Panic during VM spawn"
            );

            // Note: Resources allocated before the panic may be leaked
            // The CleanupCoordinator's crash recovery will handle them on restart
            Err(DriverError::SpawnFailed {
                reason: format!("Panic during spawn: {}", panic_msg),
            })
        }
    }
}

/// Alternative panic-safe wrapper using tokio's spawn and JoinSet.
///
/// This is a safer approach that properly handles async cleanup.
pub async fn spawn_with_cleanup_async<F, Fut, T>(
    coordinator: Arc<CleanupCoordinator>,
    vm_id: ExecutionId,
    f: F,
) -> Result<T, DriverError>
where
    F: FnOnce(Arc<ResourceGuard>) -> Fut + Send + 'static,
    Fut: Future<Output = Result<T, DriverError>> + Send,
    T: Send + 'static,
{
    let span = info_span!("spawn_with_cleanup_async", vm_id = %vm_id);
    let _enter = span.enter();
    let guard = Arc::new(ResourceGuard::new(vm_id, coordinator));
    let guard_clone = Arc::clone(&guard);

    let handle = tokio::spawn(async move { f(guard_clone).await });

    match handle.await {
        Ok(Ok(result)) => {
            // Success - disarm the guard
            info!(event = "spawn.success", vm_id = %vm_id, "VM spawned successfully");
            guard.disarm();
            Ok(result)
        }
        Ok(Err(e)) => Err(e),
        Err(join_error) => {
            if join_error.is_panic() {
                error!(
                    event = "spawn.task_panic",
                    vm_id = %vm_id,
                    "Task panicked"
                );
                Err(DriverError::SpawnFailed {
                    reason: "Spawn task panicked".to_string(),
                })
            } else {
                Err(DriverError::SpawnFailed {
                    reason: format!("Spawn task failed: {}", join_error),
                })
            }
        }
    }
}

/// A resource guard that works with Arc for shared ownership during async operations.
pub struct ResourceGuard {
    vm_id: ExecutionId,
    coordinator: Arc<CleanupCoordinator>,
    disarmed: AtomicBool,
    resources: Mutex<CleanupResources>,
}

impl ResourceGuard {
    /// Create a new resource guard.
    pub fn new(vm_id: ExecutionId, coordinator: Arc<CleanupCoordinator>) -> Self {
        Self {
            vm_id,
            coordinator,
            disarmed: AtomicBool::new(false),
            resources: Mutex::new(CleanupResources {
                vm_id,
                tap_name: None,
                api_socket: None,
                vsock_path: None,
                mount_points: Vec::new(),
                container_names: Vec::new(),
                created_at: chrono::Utc::now(),
            }),
        }
    }

    /// Disarm the guard to prevent cleanup.
    #[tracing::instrument(skip(self), fields(vm_id = %self.vm_id))]
    pub fn disarm(&self) {
        self.disarmed.store(true, Ordering::SeqCst);
        debug!(
            event = "guard.disarm",
            vm_id = %self.vm_id,
            "Resource guard disarmed"
        );
    }

    /// Set the TAP device name.
    pub async fn set_tap(&self, name: String) {
        self.resources.lock().await.tap_name = Some(name);
    }

    /// Set the API socket path.
    pub async fn set_api_socket(&self, path: PathBuf) {
        self.resources.lock().await.api_socket = Some(path);
    }

    /// Set the VSOCK path.
    pub async fn set_vsock_path(&self, path: PathBuf) {
        self.resources.lock().await.vsock_path = Some(path);
    }

    /// Add a mount point.
    pub async fn add_mount(&self, path: String) {
        self.resources.lock().await.mount_points.push(path);
    }

    /// Add a container name.
    pub async fn add_container(&self, name: String) {
        self.resources.lock().await.container_names.push(name);
    }
}

impl Drop for ResourceGuard {
    fn drop(&mut self) {
        if !self.disarmed.load(Ordering::SeqCst) {
            warn!(vm_id = %self.vm_id, "Resource guard dropped without disarm - queuing cleanup");

            // Clone what we need for the async block
            let coordinator = Arc::clone(&self.coordinator);
            let resources = self
                .resources
                .try_lock()
                .map(|g| g.clone())
                .unwrap_or_else(|_| CleanupResources {
                    vm_id: self.vm_id,
                    tap_name: None,
                    api_socket: None,
                    vsock_path: None,
                    mount_points: Vec::new(),
                    container_names: Vec::new(),
                    created_at: chrono::Utc::now(),
                });

            // Spawn cleanup task
            tokio::spawn(async move {
                if let Err(e) = coordinator.queue_cleanup(resources).await {
                    error!(error = %e, "Failed to queue cleanup from guard drop");
                }
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_resource_handle_disarm() {
        let vm_id = ExecutionId::new();
        let mut handle = ResourceHandle::new(vm_id);

        handle.set_tap("tap-test".to_string());
        handle.set_api_socket(PathBuf::from("/tmp/test.sock"));

        assert!(!handle.is_disarmed());
        handle.disarm();
        assert!(handle.is_disarmed());
    }

    #[tokio::test]
    async fn test_cleanup_coordinator_new() {
        let temp_dir = std::env::temp_dir().join(format!("allternit-test-{}", uuid::Uuid::new_v4()));
        let coordinator = CleanupCoordinator::new(&temp_dir).await;
        assert!(coordinator.is_ok());

        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir).await;
    }

    #[tokio::test]
    async fn test_cleanup_resources_serialization() {
        let resources = CleanupResources {
            vm_id: ExecutionId::new(),
            tap_name: Some("tap-test".to_string()),
            api_socket: Some(PathBuf::from("/tmp/test.sock")),
            vsock_path: None,
            mount_points: vec!["/mnt/test".to_string()],
            container_names: vec!["test-container".to_string()],
            created_at: chrono::Utc::now(),
        };

        let json = serde_json::to_string(&resources).unwrap();
        let deserialized: CleanupResources = serde_json::from_str(&json).unwrap();

        assert_eq!(resources.tap_name, deserialized.tap_name);
        assert_eq!(resources.mount_points, deserialized.mount_points);
    }
}
