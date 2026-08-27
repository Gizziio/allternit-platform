/**
 * Command types and helpers re-exported for path alias consumers.
 *
 * Runtime surface comes from the real implementation in the ink-app tree;
 * the widened type surface is re-exported from ./types/command.js below.
 */
export type {
  Command,
  CommandArg,
  CommandOption,
  CommandContext,
  CommandAvailability,
  CommandBase,
  CommandResultDisplay,
  LocalCommandResult,
  LocalCommandCall,
  LocalCommandModule,
  LocalJSXCommand,
  LocalJSXCommandCall,
  LocalJSXCommandContext,
  LocalJSXCommandModule,
  LocalJSXCommandOnDone,
  PromptCommand,
  ResumeEntrypoint,
} from './types/command.js'

export * from './cli/ui/ink-app/commands.js'

// Re-export shell parsing helpers that legacy relative-path imports reach through
// this barrel (e.g. `../../../../../commands.js`).
export {
  clearCommandPrefixCaches,
  extractOutputRedirections,
  splitCommand_DEPRECATED,
  splitCommandWithOperators,
} from './shared/utils/bash/commands.js'
