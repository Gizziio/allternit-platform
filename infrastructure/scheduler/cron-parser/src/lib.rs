//! Natural Language Schedule Parser
//!
//! Converts human-readable schedule descriptions to cron expressions.
//! Ported from TypeScript to Rust.
//!
//! Examples:
//! - "every 5 minutes" -> "*/5 * * * *"
//! - "every hour" -> "0 * * * *"
//! - "daily at 9am" -> "0 9 * * *"
//! - "weekdays at noon" -> "0 12 * * 1-5"
//! - "mondays at 8:30" -> "30 8 * * 1"
//! - "on the 1st of every month" -> "0 0 1 * *"

use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;

/// Parsed schedule result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParsedSchedule {
    /// Original input string
    pub original: String,
    /// Type of schedule: "cron" or "interval"
    pub schedule_type: ScheduleType,
    /// Cron expression (for cron type)
    pub expression: String,
    /// Interval in seconds (for interval type)
    pub seconds: Option<u64>,
    /// Human-readable description
    pub description: String,
}

/// Schedule type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleType {
    Cron,
    Interval,
}

/// Parser error
#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("Could not parse schedule: {0}")]
    InvalidFormat(String),
    #[error("Time value out of range: {0}")]
    OutOfRange(String),
}

/// Parse natural language schedule to cron expression
pub fn parse(input: &str) -> Result<ParsedSchedule, ParseError> {
    let input = input.trim();
    
    if input.is_empty() {
        return Err(ParseError::InvalidFormat("Empty input".to_string()));
    }
    
    // Try each pattern in order
    for (_name, pattern, handler) in get_patterns() {
        if let Some(captures) = pattern.captures(input) {
            match handler(&captures) {
                Ok(Some(result)) => {
                    return Ok(result);
                }
                Ok(None) => continue,
                Err(e) => return Err(e),
            }
        }
    }
    
    // Check if input is already a valid cron expression
    if is_valid_cron(input) {
        return Ok(ParsedSchedule {
            original: input.to_string(),
            schedule_type: ScheduleType::Cron,
            expression: input.to_string(),
            seconds: None,
            description: format!("Cron: {}", input),
        });
    }
    
    Err(ParseError::InvalidFormat(format!("Unknown schedule format: '{}'", input)))
}

/// Check if string looks like a valid cron expression
fn is_valid_cron(input: &str) -> bool {
    // Basic validation: 5 fields separated by spaces
    let fields: Vec<&str> = input.split_whitespace().collect();
    if fields.len() != 5 {
        return false;
    }
    
    // Check each field contains valid cron characters
    for field in fields {
        if !field.chars().all(|c| c.is_ascii_digit() || c.is_ascii_punctuation() || c.is_ascii_alphabetic()) {
            return false;
        }
    }
    
    true
}

/// Get all parsing patterns
fn get_patterns() -> &'static Vec<(String, Regex, Box<dyn Fn(&regex::Captures) -> Result<Option<ParsedSchedule>, ParseError> + Send + Sync>)> {
    static PATTERNS: OnceLock<Vec<(String, Regex, Box<dyn Fn(&regex::Captures) -> Result<Option<ParsedSchedule>, ParseError> + Send + Sync>)>> = OnceLock::new();
    
    PATTERNS.get_or_init(|| {
        vec![
            // Every N seconds
            (
                "seconds".to_string(),
                Regex::new(r"^(?:every\s+)?(\d+)\s*(?:seconds?|secs?)$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    let n: u64 = caps[1].parse().map_err(|_| ParseError::OutOfRange("Invalid number".to_string()))?;
                    if n == 0 || n > 59 {
                        return Err(ParseError::OutOfRange("Seconds must be 1-59".to_string()));
                    }
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: format!("*/{} * * * *", n),
                        seconds: Some(n),
                        description: format!("Every {} seconds", n),
                    }))
                }),
            ),
            
            // Every N minutes
            (
                "minutes".to_string(),
                Regex::new(r"^(?:every\s+)?(\d+)\s*(?:minutes?|mins?)$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    let n: u64 = caps[1].parse().map_err(|_| ParseError::OutOfRange("Invalid number".to_string()))?;
                    if n == 0 || n > 59 {
                        return Err(ParseError::OutOfRange("Minutes must be 1-59".to_string()));
                    }
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: format!("*/{} * * * *", n),
                        seconds: None,
                        description: format!("Every {} minutes", n),
                    }))
                }),
            ),
            
            // Every N hours
            (
                "hours".to_string(),
                Regex::new(r"^(?:every\s+)?(\d+)\s*(?:hours?|hrs?)$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    let n: u64 = caps[1].parse().map_err(|_| ParseError::OutOfRange("Invalid number".to_string()))?;
                    if n == 0 || n > 23 {
                        return Err(ParseError::OutOfRange("Hours must be 1-23".to_string()));
                    }
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: format!("0 */{} * * *", n),
                        seconds: None,
                        description: format!("Every {} hours", n),
                    }))
                }),
            ),
            
            // Every N days
            (
                "days".to_string(),
                Regex::new(r"^(?:every\s+)?(\d+)\s*days?$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    let n: u64 = caps[1].parse().map_err(|_| ParseError::OutOfRange("Invalid number".to_string()))?;
                    if n == 0 || n > 31 {
                        return Err(ParseError::OutOfRange("Days must be 1-31".to_string()));
                    }
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: format!("0 0 */{} * *", n),
                        seconds: None,
                        description: format!("Every {} days", n),
                    }))
                }),
            ),
            
            // Every N weeks
            (
                "weeks".to_string(),
                Regex::new(r"^(?:every\s+)?(\d+)\s*weeks?$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    let n: u64 = caps[1].parse().map_err(|_| ParseError::OutOfRange("Invalid number".to_string()))?;
                    if n == 0 {
                        return Err(ParseError::OutOfRange("Weeks must be >= 1".to_string()));
                    }
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: format!("0 0 * * 0 */{}", n),
                        seconds: None,
                        description: format!("Every {} weeks", n),
                    }))
                }),
            ),
            
            // Hourly
            (
                "hourly".to_string(),
                Regex::new(r"^(?:every\s+)?hour(?:ly)?$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: "0 * * * *".to_string(),
                        seconds: None,
                        description: "Every hour".to_string(),
                    }))
                }),
            ),
            
            // Daily at time
            (
                "daily".to_string(),
                Regex::new(r"^daily(?:\s+at\s+(noon|midnight|\d+(?::\d+)?(?:\s*[ap]m?)?))?$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    let (hour, minute) = parse_time_spec(caps.get(1).map(|m| m.as_str()))?;
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: format!("{} {} * * *", minute, hour),
                        seconds: None,
                        description: format!("Daily at {:02}:{:02}", hour, minute),
                    }))
                }),
            ),
            
            // Weekdays at time
            (
                "weekdays".to_string(),
                Regex::new(r"^(?:weekdays?|business\s+days?)(?:\s+at\s+(noon|midnight|\d+(?::\d+)?(?:\s*[ap]m?)?))?$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    let (hour, minute) = parse_time_spec(caps.get(1).map(|m| m.as_str()))?;
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: format!("{} {} * * 1-5", minute, hour),
                        seconds: None,
                        description: format!("Weekdays at {:02}:{:02}", hour, minute),
                    }))
                }),
            ),
            
            // Specific day of week at time
            (
                "day_of_week".to_string(),
                Regex::new(r"^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?(?:\s+at\s+(\d+)(?::(\d+))?\s*(am?|pm?)?)?$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    let day_map: HashMap<&str, u8> = [
                        ("sunday", 0), ("monday", 1), ("tuesday", 2), ("wednesday", 3),
                        ("thursday", 4), ("friday", 5), ("saturday", 6),
                    ].into_iter().collect();
                    
                    let day_name = caps[1].to_lowercase();
                    let day = *day_map.get(day_name.as_str()).unwrap();
                    
                    let mut hour = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(9);
                    let minute = caps.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
                    let ampm = caps.get(4).map(|m| m.as_str().to_lowercase());
                    
                    if let Some(ampm) = ampm {
                        if ampm.starts_with('p') && hour != 12 {
                            hour += 12;
                        }
                        if ampm.starts_with('a') && hour == 12 {
                            hour = 0;
                        }
                    }
                    
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: format!("{} {} * * {}", minute, hour, day),
                        seconds: None,
                        description: format!("{}s at {:02}:{:02}", 
                            capitalize(&day_name), hour, minute),
                    }))
                }),
            ),
            
            // Monthly on specific day
            (
                "monthly".to_string(),
                Regex::new(r"^(?:monthly|every\s+month)(?:\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?)?(?:\s+at\s+(\d+)(?::(\d+))?\s*(am?|pm?)?)?$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    let day: u8 = caps.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(1);
                    if day == 0 || day > 31 {
                        return Err(ParseError::OutOfRange("Day must be 1-31".to_string()));
                    }
                    
                    let mut hour = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
                    let minute = caps.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
                    let ampm = caps.get(4).map(|m| m.as_str().to_lowercase());
                    
                    if let Some(ampm) = ampm {
                        if ampm.starts_with('p') && hour != 12 {
                            hour += 12;
                        }
                        if ampm.starts_with('a') && hour == 12 {
                            hour = 0;
                        }
                    }
                    
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: format!("{} {} {} * *", minute, hour, day),
                        seconds: None,
                        description: format!("Monthly on the {} at {:02}:{:02}", ordinal(day), hour, minute),
                    }))
                }),
            ),
            
            // Weekly on specific day
            (
                "weekly".to_string(),
                Regex::new(r"^(?:weekly|every\s+week)(?:\s+on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))?(?:\s+at\s+(\d+)(?::(\d+))?\s*(am?|pm?)?)?$").unwrap(),
                Box::new(|caps: &regex::Captures| {
                    let day_map: HashMap<&str, u8> = [
                        ("sunday", 0), ("monday", 1), ("tuesday", 2), ("wednesday", 3),
                        ("thursday", 4), ("friday", 5), ("saturday", 6),
                    ].into_iter().collect();
                    
                    let day_name = caps.get(1).map(|m| m.as_str().to_lowercase()).unwrap_or_else(|| "sunday".to_string());
                    let day = *day_map.get(day_name.as_str()).unwrap();
                    
                    let mut hour = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
                    let minute = caps.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
                    let ampm = caps.get(4).map(|m| m.as_str().to_lowercase());
                    
                    if let Some(ampm) = ampm {
                        if ampm.starts_with('p') && hour != 12 {
                            hour += 12;
                        }
                        if ampm.starts_with('a') && hour == 12 {
                            hour = 0;
                        }
                    }
                    
                    Ok(Some(ParsedSchedule {
                        original: caps[0].to_string(),
                        schedule_type: ScheduleType::Cron,
                        expression: format!("{} {} * * {}", minute, hour, day),
                        seconds: None,
                        description: format!("Weekly on {} at {:02}:{:02}", 
                            capitalize(&day_name), hour, minute),
                    }))
                }),
            ),
        ]
    })
}

/// Parse time specification like "noon", "midnight", "9", "9am", "9:30", "9:30pm"
fn parse_time_spec(spec: Option<&str>) -> Result<(u8, u8), ParseError> {
    let mut hour = 0;
    let mut minute = 0;
    
    if let Some(spec) = spec {
        let spec = spec.to_lowercase().trim().to_string();
        
        if spec == "noon" {
            hour = 12;
            minute = 0;
        } else if spec == "midnight" {
            hour = 0;
            minute = 0;
        } else {
            // Parse time like "9", "9am", "9:30", "9:30am"
            let time_re = Regex::new(r"^(\d+)(?::(\d+))?\s*(am?|pm?)?$").unwrap();
            if let Some(caps) = time_re.captures(&spec) {
                hour = caps[1].parse().map_err(|_| ParseError::OutOfRange("Invalid hour".to_string()))?;
                minute = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
                let ampm = caps.get(3).map(|m| m.as_str().to_lowercase());
                
                if let Some(ampm) = ampm {
                    if ampm.starts_with('p') && hour != 12 {
                        hour += 12;
                    }
                    if ampm.starts_with('a') && hour == 12 {
                        hour = 0;
                    }
                }
            }
        }
    }
    
    Ok((hour, minute))
}

/// Capitalize first letter
fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
    }
}

/// Convert number to ordinal string (1 -> "1st", 2 -> "2nd", etc.)
fn ordinal(n: u8) -> String {
    match n {
        1 => "1st".to_string(),
        2 => "2nd".to_string(),
        3 => "3rd".to_string(),
        _ => format!("{}th", n),
    }
}

/// Get next occurrence of a cron expression
pub fn next_occurrence(cron_expr: &str, after: Option<DateTime<Utc>>) -> Option<DateTime<Utc>> {
    // This is a simplified implementation
    // For production, use a proper cron parser like cron-parser or schedule-crate
    let after = after.unwrap_or_else(Utc::now);
    
    // Try to interpret simple patterns
    let parts: Vec<&str> = cron_expr.split_whitespace().collect();
    if parts.len() != 5 {
        return None;
    }
    
    // For now, just return 1 minute from now as a placeholder
    // In production, this should properly parse the cron expression
    Some(after + chrono::Duration::minutes(1))
}

/// Validate a cron expression
pub fn validate(cron_expr: &str) -> Result<(), ParseError> {
    let parts: Vec<&str> = cron_expr.split_whitespace().collect();
    if parts.len() != 5 {
        return Err(ParseError::InvalidFormat(
            "Cron expression must have 5 fields (minute hour day month weekday)".to_string()
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_every_n_minutes() {
        let result = parse("every 5 minutes").unwrap();
        assert_eq!(result.expression, "*/5 * * * *");
        assert_eq!(result.description, "Every 5 minutes");
    }

    #[test]
    fn test_parse_every_n_hours() {
        let result = parse("every 2 hours").unwrap();
        assert_eq!(result.expression, "0 */2 * * *");
        assert_eq!(result.description, "Every 2 hours");
    }

    #[test]
    fn test_parse_daily() {
        let result = parse("daily at 9am").unwrap();
        assert_eq!(result.expression, "0 9 * * *");
        assert_eq!(result.description, "Daily at 09:00");
    }

    #[test]
    fn test_parse_daily_noon() {
        let result = parse("daily at noon").unwrap();
        assert_eq!(result.expression, "0 12 * * *");
    }

    #[test]
    fn test_parse_weekdays() {
        let result = parse("weekdays at 5pm").unwrap();
        assert_eq!(result.expression, "0 17 * * 1-5");
    }

    #[test]
    fn test_parse_monday() {
        let result = parse("mondays at 8:30").unwrap();
        assert_eq!(result.expression, "30 8 * * 1");
    }

    #[test]
    fn test_parse_hourly() {
        let result = parse("hourly").unwrap();
        assert_eq!(result.expression, "0 * * * *");
    }

    #[test]
    fn test_parse_cron_directly() {
        let result = parse("0 0 * * *").unwrap();
        assert_eq!(result.expression, "0 0 * * *");
    }

    #[test]
    fn test_parse_invalid() {
        assert!(parse("invalid schedule").is_err());
    }
}
