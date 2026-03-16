# Deprecated Registry Services

These registry services have been consolidated into the unified registry at `../registry-server/`.

## Deprecated Services

| Service | Reason |
|---------|--------|
| `framework-registry-service` | Consolidated into registry-server |
| `registry-apps` | Consolidated into registry-server |
| `registry-functions` | Consolidated into registry-server |

## Migration

Use the new unified registry:

```rust
// New canonical registry
4-services/registry/registry-server/
```

## Cleanup

These services will be permanently removed in v2.0.
If you need any functionality from these services, please open an issue.

Date deprecated: 2026-02-06
