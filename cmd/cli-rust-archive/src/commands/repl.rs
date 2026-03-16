//! REPL command - Start an interactive REPL session

use std::collections::HashMap;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;

use colored::Colorize;
use console::style;

use tracing::{debug, info};

use a2r_session_manager::types::SessionSpec;


use crate::config::Config;
use crate::error::{CliError, Result};
use crate::sessions::{CliSession, SessionManager};

pub struct ReplCommand {
    pub language: String,
    pub use_vm: bool,
}

/// Language configuration for REPL
struct LanguageConfig {
    name: &'static str,
    binary: &'static str,
    version_flag: &'static str,
    prompt: &'static str,
    toolchains: Vec<String>,
    file_extensions: Vec<&'static str>,
}

impl LanguageConfig {
    fn for_language(lang: &str) -> Option<Self> {
        match lang.to_lowercase().as_str() {
            "python" | "py" => Some(LanguageConfig {
                name: "Python",
                binary: "python3",
                version_flag: "--version",
                prompt: ">>> ",
                toolchains: vec!["python-3.11".to_string()],
                file_extensions: vec![".py", ".pyw"],
            }),
            "node" | "javascript" | "js" => Some(LanguageConfig {
                name: "Node.js",
                binary: "node",
                version_flag: "--version",
                prompt: "> ",
                toolchains: vec!["node-22".to_string()],
                file_extensions: vec![".js", ".mjs", ".cjs"],
            }),
            "deno" => Some(LanguageConfig {
                name: "Deno",
                binary: "deno",
                version_flag: "--version",
                prompt: "> ",
                toolchains: vec!["deno".to_string()],
                file_extensions: vec![".ts", ".js"],
            }),
            "bun" => Some(LanguageConfig {
                name: "Bun",
                binary: "bun",
                version_flag: "--version",
                prompt: "> ",
                toolchains: vec!["bun".to_string()],
                file_extensions: vec![".ts", ".js"],
            }),
            "ruby" | "rb" => Some(LanguageConfig {
                name: "Ruby",
                binary: "ruby",
                version_flag: "--version",
                prompt: "irb(main):001:0> ",
                toolchains: vec!["ruby".to_string()],
                file_extensions: vec![".rb"],
            }),
            "rust" | "rs" => Some(LanguageConfig {
                name: "Rust",
                binary: "evcxr",
                version_flag: "--version",
                prompt: ">> ",
                toolchains: vec!["rust".to_string()],
                file_extensions: vec![".rs"],
            }),
            "go" | "golang" => Some(LanguageConfig {
                name: "Go",
                binary: "go",
                version_flag: "version",
                prompt: "> ",
                toolchains: vec!["go".to_string()],
                file_extensions: vec![".go"],
            }),
            "shell" | "sh" | "bash" => Some(LanguageConfig {
                name: "Bash",
                binary: "bash",
                version_flag: "--version",
                prompt: "$ ",
                toolchains: vec!["bash".to_string()],
                file_extensions: vec![".sh", ".bash"],
            }),
            _ => None,
        }
    }
}

impl ReplCommand {
    pub async fn execute(self, _config: Config) -> Result<()> {
        info!("Starting {} REPL", self.language);

        // Auto-detect language if "auto" or empty
        let language = if self.language == "auto" || self.language.is_empty() {
            self.detect_language().await?
        } else {
            self.language.clone()
        };

        // Get language configuration
        let lang_config = LanguageConfig::for_language(&language)
            .ok_or_else(|| CliError::Config(
                format!("Unsupported language: {}. Supported: python, node, deno, bun, ruby, rust, go, shell", language)
            ))?;

        // Check if binary is available
        if !self.check_binary_available(lang_config.binary).await {
            return Err(CliError::DriverNotAvailable(
                format!("{} binary '{}' not found in PATH", lang_config.name, lang_config.binary)
            ));
        }

        // Get version info
        let version = self.get_version(&lang_config).await.unwrap_or_else(|| "unknown".to_string());

        // Create session manager
        let session_manager = SessionManager::new(self.use_vm).await?;

        // Show driver info
        let driver_name = if self.use_vm {
            "VM mode"
        } else {
            "Development mode"
        };
        eprintln!("{}", format!("→ Using {}", driver_name).dimmed());

        // Create session with appropriate toolchains
        let session_spec = SessionSpec::code_session("/workspace")
            .with_name(format!("{}-repl", lang_config.name.to_lowercase()));

        let session = session_manager.create_session(session_spec).await?;
        eprintln!(
            "{}",
            format!("→ Created session: {}", session.name).dimmed()
        );

        // Print banner
        self.print_banner(&lang_config, &version);
        self.print_help();

        // Load history if available
        let history_path = self.get_history_path(&lang_config);
        let mut history = self.load_history(&history_path).await;

        // REPL loop
        let stdin = io::stdin();
        let mut stdout = io::stdout();
        let mut multi_line_buffer = String::new();
        let mut is_multi_line = false;
        let prompt = style(lang_config.prompt).green().to_string();
        let continuation_prompt = style("... ").yellow().to_string();

        loop {
            let current_prompt = if is_multi_line {
                &continuation_prompt
            } else {
                &prompt
            };

            print!("{}", current_prompt);
            stdout.flush().map_err(CliError::Io)?;

            let mut line = String::new();
            let bytes_read = stdin.lock().read_line(&mut line).map_err(CliError::Io)?;

            if bytes_read == 0 {
                // EOF (Ctrl+D)
                eprintln!("{}", "\nGoodbye!".dimmed());
                break;
            }

            let trimmed = line.trim();

            // Handle special commands
            if !is_multi_line && trimmed.starts_with('.') {
                match self.handle_special_command(trimmed, &session_manager, &session).await {
                    CommandResult::Continue => continue,
                    CommandResult::Exit => break,
                    CommandResult::Error(e) => {
                        eprintln!("{}", format!("Error: {}", e).red());
                        continue;
                    }
                }
            }

            // Handle multi-line input (simple heuristic based on trailing backslash or unclosed parens)
            let ends_with_backslash = trimmed.ends_with('\\');
            let open_parens = trimmed.chars().filter(|&c| c == '(' || c == '{' || c == '[').count();
            let close_parens = trimmed.chars().filter(|&c| c == ')' || c == '}' || c == ']').count();
            let has_unclosed = open_parens > close_parens;

            if ends_with_backslash || has_unclosed || is_multi_line {
                multi_line_buffer.push_str(&line);

                if ends_with_backslash {
                    // Remove trailing backslash for continuation
                    multi_line_buffer.pop();
                    multi_line_buffer.pop();
                    multi_line_buffer.push('\n');
                    is_multi_line = true;
                    continue;
                }

                if has_unclosed {
                    is_multi_line = true;
                    continue;
                }

                // Execute multi-line buffer
                let code = multi_line_buffer.trim().to_string();
                multi_line_buffer.clear();
                is_multi_line = false;

                if !code.is_empty() {
                    // Add to history
                    history.push(code.clone());
                    if let Err(e) = self.execute_code(&code, &lang_config, &session_manager, &session).await {
                        eprintln!("{}", format!("Error: {}", e).red());
                    }
                }
            } else if !trimmed.is_empty() {
                // Single line execution
                history.push(trimmed.to_string());
                if let Err(e) = self.execute_code(trimmed, &lang_config, &session_manager, &session).await {
                    eprintln!("{}", format!("Error: {}", e).red());
                }
            }
        }

        // Save history
        if let Err(e) = self.save_history(&history_path, &history).await {
            debug!("Failed to save history: {}", e);
        }

        // Cleanup
        eprintln!("{}", "→ Cleaning up...".dimmed());
        let _ = session_manager.destroy_session(session.id).await;
        let _ = session_manager.cleanup().await;

        Ok(())
    }

    /// Auto-detect language based on current directory
    async fn detect_language(&self) -> Result<String> {
        let cwd = std::env::current_dir()
            .map_err(|e| CliError::Io(e))?;

        // Check for common project files
        let files = tokio::fs::read_dir(&cwd).await;
        if let Ok(mut entries) = files {
            let mut has_requirements_txt = false;
            let mut has_package_json = false;
            let mut has_cargo_toml = false;
            let mut has_go_mod = false;
            let mut has_gemfile = false;
            let mut py_files = 0;
            let mut js_files = 0;
            let mut rs_files = 0;

            while let Ok(Some(entry)) = entries.next_entry().await {
                let name = entry.file_name().to_string_lossy().to_lowercase();

                if name == "requirements.txt" || name == "pyproject.toml" || name == "setup.py" {
                    has_requirements_txt = true;
                }
                if name == "package.json" {
                    has_package_json = true;
                }
                if name == "cargo.toml" {
                    has_cargo_toml = true;
                }
                if name == "go.mod" {
                    has_go_mod = true;
                }
                if name == "gemfile" {
                    has_gemfile = true;
                }
                if name.ends_with(".py") {
                    py_files += 1;
                }
                if name.ends_with(".js") || name.ends_with(".ts") {
                    js_files += 1;
                }
                if name.ends_with(".rs") {
                    rs_files += 1;
                }
            }

            // Priority order
            if has_requirements_txt || py_files > 3 {
                return Ok("python".to_string());
            }
            if has_package_json || js_files > 3 {
                return Ok("node".to_string());
            }
            if has_cargo_toml || rs_files > 0 {
                return Ok("rust".to_string());
            }
            if has_go_mod {
                return Ok("go".to_string());
            }
            if has_gemfile {
                return Ok("ruby".to_string());
            }
        }

        // Default to Python if nothing detected
        Ok("python".to_string())
    }

    /// Check if a binary is available in PATH
    async fn check_binary_available(&self, binary: &str) -> bool {
        let output = tokio::process::Command::new("which")
            .arg(binary)
            .output()
            .await;

        matches!(output, Ok(o) if o.status.success())
    }

    /// Get version string for the language
    async fn get_version(&self, lang_config: &LanguageConfig) -> Option<String> {
        let output = tokio::process::Command::new(lang_config.binary)
            .arg(lang_config.version_flag)
            .output()
            .await
            .ok()?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            Some(version.trim().to_string())
        } else {
            None
        }
    }

    /// Print REPL banner
    fn print_banner(&self, lang_config: &LanguageConfig, version: &str) {
        let width = 50;
        let title = format!("{} REPL", lang_config.name);

        println!();
        println!("{}", "═".repeat(width).cyan());
        println!("{}{}{}",
            "║".cyan(),
            " ".repeat((width - title.len() - 2) / 2) + &title + &" ".repeat((width - title.len() - 1) / 2),
            "║".cyan()
        );
        println!("{}{}{}",
            "║".cyan(),
            style(format!("  Version: {}", version)).dim().to_string()
                + &" ".repeat(width - version.len() - 13),
            "║".cyan()
        );
        println!("{}", "═".repeat(width).cyan());
        println!();
    }

    /// Print help message
    fn print_help(&self) {
        println!("{}", "Special commands:".bold());
        println!("  {} - Exit the REPL", ".exit".green());
        println!("  {} - Show this help message", ".help".green());
        println!("  {} - Clear the screen", ".clear".green());
        println!("  {} - Show session info", ".info".green());
        println!();
        println!("{}", "Shortcuts:".bold());
        println!("  {} - Submit input", "Enter".dimmed());
        println!("  {} - Exit", "Ctrl+D".dimmed());
        println!("  {} - Multi-line {}", "\\".dimmed(), "(end line with backslash)".dimmed());
        println!();
    }

    /// Get history file path
    fn get_history_path(&self, lang_config: &LanguageConfig) -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("a2r")
            .join("repl-history")
            .join(format!("{}.history", lang_config.name.to_lowercase()))
    }

    /// Load history from file
    async fn load_history(&self, path: &PathBuf) -> Vec<String> {
        if !path.exists() {
            return Vec::new();
        }

        match tokio::fs::read_to_string(path).await {
            Ok(content) => content.lines().map(|s| s.to_string()).collect(),
            Err(_) => Vec::new(),
        }
    }

    /// Save history to file
    async fn save_history(&self, path: &PathBuf, history: &[String]) -> Result<()> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await.map_err(CliError::Io)?;
        }

        // Keep only last 1000 entries
        let start = if history.len() > 1000 {
            history.len() - 1000
        } else {
            0
        };

        let content: String = history[start..].join("\n");
        tokio::fs::write(path, content).await.map_err(CliError::Io)?;

        Ok(())
    }

    /// Handle special REPL commands
    async fn handle_special_command(
        &self,
        cmd: &str,
        _session_manager: &SessionManager,
        session: &a2r_session_manager::types::Session,
    ) -> CommandResult {
        match cmd {
            ".exit" | ".quit" | ".q" => CommandResult::Exit,
            ".help" | ".h" | ".?" => {
                self.print_help();
                CommandResult::Continue
            }
            ".clear" | ".cls" => {
                // Clear screen using ANSI escape codes
                print!("\x1B[2J\x1B[1;1H");
                CommandResult::Continue
            }
            ".info" => {
                println!("{}", "Session Information:".bold());
                println!("  Session ID:   {}", session.id);
                println!("  Session Name: {}", session.name);
                println!("  Working Dir:  {}", session.spec.working_dir);
                println!("  Status:       {}", session.status);
                CommandResult::Continue
            }
            _ => {
                CommandResult::Error(format!("Unknown command: {}. Type .help for available commands.", cmd))
            }
        }
    }

    /// Execute code in the session
    async fn execute_code(
        &self,
        code: &str,
        lang_config: &LanguageConfig,
        session_manager: &SessionManager,
        session: &a2r_session_manager::types::Session,
    ) -> Result<()> {
        // Wrap the code appropriately for the language
        let wrapped_code = self.wrap_code_for_execution(code, lang_config);

        // Execute the code
        let env = HashMap::new();
        let timeout_ms = Some(30000); // 30 second timeout for REPL commands

        let result = session_manager.exec(
            session,
            vec!["sh".to_string(), "-c".to_string(), wrapped_code],
            env,
            timeout_ms,
        ).await;

        match result {
            Ok(exec_result) => {
                // Print stdout
                if let Some(stdout) = exec_result.stdout {
                    print!("{}", String::from_utf8_lossy(&stdout));
                }

                // Print stderr if any (but filter out some noise)
                if let Some(stderr) = exec_result.stderr {
                    let stderr_str = String::from_utf8_lossy(&stderr);
                    let filtered = self.filter_stderr(&stderr_str);
                    if !filtered.is_empty() {
                        eprint!("{}", filtered.red());
                    }
                }

                Ok(())
            }
            Err(e) => Err(e),
        }
    }

    /// Wrap code for execution in the target language
    fn wrap_code_for_execution(&self, code: &str, lang_config: &LanguageConfig) -> String {
        match lang_config.name {
            "Python" => {
                // Use python -c, escaping quotes properly
                format!("python3 -c '{}' 2>&1",
                    code.replace('\'', "'\"'\"'")
                )
            }
            "Node.js" => {
                format!("node -e '{}' 2>&1",
                    code.replace('\'', "'\"'\"'")
                )
            }
            "Ruby" => {
                format!("ruby -e '{}' 2>&1",
                    code.replace('\'', "'\"'\"'")
                )
            }
            "Bash" => {
                format!("{} 2>&1", code)
            }
            _ => {
                // Generic fallback
                format!("{} -c '{}' 2>&1",
                    lang_config.binary,
                    code.replace('\'', "'\"'\"'")
                )
            }
        }
    }

    /// Filter out common noise from stderr
    fn filter_stderr(&self, stderr: &str) -> String {
        stderr
            .lines()
            .filter(|line| {
                !line.contains("Readline") &&
                !line.contains("warning:") &&
                !line.is_empty()
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

/// Result of handling a special command
enum CommandResult {
    Continue,
    Exit,
    Error(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_config_for_python() {
        let config = LanguageConfig::for_language("python");
        assert!(config.is_some());
        let config = config.unwrap();
        assert_eq!(config.name, "Python");
        assert_eq!(config.binary, "python3");
    }

    #[test]
    fn test_language_config_for_node() {
        let config = LanguageConfig::for_language("node");
        assert!(config.is_some());
        let config = config.unwrap();
        assert_eq!(config.name, "Node.js");
        assert_eq!(config.binary, "node");
    }

    #[test]
    fn test_language_config_case_insensitive() {
        let config1 = LanguageConfig::for_language("Python");
        let config2 = LanguageConfig::for_language("python");
        let config3 = LanguageConfig::for_language("PYTHON");
        assert!(config1.is_some());
        assert_eq!(config1.unwrap().name, config2.unwrap().name);
        assert_eq!(config1.unwrap().name, config3.unwrap().name);
    }

    #[test]
    fn test_unknown_language() {
        let config = LanguageConfig::for_language("unknown_lang");
        assert!(config.is_none());
    }
}
