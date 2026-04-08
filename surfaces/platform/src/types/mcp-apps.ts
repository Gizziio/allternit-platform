/**
 * MCP Apps Adapter types for Interactive Capsules.
 * Extracted from the private @allternit/mcp-apps-adapter package.
 */

export interface InteractiveCapsule {
  id: string;
  type: string;
  state: Record<string, unknown>;
  toolId?: string;
  surface: {
    html: string;
    css: string;
    js: string;
    permissions: CapsulePermission[];
  };
  createdAt: number;
  updatedAt: number;
}

export interface CapsulePermission {
  permission_type: string;
  resource: string;
  actions?: string[];
}

export interface CapsuleEvent {
  id: string;
  capsuleId: string;
  direction: 'inbound' | 'outbound';
  type: string;
  payload: unknown;
  timestamp: number;
  source: string;
}
