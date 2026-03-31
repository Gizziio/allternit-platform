use allternit_substrate::ProcessResult;
use anyhow::Result;
use std::process::{Command, Stdio};
use std::time::Duration;

pub struct ExecutionEngine;

impl Default for ExecutionEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl ExecutionEngine {
    pub fn new() -> Self {
        Self
    }

    pub async fn run(
        &self,
        command: &str,
        args: &[&str],
        timeout: Option<Duration>,
    ) -> Result<ProcessResult> {
        let mut cmd = Command::new(command);
        cmd.args(args);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let output = cmd.output()?;

        Ok(ProcessResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
            signal: None,
            killed: false,
        })
    }
}
