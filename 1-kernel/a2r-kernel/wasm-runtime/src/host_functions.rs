//! Host function implementations for WASM tools.

use crate::bindings::a2rchitech::tool_abi::{host, types};
use crate::bindings::ToolComponent;
use crate::capabilities::Capability;
use crate::host::{LogLevel, ToolHostState};

impl host::Host for ToolHostState {
    /// Log a message to the event ledger.
    fn log(&mut self, level: String, message: String) {
        let log_level = match level.as_str() {
            "TRACE" => LogLevel::Trace,
            "DEBUG" => LogLevel::Debug,
            "INFO" => LogLevel::Info,
            "WARN" => LogLevel::Warn,
            "ERROR" => LogLevel::Error,
            _ => LogLevel::Info, // Default to Info if unknown level
        };

        self.log_event(message, log_level);
    }

    /// Check if a capability is granted.
    fn check_capability(&mut self, capability_type: String) -> bool {
        let allowed = ToolHostState::check_capability(self, capability_type.as_str());
        tracing::debug!("Capability check: {} -> {}", capability_type, allowed);
        allowed
    }

    /// Get an environment variable (if allowed by policy).
    fn get_env(&mut self, name: String) -> Option<String> {
        if !ToolHostState::check_capability(self, "environment") {
            tracing::warn!("Environment access denied for variable: {}", name);
            return None;
        }

        let allowed = match self.capability_set.get("environment") {
            Some(Capability::Environment { allowed_vars }) => {
                allowed_vars.iter().any(|var| var == "*" || var == &name)
            }
            _ => false,
        };
        if !allowed {
            tracing::warn!("Environment access denied for variable: {}", name);
            return None;
        }

        self.record_host_call("get_env");

        match std::env::var(&name) {
            Ok(value) => {
                tracing::debug!("Environment variable accessed: {} = {}", name, value);
                Some(value)
            }
            Err(std::env::VarError::NotPresent) => {
                tracing::debug!("Environment variable not found: {}", name);
                None
            }
            Err(e) => {
                tracing::error!("Error accessing environment variable {}: {}", name, e);
                None
            }
        }
    }

    /// Get the current timestamp.
    fn now(&mut self) -> u64 {
        if !ToolHostState::check_capability(self, "clock") {
            tracing::warn!("Clock access denied");
            return 0;
        }

        self.record_host_call("now");

        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0)
    }

    /// Generate a random UUID.
    fn random_uuid(&mut self) -> String {
        if !ToolHostState::check_capability(self, "random") {
            tracing::warn!("Random access denied");
            return String::new();
        }

        self.record_host_call("random_uuid");

        let uuid = uuid::Uuid::new_v4().to_string();
        tracing::debug!("Generated UUID: {}", uuid);
        uuid
    }

    /// Read a file from the filesystem (requires filesystem:read capability).
    fn read_file(&mut self, path: String) -> Result<String, String> {
        if !ToolHostState::check_capability(self, "filesystem:read") {
            tracing::warn!("Filesystem read access denied for path: {}", path);
            return Err("Filesystem read access denied".to_string());
        }

        // Check if the path is allowed by the capability grant
        if !self.capability_set.can_read_path(&path) {
            tracing::warn!(
                "Filesystem read access denied for path (not in allowlist): {}",
                path
            );
            return Err("Path not in allowlist".to_string());
        }

        self.record_host_call("read_file");

        std::fs::read_to_string(&path).map_err(|e| {
            tracing::error!("Failed to read file {}: {}", path, e);
            e.to_string()
        })
    }

    /// Write a file to the filesystem (requires filesystem:write capability).
    fn write_file(&mut self, path: String, content: String) -> Result<(), String> {
        if !ToolHostState::check_capability(self, "filesystem:write") {
            tracing::warn!("Filesystem write access denied for path: {}", path);
            return Err("Filesystem write access denied".to_string());
        }

        // Check if the path is allowed by the capability grant
        if !self.capability_set.can_write_path(&path) {
            tracing::warn!(
                "Filesystem write access denied for path (not in allowlist): {}",
                path
            );
            return Err("Path not in allowlist".to_string());
        }

        self.record_host_call("write_file");

        std::fs::write(&path, content).map_err(|e| {
            tracing::error!("Failed to write file {}: {}", path, e);
            e.to_string()
        })
    }

    /// Make an HTTP request (requires http-client capability).
    fn http_request(
        &mut self,
        method: String,
        url: String,
        headers: Vec<(String, String)>,
        body: Option<String>,
    ) -> Result<types::HttpResponse, String> {
        if !ToolHostState::check_capability(self, "http-client") {
            tracing::warn!("HTTP client access denied for URL: {}", url);
            return Err("HTTP client access denied".to_string());
        }

        // Parse the URL to extract host and port
        let parsed_url = url::Url::parse(&url).map_err(|e| e.to_string())?;
        let host = parsed_url.host_str().ok_or("Invalid URL: no host")?;
        let port = parsed_url.port().unwrap_or_else(|| {
            if parsed_url.scheme() == "https" {
                443
            } else {
                80
            }
        });

        // Check if the host/port is allowed by the capability grant
        if !self.capability_set.can_access_host(host, port) {
            tracing::warn!(
                "HTTP client access denied for host: {} port: {}",
                host,
                port
            );
            return Err("Host not in allowlist".to_string());
        }

        self.record_host_call("http_request");

        // Make the HTTP request using reqwest
        let client = reqwest::blocking::Client::new();
        let mut request_builder = client.request(
            method
                .parse::<reqwest::Method>()
                .map_err(|_| "Invalid HTTP method".to_string())?,
            url,
        );

        // Add headers
        for (key, value) in headers {
            request_builder = request_builder.header(&key, &value);
        }

        // Add body if provided
        if let Some(body_content) = body {
            request_builder = request_builder.body(body_content);
        }

        let response = request_builder.send().map_err(|e| {
            tracing::error!("HTTP request failed: {}", e);
            e.to_string()
        })?;

        let status = response.status().as_u16();
        let response_headers = response
            .headers()
            .iter()
            .map(|(name, value)| (name.to_string(), value.to_str().unwrap_or("").to_string()))
            .collect();
        let body = response.text().map_err(|e| {
            tracing::error!("Failed to read response body: {}", e);
            e.to_string()
        })?;

        Ok(types::HttpResponse {
            status,
            headers: response_headers,
            body,
        })
    }

    /// Check network access (requires network capability).
    fn check_network_access(&mut self, host: String, port: u16) -> bool {
        if !ToolHostState::check_capability(self, "network") {
            tracing::warn!("Network access denied for host: {} port: {}", host, port);
            return false;
        }

        // Check if the host/port is allowed by the capability grant
        let allowed = self.capability_set.can_access_host(&host, port);
        if !allowed {
            tracing::warn!(
                "Network access denied for host: {} port: {} (not in allowlist)",
                host,
                port
            );
        } else {
            tracing::debug!("Network access allowed for host: {} port: {}", host, port);
        }

        self.record_host_call("check_network_access");

        allowed
    }
}

impl types::Host for ToolHostState {}

/// Register host functions with the linker.
pub fn add_host_functions(
    linker: &mut wasmtime::component::Linker<ToolHostState>,
) -> wasmtime::Result<()> {
    ToolComponent::add_to_linker(linker, |state: &mut ToolHostState| state)
}
