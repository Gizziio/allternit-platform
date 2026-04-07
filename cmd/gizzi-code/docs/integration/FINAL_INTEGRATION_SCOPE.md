# Final Integration Scope: Claude Code + Gizzi

**Base:** Claude Code (canonical)  
**Port From Gizzi:** Unique primitives only  
**Exclude:** Overlapping/lesser implementations

---

## ✅ DEFINITELY PORT (High Value)

### 1. **Gizzi Branding** (Must)
- Product name: "GIZZI Code"
- Command: `gizzi-code`
- GIZZICopy strings
- ShimmeringBanner (reimplement in Ink)

### 2. **Bus Event System** (High)
- Decoupled pub/sub for cross-component communication
- Plugin integration
- Telemetry foundation

### 3. **Workspace Identity System** (High)
- `.gizzi/` directory structure
- IDENTITY.md, SOUL.md, USER.md, MEMORY.md
- Auto-loading into context
- 5-layer format option

### 4. **Continuity/Handoff** (High)
- Cross-tool session transfer
- SessionContext extraction
- DAG task tracking
- Structured handoff bundles

### 5. **Advanced Verification** (High)
- Semi-formal verification (Meta paper)
- Empirical + reasoning dual mode
- Verification certificates
- Visual evidence capture

### 6. **Layered Configuration** (Medium-High)
- .well-known/gizzi remote config
- JSONC support
- Array merging (concatenate)
- Multiple sources

### 7. **Auto-Loading Instructions** (Medium-High)
- AGENTS.md discovery
- Relevance scoring
- Topic memory files
- Session-based memory

---

## ⚠️ ENHANCE CLAUDE'S VERSION (Don't Replace)

### 8. **Session Model**
- **KEEP** Claude's session fork/structure
- **ADD** parent-child tree commands
- **ADD** continuity context field

### 9. **Skills System**
- **KEEP** Claude's skill framework
- **ADD** external dir scanning (.agents, .openclaw)
- **ADD** AI skill generation
- **ADD** skill evaluation

### 10. **Permission System**
- **KEEP** Claude's interactive UI
- **ADD** PermissionNext rulesets
- **ADD** wildcard pattern matching

### 11. **LSP Integration**
- **KEEP** Claude's LSPTool
- **ADD** Gizzi's runtime LSP management
- **ADD** completion/diagnostics integration

### 12. **Shell Integration**
- **KEEP** Claude's BashTool
- **ADD** Gizzi's PTY support
- **ADD** better terminal emulation

---

## ❌ DON'T PORT (Claude's is Better)

| Feature | Reason |
|---------|--------|
| **TUI Framework** | Claude's React + Ink is production-tested |
| **Session Forking** | Claude's is more mature (Gizzi had issues) |
| **Tool Implementations** | Claude's 40+ tools are mature |
| **QueryEngine** | Claude's streaming is better |
| **Bridge System** | Claude's IDE integration is complete |
| **Commands** | Claude's 50+ commands are comprehensive |

---

## ⏸️ HOLD OFF (Complex/Low Priority)

| Feature | Reason |
|---------|--------|
| **Cowork Mode** | Complex, needs stability first |
| **Git Worktree Mgmt** | Nice-to-have, not critical |
| **Smart Model Resolution** | Enhancement, not core |
| **Env Isolation** | Testing feature, lower priority |
| **Prompt Templates** | Can use Claude's existing system |

---

## Revised Timeline

### Phase 1: Foundation (4 weeks)
```
Week 1: Branding (GIZZI identity on Claude base)
Week 2: Bus event system
Week 3: Workspace identity (.gizzi/)
Week 4: Continuity types/handoff
```

### Phase 2: Config & Instructions (3 weeks)
```
Week 5: Layered configuration
Week 6: Auto-loading instructions
Week 7: PermissionNext rulesets
```

### Phase 3: Advanced Features (4 weeks)
```
Week 8-9: Advanced verification system
Week 10-11: Skills enhancements
Week 12: Session tree commands
```

### Phase 4: Polish (3 weeks)
```
Week 13: LSP/Shell enhancements
Week 14: Integration testing
Week 15: Documentation
```

**Total: 14 weeks** (before Cowork)

---

## Final File List to Port

### New Files (from Gizzi)
```
src/bus/index.ts
src/brand/
src/continuity/
src/workspace/
src/runtime/verification/  (orchestrator + semi-formal)
src/utils/config/          (enhanced layered loading)
src/utils/instructions.ts
```

### Modified Files (Claude)
```
src/utils/sessionStorage.ts      (add continuity field)
src/hooks/toolPermission/        (add rulesets)
src/skills/                      (enhance with Gizzi features)
src/commands/                    (add tree, fork commands)
src/components/                  (rebrand to GIZZI)
```

---

## Key Principles

1. **Claude Code is the foundation** - Keep its mature implementations
2. **Port Gizzi's UNIQUE features** - Don't duplicate
3. **Rebrand to GIZZI** - Apply identity to Claude base
4. **Enhance, don't replace** - Add to Claude's systems
5. **Hold off on Cowork** - Wait for stability

---

## Success Criteria

- [ ] Product boots as "GIZZI Code"
- [ ] Command is `gizzi-code`
- [ ] .gizzi/ workspace works
- [ ] Continuity/handoff functional
- [ ] Verification system operational
- [ ] All Claude features preserved
- [ ] No regression in stability

---

*Final scope defined. Ready for implementation planning.*
