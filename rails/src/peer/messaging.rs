//! High-level peer messaging helpers that enqueue messages on the Bus for
//! UDS/bridge delivery.

use anyhow::{bail, Context, Result};
use serde_json::{json, Value};

use crate::bus::{Bus, NewBusMessage};
use crate::core::ids::create_event_id;
use crate::peer::registry::PeerRegistry;
use crate::peer::types::{PeerAddress, PeerMessage};

/// Send a message to a peer by id.  The peer must have a resolvable address
/// (Uds or Bridge); Mail addresses fall back to the regular Mail subsystem and
/// are rejected here.
pub async fn send_to_peer(
    registry: &PeerRegistry,
    bus: &Bus,
    from_peer: &str,
    to_peer: &str,
    kind: &str,
    payload: Value,
) -> Result<i64> {
    let peer = registry
        .get(to_peer)
        .await?
        .with_context(|| format!("peer {} not found", to_peer))?;

    let (transport, recipient) = match &peer.address {
        PeerAddress::Uds { socket_path } => {
            ("uds".to_string(), socket_path.display().to_string())
        }
        PeerAddress::Bridge { endpoint } => ("bridge".to_string(), endpoint.clone()),
        PeerAddress::Mail { .. } => {
            bail!("peer {} uses mail address; use Mail::send_typed_message instead", to_peer);
        }
    };

    let peer_message = PeerMessage {
        from_peer: from_peer.to_string(),
        to_peer: to_peer.to_string(),
        correlation_id: create_event_id(),
        kind: kind.to_string(),
        payload,
    };

    bus.send_message(NewBusMessage {
        correlation_id: peer_message.correlation_id.clone(),
        to: recipient,
        from: from_peer.to_string(),
        kind: kind.to_string(),
        payload: json!(peer_message),
        transport,
    })
    .await
}
