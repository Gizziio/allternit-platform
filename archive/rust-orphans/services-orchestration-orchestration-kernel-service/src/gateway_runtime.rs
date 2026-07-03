use anyhow::Context;
use chrono::Utc;
use data_encoding::HEXLOWER;
use ring::digest;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const GATEWAY_REGISTRY_PATH: &str = "infra/gateway/gateway_registry.json";

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GatewayRegistry {
    pub version: String,
    pub external_ingress: ExternalIngress,
    pub services: Vec<ServiceEntry>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ExternalIngress {
    pub id: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub protocol: String,
    pub routes: Vec<RouteDefinition>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RouteDefinition {
    pub path_prefix: String,
    pub service: String,
    #[serde(default)]
    pub methods: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServiceEntry {
    pub name: String,
    pub internal_url: String,
    pub exposed: bool,
}

#[derive(Debug, Clone)]
pub struct ResolvedRoute {
    pub gateway_id: String,
    pub route_id: String,
    pub service: String,
    pub upstream_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GatewayRoutingReceipt {
    pub receipt_id: String,
    pub created_at: String,
    pub gateway_id: String,
    pub route_id: String,
    pub service: String,
    pub upstream_url: String,
    pub status_code: u16,
    pub trace_id: String,
    pub run_id: String,
    pub requested_route_name: String,
    pub resolved_target: String,
    pub decision: String,
    pub registry_hash: String,
    pub input_hash: String,
}

pub fn load_gateway_registry() -> anyhow::Result<GatewayRegistry> {
    let data = fs::read_to_string(GATEWAY_REGISTRY_PATH)
        .with_context(|| format!("Gateway registry missing: {}", GATEWAY_REGISTRY_PATH))?;
    let registry: GatewayRegistry = serde_json::from_str(&data)
        .with_context(|| format!("Gateway registry invalid JSON: {}", GATEWAY_REGISTRY_PATH))?;
    validate_registry(&registry)?;
    Ok(registry)
}

fn validate_registry(registry: &GatewayRegistry) -> anyhow::Result<()> {
    if registry.external_ingress.routes.is_empty() {
        anyhow::bail!("Gateway registry has no external routes");
    }
    for route in &registry.external_ingress.routes {
        let found = registry
            .services
            .iter()
            .any(|svc| svc.name == route.service);
        if !found {
            anyhow::bail!(
                "Gateway registry route references unknown service {}",
                route.service
            );
        }
    }
    Ok(())
}

fn is_direct_internal_target(route_name: &str) -> bool {
    route_name.contains("://") || route_name.contains('/') || route_name.contains(':')
}

pub fn resolve_route(
    registry: &GatewayRegistry,
    route_name: &str,
    path: &str,
    method: &str,
) -> anyhow::Result<ResolvedRoute> {
    if is_direct_internal_target(route_name) {
        anyhow::bail!("Direct internal route is forbidden: {}", route_name);
    }
    let service = registry
        .services
        .iter()
        .find(|svc| svc.name == route_name)
        .ok_or_else(|| anyhow::anyhow!("Unknown route name: {}", route_name))?;
    let route = registry
        .external_ingress
        .routes
        .iter()
        .find(|route| {
            route.service == route_name
                && path.starts_with(&route.path_prefix)
                && (route.methods.is_empty()
                    || route.methods.iter().any(|m| m.eq_ignore_ascii_case(method)))
        })
        .ok_or_else(|| anyhow::anyhow!("No matching gateway route for {}", route_name))?;
    Ok(ResolvedRoute {
        gateway_id: registry.external_ingress.id.clone(),
        route_id: format!("{}:{}", route_name, route.path_prefix),
        service: route_name.to_string(),
        upstream_url: service.internal_url.clone(),
    })
}

fn hash_bytes(data: &[u8]) -> String {
    let digest = digest::digest(&digest::SHA256, data);
    HEXLOWER.encode(digest.as_ref())
}

fn write_receipt(run_id: &str, receipt: &GatewayRoutingReceipt) -> anyhow::Result<PathBuf> {
    if run_id.trim().is_empty() {
        anyhow::bail!("run_id required for gateway receipts");
    }
    let receipts_dir = Path::new(".allternit/receipts").join(run_id);
    fs::create_dir_all(&receipts_dir)?;
    let path = receipts_dir.join(format!("{}.json", receipt.receipt_id));
    let data = serde_json::to_vec_pretty(receipt)?;
    fs::write(&path, data)?;
    Ok(path)
}

pub fn route_request_and_record(
    registry: &GatewayRegistry,
    route_name: &str,
    path: &str,
    method: &str,
    run_id: &str,
    trace_id: &str,
) -> anyhow::Result<GatewayRoutingReceipt> {
    let registry_hash = hash_bytes(serde_json::to_vec(registry)?.as_slice());
    let input_hash = hash_bytes(format!("{}|{}|{}", route_name, path, method).as_bytes());

    let resolved = resolve_route(registry, route_name, path, method);
    let decision = if resolved.is_ok() { "allow" } else { "deny" };
    let status_code = if resolved.is_ok() { 200 } else { 403 };

    let (route_id, service, upstream_url, resolved_target) = match resolved {
        Ok(route) => (
            route.route_id,
            route.service,
            route.upstream_url.clone(),
            route.upstream_url,
        ),
        Err(_) => (
            route_name.to_string(),
            route_name.to_string(),
            String::new(),
            String::new(),
        ),
    };

    let receipt = GatewayRoutingReceipt {
        receipt_id: format!("gateway-{}", Uuid::new_v4()),
        created_at: Utc::now().to_rfc3339(),
        gateway_id: registry.external_ingress.id.clone(),
        route_id,
        service,
        upstream_url,
        status_code,
        trace_id: trace_id.to_string(),
        run_id: run_id.to_string(),
        requested_route_name: route_name.to_string(),
        resolved_target,
        decision: decision.to_string(),
        registry_hash,
        input_hash,
    };

    write_receipt(run_id, &receipt)?;

    if decision == "deny" {
        anyhow::bail!("Gateway routing denied for {}", route_name);
    }

    Ok(receipt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gateway_registry_runtime_load() {
        let registry = load_gateway_registry().expect("registry should load");
        assert!(!registry.services.is_empty());
        assert!(!registry.external_ingress.routes.is_empty());
    }

    #[test]
    fn test_gateway_rejects_direct_internal_route() {
        let registry = load_gateway_registry().expect("registry should load");
        let err = resolve_route(&registry, "http://kernel", "/", "GET")
            .expect_err("direct internal route should be rejected");
        assert!(err.to_string().contains("Direct internal route"));
    }

    #[test]
    fn test_gateway_routing_receipt_emitted() {
        let registry = load_gateway_registry().expect("registry should load");
        let run_id = format!("test-run-{}", Uuid::new_v4());
        let trace_id = "trace-test";
        let receipt = route_request_and_record(&registry, "kernel", "/", "GET", &run_id, trace_id)
            .expect("routing should succeed");
        let path = Path::new(".allternit/receipts")
            .join(&run_id)
            .join(format!("{}.json", receipt.receipt_id));
        assert!(path.exists());
        let _ = fs::remove_dir_all(Path::new(".allternit/receipts").join(&run_id));
    }
}
