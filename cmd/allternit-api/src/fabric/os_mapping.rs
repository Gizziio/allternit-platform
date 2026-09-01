//! Cloud-to-AllternitOS canonical contract mapping.
//!
//! This module imports the canonical AllternitOS Layer 1 contracts from
//! `allternitos-cloud-contracts` and provides conversion functions from Cloud
//! storage shapes into those canonical types. Cloud no longer defines parallel
//! view structs for Assignment, Placement, and UsageEvent.
//!
//! Cloud-specific product types (e.g. `ModelRequest`) remain here when they are
//! not part of the canonical OS contract surface.
//!
//! ## ID prefixes
//!
//! Cloud storage uses plain UUIDs for its own rows. When converting to the OS
//! view we prepend canonical prefixes so downstream consumers can distinguish
//! object kinds without parsing the payload:
//!
//! - `node_`  -> `NodeCapabilityRecord`
//! - `plc_`   -> `Placement`
//! - `asg_`   -> `Assignment`
//! - `uev_`   -> `UsageEvent`
//! - `off_`   -> `Offer`
//!
//! ## Gaps
//!
//! Cloud enrollment records do not yet capture the full hardware/software/
//! capability attestation that an AllternitOS node daemon provides. Required
//! canonical fields are filled from enrollment metadata with safe defaults and
//! documented below; these records are partial until the node daemon becomes the
//! source of truth.

use crate::fabric::model_catalog::FabricModelRecord;
use crate::fabric::node_registry::{FabricNodeRecord, NodeCapacity};

use crate::fabric::sku::ResourceClass as CloudResourceClass;
use crate::fabric_model_routes::ResponsesRequest;
use allternitos_cloud_contracts as contracts;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Canonical prefix applied to a Cloud UUID when exporting to the OS view.
pub fn with_prefix(id: &str, prefix: &str) -> String {
    if id.starts_with(prefix) {
        id.to_string()
    } else {
        format!("{prefix}{id}")
    }
}

/// Convert a Cloud node enrollment record into a canonical `NodeCapabilityRecord`.
///
/// Required canonical fields that Cloud does not yet store are filled with safe
/// defaults so the record validates against the canonical schema. The record
/// should be treated as partial; once the node daemon reports full capability
/// data, AllternitOS becomes the source of truth and Cloud should consume the
/// OS record instead.
pub fn node_capability_record_from_fabric_node(
    node: &FabricNodeRecord,
    capacity: &NodeCapacity,
) -> contracts::NodeCapabilityRecord {
    let node_id = with_prefix(&node.id, "node_");
    let recorded_at = node.last_heartbeat_at.unwrap_or(node.created_at);
    let wireguard_public_key = node
        .identity_fingerprint
        .clone()
        .unwrap_or_else(|| "pending_enrollment".to_string());

    contracts::NodeCapabilityRecord {
        schema_version: "1.0.0".to_string(),
        node_id,
        recorded_at,
        hardware: contracts::NodeHardware {
            cpu: contracts::CpuInfo {
                vendor: "unknown".to_string(),
                model: "unknown".to_string(),
                cores: capacity.total_vcpu.max(1) as u32,
                threads: capacity.total_vcpu.max(1) as u32,
                sockets: None,
                base_frequency_mhz: None,
                flags: Vec::new(),
                numa_nodes: None,
            },
            memory: contracts::MemoryInfo {
                total_bytes: (capacity.total_memory_mib.max(1) as u64) * 1_048_576,
                memory_type: "unknown".to_string(),
                speed_mhz: None,
                channels: None,
                measured_bandwidth_gbps: None,
            },
            storage: Vec::new(),
            network: Vec::new(),
        },
        accelerators: Vec::new(),
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
            wireguard_public_key,
            fabric_address: None,
            region: node.region.clone(),
            zone: None,
            rack: None,
            role: Some("cloud".to_string()),
            join_token_hash: node.enrollment_token_hash.clone(),
        },
        measured_bandwidth: contracts::MeasuredBandwidth::default(),
        health: contracts::NodeHealth {
            status: node.status.as_str().to_string(),
            last_checked_at: node.last_heartbeat_at,
            alerts: Vec::new(),
        },
        workers: contracts::Workers::default(),
    }
}

/// Convert a Cloud SKU into a canonical `ResourceClass`.
pub fn resource_class_from_cloud(class: &CloudResourceClass) -> contracts::ResourceClass {
    let id = with_prefix(&class.id, "res_");
    let version = "1.0.0".to_string();
    let kind = class.kind.to_string();
    let class_name = class.class.clone();
    let reliability_tier = class.reliability_tier.to_string();

    contracts::ResourceClass {
        id,
        version,
        kind: kind.clone(),
        class: class_name.clone(),
        display_name: class.display_name.clone(),
        description: None,
        owner: "cloud_catalog".to_string(),
        reliability_tier,
        requirements: contracts::Requirements {
            min_vcpu: Some(class.vcpu),
            min_memory_mib: Some(class.memory_mib),
            min_gpu_vram_mib: Some(class.gpu_vram_mib),
            gpu_model: None,
            network: None,
            storage_mib: None,
        },
        retail_price_per_hour: Some(contracts::Money {
            currency: "USD".to_string(),
            minor_units: class.retail_price_per_hour_cents.max(0) as u64,
        }),
        retail_price_per_request: Some(contracts::Money {
            currency: "USD".to_string(),
            minor_units: class.retail_price_per_request_cents.max(0) as u64,
        })
        .filter(|m| m.minor_units > 0),
        retail_price_per_token: Some(contracts::Money {
            currency: "USD".to_string(),
            minor_units: class.retail_price_per_token_cents.max(0) as u64,
        })
        .filter(|m| m.minor_units > 0),
        capabilities: Vec::new(),
        created_at: Utc::now(),
        updated_at: None,
        labels: HashMap::from([(
            "cloud_full_class".to_string(),
            format!("{}.{}", kind, class_name),
        )]),
    }
}

/// Convert a Cloud provider offer into a canonical `Offer`.
///
/// `resource_class_id` is the canonical class id (e.g. `res_compute.s`). Cloud
/// offers do not carry this directly because they come from external provider
/// APIs, so callers must supply the class the offer is satisfying.
pub fn offer_from_cloud_offer(
    offer: &allternit_computer_cloud::fabric::Offer,
    resource_class_id: &str,
) -> contracts::Offer {
    // Cloud offers do not have a stable Cloud-side UUID; derive a stable
    // synthetic ID from provider + region + instance type + interruptibility.
    let synthetic_id = format!(
        "{}:{}:{}:{}",
        offer.provider_kind, offer.region, offer.instance_type, offer.interruptible
    );

    contracts::Offer {
        id: with_prefix(&synthetic_id, "off_"),
        provider_kind: offer.provider_kind.clone(),
        region: offer.region.clone(),
        instance_type: offer.instance_type.clone(),
        resource_class_id: with_prefix(resource_class_id, "res_"),
        vcpu: offer.vcpu,
        memory_mib: offer.memory_mib,
        gpu_vram_mib: offer.gpu_vram_mib,
        gpu_model: offer.gpu_model.clone(),
        price_per_hour: offer.price_per_hour_cents.max(0) as u64,
        currency: offer.currency.clone(),
        reliability_score: offer.reliability_score,
        interruptible: offer.interruptible,
        estimated_ready_secs: offer.estimated_ready_secs,
        available_until: Utc::now() + Duration::hours(1),
        raw_metadata: offer.raw_metadata.clone().and_then(|v| v.as_object().cloned()),
        labels: HashMap::new(),
    }
}

/// Convert a Cloud usage event (internal usage module) into a canonical
/// `UsageEvent`.
pub fn usage_event_from_cloud_usage_event(
    event: &crate::fabric::usage::UsageEvent,
) -> contracts::UsageEvent {
    let mut metadata = serde_json::Map::new();
    if let Some(cost_event_id) = &event.cost_event_id {
        metadata.insert(
            "cost_event_id".to_string(),
            serde_json::Value::String(cost_event_id.clone()),
        );
    }

    contracts::UsageEvent {
        id: with_prefix(&event.id, "uev_"),
        resource_id: with_prefix(&event.resource_id, "res_"),
        placement_id: event.placement_id.as_ref().map(|id| with_prefix(id, "plc_")),
        node_id: None,
        event_type: event.event_type.clone(),
        quantity: event.quantity,
        unit: event.unit.clone(),
        measured_at: event.measured_at,
        processed_at: event.processed_at,
        cost_event_id: event.cost_event_id.clone(),
        metadata,
        created_at: None,
        labels: HashMap::new(),
    }
}

/// Cloud `ModelRequest` — not a canonical OS contract.
///
/// Derived from the Model Gateway `/v1/responses` request. This is a Cloud
/// product input shape that will become an OS workload/model intent once the
/// canonical control-plane workload API is wired end-to-end.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRequest {
    pub request_id: String,
    pub model_full_id: String,
    pub input_message_count: usize,
    pub max_tokens: u32,
    pub temperature: Option<f32>,
    pub estimated_input_tokens: u32,
    pub budget_cents: Option<i64>,
    /// Canonical OS fields that are not yet populated by Cloud.
    pub missing: Vec<String>,
}

impl ModelRequest {
    pub(crate) fn from_responses_request(
        request_id: &str,
        req: &ResponsesRequest,
        model: Option<&FabricModelRecord>,
    ) -> Self {
        let input_message_count = req.messages.len();
        let estimated_input_tokens = req
            .messages
            .iter()
            .map(|m| (m.content.len() / 4).max(1) as u32 + 3)
            .sum::<u32>()
            .max(1);
        let budget_cents = model.map(|m| {
            let input = ((estimated_input_tokens as i64) * m.input_cents_per_1m + 999_999) / 1_000_000;
            let output = ((req.max_tokens.unwrap_or(150).max(1) as i64) * m.output_cents_per_1m + 999_999)
                / 1_000_000;
            input + output
        });
        Self {
            request_id: request_id.to_string(),
            model_full_id: req.model.clone(),
            input_message_count,
            max_tokens: req.max_tokens.unwrap_or(150).clamp(1, model.map(|m| m.context_tokens.max(1)).unwrap_or(150)),
            temperature: req.temperature,
            estimated_input_tokens,
            budget_cents,
            missing: vec![
                "workload_id".to_string(),
                "step_id".to_string(),
                "lease_id".to_string(),
                "execution_plan".to_string(),
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fabric::node_registry::{FabricNodeStatus};
    use crate::fabric::usage::UsageEvent as CloudUsageEvent;
    use chrono::Utc;
    use std::collections::HashMap;

    fn sample_node() -> (FabricNodeRecord, NodeCapacity) {
        let node = FabricNodeRecord {
            id: "n1".to_string(),
            organization_id: "org-1".to_string(),
            display_name: Some("sample".to_string()),
            status: FabricNodeStatus::Active,
            region: Some("us-east".to_string()),
            identity_fingerprint: Some("fp".to_string()),
            enrollment_token_hash: None,
            node_token_hash: None,
            labels: HashMap::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            approved_at: None,
            last_heartbeat_at: Some(Utc::now()),
        };
        let capacity = NodeCapacity {
            total_vcpu: 8,
            total_memory_mib: 16384,
            total_gpu_vram_mib: 0,
            gpu_model: None,
            free_vcpu: 6,
            free_memory_mib: 12288,
            free_gpu_vram_mib: 0,
        };
        (node, capacity)
    }

    #[test]
    fn node_capability_record_gets_prefixed_id_and_required_defaults() {
        let (node, capacity) = sample_node();
        let record = node_capability_record_from_fabric_node(&node, &capacity);
        assert_eq!(record.node_id, "node_n1");
        assert_eq!(record.schema_version, "1.0.0");
        assert_eq!(record.hardware.cpu.cores, 8);
        assert_eq!(record.fabric.wireguard_public_key, "fp");
        // Must serialize to valid JSON without panicking.
        let _ = serde_json::to_value(&record).unwrap();
    }

    #[test]
    fn resource_class_mapping_prefixes_id_and_serializes() {
        let class = CloudResourceClass {
            id: "compute.s".to_string(),
            kind: allternit_computer_cloud::fabric::ResourceKind::Compute,
            class: "s".to_string(),
            display_name: "Compute S".to_string(),
            vcpu: 1,
            memory_mib: 2048,
            gpu_vram_mib: 0,
            reliability_tier: allternit_computer_cloud::fabric::ReliabilityTier::Standard,
            retail_price_per_hour_cents: 5,
            retail_price_per_request_cents: 0,
            retail_price_per_token_cents: 0,
        };
        let mapped = resource_class_from_cloud(&class);
        assert_eq!(mapped.id, "res_compute.s");
        assert_eq!(mapped.kind, "compute");
        let json = serde_json::to_value(&mapped).unwrap();
        assert_eq!(json["owner"], "cloud_catalog");
        assert_eq!(json["retail_price_per_hour"]["minor_units"], 5);
    }

    #[test]
    fn offer_mapping_uses_synthetic_id_and_resource_class() {
        let offer = allternit_computer_cloud::fabric::Offer {
            id: "off_test_small".to_string(),
            provider_kind: "fake".to_string(),
            region: "us-east".to_string(),
            instance_type: "small".to_string(),
            vcpu: 2,
            memory_mib: 4096,
            gpu_vram_mib: 0,
            gpu_model: None,
            price_per_hour_cents: 3,
            currency: "USD".to_string(),
            reliability_score: 0.95,
            interruptible: false,
            estimated_ready_secs: 1,
            raw_metadata: None,
        };
        let mapped = offer_from_cloud_offer(&offer, "compute.s");
        assert!(mapped.id.starts_with("off_"));
        assert_eq!(mapped.resource_class_id, "res_compute.s");
        let json = serde_json::to_value(&mapped).unwrap();
        assert_eq!(json["provider_kind"], "fake");
    }

    #[test]
    fn usage_event_mapping_prefixes_ids_and_serializes() {
        let event = CloudUsageEvent {
            id: "uev-uuid".to_string(),
            resource_id: "res-uuid".to_string(),
            placement_id: Some("plc-uuid".to_string()),
            event_type: "compute_seconds".to_string(),
            quantity: 60.0,
            unit: "seconds".to_string(),
            measured_at: Utc::now(),
            cost_event_id: Some("cev-uuid".to_string()),
            processed_at: None,
        };
        let mapped = usage_event_from_cloud_usage_event(&event);
        assert!(mapped.id.starts_with("uev_"));
        assert!(mapped.resource_id.starts_with("res_"));
        assert!(mapped.placement_id.as_ref().unwrap().starts_with("plc_"));
        assert_eq!(
            mapped.metadata.get("cost_event_id").unwrap(),
            &serde_json::Value::String("cev-uuid".to_string())
        );
        let _ = serde_json::to_value(&mapped).unwrap();
    }
}
