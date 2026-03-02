# Production Deployment Checklist

## The Problem

Your current VPS deployment is running **development mode** (`pnpm dev`), which is:
- ❌ Slow (compiles TypeScript on every request)
- ❌ Resource intensive (dev server + HMR)
- ❌ Not scalable
- ❌ Exposes source maps

## The Solution

### Phase 1: Build Production Assets (One-time)

```bash
# 1. Navigate to web app
cd /root/a2rchitech/7-apps/shell/web

# 2. Install dependencies
pnpm install

# 3. Fix TypeScript errors (REQUIRED before build)
# Run typecheck and fix all errors
pnpm typecheck
# ... fix errors ...

# 4. Build production bundle
pnpm build

# Output: dist/ folder with optimized, minified files
```

### Phase 2: Update Systemd Services

#### Current (WRONG - Development)
```ini
# /etc/systemd/system/a2r-platform-ui.service
[Unit]
Description=A2R Platform UI (DEVELOPMENT - DO NOT USE)

[Service]
Type=simple
WorkingDirectory=/root/a2rchitech/7-apps/shell/web
ExecStart=pnpm dev  # ❌ WRONG - This is dev mode!
```

#### New (CORRECT - Production)
```ini
# /etc/systemd/system/a2r-platform-ui.service
[Unit]
Description=A2R Platform UI (Production)
After=network.target

[Service]
Type=simple
User=a2r
WorkingDirectory=/var/www/a2r

# Option A: Use Python's built-in server (simple)
ExecStart=/usr/bin/python3 -m http.server 5177 --directory /var/www/a2r/dist

# Option B: Use Node serve (if installed)
# ExecStart=npx serve -s dist -l 5177

# Option C: Use nginx (best for production)
# (See nginx config below)

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Phase 3: Copy Built Assets

```bash
# Create production directory
sudo mkdir -p /var/www/a2r

# Copy built files
sudo cp -r /root/a2rchitech/7-apps/shell/web/dist/* /var/www/a2r/

# Set permissions
sudo chown -R a2r:a2r /var/www/a2r
```

### Phase 4: Better - Use Nginx (Recommended)

```bash
# Install nginx
sudo apt-get update && sudo apt-get install -y nginx

# Create nginx config
sudo tee /etc/nginx/sites-available/a2r-platform << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Static files
    root /var/www/a2r/dist;
    index index.html;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy to Rust backend
    location /api/ {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket support
    location /ws/ {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/a2r-platform /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Phase 5: Update API Service

```ini
# /etc/systemd/system/a2r-api.service
[Unit]
Description=A2R API Server
After=network.target

[Service]
Type=simple
User=a2r
WorkingDirectory=/opt/a2r

# Use pre-built release binary
ExecStart=/opt/a2r/a2rchitech-api

# Environment variables
Environment="A2RCHITECH_API_BIND=127.0.0.1:3010"
Environment="A2RCHITECH_DB_PATH=/var/lib/a2r/a2rchitech.db"
Environment="RUST_LOG=info"

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Phase 6: Build and Deploy Release Binary

```bash
# On build machine (or VPS if it has resources)
cd /root/a2rchitech

# Build optimized release binary
cargo build --release --bin a2rchitech-api

# Strip debug symbols for smaller size
strip target/release/a2rchitech-api

# Deploy to production
sudo mkdir -p /opt/a2r
sudo cp target/release/a2rchitech-api /opt/a2r/
sudo chown -R a2r:a2r /opt/a2r

# Create data directory
sudo mkdir -p /var/lib/a2r
sudo chown a2r:a2r /var/lib/a2r
```

### Phase 7: Restart Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Stop old dev service
sudo systemctl stop a2r-platform-ui

# Start new production services
sudo systemctl start a2r-api
sudo systemctl start a2r-platform-ui  # Or nginx

# Enable auto-start
sudo systemctl enable a2r-api
sudo systemctl enable a2r-platform-ui  # Or nginx

# Check status
sudo systemctl status a2r-api
sudo systemctl status a2r-platform-ui  # Or nginx
```

---

## Verification

```bash
# Check services are running
curl http://localhost:5177  # Should return static HTML instantly
curl http://localhost:3010/health  # API health check

# Check nginx (if using)
sudo nginx -t
sudo systemctl status nginx

# Check ports
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :3010

# View logs
sudo journalctl -u a2r-api -f
sudo journalctl -u a2r-platform-ui -f  # Or nginx
```

---

## For Your SaaS Model (Multi-Tenant)

### Customer VPS Setup

```bash
# Customer runs this on their VPS
curl -fsSL https://install.a2rchitect.com | bash

# This installs:
# - a2rchitech-api binary
# - Chrome Streaming (Docker)
# - Systemd services

# Customer configures
sudo nano /etc/a2r/config.toml
# Set API key, allowed domains (your platform URL)

# Start services
sudo systemctl start a2r-platform
```

### Your Cloud Platform

```bash
# Deploy UI to Vercel/Netlify
# 1. Connect GitHub repo
# 2. Set build command: cd 7-apps/shell/web && pnpm build
# 3. Set output directory: 7-apps/shell/web/dist
# 4. Deploy!

# Or self-hosted nginx (as shown above)
```

---

## Performance Comparison

| Metric | Development (pnpm dev) | Production (nginx + built) |
|--------|------------------------|---------------------------|
| First Load | 20-40 seconds | < 1 second |
| CPU Usage | High (compilation) | Low (static files) |
| Memory | 500MB-1GB | 50-100MB |
| Concurrent Users | ~10 | 1000+ |
| Cacheable | No | Yes (CDN) |
| Source Maps | Exposed | Hidden |

---

## Summary

### Current State (Fix ASAP)
- Running `pnpm dev` via systemd ❌
- Compiling on every request ❌
- No optimization ❌

### Target State (Production)
- Built static files served by nginx ✅
- Pre-compiled API binary ✅
- Optimized, cached, scalable ✅

### Action Items
1. [ ] Fix TypeScript errors in web app
2. [ ] Run `pnpm build` to create dist/
3. [ ] Copy dist/ to /var/www/a2r/
4. [ ] Install and configure nginx
5. [ ] Build release API binary
6. [ ] Update systemd services
7. [ ] Restart and verify
8. [ ] Set up SSL with Let's Encrypt

Need help with any of these steps?
