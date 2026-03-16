use anyhow::Result;
use std::env;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub port: u16,
    pub data_dir: String,
    pub rails_url: Option<String>,
    pub cache_size: u64,
    pub git_remote: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Self {
            port: env::var("PROMPT_PACK_PORT")
                .unwrap_or_else(|_| "3005".to_string())
                .parse()?,
            data_dir: env::var("PROMPT_PACK_DATA_DIR")
                .unwrap_or_else(|_| "./data".to_string()),
            rails_url: env::var("PROMPT_PACK_RAILS_URL").ok(),
            cache_size: env::var("PROMPT_PACK_CACHE_SIZE")
                .unwrap_or_else(|_| "1000".to_string())
                .parse()?,
            git_remote: env::var("PROMPT_PACK_GIT_REMOTE").ok(),
        })
    }
}
