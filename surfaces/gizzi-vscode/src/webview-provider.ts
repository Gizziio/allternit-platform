import * as vscode from "vscode";
import { AllternitClient, ChatMessage } from "./client";

/**
 * Message structure for communication between the webview and extension host.
 */
interface WebviewMessage {
  type: "userMessage" | "clearChat";
  content?: string;
}

/**
 * Sidebar webview provider for the Gizzi Code chat interface.
 * Implements the VS Code WebviewViewProvider interface to render
 * an interactive chat panel in the activity bar sidebar.
 */
export class GizziSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "gizzi.sidebar";

  private view?: vscode.WebviewView;
  private chatHistory: ChatMessage[] = [];
  private readonly client: AllternitClient;

  /**
   * Creates a new GizziSidebarProvider.
   * @param extensionUri - The URI of the extension's root directory
   */
  constructor(private readonly extensionUri: vscode.Uri) {
    const config = vscode.workspace.getConfiguration("gizzi");
    const apiUrl = config.get<string>("apiUrl", "http://localhost:4096");
    const apiKey = config.get<string>("apiKey", "");
    this.client = new AllternitClient(apiUrl, apiKey);

    this.chatHistory.push({
      role: "system",
      content:
        "You are Gizzi Code, an AI coding assistant embedded in VS Code. " +
        "Help the user understand, refactor, debug, and generate code. " +
        "Be concise and practical. When showing code, use markdown code blocks with language identifiers.",
    });
  }

  /**
   * Called by VS Code when the webview view is resolved (made visible).
   * Sets up the webview HTML and handles incoming messages.
   * @param webviewView - The webview view instance
   * @param _context - Webview resolve context (unused)
   * @param _token - Cancellation token
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent();

    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      switch (message.type) {
        case "userMessage":
          if (message.content) {
            await this.handleUserMessage(message.content);
          }
          break;
        case "clearChat":
          this.chatHistory = [this.chatHistory[0]];
          this.postMessage({ type: "chatCleared" });
          break;
      }
    });
  }

  /**
   * Sends a user message to the Allternit API and streams the response
   * back to the webview.
   * @param content - The user's input text
   */
  private async handleUserMessage(content: string): Promise<void> {
    this.chatHistory.push({ role: "user", content });

    try {
      const response = await this.client.chat(this.chatHistory);
      this.chatHistory.push({ role: "assistant", content: response });
      this.postMessage({ type: "assistantMessage", content: response });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.postMessage({
        type: "error",
        content: `Failed to get response: ${errorMessage}`,
      });
    }
  }

  /**
   * Displays content in the webview as an assistant message.
   * Used by command handlers to push results into the chat panel.
   * @param content - The markdown content to display
   */
  public displayResult(content: string): void {
    this.chatHistory.push({ role: "assistant", content });
    this.postMessage({ type: "assistantMessage", content });
  }

  /**
   * Posts a message to the webview.
   * @param message - The message object to send
   */
  private postMessage(message: Record<string, unknown>): void {
    this.view?.webview.postMessage(message);
  }

  /**
   * Generates the full HTML content for the sidebar webview.
   * Includes inline CSS and JS for the chat interface.
   * @returns The complete HTML string
   */
  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gizzi Code</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --input-bg: var(--vscode-input-background);
      --input-border: var(--vscode-input-border);
      --input-fg: var(--vscode-input-foreground);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --button-hover: var(--vscode-button-hoverBackground);
      --accent: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--fg);
      background: var(--bg);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--input-border);
    }
    #header h1 {
      font-size: 14px;
      font-weight: 600;
      color: var(--accent);
    }
    #clear-btn {
      background: none;
      border: none;
      color: var(--fg);
      cursor: pointer;
      font-size: 12px;
      opacity: 0.7;
    }
    #clear-btn:hover { opacity: 1; }
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .message {
      padding: 8px 12px;
      border-radius: 6px;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .message.user {
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      align-self: flex-end;
      max-width: 90%;
    }
    .message.assistant {
      background: transparent;
      border-left: 2px solid var(--accent);
      padding-left: 10px;
    }
    .message.error {
      color: var(--vscode-errorForeground, #f44);
      border-left: 2px solid var(--vscode-errorForeground, #f44);
    }
    .message code {
      background: var(--input-bg);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
    }
    .message pre {
      background: var(--input-bg);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
    }
    .message pre code {
      background: none;
      padding: 0;
    }
    #input-area {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      border-top: 1px solid var(--input-border);
    }
    #input {
      flex: 1;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      padding: 6px 10px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      resize: none;
      outline: none;
    }
    #input:focus { border-color: var(--accent); }
    #send-btn {
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      border-radius: 4px;
      padding: 6px 14px;
      cursor: pointer;
      font-weight: 600;
    }
    #send-btn:hover { background: var(--button-hover); }
    #send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <div id="header">
    <h1>Gizzi Code</h1>
    <button id="clear-btn">Clear</button>
  </div>
  <div id="messages"></div>
  <div id="input-area">
    <textarea id="input" rows="1" placeholder="Ask Gizzi Code..."></textarea>
    <button id="send-btn">Send</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-btn');

    function addMessage(role, content) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.textContent = content;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function setError(content) {
      const div = document.createElement('div');
      div.className = 'message error';
      div.textContent = content;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    sendBtn.addEventListener('click', () => {
      const text = inputEl.value.trim();
      if (!text) return;
      addMessage('user', text);
      inputEl.value = '';
      sendBtn.disabled = true;
      vscode.postMessage({ type: 'userMessage', content: text });
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });

    clearBtn.addEventListener('click', () => {
      messagesEl.innerHTML = '';
      vscode.postMessage({ type: 'clearChat' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      sendBtn.disabled = false;
      if (msg.type === 'assistantMessage') {
        addMessage('assistant', msg.content);
      } else if (msg.type === 'error') {
        setError(msg.content);
      } else if (msg.type === 'chatCleared') {
        messagesEl.innerHTML = '';
      }
    });
  </script>
</body>
</html>`;
  }
}
