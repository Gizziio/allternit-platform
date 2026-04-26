import React from 'react';
import { AllternitOpenUIRenderer } from '../AllternitOpenUIRenderer';

interface McpOpenUIBridgeProps {
  toolResult: any;
  fallback?: React.ReactNode;
}

/**
 * McpOpenUIBridge
 * 
 * Automatically detects if an MCP tool result contains OpenUI Lang
 * and renders it visually. If not, it falls back to standard rendering.
 */
export const McpOpenUIBridge: React.FC<McpOpenUIBridgeProps> = ({ toolResult, fallback }) => {
  // Check if the tool result contains the OpenUI signature [v:
  const content = typeof toolResult === 'string' 
    ? toolResult 
    : JSON.stringify(toolResult);

  const hasOpenUI = content.includes('[v:');

  if (hasOpenUI) {
    // Extract just the OpenUI part if it's wrapped in other text
    const match = content.match(/\[v:[\s\S]*\]/);
    const stream = match ? match[0] : content;

    return (
      <div className="mcp-visual-output my-2">
        <AllternitOpenUIRenderer stream={stream} />
      </div>
    );
  }

  return <>{fallback}</>;
};

export default McpOpenUIBridge;
