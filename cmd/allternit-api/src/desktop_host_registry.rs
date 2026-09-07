//! Persistence layer for cloud-provisioned Desktop Cloud Incus hosts.

use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::db::DbHandle;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DesktopHostStatus {
    Provisioning,
    Active,
    Draining,
    Terminated,
}

impl DesktopHostStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            DesktopHostStatus::Provisioning => "provisioning",
            DesktopHostStatus::Active => "active",
            DesktopHostStatus::Draining => "draining",
            DesktopHostStatus::Terminated => "terminated",
        }
    }
}

impl std::str::FromStr for DesktopHostStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "provisioning" => Ok(DesktopHostStatus::Provisioning),
            "active" => Ok(DesktopHostStatus::Active),
            "draining" => Ok(DesktopHostStatus::Draining),
            "terminated" => Ok(DesktopHostStatus::Terminated),
            other => Err(format!("unknown desktop host status: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopHostRecord {
    pub id: String,
    pub provider: String,
    pub cloud_instance_id: Option<String>,
    pub region: Option<String>,
    pub instance_type: Option<String>,
    pub tailscale_ip: Option<String>,
    pub incus_url: String,
    pub incus_ca_cert: Option<String>,
    pub status: DesktopHostStatus,
    pub total_memory_mb: i64,
    pub used_memory_mb: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub decommission_after: Option<DateTime<Utc>>,
}

/// Database access for `desktop_hosts` and `desktop_host_placements`.
#[derive(Debug, Clone)]
pub struct DesktopHostRegistry {
    db: DbHandle,
}

impl DesktopHostRegistry {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    pub fn db(&self) -> &DbHandle {
        &self.db
    }

    fn parse_row(row: &rusqlite::Row) -> Result<DesktopHostRecord, rusqlite::Error> {
        let status_str: String = row.get("status")?;
        let status = status_str
            .parse::<DesktopHostStatus>()
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
            ))?;
        Ok(DesktopHostRecord {
            id: row.get("id")?,
            provider: row.get("provider")?,
            cloud_instance_id: row.get("cloud_instance_id")?,
            region: row.get("region")?,
            instance_type: row.get("instance_type")?,
            tailscale_ip: row.get("tailscale_ip")?,
            incus_url: row.get("incus_url")?,
            incus_ca_cert: row.get("incus_ca_cert")?,
            status,
            total_memory_mb: row.get("total_memory_mb")?,
            used_memory_mb: row.get("used_memory_mb")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            last_seen_at: row.get("last_seen_at")?,
            decommission_after: row.get("decommission_after")?,
        })
    }

    pub fn insert(&self, host: &DesktopHostRecord) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO desktop_hosts (
                id, provider, cloud_instance_id, region, instance_type,
                tailscale_ip, incus_url, incus_ca_cert, status,
                total_memory_mb, used_memory_mb, created_at, updated_at,
                last_seen_at, decommission_after
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                ?10, ?11, ?12, ?13, ?14, ?15
            )",
            rusqlite::params![
                host.id,
                host.provider,
                host.cloud_instance_id,
                host.region,
                host.instance_type,
                host.tailscale_ip,
                host.incus_url,
                host.incus_ca_cert,
                host.status.as_str(),
                host.total_memory_mb,
                host.used_memory_mb,
                host.created_at.to_rfc3339(),
                host.updated_at.to_rfc3339(),
                host.last_seen_at.map(|d| d.to_rfc3339()),
                host.decommission_after.map(|d| d.to_rfc3339()),
            ],
        )?;
        Ok(())
    }

    pub fn update_status(
        &self,
        id: &str,
        status: DesktopHostStatus,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE desktop_hosts
             SET status = ?1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?2",
            rusqlite::params![status.as_str(), id],
        )?;
        Ok(())
    }

    pub fn update_capacity(
        &self,
        id: &str,
        total_mb: i64,
        used_mb: i64,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE desktop_hosts
             SET total_memory_mb = ?1, used_memory_mb = ?2,
                 last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?3",
            rusqlite::params![total_mb, used_mb, id],
        )?;
        Ok(())
    }

    pub fn update_last_seen(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE desktop_hosts
             SET last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn get(&self, id: &str) -> Result<Option<DesktopHostRecord>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, provider, cloud_instance_id, region, instance_type,
                    tailscale_ip, incus_url, incus_ca_cert, status,
                    total_memory_mb, used_memory_mb, created_at, updated_at,
                    last_seen_at, decommission_after
             FROM desktop_hosts
             WHERE id = ?1",
        )?;
        stmt.query_row(rusqlite::params![id], Self::parse_row)
            .optional()
    }

    pub fn list_by_status(
        &self,
        status: DesktopHostStatus,
    ) -> Result<Vec<DesktopHostRecord>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, provider, cloud_instance_id, region, instance_type,
                    tailscale_ip, incus_url, incus_ca_cert, status,
                    total_memory_mb, used_memory_mb, created_at, updated_at,
                    last_seen_at, decommission_after
             FROM desktop_hosts
             WHERE status = ?1
             ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(rusqlite::params![status.as_str()], Self::parse_row)?;
        rows.collect()
    }

    pub fn list_active(&self) -> Result<Vec<DesktopHostRecord>, rusqlite::Error> {
        self.list_by_status(DesktopHostStatus::Active)
    }

    pub fn list_all(&self) -> Result<Vec<DesktopHostRecord>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, provider, cloud_instance_id, region, instance_type,
                    tailscale_ip, incus_url, incus_ca_cert, status,
                    total_memory_mb, used_memory_mb, created_at, updated_at,
                    last_seen_at, decommission_after
             FROM desktop_hosts
             ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], Self::parse_row)?;
        rows.collect()
    }

    pub fn delete(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute("DELETE FROM desktop_hosts WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn record_placement(
        &self,
        sandbox_id: &str,
        host_id: &str,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO desktop_host_placements (sandbox_id, host_id)
             VALUES (?1, ?2)
             ON CONFLICT(sandbox_id) DO UPDATE SET
                 host_id = excluded.host_id,
                 created_at = CURRENT_TIMESTAMP",
            rusqlite::params![sandbox_id, host_id],
        )?;
        Ok(())
    }

    pub fn host_for_sandbox(
        &self,
        sandbox_id: &str,
    ) -> Result<Option<DesktopHostRecord>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT h.id, h.provider, h.cloud_instance_id, h.region, h.instance_type,
                    h.tailscale_ip, h.incus_url, h.incus_ca_cert, h.status,
                    h.total_memory_mb, h.used_memory_mb, h.created_at, h.updated_at,
                    h.last_seen_at, h.decommission_after
             FROM desktop_hosts h
             JOIN desktop_host_placements p ON p.host_id = h.id
             WHERE p.sandbox_id = ?1",
        )?;
        stmt.query_row(rusqlite::params![sandbox_id], Self::parse_row)
            .optional()
    }

    pub fn remove_placement(&self, sandbox_id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute(
            "DELETE FROM desktop_host_placements WHERE sandbox_id = ?1",
            rusqlite::params![sandbox_id],
        )?;
        Ok(())
    }

    /// Mark empty active hosts older than `idle_age` as draining.
    pub fn find_idle_hosts(
        &self,
        idle_age: chrono::Duration,
    ) -> Result<Vec<DesktopHostRecord>, rusqlite::Error> {
        let cutoff = (Utc::now() - idle_age).to_rfc3339();
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, provider, cloud_instance_id, region, instance_type,
                    tailscale_ip, incus_url, incus_ca_cert, status,
                    total_memory_mb, used_memory_mb, created_at, updated_at,
                    last_seen_at, decommission_after
             FROM desktop_hosts
             WHERE status = 'active'
               AND used_memory_mb = 0
               AND last_seen_at IS NOT NULL
               AND last_seen_at < ?1
             ORDER BY last_seen_at ASC",
        )?;
        let rows = stmt.query_map(rusqlite::params![cutoff], Self::parse_row)?;
        rows.collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> DbHandle {
        DbHandle::new_memory().expect("memory db")
    }

    fn sample_host(id: &str) -> DesktopHostRecord {
        DesktopHostRecord {
            id: id.to_string(),
            provider: "hetzner".to_string(),
            cloud_instance_id: Some("12345".to_string()),
            region: Some("ash".to_string()),
            instance_type: Some("cpx21".to_string()),
            tailscale_ip: Some("100.64.0.5".to_string()),
            incus_url: "https://100.64.0.5:8443".to_string(),
            incus_ca_cert: None,
            status: DesktopHostStatus::Active,
            total_memory_mb: 16384,
            used_memory_mb: 2048,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_seen_at: Some(Utc::now()),
            decommission_after: None,
        }
    }

    #[test]
    fn insert_and_get_round_trip() {
        let db = test_db();
        let registry = DesktopHostRegistry::new(db);
        let host = sample_host("host-1");
        registry.insert(&host).unwrap();
        let fetched = registry.get("host-1").unwrap().expect("host exists");
        assert_eq!(fetched.id, "host-1");
        assert_eq!(fetched.status, DesktopHostStatus::Active);
    }

    #[test]
    fn update_status_changes_row() {
        let db = test_db();
        let registry = DesktopHostRegistry::new(db);
        let host = sample_host("host-1");
        registry.insert(&host).unwrap();
        registry.update_status("host-1", DesktopHostStatus::Draining).unwrap();
        let fetched = registry.get("host-1").unwrap().expect("host exists");
        assert_eq!(fetched.status, DesktopHostStatus::Draining);
    }

    #[test]
    fn placement_round_trip() {
        let db = test_db();
        let registry = DesktopHostRegistry::new(db);
        let host = sample_host("host-1");
        registry.insert(&host).unwrap();
        registry.record_placement("sandbox-1", "host-1").unwrap();
        let placed = registry.host_for_sandbox("sandbox-1").unwrap().expect("placement");
        assert_eq!(placed.id, "host-1");
    }

    #[test]
    fn list_active_filters_by_status() {
        let db = test_db();
        let registry = DesktopHostRegistry::new(db);
        let mut active = sample_host("host-active");
        let mut draining = sample_host("host-draining");
        draining.status = DesktopHostStatus::Draining;
        registry.insert(&active).unwrap();
        registry.insert(&draining).unwrap();
        let active_hosts = registry.list_active().unwrap();
        assert_eq!(active_hosts.len(), 1);
        assert_eq!(active_hosts[0].id, "host-active");
    }

    #[test]
    fn update_capacity_changes_memory() {
        let db = test_db();
        let registry = DesktopHostRegistry::new(db);
        let host = sample_host("host-1");
        registry.insert(&host).unwrap();
        registry.update_capacity("host-1", 32768, 8192).unwrap();
        let fetched = registry.get("host-1").unwrap().expect("host exists");
        assert_eq!(fetched.total_memory_mb, 32768);
        assert_eq!(fetched.used_memory_mb, 8192);
        assert!(fetched.last_seen_at.is_some());
    }

    #[test]
    fn delete_removes_host() {
        let db = test_db();
        let registry = DesktopHostRegistry::new(db);
        let host = sample_host("host-1");
        registry.insert(&host).unwrap();
        registry.delete("host-1").unwrap();
        assert!(registry.get("host-1").unwrap().is_none());
    }

    #[test]
    fn find_idle_hosts_skips_recently_seen() {
        let db = test_db();
        let registry = DesktopHostRegistry::new(db);
        let mut idle = sample_host("host-idle");
        idle.used_memory_mb = 0;
        idle.last_seen_at = Some(Utc::now() - chrono::Duration::hours(2));
        registry.insert(&idle).unwrap();

        let mut busy = sample_host("host-busy");
        busy.used_memory_mb = 4096;
        busy.last_seen_at = Some(Utc::now() - chrono::Duration::hours(2));
        registry.insert(&busy).unwrap();

        let idle_hosts = registry.find_idle_hosts(chrono::Duration::minutes(30)).unwrap();
        assert_eq!(idle_hosts.len(), 1);
        assert_eq!(idle_hosts[0].id, "host-idle");
    }
}
