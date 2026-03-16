//! Command Registry
//!
//! Registry of all available CLI commands with metadata.

use serde_json::Value;

/// Root commands registry
pub const ROOT_COMMANDS: &str = include_str!("../commands.json");

/// Render commands as a text table
pub fn render_text_table() -> String {
    let commands: Value = serde_json::from_str(ROOT_COMMANDS).unwrap_or_else(|_| {
        serde_json::json!({
            "commands": []
        })
    });

    let mut output = String::new();
    output.push_str("A2rchitech CLI Commands\n");
    output.push_str("========================\n\n");

    if let Some(cmds) = commands.get("commands").and_then(|c| c.as_array()) {
        for cmd in cmds {
            if let (Some(name), Some(desc)) = (
                cmd.get("name").and_then(|n| n.as_str()),
                cmd.get("description").and_then(|d| d.as_str()),
            ) {
                output.push_str(&format!("  {:<20} {}\n", name, desc));
            }
        }
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_table() {
        let output = render_text_table();
        assert!(output.contains("A2rchitech CLI Commands"));
    }

    #[test]
    fn test_root_commands_json() {
        let commands: Value = serde_json::from_str(ROOT_COMMANDS).unwrap();
        assert!(commands.get("commands").is_some());
    }
}
