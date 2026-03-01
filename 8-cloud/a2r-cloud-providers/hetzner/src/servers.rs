//! Server Client
//!
//! Hetzner server API wrapper.

pub struct ServerClient {
    #[allow(dead_code)]
    api_token: String,
}

impl ServerClient {
    pub fn new(api_token: &str) -> Self {
        Self {
            api_token: api_token.to_string(),
        }
    }
    
    pub async fn create_server(&self, _name: &str, _type: &str, _location: &str) -> Result<String, String> {
        Ok(format!("hz-{}", &uuid::Uuid::new_v4().to_string()[..8]))
    }
    
    pub async fn delete_server(&self, _server_id: &str) -> Result<(), String> {
        Ok(())
    }
    
    pub async fn get_server(&self, _server_id: &str) -> Result<String, String> {
        Ok("running".to_string())
    }
}
