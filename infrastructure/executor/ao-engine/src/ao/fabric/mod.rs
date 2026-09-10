//! ao Fabric Transport node (P3, spec: Allternit Brain/Research/specs/
//! ao-fabric-node.md; spike: Research/drafts/spike-p3-clerk-device-auth.md).
//!
//! Makes the `ao` binary a pairable Fabric node: `ao fabric pair|serve|status`.
//! Pairing is Allternit's own 3-leg Ed25519 protocol (the node never holds a
//! Clerk token); `serve` runs the loopback HTTP+WS shim (this binary, port
//! 8014 default) plus a line-faithful Rust port of cmd/agent-daemon's relay
//! client so the cloud can tunnel PWA session-pickup traffic to the engine
//! socket API (session `ao`).

pub(crate) mod cli;
pub(crate) mod cloud;
pub(crate) mod identity;
pub(crate) mod relay;
pub(crate) mod shim;
pub(crate) mod wire;

pub(crate) const DEFAULT_AO_PORT: u16 = 8014;

/// Default loopback gateway the relay client forwards tunneled traffic to
/// (the shim). Distinct from Desktop's 8013 so both can coexist (spike Q5.5).
pub(crate) fn local_gateway_url() -> String {
    std::env::var("ALLTERNIT_AO_GATEWAY_URL")
        .unwrap_or_else(|_| format!("http://127.0.0.1:{DEFAULT_AO_PORT}"))
        .trim_end_matches('/')
        .to_string()
}

pub(crate) fn cloud_api_url() -> String {
    std::env::var("ALLTERNIT_CLOUD_API_URL")
        .unwrap_or_else(|_| "https://api.allternit.com".to_string())
        .trim_end_matches('/')
        .to_string()
}
