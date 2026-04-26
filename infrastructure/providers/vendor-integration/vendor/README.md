# VENDOR INTEGRATION (READ-ONLY)

This directory contains vendor code integrated into the Allternitchitech platform.

## Status: FROZEN VENDOR CODE

- **DO NOT MODIFY** directly in this location
- **DO NOT IMPORT** directly from UI layer
- **ALL EXECUTION** must go through `@allternit/runtime` boundary

## Purpose

This represents the vendor codebase as a read-only import. All interactions with this code must go through the runtime boundary layer to ensure proper governance, auditing, and policy enforcement.

## Integration Pattern

```
UI Layer → @allternit/runtime → 3-adapters/vendor/ (via runtime boundary)
```

## Update Policy

- Updates to vendor code must be applied as vendor patches
- All changes must preserve the runtime boundary contract
- Direct modifications are prohibited
