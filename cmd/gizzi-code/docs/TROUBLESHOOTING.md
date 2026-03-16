# Gizzi Code - Troubleshooting Guide

## Issue: Gizzi Code Hangs/Freezes on Startup

### Problem
The gizzi-code TUI hangs or freezes when trying to open. This is typically caused by:
1. **Stuck background processes** from previous runs
2. **Terminal input conflicts** (setRawMode errors)
3. **Multiple instances** interfering with each other

### Solution

#### Quick Fix (Recommended)
Run the fix script before starting gizzi-code:

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/cmd/gizzi-code
bun run fix:hang
```

Then start gizzi-code normally:
```bash
bun run dev
# or
bun run start
```

#### Manual Fix
If the script doesn't work, manually kill stuck processes:

```bash
# Kill all gizzi processes
pkill -9 -f "bun.*main.ts"
pkill -9 -f "gizzi-code"

# Wait a moment
sleep 1

# Verify no processes remain
ps aux | grep -i gizzi | grep -v grep
```

#### Check for Stuck Processes
```bash
ps aux | grep -i 'bun.*gizzi\|gizzi.*bun' | grep -v grep
```

If you see multiple processes, kill them all.

### Prevention

1. **Always exit cleanly**: Use `Ctrl+C` or the exit command in the TUI
2. **Check before running**: Run `bun run fix:hang` before starting if you experienced issues
3. **One instance at a time**: Don't run multiple gizzi-code instances simultaneously

### Error Messages

#### "setRawMode failed with errno: 9"
This means stdin is not available or is being used by another process.
- **Fix**: Kill stuck processes using the fix script

#### "EIO: i/o error, read"
Terminal input/output error, usually from conflicting processes.
- **Fix**: Kill stuck processes and restart your terminal

#### TUI doesn't open / hangs at "[AgentCommunicationRuntime] Initialized successfully"
The process is running but TUI can't initialize.
- **Fix**: Kill stuck processes, then try again

### Commands Reference

```bash
# Fix hanging issues
bun run fix:hang

# Start gizzi-code
bun run dev          # Development mode
bun run start        # Start TUI

# Check health
bun run doctor       # System health check

# View logs
tail -f /Users/macbook/.local/share/gizzi-code/log/dev.log
```

### Still Having Issues?

1. **Restart terminal**: Close and reopen your terminal
2. **Check disk space**: Ensure you have free disk space
3. **Database issues**: 
   ```bash
   cd /Users/macbook/.local/share/gizzi-code
   # Backup and remove database WAL files
   cp gizzi.db-wal gizzi.db-wal.backup 2>/dev/null || true
   rm gizzi.db-wal gizzi.db-shm 2>/dev/null || true
   ```
4. **Reinstall dependencies**:
   ```bash
   cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/cmd/gizzi-code
   rm -rf node_modules
   bun install
   ```

### Contact
If issues persist, check the logs at:
- `/Users/macbook/.local/share/gizzi-code/log/dev.log`
- `/Users/macbook/.local/share/gizzi-code/log/*.log`
