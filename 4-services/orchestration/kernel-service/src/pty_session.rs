use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::Child;
use tokio::sync::broadcast;
use tokio::sync::RwLock;

pub struct PtySession {
    pub id: String,
    pub process: Child,
    pub input_tx: tokio::sync::mpsc::UnboundedSender<String>,
    output_tx: broadcast::Sender<String>, // Keep sender private to create new receivers
}

pub struct PtySessionManager {
    sessions: Arc<RwLock<HashMap<String, Arc<PtySession>>>>,
}

impl PtySessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_session(&self, session_id: String) -> Result<()> {
        // Check if session already exists
        {
            let sessions = self.sessions.read().await;
            if sessions.contains_key(&session_id) {
                return Ok(());
            }
        }

        // Spawn a new shell process (bash or zsh)
        let mut process = tokio::process::Command::new("zsh")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .current_dir(std::env::current_dir()?)
            .envs(std::env::vars()) // Pass through all environment variables
            .spawn()?;

        // Create channels for communication
        let (input_tx, mut input_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
        let (output_tx, _) = broadcast::channel::<String>(100); // Channel for output broadcasting

        // Handle stdout/stderr streaming
        if let Some(stdout) = process.stdout.take() {
            let output_tx_clone = output_tx.clone();
            tokio::spawn(async move {
                let mut buf_reader = BufReader::new(stdout);
                let mut buffer = [0; 1024]; // Use a byte buffer to handle binary data

                loop {
                    match buf_reader.read(&mut buffer).await {
                        Ok(0) => break, // EOF
                        Ok(n) => {
                            if let Ok(text) = String::from_utf8(buffer[..n].to_vec()) {
                                if output_tx_clone.send(text).is_err() {
                                    // Receiver dropped, stop reading
                                    break;
                                }
                            } else {
                                // Handle binary data as hex or skip
                                let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                                if output_tx_clone.send(text).is_err() {
                                    break;
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Error reading stdout: {}", e);
                            break;
                        }
                    }
                }
            });
        }

        // Handle stderr streaming
        if let Some(stderr) = process.stderr.take() {
            let output_tx_clone = output_tx.clone();
            tokio::spawn(async move {
                let mut buf_reader = BufReader::new(stderr);
                let mut buffer = [0; 1024];

                loop {
                    match buf_reader.read(&mut buffer).await {
                        Ok(0) => break, // EOF
                        Ok(n) => {
                            if let Ok(text) = String::from_utf8(buffer[..n].to_vec()) {
                                if output_tx_clone.send(text).is_err() {
                                    break;
                                }
                            } else {
                                let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                                if output_tx_clone.send(text).is_err() {
                                    break;
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Error reading stderr: {}", e);
                            break;
                        }
                    }
                }
            });
        }

        // Handle stdin writing
        if let Some(mut stdin) = process.stdin.take() {
            let session_id_clone = session_id.clone();
            tokio::spawn(async move {
                while let Some(input) = input_rx.recv().await {
                    if let Err(e) = stdin.write_all(input.as_bytes()).await {
                        eprintln!("Error writing to session {}: {}", session_id_clone, e);
                        break;
                    }
                    if let Err(e) = stdin.flush().await {
                        eprintln!("Error flushing session {}: {}", session_id_clone, e);
                        break;
                    }
                }
            });
        }

        let session = Arc::new(PtySession {
            id: session_id.clone(),
            process,
            input_tx,
            output_tx: output_tx.clone(),
        });

        // Store the session
        self.sessions.write().await.insert(session_id, session);
        Ok(())
    }

    pub async fn write_to_session(&self, session_id: &str, data: &str) -> Result<()> {
        let sessions = self.sessions.read().await;
        if let Some(session) = sessions.get(session_id) {
            session.input_tx.send(data.to_string())?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Session {} not found", session_id))
        }
    }

    pub async fn subscribe_to_session_output(
        &self,
        session_id: &str,
    ) -> Result<broadcast::Receiver<String>> {
        let sessions = self.sessions.read().await;
        if let Some(session) = sessions.get(session_id) {
            // Create a new subscription to the output channel
            Ok(session.output_tx.subscribe())
        } else {
            Err(anyhow::anyhow!("Session {} not found", session_id))
        }
    }

    pub async fn kill_session(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        if sessions.remove(session_id).is_some() {
            // The process will be killed when the Child is dropped
            Ok(())
        } else {
            Err(anyhow::anyhow!("Session {} not found", session_id))
        }
    }

    pub async fn resize_session(&self, session_id: &str, cols: u16, rows: u16) -> Result<()> {
        // In a real implementation, this would resize the PTY
        // For now, we'll just log it
        println!("Resizing session {} to {}x{}", session_id, cols, rows);
        Ok(())
    }
}
