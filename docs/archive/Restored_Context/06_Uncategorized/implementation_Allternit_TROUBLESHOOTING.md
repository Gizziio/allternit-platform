# Allternit Command Troubleshooting

## First Run Takes a Long Time

### Problem
When you run `allternit start` for the first time, it seems to hang or takes forever.

### Solution
**This is NORMAL.** The Rust services need to compile on first run. This can take:
- **5-10 minutes** on first run (full compilation)
- **30-60 seconds** on subsequent runs (incremental builds)

### What to Do

1. **Start the platform**:
   ```bash
   allternit start
   ```

2. **Wait for compilation** (check progress in logs):
   ```bash
   # In another terminal
   tail -f ~/.logs/*.log
   ```

3. **Check status** after a few minutes:
   ```bash
   allternit status
   ```

### Expected Output Timeline

| Time | What Happens |
|------|--------------|
| 0:00 | Services start, compilation begins |
| 2:00 | Policy, Memory compiling |
| 4:00 | Registry, Kernel compiling |
| 6:00 | API compiling |
| 8:00 | Gateway (Python - fast), Shell UI starts |
| 8:30 | "Platform is running!" message |

---

## Services Not Responding

### Problem
`allternit status` shows services as "Stopped" or "Unhealthy"

### Check These

1. **Are processes running?**
   ```bash
   lsof -i :8013  # Gateway
   lsof -i :3000  # API
   lsof -i :3004  # Kernel
   ```

2. **Check logs for errors**:
   ```bash
   allternit logs api      # API errors
   allternit logs kernel   # Kernel errors
   allternit logs all      # All logs
   ```

3. **Port conflicts?**
   ```bash
   # Kill any processes on platform ports
   for port in 3003 3200 8080 3004 3000 8013 5177; do
     lsof -ti:$port | xargs kill -9 2>/dev/null
   done
   ```

4. **Try restart**:
   ```bash
   allternit restart
   ```

---

## "Command not found: allternit"

### Solution

1. **Check if installed**:
   ```bash
   ls -la ~/Desktop/allternit-workspace/allternit/bin/allternit
   ```

2. **Add to PATH**:
   ```bash
   export PATH="$HOME/Desktop/allternit-workspace/allternit/bin:$PATH"
   ```

   Or run the installer:
   ```bash
   ./scripts/install-allternit-alias.sh
   source ~/.bash_profile  # or ~/.zshrc
   ```

---

## Shell UI Never Starts

### Problem
Everything else is running but Shell UI shows "Stopped"

### Causes

1. **pnpm not installed**:
   ```bash
   which pnpm || npm install -g pnpm
   ```

2. **Node modules missing**:
   ```bash
   cd 6-apps/shell-ui && pnpm install
   ```

3. **Port already in use**:
   ```bash
   lsof -ti:5177 | xargs kill -9
   allternit restart
   ```

---

## Gateway Returns 503

### Problem
`curl http://127.0.0.1:8013/health` returns "Backend unavailable"

### Solution

The API service isn't running. Check:

```bash
# Check API logs
allternit logs api

# Common issues:
# 1. Cargo.toml error - some service moved to .deprecated/
# 2. Missing dependencies
# 3. Compilation error
```

**Fix for Cargo.toml errors**:
If you see errors about missing `registry-apps` or similar, the workspace references may be broken. Check `Cargo.toml` in project root.

---

## Quick Diagnostic Commands

```bash
# Check all service ports
for port in 3003 3200 8080 3004 3000 8013 5177; do
  echo "Port $port: $(lsof -ti:$port 2>/dev/null || echo 'free')"
done

# Check all health endpoints
curl -s http://127.0.0.1:8013/health && echo "Gateway OK"
curl -s http://127.0.0.1:3000/health && echo "API OK"
curl -s http://127.0.0.1:3004/health && echo "Kernel OK"

# View recent errors
grep -i error .logs/*.log | tail -20
```

---

## Performance Tips

### Speed Up Compilation

1. **Use release builds** (slower compile, faster runtime):
   Edit scripts and change `cargo run` to `cargo run --release`

2. **Keep services running**:
   Don't stop/start frequently. Compilation is the slow part.

3. **Use sccache** (optional):
   ```bash
   cargo install sccache
   export RUSTC_WRAPPER=sccache
   ```

---

## Still Not Working?

1. **Check architecture compliance**:
   ```bash
   allternit check
   ```

2. **Full reset**:
   ```bash
   allternit stop
   sleep 2
   rm -rf target/debug  # Clear build cache
   allternit start
   ```

3. **Check documentation**:
   - `ARCHITECTURE_ENTERPRISE.md` - Architecture overview
   - `IMPLEMENTATION_COMPLETE.md` - Implementation status
   - `ALLTERNIT_COMMAND_GUIDE.md` - Command reference
