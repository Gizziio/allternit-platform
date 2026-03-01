use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTSRequest {
    pub text: String,
    #[serde(default = "default_voice")]
    pub voice: String,
    #[serde(default = "default_format")]
    pub format: String,
    #[serde(default = "default_paralinguistic")]
    pub use_paralinguistic: bool,
}

fn default_voice() -> String {
    "default".to_string()
}

fn default_format() -> String {
    "wav".to_string()
}

fn default_paralinguistic() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTSResponse {
    pub audio_url: String,
    pub duration: f64,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VCRequest {
    pub text: String,
    pub reference_audio_url: String,
    #[serde(default = "default_format")]
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VCResponse {
    pub audio_url: String,
    pub duration: f64,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<String>,
    pub current_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResponse {
    pub status: String,
    pub audio_url: String,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub model_loaded: bool,
}
