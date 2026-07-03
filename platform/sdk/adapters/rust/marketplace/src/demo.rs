use crate::{MarketplaceService, Asset, MarketplaceError};
use sqlx::{SqlitePool, sqlite::SqliteConnectOptions};
use std::path::PathBuf;

pub async fn seed_demo_data(pool: &SqlitePool) -> Result<(), MarketplaceError> {
    use uuid::Uuid;

    let sample_assets = vec![
        Asset {
            id: Some(Uuid::new_v4()),
            asset_id: "capsule-web-browser".to_string(),
            asset_type: "capsule".to_string(),
            version: "1.0.0".to_string(),
            name: "Web Browser Capsule".to_string(),
            description: "A full-featured web browsing capsule with ad-blocking and privacy features".to_string(),
            author: "a2labs".to_string(),
            trust_tier: "verified".to_string(),
            status: "published".to_string(),
            downloads: 15234,
            created_at: "2024-01-15T00:00:00Z".to_string(),
            updated_at: "2025-01-10T00:00:00Z".to_string(),
        },
        Asset {
            id: Some(Uuid::new_v4()),
            asset_id: "agent-code-assistant".to_string(),
            asset_type: "agent".to_string(),
            version: "2.3.1".to_string(),
            name: "Code Assistant Agent".to_string(),
            description: "AI-powered coding assistant with multiple language support and context awareness".to_string(),
            author: "a2ai".to_string(),
            trust_tier: "official".to_string(),
            status: "published".to_string(),
            downloads: 28456,
            created_at: "2024-02-01T00:00:00Z".to_string(),
            updated_at: "2025-01-15T00:00:00Z".to_string(),
        },
        Asset {
            id: Some(Uuid::new_v4()),
            asset_id: "pack-development-tools".to_string(),
            asset_type: "pack".to_string(),
            version: "1.2.0".to_string(),
            name: "Development Tools Pack".to_string(),
            description: "Collection of essential development tools: git, docker, node, python environments".to_string(),
            author: "community-dev".to_string(),
            trust_tier: "trusted".to_string(),
            status: "published".to_string(),
            downloads: 8765,
            created_at: "2023-11-20T00:00:00Z".to_string(),
            updated_at: "2025-01-12T00:00:00Z".to_string(),
        },
        Asset {
            id: Some(Uuid::new_v4()),
            asset_id: "capsule-terminal".to_string(),
            asset_type: "capsule".to_string(),
            version: "0.9.5".to_string(),
            name: "Terminal Capsule".to_string(),
            description: "Modern terminal emulator with split panes, themes, and integrations".to_string(),
            author: "a2labs".to_string(),
            trust_tier: "verified".to_string(),
            status: "published".to_string(),
            downloads: 11203,
            created_at: "2024-03-10T00:00:00Z".to_string(),
            updated_at: "2025-01-08T00:00:00Z".to_string(),
        },
        Asset {
            id: Some(Uuid::new_v4()),
            asset_id: "agent-data-analyst".to_string(),
            asset_type: "agent".to_string(),
            version: "1.8.0".to_string(),
            name: "Data Analyst Agent".to_string(),
            description: "Automated data analysis and visualization agent with chart generation".to_string(),
            author: "community-ai".to_string(),
            trust_tier: "community".to_string(),
            status: "published".to_string(),
            downloads: 5432,
            created_at: "2024-04-05T00:00:00Z".to_string(),
            updated_at: "2024-12-22T00:00:00Z".to_string(),
        },
        Asset {
            id: Some(Uuid::new_v4()),
            asset_id: "capsule-music-player".to_string(),
            asset_type: "capsule".to_string(),
            version: "2.1.0".to_string(),
            name: "Music Player Capsule".to_string(),
            description: "Feature-rich music player with support for multiple formats and streaming".to_string(),
            author: "a2labs".to_string(),
            trust_tier: "trusted".to_string(),
            status: "published".to_string(),
            downloads: 19821,
            created_at: "2023-12-01T00:00:00Z".to_string(),
            updated_at: "2025-01-05T00:00:00Z".to_string(),
        },
    ];

    let mut service = MarketplaceService::new(pool.clone()).await?;
    service.initialize_schema().await?;

    for asset in sample_assets {
        service.register_asset(&asset).await?;
    }

    Ok(())
}
