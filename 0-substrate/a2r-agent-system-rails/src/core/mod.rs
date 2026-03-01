pub mod ids;
pub mod io;
pub mod types;

use crate::core::types::A2REvent;
use async_trait::async_trait;

#[async_trait]
pub trait EventSink: Send + Sync {
    async fn append(&self, event: A2REvent) -> anyhow::Result<String>;
}
