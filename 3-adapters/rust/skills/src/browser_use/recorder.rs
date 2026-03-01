// 3-adapters/rust/skills/src/browser_use/recorder.rs
//! Screen Recorder for Browser Sessions
//!
//! Captures frames and encodes them as GIF or video formats.

use anyhow::{Context, Result};
use gif::{Encoder, Frame};
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};

/// Recording configuration
#[derive(Debug, Clone)]
pub struct RecordingConfig {
    pub format: RecordingFormat,
    pub fps: u32,
    pub quality: u8,
    pub max_width: u32,
    pub max_height: u32,
    pub output_path: Option<PathBuf>,
}

/// Recording format
#[derive(Debug, Clone)]
pub enum RecordingFormat {
    Gif,
    WebM,
    Mp4,
}

impl RecordingFormat {
    pub fn extension(&self) -> &'static str {
        match self {
            RecordingFormat::Gif => "gif",
            RecordingFormat::WebM => "webm",
            RecordingFormat::Mp4 => "mp4",
        }
    }
}

/// Active recording session
pub struct RecordingSession {
    pub id: String,
    pub session_id: String,
    pub config: RecordingConfig,
    pub frames: Arc<Mutex<VecDeque<FrameBuffer>>>,
    pub started_at: std::time::Instant,
    pub frames_captured: u32,
    pub is_recording: bool,
}

/// Frame buffer for captured images
pub struct FrameBuffer {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub timestamp: std::time::Instant,
}

/// Screen recorder for browser sessions
pub struct ScreenRecorder {
    sessions: Arc<Mutex<Vec<RecordingSession>>>,
    output_dir: PathBuf,
}

impl ScreenRecorder {
    /// Create a new screen recorder
    pub fn new(output_dir: Option<PathBuf>) -> Self {
        let output_dir = output_dir.unwrap_or_else(|| PathBuf::from("./recordings"));
        
        // Ensure output directory exists
        if let Err(e) = fs::create_dir_all(&output_dir) {
            warn!("Failed to create output directory: {}", e);
        }
        
        Self {
            sessions: Arc::new(Mutex::new(Vec::new())),
            output_dir,
        }
    }

    /// Start a new recording session
    pub async fn start_recording(
        &self,
        session_id: String,
        config: RecordingConfig,
    ) -> Result<String> {
        let recording_id = format!("rec_{}", uuid::Uuid::new_v4().simple());
        
        let session = RecordingSession {
            id: recording_id.clone(),
            session_id,
            config,
            frames: Arc::new(Mutex::new(VecDeque::with_capacity(300))), // ~30 sec at 10fps
            started_at: std::time::Instant::now(),
            frames_captured: 0,
            is_recording: true,
        };

        let mut sessions = self.sessions.lock().await;
        sessions.push(session);

        info!("Started recording session: {}", recording_id);
        Ok(recording_id)
    }

    /// Capture a frame from the browser session
    pub async fn capture_frame(
        &self,
        recording_id: &str,
        image_data: &[u8],
    ) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        
        let session = sessions
            .iter_mut()
            .find(|s| s.id == recording_id && s.is_recording)
            .context("Recording session not found or not active")?;

        // Decode image
        let img = image::load_from_memory(image_data)
            .context("Failed to decode image data")?;

        // Resize if needed
        let resized = self.resize_frame(img, &session.config);
        let rgba = resized.to_rgba8();

        // Create GIF frame
        let mut frame_data = vec![0u8; (rgba.width() * rgba.height() * 4) as usize];
        for (i, pixel) in rgba.pixels().enumerate() {
            frame_data[i * 4] = pixel[0];     // R
            frame_data[i * 4 + 1] = pixel[1]; // G
            frame_data[i * 4 + 2] = pixel[2]; // B
            frame_data[i * 4 + 3] = pixel[3]; // A
        }

        let delay = (100 / session.config.fps) as u16; // centiseconds
        let frame = Frame::from_rgba(
            rgba.width().try_into().unwrap(),
            rgba.height().try_into().unwrap(),
            &mut frame_data,
        );
        
        // Set frame delay
        let mut frame_with_delay = Frame {
            delay,
            ..frame
        };

        let mut frames = session.frames.lock().await;

        // Limit frame buffer size based on FPS and max duration
        let max_frames = (session.config.fps * 60) as usize; // 60 seconds max
        if frames.len() >= max_frames {
            frames.pop_front(); // Remove oldest frame
        }

        frames.push_back(FrameBuffer {
            data: frame_with_delay.to_owned().buffer.to_vec(),
            width: rgba.width(),
            height: rgba.height(),
            timestamp: std::time::Instant::now(),
        });

        session.frames_captured += 1;
        debug!("Captured frame {} for recording {}", session.frames_captured, recording_id);

        Ok(())
    }

    /// Stop recording and encode to output format
    pub async fn stop_recording(
        &self,
        recording_id: &str,
        save: bool,
    ) -> Result<RecordingResult> {
        let mut sessions = self.sessions.lock().await;

        let session_idx = sessions
            .iter()
            .position(|s| s.id == recording_id)
            .context("Recording session not found")?;

        let mut session = sessions.remove(session_idx);
        session.is_recording = false;

        let duration_secs = session.started_at.elapsed().as_secs_f64();
        let frames_captured = session.frames_captured;

        info!(
            "Stopped recording {}: {} frames in {:.2}s",
            recording_id, frames_captured, duration_secs
        );

        // Encode frames
        let frames = session.frames.lock().await;
        let output_path = if save && !frames.is_empty() {
            Some(self.encode_frames(&session, &frames).await?)
        } else {
            None
        };

        let file_size_bytes = output_path
            .as_ref()
            .and_then(|p| fs::metadata(p).ok())
            .map(|m| m.len());

        Ok(RecordingResult {
            recording_id: recording_id.to_string(),
            success: true,
            file_path: output_path,
            file_size_bytes,
            duration_secs: Some(duration_secs),
            frames_captured: Some(frames_captured),
            error: None,
        })
    }

    /// Resize frame according to config
    fn resize_frame(&self, img: DynamicImage, config: &RecordingConfig) -> DynamicImage {
        let (width, height) = img.dimensions();
        
        if width > config.max_width || height > config.max_height {
            let scale = (config.max_width as f32 / width as f32)
                .min(config.max_height as f32 / height as f32);
            let new_width = (width as f32 * scale) as u32;
            let new_height = (height as f32 * scale) as u32;
            img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3)
        } else {
            img
        }
    }

    /// Encode frames to output format
    async fn encode_frames(
        &self,
        session: &RecordingSession,
        frames: &VecDeque<FrameBuffer>,
    ) -> Result<PathBuf> {
        match session.config.format {
            RecordingFormat::Gif => self.encode_gif(session, frames).await,
            RecordingFormat::WebM | RecordingFormat::Mp4 => {
                // For video formats, we'd use ffmpeg or similar
                // For now, encode as GIF and note the limitation
                warn!("Video formats (WebM/MP4) require ffmpeg. Encoding as GIF instead.");
                self.encode_gif(session, frames).await
            }
        }
    }

    /// Encode frames as GIF
    async fn encode_gif(
        &self,
        session: &RecordingSession,
        frames: &VecDeque<FrameBuffer>,
    ) -> Result<PathBuf> {
        if frames.is_empty() {
            anyhow::bail!("No frames to encode");
        }

        let output_path = self.output_dir.join(format!(
            "{}.{}",
            session.id,
            session.config.format.extension()
        ));

        let file = File::create(&output_path)
            .with_context(|| format!("Failed to create output file: {:?}", output_path))?;
        let ref mut w = BufWriter::new(file);

        let width = frames.front().unwrap().width as u16;
        let height = frames.front().unwrap().height as u16;

        let mut encoder = Encoder::new(w, width, height, &[])?;
        encoder.set_repeat(gif::Repeat::Finite(0))?; // Infinite loop

        // Write frames
        for frame_buf in frames.iter() {
            let mut frame_data = frame_buf.data.clone();
            let frame = Frame::from_rgba(
                frame_buf.width as u16,
                frame_buf.height as u16,
                &mut frame_data,
            );
            let mut frame_with_delay = frame;
            frame_with_delay.delay = (100 / session.config.fps) as u16;
            encoder.write_frame(&frame_with_delay)?;
        }

        let inner = encoder.into_inner();
        match inner {
            Ok(w) => w.flush()?,
            Err(e) => return Err(e.into()),
        }

        info!("Encoded GIF: {:?}", output_path);
        Ok(output_path)
    }

    /// Get recording status
    pub async fn get_recording_status(&self, recording_id: &str) -> Option<RecordingStatus> {
        let sessions = self.sessions.lock().await;
        
        sessions.iter().find(|s| s.id == recording_id).map(|s| {
            RecordingStatus {
                recording_id: s.id.clone(),
                session_id: s.session_id.clone(),
                is_recording: s.is_recording,
                frames_captured: s.frames_captured,
                duration_secs: s.started_at.elapsed().as_secs_f64(),
                format: match s.config.format {
                    RecordingFormat::Gif => "gif",
                    RecordingFormat::WebM => "webm",
                    RecordingFormat::Mp4 => "mp4",
                }.to_string(),
            }
        })
    }
}

/// Recording result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingResult {
    pub recording_id: String,
    pub success: bool,
    pub file_path: Option<PathBuf>,
    pub file_size_bytes: Option<u64>,
    pub duration_secs: Option<f64>,
    pub frames_captured: Option<u32>,
    pub error: Option<String>,
}

/// Recording status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingStatus {
    pub recording_id: String,
    pub session_id: String,
    pub is_recording: bool,
    pub frames_captured: u32,
    pub duration_secs: f64,
    pub format: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_recorder_lifecycle() {
        let recorder = ScreenRecorder::new(Some(PathBuf::from("/tmp/test_recordings")));
        
        let config = RecordingConfig {
            format: RecordingFormat::Gif,
            fps: 10,
            quality: 80,
            max_width: 1280,
            max_height: 720,
            output_path: None,
        };

        let recording_id = recorder.start_recording("test_session".to_string(), config).await.unwrap();
        assert!(!recording_id.is_empty());

        let status = recorder.get_recording_status(&recording_id).await;
        assert!(status.is_some());
        assert!(status.unwrap().is_recording);

        let result = recorder.stop_recording(&recording_id, false).await.unwrap();
        assert!(result.success);
        assert!(result.file_path.is_none()); // Didn't save
    }
}
