/**
 * MCP Apps Sandbox Proxy
 * 
 * Implements the web host security architecture for MCP Apps:
 * - Host origin is separate from sandbox proxy origin
 * - Raw HTML is passed to the proxy
 * - CSP and permissions are enforced in the sandbox
 * 
 * This route generates a sandboxed HTML page that:
 * 1. Creates an isolated iframe for the MCP App
 * 2. Enforces CSP from app metadata
 * 3. Manages postMessage bridge between host and app
 * 4. Handles permissions and blocked actions
 */

import { NextRequest, NextResponse } from "next/server";
import type { McpAppResourceCsp, McpAppResourcePermissions } from "@/lib/ai/mcp/apps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SandboxRequest {
  html: string;
  csp?: McpAppResourceCsp;
  permissions?: McpAppResourcePermissions;
  allow?: string;
  toolCallId: string;
  connectorId: string;
}

/**
 * Generate CSP header from MCP App metadata
 */
function generateCSP(csp?: McpAppResourceCsp): string {
  const directives: string[] = [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval'", // Required for MCP Apps
    "style-src 'unsafe-inline'",
  ];

  if (csp?.connectDomains && csp.connectDomains.length > 0) {
    const domains = csp.connectDomains.join(" ");
    directives.push(`connect-src ${domains}`);
  } else {
    directives.push("connect-src 'none'");
  }

  if (csp?.resourceDomains && csp.resourceDomains.length > 0) {
    const domains = csp.resourceDomains.join(" ");
    directives.push(`img-src ${domains}`);
    directives.push(`font-src ${domains}`);
    directives.push(`media-src ${domains}`);
  }

  if (csp?.frameDomains && csp.frameDomains.length > 0) {
    const domains = csp.frameDomains.join(" ");
    directives.push(`frame-src ${domains}`);
  }

  if (csp?.baseUriDomains && csp.baseUriDomains.length > 0) {
    const domains = csp.baseUriDomains.join(" ");
    directives.push(`base-uri ${domains}`);
  }

  // Additional security directives
  directives.push("form-action 'none'");
  directives.push("frame-ancestors 'none'");
  directives.push("object-src 'none'");

  return directives.join("; ");
}

/**
 * Generate iframe allow attribute from permissions
 */
function generateAllowAttribute(permissions?: McpAppResourcePermissions): string {
  const directives: string[] = [];

  if (permissions?.camera) {
    directives.push("camera");
  }
  if (permissions?.microphone) {
    directives.push("microphone");
  }
  if (permissions?.geolocation) {
    directives.push("geolocation");
  }
  if (permissions?.clipboardWrite) {
    directives.push("clipboard-write");
  }

  return directives.join("; ");
}

/**
 * Generate the sandbox proxy HTML
 */
function generateSandboxHTML(
  request: SandboxRequest,
  origin: string
): string {
  const cspHeader = generateCSP(request.csp);
  const allowAttribute = generateAllowAttribute(request.permissions);
  
  // Sanitize the HTML to prevent XSS
  const sanitizedHtml = request.html
    .replace(/<script\s+type="module"[^>]*>/gi, '<script type="text/plain" data-blocked="module">')
    .replace(/<script\s+src="https?:\/\//gi, '<script type="text/plain" data-blocked="external" data-original-src="');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${cspHeader}">
  <title>MCP App Sandbox</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      overflow: hidden;
      background: transparent;
    }
    #app-frame {
      width: 100%;
      height: 100%;
      border: none;
      background: white;
    }
    #csp-violation-banner {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #dc2626;
      color: white;
      padding: 8px 16px;
      font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif;
      font-size: 14px;
      z-index: 10000;
    }
    #csp-violation-banner.visible {
      display: block;
    }
  </style>
</head>
<body>
  <div id="csp-violation-banner">
    ⚠️ Security Policy Violation Detected
  </div>
  <iframe
    id="app-frame"
    sandbox="allow-scripts allow-same-origin"
    ${allowAttribute ? `allow="${allowAttribute}"` : ""}
    srcdoc="${escapeHtml(sanitizedHtml)}"
  ></iframe>
  
  <script>
    (function() {
      'use strict';
      
      const HOST_ORIGIN = ${JSON.stringify(origin)};
      const TOOL_CALL_ID = ${JSON.stringify(request.toolCallId)};
      const CONNECTOR_ID = ${JSON.stringify(request.connectorId)};
      
      const iframe = document.getElementById('app-frame');
      const violationBanner = document.getElementById('csp-violation-banner');
      
      // Track blocked actions for logging
      const blockedActions = [];
      
      // CSP Violation Handler
      document.addEventListener('securitypolicyviolation', (e) => {
        console.warn('[MCP Sandbox] CSP Violation:', {
          blockedURI: e.blockedURI,
          violatedDirective: e.violatedDirective,
          originalPolicy: e.originalPolicy,
        });
        
        blockedActions.push({
          type: 'csp-violation',
          blockedURI: e.blockedURI,
          violatedDirective: e.violatedDirective,
          timestamp: Date.now(),
        });
        
        // Show violation banner briefly
        violationBanner.classList.add('visible');
        setTimeout(() => {
          violationBanner.classList.remove('visible');
        }, 3000);
        
        // Report to host
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'mcp-sandbox-csp-violation',
            toolCallId: TOOL_CALL_ID,
            connectorId: CONNECTOR_ID,
            violation: {
              blockedURI: e.blockedURI,
              violatedDirective: e.violatedDirective,
            },
          }, HOST_ORIGIN);
        }
      });
      
      // Message bridge between app and host
      window.addEventListener('message', (event) => {
        // Validate origin - only accept messages from the iframe
        if (event.source !== iframe.contentWindow) {
          console.warn('[MCP Sandbox] Rejected message from unknown source');
          blockedActions.push({
            type: 'invalid-origin',
            timestamp: Date.now(),
          });
          return;
        }
        
        // Validate message structure
        if (!event.data || typeof event.data !== 'object') {
          return;
        }
        
        // Forward to host with sandbox metadata
        const message = {
          ...event.data,
          _sandbox: {
            toolCallId: TOOL_CALL_ID,
            connectorId: CONNECTOR_ID,
            timestamp: Date.now(),
          },
        };
        
        window.parent.postMessage(message, HOST_ORIGIN);
      });
      
      // Listen for messages from host to forward to app
      window.addEventListener('message', (event) => {
        if (event.source === iframe.contentWindow) {
          return; // Ignore messages from iframe (handled above)
        }
        
        // Only accept messages from host origin
        if (event.origin !== HOST_ORIGIN) {
          console.warn('[MCP Sandbox] Rejected host message from:', event.origin);
          blockedActions.push({
            type: 'invalid-host-origin',
            origin: event.origin,
            timestamp: Date.now(),
          });
          return;
        }
        
        // Forward to iframe
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(event.data, '*');
        }
      });
      
      // Report blocked actions periodically
      setInterval(() => {
        if (blockedActions.length > 0 && window.parent !== window) {
          window.parent.postMessage({
            type: 'mcp-sandbox-blocked-actions',
            toolCallId: TOOL_CALL_ID,
            connectorId: CONNECTOR_ID,
            actions: blockedActions.splice(0, blockedActions.length),
          }, HOST_ORIGIN);
        }
      }, 5000);
      
      // Ready signal
      iframe.addEventListener('load', () => {
        window.parent.postMessage({
          type: 'mcp-sandbox-ready',
          toolCallId: TOOL_CALL_ID,
          connectorId: CONNECTOR_ID,
        }, HOST_ORIGIN);
      });
      
      // Error handling
      window.addEventListener('error', (e) => {
        console.error('[MCP Sandbox] Error:', e.message);
        window.parent.postMessage({
          type: 'mcp-sandbox-error',
          toolCallId: TOOL_CALL_ID,
          connectorId: CONNECTOR_ID,
          error: e.message,
        }, HOST_ORIGIN);
      });
      
      // Unhandled promise rejections
      window.addEventListener('unhandledrejection', (e) => {
        console.error('[MCP Sandbox] Unhandled rejection:', e.reason);
        window.parent.postMessage({
          type: 'mcp-sandbox-unhandled-rejection',
          toolCallId: TOOL_CALL_ID,
          connectorId: CONNECTOR_ID,
          reason: String(e.reason),
        }, HOST_ORIGIN);
      });
    })();
  </script>
</body>
</html>`;
}

/**
 * Escape HTML for safe srcdoc embedding
 */
function escapeHtml(html: string): string {
  return html
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * POST handler - generates sandbox proxy page
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: SandboxRequest = await request.json();

    // Validate required fields
    if (!body.html || typeof body.html !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'html' field" },
        { status: 400 }
      );
    }

    if (!body.toolCallId || !body.connectorId) {
      return NextResponse.json(
        { error: "Missing toolCallId or connectorId" },
        { status: 400 }
      );
    }

    // Limit HTML size (10MB max)
    const MAX_HTML_SIZE = 10 * 1024 * 1024;
    if (body.html.length > MAX_HTML_SIZE) {
      return NextResponse.json(
        { error: "HTML content exceeds maximum size (10MB)" },
        { status: 413 }
      );
    }

    // Get the host origin from request headers
    const hostOrigin = request.headers.get("origin") || "*";

    // Generate the sandbox HTML
    const sandboxHTML = generateSandboxHTML(body, hostOrigin);

    // Return the sandbox page with CSP headers
    return new NextResponse(sandboxHTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[MCP Sandbox] Error generating sandbox:", error);
    return NextResponse.json(
      { error: "Failed to generate sandbox" },
      { status: 500 }
    );
  }
}

/**
 * GET handler - returns sandbox health/status
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    service: "mcp-sandbox-proxy",
    version: "1.0.0",
  });
}
