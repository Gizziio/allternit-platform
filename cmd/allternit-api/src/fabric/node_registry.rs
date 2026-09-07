//! Persistence layer for Private Fabric nodes.
//!
//! Tracks enrolled nodes, their latest capacity, and assignments dispatched to
//! each node. The control plane uses this to populate the `FabricNodeProvider`
//! pool and to decide what work to send to each node.

use chrono::{DateTime, Utc};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::db::DbHandle;

/// Flat capacity derived from a canonical `NodeCapabilityRecord`.
///
/// The database still maintains simple total/free columns for legacy indexes
/// and provider scheduling; this derives them from the canonical hardware
/// block so both views stay consistent.
#[derive(Debug, Clone)]
struct FlatCapacity {
    pub total_vcpu: i64,
    pub total_memory_mib: i64,
    pub total_gpu_vram_mib: i64,
    pub gpu_model: Option<String>,
    pub free_vcpu: i64,
    pub free_memory_mib: i64,
    pub free_gpu_vram_mib: i64,
}

fn fallback_capability_from_flat(
    total_vcpu: i64,
    total_memory_mib: i64,
    total_gpu_vram_mib: i64,
    gpu_model: Option<String>,
) -> NodeCapacity {
    use allternitos_cloud_contracts as contracts;
    let vcpu = total_vcpu.max(1) as u32;
    NodeCapacity {
        schema_version: "1.0.0".to_string(),
        node_id: "node_unknown".to_string(),
        recorded_at: Utc::now(),
        hardware: contracts::NodeHardware {
            cpu: contracts::CpuInfo {
                vendor: "unknown".to_string(),
                model: "unknown".to_string(),
                cores: vcpu,
                threads: vcpu,
                sockets: None,
                base_frequency_mhz: None,
                flags: Vec::new(),
                numa_nodes: None,
            },
            memory: contracts::MemoryInfo {
                total_bytes: (total_memory_mib.max(1) as u64) * 1_048_576,
                memory_type: "unknown".to_string(),
                speed_mhz: None,
                channels: None,
                measured_bandwidth_gbps: None,
            },
            storage: Vec::new(),
            network: Vec::new(),
        },
        accelerators: if total_gpu_vram_mib > 0 {
            vec![contracts::AcceleratorInfo {
                id: "gpu0".to_string(),
                vendor: "unknown".to_string(),
                model: gpu_model.unwrap_or_else(|| "unknown".to_string()),
                accelerator_type: "gpu".to_string(),
                memory_bytes: (total_gpu_vram_mib as u64) * 1_048_576,
                memory_type: None,
                tensor_formats: Vec::new(),
                driver: None,
                driver_version: None,
                pcie: None,
                mig_capable: None,
                sr_iov_capable: None,
                vfio_capable: None,
                measured_tflops_fp16: None,
                measured_bandwidth_gbps: None,
            }]
        } else {
            Vec::new()
        },
        topology: contracts::NodeTopology::default(),
        software: contracts::NodeSoftware {
            fabric_os_version: "unknown".to_string(),
            kernel_version: "unknown".to_string(),
            libvirt_version: None,
            containerd_version: None,
            qemu_version: None,
            wireguard_version: None,
        },
        fabric: contracts::NodeFabric {
            wireguard_public_key: "pending_enrollment".to_string(),
            fabric_address: None,
            region: None,
            zone: None,
            rack: None,
            role: Some("cloud".to_string()),
            join_token_hash: None,
        },
        measured_bandwidth: contracts::MeasuredBandwidth::default(),
        health: contracts::NodeHealth {
            status: "active".to_string(),
            last_checked_at: None,
            alerts: Vec::new(),
        },
        workers: contracts::Workers::default(),
    }
}

fn flat_capacity_from_capability(cap: &NodeCapacity) -> FlatCapacity {
    let total_vcpu = cap.hardware.cpu.threads.max(cap.hardware.cpu.cores).max(1) as i64;
    let total_memory_mib = (cap.hardware.memory.total_bytes / 1_048_576).max(1) as i64;
    let total_gpu_vram_mib: i64 = cap
        .accelerators
        .iter()
        .map(|a| (a.memory_bytes / 1_048_576) as i64)
        .sum();
    let gpu_model = cap.accelerators.first().map(|a| a.model.clone());

    FlatCapacity {
        total_vcpu,
        total_memory_mib,
        total_gpu_vram_mib,
        gpu_model,
        free_vcpu: total_vcpu,
        free_memory_mib: total_memory_mib,
        free_gpu_vram_mib: total_gpu_vram_mib,
    }
}

/// Derive flat scheduling capacity from a canonical `NodeCapabilityRecord`.
///
/// The provider adapter needs simple total/free vcpu/memory/gpu numbers; this
/// extracts them from the canonical hardware block. Returns `None` when the
/// record lacks enough information to schedule.
pub fn scheduling_capacity_from_capability(
    cap: &NodeCapacity,
) -> Option<allternit_computer_cloud::providers::fabric_node::NodeCapacity> {
    use allternit_computer_cloud::providers::fabric_node::NodeCapacity as ProviderCapacity;

    let cpu = cap.hardware.cpu.threads.max(cap.hardware.cpu.cores).max(1);
    let total_memory_mib = (cap.hardware.memory.total_bytes / 1_048_576).max(1);
    let total_gpu_vram_mib: u64 = cap
        .accelerators
        .iter()
        .map(|a| a.memory_bytes / 1_048_576)
        .sum();
    let gpu_model = cap.accelerators.first().map(|a| a.model.clone());

    // For free capacity we currently assume the node is empty; real accounting
    // would subtract assigned workloads. This preserves the prior behavior.
    Some(ProviderCapacity {
        total_vcpu: cpu,
        total_memory_mib,
        total_gpu_vram_mib,
        gpu_model,
        free_vcpu: cpu,
        free_memory_mib: total_memory_mib,
        free_gpu_vram_mib: total_gpu_vram_mib,
    })
}

/// Convert a DB-backed Fabric node into the provider-layer representation used
/// by `allternit-computer-cloud`. Only `approved` and `active` nodes are
/// schedulable; this mapping is used when refreshing the provider pool.
pub fn to_provider_node(
    node: &FabricNodeRecord,
    capacity: &NodeCapacity,
) -> allternit_computer_cloud::providers::fabric_node::FabricNode {
    use allternit_computer_cloud::providers::fabric_node::{FabricNode as ProviderNode, NodeStatus};

    let status = match node.status {
        FabricNodeStatus::Pending => NodeStatus::Pending,
        FabricNodeStatus::Approved => NodeStatus::Approved,
        FabricNodeStatus::Rejected => NodeStatus::Rejected,
        FabricNodeStatus::Active => NodeStatus::Active,
        FabricNodeStatus::Inactive => NodeStatus::Inactive,
        FabricNodeStatus::Draining => NodeStatus::Draining,
    };

    let provider_capacity = scheduling_capacity_from_capability(capacity)
        .unwrap_or_default();

    ProviderNode {
        id: node.id.clone(),
        organization_id: node.organization_id.clone(),
        display_name: node.display_name.clone(),
        region: node.region.clone().unwrap_or_else(|| "any".to_string()),
        labels: node.labels.clone(),
        status,
        capacity: provider_capacity,
        last_heartbeat_at: node.last_heartbeat_at,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FabricNodeStatus {
    Pending,
    Approved,
    Rejected,
    Active,
    Inactive,
    Draining,
}

impl FabricNodeStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            FabricNodeStatus::Pending => "pending",
            FabricNodeStatus::Approved => "approved",
            FabricNodeStatus::Rejected => "rejected",
            FabricNodeStatus::Active => "active",
            FabricNodeStatus::Inactive => "inactive",
            FabricNodeStatus::Draining => "draining",
        }
    }
}

impl std::str::FromStr for FabricNodeStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(FabricNodeStatus::Pending),
            "approved" => Ok(FabricNodeStatus::Approved),
            "rejected" => Ok(FabricNodeStatus::Rejected),
            "active" => Ok(FabricNodeStatus::Active),
            "inactive" => Ok(FabricNodeStatus::Inactive),
            "draining" => Ok(FabricNodeStatus::Draining),
            other => Err(format!("unknown fabric node status: {other}")),
        }
    }
}

/// Canonical node capability record.
///
/// Uses the canonical AllternitOS `node-capability.schema.json` type so Cloud
/// does not maintain a parallel view struct. Cloud still wraps enrollment and
/// ownership in `FabricNodeRecord`, but the capability payload itself is
/// canonical.
pub use allternitos_cloud_contracts::NodeCapabilityRecord as NodeCapacity;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricNodeRecord {
    pub id: String,
    pub organization_id: String,
    pub display_name: Option<String>,
    pub status: FabricNodeStatus,
    pub region: Option<String>,
    pub identity_fingerprint: Option<String>,
    pub enrollment_token_hash: Option<String>,
    pub node_token_hash: Option<String>,
    pub labels: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub approved_at: Option<DateTime<Utc>>,
    pub last_heartbeat_at: Option<DateTime<Utc>>,
}

/// A workload assignment sent to a Private Fabric node.
///
/// Uses the canonical AllternitOS `assignment.schema.json` type so Cloud does
/// not maintain a parallel view struct.
pub use allternitos_cloud_contracts::Assignment as FabricNodeAssignment;

/// An enrollment token created by an org admin for Private Fabric onboarding.
#[derive(Debug, Clone)]
pub struct EnrollmentTokenRecord {
    pub id: String,
    pub organization_id: String,
    pub display_name: Option<String>,
    pub token_hash: String,
    pub status: String,
    pub node_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
}

/// Database access for `fabric_nodes`, `fabric_node_capacity`,
/// `fabric_node_assignments`, and `fabric_enrollment_tokens`.
#[derive(Debug, Clone)]
pub struct FabricNodeRegistry {
    db: DbHandle,
}

impl FabricNodeRegistry {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    pub fn db(&self) -> &DbHandle {
        &self.db
    }

    fn parse_node_row(row: &rusqlite::Row) -> Result<FabricNodeRecord, rusqlite::Error> {
        let status_str: String = row.get("status")?;
        let status = status_str.parse::<FabricNodeStatus>().map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
            )
        })?;
        let labels_json: String = row.get("labels")?;
        let labels = serde_json::from_str(&labels_json).unwrap_or_default();

        Ok(FabricNodeRecord {
            id: row.get("id")?,
            organization_id: row.get("organization_id")?,
            display_name: row.get("display_name")?,
            status,
            region: row.get("region")?,
            identity_fingerprint: row.get("identity_fingerprint")?,
            enrollment_token_hash: row.get("enrollment_token_hash")?,
            node_token_hash: row.get("node_token_hash")?,
            labels,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            approved_at: row.get("approved_at")?,
            last_heartbeat_at: row.get("last_heartbeat_at")?,
        })
    }

    pub fn insert(&self, node: &FabricNodeRecord) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO fabric_nodes (
                id, organization_id, display_name, status, region,
                identity_fingerprint, enrollment_token_hash, node_token_hash, labels,
                created_at, updated_at, approved_at, last_heartbeat_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
            )",
            params![
                node.id,
                node.organization_id,
                node.display_name,
                node.status.as_str(),
                node.region,
                node.identity_fingerprint,
                node.enrollment_token_hash,
                node.node_token_hash,
                serde_json::to_string(&node.labels).unwrap_or_else(|_| "{}".to_string()),
                node.created_at.to_rfc3339(),
                node.updated_at.to_rfc3339(),
                node.approved_at.map(|d| d.to_rfc3339()),
                node.last_heartbeat_at.map(|d| d.to_rfc3339()),
            ],
        )?;
        Ok(())
    }

    pub fn get(&self, id: &str) -> Result<Option<FabricNodeRecord>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, organization_id, display_name, status, region,
                    identity_fingerprint, enrollment_token_hash, node_token_hash, labels,
                    created_at, updated_at, approved_at, last_heartbeat_at
             FROM fabric_nodes
             WHERE id = ?1",
        )?;
        stmt.query_row(params![id], Self::parse_node_row).optional()
    }

    pub fn get_by_token_hash(
        &self,
        hash: &str,
    ) -> Result<Option<FabricNodeRecord>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, organization_id, display_name, status, region,
                    identity_fingerprint, enrollment_token_hash, node_token_hash, labels,
                    created_at, updated_at, approved_at, last_heartbeat_at
             FROM fabric_nodes
             WHERE enrollment_token_hash = ?1",
        )?;
        stmt.query_row(params![hash], Self::parse_node_row).optional()
    }

    pub fn get_by_node_token_hash(
        &self,
        hash: &str,
    ) -> Result<Option<FabricNodeRecord>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, organization_id, display_name, status, region,
                    identity_fingerprint, enrollment_token_hash, node_token_hash, labels,
                    created_at, updated_at, approved_at, last_heartbeat_at
             FROM fabric_nodes
             WHERE node_token_hash = ?1",
        )?;
        stmt.query_row(params![hash], Self::parse_node_row).optional()
    }

    /// Rotate the node's API token and return the new plain token.
    pub fn rotate_node_token(&self, id: &str) -> Result<String, rusqlite::Error> {
        let plain = uuid::Uuid::new_v4().to_string();
        let hashed = hash_token(&plain);
        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE fabric_nodes
             SET node_token_hash = ?1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?2",
            params![hashed, id],
        )?;
        Ok(plain)
    }

    pub fn list_by_organization(
        &self,
        org_id: &str,
    ) -> Result<Vec<FabricNodeRecord>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, organization_id, display_name, status, region,
                    identity_fingerprint, enrollment_token_hash, node_token_hash, labels,
                    created_at, updated_at, approved_at, last_heartbeat_at
             FROM fabric_nodes
             WHERE organization_id = ?1
             ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![org_id], Self::parse_node_row)?;
        rows.collect()
    }

    /// Create a new enrollment token for an organization. Returns the plain
    /// token and the record id. The plain token is shown exactly once.
    pub fn create_enrollment_token(
        &self,
        organization_id: &str,
        display_name: Option<&str>,
    ) -> Result<(EnrollmentTokenRecord, String), rusqlite::Error> {
        let plain = uuid::Uuid::new_v4().to_string();
        let hashed = hash_token(&plain);
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();
        let record = EnrollmentTokenRecord {
            id: id.clone(),
            organization_id: organization_id.to_string(),
            display_name: display_name.map(|s| s.to_string()),
            token_hash: hashed.clone(),
            status: "pending".to_string(),
            node_id: None,
            created_at: now,
            used_at: None,
        };

        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO fabric_enrollment_tokens (
                id, organization_id, display_name, token_hash, status,
                created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                &record.id,
                &record.organization_id,
                record.display_name,
                &record.token_hash,
                &record.status,
                record.created_at.to_rfc3339(),
            ],
        )?;

        Ok((record, plain))
    }

    /// Look up an enrollment token by its hash.
    pub fn get_enrollment_token_by_hash(
        &self,
        hash: &str,
    ) -> Result<Option<EnrollmentTokenRecord>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, organization_id, display_name, token_hash, status,
                    node_id, created_at, used_at
             FROM fabric_enrollment_tokens
             WHERE token_hash = ?1",
        )?;
        stmt.query_row(params![hash], |row| {
            Ok(EnrollmentTokenRecord {
                id: row.get("id")?,
                organization_id: row.get("organization_id")?,
                display_name: row.get("display_name")?,
                token_hash: row.get("token_hash")?,
                status: row.get("status")?,
                node_id: row.get("node_id")?,
                created_at: row.get("created_at")?,
                used_at: row.get("used_at")?,
            })
        })
        .optional()
    }

    /// Mark a pending enrollment token as used and link it to the enrolled node.
    pub fn mark_enrollment_token_used(
        &self,
        token_id: &str,
        node_id: &str,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE fabric_enrollment_tokens
             SET status = 'used', node_id = ?1, used_at = CURRENT_TIMESTAMP
             WHERE id = ?2",
            params![node_id, token_id],
        )?;
        Ok(())
    }

    /// List enrollment tokens for an organization, newest first.
    pub fn list_enrollment_tokens(
        &self,
        organization_id: &str,
    ) -> Result<Vec<EnrollmentTokenRecord>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, organization_id, display_name, token_hash, status,
                    node_id, created_at, used_at
             FROM fabric_enrollment_tokens
             WHERE organization_id = ?1
             ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![organization_id], |row| {
            Ok(EnrollmentTokenRecord {
                id: row.get("id")?,
                organization_id: row.get("organization_id")?,
                display_name: row.get("display_name")?,
                token_hash: row.get("token_hash")?,
                status: row.get("status")?,
                node_id: row.get("node_id")?,
                created_at: row.get("created_at")?,
                used_at: row.get("used_at")?,
            })
        })?;
        rows.collect()
    }

    pub fn update_status(
        &self,
        id: &str,
        status: FabricNodeStatus,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE fabric_nodes
             SET status = ?1, updated_at = CURRENT_TIMESTAMP,
                 approved_at = CASE WHEN ?1 = 'approved' OR ?1 = 'active' THEN CURRENT_TIMESTAMP ELSE approved_at END
             WHERE id = ?2",
            params![status.as_str(), id],
        )?;
        Ok(())
    }

    pub fn record_heartbeat(
        &self,
        id: &str,
        capacity: &NodeCapacity,
    ) -> Result<(), rusqlite::Error> {
        let flat = flat_capacity_from_capability(capacity);
        let capability_json = serde_json::to_string(capacity).unwrap_or_else(|_| "{}".to_string());

        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE fabric_nodes
             SET last_heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            params![id],
        )?;

        conn.execute(
            "INSERT INTO fabric_node_capacity (
                node_id, total_vcpu, total_memory_mib, total_gpu_vram_mib, gpu_model,
                free_vcpu, free_memory_mib, free_gpu_vram_mib, capability_json, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP)
            ON CONFLICT(node_id) DO UPDATE SET
                total_vcpu = excluded.total_vcpu,
                total_memory_mib = excluded.total_memory_mib,
                total_gpu_vram_mib = excluded.total_gpu_vram_mib,
                gpu_model = excluded.gpu_model,
                free_vcpu = excluded.free_vcpu,
                free_memory_mib = excluded.free_memory_mib,
                free_gpu_vram_mib = excluded.free_gpu_vram_mib,
                capability_json = excluded.capability_json,
                updated_at = CURRENT_TIMESTAMP",
            params![
                id,
                flat.total_vcpu,
                flat.total_memory_mib,
                flat.total_gpu_vram_mib,
                flat.gpu_model,
                flat.free_vcpu,
                flat.free_memory_mib,
                flat.free_gpu_vram_mib,
                capability_json,
            ],
        )?;
        Ok(())
    }

    pub fn get_capacity(&self, node_id: &str) -> Result<Option<NodeCapacity>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT capability_json, total_vcpu, total_memory_mib, total_gpu_vram_mib, gpu_model,
                    free_vcpu, free_memory_mib, free_gpu_vram_mib
             FROM fabric_node_capacity
             WHERE node_id = ?1",
        )?;
        stmt.query_row(params![node_id], |row| {
            let json: Option<String> = row.get("capability_json")?;
            if let Some(json) = json {
                if let Ok(cap) = serde_json::from_str::<NodeCapacity>(&json) {
                    return Ok(cap);
                }
            }
            // Fallback: reconstruct a partial canonical record from legacy flat
            // columns so callers always receive a `NodeCapabilityRecord`.
            Ok(fallback_capability_from_flat(
                row.get("total_vcpu")?,
                row.get("total_memory_mib")?,
                row.get("total_gpu_vram_mib")?,
                row.get::<_, Option<String>>("gpu_model")?,
            ))
        })
        .optional()
    }

    pub fn list_active_with_capacity(
        &self,
    ) -> Result<Vec<(FabricNodeRecord, NodeCapacity)>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT n.id, n.organization_id, n.display_name, n.status, n.region,
                    n.identity_fingerprint, n.enrollment_token_hash, n.node_token_hash, n.labels,
                    n.created_at, n.updated_at, n.approved_at, n.last_heartbeat_at,
                    c.capability_json, c.total_vcpu, c.total_memory_mib, c.total_gpu_vram_mib,
                    c.gpu_model, c.free_vcpu, c.free_memory_mib, c.free_gpu_vram_mib
             FROM fabric_nodes n
             JOIN fabric_node_capacity c ON c.node_id = n.id
             WHERE n.status IN ('approved', 'active')
             ORDER BY n.created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            let node = Self::parse_node_row(row)?;
            let json: Option<String> = row.get("capability_json")?;
            let total_vcpu: i64 = row.get("total_vcpu")?;
            let total_memory_mib: i64 = row.get("total_memory_mib")?;
            let total_gpu_vram_mib: i64 = row.get("total_gpu_vram_mib")?;
            let gpu_model: Option<String> = row.get("gpu_model")?;
            let capacity = if let Some(json) = json {
                serde_json::from_str::<NodeCapacity>(&json)
                    .unwrap_or_else(|_| fallback_capability_from_flat(total_vcpu, total_memory_mib, total_gpu_vram_mib, gpu_model))
            } else {
                fallback_capability_from_flat(total_vcpu, total_memory_mib, total_gpu_vram_mib, gpu_model)
            };
            Ok((node, capacity))
        })?;
        rows.collect()
    }

    /// Return all active nodes converted to the provider-layer representation.
    /// The control plane uses this to refresh the `FabricNodeProvider` pool.
    pub fn active_provider_nodes(
        &self,
    ) -> Result<Vec<allternit_computer_cloud::providers::fabric_node::FabricNode>, rusqlite::Error>
    {
        self.list_active_with_capacity()?
            .iter()
            .map(|(node, capacity)| Ok(to_provider_node(node, capacity)))
            .collect()
    }

    /// Create a pending assignment for a resource on a Private Fabric node.
    pub fn create_assignment(
        &self,
        node_id: &str,
        resource_id: &str,
        kind: &str,
        class: &str,
        requested_vcpu: i64,
        requested_memory_mib: i64,
        requested_gpu_vram_mib: i64,
        payload: Option<&str>,
    ) -> Result<String, rusqlite::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO fabric_node_assignments (
                id, node_id, resource_id, kind, class,
                requested_vcpu, requested_memory_mib, requested_gpu_vram_mib,
                status, payload
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending', ?9)",
            params![
                id,
                node_id,
                resource_id,
                kind,
                class,
                requested_vcpu,
                requested_memory_mib,
                requested_gpu_vram_mib,
                payload,
            ],
        )?;
        Ok(id)
    }

    /// List pending assignments for a node, ordered by creation time.
    pub fn list_pending_assignments_for_node(
        &self,
        node_id: &str,
    ) -> Result<Vec<FabricNodeAssignment>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, node_id, resource_id, kind, class,
                    requested_vcpu, requested_memory_mib, requested_gpu_vram_mib,
                    status, payload, created_at, updated_at
             FROM fabric_node_assignments
             WHERE node_id = ?1 AND status = 'pending'
             ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map(params![node_id], |row| {
            Ok(FabricNodeAssignment {
                id: row.get(0)?,
                node_id: row.get(1)?,
                resource_id: row.get(2)?,
                kind: row.get(3)?,
                class: row.get(4)?,
                requested_vcpu: row.get(5)?,
                requested_memory_mib: row.get(6)?,
                requested_gpu_vram_mib: row.get(7)?,
                status: row.get(8)?,
                payload: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: Some(row.get(11)?),
                labels: std::collections::HashMap::new(),
            })
        })?;
        rows.collect()
    }

    /// Update the status of an assignment (e.g. pending -> accepted -> running).
    pub fn update_assignment_status(
        &self,
        assignment_id: &str,
        status: &str,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE fabric_node_assignments
             SET status = ?1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?2",
            params![status, assignment_id],
        )?;
        Ok(())
    }

    /// Record a usage event emitted by a Fabric node daemon.
    pub fn record_usage_event(
        &self,
        resource_id: &str,
        event_type: &str,
        quantity: f64,
        unit: &str,
        measured_at: Option<chrono::DateTime<Utc>>,
        placement_id: Option<&str>,
    ) -> Result<String, rusqlite::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO fabric_usage_events (
                id, resource_id, placement_id, event_type, quantity, unit, measured_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                resource_id,
                placement_id,
                event_type,
                quantity,
                unit,
                measured_at.map(|d| d.to_rfc3339()),
            ],
        )?;
        Ok(id)
    }
}

pub fn hash_token(plain: &str) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(plain.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    fn test_db() -> DbHandle {
        DbHandle::new_memory().unwrap()
    }

    fn node(id: &str, org_id: &str) -> FabricNodeRecord {
        FabricNodeRecord {
            id: id.to_string(),
            organization_id: org_id.to_string(),
            display_name: Some(format!("node {id}")),
            status: FabricNodeStatus::Pending,
            region: Some("us-east".to_string()),
            identity_fingerprint: None,
            enrollment_token_hash: Some(hash_token(&format!("token-{id}"))),
            node_token_hash: None,
            labels: HashMap::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            approved_at: None,
            last_heartbeat_at: None,
        }
    }

    fn capacity() -> NodeCapacity {
        allternitos_cloud_contracts::NodeCapabilityRecord {
            schema_version: "1.0.0".to_string(),
            node_id: "n1".to_string(),
            recorded_at: Utc::now(),
            hardware: allternitos_cloud_contracts::NodeHardware {
                cpu: allternitos_cloud_contracts::CpuInfo {
                    vendor: "unknown".to_string(),
                    model: "unknown".to_string(),
                    cores: 8,
                    threads: 8,
                    sockets: None,
                    base_frequency_mhz: None,
                    flags: Vec::new(),
                    numa_nodes: None,
                },
                memory: allternitos_cloud_contracts::MemoryInfo {
                    total_bytes: 16_384 * 1_048_576,
                    memory_type: "unknown".to_string(),
                    speed_mhz: None,
                    channels: None,
                    measured_bandwidth_gbps: None,
                },
                storage: Vec::new(),
                network: Vec::new(),
            },
            accelerators: Vec::new(),
            topology: allternitos_cloud_contracts::NodeTopology::default(),
            software: allternitos_cloud_contracts::NodeSoftware {
                fabric_os_version: "unknown".to_string(),
                kernel_version: "unknown".to_string(),
                libvirt_version: None,
                containerd_version: None,
                qemu_version: None,
                wireguard_version: None,
            },
            fabric: allternitos_cloud_contracts::NodeFabric {
                wireguard_public_key: "pending_enrollment".to_string(),
                fabric_address: None,
                region: Some("us-east".to_string()),
                zone: None,
                rack: None,
                role: Some("cloud".to_string()),
                join_token_hash: None,
            },
            measured_bandwidth: allternitos_cloud_contracts::MeasuredBandwidth::default(),
            health: allternitos_cloud_contracts::NodeHealth {
                status: "active".to_string(),
                last_checked_at: None,
                alerts: Vec::new(),
            },
            workers: allternitos_cloud_contracts::Workers::default(),
        }
    }

    fn seed_org(db: &DbHandle, id: &str) {
        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT INTO organizations (id, name, status) VALUES (?1, ?2, 'active')",
            params![id, format!("org {id}")],
        )
        .unwrap();
    }

    fn seed_resource(db: &DbHandle, id: &str, org_id: &str) {
        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT INTO fabric_resources (id, organization_id, kind, class, status) VALUES (?1, ?2, 'compute', 's', 'pending')",
            params![id, org_id],
        )
        .unwrap();
    }

    #[test]
    fn node_crud_and_heartbeat() {
        let db = test_db();
        seed_org(&db, "org-1");
        let registry = FabricNodeRegistry::new(db);

        let n = node("n1", "org-1");
        registry.insert(&n).unwrap();

        let fetched = registry.get("n1").unwrap().unwrap();
        assert_eq!(fetched.id, "n1");
        assert!(matches!(fetched.status, FabricNodeStatus::Pending));

        registry.update_status("n1", FabricNodeStatus::Active).unwrap();
        registry.record_heartbeat("n1", &capacity()).unwrap();

        let active = registry.list_active_with_capacity().unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].0.id, "n1");
        assert_eq!(active[0].1.hardware.memory.total_bytes, 16_384 * 1_048_576);

        let by_hash = registry
            .get_by_token_hash(&hash_token("token-n1"))
            .unwrap()
            .unwrap();
        assert_eq!(by_hash.id, "n1");
    }

    #[test]
    fn active_provider_nodes_maps_db_records_to_provider_nodes() {
        let db = test_db();
        seed_org(&db, "org-1");
        let registry = FabricNodeRegistry::new(db);

        let n = node("n1", "org-1");
        registry.insert(&n).unwrap();
        registry.update_status("n1", FabricNodeStatus::Active).unwrap();
        registry.record_heartbeat("n1", &capacity()).unwrap();

        let provider_nodes = registry.active_provider_nodes().unwrap();
        assert_eq!(provider_nodes.len(), 1);

        let provider_node = &provider_nodes[0];
        assert_eq!(provider_node.id, "n1");
        assert_eq!(provider_node.organization_id, "org-1");
        assert_eq!(provider_node.capacity.total_vcpu, 8);
        assert_eq!(provider_node.capacity.total_memory_mib, 16384);
    }

    #[test]
    fn assignment_lifecycle() {
        let db = test_db();
        seed_org(&db, "org-1");
        seed_resource(&db, "resource-1", "org-1");
        let registry = FabricNodeRegistry::new(db);

        let n = node("n1", "org-1");
        registry.insert(&n).unwrap();

        let assignment_id = registry
            .create_assignment("n1", "resource-1", "compute", "s", 1, 2048, 0, None)
            .unwrap();

        let pending = registry.list_pending_assignments_for_node("n1").unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].id, assignment_id);
        assert_eq!(pending[0].resource_id, "resource-1");

        registry.update_assignment_status(&assignment_id, "accepted").unwrap();
        let pending_after = registry.list_pending_assignments_for_node("n1").unwrap();
        assert!(pending_after.is_empty());
    }
}
