// Node Management exports
export { NodesView } from './NodesView';
export { NodeList } from './components/NodeList';
export { NodeCard } from './components/NodeCard';
export { AddNodeWizard } from './components/AddNodeWizard';
export { useNodes, useNodeToken, isNodeConnected } from './hooks/useNodes';
export type {
  NodeRecord,
  NodeCapabilities,
  NodeTokenResponse,
  NodesResponse,
  NodeStatus,
} from './types';
export { statusColors, statusLabels } from './types';

// Terminal exports
export { NodeTerminal, TerminalTabs, nodeTerminalService } from './terminal';
export type { TerminalSession, TerminalDataHandler, TerminalStatusHandler } from './terminal';

/**
 * Node Management Architecture
 * 
 * This module provides the Compute/Node management UI for Allternit.
 * 
 * Integration with Cloud Deploy:
 * - NodesView is the primary entry point (accessed via Settings → Compute & Runtimes)
 * - It has tabs for "Nodes", "Terminal", and "Deploy"
 * - The "Deploy" tab links to CloudDeployView for the actual provisioning wizard
 * - After deployment, new instances auto-register as nodes and appear in the Nodes list
 * 
 * Terminal Feature:
 * - Users can open terminals on connected nodes
 * - Multi-tab support for multiple node sessions
 * - WebSocket connection to node's PTY via control plane
 * 
 * User flows:
 * 1. Manage existing nodes: Settings → Compute → Nodes tab
 * 2. Open terminal: Click "Open Terminal" on a node or use Terminal tab
 * 3. Deploy new VPS: Settings → Compute → Deploy tab → Cloud Deploy wizard
 * 4. Connect BYOD node: Settings → Compute → Nodes tab → "Connect Existing Node"
 */
