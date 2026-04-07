# Phase 1: Full Claude Landing Plan (AUDITED VERSION)
## Based on Actual File System Audit

### Audit Date
Generated from actual filesystem scan of `/Users/macbook/claude-code`

---

## Verified Facts

### File Count
| Claimed | Actual |
|---------|--------|
| ~1,962 | **1,884** |

### Foundation Files (Verified EXISTS)
| File | Status | Importance |
|------|--------|------------|
| `src/main.tsx` | ✅ EXISTS | Entry point |
| `src/Tool.ts` | ✅ EXISTS | Base tool class |
| `src/QueryEngine.ts` | ✅ EXISTS | Query orchestration |
| `src/commands.ts` | ✅ EXISTS | Command registry |

### Files Previously Claimed (Verified MISSING)
| File | Status | Correction |
|------|--------|------------|
| `src/assistant/sessionDiscovery.ts` | ❌ MISSING | Only `sessionHistory.ts` exists |
| `src/services/compact/reactiveCompact.ts` | ❌ MISSING | Directory exists but not this file |
| `src/utils/featureFlags.ts` | ❌ MISSING | Not in filesystem |
| `src/sdk/allternit-api/` | ❌ MISSING | SDK directory doesn't exist |

### What Actually Exists in `src/services/compact/`
```
apiMicrocompact.ts
autoCompact.ts
compact.ts
compactWarningHook.ts
compactWarningState.ts
grouping.ts
microCompact.ts
postCompactCleanup.ts
prompt.ts
sessionMemoryCompact.ts
timeBasedMCConfig.ts
```

---

## Landing Procedure

### Step 1: Create Landing Zone
```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code
mkdir -p migration/claude
cp -r /Users/macbook/claude-code/src migration/claude/
cp /Users/macbook/claude-code/package.json migration/claude/
cp /Users/macbook/claude-code/tsconfig.json migration/claude/
cp /Users/macbook/claude-code/README.md migration/claude/
```

### Step 2: Verify Landing
```bash
# Count files - must match 1884
find migration/claude/src -type f \( -name "*.ts" -o -name "*.tsx" \) | wc -l

# Verify foundation files
test -f migration/claude/src/main.tsx && echo "OK"
test -f migration/claude/src/Tool.ts && echo "OK"
test -f migration/claude/src/QueryEngine.ts && echo "OK"
test -f migration/claude/src/commands.ts && echo "OK"

# Verify structure preserved
diff <(ls /Users/macbook/claude-code/src | sort) <(ls migration/claude/src | sort)
```

---

## Verified Directory Structure

```
migration/claude/src/
├── assistant/              # (1 file: sessionHistory.ts)
├── bootstrap/              # State management
├── bridge/                 # Bridge system (comprehensive)
├── buddy/                  # Companion system
├── cli/                    # CLI handlers & transports
│   ├── handlers/           # Command handlers
│   └── transports/         # WebSocket, SSE, Hybrid
├── commands/               # 70+ command directories
├── commands.ts             # Command registry (FOUNDATION)
├── components/             # UI components (80+ directories)
├── constants/              # Constants
├── context.ts              # Context
├── coordinator/            # Coordination
├── cost-tracker.ts         # Cost tracking
├── costHook.ts             # Cost hooks
├── dialogLaunchers.tsx     # Dialogs
├── entrypoints/            # SDK entrypoints
├── history.ts              # History
├── hooks/                  # React hooks
├── ink/                    # Ink TUI extensions
├── ink.ts                  # Ink entry
├── interactiveHelpers.tsx  # Helpers
├── keybindings/            # Key bindings
├── main.tsx                # MAIN ENTRY (FOUNDATION)
├── memdir/                 # Memory directory
├── migrations/             # DB migrations
├── moreright/              # More-right panel
├── native-ts/              # Native TypeScript
├── outputStyles/           # Output styling
├── plugins/                # Plugin system
├── projectOnboardingState.ts
├── query/                  # Query system
├── QueryEngine.ts          # QUERY ENGINE (FOUNDATION)
├── remote/                 # Remote session
├── schemas/                # Schemas
├── screens/                # TUI screens
├── server/                 # Server mode
├── services/               # Services layer
│   ├── api/                # API client
│   ├── compact/            # Context compaction (10 files)
│   ├── mcp/                # MCP service
│   └── ...
├── skills/                 # Skills system
├── state/                  # App state
├── tasks/                  # Task system
├── Tool.ts                 # BASE TOOL (FOUNDATION)
├── tools/                  # 40+ tool implementations
├── types/                  # Type definitions
├── upstreamproxy/          # Upstream proxy
├── utils/                  # Utilities (20+ subdirs)
└── voice/                  # Voice
```

---

## What Is NOT in Claude Code (Missing 20%)

Based on audit, these claimed components are MISSING:

| Claimed Component | Actual Status |
|-------------------|---------------|
| `src/sdk/*` | ❌ Entire SDK directory missing |
| `src/assistant/sessionDiscovery.ts` | ❌ Only `sessionHistory.ts` exists |
| `src/utils/featureFlags.ts` | ❌ Not present |
| `src/state/AppState.tsx` | ❌ Not present (has `state/` dir but different files) |

---

## Phase 1 Success Criteria (Audited)

| Criterion | Verification Method |
|-----------|---------------------|
| All 1,884 files landed | `find migration/claude/src -type f \| wc -l` = 1884 |
| Structure preserved | `diff` of directory trees passes |
| Foundation files present | `test -f` for main.tsx, Tool.ts, QueryEngine.ts, commands.ts |
| Zero modifications | `git diff --stat` shows only additions |
| No new code created | No files in migration/ newer than source |

---

## What Happens After Phase 1

### Phase 2: Missing Dependency Audit
- Identify what `main.tsx` imports that's missing
- Cross-reference with Gizzi Code for possible reconstruction sources
- Build dependency graph from foundation files

### Phase 3: Reconstruction Planning
- For each missing dependency:
  - Can Gizzi provide it?
  - Is it in OSS/free code?
  - Must it be reconstructed from scratch?

### Phase 4: Build Toward Working State
- Fix imports gradually
- Get to compile state
- Prove end-to-end behavior

### Phase 5: Final Consolidation
- Move to final paths
- Delete migration/
- Gizzi branding pass

---

## Immediate Action

Execute landing now:

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code
mkdir -p migration/claude
cp -r /Users/macbook/claude-code/src migration/claude/
echo "Landing complete. Verify with: find migration/claude/src -type f | wc -l"
```

**Expected output: 1884**
