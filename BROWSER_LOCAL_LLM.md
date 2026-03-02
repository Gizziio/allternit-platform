# Browser-Local LLM: Zero-Server Demo Mode

## The Vision

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BROWSER-LOCAL DEMO ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER'S BROWSER (Zero Setup Required)                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │  Small LLM   │  │  SQLite.js   │  │  In-Memory   │                │ │
│  │  │  (WebGPU)    │  │  (OPFS)      │  │  Vector DB   │                │ │
│  │  │              │  │              │  │              │                │ │
│  │  │  ~500MB      │  │  Persistent  │  │  Embeddings  │                │ │
│  │  │  4-bit quant │  │  Storage     │  │  Storage     │                │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │ │
│  │         │                 │                 │                         │ │
│  │         └─────────────────┴─────────────────┘                         │ │
│  │                           │                                           │ │
│  │                    ┌──────▼──────┐                                    │ │
│  │                    │  A2R Agent  │                                    │ │
│  │                    │  Engine     │                                    │ │
│  │                    │             │                                    │ │
│  │                    │  ├─ Intent  │                                    │ │
│  │                    │  ├─ Memory  │                                    │ │
│  │                    │  ├─ Tools   │                                    │ │
│  │                    │  └─ Browser │                                    │ │
│  │                    └─────────────┘                                    │ │
│  │                           │                                           │ │
│  │                    ┌──────▼──────┐                                    │ │
│  │                    │   React UI  │                                    │ │
│  │                    │   (Chat)    │                                    │ │
│  │                    └─────────────┘                                    │ │
│  │                                                                       │ │
│  │  COMPUTE: User's GPU (WebGPU/WebGL) + CPU                             │ │
│  │  STORAGE: Browser Origin Private File System (OPFS)                   │ │
│  │  NETWORK: Only for model download (once)                              │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              │                                              │
│                              │ "Upgrade for full power"                    │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    CLOUD VPS (Optional)                               │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │  Full LLM    │  │  Chrome      │  │  Persistent  │                │ │
│  │  │  (7B params) │  │  Streaming   │  │  Postgres    │                │ │
│  │  │  GPU-accel   │  │  WebRTC      │  │  Long-term   │                │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  TIME TO FIRST MESSAGE: 5 seconds (after model download)                   │
│  USER EFFORT: Zero - Just open the website                                  │
│  PRIVACY: 100% - Nothing leaves their browser                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **LLM Inference** | WebLLM + WebGPU | Run models in browser |
| **Model Format** | GGUF 4-bit quantized | Small size, fast inference |
| **Storage** | Origin Private File System (OPFS) | Persistent chat history |
| **Vector DB** | MLCEngine or in-memory | Embeddings for RAG |
| **Agent Engine** | TypeScript port of Rust logic | Intent parsing, tool selection |
| **UI** | React + Tailwind | Chat interface |

---

## Implementation

### 1. Install WebLLM

```bash
cd 7-apps/shell/web
pnpm add @mlc-ai/web-llm
```

### 2. Create BrowserLLM Service

```typescript
// src/services/browserLLM.ts
import * as webllm from "@mlc-ai/web-llm";

export interface BrowserModel {
  id: string;
  name: string;
  size: string; // "500MB"
  quant: string; // "Q4_K_M"
  contextLength: number;
  capabilities: string[];
}

// Available small models for browser
export const AVAILABLE_MODELS: BrowserModel[] = [
  {
    id: "lfm-2-7b-q4f32_1",
    name: "Liquid LFM 2 7B",
    size: "4.1GB",
    quant: "Q4",
    contextLength: 4096,
    capabilities: ["chat", "reasoning", "tools"]
  },
  {
    id: "gemma-2b-it-q4f32_1",
    name: "Google Gemma 2B",
    size: "1.6GB",
    quant: "Q4",
    contextLength: 8192,
    capabilities: ["chat", "summarization"]
  },
  {
    id: "phi-2-q4f32_1",
    name: "Microsoft Phi-2",
    size: "1.6GB",
    quant: "Q4",
    contextLength: 2048,
    capabilities: ["chat", "code"]
  },
  {
    id: "tinyllama-1.1b-chat-v1.0-q4f32_1",
    name: "TinyLlama 1.1B",
    size: "600MB",
    quant: "Q4",
    contextLength: 2048,
    capabilities: ["chat"]
  },
  {
    id: "stablelm-2-zephyr-1.6b-q4f32_1",
    name: "StableLM Zephyr 1.6B",
    size: "900MB",
    quant: "Q4",
    contextLength: 4096,
    capabilities: ["chat", "instruction"]
  }
];

export class BrowserLLMService {
  private engine: webllm.MLCEngine | null = null;
  private currentModel: string | null = null;
  private chatHistory: webllm.ChatCompletionMessageParam[] = [];
  
  async init(modelId: string, onProgress?: (progress: webllm.InitProgressReport) => void): Promise<void> {
    // Check WebGPU support
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported. Use Chrome/Edge 113+");
    }
    
    // Initialize MLCEngine
    this.engine = await webllm.CreateMLCEngine(
      modelId,
      {
        initProgressCallback: onProgress,
        // Use Origin Private File System for caching
        appConfig: {
          useIndexedDBCache: true,
        }
      }
    );
    
    this.currentModel = modelId;
    
    // Load previous chat history from OPFS
    await this.loadChatHistory();
  }
  
  async sendMessage(message: string, tools?: webllm.ChatCompletionTool[]): Promise<{
    content: string;
    toolCalls?: webllm.ChatCompletionToolCall[];
  }> {
    if (!this.engine) {
      throw new Error("LLM not initialized");
    }
    
    // Add user message to history
    this.chatHistory.push({ role: "user", content: message });
    
    // Create completion
    const response = await this.engine.chat.completions.create({
      messages: this.chatHistory,
      tools,
      temperature: 0.7,
      max_tokens: 1024,
    });
    
    const assistantMessage = response.choices[0].message;
    
    // Add to history
    this.chatHistory.push(assistantMessage);
    
    // Persist to OPFS
    await this.saveChatHistory();
    
    return {
      content: assistantMessage.content || "",
      toolCalls: assistantMessage.tool_calls,
    };
  }
  
  async streamMessage(
    message: string,
    onChunk: (chunk: string) => void,
    tools?: webllm.ChatCompletionTool[]
  ): Promise<void> {
    if (!this.engine) {
      throw new Error("LLM not initialized");
    }
    
    this.chatHistory.push({ role: "user", content: message });
    
    const stream = await this.engine.chat.completions.create({
      messages: this.chatHistory,
      tools,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    });
    
    let fullContent = "";
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullContent += content;
      onChunk(content);
    }
    
    this.chatHistory.push({ role: "assistant", content: fullContent });
    await this.saveChatHistory();
  }
  
  private async saveChatHistory(): Promise<void> {
    // Save to Origin Private File System
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle("chat-history.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(this.chatHistory));
    await writable.close();
  }
  
  private async loadChatHistory(): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle("chat-history.json");
      const file = await fileHandle.getFile();
      const content = await file.text();
      this.chatHistory = JSON.parse(content);
    } catch {
      // No history yet
      this.chatHistory = [];
    }
  }
  
  getStats(): {
    gpu: string;
    memory: string;
    contextTokens: number;
  } {
    // Get WebGPU stats
    // This would need custom implementation based on engine internals
    return {
      gpu: "WebGPU",
      memory: "Unknown",
      contextTokens: this.chatHistory.reduce((acc, msg) => 
        acc + (msg.content?.length || 0), 0
      ),
    };
  }
  
  unload(): void {
    this.engine?.unload();
    this.engine = null;
    this.currentModel = null;
  }
}

// Singleton instance
export const browserLLM = new BrowserLLMService();
```

### 3. Create Demo Chat Component

```typescript
// src/components/BrowserChat.tsx
import { useState, useEffect, useRef } from 'react';
import { browserLLM, AVAILABLE_MODELS, BrowserModel } from '../services/browserLLM';

export function BrowserChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [selectedModel, setSelectedModel] = useState<BrowserModel>(AVAILABLE_MODELS[0]);
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize model on mount
  useEffect(() => {
    initModel();
  }, []);
  
  const initModel = async () => {
    setIsLoading(true);
    try {
      await browserLLM.init(selectedModel.id, (progress) => {
        const percent = Math.round(
          (progress.progress / progress.total) * 100
        );
        setDownloadProgress(percent);
      });
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to init model:", error);
      setIsLoading(false);
    }
  };
  
  const sendMessage = async () => {
    if (!input.trim() || isGenerating) return;
    
    const userMessage = input;
    setInput('');
    setIsGenerating(true);
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Create placeholder for assistant
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    
    // Stream response
    let responseText = '';
    await browserLLM.streamMessage(userMessage, (chunk) => {
      responseText += chunk;
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: 'assistant',
          content: responseText
        };
        return newMessages;
      });
    });
    
    setIsGenerating(false);
  };
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="text-6xl mb-4">📦</div>
        <h3 className="text-xl font-semibold mb-2">Downloading AI Model</h3>
        <p className="text-gray-400 mb-4">{selectedModel.name} ({selectedModel.size})</p>
        <div className="w-64 bg-slate-700 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 mt-2">{downloadProgress}% complete</p>
        <p className="text-xs text-gray-500 mt-4">
          This is a one-time download. The model is cached for future visits.
        </p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Model Selector */}
      <div className="flex items-center gap-4 p-4 border-b border-slate-700">
        <span className="text-sm text-gray-400">Model:</span>
        <select 
          value={selectedModel.id}
          onChange={(e) => {
            const model = AVAILABLE_MODELS.find(m => m.id === e.target.value);
            if (model) {
              setSelectedModel(model);
              browserLLM.unload();
              initModel();
            }
          }}
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1"
        >
          {AVAILABLE_MODELS.map(model => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.size})
            </option>
          ))}
        </select>
        
        <div className="flex-1" />
        
        <span className="text-xs text-green-400 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Running locally in your browser
        </span>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">👋</div>
            <p className="text-lg mb-2">Welcome to A2rchitect Browser Demo!</p>
            <p className="text-sm">
              This AI runs entirely in your browser using WebGPU.<br />
              No data leaves your device.
            </p>
            <div className="mt-6 flex gap-2 justify-center">
              <button 
                onClick={() => setInput("What can you help me with?")}
                className="px-4 py-2 bg-slate-800 rounded-lg text-sm hover:bg-slate-700"
              >
                What can you do?
              </button>
              <button 
                onClick={() => setInput("Help me write a Python script")}
                className="px-4 py-2 bg-slate-800 rounded-lg text-sm hover:bg-slate-700"
              >
                Write Python code
              </button>
            </div>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-3 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-800 text-gray-200'
            }`}>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            disabled={isGenerating}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={isGenerating || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded-lg font-semibold"
          >
            {isGenerating ? '...' : 'Send'}
          </button>
        </div>
        
        {/* Upgrade CTA */}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>Powered by {selectedModel.name}</span>
          <span>
            Want more power?{' '}
            <button 
              onClick={() => window.location.href = '/deploy'}
              className="text-blue-400 hover:underline"
            >
              Connect a VPS for full features →
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
```

### 4. Create Agent Tools (Browser-Local)

```typescript
// src/services/browserTools.ts
// Tools that work entirely in browser (no server needed)

export interface BrowserTool {
  name: string;
  description: string;
  parameters: object;
  execute: (args: any) => Promise<any>;
}

export const BROWSER_TOOLS: BrowserTool[] = [
  {
    name: "search_memory",
    description: "Search through previous conversations",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" }
      },
      required: ["query"]
    },
    execute: async ({ query }) => {
      // Search in local chat history
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle("chat-history.json");
      const file = await fileHandle.getFile();
      const history = JSON.parse(await file.text());
      
      // Simple fuzzy search
      const results = history.filter((msg: any) => 
        msg.content?.toLowerCase().includes(query.toLowerCase())
      );
      
      return { results: results.slice(-5) };
    }
  },
  {
    name: "save_note",
    description: "Save a note to local storage",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" }
      },
      required: ["title", "content"]
    },
    execute: async ({ title, content }) => {
      const root = await navigator.storage.getDirectory();
      const notesDir = await root.getDirectoryHandle("notes", { create: true });
      const fileHandle = await notesDir.getFileHandle(
        `${Date.now()}-${title}.txt`, 
        { create: true }
      );
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return { success: true };
    }
  },
  {
    name: "calculate",
    description: "Perform calculations",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Math expression" }
      },
      required: ["expression"]
    },
    execute: async ({ expression }) => {
      // Safe eval or math library
      try {
        const result = Function('"use strict"; return (' + expression + ')')();
        return { result };
      } catch (e) {
        return { error: "Invalid expression" };
      }
    }
  },
  {
    name: "current_time",
    description: "Get current date and time",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      return { 
        datetime: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    }
  }
];
```

### 5. Dashboard Integration

```typescript
// src/pages/Dashboard.tsx
export function Dashboard() {
  const [mode, setMode] = useState<'browser' | 'vps'>('browser');
  const { connections } = useVpsConnections();
  
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">A2rchitect</h1>
            
            {/* Mode Switcher */}
            <div className="flex bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setMode('browser')}
                className={`px-4 py-1.5 rounded-md text-sm ${
                  mode === 'browser' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                🌐 Browser Mode
              </button>
              <button
                onClick={() => setMode('vps')}
                className={`px-4 py-1.5 rounded-md text-sm ${
                  mode === 'vps' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                🖥️ VPS Mode
              </button>
            </div>
          </div>
          
          <UserButton />
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-6 py-6 h-[calc(100vh-80px)]">
        {mode === 'browser' ? (
          <div className="h-full">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Browser Demo Mode</h2>
                <p className="text-sm text-gray-400">
                  AI runs locally in your browser. No server needed.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-400">✓ Private</p>
                <p className="text-xs text-green-400">✓ Free</p>
                <p className="text-xs text-gray-400">Limited features</p>
              </div>
            </div>
            
            <div className="h-[calc(100%-80px)] bg-slate-800 rounded-xl overflow-hidden">
              <BrowserChat />
            </div>
          </div>
        ) : (
          <VpsDashboard connections={connections} />
        )}
      </main>
    </div>
  );
}
```

---

## Model Selection Guide

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **TinyLlama 1.1B** | 600MB | ⚡⚡⚡ Fast | ⭐⭐ OK | Quick tests, mobile |
| **Phi-2 2.7B** | 1.6GB | ⚡⚡ Fast | ⭐⭐⭐ Good | Code, reasoning |
| **Gemma 2B** | 1.6GB | ⚡⚡ Fast | ⭐⭐⭐ Good | General chat |
| **StableLM Zephyr 1.6B** | 900MB | ⚡⚡ Fast | ⭐⭐⭐ Good | Instructions |
| **LFM 2 7B** | 4GB | ⚡ Medium | ⭐⭐⭐⭐ Great | Best quality, slower |

---

## Progressive Enhancement

```
┌─────────────────────────────────────────────────────────────────┐
│                 FEATURE COMPARISON                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Feature              │ Browser Mode      │ VPS Mode            │
│  ─────────────────────┼───────────────────┼─────────────────────│
│  AI Chat              │ ✅ Local LLM      │ ✅ Full LLM (70B)   │
│  Memory/Persistence   │ ✅ OPFS storage   │ ✅ SQLite/Postgres  │
│  Code Execution       │ ✅ JavaScript     │ ✅ Python/Any       │
│  Browser Automation   │ ❌ Not available  │ ✅ Real Chrome      │
│  WebRTC Streaming     │ ❌ Not available  │ ✅ Full desktop     │
│  Agent Workflows      │ ⚠️ Basic          │ ✅ Full             │
│  Multi-user           │ ❌ Single user    │ ✅ Teams            │
│  API Access           │ ❌ Browser only   │ ✅ REST/WebSocket   │
│  Cost to You          │ ✅ $0             │ ❌ $0 (they pay)    │
│  Setup Time           │ ✅ 0 seconds      │ ⚠️ 2-10 minutes     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Requirements

### Browser Support
- **Chrome/Edge 113+** (WebGPU required)
- **Firefox** (coming soon)
- **Safari** (not yet supported)

### Hardware Requirements
- **GPU**: Any GPU with WebGPU support (Intel Iris, AMD, NVIDIA)
- **RAM**: 8GB+ recommended (for larger models)
- **Storage**: 1-5GB for model cache

---

## Advantages

1. **Zero Setup** - User just opens website
2. **100% Privacy** - Nothing leaves their browser
3. **Zero Cost to You** - No server resources
4. **Fast Iteration** - Users can try immediately
5. **Progressive** - Natural upgrade path to VPS
6. **Offline Capable** - Works without internet after model download

---

## Next Steps

1. **Install WebLLM**: `pnpm add @mlc-ai/web-llm`
2. **Create BrowserLLM service**: Handle model loading, chat, storage
3. **Build BrowserChat component**: UI for browser-based chat
4. **Add to Dashboard**: Mode switcher (Browser vs VPS)
5. **Test models**: Try different sizes, find best balance
6. **Add upgrade CTAs**: "Want Chrome automation? Deploy a VPS →"

This gives users **immediate value** while keeping **your costs at zero** and maintaining a **clear upgrade path** to full VPS features!
