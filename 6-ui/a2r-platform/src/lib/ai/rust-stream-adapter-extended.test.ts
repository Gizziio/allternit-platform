import { describe, it, expect } from "vitest";
import { parseStructuredContent } from "./rust-stream-adapter-extended";

describe("Extended Structured Content Parsing", () => {
  it("should parse an open thinking tag during streaming", () => {
    const input = "Hello! <thinking>I am currently processing the request";
    const parts = parseStructuredContent(input);
    
    expect(parts.some(p => p.type === 'reasoning')).toBe(true);
    const reasoningPart = parts.find(p => p.type === 'reasoning') as any;
    expect(reasoningPart.content).toBe("I am currently processing the request");
  });

  it("should parse an open code block during streaming", () => {
    const input = "Here is some code:\n```python\nprint('hello world')";
    const parts = parseStructuredContent(input);
    
    expect(parts.some(p => p.type === 'code')).toBe(true);
    const codePart = parts.find(p => p.type === 'code') as any;
    expect(codePart.language).toBe("python");
    expect(codePart.code).toBe("print('hello world')");
  });

  it("should parse multiple structured elements accurately", () => {
    const input = "Starting...\n<thinking>Plan established</thinking>\nNow code:\n```javascript\nconst x = 1;```\nDone.";
    const parts = parseStructuredContent(input);
    
    expect(parts.length).toBe(5); // text, reasoning, text, code, text
    expect(parts[1].type).toBe('reasoning');
    expect(parts[3].type).toBe('code');
    expect((parts[1] as any).content).toBe("Plan established");
    expect((parts[3] as any).code).toBe("const x = 1;");
  });

  it("should handle mixed text and open tags", () => {
    const input = "The answer is:\n```typescript\ninterface User {\n  id: string;";
    const parts = parseStructuredContent(input);
    
    expect(parts[0].type).toBe('text');
    expect(parts[1].type).toBe('code');
    expect((parts[1] as any).language).toBe("typescript");
    expect((parts[1] as any).code).toContain("id: string;");
  });
});
