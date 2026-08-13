/**
 * Gizzi Brain Client - runs ACI page-agent goals on the local gizzi runtime.
 *
 * Re-exported from the shared @allternit/page-agent package. The local file
 * remains so existing imports from `./gizzi-brain-client` keep working.
 */

export {
  runPageAgentTask as runGizziBrainTask,
  stopPageAgentTask as stopGizziBrainTask,
  type PageAgentCallbacks as GizziBrainCallbacks,
} from "@/lib/page-agent";
