# Agent Wizard - QUICK REFERENCE CARD

**For Next Agent Taking Over**

---

## 🚨 IN ONE SENTENCE

The Agent Creation Wizard has 10 CRITICAL bugs - features look complete visually but DON'T ACTUALLY WORK (no backend integration, hardcoded data, silent failures).

---

## 📁 KEY FILES

```
Main Wizard:     surfaces/allternit-platform/src/components/agents/AgentCreationWizardEnhanced.tsx
Backend API:     cmd/api/src/main.rs (running on localhost:3000)
Fix Plan:        AGENT_WIZARD_CRITICAL_FIXES.md
Full Handoff:    WIZARD_HANDOFF_PACKAGE.md
```

---

## 🔴 TOP 3 CRITICAL FIXES (START HERE)

### 1. Workspace Initialization Fails (LINE 6600+)
**Problem:** Says "Agent Created" but workspace fails silently  
**Fix:** Add proper error handling + rollback + error messages

### 2. Personality Settings Don't Work (LINE 2800+)
**Problem:** Sliders don't save, no backend API  
**Fix:** Create POST /api/v1/agents/:id/personality + save values

### 3. Skills Only Has 7 Options (LINE 3200+)
**Problem:** Hardcoded 7 skills, need 100+  
**Fix:** Create GET /api/v1/skills/taxonomy + expand to 100+ skills

---

## ✅ WHAT ACTUALLY WORKS

- API server running on http://localhost:3000
- Wizard navigation (Next/Back)
- Form validation (basic)
- TypeScript compiles (0 errors)

---

## ❌ WHAT'S BROKEN

| Section | Issue | Line # |
|---------|-------|--------|
| Personality | Doesn't save | ~2800 |
| Skills | Only 7 hardcoded | ~3200 |
| Projected Level | Too gamified | ~3500 |
| Avatar | Only 5 templates | ~3800 |
| Model Config | Hardcoded | ~4300 |
| Voice | Dropdown clipped | ~4700 |
| Prompts | Can't edit | ~5000 |
| Workspace | Click fails | ~5500 |
| Review | Incomplete | ~6000 |
| Create Agent | Silent failure | ~6600 |

---

## 🛠️ QUICK START COMMANDS

```bash
# Check API is running
curl http://localhost:3000/health

# Check TypeScript errors
cd surfaces/allternit-platform && npm run typecheck

# Start API server (if not running)
cd cmd/api && cargo run

# View frontend
cd surfaces/allternit-platform && npm run dev
```

---

## 📋 BACKEND APIs TO CREATE

```bash
# Personality
POST /api/v1/agents/:id/personality
GET  /api/v1/agents/:id/personality

# Skills
GET  /api/v1/skills/taxonomy
POST /api/v1/agents/:id/skills

# Avatar
GET  /api/v1/avatars/templates
POST /api/v1/agents/:id/avatar

# Workspace
GET  /api/v1/agents/:id/workspace/files
PUT  /api/v1/agents/:id/workspace/files/:path
POST /api/v1/agents/:id/workspace/initialize

# + 7 more endpoints (see WIZARD_HANDOFF_PACKAGE.md)
```

---

## ⚡ FASTEST PATH TO WORKING

1. **Fix workspace initialization** (Issue #10) - Users can't create agents
2. **Fix personality save** (Issue #1) - Most visible feature broken
3. **Fix skills taxonomy** (Issue #2) - Only 7 skills is embarrassing
4. **Fix model selector** (Issue #5) - Reuse ChatComposer's working code
5. **Fix error handling** (Issue #10) - Stop silent failures

Then fix the rest in order of user impact.

---

## 🎯 DEFINITION OF DONE

A section is DONE when:
- [ ] Backend API endpoint exists and works
- [ ] Frontend saves/loads from backend
- [ ] Manual testing passes
- [ ] Unit tests written
- [ ] No silent failures
- [ ] Error messages shown

**DO NOT mark complete until ALL criteria met.**

---

## 📞 NEED HELP?

Read these in order:
1. `WIZARD_HANDOFF_PACKAGE.md` - Full details
2. `AGENT_WIZARD_CRITICAL_FIXES.md` - Detailed fix plan
3. `IMPLEMENTATION_GAP_ANALYSIS.md` - What's missing

---

**Good luck! Take it one section at a time. Don't claim completion until it actually works.**
