//! Contabo Cloud API client for provisioning Incus hosts.

use super::{CloudProvider, CloudProviderError, CreateServerRequest, ProviderKind, ServerInfo, ServerStatus};
use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tracing::{info, warn};

const AUTH_URL: &str = "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token";
const DEFAULT_API_URL: &str = "https://api.contabo.com";
const DEFAULT_IMAGE_ID: &str = "afecbb85-e2fc-46f0-9684-b46b1faf00bb"; // Ubuntu 22.04
const DEFAULT_REGION: &str = "US-central";
const DEFAULT_PLAN: &str = "V153";
const DEFAULT_PERIOD: i64 = 1;

#[derive(Debug, Clone)]
pub struct ContaboClient {
    client_id: String,
    client_secret: String,
    username: String,
    password: String,
    api_url: String,
    auth_url: String,
    default_region: String,
    default_plan: String,
    image_id: String,
    ssh_key_id: Option<String>,
    token: Arc<Mutex<Option<TokenCache>>>,
    poll_interval: Duration,
}

#[derive(Debug, Clone)]
struct TokenCache {
    access_token: String,
    expires_at: Instant,
}

impl ContaboClient {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        client_id: impl Into<String>,
        client_secret: impl Into<String>,
        username: impl Into<String>,
        password: impl Into<String>,
        api_url: impl Into<String>,
        auth_url: impl Into<String>,
        default_region: impl Into<String>,
        default_plan: impl Into<String>,
        image_id: impl Into<String>,
        ssh_key_id: Option<String>,
    ) -> Self {
        Self {
            client_id: client_id.into(),
            client_secret: client_secret.into(),
            username: username.into(),
            password: password.into(),
            api_url: api_url.into(),
            auth_url: auth_url.into(),
            default_region: default_region.into(),
            default_plan: default_plan.into(),
            image_id: image_id.into(),
            ssh_key_id,
            token: Arc::new(Mutex::new(None)),
            poll_interval: Duration::from_secs(10),
        }
    }

    #[cfg(test)]
    pub fn with_poll_interval(mut self, interval: Duration) -> Self {
        self.poll_interval = interval;
        self
    }

    pub fn from_env() -> Result<Self, CloudProviderError> {
        fn required(name: &str) -> Result<String, CloudProviderError> {
            std::env::var(name)
                .ok()
                .filter(|s| !s.is_empty())
                .ok_or_else(|| CloudProviderError::MissingCredentials(name.to_string()))
        }

        Ok(Self::new(
            required("CONTABO_CLIENT_ID")?,
            required("CONTABO_CLIENT_SECRET")?,
            required("CONTABO_API_USERNAME")?,
            required("CONTABO_API_PASSWORD")?,
            std::env::var("CONTABO_API_URL")
                .ok()
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| DEFAULT_API_URL.to_string()),
            std::env::var("CONTABO_AUTH_URL")
                .ok()
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| AUTH_URL.to_string()),
            std::env::var("CONTABO_DEFAULT_REGION")
                .ok()
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| DEFAULT_REGION.to_string()),
            std::env::var("CONTABO_DEFAULT_PLAN")
                .ok()
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| DEFAULT_PLAN.to_string()),
            std::env::var("CONTABO_IMAGE_ID")
                .ok()
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| DEFAULT_IMAGE_ID.to_string()),
            std::env::var("CONTABO_SSH_KEY_ID")
                .ok()
                .filter(|s| !s.is_empty()),
        ))
    }

    fn http_client(&self) -> Result<reqwest::Client, CloudProviderError> {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| CloudProviderError::Request(format!("build client: {e}")))
    }

    async fn access_token(&self) -> Result<String, CloudProviderError> {
        {
            let guard = self.token.lock().await;
            if let Some(cache) = guard.as_ref() {
                if cache.expires_at > Instant::now() + Duration::from_secs(60) {
                    return Ok(cache.access_token.clone());
                }
            }
        }

        let client = self.http_client()?;
        let params = [
            ("grant_type", "password"),
            ("client_id", &self.client_id),
            ("client_secret", &self.client_secret),
            ("username", &self.username),
            ("password", &self.password),
        ];
        let resp = client
            .post(&self.auth_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| CloudProviderError::Request(format!("token request: {e}")))?;
        let status = resp.status().as_u16();
        let json: serde_json::Value = resp
            .json()
            .await
            .unwrap_or_else(|_| serde_json::Value::Null);
        if status >= 400 {
            return Err(CloudProviderError::from_api_status(status, json.to_string()));
        }
        let token = json
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| CloudProviderError::Request("missing access_token".to_string()))?
            .to_string();
        let expires_in = json
            .get("expires_in")
            .and_then(|v| v.as_u64())
            .unwrap_or(3600);
        let cache = TokenCache {
            access_token: token.clone(),
            expires_at: Instant::now() + Duration::from_secs(expires_in),
        };
        *self.token.lock().await = Some(cache);
        Ok(token)
    }

    fn request_id() -> String {
        uuid::Uuid::new_v4().to_string()
    }

    async fn request(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<(u16, serde_json::Value), CloudProviderError> {
        let token = self.access_token().await?;
        let client = self.http_client()?;
        let url = format!("{}{}", self.api_url.trim_end_matches('/'), path);
        let mut req = client
            .request(method, &url)
            .header("Authorization", format!("Bearer {token}"))
            .header("x-request-id", Self::request_id())
            .header("Content-Type", "application/json");
        if let Some(b) = body {
            req = req.json(&b);
        }
        let resp = req
            .send()
            .await
            .map_err(|e| CloudProviderError::Request(format!("{path}: {e}")))?;
        let status = resp.status().as_u16();
        let json = resp
            .json()
            .await
            .unwrap_or_else(|_| serde_json::Value::Null);
        Ok((status, json))
    }
}

#[derive(Debug, Serialize)]
struct CreateInstanceBody {
    image_id: String,
    product_id: String,
    region: String,
    period: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    ssh_keys: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct InstanceResponse {
    data: Vec<Instance>,
}

#[derive(Debug, Deserialize)]
struct Instance {
    instance_id: i64,
    name: String,
    display_name: Option<String>,
    status: String,
    region: String,
    product_id: String,
    ip_config: Option<IpConfig>,
}

#[derive(Debug, Deserialize)]
struct IpConfig {
    v4: Option<Ip>,
}

#[derive(Debug, Deserialize)]
struct Ip {
    ip: String,
}

fn map_status(s: &str) -> ServerStatus {
    match s.to_lowercase().as_str() {
        "running" => ServerStatus::Running,
        "stopped" | "off" => ServerStatus::Stopped,
        "error" => ServerStatus::Error,
        _ => ServerStatus::Provisioning,
    }
}

fn instance_to_info(i: &Instance) -> ServerInfo {
    ServerInfo {
        id: i.instance_id.to_string(),
        name: i.display_name.clone().unwrap_or_else(|| i.name.clone()),
        status: map_status(&i.status),
        ipv4: i.ip_config.as_ref().and_then(|c| c.v4.as_ref().map(|ip| ip.ip.clone())),
        region: i.region.clone(),
        plan: i.product_id.clone(),
    }
}

#[async_trait]
impl CloudProvider for ContaboClient {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Contabo
    }

    async fn create_server(
        &self,
        req: CreateServerRequest,
    ) -> Result<ServerInfo, CloudProviderError> {
        let ssh_keys = self
            .ssh_key_id
            .clone()
            .or_else(|| req.ssh_key_id.clone())
            .map(|k| vec![k]);

        let body = CreateInstanceBody {
            image_id: self.image_id.clone(),
            product_id: req.plan.unwrap_or_else(|| self.default_plan.clone()),
            region: req.region.unwrap_or_else(|| self.default_region.clone()),
            period: DEFAULT_PERIOD,
            ssh_keys,
            user_data: req.user_data,
            display_name: Some(req.name),
        };

        let (status, json) = self
            .request(
                reqwest::Method::POST,
                "/v1/compute/instances",
                Some(serde_json::to_value(body).unwrap()),
            )
            .await?;
        if status >= 400 {
            return Err(CloudProviderError::from_api_status(status, json.to_string()));
        }
        let resp: InstanceResponse = serde_json::from_value(json)
            .map_err(|e| CloudProviderError::Request(format!("parse create response: {e}")))?;
        let instance = resp
            .data
            .into_iter()
            .next()
            .ok_or_else(|| CloudProviderError::Request("no instance in create response".to_string()))?;

        info!(instance_id = instance.instance_id, "Contabo instance created");

        // Poll until running and an IPv4 address is assigned.
        for attempt in 0..60 {
            tokio::time::sleep(self.poll_interval).await;
            match self.get_server(&instance.instance_id.to_string()).await {
                Ok(Some(info)) => {
                    if info.status == ServerStatus::Running && info.ipv4.is_some() {
                        return Ok(info);
                    }
                    if info.status == ServerStatus::Error {
                        return Err(CloudProviderError::Api {
                            status: 500,
                            message: format!("instance entered error state: {:?}", info),
                        });
                    }
                    if attempt % 6 == 0 {
                        info!(instance_id = instance.instance_id, status = ?info.status, "waiting for Contabo instance");
                    }
                }
                Ok(None) => {}
                Err(e) => warn!(error = %e, "error polling Contabo instance"),
            }
        }

        Err(CloudProviderError::Request(
            "Contabo instance did not become running in time".to_string(),
        ))
    }

    async fn delete_server(&self, id: &str) -> Result<(), CloudProviderError> {
        let cancel_date = Utc::now().format("%-d-%-m-%Y").to_string();
        let body = serde_json::json!({ "cancelDate": cancel_date });
        let (status, json) = self
            .request(
                reqwest::Method::POST,
                &format!("/v1/compute/instances/{id}/cancel"),
                Some(body),
            )
            .await?;
        if status >= 400 {
            return Err(CloudProviderError::from_api_status(status, json.to_string()));
        }
        Ok(())
    }

    async fn get_server(&self, id: &str) -> Result<Option<ServerInfo>, CloudProviderError> {
        let (status, json) = self
            .request(reqwest::Method::GET, &format!("/v1/compute/instances/{id}"), None)
            .await?;
        if status == 404 {
            return Ok(None);
        }
        if status >= 400 {
            return Err(CloudProviderError::from_api_status(status, json.to_string()));
        }
        let resp: InstanceResponse = serde_json::from_value(json)
            .map_err(|e| CloudProviderError::Request(format!("parse instance response: {e}")))?;
        Ok(resp.data.into_iter().next().map(|i| instance_to_info(&i)))
    }

    async fn list_servers(&self) -> Result<Vec<ServerInfo>, CloudProviderError> {
        let (status, json) = self
            .request(reqwest::Method::GET, "/v1/compute/instances", None)
            .await?;
        if status >= 400 {
            return Err(CloudProviderError::from_api_status(status, json.to_string()));
        }
        let resp: InstanceResponse = serde_json::from_value(json)
            .map_err(|e| CloudProviderError::Request(format!("parse instances response: {e}")))?;
        Ok(resp.data.iter().map(instance_to_info).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::Server;

    fn client_for(server: &Server) -> ContaboClient {
        ContaboClient::new(
            "client-id",
            "client-secret",
            "user",
            "pass",
            server.url(),
            format!("{}/auth", server.url()),
            "US-central",
            "V153",
            "img-1",
            Some("key-1".to_string()),
        )
        .with_poll_interval(Duration::from_millis(10))
    }

    fn token_response() -> serde_json::Value {
        serde_json::json!({
            "access_token": "test-access-token",
            "expires_in": 3600
        })
    }

    fn instance_json(id: i64, status: &str, ipv4: Option<&str>) -> serde_json::Value {
        serde_json::json!({
            "data": [{
                "instance_id": id,
                "name": "allternit-host",
                "display_name": "Allternit Host",
                "status": status,
                "region": "US-central",
                "product_id": "V153",
                "ip_config": {
                    "v4": ipv4.map(|ip| serde_json::json!({ "ip": ip }))
                }
            }]
        })
    }

    #[tokio::test]
    async fn create_server_polls_until_running_and_ipv4() {
        let mut server = Server::new_async().await;
        let client = client_for(&server);

        let auth_mock = server
            .mock("POST", "/auth")
            .with_status(200)
            .with_body(token_response().to_string())
            .create_async()
            .await;

        let create_mock = server
            .mock("POST", "/v1/compute/instances")
            .with_status(201)
            .with_body(instance_json(456, "provisioning", None).to_string())
            .create_async()
            .await;

        let get_mock = server
            .mock("GET", "/v1/compute/instances/456")
            .with_status(200)
            .with_body(instance_json(456, "running", Some("10.0.0.3")).to_string())
            .expect_at_least(1)
            .create_async()
            .await;

        let req = CreateServerRequest {
            name: "test-host".to_string(),
            region: Some("US-central".to_string()),
            plan: Some("V153".to_string()),
            ssh_key_id: None,
            user_data: None,
        };
        let info = client.create_server(req).await.unwrap();

        assert_eq!(info.id, "456");
        assert_eq!(info.status, ServerStatus::Running);
        assert_eq!(info.ipv4, Some("10.0.0.3".to_string()));
        auth_mock.assert_async().await;
        create_mock.assert_async().await;
        get_mock.assert_async().await;
    }

    #[tokio::test]
    async fn access_token_is_cached() {
        let mut server = Server::new_async().await;
        let client = client_for(&server);

        let auth_mock = server
            .mock("POST", "/auth")
            .with_status(200)
            .with_body(token_response().to_string())
            .expect(1)
            .create_async()
            .await;

        let get_mock = server
            .mock("GET", "/v1/compute/instances/1")
            .with_status(200)
            .with_body(instance_json(1, "running", Some("10.0.0.1")).to_string())
            .expect(2)
            .create_async()
            .await;

        client.get_server("1").await.unwrap();
        client.get_server("1").await.unwrap();

        auth_mock.assert_async().await;
        get_mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_server_returns_none_on_404() {
        let mut server = Server::new_async().await;
        let client = client_for(&server);

        let auth_mock = server
            .mock("POST", "/auth")
            .with_status(200)
            .with_body(token_response().to_string())
            .create_async()
            .await;

        let get_mock = server
            .mock("GET", "/v1/compute/instances/999")
            .with_status(404)
            .create_async()
            .await;

        let info = client.get_server("999").await.unwrap();
        assert!(info.is_none());
        auth_mock.assert_async().await;
        get_mock.assert_async().await;
    }

    #[tokio::test]
    async fn list_servers_parses_response() {
        let mut server = Server::new_async().await;
        let client = client_for(&server);

        let auth_mock = server
            .mock("POST", "/auth")
            .with_status(200)
            .with_body(token_response().to_string())
            .create_async()
            .await;

        let body = serde_json::json!({
            "data": [{
                "instance_id": 7,
                "name": "host-7",
                "display_name": null,
                "status": "running",
                "region": "EU",
                "product_id": "V1",
                "ip_config": { "v4": { "ip": "10.0.0.7" } }
            }]
        });
        let list_mock = server
            .mock("GET", "/v1/compute/instances")
            .with_status(200)
            .with_body(body.to_string())
            .create_async()
            .await;

        let list = client.list_servers().await.unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "7");
        assert_eq!(list[0].region, "EU");
        auth_mock.assert_async().await;
        list_mock.assert_async().await;
    }
}
