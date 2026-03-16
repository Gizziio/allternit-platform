# A2R Thin Client Extension - Installation Guide

## Developer Mode Installation (No Store Required)

### Chrome / Edge / Brave

1. **Download the extension:**
   ```bash
   # Download latest release
   curl -LO https://github.com/a2rchitect/a2r/releases/download/v0.1.0/a2r-thin-client-v0.1.0.zip
   unzip a2r-thin-client-v0.1.0.zip -d a2r-thin-client
   ```

2. **Open Chrome Extensions page:**
   - Navigate to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top right)

3. **Load unpacked extension:**
   - Click **"Load unpacked"**
   - Select the `a2r-thin-client` folder
   - Extension should now appear in your toolbar

4. **Pin the extension:**
   - Click the puzzle icon in toolbar
   - Click the pin next to "A2R Thin Client"

### Install Native Messaging Host (Required)

The native messaging host allows the extension to communicate with A2R Desktop:

```bash
# From the extension directory
cd a2r-thin-client
bash scripts/install-native-host.sh

# Or manually copy manifest
cp native-host/com.a2r.desktop.json \
   ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
```

### Verify Installation

1. Open A2R Desktop application
2. Open Chrome DevTools (F12) on any web page
3. Look for console message: `[A2R Thin Client] Connected to native host`
4. Extension icon should show green dot when connected

## Firefox Installation

1. Navigate to `about:debugging`
2. Click **"This Firefox"**
3. Click **"Load Temporary Add-on"**
4. Select `manifest.json` from the extension folder

Note: Firefox requires a separate build due to manifest differences.

## Troubleshooting

### "Native host not found" error
- Ensure A2R Desktop is running
- Check that native host manifest is in correct directory
- Verify extension ID in manifest matches your installation

### Extension not connecting
- Check browser console for errors
- Ensure A2R Desktop has native messaging permissions
- Try reloading extension on `chrome://extensions/`

## Updates

Since this is developer mode (not Web Store), updates are manual:

1. Download new version `.zip`
2. Unzip to new folder
3. Go to `chrome://extensions/`
4. Click **"Update"** button, or
5. Remove old extension and load unpacked new version

Auto-updater coming in future release.
