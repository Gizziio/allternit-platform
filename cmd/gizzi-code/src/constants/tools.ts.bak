// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { feature } from 'bun:bundle'
import { TASK_OUTPUT_TOOL_NAME } from '../runtime/tools/builtins/taskoutputtool/constants.js'
import { EXIT_PLAN_MODE_V2_TOOL_NAME } from '../runtime/tools/builtins/exitplanmodetool/constants.js'
import { ENTER_PLAN_MODE_TOOL_NAME } from '../runtime/tools/builtins/enterplanmodetool/constants.js'
import { AGENT_TOOL_NAME } from '../runtime/tools/builtins/agenttool/constants.js'
import { ASK_USER_QUESTION_TOOL_NAME } from '../runtime/tools/builtins/askuserquestiontool/prompt.js'
import { TASK_STOP_TOOL_NAME } from '../runtime/tools/builtins/taskstoptool/prompt.js'
import { FILE_READ_TOOL_NAME } from '../runtime/tools/builtins/file-read/prompt.js'
import { WEB_SEARCH_TOOL_NAME } from '../runtime/tools/builtins/websearchtool/prompt.js'
import { TODO_WRITE_TOOL_NAME } from '../runtime/tools/builtins/todowritetool/constants.js'
import { GREP_TOOL_NAME } from '../runtime/tools/builtins/grep/prompt.js'
import { WEB_FETCH_TOOL_NAME } from '../runtime/tools/builtins/webfetchtool/prompt.js'
import { GLOB_TOOL_NAME } from '../runtime/tools/builtins/glob/prompt.js'
import { SHELL_TOOL_NAMES } from '../shared/utils/shell/shellToolUtils.js'
import { FILE_EDIT_TOOL_NAME } from '../runtime/tools/builtins/file-edit/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../runtime/tools/builtins/file-write/prompt.js'
import { NOTEBOOK_EDIT_TOOL_NAME } from '../runtime/tools/builtins/notebookedittool/constants.js'
import { TASK_CREATE_TOOL_NAME } from '../runtime/tools/builtins/taskcreatetool/constants.js'
import { SYNTHETIC_OUTPUT_TOOL_NAME } from '../runtime/tools/builtins/syntheticoutputtool/SyntheticOutputTool.js'
import { ENTER_WORKTREE_TOOL_NAME } from '../runtime/tools/builtins/enterworktreetool/constants.js'
import { EXIT_WORKTREE_TOOL_NAME } from '../runtime/tools/builtins/exitworktreetool/constants.js'

export const ALL_AGENT_DISALLOWED_TOOLS = new Set([
  TASK_OUTPUT_TOOL_NAME,
  EXIT_PLAN_MODE_V2_TOOL_NAME,
  ENTER_PLAN_MODE_TOOL_NAME,
  // Allow Agent tool for agents when user is ant (enables nested agents)
  ...(process.env.USER_TYPE === 'ant' ? [] : [AGENT_TOOL_NAME]),
  ASK_USER_QUESTION_TOOL_NAME,
  TASK_STOP_TOOL_NAME,

])

export const CUSTOM_AGENT_DISALLOWED_TOOLS = new Set([
  ...ALL_AGENT_DISALLOWED_TOOLS,
])

/*
 * Async Agent Tool Availability Status (Source of Truth)
 */
export const ASYNC_AGENT_ALLOWED_TOOLS = new Set([
  FILE_READ_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
  TODO_WRITE_TOOL_NAME,
  GREP_TOOL_NAME,
  WEB_FETCH_TOOL_NAME,
  GLOB_TOOL_NAME,
  ...SHELL_TOOL_NAMES,
  FILE_EDIT_TOOL_NAME,
  FILE_WRITE_TOOL_NAME,
  NOTEBOOK_EDIT_TOOL_NAME,
  SYNTHETIC_OUTPUT_TOOL_NAME,
  ENTER_WORKTREE_TOOL_NAME,
  EXIT_WORKTREE_TOOL_NAME,
])
/**
 * Tools allowed only for in-process teammates (not general async agents).
 * These are injected by inProcessRunner.ts and allowed through filterToolsForAgent
 * via isInProcessTeammate() check.
 */
export const IN_PROCESS_TEAMMATE_ALLOWED_TOOLS = new Set([
  TASK_CREATE_TOOL_NAME,
])

/*
 * BLOCKED FOR ASYNC AGENTS:
 * - AgentTool: Blocked to prevent recursion
 * - TaskOutputTool: Blocked to prevent recursion
 * - ExitPlanModeTool: Plan mode is a main thread abstraction.
 * - TaskStopTool: Requires access to main thread task state.
 * - TungstenTool: Uses singleton virtual terminal abstraction that conflicts between agents.
 *
 * ENABLE LATER (NEED WORK):
 * - MCPTool: TBD
 * - ListMcpResourcesTool: TBD
 * - ReadMcpResourceTool: TBD
 */

/**
 * Tools allowed in coordinator mode - only output and agent management tools for the coordinator
 */
export const COORDINATOR_MODE_ALLOWED_TOOLS = new Set([
  AGENT_TOOL_NAME,
  TASK_STOP_TOOL_NAME,
  SYNTHETIC_OUTPUT_TOOL_NAME,
])
