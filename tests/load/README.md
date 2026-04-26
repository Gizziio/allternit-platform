# Load Testing (k6)

This directory contains k6 scripts for exercising the Allternit API.

## Quick Start

1. Start the API service (default `http://localhost:3000`).
2. Run the workflow load test:

```bash
k6 run tests/load/workflow_api.js
```

## Configuration

Environment variables:

- `Allternit_BASE_URL` (default: `http://localhost:3000`)
- `Allternit_IDENTITY` (default: `api-service`)
- `Allternit_TENANT` (default: `default`)
- `Allternit_VUS` (default: `10`)
- `Allternit_DURATION` (default: `30s`)

Example:

```bash
Allternit_BASE_URL=http://localhost:3000 \
Allternit_VUS=25 \
Allternit_DURATION=2m \
k6 run tests/load/workflow_api.js
```
