//! Cloud Supply Optimizer — provider price cache.
//!
//! Discovered external supplier offers are cached in `fabric_provider_prices`
//! so the Cloud Supply Optimizer can read them without hitting live APIs on
//! every request. A background worker periodically refreshes the cache.
//!
//! This is a Cloud-specific commercial optimization cache, not a canonical
//! AllternitOS resource directory.

use crate::db::DbHandle;
use crate::fabric::sku::ResourceClass;
use crate::fabric::ResourceClassCatalog;
use allternit_computer_cloud::fabric::{
    FabricProvider, FabricProviderRegistry, Offer, ProviderError, RegionPolicy, ReliabilityTier,
    ResourceKind, ResourceRequest,
};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::time::Duration;
use thiserror::Error;
use tracing::{info, warn};
use uuid::Uuid;

/// Errors from price-cache operations.
#[derive(Debug, Error)]
pub enum PriceCacheError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("provider error: {0}")]
    Provider(#[from] ProviderError),
}

/// Database-backed cache of provider offers.
#[derive(Debug, Clone)]
pub struct PriceCache {
    db: DbHandle,
}

impl PriceCache {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    fn parse_offer(row: &rusqlite::Row) -> Result<Offer, rusqlite::Error> {
        let raw_json: Option<String> = row.get("raw_json")?;
        let raw_metadata = raw_json
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());
        Ok(Offer {
            id: row.get("id")?,
            provider_kind: row.get("provider_kind")?,
            region: row.get("region")?,
            instance_type: row.get("instance_type")?,
            vcpu: row.get::<_, i64>("vcpu")? as u32,
            memory_mib: row.get::<_, i64>("memory_mib")? as u64,
            gpu_vram_mib: row.get::<_, i64>("gpu_vram_mib")? as u64,
            gpu_model: row.get("gpu_model")?,
            price_per_hour_cents: row.get("price_per_hour_cents")?,
            currency: row.get("price_per_hour_currency")?,
            reliability_score: row.get("reliability_score")?,
            interruptible: row.get("interruptible")?,
            estimated_ready_secs: row.get::<_, i64>("estimated_ready_secs")? as u64,
            raw_metadata,
        })
    }

    /// Find cached offers that can satisfy a resource class.
    ///
    /// Returns offers whose capacity meets the class minimums and whose TTL has
    /// not expired. The caller (the scheduler / cost engine) is responsible for
    /// applying region constraints and scoring.
    pub fn find_offers(
        &self,
        _req: &ResourceRequest,
        class: &ResourceClass,
    ) -> Result<Vec<Offer>, PriceCacheError> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, provider_kind, region, instance_type, vcpu, memory_mib, gpu_vram_mib,
                    gpu_model, price_per_hour_cents, price_per_hour_currency,
                    reliability_score, interruptible, estimated_ready_secs, raw_json
             FROM fabric_provider_prices
             WHERE vcpu >= ?1
               AND memory_mib >= ?2
               AND gpu_vram_mib >= ?3
               AND (valid_until IS NULL OR valid_until > ?4)
             ORDER BY price_per_hour_cents ASC",
        )?;
        let rows = stmt.query_map(
            rusqlite::params![
                class.vcpu as i64,
                class.memory_mib as i64,
                class.gpu_vram_mib as i64,
                Utc::now().to_rfc3339(),
            ],
            Self::parse_offer,
        )?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    /// Upsert a slice of offers. Returns the number of rows written.
    pub fn upsert_offers(
        &self,
        offers: &[Offer],
        valid_until: DateTime<Utc>,
    ) -> Result<usize, PriceCacheError> {
        let mut conn = self.db.connect()?;
        let tx = conn.transaction()?;
        let mut written = 0;
        for offer in offers {
            tx.execute(
                "INSERT INTO fabric_provider_prices (
                    id, provider_kind, region, instance_type, vcpu, memory_mib,
                    gpu_vram_mib, gpu_model, price_per_hour_cents, price_per_hour_currency,
                    reliability_score, interruptible, valid_from, valid_until, raw_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
                ON CONFLICT(provider_kind, region, instance_type, COALESCE(gpu_model, ''), interruptible)
                DO UPDATE SET
                    vcpu = excluded.vcpu,
                    memory_mib = excluded.memory_mib,
                    gpu_vram_mib = excluded.gpu_vram_mib,
                    price_per_hour_cents = excluded.price_per_hour_cents,
                    price_per_hour_currency = excluded.price_per_hour_currency,
                    reliability_score = excluded.reliability_score,
                    valid_from = excluded.valid_from,
                    valid_until = excluded.valid_until,
                    raw_json = excluded.raw_json",
                rusqlite::params![
                    Uuid::new_v4().to_string(),
                    &offer.provider_kind,
                    &offer.region,
                    &offer.instance_type,
                    offer.vcpu as i64,
                    offer.memory_mib as i64,
                    offer.gpu_vram_mib as i64,
                    &offer.gpu_model,
                    offer.price_per_hour_cents,
                    &offer.currency,
                    offer.reliability_score,
                    offer.interruptible,
                    Utc::now().to_rfc3339(),
                    valid_until.to_rfc3339(),
                    offer.raw_metadata.as_ref().map(|v| v.to_string()),
                ],
            )?;
            written += 1;
        }
        tx.commit()?;
        Ok(written)
    }
}

/// Async refresh: discover offers for every class/tier/provider and upsert.
///
/// `ttl` determines how long cached rows remain valid.
pub async fn refresh_cache(
    db: DbHandle,
    registry: &FabricProviderRegistry,
    catalog: &ResourceClassCatalog,
    ttl: Duration,
) -> Result<usize, PriceCacheError> {
    let valid_until = Utc::now() + chrono::Duration::from_std(ttl).unwrap_or_else(|_| chrono::Duration::seconds(600));
    let price_cache = PriceCache::new(db);
    let tiers = [ReliabilityTier::Standard, ReliabilityTier::Interruptible];
    let mut total_written = 0;

    for provider in registry.providers() {
        let capabilities = provider.capabilities();
        for class in catalog.classes() {
            if !capabilities.kinds.contains(&class.kind) {
                continue;
            }
            for tier in tiers {
                let req = discovery_request(&class, tier);
                match provider.discover_offers(&req).await {
                    Ok(offers) => {
                        if !offers.is_empty() {
                            match price_cache.upsert_offers(&offers, valid_until) {
                                Ok(written) => {
                                    total_written += written;
                                    info!(
                                        provider = %provider.kind(),
                                        class = %class.full_class(),
                                        tier = %tier,
                                        offers = offers.len(),
                                        "refreshed price cache"
                                    );
                                }
                                Err(e) => {
                                    warn!(
                                        provider = %provider.kind(),
                                        class = %class.full_class(),
                                        tier = %tier,
                                        error = %e,
                                        "failed to upsert price cache"
                                    );
                                }
                            }
                        }
                    }
                    Err(e) => {
                        warn!(
                            provider = %provider.kind(),
                            class = %class.full_class(),
                            tier = %tier,
                            error = %e,
                            "provider discovery failed during price refresh"
                        );
                    }
                }
            }
        }
    }

    Ok(total_written)
}

/// Build a minimal discovery request for a capability class and reliability tier.
pub fn discovery_request(class: &ResourceClass, reliability_tier: ReliabilityTier) -> ResourceRequest {
    ResourceRequest {
        id: Uuid::new_v4().to_string(),
        kind: class.kind,
        class: class.class.clone(),
        display_name: Some(class.display_name.clone()),
        vcpu_min: class.vcpu,
        memory_mib_min: class.memory_mib,
        gpu_vram_mib_min: class.gpu_vram_mib,
        region_policy: RegionPolicy::Any,
        latency_slo_ms: None,
        deadline: None,
        reliability_tier,
        image: None,
        model: None,
        runtime: None,
        storage_mib: 0,
        egress_policy: None,
        constraints: Default::default(),
        labels: HashMap::new(),
        user_data: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;
    use crate::fabric::sku::ResourceClassCatalog;
    use allternit_computer_cloud::providers::fake::fake_cpu_provider;
    use rusqlite::params;

    fn test_db() -> DbHandle {
        DbHandle::new_memory().unwrap()
    }

    fn seed_classes(db: &DbHandle) {
        let conn = db.connect().unwrap();
        for class in ResourceClassCatalog::builtin().classes() {
            conn.execute(
                "INSERT OR IGNORE INTO fabric_resource_classes
                 (id, kind, class, display_name, vcpu_min, memory_mib_min, gpu_vram_mib_min,
                  reliability_tier, retail_price_per_hour_cents,
                  retail_price_per_request_cents, retail_price_per_token_cents)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
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
            )
            .unwrap();
        }
    }

    fn sample_offer(instance_type: &str, vcpu: u32, memory_mib: u64, price: i64) -> Offer {
        Offer {
            id: format!("off_test_{}", instance_type),
            provider_kind: "fake".to_string(),
            region: "us-east".to_string(),
            instance_type: instance_type.to_string(),
            vcpu,
            memory_mib,
            gpu_vram_mib: 0,
            gpu_model: None,
            price_per_hour_cents: price,
            currency: "USD".to_string(),
            reliability_score: 0.95,
            interruptible: false,
            estimated_ready_secs: 1,
            raw_metadata: Some(serde_json::json!({"test": true})),
        }
    }

    #[test]
    fn upsert_and_find_offers() {
        let db = test_db();
        seed_classes(&db);
        let cache = PriceCache::new(db);
        let offers = vec![
            sample_offer("fake-small", 2, 4096, 50),
            sample_offer("fake-large", 4, 8192, 90),
        ];
        let valid_until = Utc::now() + chrono::Duration::seconds(600);
        cache.upsert_offers(&offers, valid_until).unwrap();

        let catalog = ResourceClassCatalog::builtin();
        let class = catalog.get("compute.s").unwrap();
        let req = discovery_request(&class, ReliabilityTier::Standard);
        let found = cache.find_offers(&req, &class).unwrap();
        assert_eq!(found.len(), 2);
        assert!(found.iter().any(|o| o.instance_type == "fake-small"));
    }

    #[test]
    fn find_offers_filters_by_min_requirements() {
        let db = test_db();
        seed_classes(&db);
        let cache = PriceCache::new(db);
        let offers = vec![
            sample_offer("fake-small", 1, 1024, 50),
            sample_offer("fake-large", 4, 8192, 90),
        ];
        let valid_until = Utc::now() + chrono::Duration::seconds(600);
        cache.upsert_offers(&offers, valid_until).unwrap();

        let catalog = ResourceClassCatalog::builtin();
        let class = catalog.get("compute.l").unwrap();
        let req = discovery_request(&class, ReliabilityTier::Standard);
        let found = cache.find_offers(&req, &class).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].instance_type, "fake-large");
    }

    #[test]
    fn find_offers_respects_valid_until() {
        let db = test_db();
        seed_classes(&db);
        let cache = PriceCache::new(db);
        let offers = vec![sample_offer("fake-small", 2, 4096, 50)];
        let valid_until = Utc::now() - chrono::Duration::seconds(1);
        cache.upsert_offers(&offers, valid_until).unwrap();

        let catalog = ResourceClassCatalog::builtin();
        let class = catalog.get("compute.s").unwrap();
        let req = discovery_request(&class, ReliabilityTier::Standard);
        let found = cache.find_offers(&req, &class).unwrap();
        assert!(found.is_empty());
    }

    #[tokio::test]
    async fn refresh_cache_populates_table() {
        let db = test_db();
        seed_classes(&db);
        let mut registry = FabricProviderRegistry::empty();
        registry.register(std::sync::Arc::new(fake_cpu_provider()));
        let catalog = ResourceClassCatalog::builtin();

        let written = refresh_cache(db.clone(), &registry, &catalog, Duration::from_secs(600))
            .await
            .unwrap();
        assert!(written > 0);

        let conn = db.connect().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM fabric_provider_prices", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert!(count > 0);
    }
}
