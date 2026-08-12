//! MCP tunnel security scaffold — mTLS + OAuth validation helpers.
//!
//! This module is intentionally narrow: it stores a per-tunnel auth policy and
//! provides offline validation routines. It does NOT perform network calls to
//! verify OAuth tokens; callers that need live introspection should do so on
//! top of the issuer/audience checks provided here.

use rusqlite::{params, OptionalExtension};
use sha2::{Digest, Sha256};

use crate::db::DbHandle;

/// Per-tunnel security policy. At least one of `client_cert_pem` or
/// `oauth_issuer` should be set for the policy to be meaningful.
#[derive(Debug, Clone, PartialEq)]
pub struct McpTunnelAuth {
    pub tunnel_id: String,
    pub client_cert_pem: Option<String>,
    pub oauth_issuer: Option<String>,
    pub audience: Option<String>,
}

impl McpTunnelAuth {
    /// True when the policy requires a client-certificate thumbprint check.
    pub fn requires_mtls(&self) -> bool {
        self.client_cert_pem.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
    }

    /// True when the policy requires an OAuth issuer (and optionally audience)
    /// check.
    pub fn requires_oauth(&self) -> bool {
        self.oauth_issuer.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
    }
}

/// Load the tunnel auth policy for `tunnel_id`, if any.
pub fn load_tunnel_auth(
    db: &DbHandle,
    tunnel_id: &str,
) -> Result<Option<McpTunnelAuth>, rusqlite::Error> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT tunnel_id, client_cert_pem, oauth_issuer, audience
         FROM mcp_tunnel_auth WHERE tunnel_id = ?1",
    )?;
    let row = stmt
        .query_row(params![tunnel_id], |row| {
            Ok(McpTunnelAuth {
                tunnel_id: row.get(0)?,
                client_cert_pem: row.get(1)?,
                oauth_issuer: row.get(2)?,
                audience: row.get(3)?,
            })
        })
        .optional()?;
    Ok(row)
}

/// Compute a SHA-256 hex thumbprint of the first certificate found in a PEM
/// bundle. The thumbprint is the hex-encoded SHA-256 digest of the certificate
/// DER bytes (uppercase, colon-free), matching `openssl x509 -sha256 -fingerprint`.
///
/// Errors are returned as strings for easy use from route handlers.
pub fn client_cert_thumbprint(pem: &str) -> Result<String, String> {
    let mut cursor = std::io::Cursor::new(pem.trim().as_bytes());
    let certs = rustls_pemfile::certs(&mut cursor)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to parse client certificate PEM: {e}"))?;

    let cert = certs
        .into_iter()
        .next()
        .ok_or_else(|| "No certificate found in PEM".to_string())?;

    let mut hasher = Sha256::new();
    hasher.update(&cert);
    Ok(hex::encode(hasher.finalize()).to_uppercase())
}

/// Normalize an issuer string for comparison. Trims whitespace and strips a
/// trailing slash so `https://issuer.example` and `https://issuer.example/`
/// compare equal.
fn normalize_issuer(issuer: &str) -> String {
    issuer.trim().trim_end_matches('/').to_lowercase()
}

/// Validate that `token_issuer` matches the configured `allowed_issuer`.
/// Returns true when both normalized values are equal.
pub fn validate_oauth_issuer(token_issuer: &str, allowed_issuer: &str) -> bool {
    normalize_issuer(token_issuer) == normalize_issuer(allowed_issuer)
}

/// Validate that `token_audience` matches the configured `audience`, if an
/// audience is configured. An unset audience means any audience is accepted.
pub fn validate_oauth_audience(token_audience: Option<&str>, allowed_audience: Option<&str>) -> bool {
    match allowed_audience {
        None => true,
        Some(allowed) if allowed.trim().is_empty() => true,
        Some(allowed) => token_audience.map(|a| a.trim()) == Some(allowed.trim()),
    }
}

/// Result of validating a request against a tunnel auth policy.
#[derive(Debug, Clone, PartialEq)]
pub enum TunnelAuthResult {
    Allowed,
    MissingCert,
    CertMismatch,
    MissingIssuer,
    IssuerMismatch,
    AudienceMismatch,
}

impl TunnelAuthResult {
    /// Human-readable reason for logging or error responses.
    pub fn reason(&self) -> &'static str {
        match self {
            TunnelAuthResult::Allowed => "allowed",
            TunnelAuthResult::MissingCert => "missing client certificate",
            TunnelAuthResult::CertMismatch => "client certificate thumbprint mismatch",
            TunnelAuthResult::MissingIssuer => "missing OAuth issuer",
            TunnelAuthResult::IssuerMismatch => "OAuth issuer mismatch",
            TunnelAuthResult::AudienceMismatch => "OAuth audience mismatch",
        }
    }

    pub fn is_allowed(&self) -> bool {
        matches!(self, TunnelAuthResult::Allowed)
    }
}

/// Validate an incoming MCP tunnel request against the stored policy.
///
/// - `client_thumbprint`: SHA-256 thumbprint presented by the mTLS terminator
///   (or extracted from a PEM in a header). None when the request did not
///   present a client certificate.
/// - `token_issuer`: `iss` claim from the OAuth bearer token, if available.
/// - `token_audience`: `aud` claim from the OAuth bearer token, if available.
///
/// The function is fail-closed: any configured check that is not satisfied
/// returns the corresponding failure variant.
pub fn validate_tunnel_request(
    auth: &McpTunnelAuth,
    client_thumbprint: Option<&str>,
    token_issuer: Option<&str>,
    token_audience: Option<&str>,
) -> TunnelAuthResult {
    if auth.requires_mtls() {
        let expected = match auth.client_cert_pem.as_deref() {
            Some(pem) => match client_cert_thumbprint(pem) {
                Ok(thp) => thp,
                Err(_) => return TunnelAuthResult::CertMismatch,
            },
            None => return TunnelAuthResult::MissingCert,
        };
        match client_thumbprint {
            None => return TunnelAuthResult::MissingCert,
            Some(thp) if thp.trim().to_uppercase() != expected => {
                return TunnelAuthResult::CertMismatch;
            }
            _ => {}
        }
    }

    if auth.requires_oauth() {
        let allowed_issuer = match auth.oauth_issuer.as_deref() {
            Some(issuer) if !issuer.trim().is_empty() => issuer,
            _ => return TunnelAuthResult::MissingIssuer,
        };
        match token_issuer {
            None => return TunnelAuthResult::MissingIssuer,
            Some(issuer) if !validate_oauth_issuer(issuer, allowed_issuer) => {
                return TunnelAuthResult::IssuerMismatch;
            }
            _ => {}
        }
        if !validate_oauth_audience(token_audience, auth.audience.as_deref()) {
            return TunnelAuthResult::AudienceMismatch;
        }
    }

    TunnelAuthResult::Allowed
}

/// Convenience helper used by route handlers: load the tunnel auth policy and,
/// if one exists, validate the request. Returns `Ok(None)` when no policy is
/// configured (fail-open for backward compatibility) and `Err(result)` when a
/// policy is configured but the request fails validation.
pub fn require_tunnel_auth(
    db: &DbHandle,
    tunnel_id: Option<&str>,
    client_thumbprint: Option<&str>,
    token_issuer: Option<&str>,
    token_audience: Option<&str>,
) -> Result<Option<McpTunnelAuth>, TunnelAuthResult> {
    let tunnel_id = match tunnel_id {
        Some(id) if !id.trim().is_empty() => id,
        _ => return Ok(None),
    };

    let auth = match load_tunnel_auth(db, tunnel_id) {
        Ok(Some(auth)) => auth,
        Ok(None) => return Ok(None),
        Err(_) => return Err(TunnelAuthResult::MissingCert),
    };

    let result = validate_tunnel_request(&auth, client_thumbprint, token_issuer, token_audience);
    if result.is_allowed() {
        Ok(Some(auth))
    } else {
        Err(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;
    use std::path::PathBuf;

    fn temp_db() -> (DbHandle, PathBuf) {
        let path = std::env::temp_dir().join(format!(
            "allternit_mcp_tunnel_auth_test_{}_{}.db",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        // Remove any leftover file so each test starts fresh; migrations run on open.
        let _ = std::fs::remove_file(&path);
        (DbHandle::new(path.clone()).expect("open temp db"), path)
    }

    // Self-signed test certificate generated with:
    //   openssl req -x509 -newkey rsa:2048 -keyout /tmp/key.pem -out /tmp/cert.pem \
    //     -days 1 -nodes -subj "/CN=test-client"
    // SHA-256 fingerprint (colon-free uppercase):
    //   A4A616FD19584FE679C1C4E5AFC8363F1552ED0002864FAB14795A33AA5BB9A6
    const TEST_CERT_PEM: &str = r#"-----BEGIN CERTIFICATE-----
MIICqDCCAZACCQCPLNNrnTDMTDANBgkqhkiG9w0BAQsFADAWMRQwEgYDVQQDDAt0
ZXN0LWNsaWVudDAeFw0yNjA4MDkwODQ5NDZaFw0yNjA4MTAwODQ5NDZaMBYxFDAS
BgNVBAMMC3Rlc3QtY2xpZW50MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC
AQEAyyd6Exp3JVV8V8u0DmOWqgf/Gi2Tx0VqeqEya//ezX8ge5AgzKAjSUZSSuhL
BVVad8A3B9bceivLKoPtEvlnfwIbRZIern515d4/8Npy5VMIlMAbhbYApK0+xY6k
2QiKBGdTstvCJWV2i/CQPnFAeeAoUWK7zEU72VltFcU0JvhASuTiKxoCvwtVmceo
F1wKG8q9EvsndHpp8WOHR3Jdy/rB11G3gyMfthx9UXxkAdakX0CTrcqnHaVMfyPI
KWVYdCN0R3n0z2yMjrwgbnuyaxPECxc0NicBT1y7x7fE7rwvSmbyhsIOlomtKcC3
IY5HjS+YBCgnD/bLEK9/kqZi7QIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQDKYzC1
8VPsf27oyyPu41Z2o9Xk7vfcXJ/pbW7jm/MOSoNk8APyi/ApxuOeKWzqzOO4xt4W
q2m5otrW54Irti0op4Zt0h1UY37uzJWaiSewphkEBLyEoBabOErHAgJmWLw3EjqJ
Sk7Gv8Bpp6OJeTYKhsyWUjLhFsKgB3szc9ahOjstEwfm6d/DsHGHrMPoIss6hUKk
KL7kGgy676Hiru/FVAE/q/QEyB9aoNbLg38CLDdhFtXlOzgI5QtvQltaievgnQnD
E+1ZWU7/2RqF1IwGwnd691/5x1cumBkc9TCLfYQMwXvij+3p9mawj63UROZCblR6
CkUlufXsZ1DNpNFr
-----END CERTIFICATE-----
"#;

    #[test]
    fn client_cert_thumbprint_matches_openssl() {
        let thumbprint = client_cert_thumbprint(TEST_CERT_PEM).unwrap();
        assert_eq!(
            thumbprint,
            "A4A616FD19584FE679C1C4E5AFC8363F1552ED0002864FAB14795A33AA5BB9A6"
        );
    }

    #[test]
    fn client_cert_thumbprint_rejects_empty_pem() {
        assert!(client_cert_thumbprint("").is_err());
        assert!(client_cert_thumbprint("not a pem").is_err());
    }

    #[test]
    fn validate_oauth_issuer_normalizes_case_and_trailing_slash() {
        assert!(validate_oauth_issuer(
            "https://issuer.example",
            "https://issuer.example/"
        ));
        assert!(validate_oauth_issuer(
            "https://Issuer.Example/",
            "https://issuer.example"
        ));
        assert!(!validate_oauth_issuer(
            "https://other.example",
            "https://issuer.example"
        ));
    }

    #[test]
    fn validate_oauth_audience_behavior() {
        assert!(validate_oauth_audience(Some("aud1"), Some("aud1")));
        assert!(!validate_oauth_audience(Some("aud2"), Some("aud1")));
        assert!(validate_oauth_audience(None, None));
        assert!(validate_oauth_audience(Some("anything"), None));
        assert!(validate_oauth_audience(Some("anything"), Some("")));
    }

    #[test]
    fn validate_tunnel_request_allows_when_no_policy() {
        let auth = McpTunnelAuth {
            tunnel_id: "t1".into(),
            client_cert_pem: None,
            oauth_issuer: None,
            audience: None,
        };
        assert_eq!(
            validate_tunnel_request(&auth, None, None, None),
            TunnelAuthResult::Allowed
        );
    }

    #[test]
    fn validate_tunnel_request_enforces_mtls() {
        let expected = client_cert_thumbprint(TEST_CERT_PEM).unwrap();
        let auth = McpTunnelAuth {
            tunnel_id: "t1".into(),
            client_cert_pem: Some(TEST_CERT_PEM.into()),
            oauth_issuer: None,
            audience: None,
        };
        assert_eq!(
            validate_tunnel_request(&auth, Some(&expected), None, None),
            TunnelAuthResult::Allowed
        );
        assert_eq!(
            validate_tunnel_request(&auth, None, None, None),
            TunnelAuthResult::MissingCert
        );
        assert_eq!(
            validate_tunnel_request(&auth, Some("DEADBEEF"), None, None),
            TunnelAuthResult::CertMismatch
        );
    }

    #[test]
    fn validate_tunnel_request_enforces_oauth_issuer_and_audience() {
        let auth = McpTunnelAuth {
            tunnel_id: "t1".into(),
            client_cert_pem: None,
            oauth_issuer: Some("https://issuer.example/".into()),
            audience: Some("allternit-mcp".into()),
        };
        assert_eq!(
            validate_tunnel_request(
                &auth,
                None,
                Some("https://issuer.example"),
                Some("allternit-mcp")
            ),
            TunnelAuthResult::Allowed
        );
        assert_eq!(
            validate_tunnel_request(&auth, None, None, Some("allternit-mcp")),
            TunnelAuthResult::MissingIssuer
        );
        assert_eq!(
            validate_tunnel_request(
                &auth,
                None,
                Some("https://other.example"),
                Some("allternit-mcp")
            ),
            TunnelAuthResult::IssuerMismatch
        );
        assert_eq!(
            validate_tunnel_request(
                &auth,
                None,
                Some("https://issuer.example"),
                Some("wrong-aud")
            ),
            TunnelAuthResult::AudienceMismatch
        );
    }

    #[test]
    fn validate_tunnel_request_requires_all_configured_checks() {
        let expected = client_cert_thumbprint(TEST_CERT_PEM).unwrap();
        let auth = McpTunnelAuth {
            tunnel_id: "t1".into(),
            client_cert_pem: Some(TEST_CERT_PEM.into()),
            oauth_issuer: Some("https://issuer.example".into()),
            audience: Some("allternit-mcp".into()),
        };
        // Missing cert short-circuits before OAuth checks.
        assert_eq!(
            validate_tunnel_request(&auth, None, Some("https://issuer.example"), None),
            TunnelAuthResult::MissingCert
        );
        // Cert good but issuer bad.
        assert_eq!(
            validate_tunnel_request(&auth, Some(&expected), Some("https://other.example"), None),
            TunnelAuthResult::IssuerMismatch
        );
        // All good.
        assert_eq!(
            validate_tunnel_request(
                &auth,
                Some(&expected),
                Some("https://issuer.example"),
                Some("allternit-mcp")
            ),
            TunnelAuthResult::Allowed
        );
    }

    #[test]
    fn mcp_tunnel_auth_requires_helpers() {
        let empty_cert = McpTunnelAuth {
            tunnel_id: "t1".into(),
            client_cert_pem: Some("   ".into()),
            oauth_issuer: Some("".into()),
            audience: None,
        };
        assert!(!empty_cert.requires_mtls());
        assert!(!empty_cert.requires_oauth());

        let real = McpTunnelAuth {
            tunnel_id: "t2".into(),
            client_cert_pem: Some(TEST_CERT_PEM.into()),
            oauth_issuer: Some("https://issuer.example".into()),
            audience: Some("aud".into()),
        };
        assert!(real.requires_mtls());
        assert!(real.requires_oauth());
    }

    #[test]
    fn load_tunnel_auth_returns_none_for_unknown_tunnel() {
        let (db, _path) = temp_db();
        assert!(load_tunnel_auth(&db, "no-such-tunnel").unwrap().is_none());
    }

    #[test]
    fn load_tunnel_auth_reads_stored_policy() {
        let (db, _path) = temp_db();
        let expected_thumbprint = client_cert_thumbprint(TEST_CERT_PEM).unwrap();

        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT INTO mcp_tunnel_auth (tunnel_id, client_cert_pem, oauth_issuer, audience)
             VALUES (?1, ?2, ?3, ?4)",
            params!["tunnel-1", TEST_CERT_PEM, "https://issuer.example/", "allternit-mcp"],
        )
        .unwrap();
        drop(conn);

        let auth = load_tunnel_auth(&db, "tunnel-1").unwrap().expect("policy exists");
        assert_eq!(auth.tunnel_id, "tunnel-1");
        assert!(auth.requires_mtls());
        assert!(auth.requires_oauth());
        assert_eq!(auth.audience.as_deref(), Some("allternit-mcp"));

        // Full request validation succeeds with the right thumbprint, issuer, and audience.
        let result = require_tunnel_auth(
            &db,
            Some("tunnel-1"),
            Some(&expected_thumbprint),
            Some("https://issuer.example"),
            Some("allternit-mcp"),
        );
        assert!(result.is_ok());

        // Wrong thumbprint fails.
        let result = require_tunnel_auth(
            &db,
            Some("tunnel-1"),
            Some("BAD"),
            Some("https://issuer.example"),
            Some("allternit-mcp"),
        );
        assert_eq!(result.unwrap_err(), TunnelAuthResult::CertMismatch);

        // No tunnel header at all bypasses the check (backward compatibility).
        let result = require_tunnel_auth(&db, None, None, None, None);
        assert!(result.is_ok());
    }
}
