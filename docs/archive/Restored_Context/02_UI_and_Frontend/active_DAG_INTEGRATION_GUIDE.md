# Allternit DAG Integration - Complete Documentation

**Version:** 1.0.0
**Date:** 2026-02-22
**Status:** API & UI Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Reference](#api-reference)
4. [UI Components](#ui-components)
5. [Getting Started](#getting-started)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This document covers the integration of P4 DAG tasks into the Allternit platform:

- **P4.1:** Swarm Advanced (message bus, circuit breaker, quarantine)
- **P4.6:** IVKGE Advanced (visual extraction)
- **P4.9:** Multimodal Streaming (vision/audio)
- **P4.11:** Tambo Integration (UI generation)

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Swarm Monitoring | Real-time circuit breaker & quarantine status | ✅ |
| Visual Extraction | Extract entities from screenshots | ✅ |
| Multimodal Streaming | Real-time vision/audio via WebSocket | ✅ |
| UI Generation | Generate React/Vue/Svelte/HTML from specs | ✅ |

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Allternit Platform                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Swarm     │  │   IVKGE     │  │  Multimodal │         │
│  │  Dashboard  │  │   Panel     │  │   Input     │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                  ┌───────▼────────┐                         │
│                  │  API Gateway   │                         │
│                  │   (Axum/Rust)  │                         │
│                  └───────┬────────┘                         │
│                          │                                  │
│    ┌─────────────────────┼─────────────────────┐           │
│    │             ┌───────▼────────┐            │           │
│    │             │  Core Engines  │            │           │
│    │             │  - Swarm       │            │           │
│    │             │  - IVKGE       │            │           │
│    │             │  - Multimodal  │            │           │
│    │             │  - Tambo       │            │           │
│    │             └────────────────┘            │           │
│    │                                           │           │
└────┴───────────────────────────────────────────┴───────────┘
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Rust, Axum, Tokio |
| Frontend | React, TypeScript, shadcn/ui |
| Real-time | WebSocket |
| Media | WebRTC, Web Audio API |

---

## API Reference

### Base URL

```
http://localhost:3000/api/v1
```

### Swarm Advanced

#### List Circuit Breakers

```http
GET /swarm/circuit-breakers
```

**Response:**
```json
[
  {
    "agent_id": "agent_1",
    "state": "closed",
    "failure_count": 0,
    "success_count": 10
  }
]
```

#### Reset Circuit Breaker

```http
POST /swarm/circuit-breakers/:agent_id/reset
```

### IVKGE Advanced

#### Upload Image

```http
POST /ivkge/upload
Content-Type: multipart/form-data

image: <file>
```

#### Extract Entities

```http
POST /ivkge/extract
Content-Type: application/json

{
  "upload_id": "up_123",
  "extraction_type": "screenshot",
  "options": {
    "include_ocr": true
  }
}
```

### Multimodal Streaming

#### Vision WebSocket

```
WS /multimodal/ws/vision
```

#### Audio WebSocket

```
WS /multimodal/ws/audio
```

### Tambo Integration

#### Generate UI

```http
POST /tambo/generate
Content-Type: application/json

{
  "spec_id": "spec_123",
  "ui_type": "react"
}
```

**Response:**
```json
{
  "generation_id": "gen_123",
  "ui_type": "react",
  "code": "import React...",
  "components_generated": 5
}
```

---

## UI Components

### Swarm Dashboard

**Location:** `surfaces/allternit-platform/src/views/SwarmDashboard/`

**Features:**
- Circuit breaker monitoring
- Quarantine management
- Message statistics
- Auto-refresh (30s)

**Usage:**
```tsx
import { SwarmDashboard } from './views/SwarmDashboard';

function App() {
  return <SwarmDashboard />;
}
```

### IVKGE Panel

**Location:** `surfaces/allternit-platform/src/views/IVKGEPanel/`

**Features:**
- Image upload
- Entity extraction
- Relationship visualization
- Ambiguity resolution

### Multimodal Input

**Location:** `surfaces/allternit-platform/src/views/MultimodalInput/`

**Features:**
- Camera capture
- Microphone capture
- WebSocket streaming
- Sync status

### Tambo Studio

**Location:** `surfaces/allternit-platform/src/views/TamboStudio/`

**Features:**
- Component palette
- Spec editor
- Code generation
- Export (copy/download)

---

## Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Modern browser with WebRTC support

### Installation

1. **Backend:**
```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit
cargo build --release
```

2. **Frontend:**
```bash
cd surfaces/allternit-platform
npm install
npm run dev
```

### Quick Start

1. Start the API server:
```bash
cargo run --package allternit-api
```

2. Start the UI:
```bash
npm run dev -w @allternit/platform
```

3. Navigate to:
- Swarm Dashboard: `http://localhost:5173/swarm`
- IVKGE Panel: `http://localhost:5173/ivkge`
- Multimodal Input: `http://localhost:5173/multimodal`
- Tambo Studio: `http://localhost:5173/tambo`

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLTERNIT_API_PORT` | 3000 | API server port |
| `ALLTERNIT_WS_HOST` | localhost | WebSocket host |
| `ALLTERNIT_WS_PORT` | 3000 | WebSocket port |

### API Configuration

Edit `cmd/api/src/main.rs`:

```rust
let config = ApiConfig {
    bind_addr: "0.0.0.0:3000".to_string(),
    // ...
};
```

### UI Configuration

Edit `surfaces/allternit-platform/.env`:

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000/api/v1
```

---

## Troubleshooting

### Common Issues

#### WebSocket Connection Failed

**Symptom:** "Disconnected" status in Multimodal Input

**Solution:**
1. Check WebSocket server is running
2. Verify firewall allows WS connections
3. Check browser console for errors

#### Camera/Microphone Not Working

**Symptom:** Permission denied error

**Solution:**
1. Grant browser permissions
2. Check OS privacy settings
3. Ensure no other app is using camera/mic

#### Generation Fails

**Symptom:** Tambo Studio shows error

**Solution:**
1. Verify spec has components
2. Check API logs for errors
3. Ensure UI type is valid (react/vue/svelte/html)

### Logs

**Backend logs:**
```bash
RUST_LOG=debug cargo run
```

**Frontend logs:**
Open browser DevTools → Console

### Support

For additional help:
- Check `docs/_active/` for detailed guides
- Review API tests in route files
- Check UI component tests

---

**End of Documentation**
