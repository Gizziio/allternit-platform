//! Configuration Manager
//!
//! Manages CLI configuration loaded from profile files.

use anyhow::{Result, anyhow};
use serde_json::Value;
use std::path::{Path, PathBuf};

/// Configuration manager
pub struct ConfigManager {
    profile: String,
    config_path: PathBuf,
    config: Value,
}

impl ConfigManager {
    /// Load configuration for a profile
    pub fn load_for_profile(profile: Option<&str>) -> Result<Self> {
        let profile = profile.unwrap_or("default").to_string();
        
        // Determine config path
        let config_dir = directories::BaseDirs::new()
            .map(|d| d.config_dir().join("a2rchitech"))
            .or_else(|| directories::BaseDirs::new().map(|d| d.home_dir().join(".a2r")))
            .unwrap_or_else(|| PathBuf::from(".a2r"));

        std::fs::create_dir_all(&config_dir).ok();

        let config_path = config_dir.join(format!("{}.json", profile));

        // Load or create config
        let config = if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            serde_json::from_str(&content).unwrap_or(Value::Object(serde_json::Map::new()))
        } else {
            // Create default config
            let config = serde_json::json!({
                "kernel_url": "http://127.0.0.1:3000",
                "timeout_ms": 30000,
            });
            
            std::fs::write(&config_path, config.to_string()).ok();
            config
        };

        Ok(Self {
            profile,
            config_path,
            config,
        })
    }

    /// Get the profile name
    pub fn profile(&self) -> &str {
        &self.profile
    }

    /// Get the config file path
    pub fn path(&self) -> &Path {
        &self.config_path
    }

    /// Get the configuration
    pub fn get(&self) -> &Value {
        &self.config
    }

    /// Update the kernel URL
    pub fn update_url(&mut self, url: String) -> Result<()> {
        if let Some(obj) = self.config.as_object_mut() {
            obj.insert("kernel_url".to_string(), Value::String(url));
            self.save()?;
        }
        Ok(())
    }

    /// Get a value by path (e.g., "kernel.url")
    pub fn get_path(&self, path: &str) -> Result<Option<Value>> {
        let mut current = &self.config;
        
        for key in path.split('.') {
            if let Some(value) = current.get(key) {
                current = value;
            } else {
                return Ok(None);
            }
        }
        
        Ok(Some(current.clone()))
    }

    /// Set a value by path
    pub fn set_path(&mut self, path: &str, value: Value) -> Result<()> {
        let mut current = &mut self.config;
        let keys: Vec<&str> = path.split('.').collect();
        
        for (i, key) in keys.iter().enumerate() {
            if i == keys.len() - 1 {
                // Last key, set the value
                if let Some(obj) = current.as_object_mut() {
                    obj.insert(key.to_string(), value.clone());
                } else {
                    return Err(anyhow!("Cannot set value: parent is not an object"));
                }
            } else {
                // Navigate deeper
                if !current.get(key).map(|v| v.is_object()).unwrap_or(false) {
                    // Create intermediate object
                    if let Some(obj) = current.as_object_mut() {
                        obj.insert(key.to_string(), Value::Object(serde_json::Map::new()));
                    }
                }
                current = current.get_mut(key).unwrap();
            }
        }
        
        self.save()?;
        Ok(())
    }

    /// Remove a value by path
    pub fn unset_path(&mut self, path: &str) -> Result<bool> {
        let keys: Vec<&str> = path.split('.').collect();
        let mut current = &mut self.config;
        
        for (i, key) in keys.iter().enumerate() {
            if i == keys.len() - 1 {
                // Last key, remove it
                if let Some(obj) = current.as_object_mut() {
                    return Ok(obj.remove(*key).is_some());
                } else {
                    return Ok(false);
                }
            } else {
                // Navigate deeper
                if let Some(value) = current.get_mut(key) {
                    if value.is_object() {
                        current = value;
                    } else {
                        return Ok(false);
                    }
                } else {
                    return Ok(false);
                }
            }
        }
        
        self.save()?;
        Ok(true)
    }

    /// Save configuration to file
    fn save(&self) -> Result<()> {
        std::fs::write(&self.config_path, self.config.to_string())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_path() {
        let config = ConfigManager {
            profile: "test".to_string(),
            config_path: PathBuf::from("test.json"),
            config: serde_json::json!({
                "kernel": {
                    "url": "http://localhost:3000",
                    "timeout": 30000,
                }
            }),
        };

        assert_eq!(
            config.get_path("kernel.url").unwrap(),
            Some(Value::String("http://localhost:3000".to_string()))
        );
        assert_eq!(
            config.get_path("kernel.timeout").unwrap(),
            Some(Value::Number(30000.into()))
        );
        assert_eq!(config.get_path("nonexistent").unwrap(), None);
    }

    #[test]
    fn test_set_path() {
        let mut config = ConfigManager {
            profile: "test".to_string(),
            config_path: PathBuf::from("test.json"),
            config: serde_json::json!({}),
        };

        config
            .set_path("kernel.url", Value::String("http://test:3000".to_string()))
            .unwrap();
        
        assert_eq!(
            config.get_path("kernel.url").unwrap(),
            Some(Value::String("http://test:3000".to_string()))
        );
    }
}
