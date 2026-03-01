
import { parseStructuredContent } from './src/lib/ai/rust-stream-adapter-extended';

const testStreamingContent = () => {
  console.log("Testing Partial Content Parsing...");

  // Test 1: Open Thinking Tag
  const thinkingInput = "Hello! <thinking>I am currently processing the request";
  const thinkingParts = parseStructuredContent(thinkingInput);
  console.log("
Test 1 (Open Thinking):", thinkingParts.some(p => p.type === 'reasoning') ? "PASSED ✅" : "FAILED ❌");
  
  // Test 2: Open Code Block
  const codeInput = "Here is some code:
```python
print('hello world')";
  const codeParts = parseStructuredContent(codeInput);
  console.log("Test 2 (Open Code Block):", codeParts.some(p => p.type === 'code') ? "PASSED ✅" : "FAILED ❌");

  // Test 3: Mixed Content
  const mixedInput = "Starting...
<thinking>Plan established</thinking>
Now code:
```javascript
const x = 1;";
  const mixedParts = parseStructuredContent(mixedInput);
  console.log("Test 3 (Mixed Structured):", mixedParts.length >= 3 ? "PASSED ✅" : "FAILED ❌");
};

testStreamingContent();
