# Summit OIC Demo Bundle

Quick start demo for Summit Academy OIC - A2R Tenant Overlay

## What's Included

- **Tenant Pack**: `tenants/summit_oic/` - Skills, tools, forms, policies
- **Demo Scripts**: `demo/summit_oic/` - Validation and demo runner
- **Sample Configs**: Environment and profile templates

## Quick Start (5 minutes)

### 1. Extract Bundle

```bash
tar -xzf summit_oic_demo_bundle.tgz
cd a2rchitech
```

### 2. Provision Secrets

```bash
# Copy sample env
cp demo/summit_oic/summit_oic.sample.env tenants/summit_oic/secrets/summit_oic.env

# Edit with your credentials
nano tenants/summit_oic/secrets/summit_oic.env
```

Required:
- `CANVAS_BASE_URL` - Your Canvas instance
- `CANVAS_API_TOKEN` - API token with course/module permissions

### 3. Validate Pack

```bash
bash demo/summit_oic/validate_pack.sh
```

Must show: `VALIDATION PASSED`

### 4. Run Demo

```bash
bash demo/summit_oic/run_demo.sh
```

## Demo Flow

1. **Canvas Module Builder** - PLAN-only mode (deterministic)
2. **Office Excel Editor** - Read + patch planning
3. **Desktop Cowork Portal** - Connect + screenshot (confirmation required)

## System Requirements

- macOS 13+ / Windows 11+ / Linux (Ubuntu 22.04+)
- Python 3.10+
- Node.js 18+ (for Remotion demo, optional)
- Rust toolchain (for kernel, if building from source)
- Network access to Canvas LMS

## Troubleshooting

### Kernel won't start
```bash
# Check if already running
curl http://127.0.0.1:3004

# Build kernel if needed
cd 4-services/orchestration/kernel-service
cargo build
```

### Canvas API errors
- Verify token has correct permissions
- Check CANVAS_BASE_URL format (no trailing slash)
- Test with: `curl -H "Authorization: Bearer $CANVAS_API_TOKEN" "$CANVAS_BASE_URL/api/v1/accounts/self"`

### Validation fails
- Ensure all files extracted correctly
- Check file permissions on scripts
- Verify JSON files are valid

## Support

For issues or questions, contact the A2R development team.

---

**Version**: 1.0.0  
**Build Date**: $(date +%Y-%m-%d)  
**Tenant**: summit_oic
