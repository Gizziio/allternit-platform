//! Fabric resource DB helpers.
//!
//! `ResourceManager` reads and updates `fabric_resources` and
//! `fabric_placements` rows for the customer-facing resources API.

use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;

use crate::db::DbHandle;

/// A customer-facing Fabric resource.
#[derive(Debug, Clone)]
pub struct FabricResource {
    pub id: String,
    pub organization_id: String,
    pub kind: String,
    pub class: String,
    pub display_name: Option<String>,
    pub status: String,
    pub provider_kind: Option<String>,
    pub provider_resource_id: Option<String>,
    pub region: Option<String>,
    pub requested_at: DateTime<Utc>,
    pub provisioned_at: Option<DateTime<Utc>>,
    pub terminated_at: Option<DateTime<Utc>>,
}

/// Summary of a single placement for a Fabric resource.
#[derive(Debug, Clone)]
pub struct FabricPlacementSummary {
    pub id: String,
    pub provider_kind: String,
    pub provider_resource_id: Option<String>,
    pub offer_id: Option<String>,
    pub instance_type: Option<String>,
    pub region: Option<String>,
    pub retail_price_per_hour_cents: i64,
    pub provider_cost_per_hour_cents: i64,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

/// A Fabric usage event as seen by admins.
#[derive(Debug, Clone)]
pub struct FabricUsageEvent {
    pub id: String,
    pub resource_id: String,
    pub placement_id: Option<String>,
    pub event_type: String,
    pub quantity: f64,
    pub unit: String,
    pub measured_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
    pub cost_event_id: Option<String>,
}

/// Database access for Fabric resources and placements.
#[derive(Debug, Clone)]
pub struct ResourceManager {
    db: DbHandle,
}

impl ResourceManager {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    /// Load a resource by id.
    pub fn get(&self, id: &str) -> Result<Option<FabricResource>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, organization_id, kind, class, display_name, status,
                    provider_kind, provider_resource_id, region,
                    requested_at, provisioned_at, terminated_at
             FROM fabric_resources
             WHERE id = ?1",
        )?;
        stmt.query_row(rusqlite::params![id], Self::parse_resource)
            .optional()
    }

    /// True if the resource exists and belongs to the given organization.
    pub fn belongs_to_org(&self, id: &str, org_id: &str) -> Result<bool, rusqlite::Error> {
        let conn = self.db.connect()?;
        let found: Option<String> = conn
            .query_row(
                "SELECT organization_id FROM fabric_resources WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get(0),
            )
            .optional()?;
        Ok(found.as_deref() == Some(org_id))
    }

    /// Load the latest open or most-recently-ended placement for a resource.
    pub fn latest_placement(
        &self,
        resource_id: &str,
    ) -> Result<Option<FabricPlacementSummary>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, provider_kind, provider_resource_id, offer_id, instance_type, region,
                    retail_price_per_hour_cents, provider_cost_per_hour_cents,
                    started_at, ended_at
             FROM fabric_placements
             WHERE resource_id = ?1
             ORDER BY started_at DESC, id DESC
             LIMIT 1",
        )?;
        stmt.query_row(rusqlite::params![resource_id], Self::parse_placement)
            .optional()
    }

    /// List resources for an organization, newest first.
    pub fn list_resources(
        &self,
        organization_id: &str,
        status: Option<&str>,
        limit: usize,
    ) -> Result<Vec<FabricResource>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let sql = if status.is_some() {
            "SELECT id, organization_id, kind, class, display_name, status,
                    provider_kind, provider_resource_id, region,
                    requested_at, provisioned_at, terminated_at
             FROM fabric_resources
             WHERE organization_id = ?1 AND status = ?2
             ORDER BY requested_at DESC, id DESC
             LIMIT ?3"
        } else {
            "SELECT id, organization_id, kind, class, display_name, status,
                    provider_kind, provider_resource_id, region,
                    requested_at, provisioned_at, terminated_at
             FROM fabric_resources
             WHERE organization_id = ?1
             ORDER BY requested_at DESC, id DESC
             LIMIT ?2"
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = if let Some(status) = status {
            stmt.query_map(rusqlite::params![organization_id, status, limit as i64], Self::parse_resource)?
        } else {
            stmt.query_map(rusqlite::params![organization_id, limit as i64], Self::parse_resource)?
        };
        rows.collect()
    }

    /// List placements for an organization. Optionally filter by resource_id.
    pub fn list_placements(
        &self,
        organization_id: &str,
        resource_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<FabricPlacementSummary>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let (sql, params): (&str, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(resource_id) = resource_id {
            (
                "SELECT p.id, p.provider_kind, p.provider_resource_id, p.offer_id, p.instance_type, p.region,
                        p.retail_price_per_hour_cents, p.provider_cost_per_hour_cents,
                        p.started_at, p.ended_at
                 FROM fabric_placements p
                 JOIN fabric_resources r ON r.id = p.resource_id
                 WHERE r.organization_id = ?1 AND p.resource_id = ?2
                 ORDER BY p.started_at DESC, p.id DESC
                 LIMIT ?3",
                vec![Box::new(organization_id.to_string()), Box::new(resource_id.to_string()), Box::new(limit as i64)],
            )
        } else {
            (
                "SELECT p.id, p.provider_kind, p.provider_resource_id, p.offer_id, p.instance_type, p.region,
                        p.retail_price_per_hour_cents, p.provider_cost_per_hour_cents,
                        p.started_at, p.ended_at
                 FROM fabric_placements p
                 JOIN fabric_resources r ON r.id = p.resource_id
                 WHERE r.organization_id = ?1
                 ORDER BY p.started_at DESC, p.id DESC
                 LIMIT ?2",
                vec![Box::new(organization_id.to_string()), Box::new(limit as i64)],
            )
        };
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(param_refs), Self::parse_placement)?;
        rows.collect()
    }

    /// List usage events for an organization. Optionally filter by resource_id.
    pub fn list_usage_events(
        &self,
        organization_id: &str,
        resource_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<FabricUsageEvent>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let (sql, params): (&str, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(resource_id) = resource_id {
            (
                "SELECT u.id, u.resource_id, u.placement_id, u.event_type, u.quantity,
                        u.unit, u.measured_at, u.processed_at, u.cost_event_id
                 FROM fabric_usage_events u
                 JOIN fabric_resources r ON r.id = u.resource_id
                 WHERE r.organization_id = ?1 AND u.resource_id = ?2
                 ORDER BY u.measured_at DESC, u.id DESC
                 LIMIT ?3",
                vec![Box::new(organization_id.to_string()), Box::new(resource_id.to_string()), Box::new(limit as i64)],
            )
        } else {
            (
                "SELECT u.id, u.resource_id, u.placement_id, u.event_type, u.quantity,
                        u.unit, u.measured_at, u.processed_at, u.cost_event_id
                 FROM fabric_usage_events u
                 JOIN fabric_resources r ON r.id = u.resource_id
                 WHERE r.organization_id = ?1
                 ORDER BY u.measured_at DESC, u.id DESC
                 LIMIT ?2",
                vec![Box::new(organization_id.to_string()), Box::new(limit as i64)],
            )
        };
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(param_refs), Self::parse_usage_event)?;
        rows.collect()
    }

    /// Mark a resource terminated and close any open placement in one
    /// transaction.
    pub fn terminate(&self, resource_id: &str, reason: &str) -> Result<(), rusqlite::Error> {
        let mut conn = self.db.connect()?;
        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE fabric_resources
             SET status = 'terminated', terminated_at = CURRENT_TIMESTAMP
             WHERE id = ?1 AND status != 'terminated'",
            rusqlite::params![resource_id],
        )?;
        tx.execute(
            "UPDATE fabric_placements
             SET ended_at = CURRENT_TIMESTAMP, termination_reason = ?1
             WHERE resource_id = ?2 AND ended_at IS NULL",
            rusqlite::params![reason, resource_id],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn parse_resource(row: &rusqlite::Row) -> Result<FabricResource, rusqlite::Error> {
        Ok(FabricResource {
            id: row.get("id")?,
            organization_id: row.get("organization_id")?,
            kind: row.get("kind")?,
            class: row.get("class")?,
            display_name: row.get("display_name")?,
            status: row.get("status")?,
            provider_kind: row.get("provider_kind")?,
            provider_resource_id: row.get("provider_resource_id")?,
            region: row.get("region")?,
            requested_at: Self::parse_dt(row, "requested_at")?,
            provisioned_at: Self::parse_dt_optional(row, "provisioned_at")?,
            terminated_at: Self::parse_dt_optional(row, "terminated_at")?,
        })
    }

    fn parse_placement(row: &rusqlite::Row) -> Result<FabricPlacementSummary, rusqlite::Error> {
        Ok(FabricPlacementSummary {
            id: row.get("id")?,
            provider_kind: row.get("provider_kind")?,
            provider_resource_id: row.get("provider_resource_id")?,
            offer_id: row.get("offer_id")?,
            instance_type: row.get("instance_type")?,
            region: row.get("region")?,
            retail_price_per_hour_cents: row.get("retail_price_per_hour_cents")?,
            provider_cost_per_hour_cents: row.get("provider_cost_per_hour_cents")?,
            started_at: Self::parse_dt(row, "started_at")?,
            ended_at: Self::parse_dt_optional(row, "ended_at")?,
        })
    }

    fn parse_usage_event(row: &rusqlite::Row) -> Result<FabricUsageEvent, rusqlite::Error> {
        Ok(FabricUsageEvent {
            id: row.get("id")?,
            resource_id: row.get("resource_id")?,
            placement_id: row.get("placement_id")?,
            event_type: row.get("event_type")?,
            quantity: row.get("quantity")?,
            unit: row.get("unit")?,
            measured_at: Self::parse_dt(row, "measured_at")?,
            processed_at: Self::parse_dt_optional(row, "processed_at")?,
            cost_event_id: row.get("cost_event_id")?,
        })
    }

    fn parse_dt(row: &rusqlite::Row, name: &str) -> Result<DateTime<Utc>, rusqlite::Error> {
        let text: String = row.get(name)?;
        Self::parse_dt_str(&text)
    }

    fn parse_dt_optional(
        row: &rusqlite::Row,
        name: &str,
    ) -> Result<Option<DateTime<Utc>>, rusqlite::Error> {
        let text: Option<String> = row.get(name)?;
        match text {
            Some(t) => Self::parse_dt_str(&t).map(Some),
            None => Ok(None),
        }
    }

    fn parse_dt_str(text: &str) -> Result<DateTime<Utc>, rusqlite::Error> {
        // Prefer RFC 3339 (used when Rust code writes timestamps), but fall back
        // to SQLite's default `CURRENT_TIMESTAMP` format which omits timezone.
        if let Ok(dt) = DateTime::parse_from_rfc3339(text) {
            return Ok(dt.with_timezone(&Utc));
        }
        if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(text, "%Y-%m-%d %H:%M:%S") {
            return Ok(DateTime::from_naive_utc_and_offset(naive, Utc));
        }
        Err(rusqlite::Error::FromSqlConversionFailure(
            0,
            rusqlite::types::Type::Text,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("unrecognized datetime format: {text}"),
            )),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    fn seed_org(conn: &rusqlite::Connection, org_id: &str) {
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, ?2)",
            rusqlite::params![org_id, "Test Org"],
        )
        .unwrap();
    }

    fn seed_resource(
        conn: &rusqlite::Connection,
        id: &str,
        org_id: &str,
        status: &str,
    ) -> FabricResource {
        conn.execute(
            "INSERT INTO fabric_resources
             (id, organization_id, kind, class, status, requested_at)
             VALUES (?1, ?2, 'compute', 's', ?3, ?4)",
            rusqlite::params![id, org_id, status, Utc::now().to_rfc3339()],
        )
        .unwrap();
        FabricResource {
            id: id.to_string(),
            organization_id: org_id.to_string(),
            kind: "compute".to_string(),
            class: "s".to_string(),
            display_name: None,
            status: status.to_string(),
            provider_kind: None,
            provider_resource_id: None,
            region: None,
            requested_at: Utc::now(),
            provisioned_at: None,
            terminated_at: None,
        }
    }

    fn seed_placement(
        conn: &rusqlite::Connection,
        resource_id: &str,
        provider_resource_id: Option<&str>,
    ) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO fabric_placements
             (id, resource_id, provider_kind, provider_resource_id, offer_id, instance_type, region,
              retail_price_per_hour_cents, provider_cost_per_hour_cents, started_at)
             VALUES (?1, ?2, 'fake', ?3, 'off_fake_test', 'fake-cpu-small', 'us-east', 5, 3, ?4)",
            rusqlite::params![
                &id,
                resource_id,
                provider_resource_id,
                Utc::now().to_rfc3339()
            ],
        )
        .unwrap();
        id
    }

    #[test]
    fn get_returns_resource() {
        let db = DbHandle::new_memory().expect("memory db");
        let conn = db.connect().expect("connect");
        seed_org(&conn, "org-1");
        seed_resource(&conn, "res-1", "org-1", "active");
        drop(conn);

        let manager = ResourceManager::new(db);
        let resource = manager.get("res-1").unwrap().expect("resource exists");
        assert_eq!(resource.id, "res-1");
        assert_eq!(resource.organization_id, "org-1");
        assert_eq!(resource.status, "active");
    }

    #[test]
    fn belongs_to_org_checks_organization() {
        let db = DbHandle::new_memory().expect("memory db");
        let conn = db.connect().expect("connect");
        seed_org(&conn, "org-1");
        seed_org(&conn, "org-2");
        seed_resource(&conn, "res-1", "org-1", "active");
        drop(conn);

        let manager = ResourceManager::new(db);
        assert!(manager.belongs_to_org("res-1", "org-1").unwrap());
        assert!(!manager.belongs_to_org("res-1", "org-2").unwrap());
        assert!(!manager.belongs_to_org("missing", "org-1").unwrap());
    }

    #[test]
    fn latest_placement_returns_most_recent() {
        let db = DbHandle::new_memory().expect("memory db");
        let conn = db.connect().expect("connect");
        seed_org(&conn, "org-1");
        seed_resource(&conn, "res-1", "org-1", "active");
        let first = seed_placement(&conn, "res-1", Some("fake-1"));
        let second = seed_placement(&conn, "res-1", Some("fake-2"));
        drop(conn);

        let manager = ResourceManager::new(db);
        let placement = manager.latest_placement("res-1").unwrap().expect("placement exists");
        assert_eq!(placement.id, second);
        assert_eq!(placement.provider_resource_id.as_deref(), Some("fake-2"));
        assert_ne!(placement.id, first);
    }

    #[test]
    fn terminate_closes_open_placement() {
        let db = DbHandle::new_memory().expect("memory db");
        let conn = db.connect().expect("connect");
        seed_org(&conn, "org-1");
        seed_resource(&conn, "res-1", "org-1", "active");
        seed_placement(&conn, "res-1", Some("fake-1"));
        drop(conn);

        let manager = ResourceManager::new(db);
        manager.terminate("res-1", "user_request").unwrap();

        let resource = manager.get("res-1").unwrap().expect("resource exists");
        assert_eq!(resource.status, "terminated");
        assert!(resource.terminated_at.is_some());

        let placement = manager.latest_placement("res-1").unwrap().expect("placement exists");
        assert!(placement.ended_at.is_some());
    }
}
