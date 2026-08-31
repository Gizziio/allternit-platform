//! Cloud Supply Optimizer v1.
//!
//! This module is the Cloud-specific supply optimizer, not the global
//! AllternitOS resource scheduler. It receives a canonical resource requirement
//! from AllternitOS, discovers offers from registered external providers,
//! scores them using the cost engine, selects the best eligible offer,
//! provisions it, and records the placement.
//!
//! Boundaries:
//! - AllternitOS Resource Scheduler owns canonical eligibility and placement.
//! - Cloud Supply Optimizer owns price, availability, reliability, retry,
//!   fallback, margin, budget, SLA, region, and SKU constraints for external
//!   supplier capacity.

use crate::fabric::cost::{CostEngine, ScoredOffer};
use crate::fabric::credits::{CreditsError, CreditsLedger};
use crate::fabric::price_cache::PriceCache;
use crate::fabric::sku::ResourceClassCatalog;
use allternitos_cloud_contracts::Placement;
use rusqlite::OptionalExtension;
use allternit_computer_cloud::fabric::{
    FabricProvider, FabricProviderRegistry, Offer, ProviderError, ProvisionedResource,
    ResourceRequest, ResourceState,
};
use chrono::Utc;
use std::time::Duration;
use thiserror::Error;
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum SchedulerError {
    #[error("no resource class found for {0}")]
    UnknownClass(String),
    #[error("no eligible offers found")]
    NoEligibleOffers,
    #[error("all offers are unprofitable")]
    AllOffersUnprofitable,
    #[error("provider error: {0}")]
    Provider(#[from] ProviderError),
    #[error("credits error: {0}")]
    Credits(#[from] CreditsError),
    #[error("placement timed out")]
    Timeout,
}

/// Result of selecting an offer without provisioning.
#[derive(Debug, Clone)]
pub struct SelectedOffer {
    pub provider_kind: String,
    pub offer: Offer,
    pub score: f64,
    pub retail_price_per_hour_cents: i64,
    pub all_in_cost_per_hour_cents: i64,
    pub contribution_per_hour_cents: i64,
}

/// Outcome of a full schedule-and-provision call.
#[derive(Debug, Clone)]
pub struct ScheduledResource {
    pub resource_id: String,
    pub provider_kind: String,
    pub provider_resource_id: String,
    pub offer_id: String,
    pub region: String,
    pub instance_type: String,
    pub ipv4: Option<String>,
    pub endpoint: Option<String>,
}

/// Fabric scheduler.
#[derive(Debug, Clone)]
pub struct Scheduler {
    cost_engine: CostEngine,
    price_cache: Option<PriceCache>,
}

impl Scheduler {
    pub fn new(cost_engine: CostEngine) -> Self {
        Self {
            cost_engine,
            price_cache: None,
        }
    }

    /// Attach a price cache. When set, `select_offer` reads cached offers first
    /// and falls back to live provider discovery only if no cached offer is
    /// eligible.
    pub fn with_price_cache(mut self, price_cache: PriceCache) -> Self {
        self.price_cache = Some(price_cache);
        self
    }

    /// Discover and score offers for a request, returning the best eligible
    /// offer without provisioning.
    pub async fn select_offer(
        &self,
        req: &ResourceRequest,
        catalog: &ResourceClassCatalog,
        registry: &FabricProviderRegistry,
    ) -> Result<SelectedOffer, SchedulerError> {
        let class = catalog
            .get(&req.full_class())
            .ok_or_else(|| SchedulerError::UnknownClass(req.full_class()))?;

        let mut scored: Vec<ScoredOffer> = Vec::new();

        // Try the price cache first to avoid hitting live APIs.
        if let Some(cache) = &self.price_cache {
            match cache.find_offers(req, &class) {
                Ok(offers) => {
                    info!(
                        request_id = %req.id,
                        cached_offers = offers.len(),
                        "scoring cached offers"
                    );
                    for offer in offers {
                        if let Some(s) = self.cost_engine.score_offer(req, &class, &offer) {
                            scored.push(s);
                        }
                    }
                }
                Err(e) => {
                    warn!(request_id = %req.id, error = %e, "price cache query failed");
                }
            }
        }

        // Fall back to live provider discovery if the cache produced no eligible
        // scored offers.
        if scored.is_empty() {
            info!(request_id = %req.id, "falling back to live provider discovery");
            for provider in registry.providers() {
                let offers = provider.discover_offers(req).await?;
                for offer in offers {
                    if let Some(s) = self.cost_engine.score_offer(req, &class, &offer) {
                        scored.push(s);
                    }
                }
            }
        }

        if scored.is_empty() {
            return Err(SchedulerError::NoEligibleOffers);
        }

        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        let best = scored.into_iter().next().unwrap();
        let offer = best.offer.clone();

        info!(
            request_id = %req.id,
            provider = %offer.provider_kind,
            region = %offer.region,
            contribution_cents = best.contribution_per_hour_cents,
            score = best.score,
            "selected best offer"
        );

        Ok(SelectedOffer {
            provider_kind: offer.provider_kind.clone(),
            offer,
            score: best.score,
            retail_price_per_hour_cents: best.retail_price_per_hour_cents,
            all_in_cost_per_hour_cents: best.all_in_cost_per_hour_cents,
            contribution_per_hour_cents: best.contribution_per_hour_cents,
        })
    }

    /// Provision the selected offer using the matching provider.
    pub async fn provision(
        &self,
        req: &ResourceRequest,
        selected: &SelectedOffer,
        registry: &FabricProviderRegistry,
    ) -> Result<ProvisionedResource, SchedulerError> {
        let provider = registry
            .providers()
            .iter()
            .find(|p| p.kind() == selected.provider_kind)
            .ok_or_else(|| SchedulerError::NoEligibleOffers)?;
        let resource = provider.provision(req, &selected.offer).await?;
        info!(
            request_id = %req.id,
            provider_resource_id = %resource.provider_resource_id,
            "provisioned resource"
        );
        Ok(resource)
    }

    /// Full schedule-and-provision flow with credit holds.
    ///
    /// 1. Select the best offer.
    /// 2. Record the resource as `provisioning`.
    /// 3. Place a credit hold for the estimated retail price.
    /// 4. Provision the selected offer.
    /// 5. On success: record the placement, mark active, and charge the hold.
    /// 6. On failure: release the hold and mark the resource terminated.
    pub async fn schedule(
        &self,
        organization_id: &str,
        req: &ResourceRequest,
        catalog: &ResourceClassCatalog,
        registry: &FabricProviderRegistry,
        ledger: &CreditsLedger,
        recorder: &PlacementRecorder,
    ) -> Result<ScheduledResource, SchedulerError> {
        let selected = self.select_offer(req, catalog, registry).await?;
        let estimated_cents = selected.retail_price_per_hour_cents;

        // Persist the desired resource before placing a hold, because the hold
        // table has a foreign key to fabric_resources(id).
        recorder.record_resource(organization_id, req)?;

        let hold = ledger.hold(organization_id, &req.id, estimated_cents).map_err(|e| {
            // The resource row is left as provisioning; caller/background job
            // can terminate it once the credit failure is observed.
            SchedulerError::Credits(e)
        })?;

        match self.provision(req, &selected, registry).await {
            Ok(provisioned) => {
                let scheduled = ScheduledResource {
                    resource_id: req.id.clone(),
                    provider_kind: selected.provider_kind,
                    provider_resource_id: provisioned.provider_resource_id,
                    offer_id: selected.offer.id.clone(),
                    region: provisioned.region,
                    instance_type: provisioned.instance_type,
                    ipv4: provisioned.ipv4,
                    endpoint: provisioned.endpoint,
                };
                if let Err(e) = recorder.record_provisioning(
                    organization_id,
                    &scheduled,
                    selected.retail_price_per_hour_cents,
                    selected.all_in_cost_per_hour_cents,
                    &hold.id,
                ) {
                    warn!(resource_id = %req.id, error = %e, "failed to record provisioning");
                    // The provider resource exists; release the hold so the
                    // customer is not charged for an unrecorded placement.
                    let _ = ledger.release_hold(&hold.id);
                    let _ = recorder.mark_terminated(&req.id, "record_failed");
                    return Err(e);
                }
                if let Err(e) = recorder.mark_active(&req.id) {
                    warn!(resource_id = %req.id, error = %e, "failed to mark resource active");
                    let _ = ledger.release_hold(&hold.id);
                    let _ = recorder.mark_terminated(&req.id, "activate_failed");
                    return Err(e);
                }
                match ledger.charge_hold(&hold.id, estimated_cents, "fabric provisioning", Some("placement"), Some(&req.id)) {
                    Ok(_) => info!(resource_id = %req.id, hold_id = %hold.id, "charged hold for provisioning"),
                    Err(e) => {
                        warn!(resource_id = %req.id, hold_id = %hold.id, error = %e, "failed to charge hold");
                        // Keep the placement; a background reconciler can settle.
                    }
                }
                Ok(scheduled)
            }
            Err(e) => {
                warn!(resource_id = %req.id, error = %e, "provisioning failed; releasing hold");
                let _ = ledger.release_hold(&hold.id);
                let _ = recorder.mark_terminated(&req.id, "provision_failed");
                Err(e)
            }
        }
    }

    /// Poll a provisioned resource until it reaches `Running` or fails.
    pub async fn wait_until_running(
        &self,
        provider_kind: &str,
        provider_resource_id: &str,
        registry: &FabricProviderRegistry,
        timeout: Duration,
    ) -> Result<(), SchedulerError> {
        let provider = registry
            .providers()
            .iter()
            .find(|p| p.kind() == provider_kind)
            .ok_or_else(|| SchedulerError::NoEligibleOffers)?;

        let start = std::time::Instant::now();
        let poll_interval = Duration::from_millis(100);
        loop {
            if start.elapsed() >= timeout {
                return Err(SchedulerError::Timeout);
            }
            match provider.inspect(provider_resource_id).await? {
                ResourceState::Running => return Ok(()),
                ResourceState::Error => {
                    warn!(provider_resource_id, "resource entered error state");
                    return Err(SchedulerError::Provider(ProviderError::Request(
                        "resource entered error state".to_string(),
                    )));
                }
                _ => {}
            }
            tokio::time::sleep(poll_interval).await;
        }
    }
}

/// Synchronous placement recorder used after a resource is provisioned.
#[derive(Debug, Clone)]
pub struct PlacementRecorder {
    db: crate::db::DbHandle,
}

impl PlacementRecorder {
    pub fn new(db: crate::db::DbHandle) -> Self {
        Self { db }
    }

    /// Insert a `fabric_resources` row representing a provisioning request.
    pub fn record_resource(
        &self,
        organization_id: &str,
        req: &ResourceRequest,
    ) -> Result<(), SchedulerError> {
        let conn = self.db.connect().map_err(|e| {
            SchedulerError::Provider(ProviderError::Request(format!("db: {e}")))
        })?;
        conn.execute(
            "INSERT INTO fabric_resources (
                id, organization_id, kind, class, display_name, status, requested_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, 'provisioning', ?6)",
            rusqlite::params![
                req.id,
                organization_id,
                req.kind.to_string(),
                req.class,
                req.display_name,
                Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| SchedulerError::Provider(ProviderError::Request(format!("db: {e}"))))?;
        Ok(())
    }

    /// Record the result of a canonical OS lease issue as a Cloud resource +
    /// placement. This keeps Cloud's customer-facing resource view in sync with
    /// the canonical OS placement authority.
    pub fn record_os_placement(
        &self,
        organization_id: &str,
        resource_id: &str,
        kind: &str,
        class: &str,
        display_name: Option<&str>,
        os_lease_id: Option<&str>,
        placement: &Placement,
        hold_id: &str,
    ) -> Result<(), SchedulerError> {
        let mut conn = self.db.connect().map_err(|e| {
            SchedulerError::Provider(ProviderError::Request(format!("db: {e}")))
        })?;
        let tx = conn.transaction().map_err(|e| {
            SchedulerError::Provider(ProviderError::Request(format!("db: {e}")))
        })?;

        tx.execute(
            "INSERT INTO fabric_resources (
                id, organization_id, kind, class, display_name, status,
                provider_kind, provider_resource_id, region, os_lease_id, requested_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                 status = 'active',
                 provider_kind = excluded.provider_kind,
                 provider_resource_id = excluded.provider_resource_id,
                 region = excluded.region,
                 os_lease_id = excluded.os_lease_id,
                 provisioned_at = CURRENT_TIMESTAMP",
            rusqlite::params![
                resource_id,
                organization_id,
                kind,
                class,
                display_name,
                placement.provider_kind,
                placement.provider_resource_id.as_deref().unwrap_or(""),
                placement.region,
                os_lease_id,
                Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| SchedulerError::Provider(ProviderError::Request(format!("db: {e}"))))?;

        let retail_cents = placement
            .retail_price_per_hour
            .as_ref()
            .map(|m| m.minor_units as i64)
            .unwrap_or(0);
        let cost_cents = placement
            .provider_cost_per_hour
            .as_ref()
            .map(|m| m.minor_units as i64)
            .unwrap_or(0);

        // For request/token-metered classes, the canonical placement may carry
        // per-request/per-token prices. Fall back to Cloud's resource-class
        // catalog when the canonical placement does not include them.
        let (class_retail_request, class_retail_token): (i64, i64) = tx
            .query_row(
                "SELECT retail_price_per_request_cents, retail_price_per_token_cents
                 FROM fabric_resource_classes
                 WHERE kind = ?1 AND class = ?2",
                rusqlite::params![kind, class],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
            )
            .optional()
            .map_err(|e| SchedulerError::Provider(ProviderError::Request(format!("db: {e}"))))?
            .unwrap_or((0, 0));

        let retail_request_cents = placement
            .retail_price_per_request
            .as_ref()
            .map(|m| m.minor_units as i64)
            .unwrap_or(class_retail_request);
        let cost_request_cents = placement
            .provider_cost_per_request
            .as_ref()
            .map(|m| m.minor_units as i64)
            .unwrap_or(class_retail_request);
        let retail_token_cents = placement
            .retail_price_per_token
            .as_ref()
            .map(|m| m.minor_units as i64)
            .unwrap_or(class_retail_token);
        let cost_token_cents = placement
            .provider_cost_per_token
            .as_ref()
            .map(|m| m.minor_units as i64)
            .unwrap_or(class_retail_token);

        tx.execute(
            "INSERT INTO fabric_placements (
                id, resource_id, provider_kind, provider_resource_id, offer_id, instance_type, region,
                retail_price_per_hour_cents, provider_cost_per_hour_cents,
                retail_price_per_request_cents, provider_cost_per_request_cents,
                retail_price_per_token_cents, provider_cost_per_token_cents,
                hold_id, started_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            rusqlite::params![
                Uuid::new_v4().to_string(),
                resource_id,
                placement.provider_kind,
                placement.provider_resource_id.as_deref().unwrap_or(""),
                placement.offer_id,
                placement.instance_type,
                placement.region,
                retail_cents,
                cost_cents,
                retail_request_cents,
                cost_request_cents,
                retail_token_cents,
                cost_token_cents,
                hold_id,
                placement.started_at.to_rfc3339(),
            ],
        )
        .map_err(|e| SchedulerError::Provider(ProviderError::Request(format!("db: {e}"))))?;

        tx.commit().map_err(|e| {
            SchedulerError::Provider(ProviderError::Request(format!("db: {e}")))
        })?;
        Ok(())
    }

    /// Insert the initial `fabric_placements` row for a provisioned resource.
    pub fn record_provisioning(
        &self,
        _organization_id: &str,
        scheduled: &ScheduledResource,
        retail_price_per_hour_cents: i64,
        provider_cost_per_hour_cents: i64,
        hold_id: &str,
    ) -> Result<(), SchedulerError> {
        let conn = self.db.connect().map_err(|e| {
            SchedulerError::Provider(ProviderError::Request(format!("db: {e}")))
        })?;
        conn.execute(
            "INSERT INTO fabric_placements (
                id, resource_id, provider_kind, provider_resource_id, offer_id, instance_type, region,
                retail_price_per_hour_cents, provider_cost_per_hour_cents,
                retail_price_per_request_cents, provider_cost_per_request_cents,
                retail_price_per_token_cents, provider_cost_per_token_cents,
                hold_id, started_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            rusqlite::params![
                Uuid::new_v4().to_string(),
                scheduled.resource_id,
                scheduled.provider_kind,
                scheduled.provider_resource_id,
                scheduled.offer_id,
                scheduled.instance_type,
                scheduled.region,
                retail_price_per_hour_cents,
                provider_cost_per_hour_cents,
                0i64,
                0i64,
                0i64,
                0i64,
                hold_id,
                Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| SchedulerError::Provider(ProviderError::Request(format!("db: {e}"))))?;
        Ok(())
    }

    /// Mark a resource as active.
    pub fn mark_active(&self, resource_id: &str) -> Result<(), SchedulerError> {
        let conn = self.db.connect().map_err(|e| {
            SchedulerError::Provider(ProviderError::Request(format!("db: {e}")))
        })?;
        conn.execute(
            "UPDATE fabric_resources
             SET status = 'active', provisioned_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            rusqlite::params![resource_id],
        )
        .map_err(|e| SchedulerError::Provider(ProviderError::Request(format!("db: {e}"))))?;
        Ok(())
    }

    /// Mark a resource as terminated and close its placement.
    pub fn mark_terminated(
        &self,
        resource_id: &str,
        reason: &str,
    ) -> Result<(), SchedulerError> {
        let conn = self.db.connect().map_err(|e| {
            SchedulerError::Provider(ProviderError::Request(format!("db: {e}")))
        })?;
        conn.execute(
            "UPDATE fabric_resources
             SET status = 'terminated', terminated_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            rusqlite::params![resource_id],
        )
        .map_err(|e| SchedulerError::Provider(ProviderError::Request(format!("db: {e}"))))?;
        conn.execute(
            "UPDATE fabric_placements
             SET ended_at = CURRENT_TIMESTAMP, termination_reason = ?1
             WHERE resource_id = ?2 AND ended_at IS NULL",
            rusqlite::params![reason, resource_id],
        )
        .map_err(|e| SchedulerError::Provider(ProviderError::Request(format!("db: {e}"))))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;
    use crate::fabric::credits::{CreditsLedger, TransactionType};
    use crate::fabric::price_cache::PriceCache;
    use crate::fabric::sku::ResourceClassCatalog;
    use allternit_computer_cloud::fabric::Offer;
    use allternit_computer_cloud::providers::fake::fake_cpu_provider;

    fn cached_offer(instance_type: &str, region: &str, price: i64) -> Offer {
        Offer {
            id: format!("off_test_{}", instance_type),
            provider_kind: "cached".to_string(),
            region: region.to_string(),
            instance_type: instance_type.to_string(),
            vcpu: 2,
            memory_mib: 4096,
            gpu_vram_mib: 0,
            gpu_model: None,
            price_per_hour_cents: price,
            currency: "USD".to_string(),
            reliability_score: 0.95,
            interruptible: false,
            estimated_ready_secs: 1,
            raw_metadata: None,
        }
    }

    fn request(class: &str) -> ResourceRequest {
        ResourceRequest {
            id: Uuid::new_v4().to_string(),
            kind: allternit_computer_cloud::fabric::ResourceKind::Compute,
            class: class.to_string(),
            display_name: None,
            vcpu_min: 1,
            memory_mib_min: 1024,
            gpu_vram_mib_min: 0,
            region_policy: allternit_computer_cloud::fabric::RegionPolicy::Any,
            latency_slo_ms: None,
            deadline: None,
            reliability_tier: allternit_computer_cloud::fabric::ReliabilityTier::Standard,
            image: None,
            model: None,
            runtime: None,
            storage_mib: 0,
            egress_policy: None,
            constraints: allternit_computer_cloud::fabric::CustomerConstraints::default(),
            labels: std::collections::HashMap::new(),
            user_data: None,
        }
    }

    fn registry_with_fake() -> FabricProviderRegistry {
        let mut registry = FabricProviderRegistry::empty();
        registry.register(std::sync::Arc::new(fake_cpu_provider()));
        registry
    }

    fn test_db(org_id: &str) -> DbHandle {
        let db = DbHandle::new_memory().expect("memory db");
        let conn = db.connect().expect("connect");
        conn.execute(
            "INSERT INTO organizations (id, name) VALUES (?1, ?2)",
            rusqlite::params![org_id, "Test Org"],
        )
        .expect("insert org");
        db
    }

    fn ledger_with_balance(org_id: &str, cents: i64) -> CreditsLedger {
        let ledger = CreditsLedger::new(test_db(org_id));
        if cents > 0 {
            ledger
                .credit(org_id, cents, TransactionType::Purchase, Some("top-up"), None, None, None)
                .unwrap();
        }
        ledger
    }

    #[tokio::test]
    async fn scheduler_selects_fake_offer() {
        let scheduler = Scheduler::new(CostEngine::default_engine());
        let catalog = ResourceClassCatalog::builtin();
        let registry = registry_with_fake();
        let req = request("s");
        let selected = scheduler.select_offer(&req, &catalog, &registry).await.unwrap();
        assert_eq!(selected.provider_kind, "fake");
        assert!(selected.score > 0.0);
        assert!(selected.retail_price_per_hour_cents > 0);
    }

    #[tokio::test]
    async fn scheduler_provisions_selected_offer_and_charges_hold() {
        let org_id = "org-sched-1";
        let db = test_db(org_id);
        let ledger = CreditsLedger::new(db.clone());
        ledger
            .credit(org_id, 10_000, TransactionType::Purchase, Some("top-up"), None, None, None)
            .unwrap();
        let recorder = PlacementRecorder::new(db);
        let scheduler = Scheduler::new(CostEngine::default_engine());
        let catalog = ResourceClassCatalog::builtin();
        let registry = registry_with_fake();
        let req = request("s");
        let scheduled = scheduler
            .schedule(org_id, &req, &catalog, &registry, &ledger, &recorder)
            .await
            .unwrap();
        assert_eq!(scheduled.provider_kind, "fake");
        assert!(!scheduled.provider_resource_id.is_empty());
        assert!(ledger.held_cents(org_id).unwrap() == 0);
        assert!(ledger.balance_cents(org_id).unwrap() < 10_000);
    }

    #[tokio::test]
    async fn scheduler_blocks_when_insufficient_credits() {
        let org_id = "org-sched-2";
        let db = test_db(org_id);
        let ledger = CreditsLedger::new(db.clone());
        // No credits.
        let recorder = PlacementRecorder::new(db);
        let scheduler = Scheduler::new(CostEngine::default_engine());
        let catalog = ResourceClassCatalog::builtin();
        let registry = registry_with_fake();
        let req = request("s");
        let err = scheduler
            .schedule(org_id, &req, &catalog, &registry, &ledger, &recorder)
            .await
            .unwrap_err();
        assert!(matches!(err, SchedulerError::Credits(CreditsError::InsufficientCredits { .. })));
    }

    #[tokio::test]
    async fn scheduler_blocks_when_no_offers_available() {
        let org_id = "org-sched-3";
        let db = test_db(org_id);
        let ledger = CreditsLedger::new(db.clone());
        ledger
            .credit(org_id, 10_000, TransactionType::Purchase, Some("top-up"), None, None, None)
            .unwrap();
        let recorder = PlacementRecorder::new(db);
        let scheduler = Scheduler::new(CostEngine::default_engine());
        let catalog = ResourceClassCatalog::builtin();
        let registry = FabricProviderRegistry::empty();
        let req = request("s");
        let err = scheduler
            .schedule(org_id, &req, &catalog, &registry, &ledger, &recorder)
            .await
            .unwrap_err();
        assert!(matches!(err, SchedulerError::NoEligibleOffers));
        // No hold should be outstanding because select_offer failed before hold.
        assert_eq!(ledger.held_cents(org_id).unwrap(), 0);
    }

    #[tokio::test]
    async fn scheduler_releases_hold_on_provision_failure() {
        let org_id = "org-sched-5";
        let db = test_db(org_id);
        let ledger = CreditsLedger::new(db.clone());
        ledger
            .credit(org_id, 10_000, TransactionType::Purchase, Some("top-up"), None, None, None)
            .unwrap();
        let recorder = PlacementRecorder::new(db);
        let scheduler = Scheduler::new(CostEngine::default_engine());
        let catalog = ResourceClassCatalog::builtin();
        let mut registry = FabricProviderRegistry::empty();
        registry.register(std::sync::Arc::new(
            fake_cpu_provider().with_provision_failure(),
        ));
        let req = request("s");
        let err = scheduler
            .schedule(org_id, &req, &catalog, &registry, &ledger, &recorder)
            .await
            .unwrap_err();
        assert!(matches!(err, SchedulerError::Provider(_)));
        // Hold must be released so the customer can retry.
        assert_eq!(ledger.held_cents(org_id).unwrap(), 0);
        assert_eq!(ledger.balance_cents(org_id).unwrap(), 10_000);
    }

    #[tokio::test]
    async fn scheduler_returns_no_offers_for_unknown_class() {
        let scheduler = Scheduler::new(CostEngine::default_engine());
        let catalog = ResourceClassCatalog::builtin();
        let registry = registry_with_fake();
        let mut req = request("s");
        req.class = "unknown".to_string();
        let err = scheduler.select_offer(&req, &catalog, &registry).await.unwrap_err();
        assert!(matches!(err, SchedulerError::UnknownClass(_)));
    }

    #[tokio::test]
    async fn scheduler_waits_until_running() {
        let org_id = "org-sched-4";
        let db = test_db(org_id);
        let ledger = CreditsLedger::new(db.clone());
        ledger
            .credit(org_id, 10_000, TransactionType::Purchase, Some("top-up"), None, None, None)
            .unwrap();
        let recorder = PlacementRecorder::new(db);
        let scheduler = Scheduler::new(CostEngine::default_engine());
        let catalog = ResourceClassCatalog::builtin();
        let registry = registry_with_fake();
        let req = request("s");
        let scheduled = scheduler
            .schedule(org_id, &req, &catalog, &registry, &ledger, &recorder)
            .await
            .unwrap();
        scheduler
            .wait_until_running(
                &scheduled.provider_kind,
                &scheduled.provider_resource_id,
                &registry,
                Duration::from_secs(5),
            )
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn scheduler_selects_cached_offer() {
        let db = DbHandle::new_memory().expect("memory db");
        let price_cache = PriceCache::new(db);
        let offers = vec![cached_offer("cached-small", "us-east", 3)];
        price_cache
            .upsert_offers(
                &offers,
                chrono::Utc::now() + chrono::Duration::seconds(600),
            )
            .unwrap();

        let scheduler = Scheduler::new(CostEngine::default_engine()).with_price_cache(price_cache);
        let catalog = ResourceClassCatalog::builtin();
        let registry = FabricProviderRegistry::empty(); // no live providers
        let req = request("s");
        let selected = scheduler.select_offer(&req, &catalog, &registry).await.unwrap();
        assert_eq!(selected.provider_kind, "cached");
    }

    #[tokio::test]
    async fn scheduler_falls_back_when_cached_offers_ineligible() {
        let db = DbHandle::new_memory().expect("memory db");
        let price_cache = PriceCache::new(db);
        // Cached offer is unprofitable (price far above retail); the scheduler
        // should score it out and fall back to the live fake provider.
        let offers = vec![cached_offer("cached-small", "us-east", 500)];
        price_cache
            .upsert_offers(
                &offers,
                chrono::Utc::now() + chrono::Duration::seconds(600),
            )
            .unwrap();

        let scheduler = Scheduler::new(CostEngine::default_engine()).with_price_cache(price_cache);
        let catalog = ResourceClassCatalog::builtin();
        let registry = registry_with_fake();
        let req = request("s");
        let selected = scheduler.select_offer(&req, &catalog, &registry).await.unwrap();
        assert_eq!(selected.provider_kind, "fake");
    }
}
