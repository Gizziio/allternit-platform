//! Deployment Scripts
//!
//! Shell scripts for deployment automation.

/// Cloud-init user data for AWS
pub fn get_aws_userdata() -> &'static str {
    r#"#!/bin/bash
# Cloud-init script for A2R deployment

# Update system
yum update -y

# Install dependencies
yum install -y docker git curl

# Start Docker
systemctl enable docker
systemctl start docker

# Add a2r user
useradd -r -s /bin/false a2r

# Create directories
mkdir -p /opt/a2r/bin
mkdir -p /opt/a2r/config
mkdir -p /var/log/a2r

# Install A2R (placeholder)
echo "A2R Server" > /opt/a2r/bin/a2r-server
chmod +x /opt/a2r/bin/a2r-server

# Set permissions
chown -R a2r:a2r /opt/a2r

# Create systemd service
cat > /etc/systemd/system/a2r.service << 'EOF'
[Unit]
Description=A2R Platform
After=network.target

[Service]
ExecStart=/opt/a2r/bin/a2r-server
Restart=always
User=a2r

[Install]
WantedBy=multi-user.target
EOF

# Enable service
systemctl daemon-reload
systemctl enable a2r
systemctl start a2r
"#
}

/// Cloud-init user data for DigitalOcean
pub fn get_digitalocean_userdata() -> &'static str {
    r#"#!/bin/bash
# Cloud-init script for A2R deployment on DigitalOcean

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y docker.io git curl

# Start Docker
systemctl enable docker
systemctl start docker

# Add a2r user
useradd -r -s /bin/false a2r

# Create directories
mkdir -p /opt/a2r/bin
mkdir -p /opt/a2r/config
mkdir -p /var/log/a2r

# Install A2R (placeholder)
echo "A2R Server" > /opt/a2r/bin/a2r-server
chmod +x /opt/a2r/bin/a2r-server

# Set permissions
chown -R a2r:a2r /opt/a2r

# Create systemd service
cat > /etc/systemd/system/a2r.service << 'EOF'
[Unit]
Description=A2R Platform
After=network.target

[Service]
ExecStart=/opt/a2r/bin/a2r-server
Restart=always
User=a2r

[Install]
WantedBy=multi-user.target
EOF

# Enable service
systemctl daemon-reload
systemctl enable a2r
systemctl start a2r
"#
}

/// Firewall configuration script
pub fn get_firewall_script() -> &'static str {
    r#"#!/bin/bash
# Configure firewall for A2R

# Allow SSH
ufw allow 22/tcp

# Allow HTTP
ufw allow 80/tcp

# Allow HTTPS
ufw allow 443/tcp

# Allow A2R default port
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
usermod -aG docker a2r || true

echo "Docker installed"
"#
}
