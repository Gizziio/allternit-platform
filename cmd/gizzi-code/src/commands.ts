/**
 * Command registry and execution
 */

import { log } from './runtime/util/log.js'

export interface Command {
  name: string
  description: string
  aliases?: string[]
  args?: CommandArg[]
  options?: CommandOption[]
  handler: (ctx: CommandContext) => Promise<void> | void
  hidden?: boolean
  requiresAuth?: boolean
}

export interface CommandArg {
  name: string
  description: string
  required?: boolean
  default?: string
}

export interface CommandOption {
  name: string
  alias?: string
  description: string
  type?: 'string' | 'number' | 'boolean'
  default?: unknown
}

export interface CommandContext {
  args: string[]
  options: Record<string, unknown>
  flags: Record<string, boolean>
  cwd: string
  sessionId?: string
}

// Command registry
const commands = new Map<string, Command>()
const aliases = new Map<string, string>()

export function registerCommand(command: Command): void {
  if (commands.has(command.name)) {
    log('warn', `Command ${command.name} already registered, overwriting`)
  }
  
  commands.set(command.name, command)
  
  // Register aliases
  command.aliases?.forEach(alias => {
    if (aliases.has(alias)) {
      log('warn', `Alias ${alias} already registered`)
    }
    aliases.set(alias, command.name)
  })
  
  log('debug', `Registered command: ${command.name}`)
}

export function unregisterCommand(name: string): void {
  const cmd = commands.get(name)
  if (cmd) {
    cmd.aliases?.forEach(alias => aliases.delete(alias))
    commands.delete(name)
  }
}

export function getCommand(name: string): Command | undefined {
  // Check direct match
  const direct = commands.get(name)
  if (direct) return direct
  
  // Check alias
  const aliased = aliases.get(name)
  if (aliased) return commands.get(aliased)
  
  return undefined
}

export function getAllCommands(): Command[] {
  return Array.from(commands.values())
}

export function getVisibleCommands(): Command[] {
  return getAllCommands().filter(cmd => !cmd.hidden)
}

export function hasCommand(name: string): boolean {
  return commands.has(name) || aliases.has(name)
}

// Command execution
export async function executeCommand(
  name: string,
  ctx: Partial<CommandContext> = {}
): Promise<void> {
  const command = getCommand(name)
  
  if (!command) {
    throw new Error(`Unknown command: ${name}`)
  }
  
  const fullContext: CommandContext = {
    args: ctx.args || [],
    options: ctx.options || {},
    flags: ctx.flags || {},
    cwd: ctx.cwd || process.cwd(),
    sessionId: ctx.sessionId,
  }
  
  log('info', `Executing command: ${name}`, { args: fullContext.args })
  
  try {
    await command.handler(fullContext)
  } catch (error) {
    log('error', `Command ${name} failed`, error)
    throw error
  }
}

// Command parsing
export function parseCommandLine(argv: string[]): {
  command: string
  args: string[]
  options: Record<string, unknown>
  flags: Record<string, boolean>
} {
  const [command, ...rest] = argv
  const args: string[] = []
  const options: Record<string, unknown> = {}
  const flags: Record<string, boolean> = {}
  
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=', 2)
      if (value !== undefined) {
        options[key] = value
      } else if (i + 1 < rest.length && !rest[i + 1].startsWith('-')) {
        options[key] = rest[++i]
      } else {
        flags[key] = true
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      const flag = arg.slice(1)
      flags[flag] = true
    } else {
      args.push(arg)
    }
  }
  
  return { command, args, options, flags }
}

// Help generation
export function generateHelp(command?: Command): string {
  if (command) {
    let help = `${command.name}`
    
    if (command.aliases?.length) {
      help += ` (${command.aliases.join(', ')})`
    }
    
    help += `\n\n${command.description}\n`
    
    if (command.args?.length) {
      help += '\nArguments:\n'
      command.args.forEach(arg => {
        const req = arg.required ? '' : ' (optional)'
        help += `  ${arg.name}${req} - ${arg.description}\n`
      })
    }
    
    if (command.options?.length) {
      help += '\nOptions:\n'
      command.options.forEach(opt => {
        const alias = opt.alias ? `-${opt.alias}, ` : ''
        help += `  ${alias}--${opt.name} - ${opt.description}\n`
      })
    }
    
    return help
  }
  
  // General help
  let help = 'Available commands:\n\n'
  getVisibleCommands().forEach(cmd => {
    help += `  ${cmd.name.padEnd(20)} ${cmd.description}\n`
  })
  
  return help
}

// Default export
export default {
  registerCommand,
  unregisterCommand,
  getCommand,
  getAllCommands,
  getVisibleCommands,
  hasCommand,
  executeCommand,
  parseCommandLine,
  generateHelp,
}
