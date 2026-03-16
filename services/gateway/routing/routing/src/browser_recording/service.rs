// 7-apps/api/src/browser_recording/service.rs
//! Recording Service
//!
//! Manages active browser recording sessions.

use super::capture::FrameCapture;
use super::encoder::GifEncoder;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, RwLock};
use tokio::task::JoinHandle;
use tracing::{debug, error, info, warn};

/// Recording configuration
#[derive(Debug, Clone)]
pub struct RecordingConfig {
    pub format: String,
    pub fps: u32,
    pub quality: u32,
    pub max_duration_secs: Option<u64>,
    pub output_path: Option<PathBuf>,
}

impl Default for RecordingConfig {
    fn default() -> Self {
        Self {
            format: "gif".to_string(),
            fps: 10,
            quality: 80,
            max_duration_secs: Some(60),
            output_path: None,
        }
    }
}

/// Active recording session
pub struct RecordingSession {
    pub id: String,
    pub session_id: Option<String>,
    pub config: RecordingConfig,
    pub started_at: Instant,
    pub frames_captured: u32,
    pub is_recording: bool,
    pub capture_handle: Option<JoinHandle<()>>,
    pub frames: Arc<Mutex<Vec<Vec<u8>>>>,
}

/// Recording status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingStatus {
    pub recording_id: String,
    pub is_recording: bool,
    pub frames_captured: u32,
    pub duration_secs: f64,
    pub format: String,
}

/// Recording result
pub struct RecordingResult {
    pub recording_id: String,
    pub file_path: Option<PathBuf>,
    pub file_size_bytes: Option<u64>,
    pub duration_secs: f64,
    pub frames_captured: u32,
}

/// Browser Recording Service
pub struct RecordingService {
    sessions: Arc<RwLock<HashMap<String, RecordingSession>>>,
    output_dir: PathBuf,
}

impl RecordingService {
    /// Create a new recording service
    pub async fn new(output_dir: Option<PathBuf>) -> Result<Self> {
        let output_dir = output_dir.unwrap_or_else(|| PathBuf::from("./recordings"));
        
        // Ensure output directory exists
        if let Err(e) = tokio::fs::create_dir_all(&output_dir).await {
            warn!("Failed to create output directory: {}", e);
        }
        
        Ok(Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            output_dir,
        })
    }

    /// Start a new recording session
    pub async fn start_recording(
        &self,
        session_id: Option<String>,
        config: RecordingConfig,
    ) -> Result<String> {
        let recording_id = format!("rec_{}", uuid::Uuid::new_v4().simple());
        
        let session = RecordingSession {
            id: recording_id.clone(),
            session_id: session_id.clone(),
            config: config.clone(),
            started_at: Instant::now(),
            frames_captured: 0,
            is_recording: true,
            capture_handle: None,
            frames: Arc::new(Mutex::new(Vec::new())),
        };

        // Insert session
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(recording_id.clone(), session);
        }

        // Start frame capture loop
        let capture_handle = self.start_capture_loop(recording_id.clone(), config).await;
        
        // Update session with capture handle
        {
            let mut sessions = self.sessions.write().await;
            if let Some(session) = sessions.get_mut(&recording_id) {
                session.capture_handle = Some(capture_handle);
            }
        }

        info!("Started recording session: {}", recording_id);
        Ok(recording_id)
    }

    /// Start frame capture loop
    async fn start_capture_loop(
        &self,
        recording_id: String,
        config: RecordingConfig,
    ) -> JoinHandle<()> {
        let sessions = self.sessions.clone();
        let output_dir = self.output_dir.clone();
        
        let frame_interval = Duration::from_millis(1000 / config.fps as u64);
        let max_duration = config.max_duration_secs.map(Duration::from_secs);
        
        tokio::spawn(async move {
            let start = Instant::now();
            
            // Create frame capture with session ID
            let session_id = {
                let sessions_guard = sessions.read().await;
                sessions_guard.get(&recording_id)
                    .and_then(|s| s.session_id.clone())
            };
            
            let frame_capture = if let Some(sid) = session_id {
                FrameCapture::with_session(sid)
            } else {
                FrameCapture::new()
            };
            
            loop {
                // Check if session still exists and is recording
                {
                    let sessions_guard = sessions.read().await;
                    let session = sessions_guard.get(&recording_id);
                    
                    if let Some(s) = session {
                        if !s.is_recording {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                
                // Check max duration
                if let Some(max_dur) = max_duration {
                    if start.elapsed() >= max_dur {
                        info!("Recording {} reached max duration", recording_id);
                        break;
                    }
                }
                
                // Capture frame
                match frame_capture.capture_frame().await {
                    Ok(frame_data) => {
                        let mut sessions_guard = sessions.write().await;
                        if let Some(session) = sessions_guard.get_mut(&recording_id) {
                            let mut frames = session.frames.lock().await;
                            frames.push(frame_data);
                            session.frames_captured += 1;
                            debug!("Captured frame {} for recording {}", session.frames_captured, recording_id);
                        }
                    }
                    Err(e) => {
                        warn!("Failed to capture frame for {}: {}", recording_id, e);
                    }
                }
                
                tokio::time::sleep(frame_interval).await;
            }
            
            info!("Frame capture loop ended for recording {}", recording_id);
        })
    }

    /// Stop recording and encode
    pub async fn stop_recording(
        &self,
        recording_id: &str,
        save: bool,
    ) -> Result<RecordingResult> {
        // Get session and mark as stopped
        let (session, frames) = {
            let mut sessions = self.sessions.write().await;
            
            let session = sessions.remove(recording_id)
                .context("Recording session not found")?;
            
            // Mark as stopped
            let mut stopped_session = session;
            stopped_session.is_recording = false;
            
            // Get frames
            let frames = stopped_session.frames.lock().await.clone();
            
            let duration_secs = stopped_session.started_at.elapsed().as_secs_f64();
            let frames_captured = stopped_session.frames_captured;
            
            (stopped_session, frames)
        };

        info!(
            "Stopped recording {}: {} frames in {:.2}s",
            recording_id, frames.len(), session.started_at.elapsed().as_secs_f64()
        );

        // Encode frames
        let file_path = if save && !frames.is_empty() {
            Some(self.encode_frames(&session, &frames).await?)
        } else {
            None
        };

        let file_size_bytes = file_path
            .as_ref()
            .and_then(|p| std::fs::metadata(p).ok())
            .map(|m| m.len());

        Ok(RecordingResult {
            recording_id: recording_id.to_string(),
            file_path,
            file_size_bytes,
            duration_secs: session.started_at.elapsed().as_secs_f64(),
            frames_captured: session.frames_captured,
        })
    }

    /// Encode frames to GIF
    async fn encode_frames(
        &self,
        session: &RecordingSession,
        frames: &Vec<Vec<u8>>,
    ) -> Result<PathBuf> {
        if frames.is_empty() {
            anyhow::bail!("No frames to encode");
        }

        let output_path = self.output_dir.join(format!(
            "{}.{}",
            session.id,
            session.config.format
        ));

        // Use GIF encoder
        let encoder = GifEncoder::new(
            session.config.fps,
            session.config.quality,
        );
        
        encoder.encode(frames, &output_path).await?;

        info!("Encoded recording: {:?}", output_path);
        Ok(output_path)
    }

    /// Get recording status
    pub async fn get_status(&self, recording_id: &str) -> Option<RecordingStatus> {
        let sessions = self.sessions.read().await;
        
        sessions.get(recording_id).map(|s| {
            RecordingStatus {
                recording_id: s.id.clone(),
                is_recording: s.is_recording,
                frames_captured: s.frames_captured,
                duration_secs: s.started_at.elapsed().as_secs_f64(),
                format: s.config.format.clone(),
            }
        })
    }

    /// Get all active recordings
    pub async fn get_all_statuses(&self) -> Vec<RecordingStatus> {
        let sessions = self.sessions.read().await;
        
        sessions.values().map(|s| {
            RecordingStatus {
                recording_id: s.id.clone(),
                is_recording: s.is_recording,
                frames_captured: s.frames_captured,
                duration_secs: s.started_at.elapsed().as_secs_f64(),
                format: s.config.format.clone(),
            }
        }).collect()
    }
}
