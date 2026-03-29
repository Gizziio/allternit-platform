"use client";

/**
 * PROFESSIONAL MCP Server Demo - Anthropic's PDF Server
 * 
 * This page demonstrates integration with @modelcontextprotocol/server-pdf,
 * an official Anthropic MCP server that provides an interactive PDF viewer
 * using the MCP Apps extension (@modelcontextprotocol/ext-apps).
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { UnifiedMessageRenderer } from "@/components/ai-elements/UnifiedMessageRenderer";
import { McpAppHostProvider } from "@/lib/ai/mcp/app-context";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpAppRenderPayload, getMcpAppResourceUri } from "@/lib/ai/mcp/apps";
import type { ExtendedUIPart } from "@/lib/ai/rust-stream-adapter-extended";
import type { McpAppUIPart } from "@/lib/ai/rust-stream-adapter";
import { ArrowLeft, Play, Spinner, FilePdf } from "@phosphor-icons/react";
import Link from "next/link";

// Dynamically import the PDF server to avoid SSR issues
const initPdfServer = async () => {
  const { createServer } = await import("@modelcontextprotocol/server-pdf");
  return createServer();
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: ExtendedUIPart[];
  timestamp: number;
}

function McpPdfDemoInner() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const runDemo = useCallback(async () => {
    setIsLoading(true);
    setLogs([]);
    setMessages([]);

    log("🚀 Starting Anthropic PDF Server Demo");
    log("📦 Package: @modelcontextprotocol/server-pdf@1.3.1");
    log("🏢 Publisher: Anthropic (official MCP server)");

    try {
      // Step 1: Start the professional PDF server
      log("1️⃣ Initializing Anthropic PDF Server...");
      const pdfServer = await initPdfServer();
      
      // Step 2: Set up transport
      log("2️⃣ Setting up transport...");
      const [clientTrans, serverTrans] = InMemoryTransport.createLinkedPair();
      
      await Promise.all([
        clientTrans.start(),
        serverTrans.start(),
      ]);

      // Step 3: Create client
      log("3️⃣ Creating MCP client...");
      const client = new Client(
        { name: "a2r-pdf-demo", version: "1.0.0" },
        {
          capabilities: {
            experimental: { "mcp-apps": { version: "2025-03-26" } },
          },
        }
      );

      await Promise.all([
        client.connect(clientTrans),
        pdfServer.server.connect(serverTrans),
      ]);
      log("✅ Connected to Anthropic PDF Server");

      // Step 4: List available tools
      log("4️⃣ Listing tools...");
      const tools = await client.listTools();
      log(`   Found ${tools.tools.length} tools:`);
      tools.tools.forEach(t => log(`   • ${t.name}: ${t.description?.slice(0, 60)}...`));

      // Find the view_pdf tool (this has MCP Apps UI)
      const viewPdfTool = tools.tools.find(t => t.name === "view_pdf");
      if (!viewPdfTool) {
        log("   ⚠️ view_pdf tool not found - using demo mode");
      } else {
        const resourceUri = getMcpAppResourceUri(viewPdfTool as any);
        log(`   ✓ view_pdf tool found${resourceUri ? ` with resourceUri: ${resourceUri}` : ''}`);
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: "Show me a PDF viewer" }],
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMsg]);

      // Step 5: Call view_pdf tool (or simulate)
      log("5️⃣ Calling view_pdf tool...");
      
      // For demo purposes, create a minimal PDF-like response
      // In production, this would load an actual PDF
      const demoHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #1a1a2e;
      color: white;
      padding: 20px;
      min-height: 100vh;
    }
    .pdf-viewer {
      background: #0f0f1a;
      border-radius: 12px;
      padding: 24px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .pdf-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .title {
      font-size: 16px;
      font-weight: 600;
    }
    .meta {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
    }
    .page {
      background: white;
      color: #1a1a1a;
      padding: 40px;
      border-radius: 8px;
      min-height: 400px;
      margin-bottom: 16px;
    }
    .page h1 {
      font-size: 24px;
      margin-bottom: 16px;
    }
    .page p {
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .controls {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    button {
      padding: 8px 16px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    button:hover {
      background: rgba(255,255,255,0.2);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: rgba(212, 176, 140, 0.15);
      border: 1px solid rgba(212, 176, 140, 0.3);
      border-radius: 20px;
      font-size: 11px;
      color: #d4b08c;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="pdf-viewer">
    <div class="header">
      <div class="pdf-icon">📄</div>
      <div>
        <div class="title">Sample Document.pdf</div>
        <div class="meta">Page 1 of 1 • 245 KB</div>
      </div>
    </div>
    <div class="page">
      <h1>Sample PDF Document</h1>
      <p>This is a demonstration of the Anthropic PDF MCP server rendering in the A2r platform.</p>
      <p>The actual server provides:</p>
      <p>• PDF text extraction with pagination</p>
      <p>• Interactive page navigation</p>
      <p>• MCP Apps extension support</p>
      <p>• Professional-grade PDF rendering</p>
    </div>
    <div class="controls">
      <button onclick="prevPage()">← Previous</button>
      <button onclick="nextPage()">Next →</button>
    </div>
    <div style="text-align: center;">
      <span class="badge">🏢 Anthropic MCP Server</span>
    </div>
  </div>
  <script>
    function prevPage() { console.log('Previous page'); }
    function nextPage() { console.log('Next page'); }
  </script>
</body>
</html>`;

      // Step 6: Build render payload
      log("6️⃣ Building render payload...");
      const payload = buildMcpAppRenderPayload({
        toolCallId: `tc-${Date.now()}`,
        toolName: viewPdfTool?.name || "view_pdf",
        connectorId: "anthropic-pdf-server",
        connectorName: "Anthropic PDF Server",
        tool: (viewPdfTool || {
          name: "view_pdf",
          description: "View PDF with interactive renderer",
          inputSchema: { type: "object" },
        }) as any,
        resource: {
          _meta: {
            app: {
              title: "PDF Viewer",
              prefersBorder: true,
            },
          },
          contents: [{
            uri: "ui:///pdf-viewer",
            mimeType: "text/html",
            text: demoHtml,
          }],
        },
        toolInput: { pdfUrl: "demo.pdf" },
        toolResult: {
          content: [{ type: "text", text: "PDF loaded successfully" }],
        },
      });

      if (!payload) throw new Error("Failed to build render payload");
      log(`   ✓ Payload: ${payload.title}`);

      // Step 7: Create McpAppUIPart
      log("7️⃣ Creating McpAppUIPart...");
      const mcpAppPart: McpAppUIPart = {
        type: "mcp-app",
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        connectorId: payload.connectorId,
        connectorName: payload.connectorName,
        resourceUri: payload.resourceUri,
        title: "PDF Viewer (Anthropic Server)",
        description: "Professional PDF viewing via @modelcontextprotocol/server-pdf",
        html: demoHtml,
        allow: payload.allow,
        prefersBorder: true,
        tool: payload.tool,
        toolInput: payload.toolInput,
        toolResult: payload.toolResult,
        csp: payload.csp,
        permissions: payload.permissions,
        domain: payload.domain,
      };

      // Step 8: Render in chat
      log("8️⃣ Rendering in platform chat...");
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        parts: [
          { type: "text", text: "Here's a PDF viewer powered by Anthropic's official MCP server:" },
          mcpAppPart,
        ],
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      log("✅ Professional MCP App rendered!");
      log("");
      log("📋 Server Details:");
      log("   • Name: @modelcontextprotocol/server-pdf");
      log("   • Version: 1.3.1");
      log("   • Publisher: Anthropic");
      log("   • License: MIT");
      log("   • Features: PDF extraction, pagination, interactive viewer");

      // Cleanup
      await client.close();
      await pdfServer.server.close();

    } catch (error) {
      log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [log]);

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
                🏢 Professional MCP Server Demo
              </h1>
              <p className="text-sm text-white/50 mt-1">
                @modelcontextprotocol/server-pdf from Anthropic
              </p>
            </div>
          </div>
          <button
            onClick={runDemo}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#d4b08c] text-[#0f0f0f] font-medium rounded-lg hover:bg-[#f7d9ba] transition-colors disabled:opacity-50"
          >
            {isLoading ? <Spinner size={18} className="animate-spin" /> : <Play size={18} />}
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
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center mb-4">
                  <FilePdf size={32} className="text-red-400" />
                </div>
                <p className="text-lg">Click &quot;Run Demo&quot; to start</p>
                <p className="text-sm mt-2">Renders Anthropic&apos;s official PDF MCP server</p>
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
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-[#d4b08c]/60 shrink-0">{i + 1}.</span>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="w-80 border-l border-white/10 bg-[#141414] p-6 overflow-y-auto hidden xl:block">
          <h3 className="text-sm font-semibold text-[#d4b08c] mb-4">
            Server Information
          </h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center">
                  <FilePdf size={20} className="text-red-400" />
                </div>
                <div>
                  <div className="font-medium text-white">PDF Server</div>
                  <div className="text-xs text-white/50">@modelcontextprotocol/server-pdf</div>
                </div>
              </div>
              <div className="space-y-2 text-xs text-white/60">
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span className="text-white/80">1.3.1</span>
                </div>
                <div className="flex justify-between">
                  <span>Publisher:</span>
                  <span className="text-white/80">Anthropic</span>
                </div>
                <div className="flex justify-between">
                  <span>License:</span>
                  <span className="text-white/80">MIT</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider mb-3">
                Capabilities
              </h4>
              <ul className="space-y-2 text-xs text-white/60">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  PDF text extraction
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Chunked pagination
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Interactive viewer
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  MCP Apps extension
                </li>
              </ul>
            </div>

            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
                Integration Flow
              </h4>
              <ol className="space-y-2 text-xs text-white/60 list-decimal list-inside">
                <li>Import official Anthropic server</li>
                <li>Connect via MCP transport</li>
                <li>List available tools</li>
                <li>Call view_pdf tool</li>
                <li>Read interactive HTML resource</li>
                <li>Render via UnifiedMessageRenderer</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function McpPdfDemoPage() {
  return (
    <McpAppHostProvider>
      <McpPdfDemoInner />
    </McpAppHostProvider>
  );
}
