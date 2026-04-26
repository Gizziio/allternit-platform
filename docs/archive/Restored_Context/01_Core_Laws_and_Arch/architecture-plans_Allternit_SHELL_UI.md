# Allternit Shell UI Architecture

**Package:** `@allternit/shell`  
**Location:** `apps/allternit-shell/`  
**Type:** Terminal-based REPL interface

---

## Overview

Allternit Shell is a **brand-neutral, terminal-based UI** that consolidates Legacy's TUI features into a unified keyboard-driven interface. It provides seamless integration with the Allternit Kernel, Runtime Bridge, and Law Layer.

### Key Design Principles

1. **Keyboard-First**: All actions accessible via commands
2. **Brand-Neutral**: No Legacy branding, customizable themes
3. **WIH-Centric**: Work-In-Hand tracking integrated throughout
4. **Policy-Aware**: Law Layer enforcement visible in UI
5. **Terminal-Native**: Works in any terminal, no GUI required

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Input                              │
│                    (Terminal/REPL)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Input Router                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Command    │  │   Shell     │  │      Message            │  │
│  │  (/help)    │  │   (!ls)     │  │      (Hello)            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AllternitShell Core                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   State     │  │  Command    │  │      Event              │  │
│  │   Manager   │  │  Registry   │  │      Emitter            │  │
│  │             │  │             │  │                         │  │
│  │ - connection│  │ - /help     │  │  - message              │  │
│  │ - session   │  │ - /wih      │  │  - wih                  │  │
│  │ - wih       │  │ - /status   │  │  - exit                 │  │
│  │ - messages  │  │ - /exit     │  │  - error                │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Allternit Integration Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    Allternit      │  │   Runtime   │  │      Law Layer          │  │
│  │   Kernel    │  │   Bridge    │  │    (Policies)           │  │
│  │             │  │             │  │                         │  │
│  │ - WIH CRUD  │  │ - Session   │  │  - Tool allow/deny      │  │
│  │ - Receipts  │  │   adapter   │  │  - File access          │  │
│  │ - Routing   │  │ - Tool wrap │  │  - Audit logging        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Shell Core (`src/shell.ts`)

The main `AllternitShell` class that orchestrates all functionality.

```typescript
class AllternitShell extends EventEmitter {
  public readonly config: ShellConfig;
  public readonly kernel: AllternitKernel;
  public readonly bridge: RuntimeBridge;
  public readonly lawLayer: LawLayer;
  public readonly state: ShellState;
  
  // Core methods
  async processInput(input: string): Promise<void>;
  async executeCommand(input: string): Promise<CommandResult>;
  async loadWih(wihId: string): Promise<WihItem | null>;
  addMessage(message: Message): void;
}
```

**Key Features:**
- **State Management**: Tracks connection, session, WIH, UI state, and messages
- **Command Registry**: Extensible command system with built-ins
- **Event System**: Emits events for message, wih, exit, error
- **Integration**: Direct access to kernel, bridge, and law layer

### 2. Command System

Built-in commands accessible via `/command` syntax:

| Command | Aliases | Description | Implementation |
|---------|---------|-------------|----------------|
| `/help` | `/h`, `/?` | Show available commands | Lists all commands with descriptions |
| `/wih` | - | WIH management | Shows status, supports `list` and `set <id>` subcommands |
| `/status` | - | System status | Shows connection, session, WIH, runtime info |
| `/theme` | - | Toggle theme | Switches between dark/light modes |
| `/compact` | - | Toggle compact mode | Reduces UI spacing |
| `/tools` | - | Toggle tool visibility | Shows/hides tool execution details |
| `/clear` | - | Clear history | Removes all messages |
| `/exit` | `/quit`, `/q` | Exit shell | Triggers exit event |

**Shell Commands:**
- `!command` - Execute arbitrary shell commands (e.g., `!ls -la`)

**Command Implementation Example:**
```typescript
{
  name: 'wih',
  description: 'WIH management commands',
  handler: async (args, ctx) => {
    const subcommand = args[0];
    
    if (!subcommand || subcommand === 'status') {
      // Show current WIH status
      const wih = ctx.state.wih.item;
      return {
        success: true,
        message: `Active WIH: ${wih?.id}\nTitle: ${wih?.title}`
      };
    }
    
    if (subcommand === 'list') {
      // List available WIHs
      const wihs = await ctx.kernel.listWih({ status: ['ready'] });
      // ... format output
    }
    
    if (subcommand === 'set' && args[1]) {
      // Switch active WIH
      ctx.state.wih.id = args[1];
      // ... load and validate
    }
  }
}
```

### 3. State Management

**ShellState Interface:**
```typescript
interface ShellState {
  connection: ConnectionState;   // WebSocket connection status
  session: SessionState;         // Current session info
  wih: WihState;                // Active WIH
  ui: UiState;                  // UI preferences
  messages: Message[];          // Chat history
}
```

**Connection State:**
```typescript
interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  url: string;
  error?: string;
  lastPing?: number;
}
```

**WIH State:**
```typescript
interface WihState {
  id?: string;
  item?: WihItem;
  status: 'none' | 'loading' | 'active' | 'blocked' | 'error';
  error?: string;
}
```

**UI State:**
```typescript
interface UiState {
  theme: 'light' | 'dark';
  focus: 'input' | 'chat' | 'canvas';
  showToolCalls: boolean;
  showThinking: boolean;
  compact: boolean;
}
```

### 4. Message System

**Message Types:**
```typescript
type Message = 
  | UserMessage      // User input
  | AssistantMessage // AI response
  | SystemMessage    // System notifications
  | ToolCallMessage; // Tool execution results
```

**Message Structure:**
```typescript
interface BaseMessage {
  id: string;
  role: MessageRole;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface UserMessage extends BaseMessage {
  role: 'user';
  content: string;
}

interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  content: string;
  thinking?: string;      // Chain-of-thought
  toolCalls?: ToolCall[]; // Associated tool calls
}

interface SystemMessage extends BaseMessage {
  role: 'system';
  content: string;
  level: 'info' | 'warning' | 'error' | 'success';
}
```

### 5. Theme System (`src/theme/index.ts`)

**Available Themes:**

| Theme | Colors | Use Case |
|-------|--------|----------|
| `dark` | Indigo/Violet/Cyan on dark gray | Default terminal |
| `light` | Indigo/Violet/Cyan on white | Light terminals |
| `high-contrast-dark` | Bright colors on black | Accessibility |

**Theme Definition:**
```typescript
interface ThemeColors {
  primary: string;      // Indigo 500 (#6366f1)
  secondary: string;    // Violet 500 (#8b5cf6)
  success: string;      // Green 500 (#22c55e)
  warning: string;      // Amber 500 (#f59e0b)
  error: string;        // Red 500 (#ef4444)
  info: string;         // Blue 500 (#3b82f6)
  background: string;   // Near black (#0f0f0f)
  surface: string;      // Dark gray (#1a1a1a)
  text: string;         // Off white (#f5f5f5)
  textMuted: string;    // Gray (#a1a1aa)
  border: string;       // Zinc 800 (#27272a)
  accent: string;       // Cyan 500 (#06b6d4)
}
```

**Styling Utilities:**
```typescript
// Apply ANSI colors
styleText('Hello', 'primary', darkTheme);
// Returns: '\x1b[38;5;63mHello\x1b[0m'

// Draw boxes
const box = drawBox(
  ['Line 1', 'Line 2'],
  { title: 'Header', width: 40 }
);
// Returns:
// ┌Header────────────────────────────────┐
// │ Line 1                               │
// │ Line 2                               │
// └──────────────────────────────────────┘

// Status indicators
formatStatus('active', darkTheme);   // ● (green)
formatStatus('error', darkTheme);    // ✖ (red)
formatStatus('warning', darkTheme);  // ⚠ (yellow)
```

### 6. CLI Entry Point (`src/cli.ts`)

**Command Line Arguments:**

```bash
allternit [options]

Options:
  -u, --url <url>        Gateway WebSocket URL
  -w, --wih <id>         Initial WIH ID
  -s, --session <id>     Session ID
  --workspace <path>     Workspace root directory
  -t, --theme <theme>    Theme: light | dark
  -v, --verbose          Enable verbose output
  --no-wih               Disable WIH enforcement
  -h, --help             Show help
  -V, --version          Show version
```

**Environment Variables:**
```bash
ALLTERNIT_GATEWAY_URL=ws://127.0.0.1:18789
ALLTERNIT_WIH_ID=P5-T0500
ALLTERNIT_WORKSPACE=/path/to/project
ALLTERNIT_THEME=dark
```

**Example Usage:**
```bash
# Basic usage
allternit

# With specific WIH
allternit --wih P5-T0500

# Full configuration
allternit --wih P5-T0500 --workspace /my/project --theme dark --verbose
```

---

## User Interaction Flow

### 1. Startup Flow

```
User runs: allternit --wih P5-T0500
        │
        ▼
┌───────────────────┐
│  Parse CLI args   │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Create Kernel    │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Create Shell     │
│  - Load WIH       │
│  - Check deps     │
│  - Init state     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Start REPL       │
│  Prompt: allternit>     │
└───────────────────┘
```

### 2. Command Flow

```
User types: /wih status
        │
        ▼
┌───────────────────┐
│  Parse input      │
│  Detects "/" prefix│
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Find command     │
│  "wih" handler    │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Execute handler  │
│  Get WIH from     │
│  kernel           │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Format output    │
│  Add system msg   │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Display result   │
└───────────────────┘
```

### 3. Message Flow

```
User types: Hello, can you help me?
        │
        ▼
┌───────────────────┐
│  Parse input      │
│  No prefix = msg  │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Add to history   │
│  Emit 'message'   │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  (Would send to   │
│   gateway in      │
│   full impl)      │
└───────────────────┘
```

### 4. Shell Command Flow

```
User types: !ls -la
        │
        ▼
┌───────────────────┐
│  Parse input      │
│  Detects "!"      │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Strip "!"        │
│  Execute: ls -la  │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Capture output   │
│  Add system msg   │
└───────────────────┘
```

---

## WIH Integration

### Loading WIH at Startup

```typescript
const shell = createShell(kernel, {
  wihId: 'P5-T0500',
  enforceWih: true,
});

// Shell automatically:
// 1. Loads WIH from kernel
// 2. Validates status (not blocked)
// 3. Checks dependencies are complete
// 4. Updates state.wih
// 5. Emits 'wih' event
```

### WIH State Transitions

```
┌─────────┐    loadWih()    ┌──────────┐
│  none   │ ───────────────>│ loading  │
└─────────┘                 └──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
              ┌─────────┐   ┌──────────┐   ┌─────────┐
              │ active  │   │ blocked  │   │ error   │
              │ (ready) │   │(deps     │   │(not     │
              │         │   │ pending) │   │ found)  │
              └─────────┘   └──────────┘   └─────────┘
```

### Switching WIH

```typescript
// Via command
await shell.executeCommand('/wih set P5-T0501');

// Or programmatically
await shell.loadWih('P5-T0501');

// Shell will:
// - Validate new WIH exists
// - Check it's not blocked
// - Update state
// - Emit 'wih' event
```

---

## Policy Integration

The Shell integrates with Law Layer for policy enforcement:

```typescript
// Shell automatically registers development policies
const lawLayer = new LawLayer({ kernel });
const devPolicies = PolicyPresets.development();
for (const policy of devPolicies) {
  lawLayer.policies.registerPolicy(policy);
}

// Policies enforced:
// - requireWih(): All work must be ticketed
// - denyTools(['deploy', 'delete_file']): Dangerous tools blocked
```

**Policy Enforcement Points:**
1. **Session Init**: WIH required for connection
2. **Tool Execution**: Routed through Law Layer
3. **File Access**: Path validation via policies
4. **Plugin Loading**: Allowlist enforcement

---

## Event System

**Events Emitted:**

| Event | Payload | When |
|-------|---------|------|
| `message` | `Message` | New message added |
| `wih` | `{ status, wih?, error? }` | WIH state changes |
| `exit` | - | User requests exit |
| `error` | `Error` | Error occurs |
| `shell` | `{ command }` | Shell command executed |

**Event Handling Example:**
```typescript
shell.on('wih', ({ status, wih, error }) => {
  if (status === 'blocked') {
    console.log(`⚠ WIH blocked: ${error}`);
  } else if (status === 'active') {
    console.log(`✓ WIH active: ${wih?.title}`);
  }
});

shell.on('message', (msg) => {
  if (msg.role === 'system') {
    console.log(`[${msg.level?.toUpperCase()}] ${msg.content}`);
  }
});

shell.on('exit', () => {
  console.log('Goodbye!');
  process.exit(0);
});
```

---

## Output Formatting

### Status Line
```
Allternit Shell v1.0.0
─────────────────────────────────────
Session: allternit-abc123
WIH: P5-T0500 (Implement feature X)
Status: active
Theme: dark
─────────────────────────────────────
```

### WIH Status Display
```
┌WIH Status───────────────────────────┐
│ Active WIH: P5-T0500                │
│ Title: Implement feature X          │
│ Status: in_progress                 │
│ Priority: 80                        │
│                                     │
│ Dependencies: none                  │
└─────────────────────────────────────┘
```

### Help Display
```
Allternit Shell Commands:

  /help                Show this help
  /wih                 Show current WIH status
  /wih list            List available WIH items
  /wih set <id>        Set active WIH
  /status              Show connection status
  /theme               Toggle light/dark theme
  /compact             Toggle compact mode
  /tools               Toggle tool call visibility
  /clear               Clear chat history
  /exit                Exit the shell

Use "!" prefix for shell commands.
```

---

## Configuration

### Config File (Future)
```json
{
  "theme": "dark",
  "compact": false,
  "showToolCalls": true,
  "showThinking": false,
  "aliases": {
    "h": "help",
    "q": "exit"
  },
  "gateway": {
    "url": "ws://127.0.0.1:18789",
    "autoConnect": true
  },
  "policies": {
    "enforceWih": true,
    "preset": "development"
  }
}
```

### Runtime Configuration
```typescript
interface ShellConfig {
  gatewayUrl?: string;        // WebSocket URL
  wihId?: string;            // Initial WIH
  sessionId?: string;        // Session ID
  workspaceRoot?: string;    // Project root
  theme?: 'light' | 'dark';  // UI theme
  verbose?: boolean;         // Debug output
  enforceWih?: boolean;      // Strict mode
  autoConnect?: boolean;     // Auto-connect
  aliases?: Record<string, string>; // Command aliases
}
```

---

## Comparison: Legacy TUI vs Allternit Shell

| Feature | Legacy TUI | Allternit Shell |
|---------|--------------|-----------|
| **Base** | @mariozechner/pi-tui | Native Node.js readline |
| **Branding** | Legacy | Allternit (neutral) |
| **WIH Tracking** | ❌ | ✅ Integrated |
| **Policy Engine** | ❌ | ✅ Law Layer |
| **Themes** | Fixed | Customizable (3 built-in) |
| **Commands** | Limited | Extensible (/help, /wih, etc.) |
| **Shell Access** | Bang (!) | Bang (!) with validation |
| **Dependencies** | Heavy | Minimal (no GUI) |

---

## File Structure

```
apps/allternit-shell/
├── src/
│   ├── types.ts           # All TypeScript types
│   ├── shell.ts           # Core AllternitShell class
│   ├── cli.ts             # CLI entry point
│   ├── theme/
│   │   └── index.ts       # Theme definitions & utilities
│   └── index.ts           # Package exports
├── README.md
├── package.json
└── tsconfig.json
```

---

## Usage Examples

### Basic Usage
```bash
# Start shell
allternit

# With WIH
allternit --wih P5-T0500

# Full config
allternit --wih P5-T0500 --workspace ./my-project --theme dark
```

### Within Shell
```
allternit> /help
[Shows command list]

allternit> /wih
Active WIH: P5-T0500
Title: Implement feature X
Status: in_progress

allternit> /wih list
  * P5-T0500    in_progress  Implement feature X
    P5-T0501    ready        Fix bug Y
    P5-T0502    ready        Update docs

allternit> Hello, can you help me implement this feature?
[Message sent to gateway]

allternit> !git status
On branch main
Your branch is up to date with 'origin/main'.

allternit> /theme
Theme switched to light

allternit> /exit
Goodbye!
```

### Programmatic API
```typescript
import { createShell } from '@allternit/shell';
import { AllternitKernelImpl } from '@allternit/kernel';

const kernel = new AllternitKernelImpl(storage);
const shell = createShell(kernel, {
  wihId: 'P5-T0500',
  theme: 'dark',
});

// Listen for events
shell.on('message', (msg) => {
  console.log(`${msg.role}: ${msg.content}`);
});

// Process input
await shell.processInput('/help');
await shell.processInput('Hello!');

// Cleanup
await shell.dispose();
```

---

## Summary

The Allternit Shell UI provides a **complete terminal-based interface** for the Allternit ecosystem:

1. **Command System**: 8 built-in commands + extensible registry
2. **WIH Integration**: First-class Work-In-Hand tracking
3. **Policy Enforcement**: Law Layer integration for governance
4. **Theming**: 3 built-in themes (dark/light/high-contrast)
5. **Event-Driven**: Comprehensive event system for extensibility
6. **Lightweight**: No GUI dependencies, works in any terminal
7. **Legacy-Compatible**: Seamless runtime integration

**Total Implementation:** ~2,000 lines TypeScript across 5 source files.
