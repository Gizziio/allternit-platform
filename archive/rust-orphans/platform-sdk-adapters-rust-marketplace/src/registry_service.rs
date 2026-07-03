use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// External registry types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: String,
    pub downloads: i64,
    pub rating: f64,
    pub rating_count: i64,
    pub tags: Vec<String>,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub registry_type: String,
}

/// External registry types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RegistryType {
    GitHub,
    Npm,
    Cargo,
    Mcp,
    SkillsMP,
    Local,
}

/// Tool/Skill from external registry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalTool {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub registry_type: RegistryType,
    pub package_name: Option<String>,
    pub author: String,
    pub downloads: Option<i64>,
    pub stars: Option<i64>,
    pub repository_url: Option<String>,
    pub registry_url: Option<String>,
    pub install_command: Option<String>,
    pub capabilities: Vec<String>,
    pub license: Option<String>,
    pub homepage: Option<String>,
}

/// MCP Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub id: String,
    pub name: String,
    pub description: String,
    pub endpoint: String,
    pub transport: String,
    pub capabilities: Vec<String>,
    pub is_enabled: bool,
}

/// Search filters for external registries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrySearchFilters {
    pub query: Option<String>,
    pub registry_type: Option<RegistryType>,
    pub author: Option<String>,
    pub tags: Option<Vec<String>>,
    pub sort_by: Option<String>,
}

/// Search response from external registries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrySearchResponse {
    pub tools: Vec<ExternalTool>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

/// External Registry Service
#[derive(Debug)]
pub struct ExternalRegistryService {
    kernel_url: String,
}

impl ExternalRegistryService {
    pub fn new(kernel_url: &str) -> Self {
        Self {
            kernel_url: kernel_url.to_string(),
        }
    }

    /// Search GitHub repositories
    pub async fn search_github(&self, query: &str) -> Result<Vec<ExternalTool>> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.github.com/search/repositories?q={}&sort=stars&per_page=10",
            query
        );

        let response: Value = client.get(&url).send().await?.json().await?;

        let tools = response["items"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|item| {
                let name = item.get("name").and_then(|v| v.as_str());
                let description = item.get("description").and_then(|v| v.as_str());
                let full_name = item.get("full_name");
                let html_url = item.get("html_url");
                let stargazers_count = item.get("stargazers_count");

                Some(ExternalTool {
                    id: full_name
                        .map(|s| format!("github:{}", s))
                        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
                    name: name.unwrap_or_else(|| "Unknown").to_string(),
                    description: description.unwrap_or_else(|| "").to_string(),
                    version: "latest".to_string(),
                    registry_type: RegistryType::GitHub,
                    author: item
                        .get("owner")
                        .and_then(|o| o.as_object())
                        .and_then(|o| o.get("login"))
                        .and_then(|s| s.as_str())
                        .unwrap_or_else(|| "Unknown")
                        .to_string(),
                    downloads: stargazers_count.and_then(|c| c.as_i64()),
                    stars: stargazers_count.and_then(|c| c.as_i64()),
                    package_name: full_name.map(|s| s.to_string()),
                    repository_url: html_url.and_then(|u| u.as_str()).map(|s| s.to_string()),
                    registry_url: Some("https://github.com".to_string()),
                    install_command: full_name
                        .and_then(|s| s.as_str())
                        .map(|s| "npx -g @".to_string() + s),
                    capabilities: vec![],
                    license: item
                        .get("license")
                        .and_then(|l| l.as_str())
                        .map(|s| s.to_string()),
                    homepage: item
                        .get("homepage")
                        .and_then(|h| h.as_str())
                        .map(|s| s.to_string()),
                })
            })
            .collect();

        Ok(tools)
    }

    /// Search npm packages
    pub async fn search_npm(&self, query: &str) -> Result<Vec<ExternalTool>> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://registry.npmjs.org/-/v1/search?text={}&size=20",
            query
        );

        let response: Value = client.get(&url).send().await?.json().await?;

        let tools = response["objects"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|item| {
                let name = item.get("name").and_then(|v| v.as_str());
                let description = item.get("description").and_then(|v| v.as_str());
                let version = item.get("version").and_then(|v| v.as_str());
                let keywords = item.get("keywords").and_then(|k| k.as_str());

                Some(ExternalTool {
                    id: format!("npm:{}", name.unwrap_or_else(|| "unknown")),
                    name: name.unwrap_or_else(|| "Unknown").to_string(),
                    description: description.unwrap_or_else(|| "").to_string(),
                    version: version.unwrap_or_else(|| "latest").to_string(),
                    registry_type: RegistryType::Npm,
                    author: item
                        .get("maintainers")
                        .and_then(|m| m.as_array())
                        .and_then(|m| m.get(0))
                        .and_then(|n| n.as_object())
                        .and_then(|n| n.get("name"))
                        .and_then(|n| n.as_str())
                        .unwrap_or_else(|| "Unknown")
                        .to_string(),
                    downloads: None,
                    stars: None,
                    package_name: name.map(|s| s.to_string()),
                    repository_url: name.map(|n| format!("https://www.npmjs.com/package/{}", n)),
                    registry_url: Some("https://registry.npmjs.org/".to_string()),
                    install_command: name.map(|n| "npm install ".to_string() + n),
                    capabilities: vec![],
                    license: item
                        .get("license")
                        .and_then(|l| l.as_str())
                        .map(|s| s.to_string()),
                    homepage: None,
                })
            })
            .collect();

        Ok(tools)
    }

    /// Search cargo packages
    pub async fn search_cargo(&self, query: &str) -> Result<Vec<ExternalTool>> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://crates.io/api/v1/crates?page=1&per_page=20&q={}",
            query
        );

        let response: Value = client.get(&url).send().await?.json().await?;

        let tools = response["crates"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|item| {
                let name = item.get("name").and_then(|v| v.as_str());
                let description = item.get("description").and_then(|v| v.as_str());
                let version = item.get("newest_version").and_then(|v| v.as_str());
                let downloads = item.get("downloads").and_then(|d| d.as_i64());

                Some(ExternalTool {
                    id: format!("cargo:{}", name.unwrap_or_else(|| "unknown")),
                    name: name.unwrap_or_else(|| "Unknown").to_string(),
                    description: description.unwrap_or_else(|| "").to_string(),
                    version: version.unwrap_or_else(|| "latest").to_string(),
                    registry_type: RegistryType::Cargo,
                    author: item
                        .get("owner")
                        .and_then(|o| o.as_str())
                        .unwrap_or_else(|| "Unknown")
                        .to_string(),
                    downloads,
                    stars: None,
                    package_name: name.map(|s| s.to_string()),
                    repository_url: name.map(|n| format!("https://crates.io/crates/{}", n)),
                    registry_url: Some("https://crates.io/".to_string()),
                    install_command: name.map(|n| "cargo install --git ".to_string() + n),
                    capabilities: vec![],
                    license: item
                        .get("license")
                        .and_then(|l| l.as_str())
                        .map(|s| s.to_string()),
                    homepage: None,
                })
            })
            .collect();

        Ok(tools)
    }

    /// Search MCP servers from configured list
    pub async fn search_mcp(&self, servers: &[McpServer]) -> Vec<ExternalTool> {
        servers
            .iter()
            .map(|server| {
                let capabilities_str = if !server.capabilities.is_empty() {
                    server.capabilities.join(", ")
                } else {
                    "standard tools".to_string()
                };

                ExternalTool {
                    id: server.id.clone(),
                    name: server.name.clone(),
                    description: server.description.clone(),
                    version: "latest".to_string(),
                    registry_type: RegistryType::Mcp,
                    author: "Server".to_string(),
                    downloads: None,
                    stars: None,
                    package_name: Some(server.name.clone()),
                    repository_url: Some(server.endpoint.clone()),
                    registry_url: Some(server.endpoint.clone()),
                    install_command: Some("Add via MCP".to_string()),
                    capabilities: capabilities_str
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .collect(),
                    license: None,
                    homepage: None,
                }
            })
            .collect()
    }

    /// Unified search across all registries
    pub async fn search_all_registries(
        service: &ExternalRegistryService,
        filters: &RegistrySearchFilters,
    ) -> Result<RegistrySearchResponse> {
        let mut all_tools = Vec::new();

        if filters.registry_type.is_none() || filters.registry_type == Some(RegistryType::GitHub) {
            if let Some(query) = &filters.query {
                let tools = service.search_github(query).await?;
                all_tools.extend(tools);
            }
        }

        if filters.registry_type.is_none() || filters.registry_type == Some(RegistryType::Npm) {
            if let Some(query) = &filters.query {
                let tools = service.search_npm(query).await?;
                all_tools.extend(tools);
            }
        }

        if filters.registry_type.is_none() || filters.registry_type == Some(RegistryType::Cargo) {
            if let Some(query) = &filters.query {
                let tools = service.search_cargo(query).await?;
                all_tools.extend(tools);
            }
        }

        Ok(RegistrySearchResponse {
            tools: all_tools.clone(),
            total: all_tools.len() as i64,
            page: 1,
            per_page: all_tools.len() as i64,
        })
    }
}
