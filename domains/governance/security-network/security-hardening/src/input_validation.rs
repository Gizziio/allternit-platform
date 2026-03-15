//! Input Validation Module
//!
//! Provides input validation rules and sanitization for various data types.

use regex::Regex;
use std::collections::HashMap;
use std::sync::Arc;

/// Validation rule types
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ValidationRule {
    /// Alphanumeric only
    Alphanumeric,
    /// Email format
    Email,
    /// UUID format
    Uuid,
    /// Custom regex pattern
    Pattern(String),
    /// Length constraints (min, max)
    Length(usize, usize),
    /// Allowed values list
    AllowedValues(Vec<String>),
    /// Numeric only
    Numeric,
    /// URL format
    Url,
    /// JSON format
    Json,
    /// Base64 format
    Base64,
    /// Hexadecimal format
    Hex,
    /// No special characters
    NoSpecialChars,
}

/// Input validator
pub struct InputValidator {
    rules: HashMap<String, Vec<ValidationRule>>,
    regex_cache: HashMap<String, Arc<Regex>>,
}

impl InputValidator {
    /// Create a new input validator with default rules
    pub fn new(custom_rules: &HashMap<String, Vec<ValidationRule>>) -> Self {
        let mut validator = Self {
            rules: HashMap::new(),
            regex_cache: HashMap::new(),
        };

        // Add built-in rules
        validator.add_default_rules();

        // Add custom rules
        for (context, rules) in custom_rules {
            validator.rules.insert(context.clone(), rules.clone());
        }

        // Compile regex patterns
        validator.compile_regex_patterns();

        validator
    }

    /// Add default validation rules
    fn add_default_rules(&mut self) {
        // Generic input rule
        self.rules.insert(
            "generic".to_string(),
            vec![
                ValidationRule::Length(1, 1000),
                ValidationRule::NoSpecialChars,
            ],
        );

        // Username rule
        self.rules.insert(
            "username".to_string(),
            vec![
                ValidationRule::Length(3, 32),
                ValidationRule::Pattern(r"^[a-zA-Z0-9_-]+$".to_string()),
            ],
        );

        // Email rule
        self.rules
            .insert("email".to_string(), vec![ValidationRule::Email]);

        // UUID rule
        self.rules
            .insert("uuid".to_string(), vec![ValidationRule::Uuid]);

        // URL rule
        self.rules
            .insert("url".to_string(), vec![ValidationRule::Url]);

        // API key rule
        self.rules.insert(
            "api_key".to_string(),
            vec![
                ValidationRule::Length(32, 128),
                ValidationRule::Alphanumeric,
            ],
        );

        // Path rule (for file paths)
        self.rules.insert(
            "path".to_string(),
            vec![
                ValidationRule::Length(1, 4096),
                ValidationRule::Pattern(r"^[a-zA-Z0-9_./-]+$".to_string()),
            ],
        );

        // Command rule
        self.rules.insert(
            "command".to_string(),
            vec![
                ValidationRule::Length(1, 256),
                ValidationRule::Pattern(r"^[a-zA-Z0-9_\- ]+$".to_string()),
            ],
        );

        // ID rule
        self.rules.insert(
            "id".to_string(),
            vec![
                ValidationRule::Length(1, 64),
                ValidationRule::Pattern(r"^[a-zA-Z0-9_-]+$".to_string()),
            ],
        );
    }

    /// Compile regex patterns
    fn compile_regex_patterns(&mut self) {
        // Email regex (simplified)
        if let Ok(re) = Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$") {
            self.regex_cache.insert("email".to_string(), Arc::new(re));
        }

        // UUID regex
        if let Ok(re) = Regex::new(
            r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        ) {
            self.regex_cache.insert("uuid".to_string(), Arc::new(re));
        }

        // URL regex (simplified)
        if let Ok(re) = Regex::new(r"^https?://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?$") {
            self.regex_cache.insert("url".to_string(), Arc::new(re));
        }

        // Base64 regex
        if let Ok(re) = Regex::new(r"^[A-Za-z0-9+/]*={0,2}$") {
            self.regex_cache.insert("base64".to_string(), Arc::new(re));
        }

        // Hex regex
        if let Ok(re) = Regex::new(r"^[0-9a-fA-F]+$") {
            self.regex_cache.insert("hex".to_string(), Arc::new(re));
        }
    }

    /// Validate input against rules for a context
    pub async fn validate(&self, input: &str, context: &str) -> Result<(), super::ValidationError> {
        // Check for null bytes
        if input.contains('\0') {
            return Err(super::ValidationError::InvalidInput(
                "Input contains null bytes".to_string(),
            ));
        }

        // Check for control characters (except common whitespace)
        if input
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
        {
            return Err(super::ValidationError::InvalidInput(
                "Input contains control characters".to_string(),
            ));
        }

        // Apply context-specific rules
        if let Some(rules) = self.rules.get(context) {
            for rule in rules {
                self.apply_rule(input, rule)?;
            }
        }

        Ok(())
    }

    /// Apply a single validation rule
    fn apply_rule(&self, input: &str, rule: &ValidationRule) -> Result<(), super::ValidationError> {
        match rule {
            ValidationRule::Alphanumeric => {
                if !input.chars().all(|c| c.is_alphanumeric()) {
                    return Err(super::ValidationError::PatternMismatch(
                        "Input must be alphanumeric".to_string(),
                    ));
                }
            }

            ValidationRule::Email => {
                if let Some(re) = self.regex_cache.get("email") {
                    if !re.is_match(input) {
                        return Err(super::ValidationError::PatternMismatch(
                            "Invalid email format".to_string(),
                        ));
                    }
                }
            }

            ValidationRule::Uuid => {
                if let Some(re) = self.regex_cache.get("uuid") {
                    if !re.is_match(input) {
                        return Err(super::ValidationError::PatternMismatch(
                            "Invalid UUID format".to_string(),
                        ));
                    }
                }
            }

            ValidationRule::Pattern(pattern) => {
                if let Ok(re) = Regex::new(pattern) {
                    if !re.is_match(input) {
                        return Err(super::ValidationError::PatternMismatch(format!(
                            "Input does not match pattern: {}",
                            pattern
                        )));
                    }
                }
            }

            ValidationRule::Length(min, max) => {
                let len = input.len();
                if len < *min || len > *max {
                    return Err(super::ValidationError::LengthViolation(format!(
                        "Input length {} not in range [{}-{}]",
                        len, min, max
                    )));
                }
            }

            ValidationRule::AllowedValues(values) => {
                if !values.contains(&input.to_string()) {
                    return Err(super::ValidationError::InvalidInput(format!(
                        "Input not in allowed values: {:?}",
                        values
                    )));
                }
            }

            ValidationRule::Numeric => {
                if !input.chars().all(|c| c.is_numeric()) {
                    return Err(super::ValidationError::PatternMismatch(
                        "Input must be numeric".to_string(),
                    ));
                }
            }

            ValidationRule::Url => {
                if let Some(re) = self.regex_cache.get("url") {
                    if !re.is_match(input) {
                        return Err(super::ValidationError::PatternMismatch(
                            "Invalid URL format".to_string(),
                        ));
                    }
                }
            }

            ValidationRule::Json => {
                if serde_json::from_str::<serde_json::Value>(input).is_err() {
                    return Err(super::ValidationError::PatternMismatch(
                        "Invalid JSON format".to_string(),
                    ));
                }
            }

            ValidationRule::Base64 => {
                if let Some(re) = self.regex_cache.get("base64") {
                    use base64::Engine;
                    if !re.is_match(input)
                        || base64::engine::general_purpose::STANDARD
                            .decode(input)
                            .is_err()
                    {
                        return Err(super::ValidationError::PatternMismatch(
                            "Invalid Base64 format".to_string(),
                        ));
                    }
                }
            }

            ValidationRule::Hex => {
                if let Some(re) = self.regex_cache.get("hex") {
                    if !re.is_match(input) {
                        return Err(super::ValidationError::PatternMismatch(
                            "Invalid hexadecimal format".to_string(),
                        ));
                    }
                }
            }

            ValidationRule::NoSpecialChars => {
                if input.chars().any(|c| {
                    !c.is_alphanumeric() && !c.is_whitespace() && !matches!(c, '_' | '-' | '.')
                }) {
                    return Err(super::ValidationError::PatternMismatch(
                        "Input contains disallowed special characters".to_string(),
                    ));
                }
            }
        }

        Ok(())
    }

    /// Sanitize input by removing dangerous characters
    pub fn sanitize(input: &str) -> String {
        input
            .chars()
            .filter(|c| !c.is_control() || matches!(c, '\n' | '\r' | '\t'))
            .collect()
    }

    /// Escape HTML entities
    pub fn escape_html(input: &str) -> String {
        input
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#x27;")
    }

    /// Validate JSON payload
    pub fn validate_json(input: &str) -> Result<serde_json::Value, super::ValidationError> {
        match serde_json::from_str(input) {
            Ok(value) => Ok(value),
            Err(e) => Err(super::ValidationError::InvalidInput(format!(
                "JSON validation failed: {}",
                e
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_validator() -> InputValidator {
        let rules = HashMap::new();
        InputValidator::new(&rules)
    }

    #[tokio::test]
    async fn test_username_validation() {
        let validator = create_validator();

        // Valid username
        assert!(validator.validate("user123", "username").await.is_ok());
        assert!(validator.validate("user_name", "username").await.is_ok());
        assert!(validator.validate("user-name", "username").await.is_ok());

        // Invalid username
        assert!(validator.validate("user@name", "username").await.is_err());
        assert!(validator.validate("ab", "username").await.is_err()); // Too short
        assert!(validator
            .validate("a".repeat(33).as_str(), "username")
            .await
            .is_err());
    }

    #[tokio::test]
    async fn test_email_validation() {
        let validator = create_validator();

        // Valid emails
        assert!(validator
            .validate("user@example.com", "email")
            .await
            .is_ok());
        assert!(validator
            .validate("user.name@example.co.uk", "email")
            .await
            .is_ok());

        // Invalid emails
        assert!(validator.validate("invalid-email", "email").await.is_err());
        assert!(validator.validate("@example.com", "email").await.is_err());
    }

    #[tokio::test]
    async fn test_uuid_validation() {
        let validator = create_validator();

        // Valid UUID
        assert!(validator
            .validate("550e8400-e29b-41d4-a716-446655440000", "uuid")
            .await
            .is_ok());

        // Invalid UUID
        assert!(validator.validate("not-a-uuid", "uuid").await.is_err());
        assert!(validator
            .validate("550e8400e29b41d4a716446655440000", "uuid")
            .await
            .is_err());
    }

    #[tokio::test]
    async fn test_null_byte_detection() {
        let validator = create_validator();

        // Null byte should be rejected
        assert!(validator.validate("hello\0world", "generic").await.is_err());
    }

    #[test]
    fn test_html_escape() {
        let input = "<script>alert('xss')</script>";
        let escaped = InputValidator::escape_html(input);
        assert!(!escaped.contains('<'));
        assert!(!escaped.contains('>'));
        assert!(escaped.contains("&lt;"));
    }

    #[test]
    fn test_sanitize() {
        let input = "hello\x00world\n";
        let sanitized = InputValidator::sanitize(input);
        assert!(!sanitized.contains('\0'));
        assert!(sanitized.contains('\n'));
    }

    #[test]
    fn test_validate_json() {
        let valid = r#"{"key": "value", "num": 123}"#;
        assert!(InputValidator::validate_json(valid).is_ok());

        let invalid = r#"{"key": "value", broken}"#;
        assert!(InputValidator::validate_json(invalid).is_err());
    }
}
