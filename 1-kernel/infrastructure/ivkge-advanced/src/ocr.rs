//! OCR Integration Module
//!
//! Extracts text from images using OCR.

use crate::IvkgeError;
use serde::{Deserialize, Serialize};

/// OCR result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrResult {
    pub text: String,
    pub confidence: f32,
    pub text_regions: Vec<TextRegion>,
    pub language: String,
}

/// Text region in an image
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRegion {
    pub text: String,
    pub confidence: f32,
    pub bounding_box: OcrBoundingBox,
}

/// OCR bounding box
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrBoundingBox {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// OCR Engine
pub struct OcrEngine {
    default_language: String,
    confidence_threshold: f32,
}

impl OcrEngine {
    /// Create a new OCR engine
    pub fn new() -> Self {
        Self {
            default_language: "en".to_string(),
            confidence_threshold: 0.5,
        }
    }

    /// Extract text from image
    pub fn extract_text(&self, image_data: &[u8]) -> Result<OcrResult, IvkgeError> {
        // In production, this would integrate with Tesseract or cloud OCR
        // For now, return a placeholder implementation

        // Validate image
        let _img = image::load_from_memory(image_data)
            .map_err(|e| IvkgeError::OcrFailed(e.to_string()))?;

        // Placeholder: return empty result
        // Real implementation would:
        // 1. Preprocess image (grayscale, threshold, etc.)
        // 2. Detect text regions
        // 3. Run OCR on each region
        // 4. Post-process and combine results

        Ok(OcrResult {
            text: String::new(),
            confidence: 0.0,
            text_regions: vec![],
            language: self.default_language.clone(),
        })
    }

    /// Set default language
    pub fn set_language(&mut self, language: &str) {
        self.default_language = language.to_string();
    }

    /// Set confidence threshold
    pub fn set_confidence_threshold(&mut self, threshold: f32) {
        self.confidence_threshold = threshold.clamp(0.0, 1.0);
    }

    /// Get supported languages
    pub fn supported_languages(&self) -> Vec<&str> {
        vec!["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko"]
    }
}

impl Default for OcrEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ocr_engine_creation() {
        let engine = OcrEngine::new();
        assert_eq!(engine.default_language, "en");
        assert_eq!(engine.confidence_threshold, 0.5);
    }

    #[test]
    fn test_ocr_language_setting() {
        let mut engine = OcrEngine::new();
        engine.set_language("es");
        assert_eq!(engine.default_language, "es");
    }

    #[test]
    fn test_ocr_threshold_clamping() {
        let mut engine = OcrEngine::new();
        engine.set_confidence_threshold(1.5);
        assert_eq!(engine.confidence_threshold, 1.0);
    }

    #[test]
    fn test_supported_languages() {
        let engine = OcrEngine::new();
        let languages = engine.supported_languages();
        assert!(languages.contains(&"en"));
        assert!(languages.contains(&"zh"));
        assert!(languages.contains(&"ja"));
    }

    #[test]
    fn test_ocr_invalid_image() {
        let engine = OcrEngine::new();
        let invalid_data: &[u8] = b"not an image";

        let result = engine.extract_text(invalid_data);
        assert!(result.is_err());
        assert!(matches!(result, Err(IvkgeError::OcrFailed(_))));
    }

    #[test]
    fn test_ocr_result_structure() {
        let result = OcrResult {
            text: "Hello World".to_string(),
            confidence: 0.95,
            text_regions: vec![],
            language: "en".to_string(),
        };

        assert_eq!(result.text, "Hello World");
        assert_eq!(result.confidence, 0.95);
        assert_eq!(result.language, "en");
    }

    #[test]
    fn test_text_region_structure() {
        let region = TextRegion {
            text: "Test".to_string(),
            confidence: 0.88,
            bounding_box: OcrBoundingBox {
                x: 10,
                y: 20,
                width: 100,
                height: 30,
            },
        };

        assert_eq!(region.text, "Test");
        assert_eq!(region.bounding_box.x, 10);
        assert_eq!(region.bounding_box.y, 20);
    }
}
