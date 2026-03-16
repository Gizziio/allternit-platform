//! Run command - Execute a command in A2R environment

use colored::Colorize;
use console::style;
use indicatif::{ProgressBar, ProgressStyle};
use tracing::{debug, info};

use a2r_session_manager::types::SessionSpec;
use a2r_driver_interface::ExecResult;

use crate::config::Config;
use crate::error::{CliError, Result};
use crate::sessions::{CliSession, SessionManager};

/// Run command configuration
pub struct RunCommand {
    pub command: Vec<String>,
    pub workdir: Option<String>,
    pub env: Vec<String>,
    pub timeout: u64,
    pub language: Option<String>,
    pub use_vm: bool,
}

impl RunCommand {
    pub async fn execute(self, config: Config) -> Result<()> {
        debug!("Executing run command: {:?}", self.command);
        
        // Create session manager
        let session_manager = SessionManager::new(self.use_vm).await?;
        
        // Show connection info
        let driver_name = if self.use_vm {
            "VM mode"
        } else {
            "Development mode"
        };
        eprintln!("{}", format!("→ Using {}", driver_name).dimmed());
        
        // Create session
        let session_spec = SessionSpec::code_session(
            self.workdir.as_deref().unwrap_or("/workspace")
        );
        
        let session = session_manager.create_session(session_spec).await?;
        eprintln!(
            "{}", 
            format!("→ Created session: {}", session.name).dimmed()
        );
        
        // Parse environment variables
        let env_vars = parse_env_vars(&self.env)?;
        
        // Execute command with progress indicator
        let spinner = ProgressBar::new_spinner();
        spinner.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.green} {msg}")
                .unwrap()
        );
        spinner.set_message("Running...");
        spinner.enable_steady_tick(std::time::Duration::from_millis(100));
        
        let timeout_ms = Some(self.timeout * 1000);
        
        let result = session_manager.exec(
            &session,
            self.command.clone(),
            env_vars,
            timeout_ms,
        ).await;
        
        spinner.finish_and_clear();
        
        // Handle result
        match result {
            Ok(exec_result) => {
                // Print stdout
                if let Some(stdout) = exec_result.stdout {
                    print!("{}", String::from_utf8_lossy(&stdout));
                }
                
                // Print stderr if any
                if let Some(stderr) = exec_result.stderr {
                    eprint!("{}", String::from_utf8_lossy(&stderr).red());
                }
                
                // Print summary if verbose or non-zero exit
                if exec_result.exit_code != 0 {
                    eprintln!(
                        "{}",
                        format!(
                            "→ Exit code: {} ({}ms)",
                            exec_result.exit_code,
                            exec_result.duration_ms
                        ).red()
                    );
                    
                    return Err(CliError::ExecutionFailed {
                        message: format!("Command failed with exit code {}", exec_result.exit_code),
                        exit_code: exec_result.exit_code,
                    });
                } else {
                    debug!(
                        "Command completed successfully in {}ms",
                        exec_result.duration_ms
                    );
                }
                
                // Cleanup
                session_manager.destroy_session(session.id).await?;
                session_manager.cleanup().await?;
                
                Ok(())
            }
            Err(e) => {
                // Cleanup on error
                let _ = session_manager.destroy_session(session.id).await;
                let _ = session_manager.cleanup().await;
                
                Err(e)
            }
        }
    }
}

/// Parse environment variable strings (KEY=value)
fn parse_env_vars(env: &[String]) -> Result<std::collections::HashMap<String, String>> {
    let mut result = std::collections::HashMap::new();
    
    for var in env {
        let parts: Vec<&str> = var.splitn(2, '=').collect();
        if parts.len() != 2 {
            return Err(CliError::Config(
                format!("Invalid environment variable format: {}", var)
            ));
        }
        result.insert(parts[0].to_string(), parts[1].to_string());
    }
    
    Ok(result)
}
