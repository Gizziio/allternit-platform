use crate::tool_executor::Tool;
use crate::types::ToolDefinition;
use std::path::PathBuf;
use tokio::fs;
use tokio::process::Command;

pub struct DesktopDevice {
    workspace_root: PathBuf,
}

impl DesktopDevice {
    pub fn new(workspace_root: PathBuf) -> Self {
        Self { workspace_root }
    }

    pub fn get_tools(&self) -> Vec<Box<dyn Tool>> {
        vec![
            Box::new(FsWriteTool {
                root: self.workspace_root.clone(),
            }),
            Box::new(ShellExecTool {
                root: self.workspace_root.clone(),
            }),
            Box::new(FullShellExecTool {
                root: self.workspace_root.clone(),
            }),
            Box::new(ScreenCaptureTool {
                root: self.workspace_root.clone(),
            }),
            Box::new(VoiceSpeakTool),
        ]
    }
}

#[derive(Debug)]
pub struct VoiceSpeakTool;

#[async_trait::async_trait]
impl Tool for VoiceSpeakTool {
    async fn execute(
        &self,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let text = parameters["text"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'text'"))?;

        let output = Command::new("say").arg(text).output().await?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "Voice synthesis failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(serde_json::json!({
            "status": "success",
            "action": "spoke",
            "text": text
        }))
    }

    fn name(&self) -> &str {
        "voice.speak"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "voice.speak".to_string(),
            description: "Speak text using the system's text-to-speech engine.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string", "description": "The text to speak" }
                },
                "required": ["text"]
            }),
        }
    }
}

#[derive(Debug)]
pub struct ScreenCaptureTool {
    root: PathBuf,
}

#[async_trait::async_trait]
impl Tool for ScreenCaptureTool {
    async fn execute(
        &self,
        _parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let timestamp = chrono::Utc::now().timestamp_millis();
        let filename = format!("screen_{}.png", timestamp);
        let capture_dir = self.root.join("captures");
        fs::create_dir_all(&capture_dir).await?;

        let target_path = capture_dir.join(&filename);

        // macOS screencapture
        let output = Command::new("screencapture")
            .arg("-x") // silent
            .arg(&target_path)
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "Screencapture failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(serde_json::json!({
            "status": "success",
            "path": format!("captures/{}", filename),
            "timestamp": timestamp
        }))
    }

    fn name(&self) -> &str {
        "screen.capture"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "screen.capture".to_string(),
            description: "Capture a screenshot of the main monitor.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        }
    }
}

#[derive(Debug)]
pub struct FsWriteTool {
    root: PathBuf,
}

#[async_trait::async_trait]
impl Tool for FsWriteTool {
    async fn execute(
        &self,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let path_str = parameters["path"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'path'"))?;
        let content = parameters["content"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'content'"))?;

        let target_path = self.root.join(path_str);
        if !target_path.starts_with(&self.root) {
            return Err(anyhow::anyhow!("Access Denied: Path outside workspace"));
        }

        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        fs::write(&target_path, content).await?;
        Ok(serde_json::json!({ "status": "success", "path": path_str, "size": content.len() }))
    }

    fn name(&self) -> &str {
        "fs.write"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "fs.write".to_string(),
            description: "Write content to a file in the workspace.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Relative path to file" },
                    "content": { "type": "string", "description": "Content to write" }
                },
                "required": ["path", "content"]
            }),
        }
    }
}

#[derive(Debug)]
pub struct ShellExecTool {
    root: PathBuf,
}

#[async_trait::async_trait]
impl Tool for ShellExecTool {
    async fn execute(
        &self,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        // Check if the new "command_string" parameter exists (for full command execution)
        if let Some(command_string) = parameters["command_string"].as_str() {
            // Full command execution mode - use sh -c to execute the entire command string
            let mut cmd = tokio::process::Command::new("sh");
            cmd.arg("-c").arg(command_string).current_dir(&self.root);

            // Inherit the environment from the parent process to ensure PATH is preserved
            for (key, value) in std::env::vars() {
                cmd.env(key, value);
            }

            let output = cmd.output().await?;

            Ok(serde_json::json!({
                "stdout": String::from_utf8_lossy(&output.stdout),
                "stderr": String::from_utf8_lossy(&output.stderr),
                "exit_code": output.status.code()
            }))
        } else {
            // Original limited command execution mode
            let command = parameters["command"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing 'command'"))?;
            let args: Vec<&str> = parameters["args"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
                .unwrap_or_default();

            // Allow a broader set of safe commands
            let allowed_commands = [
                "echo", "ls", "cat", "grep", "pwd", "whoami", "date", "ps", "top", "df", "du",
                "mkdir", "touch", "cp", "mv", "rm", "find", "head", "tail", "sort", "uniq", "wc",
                "cut", "paste", "join", "diff", "cmp", "comm", "tac", "rev", "basename", "dirname",
                "realpath", "readlink", "stat", "file", "which", "whereis", "locate", "free",
                "uptime", "uname", "hostname", "id", "arch", "cal", "time", "env", "printenv",
            ];

            if !allowed_commands.contains(&command) {
                return Err(anyhow::anyhow!("Command '{}' is not whitelisted", command));
            }

            let output = tokio::process::Command::new(command)
                .args(&args)
                .current_dir(&self.root)
                .output()
                .await?;

            Ok(serde_json::json!({
                "stdout": String::from_utf8_lossy(&output.stdout),
                "stderr": String::from_utf8_lossy(&output.stderr),
                "exit_code": output.status.code()
            }))
        }
    }

    fn name(&self) -> &str {
        "shell.exec"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "shell.exec".to_string(),
            description: "Execute a shell command (whitelisted: echo, ls, cat, grep).".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "Command to run" },
                    "args": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Arguments for the command"
                    }
                },
                "required": ["command"]
            }),
        }
    }
}

#[derive(Debug)]
pub struct FullShellExecTool {
    root: PathBuf,
}

#[async_trait::async_trait]
impl Tool for FullShellExecTool {
    async fn execute(
        &self,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let command = parameters["command"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'command'"))?;

        // For full shell access, we'll use sh -c to execute the command
        let output = Command::new("sh")
            .arg("-c")
            .arg(command)
            .current_dir(&self.root)
            .output()
            .await?;

        Ok(serde_json::json!({
            "stdout": String::from_utf8_lossy(&output.stdout),
            "stderr": String::from_utf8_lossy(&output.stderr),
            "exit_code": output.status.code()
        }))
    }

    fn name(&self) -> &str {
        "shell.full_exec"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "shell.full_exec".to_string(),
            description:
                "Execute any shell command with full access to the system (use with caution)."
                    .to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "Full command string to execute" }
                },
                "required": ["command"]
            }),
        }
    }
}
