//! Server-side VNC (RFB) password injection for the embed WebSocket proxy.
//!
//! Guest desktops run x11vnc with a driver-known password (shared via
//! `BOT_DESKTOP_VNC_PASSWORD`) so the host-exposed VNC port is not an open
//! desktop. Browser viewers connecting through the authenticated ws proxy
//! never see that password: during the RFB handshake the interceptor rewrites
//! the offered security types to None (RFB 3.8) or answers the DES challenge
//! itself, then becomes a transparent byte pipe for the rest of the session.
//!
//! Bytes flow through [`VncAuthInterceptor::server_bytes`] (guest → viewer)
//! and [`VncAuthInterceptor::client_bytes`] (viewer → guest). Both tolerate
//! arbitrary message fragmentation on their side.

use tracing::warn;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Phase {
    /// Expect the 12-byte server greeting ("RFB 003.008\n"), forwarded as-is.
    ServerGreeting,
    /// Expect the 12-byte client version reply, forwarded as-is.
    ClientVersion,
    /// Expect the server's security-type advertisement.
    ServerSecurity,
    /// RFB 3.8 only: expect the client's 1-byte security-type choice.
    ClientChoice,
    /// Injecting: expect the 16-byte DES challenge, answer it ourselves.
    Challenge,
    /// Injecting: expect the 4-byte SecurityResult, forward it to the client.
    SecurityResult,
    /// Handshake done (or not needed): pass everything through untouched.
    Transparent,
}

/// Stateful RFB handshake interceptor. One instance per proxied connection;
/// both forwarding directions feed it.
pub struct VncAuthInterceptor {
    key: [u8; 8],
    phase: Phase,
    /// Negotiated 3.8 (true) vs 3.3 (false); decided by the client's version reply.
    negotiated_38: bool,
    /// Bytes destined for the server that the interceptor itself produced
    /// (security-type choice, DES response). Drained by the next
    /// [`Self::client_bytes`] call, which always follows because the client
    /// the VNC server until it receives them.
    server_buf: Vec<u8>,
    client_buf: Vec<u8>,
}

/// Result of feeding one chunk through the interceptor: bytes for each
/// direction. `to_server` is non-empty only during the handshake (the
/// proxy-injected security choice and DES response) and must be written to
/// the VNC server immediately — the server will not advance the handshake
/// until it receives them.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct VncPipe {
    pub to_client: Vec<u8>,
    pub to_server: Vec<u8>,
}

impl VncAuthInterceptor {
    pub fn new(password: &str) -> Self {
        Self {
            key: des_key_from_password(password.as_bytes()),
            phase: Phase::ServerGreeting,
            negotiated_38: true,
            server_buf: Vec::new(),
            client_buf: Vec::new(),
        }
    }

    /// Feed bytes arriving from the VNC server.
    pub fn server_bytes(&mut self, chunk: &[u8]) -> Result<VncPipe, String> {
        self.server_buf.extend_from_slice(chunk);
        let mut pipe = VncPipe::default();
        loop {
            match self.phase {
                Phase::ServerGreeting => {
                    if self.server_buf.len() < 12 {
                        break;
                    }
                    let greeting: Vec<u8> = self.server_buf.drain(..12).collect();
                    if &greeting[..3] != b"RFB" {
                        warn!(?greeting, "VNC server sent a non-RFB greeting; passing through");
                        self.phase = Phase::Transparent;
                        continue;
                    }
                    self.phase = Phase::ClientVersion;
                    pipe.to_client.extend_from_slice(&greeting);
                }
                Phase::ServerSecurity => {
                    if self.negotiated_38 {
                        if self.server_buf.is_empty() {
                            break;
                        }
                        let n = self.server_buf[0] as usize;
                        if self.server_buf.len() < 1 + n {
                            break;
                        }
                        let types: Vec<u8> = self.server_buf.drain(..1 + n).skip(1).collect();
                        if n == 0 {
                            // Connection failed by server; reason-length follows.
                            // Forward raw and step aside.
                            pipe.to_client.push(0);
                            self.phase = Phase::Transparent;
                        } else if types.contains(&2) {
                            // Rewrite: offer only None to the viewer.
                            pipe.to_client.extend_from_slice(&[1u8, 1]);
                            self.phase = Phase::ClientChoice;
                        } else {
                            pipe.to_client.push(n as u8);
                            pipe.to_client.extend_from_slice(&types);
                            self.phase = Phase::Transparent;
                        }
                    } else {
                        // RFB 3.3: the server dictates a single u32 security type.
                        if self.server_buf.len() < 4 {
                            break;
                        }
                        let ty = u32::from_be_bytes(self.server_buf[..4].try_into().unwrap());
                        let _ = self.server_buf.drain(..4);
                        if ty == 2 {
                            // Do not tell the client; we will answer the challenge.
                            self.phase = Phase::Challenge;
                        } else {
                            pipe.to_client.extend_from_slice(&ty.to_be_bytes());
                            self.phase = Phase::Transparent;
                        }
                    }
                }
                Phase::Challenge => {
                    if self.server_buf.len() < 16 {
                        break;
                    }
                    let challenge: [u8; 16] = self.server_buf[..16].try_into().unwrap();
                    let _ = self.server_buf.drain(..16);
                    pipe.to_server
                        .extend_from_slice(&vnc_challenge_response(&self.key, &challenge));
                    self.phase = Phase::SecurityResult;
                }
                Phase::SecurityResult => {
                    if self.server_buf.len() < 4 {
                        break;
                    }
                    let result: Vec<u8> = self.server_buf.drain(..4).collect();
                    pipe.to_client.extend_from_slice(&result);
                    self.phase = Phase::Transparent;
                }
                Phase::Transparent => {
                    pipe.to_client.append(&mut self.server_buf);
                    break;
                }
                // Server bytes are not consumed in client-side phases.
                Phase::ClientVersion | Phase::ClientChoice => break,
            }
        }
        Ok(pipe)
    }

    /// Feed bytes arriving from the viewing client.
    pub fn client_bytes(&mut self, chunk: &[u8]) -> Result<VncPipe, String> {
        self.client_buf.extend_from_slice(chunk);
        let mut pipe = VncPipe::default();
        loop {
            match self.phase {
                Phase::ClientVersion => {
                    if self.client_buf.len() < 12 {
                        break;
                    }
                    let version: Vec<u8> = self.client_buf.drain(..12).collect();
                    let minor = std::str::from_utf8(&version[8..11])
                        .ok()
                        .and_then(|s| s.parse::<u32>().ok());
                    match minor {
                        Some(v) => {
                            self.negotiated_38 = v >= 8;
                            self.phase = Phase::ServerSecurity;
                        }
                        None => {
                            warn!(?version, "unparseable client RFB version; passing through");
                            self.phase = Phase::Transparent;
                        }
                    }
                    pipe.to_server.extend_from_slice(&version);
                }
                Phase::ClientChoice => {
                    if self.client_buf.is_empty() {
                        break;
                    }
                    let _choice = self.client_buf.remove(0);
                    // Whatever the viewer picked, authenticate upstream with the
                    // shared guest password on its behalf.
                    pipe.to_server.push(2);
                    self.phase = Phase::Challenge;
                }
                Phase::Transparent => {
                    pipe.to_server.append(&mut self.client_buf);
                    break;
                }
                // Client bytes are not consumed in server-side phases.
                Phase::ServerGreeting | Phase::ServerSecurity | Phase::Challenge
                | Phase::SecurityResult => break,
            }
        }
        Ok(pipe)
    }
}

/// VNC "VNC authentication" key derivation: the password truncated to 8 bytes
/// and NUL-padded, with every byte bit-reversed.
fn des_key_from_password(password: &[u8]) -> [u8; 8] {
    let mut key = [0u8; 8];
    for (i, b) in password.iter().take(8).enumerate() {
        key[i] = b.reverse_bits();
    }
    key
}

/// DES-ECB encrypt the 16-byte challenge with the VNC-derived key, exactly as
/// RFB VNC authentication requires (two independent 8-byte blocks).
fn vnc_challenge_response(key: &[u8; 8], challenge: &[u8; 16]) -> [u8; 16] {
    use cipher::{BlockEncrypt, KeyInit};
    let cipher = des::Des::new_from_slice(key).expect("8-byte DES key");
    let mut out = [0u8; 16];
    for (i, block) in challenge.chunks_exact(8).enumerate() {
        let mut block = cipher::generic_array::GenericArray::clone_from_slice(block);
        cipher.encrypt_block(&mut block);
        out[i * 8..i * 8 + 8].copy_from_slice(&block);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Expected ciphertext computed with OpenSSL:
    /// `openssl enc -des-ecb -K 8636362ea64e7696 -nopad -provider legacy`
    /// where the key is the VNC bit-reversal of the first 8 bytes of
    /// "allternit" ("allterni").
    #[test]
    fn vnc_des_matches_openssl_vector() {
        let key = des_key_from_password(b"allternit");
        assert_eq!(key, [0x86, 0x36, 0x36, 0x2e, 0xa6, 0x4e, 0x76, 0x96]);
        let challenge: [u8; 16] = [
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
            0x0e, 0x0f,
        ];
        let response = vnc_challenge_response(&key, &challenge);
        assert_eq!(
            response.to_vec(),
            hex("1fc39bcb49906faf8b987e8f06a3b2f3")
        );
    }

    /// Full RFB 3.8 handshake with a password-protected server, byte-at-a-time
    /// fragmentation, asserting the viewer is offered only None and the DES
    /// response never reaches it.
    #[test]
    fn handshake_38_injects_password_auth() {
        let mut i = VncAuthInterceptor::new("allternit");
        let greeting = b"RFB 003.008\n";

        // Server greeting arrives split across two chunks.
        assert_eq!(i.server_bytes(&greeting[..5]).unwrap(), VncPipe::default());
        let p = i.server_bytes(&greeting[5..]).unwrap();
        assert_eq!(p.to_client, greeting);

        // Client version reply.
        let p = i.client_bytes(b"RFB 003.008\n").unwrap();
        assert_eq!(p.to_server, b"RFB 003.008\n");
        assert!(p.to_client.is_empty());

        // Server offers only VNC password auth (type 2); viewer must see None.
        let p = i.server_bytes(&[1, 2]).unwrap();
        assert_eq!(p.to_client, vec![1, 1]);
        assert!(p.to_server.is_empty());

        // Viewer picks None; proxy must instead choose type 2 upstream.
        let p = i.client_bytes(&[1]).unwrap();
        assert_eq!(p.to_server, vec![2]);

        // Challenge is answered immediately, server-side, never to the client.
        let challenge = [0xABu8; 16];
        let p = i.server_bytes(&challenge).unwrap();
        assert!(p.to_client.is_empty());
        assert_eq!(p.to_server.len(), 16);
        assert_ne!(p.to_server, challenge);

        // SecurityResult passes through, then the pipe goes transparent.
        let p = i.server_bytes(&[0, 0, 0, 0]).unwrap();
        assert_eq!(p.to_client, vec![0, 0, 0, 0]);
        let p = i.server_bytes(b"rest").unwrap();
        assert_eq!(p.to_client, b"rest");
        let p = i.client_bytes(&[1]).unwrap();
        assert_eq!(p.to_server, vec![1]);
    }

    /// Server that already offers None is passed through untouched.
    #[test]
    fn handshake_38_passthrough_when_none_offered() {
        let mut i = VncAuthInterceptor::new("allternit");
        i.server_bytes(b"RFB 003.008\n").unwrap();
        i.client_bytes(b"RFB 003.008\n").unwrap();
        let p = i.server_bytes(&[1, 1]).unwrap();
        assert_eq!(p.to_client, vec![1, 1]);
        // Viewer picks None, forwarded as-is.
        let p = i.client_bytes(&[1]).unwrap();
        assert_eq!(p.to_server, vec![1]);
    }

    /// RFB 3.3: server dictates type 2; proxy answers the challenge silently.
    #[test]
    fn handshake_33_injects_password_auth() {
        let mut i = VncAuthInterceptor::new("allternit");
        i.server_bytes(b"RFB 003.003\n").unwrap();
        i.client_bytes(b"RFB 003.003\n").unwrap();
        // Server dictates u32 type 2; nothing forwarded to the client yet.
        let p = i.server_bytes(&[0, 0, 0, 2]).unwrap();
        assert_eq!(p, VncPipe::default());
        // Challenge consumed, DES response produced in the same step.
        let p = i.server_bytes(&[0xCD; 16]).unwrap();
        assert!(p.to_client.is_empty());
        assert_eq!(p.to_server.len(), 16);
        // SecurityResult forwarded, then transparent.
        let p = i.server_bytes(&[0, 0, 0, 0]).unwrap();
        assert_eq!(p.to_client, vec![0, 0, 0, 0]);
    }

    #[test]
    fn key_derivation_pads_short_passwords() {
        // 'a' (0x61) bit-reversed is 0x86; the rest is zero padding.
        assert_eq!(des_key_from_password(b"ab"), [0x86, 0x46, 0, 0, 0, 0, 0, 0]);
    }

    /// Regression: the read-only filter must observe EVERY byte the VNC server
    /// receives — including the proxy-injected type-2 choice and DES response,
    /// which are produced from the server-side task — or its handshake state
    /// desynchronizes and it eats the client's post-handshake messages. This
    /// simulates the exact interleaving the ws proxy produces.
    #[test]
    fn chained_with_readonly_filter_clientinit_survives() {
        let mut auth = VncAuthInterceptor::new("allternit");
        let mut filter = crate::vnc_readonly::RfbReadOnlyFilter::new();

        // Server greeting first (the client waits for it before speaking).
        let p = auth.server_bytes(b"RFB 003.008\n").unwrap();
        assert_eq!(p.to_client, b"RFB 003.008\n");

        // Client version -> filter.
        let p = auth.client_bytes(b"RFB 003.008\n").unwrap();
        assert_eq!(filter.feed(&p.to_server), b"RFB 003.008\n");

        // Server offers type 2 -> client sees rewritten None offer.
        let p = auth.server_bytes(&[1, 2]).unwrap();
        assert_eq!(p.to_client, vec![1, 1]);

        // Client picks None -> proxy injects type 2 -> filter must see it.
        let p = auth.client_bytes(&[1]).unwrap();
        assert_eq!(filter.feed(&p.to_server), vec![2]);

        // Challenge -> proxy injects DES response -> filter must see it too.
        let p = auth.server_bytes(&[0x11; 16]).unwrap();
        assert!(p.to_client.is_empty());
        assert_eq!(filter.feed(&p.to_server).len(), 16);

        // SecurityResult forwarded to the client.
        let p = auth.server_bytes(&[0, 0, 0, 0]).unwrap();
        assert_eq!(p.to_client, vec![0, 0, 0, 0]);

        // The client's ClientInit must pass the filter (previously eaten as a
        // phantom auth-response byte), and post-handshake a KeyEvent must not.
        let p = auth.client_bytes(&[1]).unwrap();
        assert_eq!(filter.feed(&p.to_server), vec![1]);
        let key = [4u8, 0, 0, 0, 0, 0x61, 0, 1];
        let p = auth.client_bytes(&key).unwrap();
        assert!(filter.feed(&p.to_server).is_empty());
        assert!(!filter.unfilterable());
    }

    fn hex(s: &str) -> Vec<u8> {
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }
}
