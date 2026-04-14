//! A2R Installer
//!
//! Installation scripts and automation for A2R platform.

use a2r_cloud_core::{CloudError, Instance};

/// A2R installer
pub struct A2rInstaller;

impl A2rInstaller {
    pub fn new() -> Self {
        Self
    }
    
    /// Install A2R on instance
    pub async fn install(&self, instance: &Instance) -> Result<(), CloudError> {
        tracing::info!("Installing A2R on instance {}", instance.id);
        
        // Get installation script
        let _script = self.get_install_script();
        
        // In production, this would SSH to the instance and execute the script
        tracing::info!("Running installation script on {}", instance.public_ip.as_ref().unwrap_or(&"unknown".to_string()));
        
        // Simulate installation
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        
        Ok(())
    }
    
    /// Get installation script
    pub fn get_install_script(&self) -> &'static str {
        INSTALL_SCRIPT
    }
    
    /// Get systemd service definition
    pub fn get_systemd_service(&self) -> &'static str {
        SYSTEMD_SERVICE
    }
}

impl Default for A2rInstaller {
    fn default() -> Self {
        Self::new()
    }
}

/// A2R installation script
pub static INSTALL_SCRIPT: &str = r#"#!/bin/bash
set -e

echo "=== A2R Platform Installation ==="

# Create A2R user
if ! id -u a2r >/dev/null 2>&1; then
    useradd -r -s /bin/false a2r
fi

# Create directories
mkdir -p /opt/a2r/bin
mkdir -p /opt/a2r/config
mkdir -p /var/log/a2r

# Download A2R (in production, this would be from releases)
echo "Downloading A2R..."
# curl -L https://releases.a2r.sh/latest | tar xz -C /opt/a2r

# Create placeholder binary
cat > /opt/a2r/bin/a2r-server << 'EOF'
#!/bin/bash
echo "A2R Server running..."
while true; do sleep 60; done
EOF
chmod +x /opt/a2r/bin/a2r-server

# Set permissions
chown -R a2r:a2r /opt/a2r
chown -R a2r:a2r /var/log/a2r

# Install systemd service
cat > /etc/systemd/system/a2r.service << 'EOF'
[Unit]
Description=A2R Platform
After=network.target

[Service]
Type=simple
ExecStart=/opt/a2r/bin/a2r-server
Restart=always
User=a2r
Group=a2r
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable a2r
systemctl start a2r

# Verify installation
sleep 2
if systemctl is-active --quiet a2r; then
    echo "✓ A2R installation complete"
    echo "✓ Service is running"
else
    echo "✗ A2R service failed to start"
    exit 1
fi

echo "=== Installation Complete ==="
"#;

/// Systemd service definition
pub static SYSTEMD_SERVICE: &str = r#"[Unit]
Description=A2R Platform
After=network.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/opt/a2r/bin/a2r-server
Restart=always
RestartSec=5
User=a2r
Group=a2r

# Environment
Environment=RUST_LOG=info
Environment=A2R_CONFIG=/opt/a2r/config

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/a2r /opt/a2r/config

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
"#;

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_install_script_exists() {
        let installer = A2rInstaller::new();
        assert!(!installer.get_install_script().is_empty());
        assert!(installer.get_install_script().contains("#!/bin/bash"));
    }
    
    #[test]
    fn test_systemd_service_exists() {
        let installer = A2rInstaller::new();
        assert!(!installer.get_systemd_service().is_empty());
        assert!(installer.get_systemd_service().contains("[Unit]"));
        assert!(installer.get_systemd_service().contains("[Service]"));
    }
}
