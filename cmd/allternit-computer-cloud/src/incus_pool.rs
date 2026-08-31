//! Multi-host Incus pool for the heterogeneous desktop substrate.
//!
//! Keeps a registry of Incus hosts behind one `IncusDriver`. Spawn requests use
//! capacity-aware placement; lifecycle operations use the host stored in the
//! execution handle so a VM is always managed by the same Incus daemon that
//! created it.

use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, RwLock};

use tracing::{info, warn};

use crate::substrate::{IncusSubstrate, SubstrateError};

/// One entry in the Incus host pool.
#[derive(Debug)]
pub struct IncusHost {
    /// Incus HTTPS URL, e.g. `https://incus-1:8443`.
    pub url: String,
    /// Hostname:port clients should use to reach VNC proxy ports on this host.
    pub vnc_host: String,
    /// Substrate client for this host.
    pub substrate: Arc<IncusSubstrate>,
    /// Scheduling weight. Zero means "do not place new VMs here".
    pub weight: AtomicUsize,
    /// Total memory on the host, in MiB.
    pub total_memory_mb: AtomicU64,
    /// Used memory on the host, in MiB (best-effort sample).
    pub used_memory_mb: AtomicU64,
    /// Image aliases known to be cached on this host.
    pub cached_images: RwLock<Vec<String>>,
}

impl IncusHost {
    pub fn new(url: impl Into<String>, substrate: Arc<IncusSubstrate>) -> Self {
        let url = url.into();
        let vnc_host = vnc_host_from_url(&url);
        Self {
            url,
            vnc_host,
            substrate,
            weight: AtomicUsize::new(1),
            total_memory_mb: AtomicU64::new(0),
            used_memory_mb: AtomicU64::new(0),
            cached_images: RwLock::new(Vec::new()),
        }
    }

    pub fn with_weight(self, weight: u32) -> Self {
        self.weight.store(weight as usize, Ordering::Relaxed);
        self
    }

    pub fn with_memory(self, total_mb: u64, used_mb: u64) -> Self {
        self.total_memory_mb.store(total_mb, Ordering::Relaxed);
        self.used_memory_mb.store(used_mb, Ordering::Relaxed);
        self
    }

    pub fn weight(&self) -> usize {
        self.weight.load(Ordering::Relaxed)
    }

    pub fn free_memory_mb(&self) -> u64 {
        self.total_memory_mb
            .load(Ordering::Relaxed)
            .saturating_sub(self.used_memory_mb.load(Ordering::Relaxed))
    }

    pub fn has_image_cached(&self, alias: &str) -> bool {
        self.cached_images
            .read()
            .ok()
            .map(|v| v.iter().any(|a| a == alias))
            .unwrap_or(false)
    }
}

/// A pool of Incus hosts with capacity-aware placement.
#[derive(Debug)]
pub struct IncusHostPool {
    hosts: RwLock<Vec<Arc<IncusHost>>>,
    next: AtomicUsize,
}

impl IncusHostPool {
    /// Build a pool from an explicit list of hosts.
    pub fn new(hosts: Vec<Arc<IncusHost>>) -> Self {
        assert!(!hosts.is_empty(), "IncusHostPool requires at least one host");
        Self {
            hosts: RwLock::new(hosts),
            next: AtomicUsize::new(0),
        }
    }

    /// Convenience: single-host pool.
    pub fn single(url: impl Into<String>, substrate: Arc<IncusSubstrate>) -> Self {
        Self::new(vec![Arc::new(IncusHost::new(url, substrate))])
    }

    /// Number of configured hosts.
    pub fn len(&self) -> usize {
        self.hosts.read().map(|h| h.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Iterate over configured hosts.
    pub fn hosts(&self) -> Vec<Arc<IncusHost>> {
        self.hosts.read().map(|h| h.clone()).unwrap_or_default()
    }

    /// Add a host at runtime.
    pub fn add_host(&self, host: Arc<IncusHost>) {
        let mut hosts = self.hosts.write().expect("IncusHostPool lock poisoned");
        hosts.push(host);
        info!(host_count = hosts.len(), "added Incus host to pool");
    }

    /// Remove a host by URL.
    pub fn remove_host(&self, url: &str) -> bool {
        let mut hosts = self.hosts.write().expect("IncusHostPool lock poisoned");
        let before = hosts.len();
        hosts.retain(|h| h.url != url);
        let removed = hosts.len() < before;
        if removed {
            info!(url, host_count = hosts.len(), "removed Incus host from pool");
        }
        removed
    }

    /// Update capacity metadata for a host.
    pub fn set_host_capacity(&self, url: &str, total_mb: u64, used_mb: u64) {
        let hosts = self.hosts.read().expect("IncusHostPool lock poisoned");
        if let Some(host) = hosts.iter().find(|h| h.url == url) {
            host.total_memory_mb.store(total_mb, Ordering::Relaxed);
            host.used_memory_mb.store(used_mb, Ordering::Relaxed);
        }
    }

    /// Update cached image aliases for a host.
    pub fn set_host_images(&self, url: &str, images: Vec<String>) {
        let hosts = self.hosts.read().expect("IncusHostPool lock poisoned");
        if let Some(host) = hosts.iter().find(|h| h.url == url) {
            if let Ok(mut cached) = host.cached_images.write() {
                *cached = images;
            }
        }
    }

    /// Pick a host for a new VM.
    ///
    /// Prefer active hosts with the requested image cached, then the host with
    /// the most free memory that can fit the request. Fall back to round-robin
    /// when no memory data is available.
    pub fn select_for_spawn(
        &self,
        memory_mib: u32,
        image_alias: Option<&str>,
    ) -> Result<Arc<IncusHost>, SubstrateError> {
        let hosts = self.hosts.read().expect("IncusHostPool lock poisoned");
        if hosts.is_empty() {
            return Err(SubstrateError::Request(
                "no Incus hosts available for spawn".to_string(),
            ));
        }

        let memory_mib = memory_mib as u64;
        let mut candidates: Vec<&Arc<IncusHost>> = hosts
            .iter()
            .filter(|h| h.weight() > 0)
            .collect();

        if candidates.is_empty() {
            return Err(SubstrateError::Request(
                "no Incus hosts available for spawn".to_string(),
            ));
        }

        // If we have memory data, only consider hosts that can fit the VM.
        let has_capacity_data = candidates.iter().any(|h| h.total_memory_mb.load(Ordering::Relaxed) > 0);
        if has_capacity_data {
            candidates.retain(|h| h.free_memory_mb() >= memory_mib);
            if candidates.is_empty() {
                return Err(SubstrateError::Request(
                    "no Incus host has enough free memory".to_string(),
                ));
            }
        }

        // Prefer hosts that already have the image cached.
        if let Some(alias) = image_alias {
            let with_image: Vec<&Arc<IncusHost>> = candidates
                .iter()
                .filter(|h| h.has_image_cached(alias))
                .copied()
                .collect();
            if !with_image.is_empty() {
                candidates = with_image;
            }
        }

        if has_capacity_data {
            candidates.sort_by_key(|h| h.free_memory_mb());
            let chosen = candidates.last().cloned().cloned().ok_or_else(|| {
                SubstrateError::Request("no Incus host available for spawn".to_string())
            })?;
            info!(host = %chosen.url, free_mb = chosen.free_memory_mb(), "selected Incus host by capacity");
            return Ok(chosen);
        }

        // No capacity data yet: round-robin across weighted hosts.
        let len = candidates.len();
        let start = self.next.fetch_add(1, Ordering::Relaxed) % len;
        for offset in 0..len {
            let idx = (start + offset) % len;
            let h = candidates[idx].clone();
            info!(host = %h.url, "selected Incus host round-robin");
            return Ok(h);
        }

        Err(SubstrateError::Request(
            "no Incus hosts available for spawn".to_string(),
        ))
    }

    /// Look up the host that originally owned a VM. Falls back to the first
    /// host if the stored URL is unknown (handles pre-pool handles).
    pub fn host_for_handle(
        &self,
        handle: &allternit_driver_interface::ExecutionHandle,
    ) -> Arc<IncusHost> {
        let hosts = self.hosts.read().expect("IncusHostPool lock poisoned");
        if let Some(url) = handle.driver_info.get("host_url") {
            if let Some(h) = hosts.iter().find(|h| &h.url == url) {
                return h.clone();
            }
            warn!(url, "execution handle references unknown Incus host; using fallback");
        }
        hosts
            .first()
            .cloned()
            .expect("IncusHostPool requires at least one host")
    }
}

/// Extract `host:port` from an Incus URL for VNC proxy connections.
fn vnc_host_from_url(url: &str) -> String {
    let url = url.trim();
    let without_scheme = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .unwrap_or(url);
    without_scheme
        .split('/')
        .next()
        .unwrap_or(without_scheme)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fake_substrate() -> Arc<IncusSubstrate> {
        // Scheduling tests never touch the network; a dummy URL is enough.
        Arc::new(IncusSubstrate::new("http://dummy").unwrap())
    }

    fn host(url: &str, total: u64, used: u64) -> Arc<IncusHost> {
        Arc::new(
            IncusHost::new(url, fake_substrate())
                .with_memory(total, used),
        )
    }

    #[test]
    fn capacity_aware_selects_host_with_most_free_memory() {
        let pool = IncusHostPool::new(vec![
            host("https://a:8443", 8192, 7000),
            host("https://b:8443", 8192, 1000),
            host("https://c:8443", 8192, 4000),
        ]);

        let chosen = pool.select_for_spawn(2048, None).unwrap();
        assert_eq!(chosen.url, "https://b:8443");
    }

    #[test]
    fn capacity_aware_prefers_image_cache() {
        let h1 = host("https://a:8443", 8192, 1000);
        h1.cached_images.write().unwrap().push("allternit-desktop".to_string());
        let h2 = host("https://b:8443", 8192, 500);

        let pool = IncusHostPool::new(vec![h1, h2]);
        let chosen = pool.select_for_spawn(1024, Some("allternit-desktop")).unwrap();
        assert_eq!(chosen.url, "https://a:8443");
    }

    #[test]
    fn zero_weight_hosts_are_skipped() {
        let pool = IncusHostPool::new(vec![
            Arc::new(IncusHost::new("https://a:8443", fake_substrate()).with_weight(0)),
            host("https://b:8443", 8192, 100),
        ]);

        for _ in 0..10 {
            assert_eq!(pool.select_for_spawn(512, None).unwrap().url, "https://b:8443");
        }
    }

    #[test]
    fn vnc_host_derived_from_url() {
        let h = IncusHost::new("https://mail.news.allternit.com:8443", fake_substrate());
        assert_eq!(h.vnc_host, "mail.news.allternit.com:8443");
    }
}
