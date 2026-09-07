//! Fabric SKU / capability class definitions.
//!
//! Customer-facing SKUs are capability classes, not supplier-specific
//! hardware. The scheduler maps each class to provider offers.

use crate::db::DbHandle;
use allternit_computer_cloud::fabric::{ReliabilityTier, ResourceKind};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::{Arc, RwLock};

/// A canonical capability class (SKU).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceClass {
    pub id: String,
    pub kind: ResourceKind,
    pub class: String,
    pub display_name: String,
    pub vcpu: u32,
    pub memory_mib: u64,
    pub gpu_vram_mib: u64,
    pub reliability_tier: ReliabilityTier,
    /// Retail price in USD cents per hour before storage/network/add-ons.
    pub retail_price_per_hour_cents: i64,
    /// Retail price in USD cents per discrete request/action.
    pub retail_price_per_request_cents: i64,
    /// Retail price in USD cents per token for inference metering.
    pub retail_price_per_token_cents: i64,
}

impl ResourceClass {
    pub fn full_class(&self) -> String {
        format!("{}.{}", self.kind, self.class)
    }

    /// True if this class can satisfy the minimum requirements.
    pub fn satisfies(&self, vcpu_min: u32, memory_mib_min: u64, gpu_vram_mib_min: u64) -> bool {
        self.vcpu >= vcpu_min && self.memory_mib >= memory_mib_min && self.gpu_vram_mib >= gpu_vram_mib_min
    }
}

/// Built-in capability classes for Phase 0.
pub fn builtin_classes() -> Vec<ResourceClass> {
    vec![
        // Compute
        ResourceClass {
            id: "compute.s".to_string(),
            kind: ResourceKind::Compute,
            class: "s".to_string(),
            display_name: "Compute S".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 5,
            retail_price_per_request_cents: 0,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "compute.m".to_string(),
            kind: ResourceKind::Compute,
            class: "m".to_string(),
            display_name: "Compute M".to_string(),
            vcpu: 2,
            memory_mib: 4096,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 10,
            retail_price_per_request_cents: 0,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "compute.l".to_string(),
            kind: ResourceKind::Compute,
            class: "l".to_string(),
            display_name: "Compute L".to_string(),
            vcpu: 4,
            memory_mib: 8192,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 20,
            retail_price_per_request_cents: 0,
            retail_price_per_token_cents: 0,
        },
        // GPU
        ResourceClass {
            id: "gpu.s".to_string(),
            kind: ResourceKind::Gpu,
            class: "s".to_string(),
            display_name: "GPU S".to_string(),
            vcpu: 4,
            memory_mib: 16384,
            gpu_vram_mib: 24576,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 79,
            retail_price_per_request_cents: 0,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "gpu.m".to_string(),
            kind: ResourceKind::Gpu,
            class: "m".to_string(),
            display_name: "GPU M".to_string(),
            vcpu: 8,
            memory_mib: 32768,
            gpu_vram_mib: 49152,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 129,
            retail_price_per_request_cents: 0,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "gpu.l".to_string(),
            kind: ResourceKind::Gpu,
            class: "l".to_string(),
            display_name: "GPU L".to_string(),
            vcpu: 16,
            memory_mib: 65536,
            gpu_vram_mib: 81920,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 249,
            retail_price_per_request_cents: 0,
            retail_price_per_token_cents: 0,
        },
        // Sandbox
        ResourceClass {
            id: "sandbox.s".to_string(),
            kind: ResourceKind::Sandbox,
            class: "s".to_string(),
            display_name: "Sandbox S".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 3,
            retail_price_per_request_cents: 0,
            retail_price_per_token_cents: 0,
        },
        // Managed harness runtime
        ResourceClass {
            id: "harness.gizzi".to_string(),
            kind: ResourceKind::Harness,
            class: "gizzi".to_string(),
            display_name: "Gizzi Harness Runtime".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 8,
            retail_price_per_request_cents: 5,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "harness.opencode".to_string(),
            kind: ResourceKind::Harness,
            class: "opencode".to_string(),
            display_name: "OpenCode Harness Runtime".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 8,
            retail_price_per_request_cents: 5,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "harness.aider".to_string(),
            kind: ResourceKind::Harness,
            class: "aider".to_string(),
            display_name: "Aider Harness Runtime".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 8,
            retail_price_per_request_cents: 5,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "harness.claude".to_string(),
            kind: ResourceKind::Harness,
            class: "claude".to_string(),
            display_name: "Claude Code Harness Runtime".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 8,
            retail_price_per_request_cents: 5,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "harness.codex".to_string(),
            kind: ResourceKind::Harness,
            class: "codex".to_string(),
            display_name: "Codex CLI Harness Runtime".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 8,
            retail_price_per_request_cents: 5,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "harness.kimi".to_string(),
            kind: ResourceKind::Harness,
            class: "kimi".to_string(),
            display_name: "Kimi CLI Harness Runtime".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 8,
            retail_price_per_request_cents: 5,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "harness.antigravity".to_string(),
            kind: ResourceKind::Harness,
            class: "antigravity".to_string(),
            display_name: "Antigravity Harness Runtime".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 8,
            retail_price_per_request_cents: 5,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "harness.hermes".to_string(),
            kind: ResourceKind::Harness,
            class: "hermes".to_string(),
            display_name: "Hermes Harness Runtime".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 8,
            retail_price_per_request_cents: 5,
            retail_price_per_token_cents: 0,
        },
        ResourceClass {
            id: "harness.oh_my_pi".to_string(),
            kind: ResourceKind::Harness,
            class: "oh_my_pi".to_string(),
            display_name: "Oh My Pi Harness Runtime".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Standard,
            retail_price_per_hour_cents: 8,
            retail_price_per_request_cents: 5,
            retail_price_per_token_cents: 0,
        },

    ]
}

/// In-memory catalog of resource classes. In production this is loaded from
/// `fabric_resource_classes` and refreshed on change.
#[derive(Debug, Clone, Default)]
pub struct ResourceClassCatalog {
    classes: Arc<RwLock<Vec<ResourceClass>>>,
}

impl ResourceClassCatalog {
    pub fn builtin() -> Self {
        Self {
            classes: Arc::new(RwLock::new(builtin_classes())),
        }
    }

    /// Load classes from the `fabric_resource_classes` table.
    ///
    /// If the table is empty, falls back to the built-in catalog so fresh
    /// installs always have a usable SKU set.
    pub fn from_db(db: &DbHandle) -> Result<Self, rusqlite::Error> {
        let classes = Self::load_classes(db)?;
        if classes.is_empty() {
            return Ok(Self::builtin());
        }
        Ok(Self {
            classes: Arc::new(RwLock::new(classes)),
        })
    }

    fn load_classes(db: &DbHandle) -> Result<Vec<ResourceClass>, rusqlite::Error> {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, kind, class, display_name, vcpu_min, memory_mib_min,
                    gpu_vram_mib_min, reliability_tier, retail_price_per_hour_cents,
                    retail_price_per_request_cents, retail_price_per_token_cents
             FROM fabric_resource_classes
             ORDER BY kind, class",
        )?;
        let rows = stmt.query_map([], |row| {
            let kind_str: String = row.get("kind")?;
            let kind = ResourceKind::from_str(&kind_str).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
                )
            })?;
            let tier_str: String = row.get("reliability_tier")?;
            let reliability_tier = ReliabilityTier::from_str(&tier_str).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
                )
            })?;
            Ok(ResourceClass {
                id: row.get("id")?,
                kind,
                class: row.get("class")?,
                display_name: row.get("display_name")?,
                vcpu: row.get::<_, i64>("vcpu_min")? as u32,
                memory_mib: row.get::<_, i64>("memory_mib_min")? as u64,
                gpu_vram_mib: row.get::<_, i64>("gpu_vram_mib_min")? as u64,
                reliability_tier,
                retail_price_per_hour_cents: row.get("retail_price_per_hour_cents")?,
                retail_price_per_request_cents: row.get("retail_price_per_request_cents")?,
                retail_price_per_token_cents: row.get("retail_price_per_token_cents")?,
            })
        })?;
        rows.collect()
    }

    /// Seed the `fabric_resource_classes` table with the built-in classes if it
    /// is currently empty. Returns the number of rows inserted.
    pub fn seed_builtin(db: &DbHandle) -> Result<usize, rusqlite::Error> {
        let conn = db.connect()?;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM fabric_resource_classes",
                [],
                |row| row.get(0),
            )
            .optional()?
            .unwrap_or(0);
        if count > 0 {
            return Ok(0);
        }

        let mut inserted = 0;
        for class in builtin_classes() {
            let rows = conn.execute(
                "INSERT INTO fabric_resource_classes
                 (id, kind, class, display_name, vcpu_min, memory_mib_min,
                  gpu_vram_mib_min, reliability_tier, retail_price_per_hour_cents,
                  retail_price_per_request_cents, retail_price_per_token_cents)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                 ON CONFLICT(id) DO NOTHING",
                rusqlite::params![
                    class.id,
                    class.kind.to_string(),
                    class.class,
                    class.display_name,
                    class.vcpu as i64,
                    class.memory_mib as i64,
                    class.gpu_vram_mib as i64,
                    class.reliability_tier.to_string(),
                    class.retail_price_per_hour_cents,
                    class.retail_price_per_request_cents,
                    class.retail_price_per_token_cents,
                ],
            )?;
            inserted += rows;
        }
        Ok(inserted)
    }

    pub fn get(&self, full_class: &str) -> Option<ResourceClass> {
        let classes = self.classes.read().ok()?;
        classes.iter().find(|c| c.full_class() == full_class).cloned()
    }

    pub fn classes(&self) -> Vec<ResourceClass> {
        self.classes
            .read()
            .map(|guard| guard.clone())
            .unwrap_or_default()
    }

    pub fn classes_for_kind(&self, kind: ResourceKind) -> Vec<ResourceClass> {
        self.classes
            .read()
            .map(|guard| guard.iter().filter(|c| c.kind == kind).cloned().collect())
            .unwrap_or_default()
    }

    /// Insert or update a resource class in the database and refresh the
    /// in-memory entry. Returns the persisted class.
    pub fn upsert_class(
        &self,
        db: &DbHandle,
        class: ResourceClass,
    ) -> Result<ResourceClass, rusqlite::Error> {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO fabric_resource_classes
             (id, kind, class, display_name, vcpu_min, memory_mib_min,
              gpu_vram_mib_min, reliability_tier, retail_price_per_hour_cents,
              retail_price_per_request_cents, retail_price_per_token_cents)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(id) DO UPDATE SET
                 kind = excluded.kind,
                 class = excluded.class,
                 display_name = excluded.display_name,
                 vcpu_min = excluded.vcpu_min,
                 memory_mib_min = excluded.memory_mib_min,
                 gpu_vram_mib_min = excluded.gpu_vram_mib_min,
                 reliability_tier = excluded.reliability_tier,
                 retail_price_per_hour_cents = excluded.retail_price_per_hour_cents,
                 retail_price_per_request_cents = excluded.retail_price_per_request_cents,
                 retail_price_per_token_cents = excluded.retail_price_per_token_cents",
            rusqlite::params![
                class.id,
                class.kind.to_string(),
                class.class,
                class.display_name,
                class.vcpu as i64,
                class.memory_mib as i64,
                class.gpu_vram_mib as i64,
                class.reliability_tier.to_string(),
                class.retail_price_per_hour_cents,
                class.retail_price_per_request_cents,
                class.retail_price_per_token_cents,
            ],
        )?;

        let mut classes = self.classes.write().map_err(|_| {
            rusqlite::Error::ExecuteReturnedResults
        })?;
        if let Some(existing) = classes.iter_mut().find(|c| c.id == class.id) {
            *existing = class.clone();
        } else {
            classes.push(class.clone());
        }
        Ok(class)
    }

    /// Delete a resource class by id from the database and in-memory catalog.
    /// Returns `true` if the id existed in either place.
    pub fn delete_class(&self, db: &DbHandle, id: &str) -> Result<bool, rusqlite::Error> {
        let conn = db.connect()?;
        let deleted = conn.execute(
            "DELETE FROM fabric_resource_classes WHERE id = ?1",
            rusqlite::params![id],
        )?;

        let mut classes = self.classes.write().map_err(|_| {
            rusqlite::Error::ExecuteReturnedResults
        })?;
        let existed_in_memory = classes.iter().any(|c| c.id == id);
        classes.retain(|c| c.id != id);

        Ok(deleted > 0 || existed_in_memory)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_catalog_contains_expected_classes() {
        let catalog = ResourceClassCatalog::builtin();
        assert!(catalog.get("compute.s").is_some());
        assert!(catalog.get("gpu.m").is_some());
        assert!(catalog.get("sandbox.s").is_some());
        assert!(catalog.get("unknown.x").is_none());
    }

    #[test]
    fn class_satisfies_requirements() {
        let catalog = ResourceClassCatalog::builtin();
        let m = catalog.get("compute.m").unwrap();
        assert!(m.satisfies(1, 2048, 0));
        assert!(!m.satisfies(4, 8192, 0));
    }

    #[test]
    fn from_db_falls_back_to_builtin_when_empty() {
        let db = DbHandle::new_memory().expect("test db");
        let catalog = ResourceClassCatalog::from_db(&db).expect("load from empty db");
        assert!(catalog.get("compute.s").is_some());
        assert!(catalog.get("gpu.m").is_some());
    }

    #[test]
    fn seed_builtin_inserts_classes_and_from_db_loads_them() {
        let db = DbHandle::new_memory().expect("test db");
        let inserted = ResourceClassCatalog::seed_builtin(&db).expect("seed");
        assert_eq!(inserted, builtin_classes().len());

        let catalog = ResourceClassCatalog::from_db(&db).expect("load after seed");
        assert_eq!(catalog.classes().len(), builtin_classes().len());

        let gpu_m = catalog.get("gpu.m").expect("gpu.m should exist");
        assert_eq!(gpu_m.vcpu, 8);
        assert_eq!(gpu_m.memory_mib, 32768);
        assert_eq!(gpu_m.gpu_vram_mib, 49152);
        assert_eq!(gpu_m.retail_price_per_hour_cents, 129);

        // Idempotent: seeding again inserts nothing.
        let inserted_again = ResourceClassCatalog::seed_builtin(&db).expect("re-seed");
        assert_eq!(inserted_again, 0);
    }

    #[test]
    fn from_db_prefers_db_row_over_builtin() {
        let db = DbHandle::new_memory().expect("test db");
        let conn = db.connect().expect("connect");
        conn.execute(
            "INSERT INTO fabric_resource_classes
             (id, kind, class, display_name, vcpu_min, memory_mib_min,
              gpu_vram_mib_min, reliability_tier, retail_price_per_hour_cents,
              retail_price_per_request_cents, retail_price_per_token_cents)
             VALUES ('compute.s', 'compute', 's', 'Custom Compute S', 2, 4096, 0, 'standard', 99, 0, 0)",
            [],
        )
        .expect("insert custom class");

        let catalog = ResourceClassCatalog::from_db(&db).expect("load");
        let compute_s = catalog.get("compute.s").expect("compute.s should exist");
        assert_eq!(compute_s.vcpu, 2);
        assert_eq!(compute_s.memory_mib, 4096);
        assert_eq!(compute_s.retail_price_per_hour_cents, 99);
    }

    #[test]
    fn upsert_class_inserts_new_class_and_refreshes_memory() {
        let db = DbHandle::new_memory().expect("test db");
        let catalog = ResourceClassCatalog::from_db(&db).expect("load");

        let new_class = ResourceClass {
            id: "compute.xl".to_string(),
            kind: ResourceKind::Compute,
            class: "xl".to_string(),
            display_name: "Compute XL".to_string(),
            vcpu: 16,
            memory_mib: 32768,
            gpu_vram_mib: 0,
            reliability_tier: ReliabilityTier::Premium,
            retail_price_per_hour_cents: 99,
            retail_price_per_request_cents: 0,
            retail_price_per_token_cents: 0,
        };

        let persisted = catalog.upsert_class(&db, new_class.clone()).expect("upsert");
        assert_eq!(persisted.id, "compute.xl");

        // In-memory catalog reflects the new class immediately.
        assert!(catalog.get("compute.xl").is_some());
        let from_mem = catalog.get("compute.xl").unwrap();
        assert_eq!(from_mem.vcpu, 16);
        assert_eq!(from_mem.reliability_tier, ReliabilityTier::Premium);

        // Reloading from DB also sees the class.
        let reloaded = ResourceClassCatalog::from_db(&db).expect("reload");
        assert!(reloaded.get("compute.xl").is_some());
    }

    #[test]
    fn upsert_class_updates_existing_class_and_refreshes_memory() {
        let db = DbHandle::new_memory().expect("test db");
        let catalog = ResourceClassCatalog::from_db(&db).expect("load");

        let mut updated = catalog.get("compute.s").expect("compute.s exists");
        updated.retail_price_per_hour_cents = 42;
        updated.vcpu = 4;

        catalog.upsert_class(&db, updated).expect("upsert update");

        let from_mem = catalog.get("compute.s").unwrap();
        assert_eq!(from_mem.retail_price_per_hour_cents, 42);
        assert_eq!(from_mem.vcpu, 4);

        let reloaded = ResourceClassCatalog::from_db(&db).expect("reload");
        let from_db = reloaded.get("compute.s").unwrap();
        assert_eq!(from_db.retail_price_per_hour_cents, 42);
        assert_eq!(from_db.vcpu, 4);
    }

    #[test]
    fn delete_class_removes_from_db_and_memory() {
        let db = DbHandle::new_memory().expect("test db");
        // Seed so the DB is non-empty; otherwise from_db would fall back to builtin.
        ResourceClassCatalog::seed_builtin(&db).expect("seed");
        let catalog = ResourceClassCatalog::from_db(&db).expect("load");

        assert!(catalog.get("sandbox.s").is_some());
        let removed = catalog.delete_class(&db, "sandbox.s").expect("delete");
        assert!(removed);

        assert!(catalog.get("sandbox.s").is_none());
        let reloaded = ResourceClassCatalog::from_db(&db).expect("reload");
        assert!(reloaded.get("sandbox.s").is_none());

        let removed_again = catalog.delete_class(&db, "sandbox.s").expect("delete again");
        assert!(!removed_again);
    }
}
