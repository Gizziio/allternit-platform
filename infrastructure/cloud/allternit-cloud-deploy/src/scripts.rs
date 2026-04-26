//! Deployment Scripts
//!
//! Shell scripts for deployment automation.

/// Cloud-init user data for AWS
pub fn get_aws_userdata() -> &'static str {
    r#"#!/bin/bash
# Cloud-init script for Allternit deployment

# Update system
yum update -y

# Install dependencies
yum install -y docker git curl

# Start Docker
systemctl enable docker
systemctl start docker

# Add allternit user
useradd -r -s /bin/false allternit

# Create directories
mkdir -p /opt/allternit/bin
mkdir -p /opt/allternit/config
mkdir -p /var/log/allternit

# Install Allternit (placeholder)
echo "Allternit Server" > /opt/allternit/bin/allternit-server
chmod +x /opt/allternit/bin/allternit-server

# Set permissions
chown -R allternit:allternit /opt/allternit

# Create systemd service
cat > /etc/systemd/system/allternit.service << 'EOF'
[Unit]
Description=Allternit Platform
After=network.target

[Service]
ExecStart=/opt/allternit/bin/allternit-server
Restart=always
User=allternit

[Install]
WantedBy=multi-user.target
EOF

# Enable service
systemctl daemon-reload
systemctl enable allternit
systemctl start allternit
"#
}

/// Cloud-init user data for DigitalOcean
pub fn get_digitalocean_userdata() -> &'static str {
    r#"#!/bin/bash
# Cloud-init script for Allternit deployment on DigitalOcean

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y docker.io git curl

# Start Docker
systemctl enable docker
systemctl start docker

# Add allternit user
useradd -r -s /bin/false allternit

# Create directories
mkdir -p /opt/allternit/bin
mkdir -p /opt/allternit/config
mkdir -p /var/log/allternit

# Install Allternit (placeholder)
echo "Allternit Server" > /opt/allternit/bin/allternit-server
chmod +x /opt/allternit/bin/allternit-server

# Set permissions
chown -R allternit:allternit /opt/allternit

# Create systemd service
cat > /etc/systemd/system/allternit.service << 'EOF'
[Unit]
Description=Allternit Platform
After=network.target

[Service]
ExecStart=/opt/allternit/bin/allternit-server
Restart=always
User=allternit

[Install]
WantedBy=multi-user.target
EOF

# Enable service
systemctl daemon-reload
systemctl enable allternit
systemctl start allternit
"#
}

/// Firewall configuration script
pub fn get_firewall_script() -> &'static str {
    r#"#!/bin/bash
# Configure firewall for Allternit

# Allow SSH
ufw allow 22/tcp

# Allow HTTP
ufw allow 80/tcp

# Allow HTTPS
ufw allow 443/tcp

# Allow Allternit default port
ufw allow 3000/tcp

# Enable firewall
ufw --force enable

echo "Firewall configured"
"#
}

/// Docker installation script
pub fn get_docker_script() -> &'static str {
    r#"#!/bin/bash
# Install Docker

# Remove old versions
apt-get remove -y docker docker-engine docker.io containerd runc || true

# Install prerequisites
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io

# Start Docker
systemctl enable docker
systemctl start docker

# Add user to docker group
usermod -aG docker allternit || true

echo "Docker installed"
"#
}
