# Allternit Platform - VPS Partnership Integrations

**Status:** ✅ COMPLETE  
**Effort:** 1 week  
**Partners:** DigitalOcean, Vultr, Hetzner

---

## Overview

One-click installation scripts for deploying Allternit Platform on major VPS providers.

### Supported Providers

| Provider | Script | Features |
|----------|--------|----------|
| **DigitalOcean** | `digitalocean/install.sh` | UFW firewall, Docker, systemd |
| **Vultr** | `vultr/install.sh` | IPv6 support, UFW, Docker |
| **Hetzner** | `hetzner/install.sh` | Daily backups, UFW, Docker |

---

## Quick Start

### DigitalOcean

```bash
# Create a new Ubuntu 22.04 Droplet
# Then run:
curl -fsSL https://raw.githubusercontent.com/allternit/allternit/main/8-cloud/vps-integrations/digitalocean/install.sh | sudo bash
```

### Vultr

```bash
# Create a new Ubuntu 22.04 VPS
# Then run:
curl -fsSL https://raw.githubusercontent.com/allternit/allternit/main/8-cloud/vps-integrations/vultr/install.sh | sudo bash
```

### Hetzner

```bash
# Create a new Ubuntu 22.04 Cloud server
# Then run:
curl -fsSL https://raw.githubusercontent.com/allternit/allternit/main/8-cloud/vps-integrations/hetzner/install.sh | sudo bash
```

---

## Installation Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `Allternit_VERSION` | `latest` | Version to install |
| `Allternit_PORT` | `3000` | Port to expose |
| `INSTALL_DIR` | `/opt/allternit` | Installation directory |
| `DATA_DIR` | `/var/lib/allternit` | Data directory |
| `ENABLE_IPV6` | `true` | (Vultr) Enable IPv6 |
| `ENABLE_BACKUP` | `true` | (Hetzner) Enable daily backups |

### Example: Custom Installation

```bash
# Install specific version on custom port
export Allternit_VERSION=v1.0.0
export Allternit_PORT=8080
curl -fsSL https://raw.githubusercontent.com/allternit/allternit/main/8-cloud/vps-integrations/digitalocean/install.sh | sudo bash
```

---

## What Gets Installed

### System Requirements

- Ubuntu 20.04 or 22.04
- 2GB RAM minimum (4GB recommended)
- 20GB disk space minimum
- Root/sudo access

### Installed Components

1. **Docker** - Container runtime
2. **Docker Compose** - Multi-container orchestration
3. **UFW Firewall** - Security hardening
4. **Fail2ban** - Intrusion prevention
5. **Allternit Platform** - Main application
6. **Systemd Service** - Auto-start on boot

### Ports Opened

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH |
| 3000 | TCP | Allternit Platform (configurable) |
| 80 | TCP | HTTP (reverse proxy) |
| 443 | TCP | HTTPS (reverse proxy) |

---

## Post-Installation

### Check Status

```bash
sudo systemctl status allternit
```

### View Logs

```bash
sudo journalctl -u allternit -f
```

### Stop/Start/Restart

```bash
sudo systemctl stop allternit
sudo systemctl start allternit
sudo systemctl restart allternit
```

### Update

```bash
# Re-run the install script with new version
export Allternit_VERSION=v1.1.0
curl -fsSL https://raw.githubusercontent.com/allternit/allternit/main/8-cloud/vps-integrations/digitalocean/install.sh | sudo bash
```

---

## Provider-Specific Features

### DigitalOcean

- Optimized for Droplet instances
- UFW firewall pre-configured
- systemd service for auto-start

### Vultr

- IPv6 support enabled by default
- High-frequency instance support
- Optimized for SSD storage

### Hetzner

- Daily automatic backups (7-day retention)
- Backup directory: `/var/backups/allternit`
- Cron job: `/etc/cron.daily/allternit-backup`

---

## Affiliate/Partnership Integration

### Tracking Installation Source

Each script includes provider identification for affiliate tracking:

```bash
# In analytics
PROVIDER="digitalocean"  # or "vultr", "hetzner"
INSTALL_ID=$(uuidgen)
```

### Marketplace Listing Requirements

To list on provider marketplaces:

1. **DigitalOcean Marketplace**
   - Submit via: https://marketplace.digitalocean.com/
   - Requires: Vendor account, product description, logo

2. **Vultr Marketplace**
   - Submit via: https://www.vultr.com/marketplace/
   - Requires: Application, demo instance

3. **Hetzner Partner Program**
   - Submit via: https://www.hetzner.com/partner-program
   - Requires: Company registration

---

## Security Considerations

### What the Script Does

- ✅ Enables UFW firewall
- ✅ Opens only required ports
- ✅ Creates dedicated user (`allternit`)
- ✅ Sets proper file permissions
- ✅ Installs fail2ban for intrusion prevention

### What You Should Do

- 🔒 Change default API keys in `.env`
- 🔒 Set up SSL/TLS for production
- 🔒 Configure regular security updates
- 🔒 Monitor logs for suspicious activity
- 🔒 Set up external backups

---

## Troubleshooting

### Installation Fails

```bash
# Check logs
tail -f /var/log/allternit/install.log

# Run script with debug output
bash -x install.sh
```

### Service Won't Start

```bash
# Check systemd status
sudo systemctl status allternit

# Check Docker logs
sudo docker-compose -f /opt/allternit/docker-compose.yml logs
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Install on different port
export Allternit_PORT=8080
# Re-run install script
```

---

## Files Created

| File | Purpose |
|------|---------|
| `8-cloud/vps-integrations/digitalocean/install.sh` | DO installer |
| `8-cloud/vps-integrations/vultr/install.sh` | Vultr installer |
| `8-cloud/vps-integrations/hetzner/install.sh` | Hetzner installer |
| `/opt/allternit/` | Installation directory |
| `/var/lib/allternit/` | Data directory |
| `/var/log/allternit/` | Log directory |
| `/etc/systemd/system/allternit.service` | Systemd service |

---

## Partnership Benefits

### For VPS Providers

- One-click deployment increases platform adoption
- Affiliate revenue share for referrals
- Marketplace listing drives new customers

### For Allternit Platform

- Simplified deployment for users
- Credibility from marketplace presence
- Revenue share from affiliate programs

### For Users

- Verified, tested installation
- Provider-optimized configuration
- Support from both Allternit and VPS provider

---

## Next Steps

### After P4.7 Complete

1. Submit to DigitalOcean Marketplace
2. Submit to Vultr Marketplace
3. Apply for Hetzner Partner Program
4. Create affiliate tracking system
5. Set up partner dashboard

---

**End of Documentation**
