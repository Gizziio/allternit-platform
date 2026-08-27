import * as vscode from "vscode"

const TERMINAL_NAME = "Gizzi Code"
const PORT_ENV = "_EXTENSION_GIZZI_PORT"
const MIN_PORT = 16_384
const MAX_PORT = 65_535

let output: vscode.OutputChannel | undefined
let status: vscode.StatusBarItem | undefined

export function activate(context: vscode.ExtensionContext) {
  output = vscode.window.createOutputChannel("Gizzi Code")
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90)
  status.command = "gizzi.openTerminal"
  status.text = "$(sparkle) Gizzi"
  status.tooltip = "Open Gizzi Code"
  status.show()
  context.subscriptions.push(output, status)

  const openTerminal = async (forceNew = false) => {
    if (!forceNew) {
      const existing = gizziTerminals()[0]
      if (existing) {
        existing.show()
        return existing
      }
    }

    const port = randomPort()
    const workspace = activeWorkspaceFolder()
    const configuredCli = vscode.workspace.getConfiguration("gizzi").get<string>("cliPath", "gizzi")
    const terminal = vscode.window.createTerminal({
      name: TERMINAL_NAME,
      iconPath: vscode.ThemeIcon.File,
      cwd: workspace?.uri,
      location: { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
      env: {
        [PORT_ENV]: String(port),
        GIZZI_CALLER: "vscode",
      },
    })
    terminal.show()
    terminal.sendText(`${shellQuote(configuredCli)} --port ${port}`)
    setStatus("connecting", port)

    const connected = await waitForRuntime(port)
    setStatus(connected ? "connected" : "unavailable", port)
    if (!connected) {
      log(`Runtime on port ${port} did not become ready within the startup window.`)
      void vscode.window.showWarningMessage(
        "Gizzi Code started, but its editor bridge is not responding yet.",
        "Show Logs",
      ).then((choice) => choice === "Show Logs" && output?.show())
      return terminal
    }

    const fileRef = activeFileReference()
    if (fileRef) await appendPrompt(port, `In ${fileRef}`)
    return terminal
  }

  const focusOrOpen = () => openTerminal(false)
  const openNew = () => openTerminal(true)
  const insertFile = async () => {
    const fileRef = activeFileReference()
    if (!fileRef) {
      void vscode.window.showInformationMessage("Open a workspace file to add it to Gizzi Code.")
      return
    }
    const terminal = vscode.window.activeTerminal?.name === TERMINAL_NAME
      ? vscode.window.activeTerminal
      : gizziTerminals()[0]
    if (!terminal) {
      await openTerminal(false)
      return
    }
    const port = terminalPort(terminal)
    if (port && await appendPrompt(port, fileRef)) {
      terminal.show()
      return
    }
    terminal.sendText(fileRef, false)
    terminal.show()
  }
  const reconnect = async () => {
    const terminals = gizziTerminals()
    for (const terminal of terminals) terminal.dispose()
    await openTerminal(true)
  }
  const showLogs = () => output?.show()

  const handlers: Record<string, () => unknown> = {
    "gizzi.openTerminal": focusOrOpen,
    "gizzi.openNewTerminal": openNew,
    "gizzi.addFilepathToTerminal": insertFile,
    "gizzi.reconnect": reconnect,
    "gizzi.showLogs": showLogs,
  }
  for (const [command, handler] of Object.entries(handlers)) {
    context.subscriptions.push(vscode.commands.registerCommand(command, handler))
  }

  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      if (terminal.name === TERMINAL_NAME && gizziTerminals().length === 0) setStatus("idle")
    }),
    vscode.window.registerUriHandler({
      handleUri: async (uri) => {
        if (uri.path === "/open") await focusOrOpen()
        if (uri.path === "/new") await openNew()
      },
    }),
  )

  log(`Activated${vscode.env.remoteName ? ` in ${vscode.env.remoteName}` : ""}.`)
}

export function deactivate() {
  output = undefined
  status = undefined
}

function activeWorkspaceFolder() {
  const editorUri = vscode.window.activeTextEditor?.document.uri
  return (editorUri && vscode.workspace.getWorkspaceFolder(editorUri)) ?? vscode.workspace.workspaceFolders?.[0]
}

function activeFileReference() {
  const editor = vscode.window.activeTextEditor
  if (!editor || !vscode.workspace.getWorkspaceFolder(editor.document.uri)) return
  let reference = `@${vscode.workspace.asRelativePath(editor.document.uri, false)}`
  if (!editor.selection.isEmpty) {
    const start = editor.selection.start.line + 1
    const end = editor.selection.end.line + 1
    reference += start === end ? `#L${start}` : `#L${start}-${end}`
  }
  return reference
}

function gizziTerminals() {
  return vscode.window.terminals.filter((terminal) => terminal.name === TERMINAL_NAME)
}

function terminalPort(terminal: vscode.Terminal): number | undefined {
  const env = terminal.creationOptions && "env" in terminal.creationOptions ? terminal.creationOptions.env : undefined
  const raw = env?.[PORT_ENV]
  const port = typeof raw === "string" ? Number(raw) : NaN
  return Number.isInteger(port) ? port : undefined
}

async function appendPrompt(port: number, text: string): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/tui/append-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(2_000),
    })
    return response.ok
  } catch (error) {
    log(`Unable to append editor context: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function waitForRuntime(port: number): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/app`, { signal: AbortSignal.timeout(500) })
      if (response.ok) return true
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

function randomPort() {
  return Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1)) + MIN_PORT
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function setStatus(state: "idle" | "connecting" | "connected" | "unavailable", port?: number) {
  if (!status) return
  if (state === "connecting") status.text = "$(sync~spin) Gizzi"
  if (state === "connected") status.text = "$(sparkle) Gizzi"
  if (state === "unavailable") status.text = "$(warning) Gizzi"
  if (state === "idle") status.text = "$(sparkle) Gizzi"
  status.tooltip = port ? `Gizzi Code editor bridge on port ${port}` : "Open Gizzi Code"
}

function log(message: string) {
  output?.appendLine(`[${new Date().toISOString()}] ${message}`)
}
