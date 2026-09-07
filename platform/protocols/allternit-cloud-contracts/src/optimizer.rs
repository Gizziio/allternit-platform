//! Cloud Supply Optimizer contracts.
//!
//! These types and traits define the canonical boundary between the AllternitOS
//! Resource Scheduler and the Cloud Supply Optimizer. Keeping them in this
//! lightweight crate lets provider adapters (`allternitos-cloud-providers`) and
//! the control plane both depend on the same canonical interface without a
//! circular dependency.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{Offer, Placement, ResourceClass};

/// Errors returned by a Cloud Supply Optimizer implementation.
#[derive(Debug, thiserror::Error)]
pub enum SupplyOptimizerError {
    #[error("unknown resource class: {0}")]
    UnknownClass(String),
    #[error("no eligible offers found")]
    NoEligibleOffers,
    #[error("offer {0} is no longer available")]
    OfferUnavailable(String),
    #[error("provider error: {0}")]
    Provider(String),
    #[error("credits error: {0}")]
    Credits(String),
    #[error("provisioning timed out")]
    Timeout,
}

/// Canonical request from the OS Resource Scheduler to the Cloud Supply
/// Optimizer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceRequest {
    /// Canonical request identifier.
    pub request_id: String,
    /// Canonical resource class identifier (e.g. `compute.s`).
    pub resource_class_id: String,
    /// Principal that will own the provisioned resource.
    pub owner: String,
    /// Required region, if any. The optimizer treats this as a hard filter.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
    /// Required ready time; the optimizer may reject offers that cannot meet it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub needed_by: Option<DateTime<Utc>>,
    /// Maximum wholesale price the OS is willing to pay, in minor units.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_price_per_hour_minor_units: Option<u64>,
    /// Currency for `max_price_per_hour_minor_units`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    /// Whether interruptible capacity is acceptable.
    #[serde(default)]
    pub interruptible_ok: bool,
    /// Tags that the optimizer may use for affinity, budget, or policy.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub labels: HashMap<String, String>,
}

/// Result of selecting an offer without provisioning.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectedOffer {
    pub offer: Offer,
    pub score: f64,
}

/// Source of external supplier offers for the optimizer.
#[async_trait::async_trait]
pub trait OfferSource: Send + Sync {
    /// Discover offers matching the request.
    async fn discover_offers(
        &self,
        request: &ResourceRequest,
        catalog: &[ResourceClass],
    ) -> Result<Vec<Offer>, SupplyOptimizerError>;
}

/// Provisioner turns a selected offer into a canonical placement.
#[async_trait::async_trait]
pub trait Provisioner: Send + Sync {
    /// Provision the selected offer and return a canonical placement record.
    async fn provision(
        &self,
        offer_id: &str,
        request: &ResourceRequest,
    ) -> Result<Placement, SupplyOptimizerError>;

    /// Inspect a provisioning placement and return an enriched placement.
    ///
    /// Implementations should query the provider API for runtime details such
    /// as the public endpoint, IP address, and readiness status, and copy them
    /// into the returned `Placement`. The default implementation returns a
    /// clone of the input placement unchanged.
    async fn inspect(&self, placement: &Placement) -> Result<Placement, SupplyOptimizerError> {
        Ok(placement.clone())
    }
}

/// Canonical interface that the OS Resource Scheduler uses when it needs
/// external cloud capacity.
#[async_trait::async_trait]
pub trait CloudSupplyOptimizer: Send + Sync {
    /// Discover and score offers for a request, returning the best eligible
    /// offer without provisioning.
    async fn select_offer(
        &self,
        request: &ResourceRequest,
        catalog: &[ResourceClass],
    ) -> Result<SelectedOffer, SupplyOptimizerError>;

    /// Provision the selected offer and return a canonical placement record.
    ///
    /// The placement must contain a `resource_id` and `provider_resource_id` so
    /// the OS can correlate usage events and lifecycle operations.
    async fn provision(
        &self,
        offer_id: &str,
        request: &ResourceRequest,
    ) -> Result<Placement, SupplyOptimizerError>;

    /// Inspect a provisioning placement and return an enriched placement.
    ///
    /// This lets the OS Resource Scheduler update `Placement.endpoint` and
    /// related fields after the provider reports the instance is reachable. The
    /// default implementation returns a clone of the input placement unchanged.
    async fn inspect(&self, placement: &Placement) -> Result<Placement, SupplyOptimizerError> {
        Ok(placement.clone())
    }
}
