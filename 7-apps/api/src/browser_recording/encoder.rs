// 7-apps/api/src/browser_recording/encoder.rs
//! GIF Encoder
//!
//! Encodes captured frames as animated GIF.

use anyhow::{Context, Result};
use gif::{Encoder, Frame, Repeat};
use image::{GenericImageView, ImageReader};
use std::io::{BufWriter, Write};
use std::path::Path;
use tracing::{debug, info};

/// GIF Encoder for browser recordings
pub struct GifEncoder {
    fps: u32,
    quality: u32,
}

impl GifEncoder {
    /// Create a new GIF encoder
    pub fn new(fps: u32, quality: u32) -> Self {
        Self { fps, quality }
    }

    /// Encode frames to GIF
    pub async fn encode(&self, frames: &Vec<Vec<u8>>, output_path: &Path) -> Result<()> {
        if frames.is_empty() {
            anyhow::bail!("No frames to encode");
        }

        debug!("Encoding {} frames to GIF", frames.len());

        // Create output file
        let file = tokio::fs::File::create(output_path)
            .await
            .context("Failed to create output file")?;
        
        let file = file.into_std().await;
        let ref mut w = BufWriter::new(file);

        // Decode first frame to get dimensions
        let first_frame = ImageReader::new(std::io::Cursor::new(&frames[0]))
            .with_guessed_format()
            .context("Failed to read first frame")?
            .decode()
            .context("Failed to decode first frame")?;
        
        let (width, height) = first_frame.dimensions();
        let width = width.min(1280) as u16;
        let height = height.min(720) as u16;

        // Create GIF encoder
        let mut encoder = Encoder::new(w, width, height, &[])
            .context("Failed to create GIF encoder")?;
        
        encoder.set_repeat(Repeat::Finite(0))?; // Infinite loop

        // Calculate frame delay in centiseconds
        let delay = (100 / self.fps) as u16;

        // Encode each frame
        for (i, frame_data) in frames.iter().enumerate() {
            // Decode frame
            let img = ImageReader::new(std::io::Cursor::new(frame_data))
                .with_guessed_format()
                .context(format!("Failed to read frame {}", i))?
                .decode()
                .context(format!("Failed to decode frame {}", i))?;
            
            // Resize if needed
            let img = img.resize(width as u32, height as u32, image::imageops::FilterType::Lanczos3);
            let rgba = img.to_rgba8();

            // Convert to frame data
            let mut frame_data_vec = vec![0u8; (width as u32 * height as u32 * 4) as usize];
            for (i, pixel) in rgba.pixels().enumerate() {
                frame_data_vec[i * 4] = pixel[0];     // R
                frame_data_vec[i * 4 + 1] = pixel[1]; // G
                frame_data_vec[i * 4 + 2] = pixel[2]; // B
                frame_data_vec[i * 4 + 3] = pixel[3]; // A
            }

            // Create GIF frame
            let mut frame = Frame::from_rgba(width, height, &mut frame_data_vec);
            frame.delay = delay;

            // Write frame
            encoder.write_frame(&frame)
                .context(format!("Failed to write frame {}", i))?;

            debug!("Encoded frame {}/{}", i + 1, frames.len());
        }

        // Flush and finish
        let inner = encoder.into_inner();
        match inner {
            Ok(w) => w.flush().context("Failed to flush encoder")?,
            Err(e) => return Err(e.into()),
        }

        info!("Encoded GIF: {:?}", output_path);
        Ok(())
    }
}
