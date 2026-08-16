//! Simple size-based rotating log writer.

use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};

/// Default maximum size of a single log file before rotation (10 MiB).
const DEFAULT_MAX_SIZE: u64 = 10 * 1024 * 1024;

/// Rotates `{path}` -> `{path}.1` -> `{path}.2`, removing `{path}.2` first.
async fn rotate(path: &PathBuf) -> std::io::Result<()> {
    let mut backup2 = path.clone();
    backup2.set_extension("log.2");
    let mut backup1 = path.clone();
    backup1.set_extension("log.1");

    let _ = fs::remove_file(&backup2).await;
    let _ = fs::rename(&backup1, &backup2).await;
    fs::rename(path, &backup1).await
}

/// Continuously read from `reader` and append to `path`, rotating when the
/// file exceeds `max_size`.
pub async fn pump_to_log<R>(mut reader: R, path: PathBuf, max_size: u64) -> std::io::Result<()>
where
    R: AsyncRead + Unpin,
{
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .await?;

    let mut buf = vec![0u8; 8192];
    let mut current_size = file.metadata().await.map(|m| m.len()).unwrap_or(0);

    loop {
        let n = reader.read(&mut buf).await?;
        if n == 0 {
            file.flush().await?;
            return Ok(());
        }

        if current_size + n as u64 > max_size && current_size > 0 {
            drop(file);
            rotate(&path).await?;
            file = fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&path)
                .await?;
            current_size = 0;
        }

        file.write_all(&buf[..n]).await?;
        current_size += n as u64;
    }
}

/// Convenience wrapper using the default max size.
pub async fn pump<R>(reader: R, path: PathBuf) -> std::io::Result<()>
where
    R: AsyncRead + Unpin,
{
    pump_to_log(reader, path, DEFAULT_MAX_SIZE).await
}
