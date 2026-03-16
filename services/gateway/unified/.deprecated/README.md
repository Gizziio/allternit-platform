# Deprecated Gateway Services

These gateway services have been consolidated into the unified gateway at `../src/main.py`.

## Deprecated Services

| Service | Reason |
|---------|--------|
| `gateway-browser` | Consolidated into unified gateway |
| `gateway-stdio` | Consolidated into unified gateway |
| `a2a-gateway` | Consolidated into unified gateway |
| `agui-gateway` | Consolidated into unified gateway |
| `python-gateway` | Consolidated into unified gateway |
| `gateway-service` | Replaced by `../src/main.py` |

## Migration

Use the new unified gateway:

```python
# New canonical gateway
4-services/gateway/src/main.py
```

## Cleanup

These services will be permanently removed in v2.0.
If you need any functionality from these services, please open an issue.

Date deprecated: 2026-02-06
