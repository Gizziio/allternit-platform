//! Multi-host Incus pool for the heterogeneous desktop substrate.
//!
//! Keeps a small registry of Incus hosts behind one `IncusDriver`. Spawn
//! requests are round-robined across healthy hosts; lifecycle operations use
//! the host stored in the execution handle so a VM is always managed by the
//! same Incus daemon that created it.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

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
    pub weight: u32,
}

impl IncusHost {
    pub fn new(url: impl Into<String>, substrate: Arc<IncusSubstrate>) -> Self {
        let url = url.into();
        let vnc_host = vnc_host_from_url(&url);
        Self {
            url,
            vnc_host,
            substrate,
            weight: 1,
        }
    }

    pub fn with_weight(mut self, weight: u32) -> Self {
        self.weight = weight;
        self
    }
}

/// A pool of Incus hosts with round-robin placement.
#[derive(Debug)]
pub struct IncusHostPool {
    hosts: Vec<IncusHost>,
    next: AtomicUsize,
}

impl IncusHostPool {
    /// Build a pool from an explicit list of hosts.
    pub fn new(hosts: Vec<IncusHost>) -> Self {
        assert!(!hosts.is_empty(), "IncusHostPool requires at least one host");
        Self {
            hosts,
            next: AtomicUsize::new(0),
        }
    }

    /// Convenience: single-host pool.
    pub fn single(url: impl Into<String>, substrate: Arc<IncusSubstrate>) -> Self {
        Self::new(vec![IncusHost::new(url, substrate)])
    }

    /// Number of configured hosts.
    pub fn len(&self) -> usize {
        self.hosts.len()
    }

    pub fn is_empty(&self) -> bool {
        self.hosts.is_empty()
    }

    /// Iterate over configured hosts.
    pub fn hosts(&self) -> &[IncusHost] {
        &self.hosts
    }

    /// Pick a host for a new VM. Round-robins across hosts with weight > 0.
    pub fn select_for_spawn(&self) -> Result<&IncusHost, SubstrateError> {
        let len = self.hosts.len();
        if len == 1 {
            let h = &self.hosts[0];
            return if h.weight > 0 {
                Ok(h)
            } else {
                Err(SubstrateError::Request(
                    "only Incus host has weight 0".to_string(),
                ))
            };
        }

        let start = self.next.fetch_add(1, Ordering::Relaxed) % len;
        for offset in 0..len {
            let idx = (start + offset) % len;
            let h = &self.hosts[idx];
            if h.weight > 0 {
                info!(host = %h.url, "selected Incus host for spawn");
                return Ok(h);
            }
        }

        Err(SubstrateError::Request(
            "no Incus hosts available for spawn".to_string(),
        ))
    }

    /// Look up the host that originally owned a VM. Falls back to the first
    /// host if the stored URL is unknown (handles pre-pool handles).
    pub fn host_for_handle(&self, handle: &allternit_driver_interface::ExecutionHandle) -> &IncusHost {
        if let Some(url) = handle.driver_info.get("host_url") {
            if let Some(h) = self.hosts.iter().find(|h| &h.url == url) {
                return h;
            }
            warn!(url, "execution handle references unknown Incus host; using fallback");
        }
        &self.hosts[0]
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

    #[test]
    fn round_robin_cycles_through_hosts() {
        let pool = IncusHostPool::new(vec![
            IncusHost::new("https://a:8443", fake_substrate()),
            IncusHost::new("https://b:8443", fake_substrate()),
            IncusHost::new("https://c:8443", fake_substrate()),
        ]);

        let a = pool.select_for_spawn().unwrap().url.clone();
        let b = pool.select_for_spawn().unwrap().url.clone();
        let c = pool.select_for_spawn().unwrap().url.clone();
        let a2 = pool.select_for_spawn().unwrap().url.clone();

        assert_ne!(a, b);
        assert_ne!(b, c);
        assert_eq!(a, a2);
    }

    #[test]
    fn zero_weight_hosts_are_skipped() {
        let pool = IncusHostPool::new(vec![
            IncusHost::new("https://a:8443", fake_substrate()).with_weight(0),
            IncusHost::new("https://b:8443", fake_substrate()),
        ]);

        for _ in 0..10 {
            assert_eq!(pool.select_for_spawn().unwrap().url, "https://b:8443");
        }
    }

    #[test]
    fn vnc_host_derived_from_url() {
        let h = IncusHost::new("https://mail.news.allternit.com:8443", fake_substrate());
        assert_eq!(h.vnc_host, "mail.news.allternit.com:8443");
    }
}
