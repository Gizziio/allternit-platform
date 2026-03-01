# Agent Tool Selection Guide

**How the Agent Knows When to Use EXA vs Browser**

**Date:** February 26, 2026

---

## 🎯 OVERVIEW

The agent uses **intent recognition** to automatically select the right tool. Here's how it works:

```
Your Input → Intent Classification → Tool Selection → Execution
```

---

## 🧠 HOW AGENT DECIDES

### Step 1: Intent Classification

The agent analyzes your request for **keywords and patterns**:

| Intent Keywords | Tool Selected |
|----------------|---------------|
| "search", "find", "look up" | EXA MCP |
| "go to", "navigate", "open" | Agent Browser |
| "screenshot", "capture" | Agent Browser |
| "click", "fill", "submit" | Agent Browser |
| "extract", "get text from" | Agent Browser |
| "login", "sign in" | Agent Browser |

---

### Step 2: Tool Capability Matching

The agent checks each tool's **capabilities**:

```json
// EXA MCP capabilities
{
  "id": "exa.search",
  "capabilities": ["web_search", "information_retrieval"],
  "best_for": ["finding_information", "research"]
}

// Agent Browser capabilities
{
  "id": "agent-browser.automation",
  "capabilities": ["navigation", "interaction", "screenshot", "extraction"],
  "best_for": ["browser_automation", "form_filling", "data_extraction"]
}
```

---

### Step 3: Decision Logic

```typescript
function selectTool(intent: string): string {
  // Search/Find intents → EXA
  if (intent.match(/search|find|look up|research/i)) {
    return 'exa.search';
  }
  
  // Navigation intents → Browser
  if (intent.match(/go to|navigate|open|visit/i)) {
    return 'agent-browser.automation';
  }
  
  // Interaction intents → Browser
  if (intent.match(/click|fill|submit|type|login/i)) {
    return 'agent-browser.automation';
  }
  
  // Extraction from specific page → Browser
  if (intent.match(/from this page|from the site|screenshot/i)) {
    return 'agent-browser.automation';
  }
  
  // Default to EXA for general queries
  return 'exa.search';
}
```

---

## 💬 EXAMPLES

### Example 1: Clear Search Intent

**You:**
```
Search for Python tutorials
```

**Agent thinks:**
```
Intent: "search" → information retrieval
Tool: exa.search (best for finding information)
Parameters: { query: "Python tutorials" }
```

**Agent executes:**
```bash
/tools execute exa.search '{"query":"Python tutorials"}'
```

---

### Example 2: Clear Browser Intent

**You:**
```
Go to github.com and login
```

**Agent thinks:**
```
Intent: "go to" + "login" → browser automation
Tool: agent-browser.automation (can navigate and interact)
Parameters: [
  { action: "open", url: "https://github.com" },
  { action: "fill", selector: "username", value: "..." },
  { action: "fill", selector: "password", value: "..." },
  { action: "click", selector: "login button" }
]
```

**Agent executes:**
```bash
/tools execute agent-browser.automation '{"action":"open","url":"https://github.com"}'
/tools execute agent-browser.automation '{"action":"fill","selector":"#login_field","value":"..."}'
/tools execute agent-browser.automation '{"action":"click","selector":"input[type=submit]"}'
```

---

### Example 3: Ambiguous Request

**You:**
```
Find the best Python framework
```

**Agent thinks:**
```
Intent: "find" → could be search OR extraction

Decision:
- If just finding info → EXA
- If comparing specific pages → Browser

Default: EXA (faster, simpler)
```

**Agent executes:**
```bash
/tools execute exa.search '{"query":"best Python framework 2026"}'
```

**Agent responds:**
```
✓ Search Results:

1. Django - https://www.djangoproject.com
   "The web framework for perfectionists with deadlines"
   
2. Flask - https://flask.palletsprojects.com
   "A lightweight WSGI web application framework"
   
3. FastAPI - https://fastapi.tiangolo.com
   "Modern, fast web framework for building APIs"

Would you like me to visit any of these sites for more details?
```

---

### Example 4: Multi-Step Task (Both Tools)

**You:**
```
Find the top 3 ML repositories on GitHub and star them
```

**Agent thinks:**
```
Intent: "find" + "star them" → search + browser automation

Step 1: Find repos → EXA (fast search)
Step 2: Star them → Browser (requires login + interaction)

This requires BOTH tools!
```

**Agent executes:**
```bash
# Step 1: Search with EXA
/tools execute exa.search '{"query":"top machine learning repositories GitHub","num_results":3}'

# Step 2: Login with Browser
/tools execute agent-browser.automation '{"action":"open","url":"https://github.com/login"}'
/tools execute agent-browser.automation '{"action":"fill","selector":"#login_field","value":"..."}'
/tools execute agent-browser.automation '{"action":"click","selector":"input[type=submit]"}'

# Step 3: Star each repo
/tools execute agent-browser.automation '{"action":"open","url":"https://github.com/tensorflow/tensorflow"}'
/tools execute agent-browser.automation '{"action":"click","selector":"[aria-label="Star"]"}'
# ... repeat for each repo
```

**Agent responds:**
```
✓ Task completed!

Step 1: Found top ML repositories
  1. tensorflow/tensorflow
  2. pytorch/pytorch
  3. scikit-learn/scikit-learn

Step 2: Logged into GitHub

Step 3: Starred all 3 repositories

Would you like me to do anything else?
```

---

## 🎯 DECISION FLOWCHART

```
Your Request
     │
     ↓
┌─────────────────┐
│ Contains:       │
│ "search"        │─────Yes────→ EXA MCP
│ "find"          │
│ "look up"       │
└────────┬────────┘
         │ No
         ↓
┌─────────────────┐
│ Contains:       │
│ "go to"         │─────Yes────→ Agent Browser
│ "navigate"      │
│ "open"          │
└────────┬────────┘
         │ No
         ↓
┌─────────────────┐
│ Contains:       │
│ "click"         │─────Yes────→ Agent Browser
│ "fill"          │
│ "login"         │
└────────┬────────┘
         │ No
         ↓
┌─────────────────┐
│ Contains:       │
│ "screenshot"    │─────Yes────→ Agent Browser
│ "extract"       │
│ "from page"     │
└────────┬────────┘
         │ No
         ↓
┌─────────────────┐
│ General query   │─────Default──→ EXA MCP
└─────────────────┘
```

---

## 🔧 AGENT PROMPT TEMPLATE

The agent uses this system prompt for tool selection:

```markdown
You are an AI assistant with access to these tools:

1. exa.search - Search the web for information
   Use when: User wants to find, search, look up, research
   Example: "Search for Python tutorials"

2. agent-browser.automation - Control a web browser
   Use when: User wants to navigate, click, fill, login, screenshot
   Example: "Go to github.com and login"

TOOL SELECTION RULES:
- If user says "search", "find", "look up" → Use exa.search
- If user says "go to", "navigate", "open" → Use agent-browser.automation
- If user needs to interact (click, fill, login) → Use agent-browser.automation
- If user wants screenshot → Use agent-browser.automation
- For multi-step tasks, use both tools as needed

ALWAYS explain which tool you're using and why.
```

---

## 📊 REAL EXAMPLES

### Example 1: Simple Search

**You:**
```
Look up React documentation
```

**Agent:**
```
I'll search for React documentation using EXA.

[Tool: exa.search]
Query: "React documentation"

✓ Found:

1. React Documentation - https://react.dev
   "The library for web and native user interfaces"
   
2. React GitHub - https://github.com/facebook/react
   "The official React repository"
```

---

### Example 2: Simple Browser

**You:**
```
Navigate to react.dev and show me the homepage
```

**Agent:**
```
I'll navigate to react.dev using the browser.

[Tool: agent-browser.automation]
Action: open
URL: https://react.dev

[Tool: agent-browser.automation]
Action: screenshot

✓ Homepage captured

[Screenshot displayed]
```

---

### Example 3: Complex Multi-Tool

**You:**
```
Find the best laptop under $1000, then add it to my Amazon cart
```

**Agent:**
```
I'll help you find and add a laptop to your Amazon cart.

Step 1: Find laptops using EXA
[Tool: exa.search]
Query: "best laptop under $1000 2026"

✓ Found top recommendations:
  1. Acer Aspire 5 - $549
  2. ASUS VivoBook - $649
  3. Lenovo IdeaPad - $749

Step 2: Navigate to Amazon
[Tool: agent-browser.automation]
Action: open
URL: https://amazon.com

Step 3: Search for the laptop
[Tool: agent-browser.automation]
Action: fill
Selector: search box
Value: "Acer Aspire 5"

Step 4: Add to cart
[Tool: agent-browser.automation]
Action: click
Selector: "Add to Cart" button

✓ Done! Acer Aspire 5 added to your Amazon cart.
```

---

## 🎯 TOOL SELECTION ALGORITHM

Here's the actual decision logic:

```typescript
interface ToolSelection {
  tool: string;
  confidence: number;
  reason: string;
}

function selectTool(userInput: string): ToolSelection {
  const input = userInput.toLowerCase();
  
  // High confidence EXA patterns
  if (input.match(/\b(search|find|look up|research)\b/)) {
    return {
      tool: 'exa.search',
      confidence: 0.95,
      reason: 'Search intent detected'
    };
  }
  
  // High confidence Browser patterns
  if (input.match(/\b(go to|navigate|open|visit)\b.*\.(com|org|io|dev)/)) {
    return {
      tool: 'agent-browser.automation',
      confidence: 0.95,
      reason: 'Navigation intent detected'
    };
  }
  
  // Interaction patterns → Browser
  if (input.match(/\b(click|fill|submit|type|login|sign in)\b/)) {
    return {
      tool: 'agent-browser.automation',
      confidence: 0.90,
      reason: 'Interaction intent detected'
    };
  }
  
  // Screenshot → Browser
  if (input.match(/\b(screenshot|capture|image)\b/)) {
    return {
      tool: 'agent-browser.automation',
      confidence: 0.90,
      reason: 'Screenshot intent detected'
    };
  }
  
  // Extraction from specific page → Browser
  if (input.match(/\b(from this|from the|on this|on the)\b.*page|site/)) {
    return {
      tool: 'agent-browser.automation',
      confidence: 0.85,
      reason: 'Page-specific extraction detected'
    };
  }
  
  // Default to EXA for general queries
  return {
    tool: 'exa.search',
    confidence: 0.60,
    reason: 'General query - defaulting to search'
  };
}
```

---

## 🔄 MULTI-TOOL WORKFLOWS

For complex tasks, the agent chains tools:

### Pattern 1: Search → Act

```
1. EXA: Find information
2. Browser: Act on findings
```

**Example:**
```
You: Find Python jobs and apply to the top 3

Agent:
  1. [EXA] Search "Python developer jobs"
  2. [Browser] Navigate to each job posting
  3. [Browser] Fill application forms
  4. [Browser] Submit applications
```

---

### Pattern 2: Act → Extract

```
1. Browser: Navigate and interact
2. Browser: Extract results
```

**Example:**
```
You: Login to GitHub and get my starred repos

Agent:
  1. [Browser] Navigate to github.com/login
  2. [Browser] Fill credentials
  3. [Browser] Click login
  4. [Browser] Navigate to starred repos
  5. [Browser] Extract repo names
```

---

### Pattern 3: Search → Act → Extract

```
1. EXA: Find target
2. Browser: Navigate and act
3. Browser: Extract confirmation
```

**Example:**
```
You: Find the AWS console and check my EC2 instances

Agent:
  1. [EXA] Search "AWS console login"
  2. [Browser] Navigate to AWS console
  3. [Browser] Login
  4. [Browser] Navigate to EC2
  5. [Browser] Extract instance list
```

---

## 📋 SUMMARY

| Question | Answer |
|----------|--------|
| **How does agent know?** | Keyword matching + intent classification |
| **When EXA?** | "search", "find", "look up", "research" |
| **When Browser?** | "go to", "navigate", "click", "fill", "login", "screenshot" |
| **Can it use both?** | Yes! For multi-step tasks |
| **What if ambiguous?** | Defaults to EXA (faster, simpler) |
| **Can I override?** | Yes, specify tool explicitly |

---

## 🎯 EXPLICIT TOOL SELECTION

If you want to **force** a specific tool:

**TUI:**
```bash
# Force EXA
/tools execute exa.search '{"query":"Python tutorials"}'

# Force Browser
/tools execute agent-browser.automation '{"action":"open","url":"https://python.org"}'
```

**Natural Language:**
```
Use EXA to search for Python tutorials

Use the browser to go to python.org
```

---

**Generated:** February 26, 2026  
**Status:** ✅ READY FOR REFERENCE
