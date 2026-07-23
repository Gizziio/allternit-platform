# Agent Browser Tool

**Browser automation for AI agents via [agent-browser](https://github.com/vercel-labs/agent-browser)**

---

## 📋 Overview

This tool provides headless browser control optimized for AI agents, featuring:

- **Snapshot-based interaction** - Deterministic element refs (`@e1`, `@e2`)
- **Semantic locators** - Find by role, label, text, placeholder
- **Annotated screenshots** - Visual overlays with numbered labels
- **Session management** - Persistent profiles with encrypted state
- **Security features** - Domain allowlists, action policies

---

## 🚀 Quick Start

### 1. Install agent-browser

```bash
# Global install
npm install -g agent-browser

# Download Chromium (first time only)
agent-browser install

# Verify installation
agent-browser --version
```

### 2. Use the Tool

```typescript
import { execute } from "tools/agent-browser/mod.ts";

// Open a website
const result = await execute({
  action: "open",
  url: "https://example.com"
});

// Get snapshot with element refs
const snapshot = await execute({ action: "snapshot" });
console.log(snapshot.snapshot?.elements);
// [{ ref: "@e1", role: "button", text: "Click me" }, ...]

// Click element
await execute({ action: "click", selector: "@e2" });

// Take screenshot
const screenshot = await execute({
  action: "screenshot",
  path: "/tmp/screenshot.png"
});
console.log(screenshot.screenshot); // Base64 image
```

---

## 📖 API Reference

### Actions

| Action | Description | Required Params | Optional Params |
|--------|-------------|-----------------|-----------------|
| `open` | Navigate to URL | `url` | - |
| `snapshot` | Get accessibility tree with refs | - | - |
| `click` | Click element | `selector` | - |
| `fill` | Fill input field | `selector`, `value` | - |
| `type` | Type into input | `selector`, `value` | - |
| `screenshot` | Take screenshot | - | `path` |
| `get_text` | Extract text | `selector` | - |
| `get_html` | Extract HTML | `selector` | - |
| `get_value` | Get input value | `selector` | - |
| `wait` | Wait for element/time | `timeout` or `selector` | - |
| `find` | Find elements | `selector` | - |
| `close` | Close browser | - | - |

### Parameters

```typescript
interface Input {
  action: "open" | "snapshot" | "click" | "fill" | "type" | "screenshot" | "get_text" | "get_html" | "get_value" | "wait" | "find" | "close";
  url?: string;              // URL for 'open' action
  selector?: string;         // Element selector (@e2, button, #id, role=button)
  value?: string;            // Value for fill/type
  path?: string;             // Screenshot file path
  timeout?: number;          // Timeout in ms (0-60000)
  session_id?: string;       // Session ID for persistence
  profile?: string;          // Profile path for cookies/login
  json?: boolean;            // JSON output (default: true)
}
```

### Output

```typescript
interface Output {
  success: boolean;
  data?: any;                // Extracted text/HTML/values
  error?: string;            // Error message if failed
  screenshot?: string;       // Base64 screenshot
  snapshot?: {               // Accessibility tree
    elements: Array<{
      ref: string;           // "@e1", "@e2", etc.
      role: string;          // "button", "link", etc.
      text?: string;
      label?: string;
    }>
  };
  execution_time_ms?: number;
}
```

---

## 💡 Usage Examples

### Basic Navigation

```typescript
// Open website
await execute({ action: "open", url: "https://example.com" });

// Get interactive snapshot
const { snapshot } = await execute({ action: "snapshot" });
console.log("Available elements:");
snapshot?.elements.forEach(el => {
  console.log(`  ${el.ref} - ${el.role}: ${el.text}`);
});

// Interact using refs
await execute({ action: "click", selector: "@e2" });
await execute({ action: "fill", selector: "@e3", value: "test@example.com" });
```

### Data Extraction

```typescript
// Extract text
const { data: text } = await execute({
  action: "get_text",
  selector: "h1.title"
});

// Extract HTML
const { data: html } = await execute({
  action: "get_html",
  selector: "#content"
});

// Extract input value
const { data: value } = await execute({
  action: "get_value",
  selector: "#email"
});
```

### Screenshots

```typescript
// Take screenshot
const { screenshot } = await execute({
  action: "screenshot",
  path: "/tmp/page.png"
});

// Save base64 to file
import { writeFileSync } from "fs";
writeFileSync("/tmp/page.png", Buffer.from(screenshot!, "base64"));
```

### Session Management

```typescript
// Persistent session (cookies saved)
await execute({
  action: "open",
  url: "https://myapp.com",
  profile: "~/.myapp-profile"
});

// Isolated session
await execute({
  action: "open",
  url: "https://example.com",
  session_id: "agent1"
});

// Reuse session
await execute({
  action: "click",
  selector: "@e5",
  session_id: "agent1"
});
```

### Wait & Find

```typescript
// Wait for element
await execute({
  action: "wait",
  selector: "#loading"
});

// Wait for time
await execute({
  action: "wait",
  timeout: 5000
});

// Find elements by role
const { snapshot } = await execute({
  action: "find",
  selector: "role=button"
});
```

---

## 🔒 Security

### Domain Allowlist

Configure allowed domains in tool preconditions:

```json
{
  "tool_id": "agent-browser.automation",
  "domain_allowlist": ["example.com", "myapp.com"]
}
```

### Action Policies

Gate destructive actions:

```json
{
  "tool_id": "agent-browser.automation",
  "require_approval_for": ["fill", "click"],
  "blocked_domains": ["admin.example.com"]
}
```

### Session Isolation

Always use sessions for untrusted code:

```typescript
await execute({
  action: "open",
  url: "https://example.com",
  session_id: `untrusted-${Date.now()}`
});
```

---

## 🎯 Element Selectors

### Deterministic Refs (Recommended)

```typescript
// After snapshot, use refs like @e1, @e2
await execute({ action: "click", selector: "@e2" });
await execute({ action: "fill", selector: "@e5", value: "text" });
```

### Semantic Locators

```typescript
// By role
await execute({ action: "click", selector: "role=button" });
await execute({ action: "click", selector: "role=link[name='Home']" });

// By label
await execute({ action: "fill", selector: "label=Email", value: "test@example.com" });

// By text
await execute({ action: "click", selector: "text='Submit'" });

// By placeholder
await execute({ action: "fill", selector: "placeholder=Enter email", value: "test@example.com" });

// By alt text
await execute({ action: "click", selector: "alt='Logo'" });
```

### Traditional Selectors

```typescript
// CSS selectors
await execute({ action: "click", selector: "button.submit" });
await execute({ action: "click", selector: "#login-btn" });
await execute({ action: "click", selector: ".nav > a:first-child" });

// XPath (limited support)
await execute({ action: "click", selector: "//button[@type='submit']" });
```

---

## 🐛 Troubleshooting

### "agent-browser: command not found"

```bash
# Install globally
npm install -g agent-browser

# Or use npx
npx agent-browser --version
```

### "Chromium not found"

```bash
# Download Chromium
agent-browser install
```

### "Element not found"

1. Take a snapshot first to get current refs
2. Use semantic locators instead of brittle selectors
3. Wait for element to appear: `action: "wait", selector: "@e5"`

### "Screenshot not saved"

- Ensure directory exists
- Check file permissions
- Use absolute paths

---

## 📚 Resources

- **Official Docs:** https://agent-browser.dev
- **GitHub:** https://github.com/vercel-labs/agent-browser
- **Playwright Docs:** https://playwright.dev

---

## 📝 License

Apache-2.0 (same as agent-browser)
