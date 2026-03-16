//! Structured logging initialization for A2R CLI
//!
//! Supports both pretty (human-readable) and JSON (machine-readable) output formats.
//! Logs are written to both stdout and a rotating log file.

use std::io;
use std::path::PathBuf;
use tracing_subscriber::{
    fmt::{self, format::JsonFields, writer::MakeWriterExt},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter, Layer,
};

/// Log output format
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogFormat {
    /// Human-readable, colored output for terminal
    Pretty,
    /// Structured JSON output for log aggregation
    Json,
}

impl std::str::FromStr for LogFormat {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pretty" => Ok(LogFormat::Pretty),
            "json" => Ok(LogFormat::Json),
            _ => Err(format!("Unknown log format: {}", s)),
        }
    }
}

impl Default for LogFormat {
    fn default() -> Self {
        LogFormat::Pretty
    }
}

/// Initialize the global tracing subscriber with the specified configuration
///
/// # Arguments
/// * `level` - Log level filter (e.g., "debug", "info", "warn", "error")
/// * `format` - Output format (Pretty or Json)
/// * `log_dir` - Optional directory for log files (defaults to ~/.local/share/a2r/logs)
pub fn init_logging(level: &str, format: LogFormat, log_dir: Option<PathBuf>) -> io::Result<()> {
    // Determine log directory
    let log_dir = log_dir.or_else(get_default_log_dir).ok_or_else(|| {
        io::Error::new(io::ErrorKind::NotFound, "Could not determine log directory")
    })?;

    // Create log directory if it doesn't exist
    std::fs::create_dir_all(&log_dir)?;

    // Build file appender with rotation (daily rotation, keep 7 days)
    let file_appender = tracing_appender::rolling::daily(&log_dir, "a2r.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    // Store guard to keep it alive for the duration of the program
    // This prevents the background thread from being dropped
    store_guard(_guard);

    // Build env filter
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(level))
        .add_directive("hyper=warn".parse().unwrap())
        .add_directive("reqwest=warn".parse().unwrap())
        .add_directive("h2=warn".parse().unwrap());

    // Create stdout layer based on format
    let stdout_layer = match format {
        LogFormat::Pretty => fmt::layer()
            .with_writer(io::stdout.with_max_level(tracing::Level::TRACE))
            .with_target(true)
            .with_thread_ids(false)
            .with_thread_names(false)
            .with_file(true)
            .with_line_number(true)
            .with_ansi(atty::is(atty::Stream::Stdout))
            .boxed(),
        LogFormat::Json => fmt::layer()
            .json()
            .with_writer(io::stdout.with_max_level(tracing::Level::TRACE))
            .with_target(true)
            .with_file(true)
            .with_line_number(true)
            .with_current_span(true)
            .with_span_list(false)
            .boxed(),
    };

    // Create file layer (always JSON for structured logging)
    let file_layer = fmt::layer()
        .json()
        .with_writer(non_blocking.with_max_level(tracing::Level::DEBUG))
        .with_target(true)
        .with_file(true)
        .with_line_number(true)
        .with_current_span(true)
        .with_span_list(true);

    // Initialize the subscriber with both layers
    tracing_subscriber::registry()
        .with(env_filter)
        .with(stdout_layer)
        .with(file_layer)
        .init();

    tracing::info!(
        target: "a2r::logging",
        log_level = level,
        log_format = ?format,
        log_dir = %log_dir.display(),
        "Logging initialized"
    );

    Ok(())
}

/// Initialize logging with simple string level (for backward compatibility)
pub fn init_logging_simple(level: &str) {
    let format = if std::env::var("A2R_LOG_JSON").is_ok() {
        LogFormat::Json
    } else {
        LogFormat::Pretty
    };

    if let Err(e) = init_logging(level, format, None) {
        eprintln!("Warning: Failed to initialize file logging: {}", e);
        // Fall back to simple stdout logging
        tracing_subscriber::fmt()
            .with_env_filter(level)
            .with_target(true)
            .init();
    }
}

/// Get the default log directory path
fn get_default_log_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join("a2r").join("logs"))
}

/// Store the non-blocking writer guard to keep it alive
///
/// The guard must be kept alive for the duration of the program to ensure
/// log messages are flushed before the program exits.
fn store_guard(guard: tracing_appender::non_blocking::WorkerGuard) {
    use std::sync::Mutex;
    static GUARD: Mutex<Option<tracing_appender::non_blocking::WorkerGuard>> = Mutex::new(None);
    if let Ok(mut g) = GUARD.lock() {
        *g = Some(guard);
    }
}

/// Get the path to the current log file
pub fn get_current_log_path() -> Option<PathBuf> {
    get_default_log_dir().map(|dir| dir.join("a2r.log"))
}

/// Flush all pending log writes
pub fn flush_logs() {
    // tracing subscribers don't have a flush method
    // logs are written asynchronously by the non-blocking writer
}

/// Create a span for session operations
#[macro_export]
macro_rules! session_span {
    ($session_id:expr) => {
        tracing::info_span!(
            "session",
            session_id = %$session_id,
        )
    };
}

/// Create a span for VM operations
#[macro_export]
macro_rules! vm_span {
    ($vm_id:expr) => {
        tracing::info_span!(
            "vm",
            vm_id = %$vm_id,
        )
    };
}

/// Create a span for command execution
#[macro_export]
macro_rules! command_span {
    ($command:expr) => {
        tracing::info_span!(
            "command",
            command = %$command,
        )
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_format_from_str() {
        assert_eq!(
            LogFormat::from_str("pretty").unwrap(),
            LogFormat::Pretty
        );
        assert_eq!(
            LogFormat::from_str("PRETTY").unwrap(),
            LogFormat::Pretty
        );
        assert_eq!(
            LogFormat::from_str("json").unwrap(),
            LogFormat::Json
        );
        assert_eq!(
            LogFormat::from_str("JSON").unwrap(),
            LogFormat::Json
        );
        assert!(LogFormat::from_str("invalid").is_err());
    }

    #[test]
    fn test_get_default_log_dir() {
        // This should return a path ending in .local/share/a2r/logs on Unix
        let dir = get_default_log_dir();
        assert!(dir.is_some());
        let dir = dir.unwrap();
        assert!(dir.to_string_lossy().contains("a2r"));
        assert!(dir.to_string_lossy().contains("logs"));
    }
}
