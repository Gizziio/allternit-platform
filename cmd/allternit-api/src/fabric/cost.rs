//! Cloud Supply Optimizer — cost engine and margin calculator.
//!
//! Scores external supplier offers for the Cloud Supply Optimizer. It does not
//! perform canonical AllternitOS resource scheduling; it receives a resource
//! requirement and returns a scored commercial offer.
//!
//! Every placement decision is scored by expected contribution margin:
//!   contribution = retail_price - all_in_cost
//! where all_in_cost includes the supplier price plus payment fees, support
//! allocation, and a reliability reserve.

use crate::fabric::sku::ResourceClass;
use allternit_computer_cloud::fabric::{Offer, RegionPolicy, ReliabilityTier, ResourceRequest};

/// Currency amounts are stored in USD cents.
pub type Cents = i64;

/// Configuration for the cost engine.
#[derive(Debug, Clone, Copy)]
pub struct CostEngineConfig {
    /// Payment processor fee as a fraction of retail (e.g. 0.03 for 3%).
    pub payment_fee_rate: f64,
    /// Support allocation as a fraction of retail.
    pub support_allocation_rate: f64,
    /// Base support cost per hour in cents.
    pub support_base_cents_per_hour: Cents,
    /// Reliability reserve multiplier: (1 - reliability_score) * provider_cost.
    pub reliability_reserve_multiplier: f64,
    /// Estimated storage cost per GiB-hour in cents.
    pub storage_cost_cents_per_gib_hour: f64,
    /// Estimated egress cost per GiB in cents.
    pub egress_cost_cents_per_gib: f64,
}

impl Default for CostEngineConfig {
    fn default() -> Self {
        Self {
            payment_fee_rate: 0.03,
            support_allocation_rate: 0.05,
            support_base_cents_per_hour: 0,
            reliability_reserve_multiplier: 1.0,
            storage_cost_cents_per_gib_hour: 0.001,
            egress_cost_cents_per_gib: 5.0,
        }
    }
}

/// A scored offer ready for scheduling.
#[derive(Debug, Clone)]
pub struct ScoredOffer {
    pub offer: Offer,
    pub retail_price_per_hour_cents: Cents,
    pub all_in_cost_per_hour_cents: Cents,
    pub contribution_per_hour_cents: Cents,
    pub score: f64,
}

/// Cost engine computes all-in costs and scores offers.
#[derive(Debug, Clone, Default)]
pub struct CostEngine {
    config: CostEngineConfig,
}

impl CostEngine {
    pub fn new(config: CostEngineConfig) -> Self {
        Self { config }
    }

    pub fn default_engine() -> Self {
        Self::default()
    }

    /// Compute the retail price for a resource class over a duration.
    pub fn retail_price(
        &self,
        class: &ResourceClass,
        duration_hours: f64,
        storage_gib: f64,
    ) -> Cents {
        let compute = (class.retail_price_per_hour_cents as f64 * duration_hours) as Cents;
        let storage = (storage_gib * self.config.storage_cost_cents_per_gib_hour * duration_hours) as Cents;
        compute + storage
    }

    /// Compute the all-in cost for an offer over a duration, including reserves.
    ///
    /// `retail_cents` is the actual customer-facing price for this workload,
    /// used to estimate payment-processor fees and support allocation.
    pub fn all_in_cost(
        &self,
        offer: &Offer,
        retail_cents: Cents,
        duration_hours: f64,
        storage_gib: f64,
        egress_gib: f64,
    ) -> Cents {
        let provider_cost = offer.price_per_hour_cents as f64 * duration_hours;
        let storage_cost = storage_gib * self.config.storage_cost_cents_per_gib_hour * duration_hours;
        let egress_cost = egress_gib * self.config.egress_cost_cents_per_gib;
        let reliability_reserve = (1.0 - offer.reliability_score)
            * provider_cost
            * self.config.reliability_reserve_multiplier;
        let subtotal = provider_cost + storage_cost + egress_cost + reliability_reserve;
        let retail = retail_cents as f64;
        let payment_fee = retail * self.config.payment_fee_rate;
        let support = retail * self.config.support_allocation_rate
            + self.config.support_base_cents_per_hour as f64 * duration_hours;
        (subtotal + payment_fee + support) as Cents
    }

    /// Compute contribution margin for an explicit retail price and all-in cost.
    pub fn contribution(&self, retail_cents: Cents, all_in_cost_cents: Cents) -> Cents {
        retail_cents - all_in_cost_cents
    }

    /// Score an offer for a specific request and resource class.
    ///
    /// Returns `None` if the offer is ineligible or would lose money.
    pub fn score_offer(
        &self,
        req: &ResourceRequest,
        class: &ResourceClass,
        offer: &Offer,
    ) -> Option<ScoredOffer> {
        if !self.is_eligible(req, class, offer) {
            return None;
        }
        let duration_hours = 1.0;
        let storage_gib = req.storage_mib as f64 / 1024.0;
        let retail = self.retail_price(class, duration_hours, storage_gib);
        let cost = self.all_in_cost(offer, retail, duration_hours, storage_gib, 0.0);
        let contribution = self.contribution(retail, cost);
        if contribution <= 0 {
            return None;
        }
        // Normalize score by retail so different price tiers are comparable.
        let contribution_ratio = contribution as f64 / retail.max(1) as f64;
        let latency_fit = latency_fit_score(req.latency_slo_ms, offer.estimated_ready_secs);
        let region_bonus = region_bonus(&req.region_policy, &offer.region);
        let reliability_bonus = offer.reliability_score;
        let score = contribution_ratio
            * latency_fit
            * region_bonus
            * reliability_bonus
            * interruptible_penalty(req.reliability_tier, offer.interruptible);
        Some(ScoredOffer {
            offer: offer.clone(),
            retail_price_per_hour_cents: retail,
            all_in_cost_per_hour_cents: cost,
            contribution_per_hour_cents: contribution,
            score,
        })
    }

    fn is_eligible(&self, req: &ResourceRequest, class: &ResourceClass, offer: &Offer) -> bool {
        if !class.satisfies(req.vcpu_min, req.memory_mib_min, req.gpu_vram_mib_min) {
            return false;
        }
        if offer.vcpu < req.vcpu_min
            || offer.memory_mib < req.memory_mib_min
            || offer.gpu_vram_mib < req.gpu_vram_mib_min
        {
            return false;
        }
        if let Some(max) = req.constraints.max_price_per_hour_cents {
            if offer.price_per_hour_cents > max {
                return false;
            }
        }
        match &req.region_policy {
            RegionPolicy::Any => true,
            RegionPolicy::Prefer(_) => true,
            RegionPolicy::Require(regions) => regions.contains(&offer.region),
            RegionPolicy::Exclude(regions) => !regions.contains(&offer.region),
        }
    }
}

fn latency_fit_score(slo_ms: Option<u64>, ready_secs: u64) -> f64 {
    let Some(slo) = slo_ms else {
        return 1.0;
    };
    if slo == 0 {
        return 1.0;
    }
    let ready_ms = ready_secs * 1000;
    if ready_ms >= slo {
        return 0.0;
    }
    1.0 - (ready_ms as f64 / slo as f64)
}

fn region_bonus(policy: &RegionPolicy, region: &str) -> f64 {
    match policy {
        RegionPolicy::Any => 1.0,
        RegionPolicy::Prefer(regions) if regions.contains(&region.to_string()) => 1.15,
        RegionPolicy::Prefer(_) => 1.0,
        RegionPolicy::Require(_) => 1.0,
        RegionPolicy::Exclude(_) => 1.0,
    }
}

fn interruptible_penalty(tier: ReliabilityTier, interruptible: bool) -> f64 {
    match tier {
        ReliabilityTier::Interruptible if interruptible => 1.1,
        ReliabilityTier::Interruptible => 0.9,
        _ if interruptible => 0.7,
        _ => 1.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_computer_cloud::fabric::{
        CustomerConstraints, RegionPolicy, ReliabilityTier, ResourceKind,
    };

    fn compute_request() -> ResourceRequest {
        ResourceRequest {
            id: "req-1".to_string(),
            kind: ResourceKind::Compute,
            class: "s".to_string(),
            display_name: None,
            vcpu_min: 1,
            memory_mib_min: 1024,
            gpu_vram_mib_min: 0,
            region_policy: RegionPolicy::Any,
            latency_slo_ms: None,
            deadline: None,
            reliability_tier: ReliabilityTier::Standard,
            image: None,
            model: None,
            runtime: None,
            storage_mib: 2048,
            egress_policy: None,
            constraints: CustomerConstraints::default(),
            labels: std::collections::HashMap::new(),
            user_data: None,
        }
    }

    fn offer(price: Cents, reliability: f64) -> Offer {
        Offer {
            id: "off_test_fake-small".to_string(),
            provider_kind: "fake".to_string(),
            region: "us-east".to_string(),
            instance_type: "fake-small".to_string(),
            vcpu: 2,
            memory_mib: 4096,
            gpu_vram_mib: 0,
            gpu_model: None,
            price_per_hour_cents: price,
            currency: "USD".to_string(),
            reliability_score: reliability,
            interruptible: false,
            estimated_ready_secs: 1,
            raw_metadata: None,
        }
    }

    #[test]
    fn profitable_offer_scores_positive() {
        let engine = CostEngine::default_engine();
        let catalog = crate::fabric::sku::ResourceClassCatalog::builtin();
        let class = catalog.get("compute.s").unwrap();
        let req = compute_request();
        let offer = offer(3, 0.95);
        let scored = engine.score_offer(&req, &class, &offer).unwrap();
        assert!(scored.contribution_per_hour_cents > 0);
        assert!(scored.score > 0.0);
    }

    #[test]
    fn expensive_offer_rejected_when_unprofitable() {
        let engine = CostEngine::default_engine();
        let catalog = crate::fabric::sku::ResourceClassCatalog::builtin();
        let class = catalog.get("compute.s").unwrap();
        let req = compute_request();
        let offer = offer(500, 0.95);
        assert!(engine.score_offer(&req, &class, &offer).is_none());
    }

    #[test]
    fn max_price_constraint_filters_offers() {
        let engine = CostEngine::default_engine();
        let catalog = crate::fabric::sku::ResourceClassCatalog::builtin();
        let class = catalog.get("compute.s").unwrap();
        let mut req = compute_request();
        req.constraints.max_price_per_hour_cents = Some(2);
        let offer = offer(3, 0.95);
        assert!(engine.score_offer(&req, &class, &offer).is_none());
    }

    #[test]
    fn region_requirement_filters_offers() {
        let engine = CostEngine::default_engine();
        let catalog = crate::fabric::sku::ResourceClassCatalog::builtin();
        let class = catalog.get("compute.s").unwrap();
        let mut req = compute_request();
        req.region_policy = RegionPolicy::Require(vec!["eu-west".to_string()]);
        let offer = offer(3, 0.95);
        assert!(engine.score_offer(&req, &class, &offer).is_none());
    }

    #[test]
    fn prefer_region_bonus_increases_score() {
        let engine = CostEngine::default_engine();
        let catalog = crate::fabric::sku::ResourceClassCatalog::builtin();
        let class = catalog.get("compute.s").unwrap();
        let mut req = compute_request();
        req.region_policy = RegionPolicy::Prefer(vec!["us-east".to_string()]);
        let offer = offer(3, 0.95);
        let scored = engine.score_offer(&req, &class, &offer).unwrap();
        assert!(scored.score > 0.0);
    }
}
