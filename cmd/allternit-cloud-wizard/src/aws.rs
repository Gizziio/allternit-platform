//! AWS EC2 Driver - REAL API IMPLEMENTATION
//!
//! Hand-rolled AWS SigV4 signing + EC2 Query API client (no aws-sdk
//! dependency; `hmac` + `sha2` are already workspace crates). Only the
//! operations the wizard needs are covered:
//! - EC2: RunInstances, TerminateInstances, RebootInstances, DescribeInstances,
//!   DescribeKeyPairs, ImportKeyPair, DescribeSecurityGroups,
//!   CreateSecurityGroup (API version 2016-11-15)
//! - SSM: GetParameter (2014-11-06) — Ubuntu AMI resolution
//! - STS: GetCallerIdentity (2011-06-15) — credential validation
//!
//! ## Credential encoding
//!
//! AWS credentials are stored as a single provider-token string holding JSON:
//!
//! ```json
//! {"access_key_id": "AKIA...", "secret_access_key": "...", "region": "us-east-1"}
//! ```
//!
//! The same JSON shape is accepted everywhere an AWS "API token" is taken
//! (wizard `api_token`, `PUT /api/v1/provider-tokens/aws`).

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::time::timeout;

use crate::provider::{
    CreateServerRequest, CreateServerResult, ProviderCapabilities, ProviderDriver, ProviderError,
    ServerStatus,
};

/// Pinned AWS API versions.
const EC2_API_VERSION: &str = "2016-11-15";
const SSM_API_VERSION: &str = "2014-11-06";
const STS_API_VERSION: &str = "2011-06-15";

/// Public SSM parameter holding the current Ubuntu 24.04 LTS amd64 AMI id
/// (per-region; resolved live, with a static fallback map below).
const UBUNTU_2404_AMI_SSM_PATH: &str =
    "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id";

/// Security group reused across allternit EC2 instances. No inbound rules
/// are ever added: the box is reached over the mesh only. A freshly created
/// EC2 security group denies all inbound and allows all outbound by default,
/// which is exactly the mesh-only posture.
const MESH_SECURITY_GROUP: &str = "allternit-mesh";

/// Static Ubuntu 24.04 LTS amd64 fallback AMIs (best-effort, early-24.04
/// release ids — refresh periodically). Only used when the SSM parameter
/// lookup fails, e.g. credentials without `ssm:GetParameter`.
fn ubuntu_2404_fallback_ami(region: &str) -> Option<&'static str> {
    match region {
        "us-east-1" => Some("ami-0e2c8caa870b0138f"),
        "us-west-2" => Some("ami-05d38da78ce859165"),
        "eu-west-1" => Some("ami-03fd334507439f4d1"),
        "eu-central-1" => Some("ami-03250b0e01c28e196"),
        _ => None,
    }
}

/// AWS credentials, decoded from the stored JSON provider token.
#[derive(Debug, Clone, Deserialize)]
pub struct AwsCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub region: String,
}

impl AwsCredentials {
    /// Parse the stored token (`{"access_key_id","secret_access_key","region"}`).
    pub fn from_token(token: &str) -> Result<Self, String> {
        let creds: AwsCredentials = serde_json::from_str(token).map_err(|_| {
            "AWS credentials must be JSON: {\"access_key_id\":\"...\",\"secret_access_key\":\"...\",\"region\":\"us-east-1\"}".to_string()
        })?;
        if creds.access_key_id.trim().is_empty()
            || creds.secret_access_key.trim().is_empty()
            || creds.region.trim().is_empty()
        {
            return Err(
                "AWS credentials JSON must set access_key_id, secret_access_key and region"
                    .to_string(),
            );
        }
        Ok(creds)
    }
}

/// Validate AWS credentials via STS GetCallerIdentity. `token` is the JSON
/// credential string; the error message documents the expected shape.
pub async fn validate_aws_credentials(token: &str) -> Result<(), String> {
    let creds = AwsCredentials::from_token(token)?;
    AwsDriver::new(creds)
        .validate()
        .await
        .map_err(|e| e.message)
}

// ============================================================================
// SigV4 signing
// ============================================================================

/// RFC 3986 URI encode; `/` is encoded when `encode_slash` (query/form values)
/// and preserved when false (paths). `~` stays unescaped per AWS rules.
fn aws_uri_encode(value: &str, encode_slash: bool) -> String {
    let mut out = String::with_capacity(value.len());
    for b in value.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            b'/' if !encode_slash => out.push('/'),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn sha256_hex(data: &[u8]) -> String {
    hex::encode(Sha256::digest(data))
}

fn hmac_sha256(key: &[u8], data: &str) -> Vec<u8> {
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data.as_bytes());
    mac.finalize().into_bytes().to_vec()
}

/// The pieces of a signed request the caller must attach as headers.
struct SignedRequest {
    authorization: String,
    amz_date: String,
}

/// Sign a request with AWS SigV4. `extra_headers` are headers (beyond `host`
/// and `x-amz-date`) that will be sent verbatim and folded into the signature.
fn sign_request(
    creds: &AwsCredentials,
    service: &str,
    host: &str,
    method: &str,
    canonical_uri: &str,
    canonical_query: &str,
    extra_headers: &[(&str, &str)],
    payload: &[u8],
    now: DateTime<Utc>,
) -> SignedRequest {
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let date_stamp = now.format("%Y%m%d").to_string();

    // Canonical headers: lowercase names, sorted, trimmed values.
    let mut headers: Vec<(String, String)> = vec![
        ("host".to_string(), host.to_string()),
        ("x-amz-date".to_string(), amz_date.clone()),
    ];
    for (name, value) in extra_headers {
        headers.push((name.to_lowercase(), value.trim().to_string()));
    }
    headers.sort_by(|a, b| a.0.cmp(&b.0));

    let canonical_headers: String = headers
        .iter()
        .map(|(n, v)| format!("{}:{}\n", n, v))
        .collect();
    let signed_headers: String = headers
        .iter()
        .map(|(n, _)| n.as_str())
        .collect::<Vec<_>>()
        .join(";");

    let payload_hash = sha256_hex(payload);
    let canonical_request = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        method, canonical_uri, canonical_query, canonical_headers, signed_headers, payload_hash
    );

    let scope = format!("{}/{}/{}/aws4_request", date_stamp, creds.region, service);
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{}\n{}\n{}",
        amz_date,
        scope,
        sha256_hex(canonical_request.as_bytes())
    );

    let mut key = hmac_sha256(
        format!("AWS4{}", creds.secret_access_key).as_bytes(),
        &date_stamp,
    );
    key = hmac_sha256(&key, &creds.region);
    key = hmac_sha256(&key, service);
    key = hmac_sha256(&key, "aws4_request");
    let signature = hex::encode(hmac_sha256(&key, &string_to_sign));

    SignedRequest {
        authorization: format!(
            "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
            creds.access_key_id, scope, signed_headers, signature
        ),
        amz_date,
    }
}

// ============================================================================
// Minimal XML helpers (Query API responses are flat enough for tag scanning)
// ============================================================================

/// First `<tag>value</tag>` occurrence.
fn tag_value(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    Some(xml[start..end].trim().to_string())
}

// ============================================================================
// AWS EC2 Driver
// ============================================================================

/// AWS EC2 API driver
pub struct AwsDriver {
    creds: AwsCredentials,
    client: reqwest::Client,
    /// URL scheme ("https" in production, "http" for stub-server tests).
    scheme: String,
    ec2_host: String,
    ssm_host: String,
    sts_host: String,
}

impl AwsDriver {
    /// Create new AWS driver from parsed credentials
    pub fn new(creds: AwsCredentials) -> Self {
        let region = creds.region.clone();
        Self {
            creds,
            client: reqwest::Client::new(),
            scheme: "https".to_string(),
            ec2_host: format!("ec2.{}.amazonaws.com", region),
            ssm_host: format!("ssm.{}.amazonaws.com", region),
            sts_host: format!("sts.{}.amazonaws.com", region),
        }
    }

    /// Point all services at a stub endpoint (tests only).
    #[cfg(test)]
    fn with_test_endpoint(mut self, host: &str) -> Self {
        self.scheme = "http".to_string();
        self.ec2_host = host.to_string();
        self.ssm_host = host.to_string();
        self.sts_host = host.to_string();
        self
    }

    /// POST to an AWS Query API service; returns the response body.
    /// `params` must include `Action` and `Version`.
    async fn query_call(
        &self,
        service: &str,
        host: &str,
        params: &[(&str, String)],
    ) -> Result<String, ProviderError> {
        let body = params
            .iter()
            .map(|(k, v)| format!("{}={}", aws_uri_encode(k, true), aws_uri_encode(v, true)))
            .collect::<Vec<_>>()
            .join("&");

        let signed = sign_request(
            &self.creds,
            service,
            host,
            "POST",
            "/",
            "",
            &[("content-type", "application/x-www-form-urlencoded")],
            body.as_bytes(),
            Utc::now(),
        );

        let response = self
            .client
            .post(format!("{}://{}/", self.scheme, host))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("X-Amz-Date", &signed.amz_date)
            .header("Authorization", &signed.authorization)
            .body(body)
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "AWS_API_ERROR".to_string(),
                message: format!("{} request failed: {}", service, e),
                retryable: true,
            })?;

        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        if !status.is_success() {
            let aws_code = tag_value(&text, "Code").unwrap_or_else(|| "Unknown".to_string());
            let aws_message = tag_value(&text, "Message").unwrap_or(text.clone());
            let auth_error = status == reqwest::StatusCode::UNAUTHORIZED
                || status == reqwest::StatusCode::FORBIDDEN;
            return Err(ProviderError {
                code: if auth_error {
                    "AWS_AUTH_ERROR".to_string()
                } else {
                    "AWS_API_ERROR".to_string()
                },
                message: format!("{}: {} - {}", service, aws_code, aws_message),
                retryable: status.is_server_error(),
            });
        }
        Ok(text)
    }

    /// EC2 Query API call (version pinned).
    async fn ec2(&self, action: &str, params: &[(&str, String)]) -> Result<String, ProviderError> {
        let mut all = vec![
            ("Action", action.to_string()),
            ("Version", EC2_API_VERSION.to_string()),
        ];
        all.extend_from_slice(params);
        let host = self.ec2_host.clone();
        self.query_call("ec2", &host, &all).await
    }

    /// STS GetCallerIdentity — proves the credentials authenticate.
    pub async fn validate(&self) -> Result<(), ProviderError> {
        let host = self.sts_host.clone();
        self.query_call(
            "sts",
            &host,
            &[
                ("Action", "GetCallerIdentity".to_string()),
                ("Version", STS_API_VERSION.to_string()),
            ],
        )
        .await?;
        Ok(())
    }

    /// Describe a single instance; `(state, public_ip)`.
    async fn describe_instance(
        &self,
        instance_id: &str,
    ) -> Result<(String, Option<String>), ProviderError> {
        let body = self
            .ec2(
                "DescribeInstances",
                &[("InstanceId.1", instance_id.to_string())],
            )
            .await?;

        // The instance state name lives inside <instanceState><name>..</name>.
        let state = body
            .find("<instanceState>")
            .and_then(|i| tag_value(&body[i..], "name"))
            .unwrap_or_else(|| "unknown".to_string());
        let ip = tag_value(&body, "ipAddress");
        Ok((state, ip))
    }

    /// Resolve the Ubuntu 24.04 AMI for the configured region: live via the
    /// public SSM parameter, falling back to the static map. `image` values
    /// that already look like an AMI id pass straight through.
    async fn resolve_ami(&self, image: &str) -> Result<String, ProviderError> {
        if image.starts_with("ami-") {
            return Ok(image.to_string());
        }

        let host = self.ssm_host.clone();
        match self
            .query_call(
                "ssm",
                &host,
                &[
                    ("Action", "GetParameter".to_string()),
                    ("Version", SSM_API_VERSION.to_string()),
                    ("Name", UBUNTU_2404_AMI_SSM_PATH.to_string()),
                ],
            )
            .await
        {
            Ok(body) => match tag_value(&body, "Value") {
                Some(ami) if ami.starts_with("ami-") => return Ok(ami),
                _ => {
                    tracing::warn!("SSM GetParameter returned no AMI id; using fallback map")
                }
            },
            Err(e) => {
                tracing::warn!("SSM AMI lookup failed ({}); using fallback map", e.message)
            }
        }

        ubuntu_2404_fallback_ami(&self.creds.region)
            .map(|s| s.to_string())
            .ok_or_else(|| ProviderError {
                code: "AWS_AMI_UNKNOWN".to_string(),
                message: format!(
                    "No Ubuntu 24.04 AMI known for region {} (SSM lookup failed and region not in fallback map)",
                    self.creds.region
                ),
                retryable: false,
            })
    }

    /// Find or import the per-user key pair (`allternit-<hash of pubkey>`).
    async fn ensure_key_pair(&self, public_key: &str) -> Result<String, ProviderError> {
        let name = format!("allternit-{}", &sha256_hex(public_key.as_bytes())[..12]);

        match self
            .ec2("DescribeKeyPairs", &[("KeyName.1", name.clone())])
            .await
        {
            Ok(_) => {
                tracing::info!("EC2 key pair already exists: {}", name);
                return Ok(name);
            }
            Err(e) if e.message.contains("InvalidKeyPair.NotFound") => {}
            Err(e) => return Err(e),
        }

        // PublicKeyMaterial is the base64-encoded OpenSSH public key text.
        use base64::Engine;
        self.ec2(
            "ImportKeyPair",
            &[
                ("KeyName", name.clone()),
                (
                    "PublicKeyMaterial",
                    base64::engine::general_purpose::STANDARD.encode(public_key.trim()),
                ),
            ],
        )
        .await?;
        Ok(name)
    }

    /// Find or create the mesh-only security group. Never opens inbound ports.
    async fn ensure_security_group(&self) -> Result<String, ProviderError> {
        let body = self
            .ec2(
                "DescribeSecurityGroups",
                &[
                    ("Filter.1.Name", "group-name".to_string()),
                    ("Filter.1.Value.1", MESH_SECURITY_GROUP.to_string()),
                ],
            )
            .await?;
        if let Some(group_id) = tag_value(&body, "groupId") {
            return Ok(group_id);
        }

        let body = self
            .ec2(
                "CreateSecurityGroup",
                &[
                    ("GroupName", MESH_SECURITY_GROUP.to_string()),
                    (
                        "GroupDescription",
                        "Allternit mesh-only instances (no inbound; mesh access via tailnet)"
                            .to_string(),
                    ),
                ],
            )
            .await?;
        tag_value(&body, "groupId").ok_or_else(|| ProviderError {
            code: "AWS_PARSE_ERROR".to_string(),
            message: "CreateSecurityGroup response had no groupId".to_string(),
            retryable: false,
        })
    }

    /// Wait for TCP port to be accessible
    async fn wait_for_tcp(
        &self,
        host: &str,
        port: u16,
        timeout_dur: Duration,
    ) -> Result<(), ProviderError> {
        timeout(timeout_dur, async {
            loop {
                match TcpStream::connect(format!("{}:{}", host, port)).await {
                    Ok(_) => return Ok(()),
                    Err(_) => tokio::time::sleep(Duration::from_secs(2)).await,
                }
            }
        })
        .await
        .map_err(|_| ProviderError {
            code: "TIMEOUT".to_string(),
            message: format!("TCP {}:{} not reachable within timeout", host, port),
            retryable: true,
        })?
    }
}

#[async_trait]
impl ProviderDriver for AwsDriver {
    fn name(&self) -> &str {
        "aws"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_api: true,
            supports_ssh_key_injection: true,
            supports_firewall_config: true,
            regions: vec![
                "us-east-1".to_string(),
                "us-west-2".to_string(),
                "eu-west-1".to_string(),
                "eu-central-1".to_string(),
            ],
            instance_types: vec!["t3.small".to_string(), "t3.medium".to_string()],
            os_images: vec!["ubuntu-24.04".to_string()],
        }
    }

    async fn create_server(
        &self,
        request: &CreateServerRequest,
    ) -> Result<CreateServerResult, ProviderError> {
        tracing::info!(
            "Creating AWS EC2 instance: {} in {}",
            request.name,
            self.creds.region
        );

        let ami = self.resolve_ami(&request.image).await?;

        // Inject the first SSH key as an EC2 key pair (extra keys are
        // appended by cloud-init via the same key at boot; EC2 takes one).
        let key_name = match request.ssh_keys.first() {
            Some(key) => Some(self.inject_ssh_key("", key).await?),
            None => None,
        };

        let group_id = self.ensure_security_group().await?;

        let owner = request
            .owner_id
            .clone()
            .unwrap_or_else(|| "unknown".to_string());
        let mut params = vec![
            ("ImageId", ami),
            ("InstanceType", request.instance_type.clone()),
            ("MinCount", "1".to_string()),
            ("MaxCount", "1".to_string()),
            ("SecurityGroupId.1", group_id),
            ("TagSpecification.1.ResourceType", "instance".to_string()),
            ("TagSpecification.1.Tag.1.Key", "allternit:byo".to_string()),
            ("TagSpecification.1.Tag.1.Value", "true".to_string()),
            ("TagSpecification.1.Tag.2.Key", "allternit:user".to_string()),
            ("TagSpecification.1.Tag.2.Value", owner),
        ];
        if let Some(key_name) = key_name {
            params.push(("KeyName", key_name));
        }

        let body = self.ec2("RunInstances", &params).await?;
        let instance_id = tag_value(&body, "instanceId").ok_or_else(|| ProviderError {
            code: "AWS_PARSE_ERROR".to_string(),
            message: "RunInstances response had no instanceId".to_string(),
            retryable: false,
        })?;

        Ok(CreateServerResult {
            server_id: instance_id,
            ip_address: None, // Will be populated after wait_for_ready
            status: ServerStatus::Provisioning,
        })
    }

    async fn inject_ssh_key(
        &self,
        _server_id: &str,
        public_key: &str,
    ) -> Result<String, ProviderError> {
        self.ensure_key_pair(public_key).await
    }

    async fn wait_for_ready(
        &self,
        instance_id: &str,
        timeout_dur: Duration,
    ) -> Result<ServerStatus, ProviderError> {
        tracing::info!("Waiting for EC2 instance {} to be SSH-ready", instance_id);

        let start = std::time::Instant::now();

        loop {
            if start.elapsed() > timeout_dur {
                return Err(ProviderError {
                    code: "TIMEOUT".to_string(),
                    message: "Instance did not become ready within timeout".to_string(),
                    retryable: true,
                });
            }

            match self.describe_instance(instance_id).await {
                Ok((state, ip)) => {
                    if state == "running" {
                        if let Some(ip) = ip {
                            match self.wait_for_tcp(&ip, 22, Duration::from_secs(5)).await {
                                Ok(_) => {
                                    tracing::info!(
                                        "Instance {} is SSH-ready at {}",
                                        instance_id,
                                        ip
                                    );
                                    return Ok(ServerStatus::Running);
                                }
                                Err(_) => {
                                    tracing::debug!(
                                        "Instance {} running but SSH not ready yet",
                                        instance_id
                                    );
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to get instance status: {}", e);
                }
            }

            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    }

    async fn get_server_status(&self, instance_id: &str) -> Result<ServerStatus, ProviderError> {
        match self.describe_instance(instance_id).await {
            Ok((state, _)) => Ok(match state.as_str() {
                "running" => ServerStatus::Running,
                "pending" => ServerStatus::Starting,
                "stopping" | "shutting-down" => ServerStatus::Stopping,
                "stopped" | "terminated" => ServerStatus::Stopped,
                _ => ServerStatus::Unknown,
            }),
            Err(e) => {
                if e.message.contains("InvalidInstanceID.NotFound") {
                    Err(ProviderError {
                        code: "NOT_FOUND".to_string(),
                        message: format!("Instance {} not found", instance_id),
                        retryable: false,
                    })
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn destroy_server(&self, instance_id: &str) -> Result<(), ProviderError> {
        tracing::info!("Terminating EC2 instance {}", instance_id);

        match self
            .ec2(
                "TerminateInstances",
                &[("InstanceId.1", instance_id.to_string())],
            )
            .await
        {
            Ok(_) => {
                tracing::info!("Instance {} terminated", instance_id);
                Ok(())
            }
            Err(e) if e.message.contains("InvalidInstanceID.NotFound") => {
                tracing::info!("Instance {} already gone", instance_id);
                Ok(())
            }
            Err(e) => Err(e),
        }
    }

    async fn reboot_server(&self, instance_id: &str) -> Result<(), ProviderError> {
        tracing::info!("Rebooting EC2 instance {}", instance_id);

        self.ec2(
            "RebootInstances",
            &[("InstanceId.1", instance_id.to_string())],
        )
        .await?;
        Ok(())
    }

    async fn get_server_ip(&self, instance_id: &str) -> Result<Option<String>, ProviderError> {
        Ok(self.describe_instance(instance_id).await?.1)
    }
}

// ============================================================================
// Tests (signing vectors + request builders; no real AWS calls)
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn test_creds() -> AwsCredentials {
        AwsCredentials {
            access_key_id: "AKIDEXAMPLE".to_string(),
            secret_access_key: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY".to_string(),
            region: "us-east-1".to_string(),
        }
    }

    /// Canonical AWS documentation example: GET iam.amazonaws.com
    /// ?Action=ListUsers&Version=2010-05-08 at 2015-08-30T12:36:00Z.
    /// https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html
    #[test]
    fn sigv4_matches_aws_canonical_example() {
        let now = DateTime::parse_from_rfc3339("2015-08-30T12:36:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let signed = sign_request(
            &test_creds(),
            "iam",
            "iam.amazonaws.com",
            "GET",
            "/",
            "Action=ListUsers&Version=2010-05-08",
            &[(
                "content-type",
                "application/x-www-form-urlencoded; charset=utf-8",
            )],
            b"",
            now,
        );

        assert_eq!(signed.amz_date, "20150830T123600Z");
        assert_eq!(
            signed.authorization,
            "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7"
        );
    }

    #[test]
    fn uri_encode_follows_aws_rules() {
        assert_eq!(aws_uri_encode("a-b_c.d~e", true), "a-b_c.d~e");
        assert_eq!(
            aws_uri_encode("/aws/service/canonical/ubuntu", true),
            "%2Faws%2Fservice%2Fcanonical%2Fubuntu"
        );
        assert_eq!(aws_uri_encode("/path/x", false), "/path/x");
        assert_eq!(aws_uri_encode("a b&c=d", true), "a%20b%26c%3Dd");
    }

    #[test]
    fn credentials_parse_json_shape() {
        let creds = AwsCredentials::from_token(
            r#"{"access_key_id":"AKIA","secret_access_key":"sekret","region":"eu-west-1"}"#,
        )
        .unwrap();
        assert_eq!(creds.region, "eu-west-1");

        // Malformed JSON and missing fields both name the expected shape.
        let err = AwsCredentials::from_token("plain-token").unwrap_err();
        assert!(err.contains("access_key_id"), "got: {}", err);
        let err = AwsCredentials::from_token(
            r#"{"access_key_id":"AKIA","secret_access_key":"","region":""}"#,
        )
        .unwrap_err();
        assert!(err.contains("secret_access_key"), "got: {}", err);
    }

    #[test]
    fn tag_value_extracts_first_occurrence() {
        let xml = "<a><instanceId>i-0123</instanceId></a>";
        assert_eq!(tag_value(xml, "instanceId"), Some("i-0123".to_string()));
        assert_eq!(tag_value(xml, "missing"), None);
    }

    #[test]
    fn describe_instance_xml_parses_state_and_ip() {
        // Same extraction helpers describe_instance() uses.
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
  <reservationSet><item><instancesSet><item>
    <instanceId>i-0abcd1234</instanceId>
    <imageId>ami-0e2c8caa870b0138f</imageId>
    <instanceState><code>16</code><name>running</name></instanceState>
    <ipAddress>203.0.113.10</ipAddress>
    <tagSet><item><key>Name</key><value>box</value></item></tagSet>
  </item></instancesSet></item></reservationSet>
</DescribeInstancesResponse>"#;

        let state = xml
            .find("<instanceState>")
            .and_then(|i| tag_value(&xml[i..], "name"))
            .unwrap();
        assert_eq!(state, "running");
        assert_eq!(
            tag_value(xml, "ipAddress"),
            Some("203.0.113.10".to_string())
        );
    }

    #[test]
    fn fallback_ami_map_covers_common_regions() {
        assert!(ubuntu_2404_fallback_ami("us-east-1").unwrap().starts_with("ami-"));
        assert!(ubuntu_2404_fallback_ami("eu-central-1").is_some());
        assert!(ubuntu_2404_fallback_ami("ap-southeast-2").is_none());
    }

    /// Tiny stub HTTP server: serves one canned Query API response with the
    /// given status line and captures the request for assertions.
    /// No real AWS calls.
    async fn stub_aws_endpoint(
        status_line: &'static str,
        response_xml: &'static str,
    ) -> (String, tokio::sync::oneshot::Receiver<String>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let (tx, rx) = tokio::sync::oneshot::channel();

        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let mut buf = vec![0u8; 8192];
            let mut request = Vec::new();
            loop {
                let n = socket.read(&mut buf).await.unwrap();
                if n == 0 {
                    break;
                }
                request.extend_from_slice(&buf[..n]);
                // Stop once headers + full body (Content-Length) arrived.
                let text = String::from_utf8_lossy(&request);
                if let Some(pos) = text.find("\r\n\r\n") {
                    let headers = &text[..pos];
                    let content_length: usize = headers
                        .lines()
                        .find_map(|l| {
                            l.strip_prefix("content-length:")
                                .or_else(|| l.strip_prefix("Content-Length:"))
                        })
                        .and_then(|v| v.trim().parse().ok())
                        .unwrap_or(0);
                    if request.len() >= pos + 4 + content_length {
                        break;
                    }
                }
            }
            let body = format!(
                "{}\r\nContent-Type: text/xml\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                status_line,
                response_xml.len(),
                response_xml
            );
            socket.write_all(body.as_bytes()).await.unwrap();
            let _ = tx.send(String::from_utf8_lossy(&request).to_string());
        });

        (format!("127.0.0.1:{}", addr.port()), rx)
    }

    #[tokio::test]
    async fn get_server_status_issues_signed_describe_instances() {
        let xml = "<DescribeInstancesResponse><reservationSet><item><instancesSet><item>\
                   <instanceId>i-0123</instanceId>\
                   <instanceState><code>16</code><name>running</name></instanceState>\
                   <ipAddress>203.0.113.10</ipAddress>\
                   </item></instancesSet></item></reservationSet></DescribeInstancesResponse>";
        let (host, rx) = stub_aws_endpoint("HTTP/1.1 200 OK", xml).await;

        let driver = AwsDriver::new(test_creds()).with_test_endpoint(&host);
        let status = driver.get_server_status("i-0123").await.unwrap();
        assert_eq!(status, ServerStatus::Running);

        let request = rx.await.unwrap();
        assert!(request.starts_with("POST / HTTP/1.1"), "got: {}", request);
        let body = request.split("\r\n\r\n").nth(1).unwrap();
        assert!(body.contains("Action=DescribeInstances"), "got: {}", body);
        assert!(body.contains("Version=2016-11-15"), "got: {}", body);
        assert!(body.contains("InstanceId.1=i-0123"), "got: {}", body);
        assert!(
            request.contains("authorization: AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/"),
            "got: {}",
            request
        );
        assert!(request.contains("SignedHeaders=content-type;host;x-amz-date"));
    }

    #[tokio::test]
    async fn aws_error_xml_maps_to_auth_error_code() {
        let xml = "<Response><Errors><Error><Code>AuthFailure</Code>\
                   <Message>AWS was not able to validate the provided access credentials</Message>\
                   </Error></Errors></Response>";
        let (host, _rx) = stub_aws_endpoint("HTTP/1.1 403 Forbidden", xml).await;

        let driver = AwsDriver::new(test_creds()).with_test_endpoint(&host);
        let err = driver.validate().await.unwrap_err();
        assert_eq!(err.code, "AWS_AUTH_ERROR");
        assert!(err.message.contains("AuthFailure"), "got: {}", err.message);
        assert!(!err.retryable);
    }
}
