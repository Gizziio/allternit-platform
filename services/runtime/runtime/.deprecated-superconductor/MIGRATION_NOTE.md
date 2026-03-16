# Superconductor Migration Notice

## Status: DEPRECATED - Migrated to A2R Operator

The Superconductor service has been **migrated and rebranded** as part of the **A2R Operator** service.

## Migration Details

### What Changed

1. **Service Rebranding**: Superconductor → A2R Operator
2. **Port Change**: 3310 → 3008 (unified with A2R Operator)
3. **Endpoint Changes**:
   - `POST /runs` → `POST /v1/parallel/runs`
   - `GET /runs/{id}/status` → `GET /v1/parallel/runs/{id}/status`
   - `GET /runs/{id}/events` → `GET /v1/parallel/runs/{id}/events`

### New Capabilities in A2R Operator

The unified A2R Operator now provides:

1. **Browser-Use** (NEW): Agent-based browser automation
   - Chromium + CDP protocol
   - Three modes: browser-use, playwright, computer-use
   - Replaces paid APIs (Firecrawl, Tavily)

2. **Computer-Use**: Vision-based computer control

3. **Desktop-Use**: Desktop automation (UI-TARS)

4. **Parallel Execution**: Multi-variant task execution (from Superconductor)

## New Service Location

```
/4-services/a2r-operator/
├── src/main.py          # Unified service
├── src/browser_use/     # Browser automation
└── README.md            # Documentation
```

## Running the New Service

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/4-services/a2r-operator
pip install -r requirements.txt
playwright install chromium
python -m uvicorn src.main:app --port 3008
```

## API Key

The A2R Operator uses a unified API key:
```bash
export A2R_OPERATOR_API_KEY="your-key"
```

## Date of Migration

2025-02-06
