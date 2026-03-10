/**
 * A2rchitect Super-Agent OS - Components Index
 * 
 * Re-exports all UI components for the A2rOS system.
 */

export { A2rCanvas } from './A2rCanvas';
export type { A2rCanvasProps } from './A2rCanvas';

export { A2rConsole, A2rConsoleToggle } from './A2rConsole';
export type { A2rConsoleProps } from './A2rConsole';

export { 
  A2rChatIntegration, 
  MessageRenderer, 
  QuickLaunchButtons,
  useA2rChatIntegration,
  useStreamingMessage,
} from './A2rChatIntegration';
export type { ChatMessage, A2rChatIntegrationProps } from './A2rChatIntegration';
