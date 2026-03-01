# Load Testing (k6)

This directory contains k6 scripts for exercising the A2rchitech API.

## Quick Start

1. Start the API service (default `http://localhost:3000`).
2. Run the workflow load test:

```bash
k6 run tests/load/workflow_api.js
```

## Configuration

Environment variables:

- `A2RCHITECH_BASE_URL` (default: `http://localhost:3000`)
- `A2RCHITECH_IDENTITY` (default: `api-service`)
- `A2RCHITECH_TENANT` (default: `default`)
- `A2RCHITECH_VUS` (default: `10`)
- `A2RCHITECH_DURATION` (default: `30s`)

Example:

```bash
A2RCHITECH_BASE_URL=http://localhost:3000 \
A2RCHITECH_VUS=25 \
A2RCHITECH_DURATION=2m \
k6 run tests/load/workflow_api.js
```
