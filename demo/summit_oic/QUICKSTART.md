# Summit OIC Demo - Quick Start Guide

## For macOS / Linux

```bash
# 1. Extract bundle
tar -xzf summit_oic_demo_bundle.tgz
cd a2rchitech

# 2. Provision secrets
cp demo/summit_oic/summit_oic.sample.env tenants/summit_oic/secrets/summit_oic.env
nano tenants/summit_oic/secrets/summit_oic.env  # Edit with your credentials

# 3. Validate
bash demo/summit_oic/validate_pack.sh

# 4. Run demo
bash demo/summit_oic/run_demo.sh
```

## For Windows (PowerShell)

```powershell
# 1. Extract bundle
Expand-Archive summit_oic_demo_bundle.tgz -DestinationPath .
cd a2rchitech

# 2. Provision secrets
Copy-Item demo\summit_oic\summit_oic.sample.env tenants\summit_oic\secrets\summit_oic.env
notepad tenants\summit_oic\secrets\summit_oic.env  # Edit with your credentials

# 3. Validate
.\demo\summit_oic\validate_pack.ps1

# 4. Run demo
.\demo\summit_oic\run_demo.ps1
```

## Required Credentials

Edit `tenants/summit_oic/secrets/summit_oic.env`:

```bash
CANVAS_BASE_URL=https://YOURDISTRICT.instructure.com
CANVAS_API_TOKEN=your_token_here
DEMO_COURSE_ID=12345
```

### Getting Canvas API Token

1. Go to your Canvas instance
2. Account → Settings → Approved Integrations → New Access Token
3. Select scopes: Courses, Modules, Pages, Assignments (Read/Write)
4. Copy the token to `summit_oic.env`

## Demo Duration

- Validation: ~30 seconds
- Demo execution: ~2 minutes
- Total: ~3 minutes

## What You'll See

1. **Canvas Module Builder** - Deterministic plan generation
2. **Office Excel Editor** - Gradebook analysis with at-risk flagging
3. **Desktop Cowork Portal** - Controlled desktop automation

## Support

If validation fails, check:
- All files extracted correctly
- JSON files are valid
- Secrets file exists with correct format
