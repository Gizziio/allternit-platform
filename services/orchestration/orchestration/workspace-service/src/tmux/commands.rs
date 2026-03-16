//! Tmux command builders
//!
//! Provides builder-pattern wrappers for tmux commands.

use std::process::Stdio;
use tokio::process::Command;

/// Builder for tmux new-session command
pub struct NewSession {
    name: String,
    detached: bool,
    working_dir: Option<String>,
    window_name: Option<String>,
    command: Option<String>,
}

impl NewSession {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            detached: true,
            working_dir: None,
            window_name: None,
            command: None,
        }
    }

    pub fn detached(mut self, detached: bool) -> Self {
        self.detached = detached;
        self
    }

    pub fn working_dir(mut self, dir: impl Into<String>) -> Self {
        self.working_dir = Some(dir.into());
        self
    }

    pub fn window_name(mut self, name: impl Into<String>) -> Self {
        self.window_name = Some(name.into());
        self
    }

    pub fn command(mut self, cmd: impl Into<String>) -> Self {
        self.command = Some(cmd.into());
        self
    }

    pub fn build(&self) -> Vec<String> {
        let mut args = vec!["new-session".to_string()];

        if self.detached {
            args.push("-d".to_string());
        }

        args.push("-s".to_string());
        args.push(self.name.clone());

        if let Some(dir) = &self.working_dir {
            args.push("-c".to_string());
            args.push(dir.clone());
        }

        if let Some(name) = &self.window_name {
            args.push("-n".to_string());
            args.push(name.clone());
        }

        if let Some(cmd) = &self.command {
            args.push(cmd.clone());
        }

        args
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        let args = self.build();
        let status = Command::new("tmux")
            .args(&args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await?;

        if !status.success() {
            anyhow::bail!("tmux new-session failed");
        }

        Ok(())
    }
}

/// Builder for tmux split-window command
pub struct SplitWindow {
    target: String,
    vertical: bool,
    working_dir: Option<String>,
    percentage: Option<u8>,
    command: Option<String>,
}

impl SplitWindow {
    pub fn new(target: impl Into<String>) -> Self {
        Self {
            target: target.into(),
            vertical: false,
            working_dir: None,
            percentage: None,
            command: None,
        }
    }

    pub fn vertical(mut self) -> Self {
        self.vertical = true;
        self
    }

    pub fn horizontal(mut self) -> Self {
        self.vertical = false;
        self
    }

    pub fn working_dir(mut self, dir: impl Into<String>) -> Self {
        self.working_dir = Some(dir.into());
        self
    }

    pub fn percentage(mut self, pct: u8) -> Self {
        self.percentage = Some(pct);
        self
    }

    pub fn command(mut self, cmd: impl Into<String>) -> Self {
        self.command = Some(cmd.into());
        self
    }

    pub fn build(&self) -> Vec<String> {
        let mut args = vec!["split-window".to_string()];

        if self.vertical {
            args.push("-v".to_string());
        } else {
            args.push("-h".to_string());
        }

        if let Some(pct) = self.percentage {
            args.push("-p".to_string());
            args.push(pct.to_string());
        }

        if let Some(dir) = &self.working_dir {
            args.push("-c".to_string());
            args.push(dir.clone());
        }

        args.push("-t".to_string());
        args.push(self.target.clone());

        if let Some(cmd) = &self.command {
            args.push(cmd.clone());
        }

        args
    }

    pub async fn run(&self) -> anyhow::Result<String> {
        let args = self.build();
        let output = Command::new("tmux")
            .args(&args)
            .arg("-P")
            .arg("-F")
            .arg("#{pane_id}")
            .output()
            .await?;

        if !output.status.success() {
            anyhow::bail!("tmux split-window failed");
        }

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }
}

/// Builder for tmux send-keys command
pub struct SendKeys {
    target: String,
    keys: Vec<String>,
}

impl SendKeys {
    pub fn new(target: impl Into<String>) -> Self {
        Self {
            target: target.into(),
            keys: Vec::new(),
        }
    }

    pub fn key(mut self, key: impl Into<String>) -> Self {
        self.keys.push(key.into());
        self
    }

    pub fn keys(mut self, keys: Vec<String>) -> Self {
        self.keys.extend(keys);
        self
    }

    pub fn enter(mut self) -> Self {
        self.keys.push("C-m".to_string());
        self
    }

    pub fn build(&self) -> Vec<String> {
        let mut args = vec!["send-keys".to_string(), "-t".to_string(), self.target.clone()];
        args.extend(self.keys.clone());
        args
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        let args = self.build();
        let status = Command::new("tmux")
            .args(&args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await?;

        if !status.success() {
            anyhow::bail!("tmux send-keys failed");
        }

        Ok(())
    }
}

/// Builder for tmux resize-pane command
pub struct ResizePane {
    target: String,
    size: ResizeSize,
}

pub enum ResizeSize {
    Up(u16),
    Down(u16),
    Left(u16),
    Right(u16),
    Height(u16),
    Width(u16),
}

impl ResizePane {
    pub fn new(target: impl Into<String>, size: ResizeSize) -> Self {
        Self {
            target: target.into(),
            size,
        }
    }

    pub fn build(&self) -> Vec<String> {
        let mut args = vec!["resize-pane".to_string(), "-t".to_string(), self.target.clone()];

        match self.size {
            ResizeSize::Up(n) => {
                args.push("-U".to_string());
                args.push(n.to_string());
            }
            ResizeSize::Down(n) => {
                args.push("-D".to_string());
                args.push(n.to_string());
            }
            ResizeSize::Left(n) => {
                args.push("-L".to_string());
                args.push(n.to_string());
            }
            ResizeSize::Right(n) => {
                args.push("-R".to_string());
                args.push(n.to_string());
            }
            ResizeSize::Height(n) => {
                args.push("-y".to_string());
                args.push(n.to_string());
            }
            ResizeSize::Width(n) => {
                args.push("-x".to_string());
                args.push(n.to_string());
            }
        }

        args
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        let args = self.build();
        let status = Command::new("tmux")
            .args(&args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await?;

        if !status.success() {
            anyhow::bail!("tmux resize-pane failed");
        }

        Ok(())
    }
}
