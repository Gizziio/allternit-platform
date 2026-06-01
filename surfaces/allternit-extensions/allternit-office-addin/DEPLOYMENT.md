# Allternit Office Add-in — Deployment Guide

## Prerequisites

- Node.js 20+
- Microsoft 365 subscription (for sideloading) or access to Microsoft AppSource
- HTTPS-enabled static host (CDN, S3, Azure Blob, etc.)
- The Allternit API gateway running and reachable

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Required: backend origins
VITE_ALLTERNIT_GATEWAY_URL=https://api.yourdomain.com
VITE_ALLTERNIT_PLATFORM_URL=https://app.yourdomain.com

# Optional: override defaults
ALLTERNIT_OFFICE_APP_BASE_URL=https://addin.yourdomain.com
ALLTERNIT_OFFICE_APP_GUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Generate a stable GUID once:
```bash
node -e "console.log(require('crypto').randomUUID())"
```

## Build

```bash
npm install
npm run build
```

Outputs:
- `dist/` — static assets to upload to your CDN
- `manifest.xml` — Office add-in manifest (generated from `manifest.template.xml`)

## Upload

Upload the contents of `dist/` to your HTTPS-enabled static host.

Ensure the host serves:
- `src/taskpane/index.html` at `https://addin.yourdomain.com/src/taskpane/index.html`
- `assets/` at `https://addin.yourdomain.com/assets/`

## Sideload for Testing

### macOS (Word / Excel / PowerPoint)

1. Copy the manifest to the Office WEf folder:
```bash
mkdir -p ~/Library/Containers/com.microsoft.Word/Data/Documents/wef
mkdir -p ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef
mkdir -p ~/Library/Containers/com.microsoft.PowerPoint/Data/Documents/wef
cp manifest.xml ~/Library/Containers/com.microsoft.Word/Data/Documents/wef/
cp manifest.xml ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/
cp manifest.xml ~/Library/Containers/com.microsoft.PowerPoint/Data/Documents/wef/
```

2. Restart Word/Excel/PowerPoint
3. Go to **Insert → My Add-ins** → your add-in appears

### Windows

Use `office-addin-debugging`:
```bash
npx office-addin-debugging start manifest.xml --app excel
```

### Office Online

1. Go to [office.com](https://www.office.com) and open Word/Excel/PowerPoint
2. **Insert → Office Add-ins → Upload My Add-in**
3. Upload `manifest.xml`

## Production Backend CORS

Your cloud API must allow the add-in origin. Set:

```bash
CORS_ALLOWED_ORIGINS=https://addin.yourdomain.com,https://app.yourdomain.com
```

## AppSource Submission (public distribution)

1. Create a seller account at [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
2. Validate your manifest:
```bash
npx office-addin-manifest validate manifest.xml
```
3. Submit the manifest + icons + description
4. Microsoft reviews (typically 3-5 business days)

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Blank taskpane | Office.js failed to load | Ensure HTTPS in production |
| "Failed to fetch" | CORS blocked | Add add-in origin to `CORS_ALLOWED_ORIGINS` |
| Add-in not showing in Word/PPT | Manifest requires ExcelApi | Already fixed — use latest manifest |
| Auth dialog closes immediately | Popup blocked | Use Office Desktop or allow popups in browser |
| Dark mode not working | System theme not detected | Add `<meta name="color-scheme" content="light dark">` (already present) |
