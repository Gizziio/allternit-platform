//! Input validation utilities
//!
//! Provides validation functions for API inputs including:
//! - String length limits
//! - Email validation
//! - UUID validation
//! - Enum validation
//! - Sanitization

use crate::error::ApiError;
use lazy_static::lazy_static;
use regex::Regex;

/// Maximum lengths for various fields
pub const MAX_RUN_NAME_LENGTH: usize = 255;
pub const MAX_DESCRIPTION_LENGTH: usize = 1000;
pub const MAX_COMMAND_LENGTH: usize = 10000;
pub const MAX_EMAIL_LENGTH: usize = 254;
pub const MAX_TOKEN_NAME_LENGTH: usize = 100;

/// Validate a run name
pub fn validate_run_name(name: &str) -> Result<(), ApiError> {
    if name.is_empty() {
        return Err(ApiError::ValidationError("Run name cannot be empty".to_string()));
    }
    if name.len() > MAX_RUN_NAME_LENGTH {
        return Err(ApiError::ValidationError(format!(
            "Run name too long (max {} characters)",
            MAX_RUN_NAME_LENGTH
        )));
    }
    // Check for valid characters (alphanumeric, spaces, hyphens, underscores)
    let valid_name_regex = Regex::new(r"^[a-zA-Z0-9_\-\s]+$").unwrap();
    if !valid_name_regex.is_match(name) {
        return Err(ApiError::ValidationError(
            "Run name can only contain letters, numbers, spaces, hyphens, and underscores".to_string()
        ));
    }
    Ok(())
}

/// Validate an email address
pub fn validate_email(email: &str) -> Result<(), ApiError> {
    if email.is_empty() {
        return Err(ApiError::ValidationError("Email cannot be empty".to_string()));
    }
    if email.len() > MAX_EMAIL_LENGTH {
        return Err(ApiError::ValidationError(format!(
            "Email too long (max {} characters)",
            MAX_EMAIL_LENGTH
        )));
    }
    
    lazy_static! {
        static ref EMAIL_REGEX: Regex = Regex::new(
            r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        ).unwrap();
    }
    
    if !EMAIL_REGEX.is_match(email) {
        return Err(ApiError::ValidationError("Invalid email format".to_string()));
    }
    Ok(())
}

/// Validate a description
pub fn validate_description(desc: &str) -> Result<(), ApiError> {
    if desc.len() > MAX_DESCRIPTION_LENGTH {
        return Err(ApiError::ValidationError(format!(
            "Description too long (max {} characters)",
            MAX_DESCRIPTION_LENGTH
        )));
    }
    Ok(())
}

/// Validate a command string
pub fn validate_command(cmd: &str) -> Result<(), ApiError> {
    if cmd.len() > MAX_COMMAND_LENGTH {
        return Err(ApiError::ValidationError(format!(
            "Command too long (max {} characters)",
            MAX_COMMAND_LENGTH
        )));
    }
    Ok(())
}

/// Validate a UUID string
pub fn validate_uuid(id: &str) -> Result<(), ApiError> {
    if uuid::Uuid::parse_str(id).is_err() {
        return Err(ApiError::ValidationError(format!("Invalid UUID format: {}", id)));
    }
    Ok(())
}

/// Sanitize a string to prevent injection attacks
pub fn sanitize_string(input: &str) -> String {
    // Remove null bytes
    let mut sanitized = input.replace('\0', "");
    // Trim whitespace
    sanitized = sanitized.trim().to_string();
    // Limit length to prevent DoS
    if sanitized.len() > 10000 {
        sanitized.truncate(10000);
    }
    sanitized
}

/// Validate environment variable key
pub fn validate_env_key(key: &str) -> Result<(), ApiError> {
    if key.is_empty() {
        return Err(ApiError::ValidationError("Environment variable key cannot be empty".to_string()));
    }
    // Environment variable keys should be alphanumeric with underscores
    let valid_key_regex = Regex::new(r"^[a-zA-Z_][a-zA-Z0-9_]*$").unwrap();
    if !valid_key_regex.is_match(key) {
        return Err(ApiError::ValidationError(
            "Invalid environment variable key format".to_string()
        ));
    }
    Ok(())
}

/// Validate token name
pub fn validate_token_name(name: &str) -> Result<(), ApiError> {
    if name.is_empty() {
        return Err(ApiError::ValidationError("Token name cannot be empty".to_string()));
    }
    if name.len() > MAX_TOKEN_NAME_LENGTH {
        return Err(ApiError::ValidationError(format!(
            "Token name too long (max {} characters)",
            MAX_TOKEN_NAME_LENGTH
        )));
    }
    Ok(())
}

/// Validate pagination parameters
pub fn validate_pagination(limit: Option<i64>, offset: Option<i64>) -> Result<(), ApiError> {
    if let Some(l) = limit {
        if l < 0 || l > 1000 {
            return Err(ApiError::ValidationError(
                "Limit must be between 0 and 1000".to_string()
            ));
        }
    }
    if let Some(o) = offset {
        if o < 0 {
            return Err(ApiError::ValidationError("Offset cannot be negative".to_string()));
        }
    }
    Ok(())
}

/// Validate cron expression format
pub fn validate_cron_expression(cron: &str) -> Result<(), ApiError> {
    // Basic validation - cron::Schedule will do the real validation
    if cron.is_empty() {
        return Err(ApiError::ValidationError("Cron expression cannot be empty".to_string()));
    }
    if cron.len() > 100 {
        return Err(ApiError::ValidationError("Cron expression too long".to_string()));
    }
    Ok(())
}

/// Combined validation for run creation
pub struct RunValidationInput<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub command: Option<&'a str>,
}

impl<'a> RunValidationInput<'a> {
    pub fn validate(&self) -> Result<(), ApiError> {
        validate_run_name(self.name)?;
        
        if let Some(desc) = self.description {
            validate_description(desc)?;
        }
        
        if let Some(cmd) = self.command {
            validate_command(cmd)?;
        }
        
        Ok(())
    }
}

/// Validation trait for request types
pub trait Validatable {
    fn validate(&self) -> Result<(), ApiError>;
}
