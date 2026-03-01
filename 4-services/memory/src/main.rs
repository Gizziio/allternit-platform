use a2rchitech_simple_memory::{MemoryConfig, MemoryService};
use tracing::{info, error};
use tracing_subscriber;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    info!("Initializing Memory Service...");

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3200".to_string())
        .parse()
        .unwrap_or(3200);
    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());

    let config = MemoryConfig {
        port,
        host,
        storage_path: "./memory-store".to_string(),
    };
    
    let service = MemoryService::new(config);
    
    match service.start().await {
        Ok(()) => {
            info!("Memory Service started successfully");
            // Keep the service running
            tokio::signal::ctrl_c().await?;
            info!("Shutting down Memory Service...");
        }
        Err(e) => {
            error!("Failed to start Memory Service: {}", e);
            return Err(e.into());
        }
    }
    
    Ok(())
}
