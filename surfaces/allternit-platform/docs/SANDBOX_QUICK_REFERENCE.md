# Sandbox Quick Reference

## One-Liners

```typescript
// Execute code (auto-selects best sandbox)
const result = await executeSmart({ code, requestId });

// Check what's available
const status = await getSandboxStatus();

// Pre-warm for faster response
await warmupSandboxes();
```

## Sandbox Selection Guide

### When to Use Each Sandbox

| Your Code Needs | Recommended Sandbox | Why |
|-----------------|---------------------|-----|
| `numpy`, `pandas`, simple math | **WASM** | Instant startup |
| `requests`, web scraping | **Docker** | Network access |
| `tensorflow`, `torch` | **Docker** | Large packages |
| `apt-get install` | **WebVM** | Package manager |
| JavaScript/Node.js | **WebVM** | Language support |
| Bash scripts | **WebVM** | Shell access |
| Quick data viz | **WASM** | Fastest |
| Production ML | **Docker** | Reliable |

## Common Patterns

### Data Analysis

```typescript
const result = await executeSmart({
  code: `
import pandas as pd
import numpy as np

df = pd.DataFrame({
    'A': np.random.randn(100),
    'B': np.random.randn(100)
})

print(df.describe())
print(f"Correlation: {df['A'].corr(df['B'])}")
  `,
  requestId: "data-analysis-123"
});
// Routes to: WASM (fastest)
```

### Web Scraping

```typescript
const result = await executeSmart({
  code: `
import requests
from bs4 import BeautifulSoup

url = "https://example.com"
response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')

print(f"Title: {soup.title.string}")
print(f"Links: {len(soup.find_all('a'))}")
  `,
  requestId: "scraping-123"
});
// Routes to: Docker (network access required)
```

### Machine Learning

```typescript
const result = await executeSmart({
  code: `
!pip install -q scikit-learn

from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target, test_size=0.2
)

model = RandomForestClassifier()
model.fit(X_train, y_train)
accuracy = model.score(X_test, y_test)
print(f"Accuracy: {accuracy:.2f}")
  `,
  requestId: "ml-123"
});
// Routes to: Docker (scikit-learn + pip install)
```

### Visualization

```typescript
const result = await executeSmart({
  code: `
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.figure(figsize=(8, 4))
plt.plot(x, y, label='sin(x)')
plt.title('Sine Wave')
plt.legend()
plt.savefig('chart.png')
print("Chart generated!")
  `,
  requestId: "viz-123"
});
// Routes to: WASM (matplotlib supported)
// Returns: result.chart (base64 PNG)
```

### System Commands

```typescript
const result = await executeSmart({
  code: `
apt-get update
apt-get install -y nodejs npm
node --version
npm --version
  `,
  language: "bash",
  requestId: "system-123"
});
// Routes to: WebVM (apt-get requires full Linux)
```

### JavaScript Execution

```typescript
const result = await executeSmart({
  code: `
const data = [1, 2, 3, 4, 5];
const sum = data.reduce((a, b) => a + b, 0);
const avg = sum / data.length;

console.log({ sum, avg });
  `,
  language: "javascript",
  requestId: "js-123"
});
// Routes to: WebVM (JavaScript support)
```

## Configuration

### Environment Variables

```bash
# .env file
WEBVM_URL=http://localhost:8002
```

### Feature Flags

```typescript
// src/lib/config.ts
{
  integrations: {
    sandbox: true,  // Enable Docker sandbox
  },
  enableCodeExecution: true,
}
```

## Error Handling

```typescript
try {
  const result = await executeSmart({ code, requestId });
  
  if (!result.success) {
    console.error("Execution failed:", result.error);
    return;
  }
  
  console.log("Output:", result.output);
  console.log("Method:", result.method);  // Which sandbox was used
  console.log("Duration:", result.duration);
  
} catch (error) {
  console.error("Sandbox error:", error);
}
```

## Testing Sandboxes

```typescript
// Check if specific sandbox is available
const status = await getSandboxStatus();

if (status.wasm.available) {
  // Fast data analysis
}

if (status.docker.available) {
  // Complex Python packages
}

if (status.webvm.available) {
  // Multi-language support
}
```

## Troubleshooting

### Code Always Uses Docker

**Cause:** Package not in WASM whitelist  
**Fix:** Check if package is pure Python

```typescript
// Check what the analyzer detected
const method = determineExecutionMethod(code);
console.log(method); // "wasm" | "docker" | "webvm"
```

### Slow Startup

**Cause:** Cold Docker containers  
**Fix:** Pre-warm the pool

```typescript
// At app startup
await warmupSandboxes();
```

### Out of Memory

**Cause:** Large datasets  
**Fix:** Reduce data or use streaming

```typescript
// Process in chunks
const code = `
import pandas as pd

# Read in chunks
chunks = pd.read_csv('large_file.csv', chunksize=1000)
for chunk in chunks:
    process(chunk)
`;
```

### Import Errors

**Cause:** Package not installed  
**Fix:** Use !pip install

```typescript
const code = `
!pip install -q missing_package
import missing_package
# ...
`;
```

## File Structure

```
src/lib/sandbox/
├── README.md                    # Full documentation
├── smart-sandbox.ts             # Main entry point
├── smart-sandbox.test.ts        # 32 test cases
├── wasm-sandbox.ts              # WebAssembly Python
├── docker-sandbox.ts            # Docker containers
├── sandbox-pool.ts              # Warm container pool
└── webvm-connector.ts           # WebVM integration
```

## Quick Commands

```bash
# Run tests
pnpm vitest run src/lib/sandbox/smart-sandbox.test.ts

# Check types
pnpm run typecheck

# Warm sandboxes manually
curl -X POST http://localhost:3000/api/warmup
```
