"use client";

/**
 * LIVE MCP App Demo - Real Rendering in Platform UI
 * 
 * This page demonstrates a REAL MCP app rendering in the A2r platform's
 * actual chat interface.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { UnifiedMessageRenderer } from "@/components/ai-elements/UnifiedMessageRenderer";
import { McpAppHostProvider } from "@/lib/ai/mcp/app-context";
import type { ExtendedUIPart } from "@/lib/ai/rust-stream-adapter-extended";
import type { McpAppUIPart } from "@/lib/ai/rust-stream-adapter";
import { ArrowLeft, Play } from "@phosphor-icons/react";
import Link from "next/link";

// Pre-generated interactive counter app HTML (from our fixture server)
const COUNTER_APP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Counter</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      padding: 20px;
    }
    .counter-card {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 24px;
      padding: 40px;
      text-align: center;
      min-width: 280px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    h1 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(255,255,255,0.5);
      margin-bottom: 24px;
    }
    .count {
      font-size: 96px;
      font-weight: 200;
      line-height: 1;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #d4b08c 0%, #f7d9ba 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .label {
      font-size: 14px;
      color: rgba(255,255,255,0.4);
      margin-bottom: 32px;
    }
    .controls {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 24px;
    }
    button {
      width: 56px;
      height: 56px;
      border: none;
      border-radius: 16px;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-dec {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .btn-dec:hover {
      background: rgba(239, 68, 68, 0.3);
      transform: scale(1.05);
    }
    .btn-inc {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .btn-inc:hover {
      background: rgba(34, 197, 94, 0.3);
      transform: scale(1.05);
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .action-btn {
      width: auto;
      height: auto;
      padding: 12px 20px;
      font-size: 13px;
      font-weight: 500;
      background: rgba(212, 176, 140, 0.15);
      color: #d4b08c;
      border: 1px solid rgba(212, 176, 140, 0.2);
    }
    .action-btn:hover {
      background: rgba(212, 176, 140, 0.25);
    }
    .status {
      margin-top: 16px;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-family: monospace;
      background: rgba(0,0,0,0.3);
      color: rgba(255,255,255,0.4);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .status.show {
      opacity: 1;
    }
    .bridge-status {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      transition: background 0.3s;
    }
    .bridge-status.connected {
      background: #22c55e;
    }
  </style>
</head>
<body>
  <div class="bridge-status" id="bridgeStatus"></div>
  
  <div class="counter-card">
    <h1>Interactive Counter</h1>
    <div class="count" id="count">0</div>
    <div class="label">Current Value</div>
    
    <div class="controls">
      <button class="btn-dec" onclick="decrement()">−</button>
      <button class="btn-inc" onclick="increment()">+</button>
    </div>
    
    <div class="actions">
      <button class="action-btn" onclick="sendToChat()">
        📤 Send Value to Chat
      </button>
      <button class="action-btn" onclick="updateContext()">
        💾 Update Model Context
      </button>
      <button class="action-btn" onclick="reset()">
        🔄 Reset Counter
      </button>
    </div>
    
    <div class="status" id="status"></div>
  </div>

  <script>
    let count = 0;
    const countEl = document.getElementById('count');
    const statusEl = document.getElementById('status');
    const bridgeStatusEl = document.getElementById('bridgeStatus');
    let bridgeReady = false;
    
    function initBridge() {
      if (typeof window === 'undefined' || window.parent === window) {
        showStatus('Running standalone (no parent frame)');
        return;
      }
      
      window.addEventListener('message', handleParentMessage);
      window.parent.postMessage({ type: 'mcp-app-loaded', appId: 'counter' }, '*');
      bridgeReady = true;
      bridgeStatusEl.classList.add('connected');
      showStatus('AppBridge ready');
    }
    
    function handleParentMessage(event) {
      if (event.data && event.data.type === 'appbridge-init') {
        bridgeReady = true;
        bridgeStatusEl.classList.add('connected');
        showStatus('AppBridge connected');
      }
    }
    
    function increment() {
      count++;
      updateDisplay();
      notifyChange('incremented');
    }
    
    function decrement() {
      count--;
      updateDisplay();
      notifyChange('decremented');
    }
    
    function reset() {
      count = 0;
      updateDisplay();
      notifyChange('reset');
    }
    
    function updateDisplay() {
      countEl.textContent = count;
      countEl.style.transform = 'scale(1.1)';
      setTimeout(() => {
        countEl.style.transform = 'scale(1)';
      }, 150);
    }
    
    function notifyChange(action) {
      if (bridgeReady && window.parent !== window) {
        window.parent.postMessage({
          type: 'mcp-app-notify',
          event: 'counter-changed',
          data: { action, value: count }
        }, '*');
      }
    }
    
    function sendToChat() {
      const message = { 
        type: 'text', 
        text: 'The counter value is now ' + count 
      };
      
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'mcp-app-message',
          role: 'user',
          content: [message]
        }, '*');
        showStatus('Sent to chat!');
      } else {
        showStatus('No parent frame');
      }
    }
    
    function updateContext() {
      const context = { 
        counterValue: count,
        lastUpdated: new Date().toISOString()
      };
      
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'mcp-app-update-context',
          context: context
        }, '*');
        showStatus('Context updated!');
      } else {
        showStatus('No parent frame');
      }
    }
    
    function showStatus(msg) {
      statusEl.textContent = msg;
      statusEl.classList.add('show');
      setTimeout(() => {
        statusEl.classList.remove('show');
      }, 3000);
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initBridge);
    } else {
      initBridge();
    }
  </script>
</body>
</html>`;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: ExtendedUIPart[];
  timestamp: number;
}

function McpLiveDemoInner() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [appMessage, setAppMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for app messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'mcp-app-message') {
        const text = event.data.content?.[0]?.text || 'Message from app';
        setAppMessage(text);
        addLog(`📩 App: ${text}`);
        
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          parts: [{ type: "text", text }],
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const runDemo = useCallback(async () => {
    setIsLoading(true);
    setLogs([]);
    setMessages([]);
    setAppMessage(null);
    
    addLog("🚀 Starting LIVE MCP App Demo");
    
    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: "Show me the interactive counter" }],
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    addLog("👤 User: Show me the interactive counter");
    
    // Simulate server processing
    await new Promise(r => setTimeout(r, 500));
    addLog("⚙️  Server: Processing tool call...");
    
    await new Promise(r => setTimeout(r, 500));
    addLog("📦 Server: Loading HTML resource (7981 bytes)");
    
    await new Promise(r => setTimeout(r, 300));
    addLog("✅ Server: Render payload ready");
    
    // Create MCP App UIPart
    const mcpAppPart: McpAppUIPart = {
      type: "mcp-app",
      toolCallId: `tc-${Date.now()}`,
      toolName: "interactive_counter",
      connectorId: "fixture-server",
      connectorName: "MCP Fixture Server",
      resourceUri: "ui:///counter-app",
      title: "Interactive Counter",
      description: "A counter app with AppBridge integration",
      html: COUNTER_APP_HTML,
      allow: "",
      prefersBorder: true,
      tool: {
        name: "interactive_counter",
        description: "Interactive counter with UI",
        inputSchema: { type: "object" },
      },
      toolInput: { initialValue: 0 },
      toolResult: { content: [{ type: "text", text: "Counter initialized" }] },
    };
    
    // Add assistant message with MCP app
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      parts: [
        { type: "text", text: "Here's an interactive counter for you:" },
        mcpAppPart,
      ],
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, assistantMsg]);
    
    addLog("🎨 UI: Rendering via UnifiedMessageRenderer");
    addLog("🔧 McpAppFrame: Creating iframe + AppBridge");
    addLog("✅ MCP App rendered in chat!");
    addLog("");
    addLog("💡 Try the buttons:");
    addLog("   • +/- to change counter");
    addLog("   • 📤 Send to Chat (ui/message)");
    addLog("   • 💾 Update Context (ui/update-model-context)");
    
    setIsLoading(false);
  }, [addLog]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-[#d4b08c]/20 bg-[#1a1a1a] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-[#d4b08c] to-[#f7d9ba] bg-clip-text text-transparent">
                🔴 LIVE MCP App Demo
              </h1>
              <p className="text-sm text-white/50 mt-1">
                Real interactive app rendering in platform UI
              </p>
            </div>
          </div>
          <button
            onClick={runDemo}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#d4b08c] text-[#0f0f0f] font-medium rounded-lg hover:bg-[#f7d9ba] transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <Play size={18} />
            )}
            {isLoading ? "Running..." : "Run Demo"}
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col max-w-4xl mx-auto">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-white/30">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Play size={32} />
                </div>
                <p className="text-lg">Click &quot;Run Demo&quot; to start</p>
                <p className="text-sm mt-2">Watch a real MCP app render live</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-[#d4b08c] text-[#0f0f0f] rounded-2xl rounded-br-sm px-5 py-3"
                      : "bg-[#1a1a1a] border border-white/10 rounded-2xl rounded-bl-sm px-5 py-4"
                  }`}
                >
                  <UnifiedMessageRenderer parts={msg.parts} isStreaming={false} />
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Logs */}
          {logs.length > 0 && (
            <div className="border-t border-white/10 bg-[#0a0a0a] px-6 py-4">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Execution Log
              </h3>
              <div className="font-mono text-xs text-white/60 space-y-1 max-h-32 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-[#d4b08c]/60 shrink-0">{i + 1}.</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="w-80 border-l border-white/10 bg-[#141414] p-6 overflow-y-auto hidden xl:block">
          <h3 className="text-sm font-semibold text-[#d4b08c] mb-4">
            What You&apos;re Seeing
          </h3>
          <div className="space-y-4 text-sm text-white/60">
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="font-medium text-white/80">1. UnifiedMessageRenderer</span>
              </div>
              <p className="text-xs">Renders mcp-app parts in chat</p>
            </div>
            
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="font-medium text-white/80">2. McpAppFrame</span>
              </div>
              <p className="text-xs">Creates sandboxed iframe + AppBridge</p>
            </div>
            
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="font-medium text-white/80">3. Interactive App</span>
              </div>
              <p className="text-xs">Real HTML with working buttons</p>
            </div>
            
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="font-medium text-white/80">4. AppBridge</span>
              </div>
              <p className="text-xs">PostMessage API for ui/message</p>
            </div>
          </div>

          {appMessage && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">
                Last App Message
              </h4>
              <p className="text-sm text-white/80">{appMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function McpLiveDemoPage() {
  return (
    <McpAppHostProvider>
      <McpLiveDemoInner />
    </McpAppHostProvider>
  );
}
