/**
 * Command types and helpers re-exported for path alias consumers.
 */
import type {
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
}

export { getCommandName, isCommandEnabled } from './types/command.js'

// Stub helpers referenced by consumers until real implementations are wired.
export function findCommand(_name: string): Command | undefined {
  return undefined
}

export function builtInCommandNames(): string[] {
  return []
}

export function clearCommandsCache(): void {}
export function clearCommandMemoizationCaches(): void {}
export function isBridgeSafeCommand(_cmd: Command): boolean {
  return false
}

export function formatDescriptionWithSource(_cmd: Command): string {
  return ''
}

export function getSkillToolCommands(): Command[] {
  return []
}

export function splitCommand_DEPRECATED(_input: string): string[] {
  return []
}

export function splitCommandWithOperators(_input: string): string[] {
  return []
}

export function extractOutputRedirections(_input: string): {
  command: string
  stdout?: string
  stderr?: string
} {
  return { command: _input }
}
