# EXA MCP vs Agent Browser - Tool Comparison

**Understanding the Difference**

**Date:** February 26, 2026

---

## 🎯 KEY DIFFERENCE

| Tool | Purpose | What It Does |
|------|---------|--------------|
| **EXA MCP** | 🔍 **Search** the web | Finds information via search engine API |
| **Agent Browser** | 🖥️ **Control** a browser | Actually navigates, clicks, fills forms, takes screenshots |

---

## 📊 COMPARISON TABLE

| Feature | EXA MCP | Agent Browser |
|---------|---------|---------------|
| **Primary Use** | Search for information | Automate browser interactions |
| **How It Works** | API calls to search engine | Controls actual Chromium browser |
| **Returns** | Search results (links, snippets) | Live browser state, screenshots, extracted data |
| **Speed** | Fast (API response) | Slower (browser navigation) |
| **Use Case** | "Find information about X" | "Do X on a website" |
| **Authentication** | No login needed | Can login to websites |
| **JavaScript** | No execution | Full JS execution |
| **Screenshots** | ❌ No | ✅ Yes |
| **Form Filling** | ❌ No | ✅ Yes |
| **Clicking** | ❌ No | ✅ Yes |
| **Navigation** | ❌ No | ✅ Yes |

---

## 💬 WHEN TO USE EACH

### Use EXA MCP When:

**You want to FIND information:**

```
"Search for the latest AI news"
"Find Python tutorials"
"Look up React documentation"
"Search for machine learning repositories on GitHub"
```

**Example:**
```
You: Search for the best Python web frameworks

EXA MCP: Here are the top results:

1. Django - https://www.djangoproject.com
   "The web framework for perfectionists with deadlines"
   
2. Flask - https://flask.palletsprojects.com
   "A lightweight WSGI web application framework"
   
3. FastAPI - https://fastapi.tiangolo.com
   "Modern, fast web framework for building APIs"
```

---

### Use Agent Browser When:

**You want to DO something on a website:**

```
"Go to github.com and login"
"Fill out this form and submit it"
"Take a screenshot of the homepage"
"Click the download button"
"Extract all the prices from this page"
```

**Example:**
```
You: Go to github.com and find the most starred Python repo

Agent Browser: ✓ Navigating to github.com...
               ✓ Searching for "Python"...
               ✓ Extracting results...
               
               The most starred Python repository is:
               
               public-apis/public-apis
               ⭐ 286k stars
               A collective list of free APIs
               
               Would you like me to open it?
```

---

## 🔍 EXA MCP - SEARCH TOOL

### What It Does

- Searches the web via EXA API
- Returns search results (URLs, titles, snippets)
- Fast, no browser needed
- Good for research and discovery

### Tool ID
```
exa.search
```

### Parameters
```json
{
  "query": "Python web frameworks",
  "num_results": 10,
  "include_domains": ["github.com"],
  "exclude_domains": []
}
```

### Example Usage

**TUI:**
```bash
/tools execute exa.search '{"query":"best Python frameworks","num_results":5}'
```

**Natural Language:**
```
You: Search for Python web frameworks

Agent: I'll search for Python web frameworks using EXA.

[Executes: exa.search]

✓ Search Results:

1. Django - https://www.djangoproject.com
   "The web framework for perfectionists with deadlines"
   
2. Flask - https://flask.palletsprojects.com
   "A lightweight WSGI web application framework"
   
3. FastAPI - https://fastapi.tiangolo.com
   "Modern, fast web framework for building APIs"
```

### When To Use EXA

| Scenario | Use EXA? |
|----------|----------|
| Find information | ✅ Yes |
| Research a topic | ✅ Yes |
| Get links to resources | ✅ Yes |
| Compare products/services | ✅ Yes |
| Login to a website | ❌ No |
| Fill out a form | ❌ No |
| Take a screenshot | ❌ No |
| Click buttons | ❌ No |
| Extract data from specific page | ❌ No |

---

## 🖥️ AGENT BROWSER - AUTOMATION TOOL

### What It Does

- Controls actual Chromium browser
- Navigates to URLs
- Clicks buttons
- Fills forms
- Takes screenshots
- Extracts data from live pages
- Executes JavaScript

### Tool ID
```
agent-browser.automation
```

### Parameters
```json
{
  "action": "open",
  "url": "https://example.com",
  "selector": "@e2",
  "value": "text to fill",
  "path": "/tmp/screenshot.png",
  "timeout": 30000
}
```

### Actions

| Action | Description |
|--------|-------------|
| `open` | Navigate to URL |
| `snapshot` | Get page elements with refs |
| `click` | Click an element |
| `fill` | Fill input field |
| `type` | Type into field |
| `screenshot` | Take screenshot |
| `get_text` | Extract text |
| `get_html` | Extract HTML |
| `get_value` | Get input value |
| `wait` | Wait for element/time |
| `find` | Find elements |
| `close` | Close browser |

### Example Usage

**TUI:**
```bash
/tools execute agent-browser.automation '{"action":"open","url":"https://github.com"}'
/tools execute agent-browser.automation '{"action":"screenshot","path":"/tmp/screen.png"}'
```

**Natural Language:**
```
You: Go to github.com and take a screenshot

Agent: I'll navigate to GitHub and capture a screenshot.

[Executes: agent-browser.automation]
  Step 1: open https://github.com
  Step 2: screenshot /tmp/github-123456.png

✓ Screenshot captured
  Saved to: /tmp/github-123456.png
  
  [Image preview]
```

### When To Use Agent Browser

| Scenario | Use Browser? |
|----------|--------------|
| Find information | ❌ No (use EXA) |
| Research a topic | ❌ No (use EXA) |
| Get links to resources | ❌ No (use EXA) |
| Login to a website | ✅ Yes |
| Fill out a form | ✅ Yes |
| Take a screenshot | ✅ Yes |
| Click buttons | ✅ Yes |
| Extract data from specific page | ✅ Yes |
| Test a web application | ✅ Yes |
| Automate repetitive tasks | ✅ Yes |

---

## 🎯 DECISION TREE

```
Do you want to...

├─ FIND information?
│  └─ Use EXA MCP
│     Example: "Search for Python tutorials"
│
└─ DO something on a website?
   └─ Use Agent Browser
      Example: "Login to GitHub and star a repo"
```

---

## 💡 COMBINED USAGE

You can use **both tools together** for complex tasks:

### Example: Research + Action

**You:**
```
Find the top 3 machine learning repositories on GitHub, 
then star each of them
```

**Agent:**
```
I'll search for ML repos using EXA, then star them using the browser.

Step 1: Search with EXA
[Executes: exa.search]
✓ Found top ML repositories:
  1. tensorflow/tensorflow
  2. pytorch/pytorch
  3. scikit-learn/scikit-learn

Step 2: Login to GitHub with Browser
[Executes: agent-browser.automation]
  - open https://github.com/login
  - fill username
  - fill password
  - click login

Step 3: Star each repository
[Executes: agent-browser.automation]
  - open https://github.com/tensorflow/tensorflow
  - click star button
  
  - open https://github.com/pytorch/pytorch
  - click star button
  
  - open https://github.com/scikit-learn/scikit-learn
  - click star button

✓ All done!
  - Searched: 3 repositories found
  - Logged in: Successfully
  - Starred: 3 repositories
```

---

## 📊 REAL-WORLD SCENARIOS

### Scenario 1: Job Search

**Task:** Find and apply to jobs

| Step | Tool | Action |
|------|------|--------|
| 1. Find job listings | EXA | Search "Python jobs remote" |
| 2. Go to company site | Browser | Navigate to careers page |
| 3. Fill application | Browser | Fill form, upload resume |
| 4. Submit | Browser | Click submit button |

---

### Scenario 2: Price Monitoring

**Task:** Track product prices

| Step | Tool | Action |
|------|------|--------|
| 1. Find products | EXA | Search "best laptop 2026" |
| 2. Check prices | Browser | Navigate to each product page |
| 3. Extract price | Browser | Get text from price element |
| 4. Screenshot | Browser | Capture for records |

---

### Scenario 3: Social Media Management

**Task:** Post updates to multiple platforms

| Step | Tool | Action |
|------|------|--------|
| 1. Find content | EXA | Search for industry news |
| 2. Login to Twitter | Browser | Navigate, authenticate |
| 3. Post tweet | Browser | Fill textarea, click post |
| 4. Login to LinkedIn | Browser | Navigate, authenticate |
| 5. Post update | Browser | Fill form, submit |

---

## 🔧 TOOL REGISTRY ENTRIES

### EXA MCP
```json
{
  "id": "exa.search",
  "title": "EXA Web Search",
  "description": "Search the web using EXA API",
  "kind": "read",
  "safety_level": "safe",
  "entrypoint": "tools/exa/mod.ts",
  "inputs_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "num_results": { "type": "number", "default": 10 }
    }
  }
}
```

### Agent Browser
```json
{
  "id": "agent-browser.automation",
  "title": "Agent Browser Automation",
  "description": "Control a headless browser",
  "kind": "write",
  "safety_level": "caution",
  "entrypoint": "tools/agent-browser/mod.ts",
  "inputs_schema": {
    "type": "object",
    "properties": {
      "action": { 
        "type": "string",
        "enum": ["open", "snapshot", "click", "fill", "screenshot", ...]
      }
    }
  }
}
```

---

## 🎯 SUMMARY

| Aspect | EXA MCP | Agent Browser |
|--------|---------|---------------|
| **Purpose** | Search | Automation |
| **Speed** | Fast | Slower |
| **Complexity** | Simple | Complex |
| **Best For** | Finding info | Doing tasks |
| **Authentication** | Not needed | Supported |
| **JavaScript** | Not executed | Fully executed |
| **Screenshots** | No | Yes |
| **Forms** | No | Yes |
| **Navigation** | No | Yes |

**Rule of thumb:**
- **EXA** = "Find this"
- **Browser** = "Do this"

---

**Generated:** February 26, 2026  
**Status:** ✅ READY FOR REFERENCE
