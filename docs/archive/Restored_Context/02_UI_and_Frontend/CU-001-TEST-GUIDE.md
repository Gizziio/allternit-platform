# CU-001: Planner Invocation - Manual Test Guide

**Status:** Tool registered, mechanically complete  
**Verification Required:** End-to-end planner → tool → gateway flow  

---

## Prerequisites

### 1. Gateway Running

```bash
cd packages/computer-use/gateway
export ALLTERNIT_ENABLE_OBSERVABILITY=true
python -m uvicorn main:app --host 127.0.0.1 --port 8080
```

Verify:
```bash
curl http://localhost:8080/health
# Should return: {"status":"ok","version":"0.3.0",...}
```

### 2. GIZZI CLI with Browser Tool Enabled

```bash
export GIZZI_ENABLE_BROWSER_TOOL=true
export ALLTERNIT_COMPUTER_USE_URL=http://localhost:8080
export OPENAI_API_KEY=sk-...  # or ANTHROPIC_API_KEY, etc.
```

### 3. Build GIZZI (if not already built)

```bash
cd cmd/gizzi-code
bun install  # if needed
bun run build  # or bun run dev
```

---

## Test 1: Tool Registration Verification

Before testing with LLM, verify the tool is registered:

```bash
cd cmd/gizzi-code
GIZZI_ENABLE_BROWSER_TOOL=true bun run src/cli/main.ts --help 2>&1 | grep -i browser
```

**Expected:** Should not show errors about browser tool.

**Check tool registry directly:**

Create a test script `check-tool.ts`:

```typescript
import { ToolRegistry } from "./src/runtime/tools/builtins/registry"
import { Flag } from "./src/runtime/context/flag/flag"

console.log("GIZZI_ENABLE_BROWSER_TOOL:", Flag.GIZZI_ENABLE_BROWSER_TOOL)

ToolRegistry.ids().then(ids => {
  console.log("Registered tools:", ids)
  console.log("Browser tool present:", ids.includes("browser"))
})
```

Run:
```bash
GIZZI_ENABLE_BROWSER_TOOL=true bun run check-tool.ts
```

**Expected output:**
```
GIZZI_ENABLE_BROWSER_TOOL: true
Registered tools: [..., "browser", ...]
Browser tool present: true
```

---

## Test 2: Simple Navigation

### Prompt
```
Go to example.com and tell me what you see
```

### What Should Happen

1. **Planner decides to use browser tool**
   - GIZZI shows: "I'll help you navigate to example.com..."

2. **Permission prompt appears**
   ```
   Allow browser automation?
   Action: goto: https://example.com
   [Yes] [No] [Always]
   ```

3. **After approval, tool executes**
   - Gateway receives request
   - Browser navigates to example.com
   - Response includes page title "Example Domain"

4. **Result displayed in TUI**
   ```
   Navigated to https://example.com
   Title: Example Domain
   ```

### Verify in Gateway Logs

You should see:
```
INFO:     127.0.0.1:xxxxx - "POST /v1/execute HTTP/1.1" 200 OK
```

### Verify Observability

```bash
curl http://localhost:8080/v1/recordings/{run_id}
# Should return timeline with goto action
```

---

## Test 3: Multi-Step Workflow

### Prompt
```
Navigate to example.com, take a screenshot, and tell me the page title
```

### What Should Happen

1. **Planner generates multi-step plan**
   - Step 1: goto example.com
   - Step 2: screenshot
   - Step 3: report findings

2. **Permission prompts**
   - First prompt: "Allow browser automation? goto: https://example.com"
   - Second prompt: "Allow browser automation? screenshot"

3. **Screenshots appear as attachments**
   - Screenshot displayed inline in TUI
   - Or available as file attachment

4. **Final response includes**
   - Page title
   - Confirmation screenshot was captured

### Verify Observability

Check recording has 2 steps:
```bash
curl http://localhost:8080/v1/recordings/{run_id}
# Should show: "total_steps": 2
```

---

## Test 4: Error Handling

### Prompt
```
Click on a button with id "nonexistent-button-12345" on example.com
```

### What Should Happen

1. **Planner generates steps**
   - goto example.com
   - click #nonexistent-button-12345

2. **First step succeeds**
   - Page loads

3. **Second step fails**
   - Error: SELECTOR_ERROR
   - Message: "Timeout 5000ms exceeded"

4. **Planner handles error**
   - Reports failure to user
   - May suggest alternative approach

### Verify Error Normalization

Check gateway response:
```bash
# Look at gateway logs or recording
# Error should have:
# - code: "SELECTOR_ERROR"
# - normalized message
# - failure captured in timeline
```

---

## Test 5: Form Interaction

### Prompt
```
Go to httpbin.org/forms/post, fill in the customer name with "Test User", and submit the form
```

### What Should Happen

1. **Navigation**
   - goto httpbin.org/forms/post

2. **Fill action**
   - fill input[name="custname"] with "Test User"

3. **Form submission**
   - click submit button OR
   - press Enter on field

4. **Result**
   - Page navigates to form submission result
   - Response shows submitted data

---

## Common Issues & Debugging

### Issue: Tool Not Registered

**Symptom:** Planner never suggests browser tool

**Check:**
```bash
GIZZI_ENABLE_BROWSER_TOOL=true bun run src/cli/main.ts
# Look for "browser" in loaded tools list
```

**Fix:**
- Ensure `GIZZI_ENABLE_BROWSER_TOOL=true` is exported
- Check `registry.ts` includes BrowserTool

### Issue: Permission Prompt Not Shown

**Symptom:** Tool executes without asking

**Check:**
- GIZZI permission settings
- May be set to "always allow"

**Expected behavior:** Should prompt unless user has previously allowed

### Issue: Gateway Connection Failed

**Symptom:** "Failed to connect to Computer Use gateway"

**Check:**
```bash
curl http://localhost:8080/health
# Should return OK
```

**Fix:**
- Start gateway: `python -m uvicorn main:app --port 8080`
- Check `ALLTERNIT_COMPUTER_USE_URL` environment variable

### Issue: Timeout on Actions

**Symptom:** Actions take too long, timeout errors

**Check:**
- Gateway logs for actual error
- Browser (Playwright) may be slow to start

**Fix:**
- Increase timeout in parameters
- Check system resources

---

## Success Criteria

CU-001 is **VERIFIED** when:

| Test | Pass Criteria |
|------|---------------|
| Tool Registration | `browser` appears in tool list |
| Simple Navigation | goto executes, permission prompted |
| Multi-Step | Multiple actions in sequence |
| Screenshot | Image captured and displayed |
| Error Handling | SELECTOR_ERROR properly returned |
| Form Fill | Input filled, form submitted |

**Minimum for verification:**
- ✅ Test 1: Tool registered
- ✅ Test 2: Simple navigation works
- ✅ Test 3: Multi-step workflow
- ✅ Test 4: Error handling

---

## Reporting Results

After testing, update this file with results:

```markdown
## Test Results - [Date]

Tester: [Name]
Environment: [OS, Node version, etc.]

| Test | Status | Notes |
|------|--------|-------|
| Tool Registration | ✅/❌ | |
| Simple Navigation | ✅/❌ | |
| Multi-Step | ✅/❌ | |
| Screenshot | ✅/❌ | |
| Error Handling | ✅/❌ | |
| Form Fill | ✅/❌ | |

Issues encountered:
- 

Screenshots:
- [Attach if relevant]
```

---

## Next Steps After Verification

Once CU-001 is verified:

1. **Update COMPUTER_USE_STATUS.md**
   - Mark CU-001 as ✅ Verified
   - Note date and tester

2. **Consider expanding tests**
   - More complex workflows
   - Different adapters (when available)
   - Edge cases

3. **Document learned behaviors**
   - What prompts work best
   - Common failure patterns
   - Planner tips that help
