
### 3. Shell UI

```bash
# Open in browser (after make dev)
open http://localhost:5173/

# The shell UI provides access to:
# - Allternit REPL interface
# - Voice integration testing
# - WebVM integration testing
# - Tool explorers
# - Settings and configuration
```

### 4. Kernel Integration

```bash
# Start REPL (or use shell UI)
./target/release/allternit repl

# In REPL (or via shell UI):
> use tool voice.tts with text "Testing kernel voice tool"

> use tool webvm.session with memory_mb 512

> tools list
```

---

**Ready? Run `make dev` and start exploring! 🚀**
