//! Hetzner Cloud API Client

use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use crate::error::HetznerError;

/// Hetzner Cloud API client
pub struct HetznerClient {
    client: Client,
    api_token: String,
    base_url: String,
}

impl HetznerClient {
    /// Create a new Hetzner client
    pub fn new(api_token: &str) -> Self {
        Self {
            client: Client::new(),
            api_token: api_token.to_string(),
            base_url: "https://api.hetzner.cloud/v1".to_string(),
        }
    }
    
    /// Validate API token
    pub async fn validate_token(&self) -> Result<bool, HetznerError> {
        let url = format!("{}/servers", self.base_url);
        
        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await?;
        
        match response.status() {
            StatusCode::OK | StatusCode::UNAUTHORIZED => {
                Ok(response.status() == StatusCode::OK)
            }
            _ => Err(HetznerError::ApiError(format!("Unexpected status: {}", response.status())))
        }
    }
    
    /// Create a server (VPS)
    pub async fn create_server(&self, request: &CreateServerRequest) -> Result<Server, HetznerError> {
        let url = format!("{}/servers", self.base_url);
        
        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .json(request)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let error = response.text().await?;
            return Err(HetznerError::ApiError(error));
        }
        
        let result: CreateServerResponse = response.json().await?;
        Ok(result.server)
    }
    
    /// Get server by ID
    pub async fn get_server(&self, server_id: i64) -> Result<Server, HetznerError> {
        let url = format!("{}/servers/{}", self.base_url, server_id);
        
        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(HetznerError::ServerNotFound(server_id));
        }
        
        let result: GetServerResponse = response.json().await?;
        Ok(result.server)
    }
    
    /// Delete server
    pub async fn delete_server(&self, server_id: i64) -> Result<(), HetznerError> {
        let url = format!("{}/servers/{}", self.base_url, server_id);
        
        let response = self.client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(HetznerError::ApiError(format!("Failed to delete server: {}", response.status())));
        }
        
        Ok(())
    }
    
    /// List available locations
    pub async fn list_locations(&self) -> Result<Vec<Location>, HetznerError> {
        let url = format!("{}/locations", self.base_url);
        
        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(HetznerError::ApiError(format!("Failed to list locations: {}", response.status())));
        }
        
        let result: ListLocationsResponse = response.json().await?;
        Ok(result.locations)
    }
    
    /// List available server types
    pub async fn list_server_types(&self) -> Result<Vec<ServerType>, HetznerError> {
        let url = format!("{}/server_types", self.base_url);
        
        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(HetznerError::ApiError(format!("Failed to list server types: {}", response.status())));
        }
        
        let result: ListServerTypesResponse = response.json().await?;
        Ok(result.server_types)
    }
}

// Request/Response types

#[derive(Debug, Serialize)]
pub struct CreateServerRequest {
    pub name: String,
    pub server_type: String,
    pub image: String,
    pub location: String,
    pub public_keys: Option<Vec<String>>,
    pub start_after_create: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateServerResponse {
    pub server: Server,
    pub action: Action,
    pub next_actions: Option<Vec<Action>>,
}

#[derive(Debug, Deserialize)]
pub struct GetServerResponse {
    pub server: Server,
}

#[derive(Debug, Deserialize)]
pub struct ListLocationsResponse {
    pub locations: Vec<Location>,
}

#[derive(Debug, Deserialize)]
pub struct ListServerTypesResponse {
    pub server_types: Vec<ServerType>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Server {
    pub id: i64,
    pub name: String,
    pub status: String,
    pub public_net: PublicNet,
    pub server_type: ServerTypeInfo,
    pub location: LocationInfo,
    pub created: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PublicNet {
    pub ipv4: Ipv4,
    pub ipv6: Ipv6,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Ipv4 {
    pub ip: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Ipv6 {
    pub ip: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PrivateNet {
    pub ip: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerTypeInfo {
    pub name: String,
    pub vcpus: i32,
    pub memory: f64,
    pub disk: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LocationInfo {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Location {
    pub name: String,
    pub description: String,
    pub country: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerType {
    pub name: String,
    pub description: String,
    pub vcpus: i32,
    pub memory: f64,
    pub disk: i32,
    pub price: PriceInfo,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PriceInfo {
    pub net: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Action {
    pub id: i64,
    pub command: String,
    pub status: String,
}
