# Testing Plan - Agent-Assisted Wizard

**Date:** 2026-02-23  
**Status:** READY TO EXECUTE

---

## Test 1: Code Compilation ✅

**Status:** PASS

**Result:** No TypeScript errors in modified files:
- `BrowserCapsuleEnhanced.tsx` ✅
- `BrowserAgentBar.tsx` ✅
- `CloudDeployView.tsx` ✅

**Note:** Only errors are in unrelated `dev/agentation/storybook-integration.ts`

---

## Test 2: Guidance Messages Display

**What to Test:**
Guidance messages from wizard backend should display in purple bar at top of BrowserAgentBar.

**Test Steps:**
1. Open ShellUI
2. Click ☁️ Console in left sidebar
3. Click "Deploy" tab
4. Start wizard flow
5. Select Hetzner as provider
6. Click "🤖 Agent-Assisted Signup"
7. Check if purple guidance bar appears at top of browser

**Expected Result:**
```
┌─────────────────────────────────────────────────────────────┐
│  ✨ Navigate to Hetzner signup page                         │
│     Click the "Sign Up" button to create an account         │
└─────────────────────────────────────────────────────────────┘
```

**Pass Criteria:**
- [ ] Purple bar visible at top of BrowserAgentBar
- [ ] Sparkle icon (✨) displays
- [ ] Guidance messages render in purple text
- [ ] Multiple messages stack vertically
- [ ] Bar has purple background (`bg-purple-500/10`)

**Debug Commands:**
```javascript
// In browser console, check if guidance messages are passed:
window.wizardState?.context?.agent_guidance

// Check if BrowserAgentBar receives props:
// (Add console.log in BrowserAgentBar component)
```

---

## Test 3: Human Checkpoint Detection

**What to Test:**
When guidance mentions "payment", "captcha", or "verification", the `onHumanCheckpoint()` callback should fire.

**Test Steps:**
1. Start wizard flow with agent-assisted signup
2. Wait for guidance message containing "payment" or "verification"
3. Check if HumanCheckpointBanner appears

**Expected Result:**
```
┌─────────────────────────────────────────────────────────────┐
│  💳 Payment Required                                        │
│                                                             │
│  Please complete the payment process on the provider's      │
│  website. This may include entering payment details.        │
│                                                             │
│  ⚠️ The agent cannot proceed until this step is completed.  │
│                                                             │
│  ☐ I have completed this step                               │
│  [▶️ Continue Setup]                                        │
└─────────────────────────────────────────────────────────────┘
```

**Pass Criteria:**
- [ ] HumanCheckpointBanner appears when guidance mentions payment
- [ ] Correct icon displays (💳 for payment, 🧩 for CAPTCHA, etc.)
- [ ] Checkbox is unchecked by default
- [ ] "Continue Setup" button is disabled until checkbox checked
- [ ] Clicking "Continue Setup" calls resumeWizard()

**Debug Commands:**
```javascript
// In browser console, simulate guidance with payment keyword:
window.setGuidance(['Please complete payment to continue'])

// Check if onHumanCheckpoint was called:
window.humanCheckpointCalled // Should be true
```

---

## Test 4: Phase Transitions

**What to Test:**
CloudDeployView should switch phases correctly based on wizard state.

**Test Steps:**
1. Start in 'wizard' phase
2. Click "🤖 Agent-Assisted Signup"
3. Should transition to 'agentAssisted' phase
4. When human checkpoint reached, should transition to 'humanCheckpoint'
5. After resume, should transition back to 'agentAssisted'
6. When provisioning starts, should transition to 'deploying'
7. When complete, should transition to 'complete'

**Expected Phase Flow:**
```
wizard
  ↓ (click Agent-Assisted Signup)
agentAssisted
  ↓ (guidance mentions payment)
humanCheckpoint
  ↓ (user clicks Continue Setup)
agentAssisted
  ↓ (wizard advances to Provisioning)
deploying
  ↓ (deployment complete)
complete
```

**Pass Criteria:**
- [ ] Each phase renders correct component
- [ ] Transitions are smooth (no flickering)
- [ ] State persists through transitions
- [ ] Error phase shows if something fails

**Debug Commands:**
```javascript
// In browser console, check current phase:
window.currentPhase // Should show current phase string

// Manually trigger phase transition:
window.setCurrentPhase('humanCheckpoint')
```

---

## Test 5: Full Wizard Flow

**What to Test:**
Complete end-to-end flow from wizard start to deployment complete.

**Test Steps:**
1. Open ShellUI → Console → Deploy
2. Select deployment type (self-host)
3. Select provider (Hetzner)
4. Click "🤖 Agent-Assisted Signup"
5. Browser opens hetzner.com/register
6. Guidance messages display
7. Complete signup manually (or simulate)
8. Human checkpoint appears
9. Check "I've completed this step"
10. Click "Continue Setup"
11. Enter API token when prompted
12. Agent validates token
13. Agent provisions VPS
14. Progress shows in real-time
15. Deployment complete

**Expected Result:**
- Browser navigates to correct URL
- Guidance updates throughout flow
- Human checkpoint triggers at payment
- Resume works after human action
- Token validation succeeds
- VPS provisioning completes
- Success screen displays

**Pass Criteria:**
- [ ] All steps complete without errors
- [ ] Guidance messages update correctly
- [ ] Human checkpoint triggers at right time
- [ ] Resume after human action works
- [ ] Deployment completes successfully
- [ ] Instance appears in Instances page

**Debug Commands:**
```javascript
// Check wizard state throughout flow:
await fetch('/api/v1/wizard/{deployment_id}')
  .then(r => r.json())
  .then(state => console.log('Wizard state:', state))

// Check backend logs:
// (Tail server logs for wizard endpoints)
```

---

## Test 6: Error Handling

**What to Test:**
Errors should display in error banner with dismiss option.

**Test Scenarios:**
1. Invalid API token
2. Network error
3. Provider API error
4. Browser navigation error

**Expected Result:**
```
┌─────────────────────────────────────────────────────────────┐
│  ❌ Failed to validate API token                            │
│  [Dismiss]                                                  │
└─────────────────────────────────────────────────────────────┘
```

**Pass Criteria:**
- [ ] Error banner displays on error
- [ ] Error message is descriptive
- [ ] Dismiss button works
- [ ] Can retry after dismissing error

---

## Test Execution Checklist

### Unit Tests (Automated)
- [ ] Guidance messages render in BrowserAgentBar
- [ ] Human checkpoint detection triggers callback
- [ ] Phase transitions work correctly
- [ ] Error banner displays on error

### Integration Tests (Manual)
- [ ] Wizard starts correctly
- [ ] Browser opens correct URL
- [ ] Guidance messages display
- [ ] Human checkpoint triggers
- [ ] Resume after human action works
- [ ] Deployment completes

### E2E Tests (Full Flow)
- [ ] Complete wizard flow works
- [ ] All phases transition correctly
- [ ] No errors in console
- [ ] Deployment succeeds

---

## Known Issues to Watch For

1. **Cross-origin restrictions** - Iframe may not load provider pages
2. **Guidance not updating** - Check if wizard state syncs correctly
3. **Checkpoint not triggering** - Verify keyword detection works
4. **Resume not working** - Check API call succeeds

---

## Test Results Template

```markdown
### Test 1: Code Compilation
- [ ] PASS / FAIL
- Notes:

### Test 2: Guidance Messages Display
- [ ] PASS / FAIL
- Notes:

### Test 3: Human Checkpoint Detection
- [ ] PASS / FAIL
- Notes:

### Test 4: Phase Transitions
- [ ] PASS / FAIL
- Notes:

### Test 5: Full Wizard Flow
- [ ] PASS / FAIL
- Notes:

### Test 6: Error Handling
- [ ] PASS / FAIL
- Notes:
```

---

**End of Testing Plan**
