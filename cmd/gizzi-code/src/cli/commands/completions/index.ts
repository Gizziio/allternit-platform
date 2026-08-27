// @ts-nocheck
/**
 * Shell Completions Command
 *
 * Generates shell completion scripts for bash, zsh, and fish.
 * Extends the built-in yargs .completion() with dedicated multi-shell
 * support and proper installation instructions.
 *
 * Usage:
 *   gizzi completions bash    — print bash completion script
 *   gizzi completions zsh     — print zsh completion script
 *   gizzi completions fish    — print fish completion script
 *   gizzi completions install — install completions for detected shell
 */

import type { CommandModule } from "yargs"
import { UI } from "@/cli/ui"
import path from "path"
import os from "os"
import fs from "fs/promises"
import { existsSync } from "fs"

const SCRIPT_NAME = "gizzi"

function bashCompletions(): string {
  return `###-begin-gizzi-completions-###
#
# Gizzi Code shell completions (bash)
#
# Installation:
#   gizzi completions bash >> ~/.bashrc
#   # or
#   gizzi completions bash > /etc/bash_completion.d/gizzi
#

_gizzi_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  commands="run exec generate serve connect skills upgrade models stats mcp acp session export import github pr debug doctor init plugin auth config profile permission-profile completions theme web brain vault status agent provider runtime labs"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    return 0
  fi

  # Subcommand completions
  case "\${COMP_WORDS[1]}" in
    profile)
      local subcmds="list save activate deactivate delete show"
      COMPREPLY=( $(compgen -W "\${subcmds}" -- "\${cur}") )
      ;;
    permission-profile)
      local subcmds="list show activate deactivate save delete presets"
      COMPREPLY=( $(compgen -W "\${subcmds}" -- "\${cur}") )
      ;;
    theme)
      local subcmds="show set list custom palette delete dark light system"
      COMPREPLY=( $(compgen -W "\${subcmds}" -- "\${cur}") )
      ;;
    session)
      local subcmds="list delete resume export share"
      COMPREPLY=( $(compgen -W "\${subcmds}" -- "\${cur}") )
      ;;
    completions)
      local subcmds="bash zsh fish install"
      COMPREPLY=( $(compgen -W "\${subcmds}" -- "\${cur}") )
      ;;
    auth)
      local subcmds="login logout status"
      COMPREPLY=( $(compgen -W "\${subcmds}" -- "\${cur}") )
      ;;
    config)
      local subcmds="list set get"
      COMPREPLY=( $(compgen -W "\${subcmds}" -- "\${cur}") )
      ;;
    *)
      # Fall back to file completion
      COMPREPLY=( $(compgen -f -- "\${cur}") )
      ;;
  esac

  return 0
}

complete -F _gizzi_completions ${SCRIPT_NAME}
###-end-gizzi-completions-###
`
}

function zshCompletions(): string {
  return `#compdef gizzi

# Gizzi Code shell completions (zsh)
#
# Installation:
#   gizzi completions zsh > ~/.zsh/completions/_gizzi
#   # Ensure ~/.zsh/completions is in fpath:
#   # fpath=(~/.zsh/completions $fpath)
#   # Then: compinit
#

_gizzi() {
  local -a commands
  commands=(
    'run:Start an interactive session'
    'exec:Execute a single prompt non-interactively'
    'generate:Generate code from a template'
    'serve:Start the Gizzi API server'
    'connect:Connect to a remote Allternit instance'
    'skills:Manage skills'
    'upgrade:Upgrade to the latest version'
    'models:List available models'
    'stats:Show usage statistics'
    'mcp:Manage MCP server connections'
    'acp:Agent Communication Protocol'
    'session:Manage sessions'
    'export:Export a session'
    'import:Import a session'
    'github:GitHub integration'
    'pr:Pull request operations'
    'debug:Debug tools'
    'doctor:Diagnose issues'
    'init:Initialize a new project'
    'plugin:Manage plugins'
    'auth:Authentication management'
    'config:Configuration management'
    'profile:Manage config profiles'
    'permission-profile:Manage permission profiles'
    'completions:Generate shell completions'
    'theme:Manage UI themes'
    'web:Open web interface'
    'brain:Brain/memory management'
    'vault:Secret management'
    'status:Show system status'
    'agent:Agent management'
    'provider:Provider configuration'
    'runtime:Runtime information'
    'labs:A://Labs course pipeline'
  )

  local -a profile_actions
  profile_actions=(
    'list:List all profiles'
    'save:Save current config as profile'
    'activate:Activate a profile'
    'deactivate:Deactivate current profile'
    'delete:Delete a profile'
    'show:Show profile details'
  )

  local -a perm_actions
  perm_actions=(
    'list:List available profiles'
    'show:Show profile details'
    'activate:Activate a profile'
    'deactivate:Deactivate current profile'
    'save:Save a custom profile'
    'delete:Delete a profile'
    'presets:Show built-in presets'
  )

  local -a theme_actions
  theme_actions=(
    'show:Show current theme'
    'set:Set a theme'
    'list:List available themes'
    'custom:Create a custom theme'
    'palette:Edit theme colors'
    'delete:Delete a custom theme'
    'dark:Switch to dark theme'
    'light:Switch to light theme'
    'system:Follow system theme'
  )

  _arguments -C \\
    '1:command:->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe -t commands 'gizzi command' commands
      ;;
    args)
      case $words[1] in
        profile)
          _describe -t actions 'profile action' profile_actions
          ;;
        permission-profile)
          _describe -t actions 'permission-profile action' perm_actions
          ;;
        theme)
          _describe -t actions 'theme action' theme_actions
          ;;
        completions)
          local -a shells
          shells=(bash zsh fish install)
          _describe -t shells 'shell type' shells
          ;;
      esac
      ;;
  esac
}

_gizzi "$@"
`
}

function fishCompletions(): string {
  return `# Gizzi Code shell completions (fish)
#
# Installation:
#   gizzi completions fish > ~/.config/fish/completions/gizzi.fish
#

# Disable file completions by default
complete -c gizzi -f

# Top-level commands
complete -c gizzi -n "__fish_use_subcommand" -a "run" -d "Start an interactive session"
complete -c gizzi -n "__fish_use_subcommand" -a "exec" -d "Execute a single prompt"
complete -c gizzi -n "__fish_use_subcommand" -a "generate" -d "Generate code from template"
complete -c gizzi -n "__fish_use_subcommand" -a "serve" -d "Start the API server"
complete -c gizzi -n "__fish_use_subcommand" -a "connect" -d "Connect to remote instance"
complete -c gizzi -n "__fish_use_subcommand" -a "skills" -d "Manage skills"
complete -c gizzi -n "__fish_use_subcommand" -a "upgrade" -d "Upgrade to latest version"
complete -c gizzi -n "__fish_use_subcommand" -a "models" -d "List available models"
complete -c gizzi -n "__fish_use_subcommand" -a "stats" -d "Show usage statistics"
complete -c gizzi -n "__fish_use_subcommand" -a "mcp" -d "Manage MCP servers"
complete -c gizzi -n "__fish_use_subcommand" -a "session" -d "Manage sessions"
complete -c gizzi -n "__fish_use_subcommand" -a "export" -d "Export a session"
complete -c gizzi -n "__fish_use_subcommand" -a "import" -d "Import a session"
complete -c gizzi -n "__fish_use_subcommand" -a "github" -d "GitHub integration"
complete -c gizzi -n "__fish_use_subcommand" -a "pr" -d "Pull request operations"
complete -c gizzi -n "__fish_use_subcommand" -a "debug" -d "Debug tools"
complete -c gizzi -n "__fish_use_subcommand" -a "doctor" -d "Diagnose issues"
complete -c gizzi -n "__fish_use_subcommand" -a "init" -d "Initialize project"
complete -c gizzi -n "__fish_use_subcommand" -a "plugin" -d "Manage plugins"
complete -c gizzi -n "__fish_use_subcommand" -a "auth" -d "Authentication"
complete -c gizzi -n "__fish_use_subcommand" -a "config" -d "Configuration"
complete -c gizzi -n "__fish_use_subcommand" -a "profile" -d "Config profiles"
complete -c gizzi -n "__fish_use_subcommand" -a "permission-profile" -d "Permission profiles"
complete -c gizzi -n "__fish_use_subcommand" -a "completions" -d "Shell completions"
complete -c gizzi -n "__fish_use_subcommand" -a "theme" -d "UI themes"
complete -c gizzi -n "__fish_use_subcommand" -a "web" -d "Web interface"
complete -c gizzi -n "__fish_use_subcommand" -a "brain" -d "Brain/memory"
complete -c gizzi -n "__fish_use_subcommand" -a "vault" -d "Secrets"
complete -c gizzi -n "__fish_use_subcommand" -a "status" -d "System status"
complete -c gizzi -n "__fish_use_subcommand" -a "agent" -d "Agent management"
complete -c gizzi -n "__fish_use_subcommand" -a "provider" -d "Provider config"
complete -c gizzi -n "__fish_use_subcommand" -a "runtime" -d "Runtime info"
complete -c gizzi -n "__fish_use_subcommand" -a "labs" -d "A://Labs courses"

# Global options
complete -c gizzi -l help -s h -d "Show help"
complete -c gizzi -l version -s v -d "Show version"
complete -c gizzi -l print-logs -d "Print logs to stderr"
complete -c gizzi -l log-level -a "DEBUG INFO WARN ERROR" -d "Log level"

# Profile subcommands
complete -c gizzi -n "__fish_seen_subcommand_from profile" -a "list save activate deactivate delete show"

# Permission profile subcommands
complete -c gizzi -n "__fish_seen_subcommand_from permission-profile" -a "list show activate deactivate save delete presets"

# Theme subcommands
complete -c gizzi -n "__fish_seen_subcommand_from theme" -a "show set list custom palette delete dark light system"

# Completions subcommands
complete -c gizzi -n "__fish_seen_subcommand_from completions" -a "bash zsh fish install"

# Session subcommands
complete -c gizzi -n "__fish_seen_subcommand_from session" -a "list delete resume export share"

# Auth subcommands
complete -c gizzi -n "__fish_seen_subcommand_from auth" -a "login logout status"
`
}

async function installCompletions(shell: string): Promise<void> {
  const home = os.homedir()

  switch (shell) {
    case "bash": {
      const rcPath = path.join(home, ".bashrc")
      if (!existsSync(rcPath)) {
        UI.error("~/.bashrc not found. Run `gizzi completions bash` and add manually.")
        return
      }
      const content = await fs.readFile(rcPath, "utf8")
      if (content.includes("###-begin-gizzi-completions-###")) {
        UI.info("Bash completions already installed.")
        return
      }
      await fs.appendFile(rcPath, "\n" + bashCompletions())
      UI.success("Bash completions appended to ~/.bashrc. Restart your shell or run `source ~/.bashrc`.")
      break
    }

    case "zsh": {
      const compDir = path.join(home, ".zsh", "completions")
      await fs.mkdir(compDir, { recursive: true })
      const filePath = path.join(compDir, "_gizzi")
      await fs.writeFile(filePath, zshCompletions())
      UI.success(`Zsh completions written to ${filePath}.`)
      UI.info("Ensure this directory is in fpath, then run `compinit`.")
      break
    }

    case "fish": {
      const compDir = path.join(home, ".config", "fish", "completions")
      await fs.mkdir(compDir, { recursive: true })
      const filePath = path.join(compDir, "gizzi.fish")
      await fs.writeFile(filePath, fishCompletions())
      UI.success(`Fish completions written to ${filePath}.`)
      break
    }

    default:
      UI.error(`Unknown shell: ${shell}`)
  }
}

function detectShell(): string | null {
  const shell = process.env.SHELL ?? ""
  if (shell.includes("zsh")) return "zsh"
  if (shell.includes("bash")) return "bash"
  if (shell.includes("fish")) return "fish"
  return null
}

export const CompletionsCommand: CommandModule = {
  command: "completions <shell>",
  describe: "generate or install shell completions (bash, zsh, fish)",
  builder: (yargs) =>
    yargs.positional("shell", {
      describe: "shell type",
      choices: ["bash", "zsh", "fish", "install"],
      type: "string",
      demandOption: true,
    }),
  handler: async (argv) => {
    const shell = argv.shell as string

    try {
      switch (shell) {
        case "bash":
          process.stdout.write(bashCompletions())
          break
        case "zsh":
          process.stdout.write(zshCompletions())
          break
        case "fish":
          process.stdout.write(fishCompletions())
          break
        case "install": {
          const detected = detectShell()
          if (!detected) {
            UI.error("Could not detect shell. Specify explicitly: gizzi completions bash|zsh|fish")
            process.exit(1)
          }
          UI.info(`Detected shell: ${detected}`)
          await installCompletions(detected)
          break
        }
        default:
          UI.error(`Unknown shell: ${shell}`)
          process.exit(1)
      }
    } catch (e) {
      UI.error(e instanceof Error ? e.message : String(e))
      process.exit(1)
    }
  },
}
