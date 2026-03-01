# Natural Language Tool Usage Guide

**How to Use agent-browser via Natural Language in TUI and GUI**

**Date:** February 26, 2026

---

## 🎯 OVERVIEW

You can use **natural language** to trigger the agent-browser tool in both TUI and GUI. The agent will:
1. **Understand** your intent
2. **Select** the right tool (agent-browser.automation)
3. **Map** your request to tool parameters
4. **Execute** with deterministic retry/timeout
5. **Report** results back

---

## 💬 TUI: NATURAL LANGUAGE EXAMPLES

### Example 1: Simple Navigation

**You type:**
```
Open example.com in the browser
```

**Agent understands:**
- Intent: Navigate to website
- Tool: `agent-browser.automation`
- Parameters: `{ action: "open", url: "https://example.com" }`

**Agent executes:**
```bash
/tools execute agent-browser.automation '{"action":"open","url":"https://example.com"}'
```

**Agent responds:**
```
✓ Successfully opened https://example.com
  Execution time: 1,234ms
  Would you like me to take a screenshot or extract data?
```

---

### Example 2: Take Screenshot

**You type:**
```
Take a screenshot of the homepage
```

**Agent understands:**
- Intent: Capture current page
- Tool: `agent-browser.automation`
- Parameters: `{ action: "screenshot", path: "/tmp/screenshot-<timestamp>.png" }`

**Agent executes:**
```bash
/tools execute agent-browser.automation '{"action":"screenshot","path":"/tmp/screenshot-1234567890.png"}'
```

**Agent responds:**
```
✓ Screenshot captured
  Saved to: /tmp/screenshot-1234567890.png
  Execution time: 2,345ms
  
  [Screenshot preview would appear here in GUI]
```

---

### Example 3: Extract Data

**You type:**
```
Get the main heading text from the page
```

**Agent understands:**
- Intent: Extract text
- Tool: `agent-browser.automation`
- Steps:
  1. Get snapshot to find elements
  2. Extract text from heading element

**Agent executes:**
```bash
# Step 1: Get snapshot
/tools execute agent-browser.automation '{"action":"snapshot"}'

# Step 2: Extract text from heading (e.g., @e1)
/tools execute agent-browser.automation '{"action":"get_text","selector":"h1"}'
```

**Agent responds:**
```
✓ Extracted text from heading:
  "Welcome to Example.com"
  
  Execution time: 1,567ms
```

---

### Example 4: Fill Form and Submit

**You type:**
```
Fill out the contact form with my email test@example.com and submit it
```

**Agent understands:**
- Intent: Form interaction
- Tool: `agent-browser.automation`
- Steps:
  1. Get snapshot to find form fields
  2. Fill email field
  3. Click submit button

**Agent executes:**
```bash
# Step 1: Get snapshot
/tools execute agent-browser.automation '{"action":"snapshot"}'

# Step 2: Fill email (finds field by label/placeholder)
/tools execute agent-browser.automation '{"action":"fill","selector":"label=Email","value":"test@example.com"}'

# Step 3: Click submit
/tools execute agent-browser.automation '{"action":"click","selector":"role=button[name='Submit']"}'
```

**Agent responds:**
```
✓ Form submitted successfully
  - Filled: Email field with "test@example.com"
  - Clicked: Submit button
  Execution time: 3,456ms
  
  The form has been submitted. Would you like me to check for a confirmation message?
```

---

### Example 5: Complex Multi-Step Task

**You type:**
```
Go to github.com, search for "machine learning" repositories, and show me the top 3 results
```

**Agent understands:**
- Intent: Search and extract
- Tool: `agent-browser.automation`
- Steps:
  1. Navigate to github.com
  2. Find search box
  3. Fill search query
  4. Click search
  5. Wait for results
  6. Extract top 3 repositories

**Agent executes:**
```bash
# Step 1: Navigate
/tools execute agent-browser.automation '{"action":"open","url":"https://github.com"}'

# Step 2: Get snapshot
/tools execute agent-browser.automation '{"action":"snapshot"}'

# Step 3: Fill search
/tools execute agent-browser.automation '{"action":"fill","selector":"[aria-label=Search]","value":"machine learning"}'

# Step 4: Submit search
/tools execute agent-browser.automation '{"action":"type","selector":"[aria-label=Search]","value":"\n"}'

# Step 5: Wait for results
/tools execute agent-browser.automation '{"action":"wait","timeout":5000}'

# Step 6: Get results snapshot
/tools execute agent-browser.automation '{"action":"snapshot"}'

# Step 7: Extract top 3
/tools execute agent-browser.automation '{"action":"get_text","selector":".repo-list-item:nth-child(1) h3"}'
/tools execute agent-browser.automation '{"action":"get_text","selector":".repo-list-item:nth-child(2) h3"}'
/tools execute agent-browser.automation '{"action":"get_text","selector":".repo-list-item:nth-child(3) h3"}'
```

**Agent responds:**
```
✓ Search completed
  Top 3 repositories for "machine learning":
  
  1. tensorflow/tensorflow
     An Open Source Machine Learning Framework
     
  2. pytorch/pytorch
     Tensors and Dynamic neural networks in Python
     
  3. scikit-learn/scikit-learn
     Machine Learning in Python
     
  Execution time: 12,345ms
  Would you like me to open any of these repositories?
```

---

## 🖥️ GUI: NATURAL LANGUAGE EXAMPLES

### Example 1: Chat Interface

**You type in chat:**
```
Can you navigate to example.com and tell me what the main heading says?
```

**Agent processes:**
```typescript
// Agent identifies intent
const intent = 'navigate_and_extract';

// Selects tool
const tool = 'agent-browser.automation';

// Maps to parameters
const steps = [
  { action: 'open', url: 'https://example.com' },
  { action: 'get_text', selector: 'h1' },
];
```

**Agent executes (via hook):**
```typescript
import { useToolWithRetryAndTimeout } from '@/hooks/useTool';

const { execute } = useToolWithRetryAndTimeout('agent-browser.automation', 3, 30000);

// Step 1: Navigate
await execute({ action: 'open', url: 'https://example.com' });

// Step 2: Extract text
const result = await execute({ action: 'get_text', selector: 'h1' });
```

**Agent responds in chat:**
```
✓ I've navigated to example.com

The main heading says:
"Example Domain"

This is a simple page for demonstration purposes.
```

---

### Example 2: Voice Command

**You say:**
```
"Take a screenshot of the current page"
```

**Speech-to-text converts:**
```
Take a screenshot of the current page
```

**Agent understands:**
- Intent: `capture_screenshot`
- Tool: `agent-browser.automation`
- Parameters: `{ action: "screenshot" }`

**Agent executes:**
```typescript
const { execute } = useToolWithRetryAndTimeout('agent-browser.automation', 3, 30000);
const result = await execute({ action: 'screenshot', path: `/tmp/screenshot-${Date.now()}.png` });
```

**Agent responds (voice + UI):**
```
✓ Screenshot captured

[Image preview appears in chat]

Saved to: /tmp/screenshot-1234567890.png
```

---

### Example 3: Workflow Builder

**You type:**
```
Create a workflow that:
1. Opens twitter.com
2. Logs in with my credentials
3. Posts a tweet saying "Hello from A2R!"
4. Takes a screenshot of the posted tweet
```

**Agent generates workflow YAML:**
```yaml
workflow_id: twitter-post
description: Post tweet and capture screenshot
nodes:
  - id: navigate
    tool: agent-browser.automation
    parameters:
      action: open
      url: https://twitter.com
    retry: 3
    timeout: 30000
  
  - id: login
    tool: agent-browser.automation
    parameters:
      action: fill
      selector: input[name="session[username_or_email]"]
      value: ${TWITTER_USERNAME}
    depends_on: [navigate]
  
  - id: fill_password
    tool: agent-browser.automation
    parameters:
      action: fill
      selector: input[name="session[password]"]
      value: ${TWITTER_PASSWORD}
    depends_on: [login]
  
  - id: click_login
    tool: agent-browser.automation
    parameters:
      action: click
      selector: button[data-testid="LoginButton"]
    depends_on: [fill_password]
  
  - id: new_tweet
    tool: agent-browser.automation
    parameters:
      action: fill
      selector: [data-testid="tweetTextarea_0"]
      value: "Hello from A2R!"
    depends_on: [click_login]
  
  - id: post_tweet
    tool: agent-browser.automation
    parameters:
      action: click
      selector: button[data-testid="tweetButton"]
    depends_on: [new_tweet]
  
  - id: screenshot
    tool: agent-browser.automation
    parameters:
      action: screenshot
      path: /tmp/tweet-${timestamp}.png
    depends_on: [post_tweet]
```

**You confirm:** "Yes, create this workflow"

**Agent saves and executes:**
```
✓ Workflow created: twitter-post
✓ Executing workflow...
  ✓ Step 1: Navigate to twitter.com
  ✓ Step 2: Fill username
  ✓ Step 3: Fill password
  ✓ Step 4: Click login
  ✓ Step 5: Fill tweet text
  ✓ Step 6: Post tweet
  ✓ Step 7: Take screenshot

✓ Workflow completed successfully
  Screenshot saved to: /tmp/tweet-1234567890.png
  
  [Screenshot preview]
```

---

## 🎯 NATURAL LANGUAGE PATTERNS

### Pattern 1: Direct Command

**You say:**
```
Open example.com
```

**Agent maps to:**
```typescript
{
  tool: 'agent-browser.automation',
  parameters: { action: 'open', url: 'https://example.com' }
}
```

---

### Pattern 2: Question Form

**You ask:**
```
Can you show me the homepage of example.com?
```

**Agent understands as command:**
```typescript
{
  tool: 'agent-browser.automation',
  parameters: { action: 'open', url: 'https://example.com' }
}
```

---

### Pattern 3: Implicit Intent

**You say:**
```
I need to see what's on example.com
```

**Agent infers intent:**
```typescript
{
  tool: 'agent-browser.automation',
  parameters: { action: 'open', url: 'https://example.com' }
}
```

---

### Pattern 4: Multi-Step Request

**You say:**
```
Go to github.com and find the most popular Python repository
```

**Agent breaks into steps:**
```typescript
[
  { action: 'open', url: 'https://github.com' },
  { action: 'fill', selector: '[aria-label=Search]', value: 'Python' },
  { action: 'click', selector: 'button[type=submit]' },
  { action: 'wait', timeout: 5000 },
  { action: 'snapshot' },
  { action: 'get_text', selector: '.repo-list-item:first-child h3' },
]
```

---

### Pattern 5: Conditional Request

**You say:**
```
If the page loads, take a screenshot
```

**Agent understands condition:**
```typescript
try {
  await execute({ action: 'open', url: 'https://example.com' });
  await execute({ action: 'screenshot' });
} catch (error) {
  console.log('Page failed to load');
}
```

---

## 🔧 HOW IT WORKS

### Step 1: Intent Recognition

**Your input:**
```
Navigate to example.com and get the title
```

**Agent's LLM processes:**
```json
{
  "intent": "navigate_and_extract",
  "entities": {
    "url": "example.com",
    "target": "title"
  },
  "tools_needed": ["agent-browser.automation"],
  "steps": [
    { "action": "open", "url": "https://example.com" },
    { "action": "get_text", "selector": "title" }
  ]
}
```

---

### Step 2: Tool Selection

**Agent checks registry:**
```json
{
  "available_tools": [
    {
      "id": "agent-browser.automation",
      "capabilities": ["navigation", "screenshot", "extraction", "interaction"],
      "matches_intent": true
    }
  ]
}
```

**Selects:** `agent-browser.automation`

---

### Step 3: Parameter Mapping

**Agent maps natural language to schema:**
```typescript
// Your words: "Navigate to example.com"
// Maps to:
{
  action: 'open',
  url: 'https://example.com'
}

// Your words: "get the title"
// Maps to:
{
  action: 'get_text',
  selector: 'title'
}
```

---

### Step 4: Deterministic Execution

**Agent executes with retry/timeout:**
```typescript
const { execute } = useToolWithRetryAndTimeout('agent-browser.automation', 3, 30000);

try {
  // Step 1: Navigate
  await execute({ action: 'open', url: 'https://example.com' });
  
  // Step 2: Extract title
  const result = await execute({ action: 'get_text', selector: 'title' });
  
  // Step 5: Report results
  return {
    success: true,
    data: { title: result.data },
  };
} catch (error) {
  return {
    success: false,
    error: error.message,
  };
}
```

---

### Step 5: Natural Language Response

**Agent converts result to natural language:**
```
✓ Successfully navigated to example.com

The page title is:
"Example Domain"

This is a simple page for demonstration purposes.
```

---

## 📊 COMPLETE EXAMPLE FLOW

### TUI Session

```
You: Go to hacker news and tell me the top story

Agent: I'll navigate to Hacker News and extract the top story for you.

[Agent executes]:
  /tools execute agent-browser.automation '{"action":"open","url":"https://news.ycombinator.com"}'
  /tools execute agent-browser.automation '{"action":"snapshot"}'
  /tools execute agent-browser.automation '{"action":"get_text","selector":".titleline a"}'

Agent: ✓ The top story on Hacker News is:

  "Show HN: I built a tool to automate browser tasks"
  
  Posted by user123 | 234 points | 56 comments
  
  Would you like me to open the article or show you more stories?

You: Show me the top 5 stories

Agent: I'll extract the top 5 stories for you.

[Agent executes]:
  /tools execute agent-browser.automation '{"action":"get_text","selector":".titleline:nth-child(1) a"}'
  /tools execute agent-browser.automation '{"action":"get_text","selector":".titleline:nth-child(2) a"}'
  /tools execute agent-browser.automation '{"action":"get_text","selector":".titleline:nth-child(3) a"}'
  /tools execute agent-browser.automation '{"action":"get_text","selector":".titleline:nth-child(4) a"}'
  /tools execute agent-browser.automation '{"action":"get_text","selector":".titleline:nth-child(5) a"}'

Agent: ✓ Here are the top 5 stories:

  1. Show HN: I built a tool to automate browser tasks
  2. The Future of AI Agents
  3. Why Rust is Taking Over Systems Programming
  4. Building Scalable Web Applications
  5. The Art of Writing Clean Code
  
  Would you like me to open any of these articles?
```

---

## 🎯 SUMMARY

### What You Can Say

| Natural Language | Agent Understands |
|-----------------|-------------------|
| "Open example.com" | `{ action: 'open', url: 'https://example.com' }` |
| "Take a screenshot" | `{ action: 'screenshot' }` |
| "Get the heading text" | `{ action: 'get_text', selector: 'h1' }` |
| "Click the submit button" | `{ action: 'click', selector: 'role=button[name=Submit]' }` |
| "Fill in my email" | `{ action: 'fill', selector: 'label=Email', value: '...' }` |
| "Search for machine learning" | Multi-step: navigate, fill search, submit, extract |

### How Agent Responds

1. **Acknowledges** your request
2. **Executes** with retry/timeout
3. **Reports** results in natural language
4. **Offers** next actions

---

**Generated:** February 26, 2026  
**Status:** ✅ READY FOR NATURAL LANGUAGE USE
