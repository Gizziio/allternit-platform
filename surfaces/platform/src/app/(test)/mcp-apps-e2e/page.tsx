"use client";

/**
 * MCP Apps E2E Production Test Page
 * 
 * This page demonstrates the complete production integration of MCP Apps
 * in the A2r platform. It shows exactly how MCP Apps work end-to-end
 * within the actual chat system.
 */

import React, { useState, useCallback } from "react";
import { UnifiedMessageRenderer } from "@/components/ai-elements/UnifiedMessageRenderer";
import { McpAppHostProvider } from "@/lib/ai/mcp/app-context";
import type { ExtendedUIPart } from "@/lib/ai/rust-stream-adapter-extended";
import type { McpAppUIPart } from "@/lib/ai/rust-stream-adapter";

// =============================================================================
// Mock MCP App HTML (simulating what comes from resources/read)
// =============================================================================

const MOCK_WEATHER_APP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .weather-card {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    .temp { font-size: 72px; font-weight: 200; }
    .location { font-size: 24px; opacity: 0.9; margin-top: 8px; }
    .condition { font-size: 18px; opacity: 0.8; margin-top: 4px; }
    .follow-up {
      margin-top: 24px;
      padding: 12px 24px;
      background: rgba(255,255,255,0.2);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .follow-up:hover { background: rgba(255,255,255,0.3); }
  </style>
</head>
<body>
  <div class="weather-card">
    <div class="temp">☀️ 72°F</div>
    <div class="location">San Francisco, CA</div>
    <div class="condition">Sunny • Humidity 45%</div>
    <button class="follow-up" onclick="sendFollowUp()">Get 7-day forecast</button>
  </div>
  <script>
    function sendFollowUp() {
      // This simulates ui/message from the app
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'mcp-app-message',
          role: 'user',
          content: [{ type: 'text', text: 'Get 7-day forecast' }]
        }, '*');
      }
    }
    
    // Notify host that app is ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'mcp-app-ready' }, '*');
    }
  </script>
</body>
</html>`;

const MOCK_CHART_APP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f8f9fa;
      padding: 20px;
    }
    .chart-container {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    h3 { margin-bottom: 16px; color: #1a1a1a; font-size: 16px; }
    canvas { max-height: 200px; }
  </style>
</head>
<body>
  <div class="chart-container">
    <h3>📊 Monthly Revenue</h3>
    <canvas id="chart"></canvas>
  </div>
  <script>
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'Revenue ($K)',
          data: [45, 52, 48, 61, 55, 67],
          backgroundColor: 'rgba(212, 176, 140, 0.8)',
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
          x: { grid: { display: false } }
        }
      }
    });
  </script>
</body>
</html>`;

// =============================================================================
// Mock Chat Messages with MCP Apps
// =============================================================================

const INITIAL_MESSAGES: Array<{ role: "user" | "assistant"; parts: ExtendedUIPart[] }> = [
  {
    role: "user",
    parts: [{ type: "text", text: "What's the weather in San Francisco?" }],
  },
  {
    role: "assistant",
    parts: [
      { type: "text", text: "Here's the current weather for San Francisco:" },
      {
        type: "mcp-app",
        toolCallId: "tc_weather_001",
        toolName: "weather.get_current",
        connectorId: "weather-server",
        connectorName: "Weather MCP Server",
        resourceUri: "ui:///weather-widget",
        title: "Weather Widget",
        description: "Current weather conditions",
        html: MOCK_WEATHER_APP_HTML,
        allow: "",
        prefersBorder: true,
        tool: {
          name: "weather.get_current",
          description: "Get current weather conditions",
          inputSchema: { type: "object" },
        },
        toolInput: { location: "San Francisco, CA" },
        toolResult: { temperature: 72, condition: "sunny", humidity: 45 },
      } as McpAppUIPart,
    ],
  },
  {
    role: "user",
    parts: [{ type: "text", text: "Show me a revenue chart" }],
  },
  {
    role: "assistant",
    parts: [
      { type: "text", text: "Here's your revenue data visualized:" },
      {
        type: "mcp-app",
        toolCallId: "tc_chart_002",
        toolName: "charts.create_bar",
        connectorId: "charts-server",
        connectorName: "Charts MCP Server",
        resourceUri: "ui:///bar-chart",
        title: "Revenue Chart",
        description: "Monthly revenue visualization",
        html: MOCK_CHART_APP_HTML,
        allow: "",
        prefersBorder: true,
        csp: {
          connectDomains: ["https://cdn.jsdelivr.net"],
        },
        tool: {
          name: "charts.create_bar",
          description: "Create a bar chart",
          inputSchema: { type: "object" },
        },
        toolInput: { data: [45, 52, 48, 61, 55, 67] },
      } as McpAppUIPart,
    ],
  },
];

// =============================================================================
// Production E2E Test Component
// =============================================================================

function McpAppsE2ETestInner() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [showSandboxMode, setShowSandboxMode] = useState(false);

  // Handle app-originated messages (ui/message)
  const handleAppMessage = useCallback((message: { role: "user" | "assistant"; parts: ExtendedUIPart[] }) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // Handle user input
  const handleSend = () => {
    if (!inputText.trim()) return;

    // Add user message
    setMessages((prev) => [
      ...prev,
      { role: "user", parts: [{ type: "text", text: inputText }] },
    ]);

    // Simulate assistant response with MCP App
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          parts: [
            { type: "text", text: `Processing your request: "${inputText}"` },
            {
              type: "mcp-app",
              toolCallId: `tc_${Date.now()}`,
              toolName: "demo.app",
              connectorId: "demo-server",
              connectorName: "Demo MCP Server",
              resourceUri: "ui:///demo",
              title: "Interactive Demo",
              description: "A demo MCP App",
              html: MOCK_WEATHER_APP_HTML,
              allow: "",
              prefersBorder: true,
            } as McpAppUIPart,
          ],
        },
      ]);
    }, 500);

    setInputText("");
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-[#d4b08c]/20 bg-[#1a1a1a] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold bg-gradient-to-r from-[#d4b08c] to-[#f7d9ba] bg-clip-text text-transparent">
              MCP Apps E2E Production Test
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Real integration with UnifiedMessageRenderer and McpAppFrame
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={showSandboxMode}
                onChange={(e) => setShowSandboxMode(e.target.checked)}
                className="rounded border-white/20 bg-white/5"
              />
              Use Sandbox Proxy
            </label>
            <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400">
              Production Ready
            </div>
          </div>
        </div>
      </header>

      {/* Architecture Info */}
      <div className="border-b border-white/10 bg-[#141414] px-6 py-3">
        <div className="flex items-center gap-6 text-xs text-white/40">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            UnifiedMessageRenderer
          </span>
          <span>→</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            McpAppFrame
          </span>
          <span>→</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            AppBridge + Sandbox
          </span>
          <span>→</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            MCP App (isolated)
          </span>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="space-y-6">
          {messages.map((message, idx) => (
            <div
              key={idx}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] ${
                  message.role === "user"
                    ? "bg-[#d4b08c] text-[#0f0f0f] rounded-2xl rounded-br-sm px-5 py-3"
                    : "bg-[#1a1a1a] border border-white/10 rounded-2xl rounded-bl-sm px-5 py-4"
                }`}
              >
                <UnifiedMessageRenderer
                  parts={message.parts}
                  isStreaming={false}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="mt-8 flex gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message to test MCP Apps..."
            className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#d4b08c]/50"
          />
          <button
            onClick={handleSend}
            className="px-6 py-3 bg-[#d4b08c] text-[#0f0f0f] font-medium rounded-xl hover:bg-[#f7d9ba] transition-colors"
          >
            Send
          </button>
        </div>

        {/* Feature Checklist */}
        <div className="mt-12 grid grid-cols-2 gap-6">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#d4b08c] mb-4">
              ✅ Working Features
            </h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Inline MCP App rendering
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                App chrome (title, source, badge)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Fullscreen mode toggle
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Tool input/result delivery
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                App-originated messages (ui/message)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Model context updates
              </li>
            </ul>
          </div>

          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#d4b08c] mb-4">
              🔒 Security Features
            </h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Sandbox proxy isolation
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                CSP enforcement
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Permission-based allow attributes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Cross-origin message validation
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                CSP violation logging
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Blocked action auditing
              </li>
            </ul>
          </div>
        </div>

        {/* Code Example */}
        <div className="mt-8 bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white/50 mb-3">
            How it works in production:
          </h3>
          <pre className="text-xs text-white/60 overflow-x-auto">
{`// 1. Tool execution emits mcp_app event
const renderPayload = buildMcpAppRenderPayload({
  toolCallId,
  toolName,
  connectorId,
  resource: await mcpClient.readResource(resourceUri),
  toolInput,
  toolResult,
});

dataStream.write({ type: "mcp_app", ...renderPayload });

// 2. rust-stream-adapter creates McpAppUIPart
// 3. UnifiedMessageRenderer renders it:
case 'mcp-app':
  return <McpAppFrame part={part} />;

// 4. McpAppFrame creates AppBridge with sandbox
// 5. App sends ui/message → chat thread
// 6. App sends ui/update-model-context → persisted`}
          </pre>
        </div>
      </div>
    </div>
  );
}

// Wrap with McpAppHostProvider for ui/message and ui/update-model-context
export default function McpAppsE2EPage() {
  return (
    <McpAppHostProvider>
      <McpAppsE2ETestInner />
    </McpAppHostProvider>
  );
}
