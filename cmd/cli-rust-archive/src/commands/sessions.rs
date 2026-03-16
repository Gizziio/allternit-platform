//! Session management commands

use chrono::{DateTime, Utc};
use colored::Colorize;
use tabled::{Table, Tabled};

use crate::config::Config;
use crate::error::{CliError, Result};
use crate::sessions::SessionManager;
use crate::sessions::CliSession;

/// List active sessions
pub async fn list_sessions(config: Config) -> Result<()> {
    println!("{}", "Active Sessions".bold().underline());
    println!();
    
    // Create session manager to query sessions
    let session_manager = SessionManager::new(false).await
        .map_err(|e| CliError::Session(format!("Failed to create session manager: {}", e)))?;
    
    // Query all active sessions
    let sessions = session_manager.list_sessions().await
        .map_err(|e| CliError::Session(format!("Failed to list sessions: {}", e)))?;
    
    #[derive(Tabled)]
    struct SessionRow {
        #[tabled(rename = "ID")]
        id: String,
        #[tabled(rename = "Name")]
        name: String,
        #[tabled(rename = "Status")]
        status: String,
        #[tabled(rename = "Created")]
        created: String,
    }
    
    let rows: Vec<SessionRow> = sessions.iter().map(|s| SessionRow {
        id: s.id.to_string().split('-').next().unwrap_or("unknown").to_string(),
        name: s.name.clone(),
        status: format!("{:?}", s.status),
        created: format_datetime(s.created_at),
    }).collect();
    
    let row_count = rows.len();
    if rows.is_empty() {
        println!("{}", "No active sessions".dimmed());
    } else {
        let table = Table::new(rows);
        println!("{}", table);
        println!();
        println!("{} session(s) found", row_count);
    }
    
    Ok(())
}

/// Kill/destroy a session
pub async fn kill_session(config: Config, session_id_str: String) -> Result<()> {
    println!("{} session {}", "Killing".red().bold(), session_id_str);
    println!();
    
    // Parse session ID
    let session_id = parse_session_id(&session_id_str)
        .map_err(|e| CliError::Session(format!("Invalid session ID '{}': {}", session_id_str, e)))?;
    
    // Create session manager
    let session_manager = SessionManager::new(false).await
        .map_err(|e| CliError::Session(format!("Failed to create session manager: {}", e)))?;
    
    // First verify the session exists
    let sessions = session_manager.list_sessions().await
        .map_err(|e| CliError::Session(format!("Failed to list sessions: {}", e)))?;
    
    let session_exists = sessions.iter().any(|s| s.id == session_id);
    
    if !session_exists {
        return Err(CliError::Session(format!(
            "Session '{}' not found or already terminated", 
            session_id_str
        )));
    }
    
    // Destroy the session
    session_manager.destroy_session(session_id).await
        .map_err(|e| CliError::Session(format!(
            "Failed to destroy session '{}': {}", 
            session_id_str, e
        )))?;
    
    println!("{} Session {} has been terminated", 
        "✓".green().bold(), 
        session_id_str
    );
    
    Ok(())
}

/// Parse a session ID from string
fn parse_session_id(s: &str) -> Result<a2r_session_manager::types::SessionId> {
    // Try to parse as UUID first
    if let Ok(uuid) = uuid::Uuid::parse_str(s) {
        return Ok(a2r_session_manager::types::SessionId(uuid));
    }
    
    // Try to parse as a short ID (8 hex chars)
    if s.len() == 8 {
        // Try to find session by short ID prefix
        // For now, return error indicating full UUID is needed
        return Err(CliError::Session(
            "Short session IDs not yet supported, please use the full UUID".to_string()
        ));
    }
    
    Err(CliError::Session(format!(
        "Invalid session ID format: '{}' (expected UUID)", 
        s
    )))
}

/// Format a datetime for display
fn format_datetime(dt: DateTime<Utc>) -> String {
    let now = Utc::now();
    let duration = now.signed_duration_since(dt);
    
    if duration.num_seconds() < 60 {
        "just now".to_string()
    } else if duration.num_minutes() < 60 {
        format!("{} min ago", duration.num_minutes())
    } else if duration.num_hours() < 24 {
        format!("{} hours ago", duration.num_hours())
    } else {
        format!("{}", dt.format("%Y-%m-%d %H:%M"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_format_datetime() {
        let now = Utc::now();
        assert_eq!(format_datetime(now), "just now");
        
        let five_min_ago = now - chrono::Duration::minutes(5);
        assert_eq!(format_datetime(five_min_ago), "5 min ago");
        
        let two_hours_ago = now - chrono::Duration::hours(2);
        assert_eq!(format_datetime(two_hours_ago), "2 hours ago");
    }
}
