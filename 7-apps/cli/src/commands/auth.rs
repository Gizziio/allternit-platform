//! Auth commands for CLI authentication
//!
//! Provides login/logout/whoami functionality with secure token storage.

use anyhow::{anyhow, Result};
use clap::{Args, Subcommand};
use dialoguer::Password;

#[derive(Args, Debug, Clone)]
pub struct AuthArgs {
    #[command(subcommand)]
    pub command: AuthCommands,
}

#[derive(Subcommand, Debug, Clone)]
pub enum AuthCommands {
    /// Login to A2R Cloud API
    Login {
        /// API base URL (defaults to A2R_CLOUD_URL env var or http://localhost:3001)
        #[arg(short, long)]
        url: Option<String>,
        /// API token (will prompt if not provided)
        #[arg(short, long)]
        token: Option<String>,
    },
    /// Logout and clear stored credentials
    Logout,
    /// Show current authentication status
    Whoami,
    /// Validate stored token
    Validate,
}

/// Handle auth commands
pub async fn handle_auth(args: AuthArgs) -> Result<()> {
    match args.command {
        AuthCommands::Login { url, token } => login(url, token).await,
        AuthCommands::Logout => logout(),
        AuthCommands::Whoami => whoami().await,
        AuthCommands::Validate => validate().await,
    }
}

/// Login to A2R Cloud API
async fn login(url: Option<String>, token: Option<String>) -> Result<()> {
    // Determine API URL
    let api_url = url
        .or_else(|| std::env::var("A2R_CLOUD_URL").ok())
        .unwrap_or_else(|| "http://localhost:3001".to_string());

    // Get token - prompt if not provided
    let api_token = match token {
        Some(t) => t,
        None => {
            println!("Please enter your A2R API token:");
            Password::new()
                .with_prompt("Token")
                .interact()
                .map_err(|e| anyhow!("Failed to read token: {}", e))?
        }
    };

    // Validate token by making a test request
    print!("Validating token... ");
    
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/v1/auth/me", api_url))
        .bearer_auth(&api_token)
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => {
            let user: serde_json::Value = resp.json().await
                .map_err(|e| anyhow!("Failed to parse user info: {}", e))?;
            
            // Store credentials
            save_credentials(&api_url, &api_token)?;
            
            println!("✓");
            println!("\n✅ Successfully logged in to {}", api_url);
            if let Some(email) = user.get("email").and_then(|v| v.as_str()) {
                println!("   User: {}", email);
            }
            if let Some(role) = user.get("role").and_then(|v| v.as_str()) {
                println!("   Role: {}", role);
            }
        }
        Ok(resp) => {
            println!("✗");
            return Err(anyhow!(
                "Authentication failed: HTTP {} - {}",
                resp.status(),
                resp.text().await.unwrap_or_default()
            ));
        }
        Err(e) => {
            println!("✗");
            return Err(anyhow!("Connection failed: {}", e));
        }
    }

    Ok(())
}

/// Logout and clear credentials
fn logout() -> Result<()> {
    let config_dir = get_config_dir()?;
    let creds_file = config_dir.join("credentials.json");
    
    if creds_file.exists() {
        std::fs::remove_file(&creds_file)
            .map_err(|e| anyhow!("Failed to remove credentials: {}", e))?;
        println!("✅ Logged out successfully");
    } else {
        println!("ℹ️  Not currently logged in");
    }
    
    Ok(())
}

/// Show current user info
async fn whoami() -> Result<()> {
    let (api_url, token) = match load_credentials() {
        Some(creds) => (creds.url, creds.token),
        None => {
            println!("ℹ️  Not logged in. Run 'a2r auth login' to authenticate.");
            return Ok(());
        }
    };

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/v1/auth/me", api_url))
        .bearer_auth(&token)
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => {
            let user: serde_json::Value = resp.json().await?;
            
            println!("Authenticated to: {}", api_url);
            println!();
            
            if let Some(id) = user.get("id").and_then(|v| v.as_str()) {
                println!("  ID:       {}", id);
            }
            if let Some(email) = user.get("email").and_then(|v| v.as_str()) {
                println!("  Email:    {}", email);
            }
            if let Some(name) = user.get("name").and_then(|v| v.as_str()) {
                println!("  Name:     {}", name);
            }
            if let Some(role) = user.get("role").and_then(|v| v.as_str()) {
                println!("  Role:     {}", role);
            }
        }
        Ok(resp) => {
            println!("⚠️  Token validation failed: HTTP {}", resp.status());
            println!("   Run 'a2r auth login' to re-authenticate.");
        }
        Err(e) => {
            println!("⚠️  Connection failed: {}", e);
        }
    }

    Ok(())
}

/// Validate stored token
async fn validate() -> Result<()> {
    let (api_url, token) = match load_credentials() {
        Some(creds) => (creds.url, creds.token),
        None => {
            println!("ℹ️  Not logged in");
            std::process::exit(1);
        }
    };

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/v1/auth/me", api_url))
        .bearer_auth(&token)
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => {
            println!("✅ Token is valid");
            Ok(())
        }
        Ok(resp) => {
            println!("❌ Token is invalid: HTTP {}", resp.status());
            std::process::exit(1);
        }
        Err(e) => {
            println!("❌ Connection failed: {}", e);
            std::process::exit(1);
        }
    }
}

/// Credentials storage
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Credentials {
    pub url: String,
    pub token: String,
}

/// Get config directory
fn get_config_dir() -> Result<std::path::PathBuf> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| anyhow!("HOME environment variable not set"))?;
    
    let config_dir = std::path::PathBuf::from(home)
        .join(".config")
        .join("a2r");
    
    // Create directory if it doesn't exist
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| anyhow!("Failed to create config directory: {}", e))?;
    
    Ok(config_dir)
}

/// Save credentials to file
fn save_credentials(url: &str, token: &str) -> Result<()> {
    let config_dir = get_config_dir()?;
    let creds_file = config_dir.join("credentials.json");
    
    let creds = Credentials {
        url: url.to_string(),
        token: token.to_string(),
    };
    
    // Set restrictive permissions (owner read/write only)
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    
    let json = serde_json::to_string_pretty(&creds)
        .map_err(|e| anyhow!("Failed to serialize credentials: {}", e))?;
    
    std::fs::write(&creds_file, json)
        .map_err(|e| anyhow!("Failed to write credentials: {}", e))?;
    
    // Set file permissions to 600 (owner read/write only)
    #[cfg(unix)]
    {
        let mut perms = std::fs::metadata(&creds_file)?.permissions();
        perms.set_mode(0o600);
        std::fs::set_permissions(&creds_file, perms)?;
    }
    
    Ok(())
}

/// Load credentials from file
fn load_credentials() -> Option<Credentials> {
    let config_dir = get_config_dir().ok()?;
    let creds_file = config_dir.join("credentials.json");
    
    let json = std::fs::read_to_string(&creds_file).ok()?;
    serde_json::from_str(&json).ok()
}

/// Get API URL from stored credentials or environment
pub fn get_api_url() -> Option<String> {
    load_credentials().map(|c| c.url)
        .or_else(|| std::env::var("A2R_CLOUD_URL").ok())
}

/// Get auth token from stored credentials
pub fn get_auth_token() -> Option<String> {
    load_credentials().map(|c| c.token)
}

/// Get stored credentials
pub fn get_credentials() -> Option<Credentials> {
    load_credentials()
}


