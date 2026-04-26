//! Allternit Installer
//!
//! Installation scripts and automation for Allternit platform.

use allternit_cloud_core::{CloudError, Instance};

/// Allternit installer
pub struct AllternitInstaller;

impl AllternitInstaller {
    pub fn new() -> Self {
        Self
    }
    
    /// Install Allternit on instance
    pub async fn install(&self, instance: &Instance) -> Result<(), CloudError> {
        tracing::info!("Installing Allternit on instance {}", instance.id);
        
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

impl Default for AllternitInstaller {
    fn default() -> Self {
        Self::new()
    }
}

/// Allternit installation script
pub static INSTALL_SCRIPT: &str = r#"#!/bin/bash
set -e

echo "=== Allternit Platform Installation ==="

# Create Allternit user
if ! id -u allternit >/dev/null 2>&1; then
    useradd -r -s /bin/false allternit
fi

# Create directories
mkdir -p /opt/allternit/bin
mkdir -p /opt/allternit/config
mkdir -p /var/log/allternit

# Download Allternit (in production, this would be from releases)
echo "Downloading Allternit..."
# curl -L https://releases.allternit.sh/latest | tar xz -C /opt/allternit

# Create placeholder binary
cat > /opt/allternit/bin/allternit-server << 'EOF'
#!/bin/bash
echo "Allternit Server running..."
while true; do sleep 60; done
EOF
chmod +x /opt/allternit/bin/allternit-server

# Set permissions
chown -R allternit:allternit /opt/allternit
chown -R allternit:allternit /var/log/allternit

# Install systemd service
cat > /etc/systemd/system/allternit.service << 'EOF'
[Unit]
Description=Allternit Platform
After=network.target

[Service]
Type=simple
ExecStart=/opt/allternit/bin/allternit-server
Restart=always
User=allternit
Group=allternit
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable allternit
systemctl start allternit

# Verify installation
sleep 2
if systemctl is-active --quiet allternit; then
    echo "✓ Allternit installation complete"
    echo "✓ Service is running"
else
    echo "✗ Allternit service failed to start"
    exit 1
fi

echo "=== Installation Complete ==="
"#;

/// Systemd service definition
pub static SYSTEMD_SERVICE: &str = r#"[Unit]
Description=Allternit Platform
After=network.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/opt/allternit/bin/allternit-server
Restart=always
RestartSec=5
User=allternit
Group=allternit

# Environment
Environment=RUST_LOG=info
Environment=Allternit_CONFIG=/opt/allternit/config

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/allternit /opt/allternit/config

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
        let installer = AllternitInstaller::new();
        assert!(!installer.get_install_script().is_empty());
        assert!(installer.get_install_script().contains("#!/bin/bash"));
    }
    
    #[test]
    fn test_systemd_service_exists() {
        let installer = AllternitInstaller::new();
        assert!(!installer.get_systemd_service().is_empty());
        assert!(installer.get_systemd_service().contains("[Unit]"));
        assert!(installer.get_systemd_service().contains("[Service]"));
    }
}
