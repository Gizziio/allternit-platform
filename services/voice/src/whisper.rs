//! Local speech-to-text via whisper.cpp's `whisper-cli`.
//!
//! Resolves the CLI binary and ggml model from env, bundled paths, or PATH.
//! Missing models are downloaded once from the official ggml-org release
//! (no account). Audio is written as 16 kHz 16-bit mono WAV for whisper.

use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tracing::{info, warn};

const DEFAULT_MODEL_NAME: &str = "ggml-tiny.en.bin";
const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin";
const TRANSCRIBE_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Debug, Clone)]
pub struct WhisperEngine {
    cli: PathBuf,
    model: PathBuf,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct WhisperHealth {
    pub cli: Option<String>,
    pub model: Option<String>,
    pub cli_ok: bool,
    pub model_ok: bool,
}

impl WhisperEngine {
    pub fn resolve() -> Self {
        Self {
            cli: resolve_cli(),
            model: resolve_model(),
        }
    }

    pub fn health(&self) -> WhisperHealth {
        WhisperHealth {
            cli: Some(self.cli.display().to_string()),
            model: Some(self.model.display().to_string()),
            cli_ok: is_executable(&self.cli),
            model_ok: self.model.is_file(),
        }
    }

    pub fn is_ready(&self) -> bool {
        let h = self.health();
        h.cli_ok && h.model_ok
    }

    /// Download the ggml model when it is missing. No-op when present.
    pub async fn ensure_model(&self) -> Result<(), String> {
        if self.model.is_file() {
            return Ok(());
        }
        if let Some(parent) = self.model.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("create model dir: {e}"))?;
        }
        info!("Downloading whisper model from {MODEL_URL}");
        let response = reqwest::get(MODEL_URL)
            .await
            .map_err(|e| format!("download model: {e}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "download model: HTTP {}",
                response.status()
            ));
        }
        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("download model body: {e}"))?;
        let tmp = self.model.with_extension("bin.partial");
        tokio::fs::write(&tmp, &bytes)
            .await
            .map_err(|e| format!("write model: {e}"))?;
        tokio::fs::rename(&tmp, &self.model)
            .await
            .map_err(|e| format!("stage model: {e}"))?;
        info!("Whisper model ready at {}", self.model.display());
        Ok(())
    }

    pub async fn transcribe(
        &self,
        audio: &[u8],
        language: Option<&str>,
    ) -> Result<String, String> {
        if !is_executable(&self.cli) {
            return Err(format!(
                "whisper-cli not found at {} (set WHISPER_CLI or install whisper.cpp)",
                self.cli.display()
            ));
        }
        self.ensure_model().await?;

        let wav = ensure_wav(audio);
        let dir = tempfile::tempdir().map_err(|e| format!("temp dir: {e}"))?;
        let wav_path = dir.path().join("utterance.wav");
        let mut file = tokio::fs::File::create(&wav_path)
            .await
            .map_err(|e| format!("create wav: {e}"))?;
        file.write_all(&wav)
            .await
            .map_err(|e| format!("write wav: {e}"))?;
        file.flush().await.map_err(|e| format!("flush wav: {e}"))?;
        drop(file);

        let lang = language
            .map(str::trim)
            .filter(|s| !s.is_empty() && *s != "auto")
            .unwrap_or("en");

        let mut cmd = tokio::process::Command::new(&self.cli);
        cmd.arg("-m")
            .arg(&self.model)
            .arg("-f")
            .arg(&wav_path)
            .arg("-nt")
            .arg("-np")
            .arg("-l")
            .arg(lang)
            .kill_on_drop(true);

        let output = tokio::time::timeout(TRANSCRIBE_TIMEOUT, cmd.output())
            .await
            .map_err(|_| "whisper-cli timed out".to_string())?
            .map_err(|e| format!("spawn whisper-cli: {e}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "whisper-cli exited {}: {stderr}",
                output.status
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let text = clean_transcript(&stdout);
        if text.is_empty() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.trim().is_empty() {
                warn!("whisper-cli produced empty transcript: {stderr}");
            }
        }
        Ok(text)
    }
}

fn resolve_cli() -> PathBuf {
    if let Ok(explicit) = std::env::var("WHISPER_CLI") {
        return PathBuf::from(explicit);
    }
    let mut candidates = bundled_bin_dirs();
    for dir in &candidates {
        for name in ["whisper-cli", "whisper-cli.exe"] {
            let p = dir.join(name);
            if is_executable(&p) {
                return p;
            }
        }
    }
    if let Some(path) = which("whisper-cli").or_else(|| which("whisper-cpp")) {
        return path;
    }
    candidates
        .pop()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(if cfg!(windows) {
            "whisper-cli.exe"
        } else {
            "whisper-cli"
        })
}

fn resolve_model() -> PathBuf {
    if let Ok(explicit) = std::env::var("WHISPER_MODEL") {
        return PathBuf::from(explicit);
    }
    for dir in bundled_bin_dirs() {
        let p = dir.join("models").join(DEFAULT_MODEL_NAME);
        if p.is_file() {
            return p;
        }
        let sibling = dir.join(DEFAULT_MODEL_NAME);
        if sibling.is_file() {
            return sibling;
        }
    }
    default_user_model_path()
}

fn default_user_model_path() -> PathBuf {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".allternit")
        .join("models")
        .join("whisper")
        .join(DEFAULT_MODEL_NAME)
}

fn bundled_bin_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            dirs.push(parent.to_path_buf());
            dirs.push(parent.join("bin"));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        dirs.push(cwd.join("services").join("voice").join("dist"));
        dirs.push(cwd.join("resources").join("bin"));
    }
    dirs
}

fn which(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(name);
        if is_executable(&candidate) {
            return Some(candidate);
        }
        if cfg!(windows) {
            let exe = dir.join(format!("{name}.exe"));
            if is_executable(&exe) {
                return Some(exe);
            }
        }
    }
    None
}

fn is_executable(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::metadata(path)
            .map(|m| m.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        true
    }
}

/// If `audio` is already a WAV container, return it. Otherwise wrap 16 kHz
/// 16-bit mono PCM in a WAV header (the capture format used by Gizzi).
pub fn ensure_wav(audio: &[u8]) -> Vec<u8> {
    if audio.len() >= 12 && audio.starts_with(b"RIFF") && audio[8..12] == *b"WAVE" {
        return audio.to_vec();
    }
    pcm16le_to_wav(audio, 16_000, 1)
}

pub fn pcm16le_to_wav(pcm: &[u8], sample_rate: u32, channels: u16) -> Vec<u8> {
    let data_len = pcm.len() as u32;
    let byte_rate = sample_rate * u32::from(channels) * 2;
    let block_align = channels * 2;
    let mut out = Vec::with_capacity(44 + pcm.len());
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len).to_le_bytes());
    out.extend_from_slice(b"WAVE");
    out.extend_from_slice(b"fmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&channels.to_le_bytes());
    out.extend_from_slice(&sample_rate.to_le_bytes());
    out.extend_from_slice(&byte_rate.to_le_bytes());
    out.extend_from_slice(&block_align.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    out.extend_from_slice(pcm);
    out
}

fn clean_transcript(raw: &str) -> String {
    raw.lines()
        .map(str::trim)
        .filter(|line| {
            !line.is_empty()
                && !line.starts_with('[')
                && !line.starts_with("whisper_")
                && !line.starts_with("system_info")
                && !line.starts_with("main:")
        })
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wav_header_roundtrip_size() {
        let pcm = vec![0u8; 32000];
        let wav = pcm16le_to_wav(&pcm, 16_000, 1);
        assert_eq!(wav.len(), 44 + 32000);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(ensure_wav(&wav).len(), wav.len());
    }

    #[test]
    fn clean_transcript_strips_whisper_logs() {
        let raw = "whisper_init_from_file_with_params\nHello world\n";
        assert_eq!(clean_transcript(raw), "Hello world");
    }
}
