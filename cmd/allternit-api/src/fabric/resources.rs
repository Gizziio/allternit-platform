//! Fabric resource DB helpers.
//!
//! `ResourceManager` reads and updates `fabric_resources` and
//! `fabric_placements` rows for the customer-facing resources API.

use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;
use std::collections::HashMap;

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
///
/// Uses the canonical AllternitOS `placement.schema.json` type so Cloud does
/// not maintain a parallel view struct.
pub use allternitos_cloud_contracts::Placement as FabricPlacementSummary;

/// A Fabric usage event as seen by admins.
///
/// Uses the canonical AllternitOS `usage-event.schema.json` type so Cloud does
/// not maintain a parallel view struct.
pub use allternitos_cloud_contracts::UsageEvent as FabricUsageEvent;

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
            "SELECT id, resource_id, provider_kind, provider_resource_id, offer_id, instance_type,
                    region, retail_price_per_hour_cents, provider_cost_per_hour_cents,
                    retail_price_per_request_cents, provider_cost_per_request_cents,
                    retail_price_per_token_cents, provider_cost_per_token_cents,
                    hold_id, node_id, ipv4, endpoint, status, termination_reason,
                    labels_json, started_at, ended_at, created_at, updated_at
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
        let columns = "p.id, p.resource_id, p.provider_kind, p.provider_resource_id, p.offer_id, p.instance_type,
                       p.region, p.retail_price_per_hour_cents, p.provider_cost_per_hour_cents,
                       p.retail_price_per_request_cents, p.provider_cost_per_request_cents,
                       p.retail_price_per_token_cents, p.provider_cost_per_token_cents,
                       p.hold_id, p.node_id, p.ipv4, p.endpoint, p.status, p.termination_reason,
                       p.labels_json, p.started_at, p.ended_at, p.created_at, p.updated_at";
        let (sql, params): (&str, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(resource_id) = resource_id {
            (
                &format!(
                    "SELECT {columns}
                     FROM fabric_placements p
                     JOIN fabric_resources r ON r.id = p.resource_id
                     WHERE r.organization_id = ?1 AND p.resource_id = ?2
                     ORDER BY p.started_at DESC, p.id DESC
                     LIMIT ?3"
                ),
                vec![Box::new(organization_id.to_string()), Box::new(resource_id.to_string()), Box::new(limit as i64)],
            )
        } else {
            (
                &format!(
                    "SELECT {columns}
                     FROM fabric_placements p
                     JOIN fabric_resources r ON r.id = p.resource_id
                     WHERE r.organization_id = ?1
                     ORDER BY p.started_at DESC, p.id DESC
                     LIMIT ?2"
                ),
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
                "SELECT u.id, u.resource_id, u.placement_id, u.node_id, u.event_type, u.quantity,
                        u.unit, u.measured_at, u.processed_at, u.cost_event_id,
                        u.metadata_json, u.labels_json, u.created_at
                 FROM fabric_usage_events u
                 JOIN fabric_resources r ON r.id = u.resource_id
                 WHERE r.organization_id = ?1 AND u.resource_id = ?2
                 ORDER BY u.measured_at DESC, u.id DESC
                 LIMIT ?3",
                vec![Box::new(organization_id.to_string()), Box::new(resource_id.to_string()), Box::new(limit as i64)],
            )
        } else {
            (
                "SELECT u.id, u.resource_id, u.placement_id, u.node_id, u.event_type, u.quantity,
                        u.unit, u.measured_at, u.processed_at, u.cost_event_id,
                        u.metadata_json, u.labels_json, u.created_at
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
             SET ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                 status = 'ended', termination_reason = ?1
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
        fn money_cents(cents: i64) -> Option<allternitos_cloud_contracts::Money> {
            if cents > 0 {
                Some(allternitos_cloud_contracts::Money {
                    currency: "USD".to_string(),
                    minor_units: cents as u64,
                })
            } else {
                None
            }
        }
        let labels_json: String = row.get("labels_json")?;
        let labels: HashMap<String, String> = serde_json::from_str(&labels_json).unwrap_or_default();
        Ok(FabricPlacementSummary {
            id: row.get("id")?,
            resource_id: row.get("resource_id")?,
            node_id: row.get("node_id")?,
            offer_id: row.get::<_, Option<String>>("offer_id")?.unwrap_or_default(),
            provider_kind: row.get("provider_kind")?,
            provider_resource_id: row.get("provider_resource_id")?,
            region: row.get::<_, Option<String>>("region")?.unwrap_or_default(),
            instance_type: row.get::<_, Option<String>>("instance_type")?.unwrap_or_default(),
            ipv4: row.get("ipv4")?,
            endpoint: row.get("endpoint")?,
            retail_price_per_hour: money_cents(row.get("retail_price_per_hour_cents")?),
            provider_cost_per_hour: money_cents(row.get("provider_cost_per_hour_cents")?),
            retail_price_per_request: money_cents(row.get("retail_price_per_request_cents")?),
            provider_cost_per_request: money_cents(row.get("provider_cost_per_request_cents")?),
            retail_price_per_token: money_cents(row.get("retail_price_per_token_cents")?),
            provider_cost_per_token: money_cents(row.get("provider_cost_per_token_cents")?),
            hold_id: row.get("hold_id")?,
            status: row.get("status")?,
            started_at: Self::parse_dt(row, "started_at")?,
            ended_at: Self::parse_dt_optional(row, "ended_at")?,
            termination_reason: row.get("termination_reason")?,
            created_at: Self::parse_dt_optional(row, "created_at")?,
            updated_at: Self::parse_dt_optional(row, "updated_at")?,
            labels,
        })
    }

    fn parse_usage_event(row: &rusqlite::Row) -> Result<FabricUsageEvent, rusqlite::Error> {
        let metadata_json: String = row.get("metadata_json")?;
        let metadata = serde_json::from_str(&metadata_json).unwrap_or_default();
        let labels_json: String = row.get("labels_json")?;
        let labels: HashMap<String, String> = serde_json::from_str(&labels_json).unwrap_or_default();
        Ok(FabricUsageEvent {
            id: row.get("id")?,
            resource_id: row.get("resource_id")?,
            placement_id: row.get("placement_id")?,
            node_id: row.get("node_id")?,
            event_type: row.get("event_type")?,
            quantity: row.get("quantity")?,
            unit: row.get("unit")?,
            measured_at: Self::parse_dt(row, "measured_at")?,
            processed_at: Self::parse_dt_optional(row, "processed_at")?,
            cost_event_id: row.get("cost_event_id")?,
            metadata,
            created_at: Some(Self::parse_dt(row, "created_at")?),
            labels,
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
              retail_price_per_hour_cents, provider_cost_per_hour_cents,
              retail_price_per_request_cents, provider_cost_per_request_cents,
              retail_price_per_token_cents, provider_cost_per_token_cents, started_at)
             VALUES (?1, ?2, 'fake', ?3, 'off_fake_test', 'fake-cpu-small', 'us-east', 5, 3, 0, 0, 0, 0, ?4)",
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
