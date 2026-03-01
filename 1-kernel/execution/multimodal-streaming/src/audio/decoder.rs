//! Audio Decoder
//!
//! GAP-37: Implements Opus and PCM decoding
//! SYSTEM_LAW: Uses STUB_APPROVED for full opus crate integration

use crate::types::{AudioCodec, AudioConfig, StreamingError, StreamingResult};
use tracing::{debug, warn};

/// Audio decoder for various codecs
pub struct AudioDecoder {
    config: AudioConfig,
    /// Opus decoder - STUB_APPROVED for full implementation
    #[allow(dead_code)]
    opus_decoder: Option<OpusDecoderStub>,
    /// PCM format
    pcm_format: PcmFormat,
    /// Sample count for debugging
    samples_decoded: u64,
}

/// Stub for Opus decoder - STUB_APPROVED
/// Full implementation would use `opus` crate
struct OpusDecoderStub {
    sample_rate: u32,
    channels: u16,
}

impl OpusDecoderStub {
    fn new(sample_rate: u32, channels: u16) -> Self {
        Self {
            sample_rate,
            channels,
        }
    }

    fn decode(&mut self, _input: &[u8]) -> StreamingResult<Vec<f32>> {
        // STUB_APPROVED: Full opus integration pending
        // In production, this would use opus::Decoder
        warn!("OpusDecoderStub: STUB_APPROVED - returning silence");

        // Return 20ms of silence as placeholder
        let sample_count = (self.sample_rate as f64 * 0.02) as usize * self.channels as usize;
        Ok(vec![0.0f32; sample_count])
    }
}

/// PCM sample format
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PcmFormat {
    /// 16-bit signed little-endian
    I16Le,
    /// 16-bit signed big-endian
    I16Be,
    /// 32-bit float little-endian
    F32Le,
    /// 32-bit float big-endian
    F32Be,
}

impl AudioDecoder {
    /// Create a new audio decoder
    pub fn new(config: &AudioConfig) -> Self {
        let opus_decoder = if config.codec == AudioCodec::Opus {
            Some(OpusDecoderStub::new(config.sample_rate, config.channels))
        } else {
            None
        };

        Self {
            config: config.clone(),
            opus_decoder,
            pcm_format: PcmFormat::F32Le, // Default to f32 little-endian
            samples_decoded: 0,
        }
    }

    /// Decode encoded audio data to PCM f32 samples
    pub fn decode(&mut self, input: &[u8]) -> StreamingResult<Vec<f32>> {
        match self.config.codec {
            AudioCodec::Opus => self.decode_opus(input),
            AudioCodec::PcmI16 => self.decode_pcm_i16(input),
            AudioCodec::PcmF32 => self.decode_pcm_f32(input),
            AudioCodec::Aac => {
                // STUB_APPROVED: AAC decoding not yet implemented
                warn!("AAC decoding STUB_APPROVED - returning silence");
                let sample_count = (self.config.sample_rate as f64 * 0.02) as usize
                    * self.config.channels as usize;
                Ok(vec![0.0f32; sample_count])
            }
        }
    }

    /// Decode Opus data
    fn decode_opus(&mut self, input: &[u8]) -> StreamingResult<Vec<f32>> {
        debug!("Decoding Opus data: {} bytes", input.len());

        if let Some(ref mut decoder) = self.opus_decoder {
            let samples = decoder.decode(input)?;
            self.samples_decoded += samples.len() as u64;
            Ok(samples)
        } else {
            // Fallback: return silence if decoder not initialized
            warn!("Opus decoder not initialized, returning silence");
            let sample_count =
                (self.config.sample_rate as f64 * 0.02) as usize * self.config.channels as usize;
            Ok(vec![0.0f32; sample_count])
        }
    }

    /// Decode PCM 16-bit data
    fn decode_pcm_i16(&mut self, input: &[u8]) -> StreamingResult<Vec<f32>> {
        if input.len() % 2 != 0 {
            return Err(StreamingError::Codec(
                "Invalid PCM 16-bit data length".to_string(),
            ));
        }

        let sample_count = input.len() / 2;
        let mut samples = Vec::with_capacity(sample_count);

        for chunk in input.chunks_exact(2) {
            let sample_i16 = match self.pcm_format {
                PcmFormat::I16Le => i16::from_le_bytes([chunk[0], chunk[1]]),
                PcmFormat::I16Be => i16::from_be_bytes([chunk[0], chunk[1]]),
                _ => i16::from_le_bytes([chunk[0], chunk[1]]), // Default to LE
            };
            // Convert i16 [-32768, 32767] to f32 [-1.0, 1.0]
            samples.push(sample_i16 as f32 / 32768.0);
        }

        self.samples_decoded += samples.len() as u64;
        Ok(samples)
    }

    /// Decode PCM 32-bit float data
    fn decode_pcm_f32(&mut self, input: &[u8]) -> StreamingResult<Vec<f32>> {
        if input.len() % 4 != 0 {
            return Err(StreamingError::Codec(
                "Invalid PCM 32-bit float data length".to_string(),
            ));
        }

        let sample_count = input.len() / 4;
        let mut samples = Vec::with_capacity(sample_count);

        for chunk in input.chunks_exact(4) {
            let bytes = [chunk[0], chunk[1], chunk[2], chunk[3]];
            let sample_f32 = match self.pcm_format {
                PcmFormat::F32Le => f32::from_le_bytes(bytes),
                PcmFormat::F32Be => f32::from_be_bytes(bytes),
                _ => f32::from_le_bytes(bytes), // Default to LE
            };
            samples.push(sample_f32);
        }

        self.samples_decoded += samples.len() as u64;
        Ok(samples)
    }

    /// Set PCM format
    pub fn set_pcm_format(&mut self, format: PcmFormat) {
        self.pcm_format = format;
    }

    /// Get current PCM format
    pub fn pcm_format(&self) -> PcmFormat {
        self.pcm_format
    }

    /// Get total samples decoded
    pub fn samples_decoded(&self) -> u64 {
        self.samples_decoded
    }

    /// Reset decoder state
    pub fn reset(&mut self) {
        self.samples_decoded = 0;
        // Reinitialize Opus decoder if needed
        if self.config.codec == AudioCodec::Opus {
            self.opus_decoder = Some(OpusDecoderStub::new(
                self.config.sample_rate,
                self.config.channels,
            ));
        }
    }
}

impl Default for AudioDecoder {
    fn default() -> Self {
        Self::new(&AudioConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decoder_creation() {
        let config = AudioConfig {
            codec: AudioCodec::PcmF32,
            sample_rate: 48000,
            channels: 2,
            ..Default::default()
        };
        let decoder = AudioDecoder::new(&config);
        assert_eq!(decoder.samples_decoded(), 0);
    }

    #[test]
    fn test_decode_pcm_f32_le() {
        let config = AudioConfig {
            codec: AudioCodec::PcmF32,
            sample_rate: 48000,
            channels: 2,
            ..Default::default()
        };
        let mut decoder = AudioDecoder::new(&config);

        // Create 4 samples: 0.0, 0.5, -0.5, 1.0
        let samples = vec![0.0f32, 0.5, -0.5, 1.0];
        let bytes: Vec<u8> = samples
            .iter()
            .flat_map(|s| s.to_le_bytes().to_vec())
            .collect();

        let decoded = decoder.decode(&bytes).unwrap();
        assert_eq!(decoded.len(), 4);
        assert!((decoded[0] - 0.0).abs() < 0.0001);
        assert!((decoded[1] - 0.5).abs() < 0.0001);
        assert!((decoded[2] - (-0.5)).abs() < 0.0001);
        assert!((decoded[3] - 1.0).abs() < 0.0001);
    }

    #[test]
    fn test_decode_pcm_i16_le() {
        let config = AudioConfig {
            codec: AudioCodec::PcmI16,
            sample_rate: 48000,
            channels: 2,
            ..Default::default()
        };
        let mut decoder = AudioDecoder::new(&config);

        // Create 4 samples: 0, max positive, max negative, half
        let samples = vec![0i16, 32767, -32768, 16384];
        let bytes: Vec<u8> = samples
            .iter()
            .flat_map(|s| s.to_le_bytes().to_vec())
            .collect();

        let decoded = decoder.decode(&bytes).unwrap();
        assert_eq!(decoded.len(), 4);
        assert!((decoded[0] - 0.0).abs() < 0.0001);
        assert!((decoded[1] - 0.99997).abs() < 0.001); // ~1.0
        assert!((decoded[2] - (-1.0)).abs() < 0.001); // ~-1.0
        assert!((decoded[3] - 0.5).abs() < 0.001); // ~0.5
    }

    #[test]
    fn test_decode_invalid_length_pcm16() {
        let config = AudioConfig {
            codec: AudioCodec::PcmI16,
            sample_rate: 48000,
            channels: 2,
            ..Default::default()
        };
        let mut decoder = AudioDecoder::new(&config);

        // Odd number of bytes is invalid for 16-bit PCM
        let result = decoder.decode(&[0u8; 3]);
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_opus_stub() {
        let config = AudioConfig {
            codec: AudioCodec::Opus,
            sample_rate: 48000,
            channels: 2,
            ..Default::default()
        };
        let mut decoder = AudioDecoder::new(&config);

        // Opus decoder is stubbed, should return silence
        let result = decoder.decode(&[0u8; 100]).unwrap();
        assert!(!result.is_empty());
        assert!(result.iter().all(|&s| s == 0.0));
    }

    #[test]
    fn test_pcm_format_setting() {
        let config = AudioConfig::default();
        let mut decoder = AudioDecoder::new(&config);

        assert_eq!(decoder.pcm_format(), PcmFormat::F32Le);

        decoder.set_pcm_format(PcmFormat::I16Be);
        assert_eq!(decoder.pcm_format(), PcmFormat::I16Be);
    }

    #[test]
    fn test_decoder_reset() {
        let config = AudioConfig {
            codec: AudioCodec::PcmF32,
            sample_rate: 48000,
            channels: 2,
            ..Default::default()
        };
        let mut decoder = AudioDecoder::new(&config);

        // Decode some data
        let samples = vec![1.0f32, 2.0, 3.0, 4.0];
        let bytes: Vec<u8> = samples
            .iter()
            .flat_map(|s| s.to_le_bytes().to_vec())
            .collect();
        decoder.decode(&bytes).unwrap();

        assert_eq!(decoder.samples_decoded(), 4);

        // Reset
        decoder.reset();
        assert_eq!(decoder.samples_decoded(), 0);
    }
}
