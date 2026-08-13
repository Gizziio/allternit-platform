/**
 * Page-agent runtime client (re-exported from shared service package).
 */

export {
  getPageAgentConfigEndpoint,
  getPageAgentRunEndpoint,
  getPageAgentStatusEndpoint,
  getPageAgentStopEndpoint,
  getPageAgentStreamEndpoint,
  runPageAgentTask,
  stopPageAgentTask,
  type PageAgentCallbacks,
} from "@allternit/page-agent";
