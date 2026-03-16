//! Authentication commands

use colored::Colorize;
use dialoguer::{Input, Password};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::config::{save_config, Config};
use crate::error::{CliError, Result};

/// Token file path for JWT storage
fn get_token_path() -> Result<PathBuf> {
    let home = dirs::home_dir()
        .ok_or_else(|| CliError::Config("Could not find home directory".to_string()))?;
    Ok(home.join(".config").join("a2r").join("token"))
}

/// Save JWT token to file
async fn save_token(token: &str) -> Result<()> {
    let token_path = get_token_path()?;
    
    // Ensure parent directory exists
    if let Some(parent) = token_path.parent() {
        tokio::fs::create_dir_all(parent).await
            .map_err(|e| CliError::Io(e))?;
    }
    
    // Write token with restricted permissions (owner read/write only)
    tokio::fs::write(&token_path, token).await
        .map_err(|e| CliError::Io(e))?;
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&token_path)?.permissions();
        perms.set_mode(0o600); // owner read/write only
        std::fs::set_permissions(&token_path, perms)?;
    }
    
    Ok(())
}

/// Load JWT token from file
async fn load_token() -> Result<Option<String>> {
    let token_path = get_token_path()?;
    
    if !token_path.exists() {
        return Ok(None);
    }
    
    let token = tokio::fs::read_to_string(&token_path).await
        .map_err(|e| CliError::Io(e))?;
    
    Ok(Some(token.trim().to_string()))
}

/// Delete JWT token file
async fn delete_token() -> Result<()> {
    let token_path = get_token_path()?;
    
    if token_path.exists() {
        tokio::fs::remove_file(&token_path).await
            .map_err(|e| CliError::Io(e))?;
    }
    
    Ok(())
}

/// Login request payload
#[derive(Serialize)]
struct LoginRequest {
    email: String,
    password: String,
}

/// Login response
#[derive(Deserialize)]
struct LoginResponse {
    access_token: String,
    token_type: String,
    expires_in: Option<u64>,
}

/// Error response from auth API
#[derive(Deserialize)]
struct AuthErrorResponse {
    error: String,
    message: Option<String>,
}

/// Login to A2R cloud
pub async fn login(mut config: Config) -> Result<()> {
    println!("{}", "Login to A2R Cloud".bold().underline());
    println!();
    
    // Prompt for email
    let email: String = Input::new()
        .with_prompt("Email")
        .interact_text()
        .map_err(|e| CliError::Internal(format!("Input error: {}", e)))?;
    
    // Validate email format
    if !email.contains('@') || !email.contains('.') {
        return Err(CliError::Config("Please enter a valid email address".to_string()));
    }
    
    // Prompt for password (hidden input)
    let password = Password::new()
        .with_prompt("Password")
        .interact()
        .map_err(|e| CliError::Internal(format!("Input error: {}", e)))?;
    
    println!();
    println!("{}", "Authenticating...".dimmed());
    
    // Create HTTP client
    let client = reqwest::Client::new();
    
    // Build login URL
    let login_url = format!("{}/api/v1/auth/login", config.api_endpoint);
    
    // Send login request
    let login_request = LoginRequest {
        email: email.clone(),
        password,
    };
    
    let response = client
        .post(&login_url)
        .header(CONTENT_TYPE, "application/json")
        .json(&login_request)
        .send()
        .await?;
    
    match response.status() {
        reqwest::StatusCode::OK => {
            // Parse successful response
            let login_response: LoginResponse = response.json().await
                .map_err(|e| CliError::Internal(format!(
                    "Failed to parse login response: {}", e
                )))?;
            
            let token = login_response.access_token;
            
            // Validate token format (should be JWT)
            if !token.split('.').count() == 3 {
                return Err(CliError::Internal(
                    "Invalid token format received from server".to_string()
                ));
            }
            
            // Save token to file
            save_token(&token).await?;
            
            // Update config with token (for backward compatibility)
            config.auth_token = Some(token.clone());
            save_config(&config).await?;
            
            println!();
            println!("{}", "✓ Login successful".green().bold());
            println!();
            println!("  Welcome back, {}!", email.dimmed());
            
            if let Some(expires_in) = login_response.expires_in {
                let hours = expires_in / 3600;
                println!("  Session expires in {} hours", hours);
            }
        }
        reqwest::StatusCode::UNAUTHORIZED => {
            let error_response: AuthErrorResponse = response.json().await
                .unwrap_or_else(|_| AuthErrorResponse {
                    error: "Unauthorized".to_string(),
                    message: Some("Invalid email or password".to_string()),
                });
            
            return Err(CliError::NotAuthenticated);
        }
        _ => {
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            
            return Err(CliError::Internal(format!(
                "Authentication failed: {}", error_text
            )));
        }
    }
    
    Ok(())
}

/// Logout from A2R cloud
pub async fn logout(config: Config) -> Result<()> {
    // Check if already logged out
    let token = load_token().await?;
    let config_has_token = config.auth_token.is_some();
    
    if token.is_none() && !config_has_token {
        println!("{}", "Already logged out".yellow());
        return Ok(());
    }
    
    // Get the token for the logout request
    let token_to_invalidate = token.clone()
        .or_else(|| config.auth_token.clone())
        .unwrap_or_default();
    
    println!("{}", "Logging out...".dimmed());
    
    // Call logout API if we have a token
    if !token_to_invalidate.is_empty() {
        let client = reqwest::Client::new();
        let logout_url = format!("{}/api/v1/auth/logout", config.api_endpoint);
        
        let mut headers = HeaderMap::new();
        let auth_value = format!("Bearer {}", token_to_invalidate);
        if let Ok(header_val) = HeaderValue::from_str(&auth_value) {
            headers.insert(AUTHORIZATION, header_val);
        }
        
        // Send logout request (best effort - don't fail if server is unreachable)
        let _ = client
            .post(&logout_url)
            .headers(headers)
            .send()
            .await;
    }
    
    // Delete token file
    delete_token().await?;
    
    // Also clear config token
    let mut config = config;
    config.auth_token = None;
    save_config(&config).await?;
    
    println!("{}", "✓ Logged out successfully".green().bold());
    
    Ok(())
}

/// Check if user is authenticated
pub async fn is_authenticated() -> bool {
    match load_token().await {
        Ok(Some(_)) => true,
        _ => false,
    }
}

/// Get authentication headers for API requests
pub async fn get_auth_headers(config: &Config) -> Result<HeaderMap> {
    let mut headers = HeaderMap::new();
    
    // Try to get token from file first, then from config
    let token = load_token().await?
        .or_else(|| config.auth_token.clone())
        .ok_or(CliError::NotAuthenticated)?;
    
    let auth_value = format!("Bearer {}", token);
    let header_val = HeaderValue::from_str(&auth_value)
        .map_err(|e| CliError::Internal(format!("Invalid auth header: {}", e)))?;
    
    headers.insert(AUTHORIZATION, header_val);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    
    Ok(headers)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_token_path() {
        let path = get_token_path().unwrap();
        assert!(path.to_string_lossy().contains(".config/a2r/token"));
    }
}
