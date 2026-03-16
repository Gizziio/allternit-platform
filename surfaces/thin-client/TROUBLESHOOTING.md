# Troubleshooting Guide - Gizzi Thin Client

Common issues and their solutions for the Gizzi Thin Client.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Connection Problems](#connection-problems)
- [Performance Issues](#performance-issues)
- [UI/UX Issues](#uiux-issues)
- [Platform-Specific](#platform-specific)
- [Getting Help](#getting-help)

## Installation Issues

### "App is damaged and can't be opened" (macOS)

**Cause**: macOS Gatekeeper blocking unsigned apps.

**Solutions**:

1. **Remove quarantine attribute**:
   ```bash
   xattr -cr "/Applications/Gizzi Thin Client.app"
   ```

2. **Allow in System Preferences**:
   - System Settings → Privacy & Security
   - Click "Open Anyway"

3. **If downloaded from browser**:
   ```bash
   xattr -d com.apple.quarantine ~/Downloads/Gizzi-Thin-Client.dmg
   ```

### "Windows protected your PC" (Windows)

**Cause**: SmartScreen blocking unrecognized app.

**Solutions**:

1. Click "More info" → "Run anyway"
2. Right-click → Properties → Check "Unblock"
3. Add to Windows Defender exclusions (enterprise)

### Installation Fails Silently

**Check**:
- Disk space (need at least 500MB)
- Permissions (run as administrator)
- Antivirus interference

## Connection Problems

### "Gizzi Terminal Server Not Running"

**Diagnosis**:
```bash
# Check if server is running
curl http://localhost:4096/health

# Check port usage
lsof -i :4096        # macOS/Linux
netstat -ano | findstr 4096  # Windows
```

**Solutions**:

1. **Start the Terminal Server**:
   ```bash
   cd /path/to/a2rchitech
   ./dev/scripts/start-all.sh
   ```

2. **Check firewall settings**:
   ```bash
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
   
   # Windows (PowerShell as Admin)
   Get-NetFirewallRule -DisplayName "*4096*"
   ```

3. **Try different port**:
   ```bash
   export GIZZI_PORT=4097
   ./dev/scripts/start-all.sh
   ```

### "Connection Refused" / "ECONNREFUSED"

**Causes**:
- Server not running
- Wrong port configured
- Firewall blocking

**Fix**:
1. Verify server URL in settings
2. Check if Terminal Server is on expected port
3. Temporarily disable firewall for testing

### Connection Drops Frequently

**Possible Causes**:
- Network instability
- Server overload
- Timeout settings

**Solutions**:

1. **Check network**:
   ```bash
   ping localhost
   ```

2. **Increase timeout**:
   ```typescript
   // In settings
   {
     "connectionTimeout": 30000,  // 30 seconds
     "retryAttempts": 5
   }
   ```

3. **Check server logs**:
   ```bash
   tail -f logs/gizzi-code.log
   ```

### SSL/TLS Certificate Errors

**For development** (not production):
```bash
# macOS
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain server.crt

# Skip verification (DEV ONLY)
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Performance Issues

### App is Slow/Unresponsive

**Diagnose**:
```bash
# Check CPU/memory usage
# macOS
ps aux | grep "Gizzi Thin Client"

# Windows
Get-Process "Gizzi Thin Client" | Select-Object CPU, WorkingSet

# Enable performance logging
export GIZZI_DEBUG_PERFORMANCE=1
```

**Solutions**:

1. **Clear cache**:
   ```bash
   # macOS
   rm -rf ~/Library/Application\ Support/gizzi-thin-client/Cache
   
   # Windows
   rmdir /s "%APPDATA%\gizzi-thin-client\Cache"
   
   # Linux
   rm -rf ~/.config/gizzi-thin-client/Cache
   ```

2. **Disable animations** (accessibility):
   - Settings → Accessibility → Reduced Motion

3. **Limit message history**:
   - Settings → Clear chat regularly

### High Memory Usage

**Causes**:
- Large chat history
- Memory leak in renderer
- Too many images loaded

**Fixes**:
```bash
# Force reload
Cmd/Ctrl + Shift + R

# Clear storage completely
# (WARNING: Will reset all settings)
```

### Window Lag/Freezes

**Common causes**:
- Large markdown rendering
- Complex syntax highlighting
- Too many DOM elements

**Solutions**:
1. Restart the app
2. Clear chat history
3. Disable syntax highlighting in settings

## UI/UX Issues

### Window Not Visible

**Check**:
```bash
# Check if process is running
ps aux | grep "Gizzi Thin Client"

# Kill and restart
killall "Gizzi Thin Client"  # macOS/Linux
taskkill /F /IM "Gizzi Thin Client.exe"  # Windows
```

**Reset window position**:
```bash
# macOS
defaults delete com.a2r.thin-client windowPosition

# Windows (Registry)
reg delete "HKCU\Software\Gizzi Thin Client" /v windowPosition /f
```

### Global Hotkey Not Working

**Diagnosis**:
1. Check if hotkey is captured by another app
2. Try different hotkey in settings
3. Check accessibility permissions

**macOS Permissions**:
- System Settings → Privacy & Security → Accessibility
- Add "Gizzi Thin Client"

**Windows Permissions**:
- Run as administrator
- Check if hotkey is used by other apps

### Text Rendering Issues

**Solutions**:
1. Change font settings
2. Disable GPU acceleration:
   ```bash
   # Add to launch arguments
   --disable-gpu
   ```

3. Update graphics drivers

### Markdown Not Rendering

**Check**:
- Is `remark-gfm` installed?
- Console errors (DevTools: Cmd/Ctrl+Shift+I)
- Content-type headers from server

## Platform-Specific

### macOS

#### "App needs to be updated" (Big Sur+)
**Fix**: Update to latest version or codesign:
```bash
codesign --force --deep --sign - "/Applications/Gizzi Thin Client.app"
```

#### Microphone Access Denied
**Fix**:
- System Settings → Privacy & Security → Microphone
- Enable for "Gizzi Thin Client"

#### Screen Recording Access
**Fix**:
- System Settings → Privacy & Security → Screen Recording
- Enable for "Gizzi Thin Client"

### Windows

#### Defender False Positive
**Fix**: Add exclusion:
```powershell
# PowerShell as Admin
Add-MpPreference -ExclusionPath "C:\Program Files\Gizzi Thin Client"
```

#### High DPI Scaling Issues
**Fix**:
1. Right-click → Properties → Compatibility
2. Change high DPI settings
3. Check "Override high DPI scaling"

#### Taskbar Icon Missing
**Fix**:
- Restart Windows Explorer
- Reinstall the app

### Linux

#### AppImage Won't Run
**Fix**:
```bash
chmod +x gizzi-thin-client.AppImage
./gizzi-thin-client.AppImage --appimage-extract-and-run
```

#### Missing Libraries
**Fix**:
```bash
# Ubuntu/Debian
sudo apt-get install libgconf-2-4 libgtk-3-0 libnss3

# Fedora
sudo dnf install GConf2 gtk3 nss
```

#### Tray Icon Not Showing
**Fix**:
- Install appindicator extension
- Use `--enable-features=UseOzonePlatform` flag

## Debug Mode

### Enable Debug Logging

```bash
# All platforms
export GIZZI_DEBUG=1
export GIZZI_LOG_LEVEL=verbose

# Then launch
./Gizzi\ Thin\ Client
```

### Open DevTools

```bash
# Development
Cmd/Ctrl + Shift + I

# Production
export GIZZI_OPEN_DEVTOOLS=1
```

### View Logs

**Log locations**:
```
macOS: ~/Library/Logs/gizzi-thin-client/
Windows: %APPDATA%\gizzi-thin-client\logs\
Linux: ~/.config/gizzi-thin-client/logs/
```

**View in terminal**:
```bash
# macOS/Linux
tail -f ~/Library/Logs/gizzi-thin-client/main.log

# Windows
Get-Content "$env:APPDATA\gizzi-thin-client\logs\main.log" -Tail 50 -Wait
```

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| E001 | Server not found | Start Terminal Server |
| E002 | Connection timeout | Check network, increase timeout |
| E003 | Authentication failed | Check credentials |
| E004 | Rate limited | Wait and retry |
| E005 | Invalid response | Update server/client |

## Getting Help

### Before Reporting

1. **Check documentation** (you're here!)
2. **Search existing issues** on GitHub
3. **Try the solutions above**
4. **Gather information**:
   - App version (Settings → About)
   - OS version
   - Error messages
   - Steps to reproduce

### Report Template

```markdown
**Environment:**
- OS: [e.g., macOS 14.2, Windows 11, Ubuntu 22.04]
- App Version: [e.g., 0.1.0]
- Terminal Server Version: [e.g., 0.1.0]

**Problem:**
Clear description of the issue

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. ...

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Logs:**
```
Paste relevant logs here
```

**Screenshots:**
If applicable, add screenshots
```

### Contact Support

- **GitHub Issues**: https://github.com/a2r/thin-client/issues
- **Email**: support@a2r.io
- **Discord**: https://discord.gg/a2r

## Quick Fixes

```bash
# Nuclear option - Reset everything
# (WARNING: Loses all settings and history)

# macOS
rm -rf ~/Library/Application\ Support/gizzi-thin-client
rm -rf ~/Library/Caches/gizzi-thin-client

# Windows
rmdir /s "%APPDATA%\gizzi-thin-client"
rmdir /s "%LOCALAPPDATA%\gizzi-thin-client"

# Linux
rm -rf ~/.config/gizzi-thin-client
rm -rf ~/.cache/gizzi-thin-client
```

## Resources

- [Electron Troubleshooting](https://www.electronjs.org/docs/latest/tutorial/application-debugging)
- [Common Electron Issues](https://www.electronjs.org/docs/latest/tutorial/faq)
- [Report a Bug](https://github.com/a2r/thin-client/issues/new)
