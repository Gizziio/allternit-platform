//! Hetzner Cloud API client for provisioning Incus hosts.

use super::{CloudProvider, CloudProviderError, CreateServerRequest, ProviderKind, ServerInfo, ServerStatus};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{info, warn};

const DEFAULT_BASE_URL: &str = "https://api.hetzner.cloud/v1";
const DEFAULT_IMAGE: &str = "ubuntu-24.04";
const DEFAULT_REGION: &str = "ash"; // US-east (Ashburn)
const DEFAULT_TYPE: &str = "cpx21";

#[derive(Debug, Clone)]
pub struct HetznerClient {
    token: String,
    base_url: String,
    default_region: String,
    default_type: String,
    ssh_key_id: Option<String>,
    poll_interval: Duration,
}

impl HetznerClient {
    pub fn new(
        token: impl Into<String>,
        base_url: impl Into<String>,
        default_region: impl Into<String>,
        default_type: impl Into<String>,
        ssh_key_id: Option<String>,
    ) -> Self {
        Self {
            token: token.into(),
            base_url: base_url.into(),
            default_region: default_region.into(),
            default_type: default_type.into(),
            ssh_key_id,
            poll_interval: Duration::from_secs(5),
        }
    }

    #[cfg(test)]
    pub fn with_poll_interval(mut self, interval: Duration) -> Self {
        self.poll_interval = interval;
        self
    }

    pub fn from_env() -> Result<Self, CloudProviderError> {
        let token = std::env::var("HETZNER_API_TOKEN")
            .ok()
            .filter(|s| !s.is_empty())
            .ok_or_else(|| CloudProviderError::MissingCredentials("HETZNER_API_TOKEN".to_string()))?;

        let base_url = std::env::var("HETZNER_API_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());

        let default_region = std::env::var("HETZNER_DEFAULT_REGION")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_REGION.to_string());

        let default_type = std::env::var("HETZNER_DEFAULT_TYPE")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_TYPE.to_string());

        let ssh_key_id = std::env::var("HETZNER_SSH_KEY_ID")
            .ok()
            .filter(|s| !s.is_empty());

        Ok(Self::new(
            token,
            base_url,
            default_region,
            default_type,
            ssh_key_id,
        ))
    }

    fn client(&self) -> Result<reqwest::Client, CloudProviderError> {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| CloudProviderError::Request(format!("build client: {e}")))
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url.trim_end_matches('/'), path)
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.token)
    }

    async fn request(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<(u16, serde_json::Value), CloudProviderError> {
        let client = self.client()?;
        let url = self.url(path);
        let mut req = client
            .request(method, &url)
            .header("Authorization", self.auth_header())
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
struct CreateServerBody {
    name: String,
    server_type: String,
    location: String,
    image: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    ssh_keys: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    labels: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
struct ServerResponse {
    server: Server,
}

#[derive(Debug, Deserialize)]
struct ServersResponse {
    servers: Vec<Server>,
}

#[derive(Debug, Deserialize)]
struct Server {
    id: u64,
    name: String,
    status: String,
    server_type: ServerType,
    datacenter: Datacenter,
    public_net: PublicNet,
}

#[derive(Debug, Deserialize)]
struct ServerType {
    name: String,
}

#[derive(Debug, Deserialize)]
struct Datacenter {
    location: Location,
}

#[derive(Debug, Deserialize)]
struct Location {
    name: String,
}

#[derive(Debug, Deserialize)]
struct PublicNet {
    ipv4: Option<Ipv4>,
}

#[derive(Debug, Deserialize)]
struct Ipv4 {
    ip: String,
}

fn map_status(s: &str) -> ServerStatus {
    match s {
        "running" => ServerStatus::Running,
        "off" => ServerStatus::Stopped,
        "deleting" | "deleted" => ServerStatus::Terminated,
        "error" => ServerStatus::Error,
        _ => ServerStatus::Provisioning,
    }
}

fn server_to_info(s: &Server) -> ServerInfo {
    ServerInfo {
        id: s.id.to_string(),
        name: s.name.clone(),
        status: map_status(&s.status),
        ipv4: s.public_net.ipv4.as_ref().map(|ip| ip.ip.clone()),
        region: s.datacenter.location.name.clone(),
        plan: s.server_type.name.clone(),
    }
}

#[async_trait]
impl CloudProvider for HetznerClient {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Hetzner
    }

    async fn create_server(
        &self,
        req: CreateServerRequest,
    ) -> Result<ServerInfo, CloudProviderError> {
        let name = if req.name.is_empty() {
            format!("allternit-host-{}", uuid::Uuid::new_v4().simple())
        } else {
            req.name
        };

        let ssh_keys = self
            .ssh_key_id
            .clone()
            .or_else(|| req.ssh_key_id.clone())
            .map(|k| vec![k]);

        let body = CreateServerBody {
            name: name.clone(),
            server_type: req.plan.unwrap_or_else(|| self.default_type.clone()),
            location: req.region.unwrap_or_else(|| self.default_region.clone()),
            image: DEFAULT_IMAGE.to_string(),
            ssh_keys,
            user_data: req.user_data,
            labels: {
                let mut m = serde_json::Map::new();
                m.insert(
                    "managed-by".to_string(),
                    serde_json::Value::String("allternit".to_string()),
                );
                Some(m)
            },
        };

        let (status, json) = self
            .request(reqwest::Method::POST, "/servers", Some(serde_json::to_value(body).unwrap()))
            .await?;

        if status >= 400 {
            return Err(CloudProviderError::from_api_status(
                status,
                json.to_string(),
            ));
        }

        let server: ServerResponse = serde_json::from_value(json)
            .map_err(|e| CloudProviderError::Request(format!("parse create response: {e}")))?;

        info!(server_id = server.server.id, name = %name, "Hetzner server created");

        // Poll until the server is running and has an IPv4 address.
        for attempt in 0..60 {
            tokio::time::sleep(self.poll_interval).await;
            match self.get_server(&server.server.id.to_string()).await {
                Ok(Some(info)) => {
                    if info.status == ServerStatus::Running && info.ipv4.is_some() {
                        return Ok(info);
                    }
                    if info.status == ServerStatus::Error {
                        return Err(CloudProviderError::Api {
                            status: 500,
                            message: format!("server entered error state: {:?}", info),
                        });
                    }
                    if attempt % 6 == 0 {
                        info!(server_id = server.server.id, status = ?info.status, "waiting for Hetzner server");
                    }
                }
                Ok(None) => {}
                Err(e) => warn!(error = %e, "error polling Hetzner server"),
            }
        }

        Err(CloudProviderError::Request(
            "Hetzner server did not become running in time".to_string(),
        ))
    }

    async fn delete_server(&self, id: &str) -> Result<(), CloudProviderError> {
        let (status, json) = self
            .request(reqwest::Method::DELETE, &format!("/servers/{id}"), None)
            .await?;
        if status >= 400 {
            return Err(CloudProviderError::from_api_status(status, json.to_string()));
        }
        Ok(())
    }

    async fn get_server(&self, id: &str) -> Result<Option<ServerInfo>, CloudProviderError> {
        let (status, json) = self
            .request(reqwest::Method::GET, &format!("/servers/{id}"), None)
            .await?;
        if status == 404 {
            return Ok(None);
        }
        if status >= 400 {
            return Err(CloudProviderError::from_api_status(status, json.to_string()));
        }
        let resp: ServerResponse = serde_json::from_value(json)
            .map_err(|e| CloudProviderError::Request(format!("parse server response: {e}")))?;
        Ok(Some(server_to_info(&resp.server)))
    }

    async fn list_servers(&self) -> Result<Vec<ServerInfo>, CloudProviderError> {
        let (status, json) = self
            .request(reqwest::Method::GET, "/servers", None)
            .await?;
        if status >= 400 {
            return Err(CloudProviderError::from_api_status(status, json.to_string()));
        }
        let resp: ServersResponse = serde_json::from_value(json)
            .map_err(|e| CloudProviderError::Request(format!("parse servers response: {e}")))?;
        Ok(resp.servers.iter().map(server_to_info).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::Server;

    fn client_for(server: &Server) -> HetznerClient {
        HetznerClient::new(
            "test-token",
            server.url(),
            "ash",
            "cpx21",
            Some("key-1".to_string()),
        )
        .with_poll_interval(Duration::from_millis(10))
    }

    fn server_json(id: u64, status: &str, ipv4: Option<&str>) -> serde_json::Value {
        serde_json::json!({
            "server": {
                "id": id,
                "name": "allternit-host",
                "status": status,
                "server_type": { "name": "cpx21" },
                "datacenter": { "location": { "name": "ash" } },
                "public_net": {
                    "ipv4": ipv4.map(|ip| serde_json::json!({ "ip": ip }))
                }
            }
        })
    }

    #[tokio::test]
    async fn create_server_polls_until_running_and_ipv4() {
        let mut server = Server::new_async().await;
        let client = client_for(&server);

        let create_mock = server
            .mock("POST", "/servers")
            .with_status(201)
            .with_body(server_json(123, "initializing", None).to_string())
            .create_async()
            .await;

        let get_mock = server
            .mock("GET", "/servers/123")
            .with_status(200)
            .with_body(server_json(123, "running", Some("10.0.0.1")).to_string())
            .expect_at_least(1)
            .create_async()
            .await;

        let req = CreateServerRequest {
            name: "test-host".to_string(),
            region: Some("ash".to_string()),
            plan: Some("cpx21".to_string()),
            ssh_key_id: None,
            user_data: None,
        };
        let info = client.create_server(req).await.unwrap();

        assert_eq!(info.id, "123");
        assert_eq!(info.status, ServerStatus::Running);
        assert_eq!(info.ipv4, Some("10.0.0.1".to_string()));
        create_mock.assert_async().await;
        get_mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_server_returns_none_on_404() {
        let mut server = Server::new_async().await;
        let client = client_for(&server);

        let mock = server
            .mock("GET", "/servers/999")
            .with_status(404)
            .create_async()
            .await;

        let info = client.get_server("999").await.unwrap();
        assert!(info.is_none());
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn list_servers_parses_response() {
        let mut server = Server::new_async().await;
        let client = client_for(&server);

        let body = serde_json::json!({
            "servers": [
                {
                    "id": 1,
                    "name": "host-1",
                    "status": "running",
                    "server_type": { "name": "cpx11" },
                    "datacenter": { "location": { "name": "nbg1" } },
                    "public_net": { "ipv4": { "ip": "10.0.0.2" } }
                }
            ]
        });
        let mock = server
            .mock("GET", "/servers")
            .with_status(200)
            .with_body(body.to_string())
            .create_async()
            .await;

        let list = client.list_servers().await.unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "1");
        assert_eq!(list[0].region, "nbg1");
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn delete_server_returns_ok_on_204() {
        let mut server = Server::new_async().await;
        let client = client_for(&server);

        let mock = server
            .mock("DELETE", "/servers/123")
            .with_status(204)
            .create_async()
            .await;

        client.delete_server("123").await.unwrap();
        mock.assert_async().await;
    }
}
