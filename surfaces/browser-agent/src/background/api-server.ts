/**
 * Embedded API Server
 * 
 * Runs a lightweight HTTP/WebSocket server inside the extension
 * to accept commands from A2R agents or external tools.
 */

interface CommandMessage {
  id: string;
  type: 'EXECUTE' | 'QUERY' | 'NAVIGATE' | 'CLICK' | 'TYPE' | 'EXTRACT';
  payload: any;
}

interface CommandResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

class ExtensionAPIServer {
  private isRunning = false;

  /**
   * Start the API server
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      this.setupExternalConnectionHandler();
      this.isRunning = true;
      console.log('[Gizzi Browser] API server started');
      this.broadcastStatus('online');
    } catch (error) {
      console.error('[Gizzi Browser] Failed to start API server:', error);
      throw error;
    }
  }

  /**
   * Setup handler for external connections
   */
  private setupExternalConnectionHandler(): void {
    chrome.runtime.onMessageExternal.addListener((
      message: CommandMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: CommandResponse) => void
    ) => {
      console.log('[Gizzi Browser] External message:', message);
      
      this.handleCommand(message)
        .then(response => sendResponse(response))
        .catch(error => sendResponse({
          id: message.id,
          success: false,
          error: String(error)
        }));
      
      return true;
    });

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'a2r-agent') {
        this.handleAgentConnection(port);
      }
    });
  }

  private handleAgentConnection(port: chrome.runtime.Port): void {
    console.log('[Gizzi Browser] Agent connected');
    
    port.onMessage.addListener(async (message: CommandMessage) => {
      const response = await this.handleCommand(message);
      port.postMessage(response);
    });
  }

  private async handleCommand(message: CommandMessage): Promise<CommandResponse> {
    try {
      switch (message.type) {
        case 'NAVIGATE':
          return await this.cmdNavigate(message);
        case 'CLICK':
          return await this.cmdClick(message);
        case 'TYPE':
          return await this.cmdType(message);
        case 'EXTRACT':
          return await this.cmdExtract(message);
        case 'QUERY':
          return await this.cmdQuery(message);
        case 'EXECUTE':
          return await this.cmdExecute(message);
        default:
          return {
            id: message.id,
            success: false,
            error: `Unknown command: ${message.type}`
          };
      }
    } catch (error) {
      return { id: message.id, success: false, error: String(error) };
    }
  }

  private async cmdNavigate(message: CommandMessage): Promise<CommandResponse> {
    const { url, tabId } = message.payload;
    const targetTabId = tabId || (await this.getActiveTab())?.id;
    if (!targetTabId) throw new Error('No active tab');

    await chrome.tabs.update(targetTabId, { url });
    return { id: message.id, success: true, data: { tabId: targetTabId, url } };
  }

  private async cmdClick(message: CommandMessage): Promise<CommandResponse> {
    const { selector, tabId } = message.payload;
    const targetTabId = tabId || (await this.getActiveTab())?.id;
    if (!targetTabId) throw new Error('No active tab');

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (sel) => {
        const el = document.querySelector(sel);
        if (el) { el.click(); return { clicked: true }; }
        return { clicked: false, error: 'Not found' };
      },
      args: [selector]
    });

    return { id: message.id, success: result.result?.clicked, data: result.result };
  }

  private async cmdType(message: CommandMessage): Promise<CommandResponse> {
    const { selector, text, tabId } = message.payload;
    const targetTabId = tabId || (await this.getActiveTab())?.id;
    if (!targetTabId) throw new Error('No active tab');

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (sel, value) => {
        const el = document.querySelector(sel) as HTMLInputElement;
        if (el) {
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return { typed: true };
        }
        return { typed: false };
      },
      args: [selector, text]
    });

    return { id: message.id, success: result.result?.typed, data: result.result };
  }

  private async cmdExtract(message: CommandMessage): Promise<CommandResponse> {
    const { selector, attribute, tabId } = message.payload;
    const targetTabId = tabId || (await this.getActiveTab())?.id;
    if (!targetTabId) throw new Error('No active tab');

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (sel, attr) => {
        const elements = document.querySelectorAll(sel);
        const data = Array.from(elements).map(el => {
          if (attr === 'text') return el.textContent?.trim();
          if (attr === 'html') return el.innerHTML;
          return el.getAttribute(attr);
        });
        return { count: elements.length, data };
      },
      args: [selector, attribute]
    });

    return { id: message.id, success: true, data: result.result };
  }

  private async cmdQuery(message: CommandMessage): Promise<CommandResponse> {
    const { tabId } = message.payload;
    const targetTabId = tabId || (await this.getActiveTab())?.id;
    if (!targetTabId) throw new Error('No active tab');

    const tab = await chrome.tabs.get(targetTabId);
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: () => ({
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      })
    });

    return {
      id: message.id,
      success: true,
      data: { tab: { id: tab.id, url: tab.url, title: tab.title }, page: result.result }
    };
  }

  private async cmdExecute(message: CommandMessage): Promise<CommandResponse> {
    const { script, tabId } = message.payload;
    const targetTabId = tabId || (await this.getActiveTab())?.id;
    if (!targetTabId) throw new Error('No active tab');

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (scriptText) => {
        try {
          const fn = new Function(scriptText);
          return { success: true, result: fn() };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      },
      args: [script]
    });

    return {
      id: message.id,
      success: result.result?.success,
      data: result.result?.result,
      error: result.result?.error
    };
  }

  private async getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  private broadcastStatus(status: 'online' | 'offline'): void {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'API_STATUS', status })
            .catch(() => {});
        }
      }
    });
  }

  stop(): void {
    this.isRunning = false;
    this.broadcastStatus('offline');
  }
}

export const apiServer = new ExtensionAPIServer();
